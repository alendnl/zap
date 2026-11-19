import pytest
from fastapi.testclient import TestClient
import mongomock
from app.questions.router import router as questions_router
from app.submissions.router import router as submissions_router
from app.db.mongodb import clear_database_cache, set_test_database
from app.submissions.models import SubmissionStatus, SubmissionVerdict
from executor.tasks.handler import create_app

@pytest.fixture(autouse=True)
def setup_mock_db():
    mock_client = mongomock.MongoClient()
    mock_db = mock_client["test_zap_platform"]
    set_test_database(mock_db)
    yield
    set_test_database(None)
    from app.submissions.queue import _queue_instances
    clear_database_cache()
    _queue_instances.clear()

app = create_app()
app.include_router(questions_router)
app.include_router(submissions_router)
client = TestClient(app)


def _create_question(environment: str = "production"):
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
    headers = {"X-ZAP-ENV": environment} if environment != "production" else {}
    res = client.post("/api/v1/questions", json=payload, headers=headers)
    assert res.status_code == 201
    return res.json()


def _create_submission(question_id: str, code: str, environment: str = "production"):
    payload = {
        "questionId": question_id,
        "language": "python",
        "mode": "SUBMIT",
        "sourceCode": code,
        "userId": "student-test-1"
    }
    headers = {"X-ZAP-ENV": environment} if environment != "production" else {}
    res = client.post("/api/v1/submissions", json=payload, headers=headers)
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
    assert len(sub["testResults"]) == 1
    assert sub["testResults"][0]["passed"] is True
    assert sub["testResults"][0]["input"] == "2 3"
    assert sub["testResults"][0]["expectedOutput"] == "5"
    assert sub["testResults"][0]["actualOutput"] == "5"


def test_execute_task_accepts_run_mode():
    question = _create_question()
    payload = {
        "questionId": question["id"],
        "language": "python",
        "mode": "RUN",
        "sourceCode": "import sys\nprint(sum(map(int, sys.stdin.read().split())))",
        "userId": "student-test-run"
    }
    res = client.post("/api/v1/submissions", json=payload)
    assert res.status_code == 202
    sub_id = res.json()["submissionId"]

    task_res = client.post("/internal/tasks/execute", json={"submissionId": sub_id})
    assert task_res.status_code == 200
    task_data = task_res.json()
    assert task_data["status"] == "completed"
    assert task_data["verdict"] == "ACCEPTED"

    get_res = client.get(f"/api/v1/submissions/{sub_id}")
    assert get_res.status_code == 200
    sub = get_res.json()
    assert sub["status"] == SubmissionStatus.COMPLETED.value
    assert sub["mode"] == "RUN"
    assert sub["verdict"] == SubmissionVerdict.ACCEPTED.value


def test_execute_task_missing_submission_id():
    res = client.post("/internal/tasks/execute", json={})
    assert res.status_code == 422


def test_execute_task_unknown_submission_acknowledges():
    res = client.post("/internal/tasks/execute", json={"submissionId": "sub-does-not-exist"})
    assert res.status_code == 200
    assert res.json()["status"] == "acknowledged"


def test_execute_task_marks_missing_question_failed_without_retry():
    sub_id = _create_submission("q-does-not-exist", "print(5)")

    response = client.post("/internal/tasks/execute", json={"submissionId": sub_id})

    assert response.status_code == 200
    assert response.json()["reason"] == "permanent_execution_error"
    submission = client.get(f"/api/v1/submissions/{sub_id}").json()
    assert submission["status"] == SubmissionStatus.FAILED.value
    assert submission["verdict"] == SubmissionVerdict.SYSTEM_ERROR.value
    assert "not found" in submission["errorMessage"]


def test_execute_task_marks_unsupported_language_failed_without_retry():
    question = _create_question()
    response = client.post("/api/v1/submissions", json={
        "questionId": question["id"],
        "language": "unsupported",
        "mode": "RUN",
        "sourceCode": "print(5)",
    })
    sub_id = response.json()["submissionId"]

    task_response = client.post("/internal/tasks/execute", json={"submissionId": sub_id})

    assert task_response.status_code == 200
    assert task_response.json()["reason"] == "permanent_execution_error"
    submission = client.get(f"/api/v1/submissions/{sub_id}").json()
    assert submission["status"] == SubmissionStatus.FAILED.value
    assert "Unsupported language" in submission["errorMessage"]


def test_execute_task_marks_question_without_enabled_tests_failed_without_retry():
    question = _create_question()
    from app.db.mongodb import db_manager
    db_manager.dbs["production"].questions.update_one(
        {"_id": question["id"]},
        {"$set": {"testCases.0.enabled": False}},
    )
    sub_id = _create_submission(question["id"], "print(5)")

    response = client.post("/internal/tasks/execute", json={"submissionId": sub_id})

    assert response.status_code == 200
    assert response.json()["reason"] == "permanent_execution_error"
    submission = client.get(f"/api/v1/submissions/{sub_id}").json()
    assert submission["status"] == SubmissionStatus.FAILED.value
    assert "no enabled test cases" in submission["errorMessage"]


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
    service = SubmissionService(db_manager.dbs["production"])
    assert service.claim_submission(sub_id) is not None

    response = client.post("/internal/tasks/execute", json={"submissionId": sub_id})
    assert response.status_code == 503


