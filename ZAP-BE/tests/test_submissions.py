import pytest
from fastapi.testclient import TestClient
import mongomock
from app.main import app
from app.db.mongodb import clear_database_cache, set_test_database, db_manager
from app.submissions.models import SubmissionStatus, SubmissionVerdict
from app.submissions.queue import MemorySubmissionQueue, _queue_instances

@pytest.fixture(autouse=True)
def setup_mock_db():
    mock_client = mongomock.MongoClient()
    mock_db = mock_client["test_zap_platform"]
    set_test_database(mock_db)
    yield
    set_test_database(None)
    # Clear any per-environment caches so tests do not leak state.
    clear_database_cache()
    _queue_instances.clear()

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
