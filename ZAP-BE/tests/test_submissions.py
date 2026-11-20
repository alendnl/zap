import pytest
from fastapi.testclient import TestClient
import mongomock
from app.main import app
from app.db.mongodb import clear_database_cache, set_test_database, db_manager
from app.submissions.models import SubmissionStatus, SubmissionVerdict
from app.submissions.queue import MemorySubmissionQueue, _queue_instances
from app.submissions.rate_limiter import get_submission_rate_limiter

@pytest.fixture(autouse=True)
def setup_mock_db():
    get_submission_rate_limiter().reset()
    mock_client = mongomock.MongoClient()
    set_test_database(mock_client["test_zap_platform"], "production")
    set_test_database(mock_client["test_zap_platform_qa"], "qa")
    yield
    set_test_database(None, "production")
    set_test_database(None, "qa")
    # Clear any per-environment caches so tests do not leak state.
    clear_database_cache()
    _queue_instances.clear()
    get_submission_rate_limiter().reset()

client = TestClient(app)

def test_create_submission():
    payload = {
        "questionId": "valid-anagram",
        "language": "python",
        "mode": "SUBMIT",
        "sourceCode": "print('hello')",
        "userId": "student-test-1"
    }

    res = client.post("/api/v1/submissions", json=payload)
    assert res.status_code == 202
    data = res.json()
    assert "submissionId" in data
    assert data["status"] == "QUEUED"
    submission_id = data["submissionId"]

    # Get submission status
    get_res = client.get(f"/api/v1/submissions/{submission_id}")
    assert get_res.status_code == 200
    sub_data = get_res.json()
    assert sub_data["id"] == submission_id
    assert sub_data["status"] == "QUEUED"
    assert sub_data["questionId"] == "valid-anagram"
    assert sub_data["language"] == "python"
    assert "submittedAt" in sub_data
    assert sub_data["submittedAt"] == sub_data["createdAt"]

def test_create_submission_stores_timing_and_time_spent():
    custom_time = "2026-11-20T12:00:00Z"
    payload = {
        "questionId": "two-sum",
        "language": "python",
        "mode": "RUN",
        "sourceCode": "print('hello')",
        "userId": "student-timing-test",
        "submittedAt": custom_time,
        "timeSpentSeconds": 142
    }

    res = client.post("/api/v1/submissions", json=payload)
    assert res.status_code == 202
    data = res.json()
    submission_id = data["submissionId"]

    # Verify single fetch includes timing
    get_res = client.get(f"/api/v1/submissions/{submission_id}")
    assert get_res.status_code == 200
    sub_data = get_res.json()
    assert sub_data["submittedAt"] == custom_time
    assert sub_data["timeSpentSeconds"] == 142

    # Verify list submissions includes timing
    list_res = client.get(f"/api/v1/submissions?userId=student-timing-test")
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert len(list_data) >= 1
    found = next((s for s in list_data if s["id"] == submission_id), None)
    assert found is not None
    assert found["submittedAt"] == custom_time
    assert found["timeSpentSeconds"] == 142

def test_create_submission_uses_memory_queue_when_no_gcp():
    """Without GCP_PROJECT_ID, submissions enqueue into the memory queue."""
    from app.submissions.queue import get_queue_for_env
    queue = get_queue_for_env("production")
    request_queue = get_queue_for_env("production")
    assert isinstance(queue, MemorySubmissionQueue)
    assert request_queue is queue

    payload = {
        "questionId": "two-sum",
        "language": "python",
        "mode": "RUN",
        "sourceCode": "print(1)",
    }
    res = client.post("/api/v1/submissions", json=payload)
    assert res.status_code == 202
    assert queue.size() > 0


def test_failed_enqueue_does_not_leave_submission_queued():
    from app.submissions.service import SubmissionService
    from app.submissions.models import SubmissionCreateRequest

    class FailingQueue:
        def enqueue(self, job):
            raise RuntimeError("Cloud Tasks unavailable")

    service = SubmissionService(db_manager.dbs["production"], FailingQueue())
    request = SubmissionCreateRequest(
        questionId="two-sum",
        language="python",
        mode="RUN",
        sourceCode="print(1)",
    )

    with pytest.raises(RuntimeError, match="Cloud Tasks unavailable"):
        service.create_submission(request)

    stored = db_manager.dbs["production"].submissions.find_one({})
    assert stored["status"] == SubmissionStatus.FAILED.value
    assert stored["verdict"] == SubmissionVerdict.SYSTEM_ERROR.value
    assert "Failed to enqueue submission" in stored["errorMessage"]