def test_execute_task_uses_environment_database():
    from app.db.mongodb import db_manager, set_test_database

    qa_client = mongomock.MongoClient()
    qa_db = qa_client["qa_test_db"]
    set_test_database(qa_db, env="qa")
    qa_question = _create_question("qa")
    sub_id = _create_submission(
        qa_question["id"],
        "import sys\nprint(sum(map(int, sys.stdin.read().split())))",
        "qa",
    )
    assert db_manager.dbs["qa"].submissions.find_one({"_id": sub_id})
    assert db_manager.dbs["production"].submissions.find_one({"_id": sub_id}) is None

    response = client.post("/internal/tasks/execute", json={"submissionId": sub_id, "environment": "qa"})
    assert response.status_code == 200
    assert response.json()["verdict"] == "ACCEPTED"
    assert db_manager.dbs["qa"].submissions.find_one({"_id": sub_id})["status"] == SubmissionStatus.COMPLETED.value


def test_hidden_test_cases_filtering_and_submission():
    # Create question with 1 PUBLIC test case and 1 HIDDEN test case
    payload = {
        "slug": "sum-visible-and-hidden",
        "title": "Sum Visible and Hidden",
        "difficulty": "EASY",
        "tags": ["math"],
        "statement": "Add two numbers.",
        "testCases": [
            {
                "visibility": "PUBLIC",
                "input": "2 3",
                "expectedOutput": "5",
                "enabled": True
            },
            {
                "visibility": "HIDDEN",
                "input": "10 20",
                "expectedOutput": "30",
                "enabled": True
            }
        ],
        "executionLimits": {"timeMs": 2000, "memoryMb": 256, "outputKb": 1024},
        "supportedLanguages": ["python"]
    }
    create_res = client.post("/api/v1/questions", json=payload)
    assert create_res.status_code == 201
    q_id = create_res.json()["id"]

    # When client fetches question, hidden test case is NOT returned
    get_q = client.get(f"/api/v1/questions/{q_id}")
    assert len(get_q.json()["testCases"]) == 1
    assert get_q.json()["testCases"][0]["visibility"] == "PUBLIC"

    # 1. RUN mode: should only run public test case
    run_res = client.post("/api/v1/submissions", json={
        "questionId": q_id,
        "language": "python",
        "mode": "RUN",
        "sourceCode": "import sys\nprint(sum(map(int, sys.stdin.read().split())))",
        "userId": "student-run-filter"
    })
    assert run_res.status_code == 202
    run_sub_id = run_res.json()["submissionId"]

    exec_run = client.post("/internal/tasks/execute", json={"submissionId": run_sub_id})
    assert exec_run.status_code == 200
    sub_run = client.get(f"/api/v1/submissions/{run_sub_id}").json()
    assert sub_run["tests"]["total"] == 1
    assert sub_run["tests"]["passed"] == 1
    assert len(sub_run["testResults"]) == 1

    # 2. SUBMIT mode: should evaluate both public and hidden test cases, but get_submission returns only public in testResults
    submit_res = client.post("/api/v1/submissions", json={
        "questionId": q_id,
        "language": "python",
        "mode": "SUBMIT",
        "sourceCode": "import sys\nprint(sum(map(int, sys.stdin.read().split())))",
        "userId": "student-submit-filter"
    })
    assert submit_res.status_code == 202
    submit_sub_id = submit_res.json()["submissionId"]

    exec_submit = client.post("/internal/tasks/execute", json={"submissionId": submit_sub_id})
    assert exec_submit.status_code == 200
    sub_submit = client.get(f"/api/v1/submissions/{submit_sub_id}").json()
    # Judge evaluated both test cases
    assert sub_submit["tests"]["total"] == 2
    assert sub_submit["tests"]["passed"] == 2
    assert sub_submit["verdict"] == SubmissionVerdict.ACCEPTED.value
    # But only the PUBLIC test case result is returned in testResults!
    assert len(sub_submit["testResults"]) == 1
    assert sub_submit["testResults"][0]["visibility"] == "PUBLIC"
    assert sub_submit["testResults"][0]["input"] == "2 3"

    # 3. SUBMIT mode where hidden test case fails
    # Hardcoded answer that passes 2 3 -> 5, but fails 10 20 -> outputs 5 instead of 30
    partial_res = client.post("/api/v1/submissions", json={
        "questionId": q_id,
        "language": "python",
        "mode": "SUBMIT",
        "sourceCode": "print(5)",
        "userId": "student-partial-filter"
    })
    assert partial_res.status_code == 202
    partial_sub_id = partial_res.json()["submissionId"]

    exec_partial = client.post("/internal/tasks/execute", json={"submissionId": partial_sub_id})
    assert exec_partial.status_code == 200
    sub_partial = client.get(f"/api/v1/submissions/{partial_sub_id}").json()
    assert sub_partial["tests"]["total"] == 2
    assert sub_partial["tests"]["passed"] == 1
    assert sub_partial["tests"]["failed"] == 1
    assert sub_partial["verdict"] == SubmissionVerdict.WRONG_ANSWER.value
    # testResults only contains the visible test case!
    assert len(sub_partial["testResults"]) == 1
    assert sub_partial["testResults"][0]["passed"] is True