import pytest
from fastapi.testclient import TestClient
import mongomock
from app.questions.router import router as questions_router
from app.submissions.router import router as submissions_router
from app.db.mongodb import set_test_database
from app.submissions.models import SubmissionStatus, SubmissionVerdict
from executor.tasks.handler import create_app

@pytest.fixture(autouse=True)
def setup_mock_db():
    mock_client = mongomock.MongoClient()
    mock_db = mock_client["test_zap_platform"]
    set_test_database(mock_db)
    yield
    set_test_database(None)

app = create_app()
app.include_router(questions_router)
app.include_router(submissions_router)
client = TestClient(app)


def _create_question():
    payload = {
        "slug": "sum-two",
        "title": "Sum Two",
        "difficulty": "EASY",
        "tags": ["math"],
        "statement": "Add two numbers.",
        "testCases": [
            {
                "visibility": "PUBLIC",
                "input": "2 3",
                "expectedOutput": "5",
                "enabled": True
            }
        ],
        "executionLimits": {"timeMs": 2000, "memoryMb": 256, "outputKb": 1024},
        "supportedLanguages": ["python", "java", "cpp", "node"]
    }
    res = client.post("/api/v1/questions", json=payload)
    assert res.status_code == 201
    return res.json()


def _create_submission(question_id: str, code: str):
    payload = {
        "questionId": question_id,
        "language": "python",
        "mode": "SUBMIT",
        "sourceCode": code,
        "userId": "student-test-1"
    }
    res = client.post("/api/v1/submissions", json=payload)
    assert res.status_code == 202
    return res.json()["submissionId"]


def test_execute_task_accepts_submission():
    question = _create_question()
    sub_id = _create_submission(question["id"], "import sys\nprint(sum(map(int, sys.stdin.read().split())))")

    res = client.post("/internal/tasks/execute", json={"submissionId": sub_id})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "completed"
    assert data["verdict"] == "ACCEPTED"

    # Verify persisted result
    get_res = client.get(f"/api/v1/submissions/{sub_id}")
    assert get_res.status_code == 200
    sub = get_res.json()
    assert sub["status"] == SubmissionStatus.COMPLETED.value
    assert sub["verdict"] == SubmissionVerdict.ACCEPTED.value
    assert sub["tests"]["passed"] == 1


def test_execute_task_missing_submission_id():
    res = client.post("/internal/tasks/execute", json={})
    assert res.status_code == 422


def test_execute_task_unknown_submission_acknowledges():
    res = client.post("/internal/tasks/execute", json={"submissionId": "sub-does-not-exist"})
    assert res.status_code == 200
    assert res.json()["status"] == "acknowledged"


def test_execute_task_idempotent_on_terminal():
    question = _create_question()
    sub_id = _create_submission(question["id"], "print(5)")

    # First execution
    res1 = client.post("/internal/tasks/execute", json={"submissionId": sub_id})
    assert res1.status_code == 200

    # Second execution should acknowledge without re-running
    res2 = client.post("/internal/tasks/execute", json={"submissionId": sub_id})
    assert res2.status_code == 200
    assert res2.json()["status"] == "acknowledged"
    assert res2.json()["reason"] == "already_terminal"


def test_execute_task_acknowledges_active_duplicate():
    from app.submissions.service import SubmissionService
    from app.db.mongodb import db_manager

    question = _create_question()
    sub_id = _create_submission(question["id"], "print(5)")
    service = SubmissionService(db_manager.db)
    assert service.claim_submission(sub_id) is not None

    response = client.post("/internal/tasks/execute", json={"submissionId": sub_id})
    assert response.status_code == 503