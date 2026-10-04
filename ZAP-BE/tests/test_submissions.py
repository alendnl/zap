import pytest
from fastapi.testclient import TestClient
import mongomock
from app.main import app
from app.db.mongodb import set_test_database, db_manager
from app.submissions.models import SubmissionStatus, SubmissionVerdict
from app.submissions.queue import MemorySubmissionQueue

@pytest.fixture(autouse=True)
def setup_mock_db():
    mock_client = mongomock.MongoClient()
    mock_db = mock_client["test_zap_platform"]
    set_test_database(mock_db)
    yield
    set_test_database(None)

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
    from app.submissions.queue import get_queue
    queue = get_queue()
    assert isinstance(queue, MemorySubmissionQueue)

    payload = {
        "questionId": "two-sum",
        "language": "python",
        "mode": "RUN",
        "sourceCode": "print(1)",
    }
    res = client.post("/api/v1/submissions", json=payload)
    assert res.status_code == 202
    assert queue.size() > 0

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
    service = SubmissionService(db_manager.db)

    claimed = service.claim_submission(submission_id)
    assert claimed.status == SubmissionStatus.RUNNING
    assert service.claim_submission(submission_id) is None

    service.requeue_submission(submission_id, "temporary failure")
    retried_claim = service.claim_submission(submission_id)
    assert retried_claim.status == SubmissionStatus.RUNNING