def test_cancel_submission():
    payload = {
        "questionId": "two-sum",
        "language": "python",
        "mode": "RUN",
        "sourceCode": "pass"
    }
    create_res = client.post("/api/v1/submissions", json=payload)
    sub_id = create_res.json()["submissionId"]

    cancel_res = client.post(f"/api/v1/submissions/{sub_id}/cancel")
    assert cancel_res.status_code == 200
    assert cancel_res.json()["verdict"] == SubmissionVerdict.CANCELLED.value


def test_submission_claim_is_atomic_and_retryable():
    from app.submissions.service import SubmissionService

    response = client.post("/api/v1/submissions", json={
        "questionId": "claim-test",
        "language": "python",
        "mode": "RUN",
        "sourceCode": "print(1)",
    })
    submission_id = response.json()["submissionId"]
    service = SubmissionService(db_manager.dbs["production"])

    claimed = service.claim_submission(submission_id)
    assert claimed.status == SubmissionStatus.RUNNING
    assert service.claim_submission(submission_id) is None

    service.requeue_submission(submission_id, "temporary failure")
    retried_claim = service.claim_submission(submission_id)
    assert retried_claim.status == SubmissionStatus.RUNNING


def test_qa_environment_uses_qa_database_and_queue():
    from app.db.mongodb import db_manager
    from app.submissions.queue import get_queue_for_env

    payload = {
        "questionId": "qa-question",
        "language": "python",
        "mode": "RUN",
        "sourceCode": "print(1)",
    }
    response = client.post("/api/v1/submissions", json=payload, headers={"X-ZAP-ENV": "qa"})
    assert response.status_code == 202

    qa_db = db_manager.dbs["qa"]
    assert qa_db.submissions.find_one({"_id": response.json()["submissionId"]}) is not None
    assert db_manager.dbs["production"].submissions.count_documents({}) == 0
    qa_queue = get_queue_for_env("qa")
    job = qa_queue.dequeue()
    assert job["environment"] == "qa"


def test_create_submission_with_qa_header_uses_qa_db():
    payload = {
        "questionId": "qa-question",
        "language": "python",
        "mode": "RUN",
        "sourceCode": "print(1)",
    }
    response = client.post("/api/v1/submissions", json=payload, headers={"X-ZAP-ENV": "qa"})
    assert response.status_code == 202
    assert db_manager.dbs["qa"].submissions.find_one({"_id": response.json()["submissionId"]})


def test_list_submissions_filters():
    # Create a couple of submissions
    sub1 = client.post("/api/v1/submissions", json={
        "questionId": "two-sum",
        "language": "python",
        "mode": "SUBMIT",
        "sourceCode": "print(1)",
        "userId": "user-a"
    }).json()

    sub2 = client.post("/api/v1/submissions", json={
        "questionId": "two-sum",
        "language": "c",
        "mode": "RUN",
        "sourceCode": "int main() { return 0; }",
        "userId": "user-a"
    }).json()

    sub3 = client.post("/api/v1/submissions", json={
        "questionId": "reverse-string",
        "language": "python",
        "mode": "SUBMIT",
        "sourceCode": "print(2)",
        "userId": "user-b"
    }).json()

    # Query all for user-a
    res = client.get("/api/v1/submissions?userId=user-a")
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 2
    ids = [it["id"] for it in items]
    assert sub1["submissionId"] in ids
    assert sub2["submissionId"] in ids

    # Query by questionId
    res = client.get("/api/v1/submissions?questionId=reverse-string")
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["userId"] == "user-b"

    # Query by mode
    res = client.get("/api/v1/submissions?userId=user-a&mode=SUBMIT")
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["id"] == sub1["submissionId"]
    # Ensure sourceCode and testResults are omitted from list summary
    summary_item = res.json()[0]
    assert "sourceCode" not in summary_item
    assert "testResults" not in summary_item
    assert "status" in summary_item
    assert "language" in summary_item
    assert "createdAt" in summary_item


def test_rate_limiting_4_per_minute_rule():
    payload_run = {
        "questionId": "valid-anagram",
        "language": "python",
        "mode": "RUN",
        "sourceCode": "print('hello')",
        "userId": "rate-limit-user-1"
    }
    payload_submit = {
        "questionId": "valid-anagram",
        "language": "python",
        "mode": "SUBMIT",
        "sourceCode": "print('hello')",
        "userId": "rate-limit-user-1"
    }

    # Attempts 1 to 4 (combined RUN + SUBMIT) -> allowed
    res1 = client.post("/api/v1/submissions", json=payload_run)
    assert res1.status_code == 202

    res2 = client.post("/api/v1/submissions", json=payload_submit)
    assert res2.status_code == 202

    res3 = client.post("/api/v1/submissions", json=payload_run)
    assert res3.status_code == 202

    res4 = client.post("/api/v1/submissions", json=payload_submit)
    assert res4.status_code == 202

    # 5th attempt within that minute -> cut off with 429
    res5 = client.post("/api/v1/submissions", json=payload_run)
    assert res5.status_code == 429
    assert "Too many attempts, please wait for one minute or try after one minute." in res5.json()["detail"]
    assert res5.headers.get("retry-after") == "60"

    # Different user is not blocked
    other_payload = dict(payload_run, userId="rate-limit-user-2")
    res_other = client.post("/api/v1/submissions", json=other_payload)
    assert res_other.status_code == 202


def test_rate_limiting_60_seconds_rule(monkeypatch):
    import time
    from app.submissions.rate_limiter import get_submission_rate_limiter

    limiter = get_submission_rate_limiter()
    limiter.reset()

    # Simulate 4 requests spaced across 30 seconds (at t=1000, 1010, 1020, 1030)
    timestamps = [1000.0, 1010.0, 1020.0, 1030.0]
    limiter._history["user-60s"] = list(timestamps)

    # At t=1050, 5th attempt is within 60s of t=1000 -> blocked
    monkeypatch.setattr(time, "time", lambda: 1050.0)

    payload = {
        "questionId": "valid-anagram",
        "language": "python",
        "mode": "SUBMIT",
        "sourceCode": "print('hello')",
        "userId": "user-60s"
    }
    res = client.post("/api/v1/submissions", json=payload)
    assert res.status_code == 429
    assert "Too many attempts, please wait for one minute or try after one minute." in res.json()["detail"]
    assert res.headers.get("retry-after") == "60"

    # At t=1061, the oldest timestamp (1000.0) has expired (>60s) -> allowed
    monkeypatch.setattr(time, "time", lambda: 1061.0)
    res_recovered = client.post("/api/v1/submissions", json=payload)
    assert res_recovered.status_code == 202


def test_rate_limiting_configurable_via_settings(monkeypatch):
    from app.config import get_settings
    settings = get_settings()

    # Temporarily override settings: max 1 submission within 10s -> wait 8s
    monkeypatch.setattr(settings, "RATE_LIMIT_BURST_MAX_SUBMISSIONS", 1)
    monkeypatch.setattr(settings, "RATE_LIMIT_BURST_WAIT_SECONDS", 8)

    payload = {
        "questionId": "valid-anagram",
        "language": "python",
        "mode": "RUN",
        "sourceCode": "print('hello')",
        "userId": "config-test-user"
    }

    # 1st call -> allowed
    res1 = client.post("/api/v1/submissions", json=payload)
    assert res1.status_code == 202

    # 2nd call -> blocked because max submissions was set to 1
    res2 = client.post("/api/v1/submissions", json=payload)
    assert res2.status_code == 429
    assert "Too many attempts, please wait 8 seconds" in res2.json()["detail"]
    assert res2.headers.get("retry-after") == "8"


def test_list_submissions_no_cache_headers():
    res = client.get("/api/v1/submissions")
    assert res.status_code == 200
    assert "no-cache" in res.headers.get("cache-control", "")
    assert "no-store" in res.headers.get("cache-control", "")


def test_contest_submission_isolation():
    user_id = "isolation-student-1"
    q_id = "valid-anagram"

    # Create normal practice submission
    normal_res = client.post("/api/v1/submissions", json={
        "questionId": q_id,
        "language": "python",
        "mode": "SUBMIT",
        "sourceCode": "print('normal')",
        "userId": user_id
    })
    assert normal_res.status_code == 202
    normal_id = normal_res.json()["submissionId"]

    # Create contest submission
    contest_id = "contest-grand-01"
    contest_res = client.post("/api/v1/submissions", json={
        "questionId": q_id,
        "language": "python",
        "mode": "SUBMIT",
        "sourceCode": "print('contest')",
        "userId": user_id,
        "contestId": contest_id
    })
    assert contest_res.status_code == 202
    contest_sub_id = contest_res.json()["submissionId"]

    # Query without contestId (normal catalog practice view)
    practice_list = client.get(f"/api/v1/submissions?userId={user_id}&questionId={q_id}").json()
    practice_ids = [s["id"] for s in practice_list]
    assert normal_id in practice_ids
    assert contest_sub_id not in practice_ids, "Contest submissions must NOT appear in normal catalog practice history"

    # Query with contestId (contest view)
    contest_list = client.get(f"/api/v1/submissions?userId={user_id}&questionId={q_id}&contestId={contest_id}").json()
    contest_ids = [s["id"] for s in contest_list]
    assert contest_sub_id in contest_ids
    assert normal_id not in contest_ids, "Normal practice submissions must NOT appear in contest submission list"




