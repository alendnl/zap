import pytest
from fastapi.testclient import TestClient
import mongomock
from app.main import app
from app.db.mongodb import set_test_database
from app.admin.service import AdminService
from app.mcq.service import MCQService
from app.questions.service import QuestionService
from app.questions.models import QuestionCreate


@pytest.fixture(autouse=True)
def setup_mock_db():
    mock_client = mongomock.MongoClient()
    mock_db = mock_client["test_zap_platform"]
    set_test_database(mock_db)

    # Seed mock questions
    q_service = QuestionService(mock_db)
    for i in range(5):
        q_service.create_question(
            QuestionCreate(
                slug=f"problem-{i}",
                title=f"Algorithm Problem {i}",
                difficulty="EASY" if i % 2 == 0 else "MEDIUM",
                tags=["array", "algo"],
                statement=f"Statement for problem {i}",
                examples=[{"input": "1", "output": "1"}],
                constraints=["1 <= n <= 100"],
            )
        )

    # Seed mock MCQs
    mcq_service = MCQService(mock_db)
    mcq_service.seed_default_questions(force=True)

    # Seed admin user
    mock_db.admins.insert_one({"email": "superadmin@zap.dev"})

    yield
    set_test_database(None)


client = TestClient(app)


def test_list_contests_auto_seeds_sample_contest():
    res = client.get("/api/v1/contests?summary=true")
    assert res.status_code == 200
    contests = res.json()
    assert len(contests) >= 1

    sample = contests[0]
    assert sample["slug"] == "zap-grand-assessment-1"
    assert sample["hasMcq"] is True
    assert sample["hasCoding"] is True
    assert sample["mcqQuestionsCount"] == 25
    assert sample["codingQuestionsCount"] == 3


def test_get_single_contest():
    res = client.get("/api/v1/contests/zap-grand-assessment-1")
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "ZAP Grand Assessment #1: Core CS & Programming"
    assert data["durationMinutes"] == 90
    assert data["mcqConfig"]["enabled"] is True
    assert data["codingConfig"]["enabled"] is True


def test_start_contest_masks_mcq_answers():
    res = client.post("/api/v1/contests/zap-grand-assessment-1/start?student_id=student-123")
    assert res.status_code == 200
    data = res.json()
    assert "sessionId" in data
    assert "mcqQuestions" in data
    assert "codingQuestions" in data
    assert len(data["mcqQuestions"]) == 25
    assert len(data["codingQuestions"]) == 3

    # Security verification: isCorrect and explanation must not be in payload
    first_mcq = data["mcqQuestions"][0]
    assert "explanation" not in first_mcq
    for opt in first_mcq["options"]:
        assert "isCorrect" not in opt
        assert "explanation" not in opt


def test_create_and_delete_contest_with_admin():
    admin_email = "superadmin@zap.dev"

    # Non-admin attempt should be 403
    payload = {
        "title": "Placement Mock Test",
        "slug": "placement-mock-test",
        "description": "Custom created placement test for campus drive",
        "durationMinutes": 60,
        "hasMcq": True,
        "hasCoding": True,
        "mcqConfig": {
            "enabled": True,
            "mode": "RANDOM",
            "randomRules": [{"category": "DSA", "count": 5}],
            "totalQuestions": 5,
            "pointsPerQuestion": 1
        },
        "codingConfig": {
            "enabled": True,
            "mode": "RANDOM",
            "randomRules": [{"difficulty": "EASY", "count": 2}],
            "totalQuestions": 2,
            "pointsPerQuestion": 10
        },
        "status": "PUBLISHED",
        "totalPoints": 25
    }

    fail_res = client.post("/api/v1/contests", json=payload, headers={"X-Admin-Email": "student@college.edu"})
    assert fail_res.status_code == 403

    # Admin attempt should succeed
    succ_res = client.post("/api/v1/contests", json=payload, headers={"X-Admin-Email": admin_email})
    assert succ_res.status_code == 201
    created = succ_res.json()
    assert created["slug"] == "placement-mock-test"
    contest_id = created["id"]

    # Delete contest
    del_res = client.delete(f"/api/v1/contests/{contest_id}", headers={"X-Admin-Email": admin_email})
    assert del_res.status_code == 204


def test_submit_contest_calculates_score():
    # Start session first to get question IDs
    start_res = client.post("/api/v1/contests/zap-grand-assessment-1/start?student_id=student-123")
    assert start_res.status_code == 200
    mcqs = start_res.json()["mcqQuestions"]
    codings = start_res.json()["codingQuestions"]

    # Answer first MCQ with its first option
    mcq_answers = {}
    for q in mcqs[:5]:
        mcq_answers[q["id"]] = q["options"][0]["id"]

    submit_payload = {
        "studentId": "student-123",
        "studentEmail": "student123@college.edu",
        "studentName": "Alex Rivera",
        "mcqAnswers": mcq_answers,
        "codingSubmissions": {codings[0]["id"]: "sub-abc-123"},
        "timeSpentSeconds": 1800
    }

    sub_res = client.post("/api/v1/contests/zap-grand-assessment-1/submit", json=submit_payload)
    assert sub_res.status_code == 200
    result = sub_res.json()

    assert "submissionId" in result
    assert result["studentId"] == "student-123"
    assert result["codingProblemsAttempted"] == 1
    assert result["codingTotalCount"] == 3
    assert len(result["codingBreakdown"]) == 3
    assert result["mcqTotalCount"] == 25
    assert len(result["mcqBreakdown"]) == 25
    # Verification that answers are revealed post-submission
    assert "correctOptionId" in result["mcqBreakdown"][0]
    assert "isCorrect" in result["mcqBreakdown"][0]


def test_contest_percentage_scoring_unattempted_and_partial():
    student_id = "student-pct-test"
    student_email = "pct@college.edu"

    # Start contest session
    start_res = client.post(
        f"/api/v1/contests/zap-grand-assessment-1/start?student_id={student_id}&student_email={student_email}"
    )
    assert start_res.status_code == 200
    mcqs = start_res.json()["mcqQuestions"]
    codings = start_res.json()["codingQuestions"]
    assert len(mcqs) == 25
    assert len(codings) == 3

    # We will answer 13 MCQs correctly, leave 12 unattempted
    from app.db.mongodb import get_database
    db = get_database()
    mcq_coll = db["mcq_questions"]
    mcq_answers = {}
    for q in mcqs[:13]:
        doc = mcq_coll.find_one({"_id": q["id"]}) or mcq_coll.find_one({"id": q["id"]})
        if doc and doc.get("options"):
            correct_opt = next((opt["id"] for opt in doc["options"] if opt.get("isCorrect")), None)
            if correct_opt:
                mcq_answers[q["id"]] = correct_opt

    # Coding questions:
    # Q1: 5/5 passed (100%)
    # Q2: 2/4 passed (50%)
    # Q3: not attempted (0%)
    coding_state = {
        codings[0]["id"]: {
            "code": {"python": "def solution(): return 1"},
            "lastLanguage": "python",
            "status": "ACCEPTED",
            "bestVerdict": "ACCEPTED",
            "passedTestCases": 5,
            "totalTestCases": 5,
            "passPercentage": 100.0,
        },
        codings[1]["id"]: {
            "code": {"python": "def solution(): return 0"},
            "lastLanguage": "python",
            "status": "SUBMITTED",
            "bestVerdict": "WRONG_ANSWER",
            "passedTestCases": 2,
            "totalTestCases": 4,
            "passPercentage": 50.0,
        },
        codings[2]["id"]: {
            "code": {},
            "lastLanguage": "python",
            "status": "UNATTEMPTED",
            "bestVerdict": None,
            "passedTestCases": 0,
            "totalTestCases": 0,
            "passPercentage": 0.0,
        }
    }

    submit_payload = {
        "studentId": student_id,
        "studentEmail": student_email,
        "mcqAnswers": mcq_answers,
        "codingSubmissions": {},
        "codingState": coding_state,
        "timeSpentSeconds": 1500,
    }

    sub_res = client.post("/api/v1/contests/zap-grand-assessment-1/submit", json=submit_payload)
    assert sub_res.status_code == 200
    res = sub_res.json()

    # 1. MCQ evaluation: 13 / 25 = 52.0%
    assert res["mcqTotalCount"] == 25
    assert res["mcqCorrectCount"] == 13
    assert res["mcqPercentage"] == 52.0
    assert res["mcqScore"] == 52.0
    assert len(res["mcqBreakdown"]) == 25

    # Check unattempted MCQs:
    unattempted_mcqs = [item for item in res["mcqBreakdown"] if item["selectedOptionId"] is None]
    assert len(unattempted_mcqs) == 12
    for item in unattempted_mcqs:
        assert item["isCorrect"] is False
        assert item["pointsAwarded"] == 0

    # 2. Coding evaluation:
    assert res["codingTotalCount"] == 3
    assert res["codingProblemsAttempted"] == 2
    assert len(res["codingBreakdown"]) == 3

    # Q1: 100%
    q1_breakdown = next(item for item in res["codingBreakdown"] if item["questionId"] == codings[0]["id"])
    assert q1_breakdown["score"] == 100.0
    assert q1_breakdown["status"] == "ACCEPTED"
    assert q1_breakdown["passedTestCases"] == 5
    assert q1_breakdown["totalTestCases"] == 5

    # Q2: 50%
    q2_breakdown = next(item for item in res["codingBreakdown"] if item["questionId"] == codings[1]["id"])
    assert q2_breakdown["score"] == 50.0
    assert q2_breakdown["status"] == "PARTIAL"
    assert q2_breakdown["passedTestCases"] == 2
    assert q2_breakdown["totalTestCases"] == 4

    # Q3: 0%
    q3_breakdown = next(item for item in res["codingBreakdown"] if item["questionId"] == codings[2]["id"])
    assert q3_breakdown["score"] == 0.0
    assert q3_breakdown["status"] == "UNATTEMPTED"
    assert q3_breakdown["passedTestCases"] == 0


def test_contest_session_sync_and_resume():
    student_id = "student-resume-test"
    student_email = "resume@college.edu"

    # 1. Start contest session
    start_res = client.post(
        f"/api/v1/contests/zap-grand-assessment-1/start?student_id={student_id}&student_email={student_email}"
    )
    assert start_res.status_code == 200
    data = start_res.json()
    assert data["alreadySubmitted"] is False
    q1_id = data["mcqQuestions"][0]["id"]
    code_q1_id = data["codingQuestions"][0]["id"]

    # 2. Sync live progress: answers, coding state, and proctoring
    sync_payload = {
        "studentId": student_id,
        "studentEmail": student_email,
        "mcqAnswers": {q1_id: "opt-1"},
        "reviewedQuestionIds": [q1_id],
        "codingState": {
            code_q1_id: {
                "code": {"python": "def solution(): pass"},
                "lastLanguage": "python",
                "status": "ATTEMPTED",
                "bestVerdict": "WRONG_ANSWER",
                "lastSubmissionId": "sub-test-123",
            }
        },
        "proctoring": {
            "tabSwitchCount": 2,
            "copyPasteAttempts": 1,
            "fullscreenExitCount": 1,
            "violationsLog": [
                {"type": "TAB_SWITCH", "timestamp": "2026-11-16T00:00:00Z", "details": "Tab blurred"}
            ]
        },
        "timeSpentSeconds": 120,
    }

    sync_res = client.post("/api/v1/contests/zap-grand-assessment-1/sync", json=sync_payload)
    assert sync_res.status_code == 200
    assert sync_res.json()["ok"] is True

    # 3. Simulate page reload / resume session: start again
    resume_res = client.post(
        f"/api/v1/contests/zap-grand-assessment-1/start?student_id={student_id}&student_email={student_email}"
    )
    assert resume_res.status_code == 200
    resume_data = resume_res.json()
    assert resume_data["alreadySubmitted"] is False
    assert resume_data["mcqAnswers"].get(q1_id) == "opt-1"
    assert q1_id in resume_data["reviewedQuestionIds"]
    assert resume_data["codingState"][code_q1_id]["status"] == "ATTEMPTED"
    assert resume_data["proctoring"]["tabSwitchCount"] == 2
    assert resume_data["proctoring"]["copyPasteAttempts"] == 1
    assert resume_data["proctoring"]["fullscreenExitCount"] == 1

    # 4. Final submit
    submit_payload = {
        "studentId": student_id,
        "studentEmail": student_email,
        "mcqAnswers": {q1_id: "opt-1"},
        "codingSubmissions": {code_q1_id: "sub-test-123"},
        "timeSpentSeconds": 240,
    }
    submit_res = client.post("/api/v1/contests/zap-grand-assessment-1/submit", json=submit_payload)
    assert submit_res.status_code == 200

    # 5. Single attempt check: calling start again must return alreadySubmitted: True
    post_submit_start = client.post(
        f"/api/v1/contests/zap-grand-assessment-1/start?student_id={student_id}&student_email={student_email}"
    )
    assert post_submit_start.status_code == 200
    assert post_submit_start.json()["alreadySubmitted"] is True
    assert post_submit_start.json()["submission"] is not None


def test_get_contest_analytics():
    admin_email = "superadmin@zap.dev"

    # Non-admin access should be 403
    unauth_res = client.get("/api/v1/contests/zap-grand-assessment-1/analytics?email=student@college.edu")
    assert unauth_res.status_code == 403

    # Admin access should succeed and return analytics
    res = client.get(
        "/api/v1/contests/zap-grand-assessment-1/analytics",
        headers={"X-Admin-Email": admin_email}
    )
    assert res.status_code == 200
    data = res.json()

    assert "contest" in data
    assert "totalCandidates" in data
    assert "completedCount" in data
    assert "completionRate" in data
    assert "averageScore" in data
    assert "scoreDistribution" in data
    assert "mcqStats" in data
    assert "codingStats" in data
    assert "proctoringStats" in data
    assert "submissions" in data
    assert len(data["scoreDistribution"]) == 5
    assert data["proctoringStats"]["cleanRate"] >= 0.0

    # Verify owner/superadmin email alendnl@gmail.com succeeds
    owner_res = client.get(
        "/api/v1/contests/zap-grand-assessment-1/analytics",
        headers={"X-Admin-Email": "alendnl@gmail.com"}
    )
    assert owner_res.status_code == 200


def test_create_contest_with_short_description_and_reset_candidate():
    admin_email = "superadmin@zap.dev"

    # 1. Create a contest with short description like "random"
    create_payload = {
        "title": "Short Description Contest",
        "slug": "test-2",
        "description": "random",  # previously failed min_length=10
        "durationMinutes": 90,
        "hasMcq": True,
        "hasCoding": False,
        "mcqConfig": {
            "enabled": True,
            "mode": "RANDOM",
            "randomRules": [{"category": "DSA", "difficulty": "ALL", "count": 2}],
            "totalQuestions": 2,
            "pointsPerQuestion": 1,
        },
        "status": "PUBLISHED",
        "totalPoints": 2,
    }

    create_res = client.post(
        "/api/v1/contests",
        json=create_payload,
        headers={"X-Admin-Email": admin_email}
    )
    assert create_res.status_code == 201
    contest_data = create_res.json()
    assert contest_data["slug"] == "test-2"
    assert contest_data["description"] == "random"

    # 2. Student starts and submits this contest
    student_id = "candidate-xyz"
    student_email = "candidate@college.edu"

    start_res = client.post(
        f"/api/v1/contests/test-2/start?student_id={student_id}&student_email={student_email}&student_name=Alice"
    )
    assert start_res.status_code == 200
    assert start_res.json()["alreadySubmitted"] is False

    submit_payload = {
        "studentId": student_id,
        "studentEmail": student_email,
        "mcqAnswers": {},
        "timeSpentSeconds": 50,
    }
    submit_res = client.post("/api/v1/contests/test-2/submit", json=submit_payload)
    assert submit_res.status_code == 200

    # Verify student is now locked as alreadySubmitted: True
    post_res = client.post(
        f"/api/v1/contests/test-2/start?student_id={student_id}&student_email={student_email}"
    )
    assert post_res.status_code == 200
    assert post_res.json()["alreadySubmitted"] is True

    # 3. Admin resets the candidate's contest data
    # Non-admin reset should fail
    unauth_reset = client.delete(
        f"/api/v1/contests/test-2/submissions/{student_id}"
    )
    assert unauth_reset.status_code == 401

    admin_reset = client.delete(
        f"/api/v1/contests/test-2/submissions/{student_id}",
        headers={"X-Admin-Email": admin_email}
    )
    assert admin_reset.status_code == 200
    assert admin_reset.json()["ok"] is True

    # 4. Student can now re-enter the contest freshly (alreadySubmitted is False again!)
    re_start_res = client.post(
        f"/api/v1/contests/test-2/start?student_id={student_id}&student_email={student_email}"
    )
    assert re_start_res.status_code == 200
    assert re_start_res.json()["alreadySubmitted"] is False


def test_get_single_candidate_submission_and_pagination():
    admin_email = "superadmin@zap.dev"

    # Start and submit for a candidate in zap-grand-assessment-1
    student_id = "candidate-perf-01"
    student_email = "candidate01@college.edu"

    client.post(
        f"/api/v1/contests/zap-grand-assessment-1/start?student_id={student_id}&student_email={student_email}&student_name=Performance+Student"
    )

    submit_payload = {
        "studentId": student_id,
        "studentEmail": student_email,
        "studentName": "Performance Student",
        "mcqAnswers": {},
        "codingSubmissions": {},
        "timeSpentSeconds": 120,
    }
    client.post("/api/v1/contests/zap-grand-assessment-1/submit", json=submit_payload)

    # 1. Fetch single candidate submission drilldown
    res_single = client.get(
        f"/api/v1/contests/zap-grand-assessment-1/submissions/{student_id}",
        headers={"X-Admin-Email": admin_email}
    )
    assert res_single.status_code == 200
    sub_data = res_single.json()
    assert sub_data["studentId"] == student_id
    assert sub_data["studentEmail"] == student_email
    assert "status" in sub_data

    # 2. Test paginated analytics
    res_paged = client.get(
        "/api/v1/contests/zap-grand-assessment-1/analytics?page=1&limit=10",
        headers={"X-Admin-Email": admin_email}
    )
    assert res_paged.status_code == 200
    paged_data = res_paged.json()
    assert paged_data["page"] == 1
    assert paged_data["limit"] == 10
    assert paged_data["totalPages"] >= 1
    assert isinstance(paged_data["submissions"], list)
    assert len(paged_data["submissions"]) <= 10

    # 3. Test analytics with include_submissions=false
    res_no_subs = client.get(
        "/api/v1/contests/zap-grand-assessment-1/analytics?include_submissions=false",
        headers={"X-Admin-Email": admin_email}
    )
    assert res_no_subs.status_code == 200
    no_subs_data = res_no_subs.json()
    assert no_subs_data["submissions"] == []
    assert "scoreDistribution" in no_subs_data
    assert "totalCandidates" in no_subs_data

    # 4. Test dedicated contest submissions pagination endpoint
    unauth_subs = client.get(
        "/api/v1/contests/zap-grand-assessment-1/submissions?page=1&limit=10"
    )
    assert unauth_subs.status_code == 401

    res_subs = client.get(
        "/api/v1/contests/zap-grand-assessment-1/submissions?page=1&limit=10&sort_by=rank_asc",
        headers={"X-Admin-Email": admin_email}
    )
    assert res_subs.status_code == 200
    subs_resp = res_subs.json()
    assert "submissions" in subs_resp
    assert "totalSubmissions" in subs_resp
    assert subs_resp["page"] == 1
    assert subs_resp["limit"] == 10
    assert subs_resp["totalPages"] >= 1
    assert isinstance(subs_resp["submissions"], list)
    assert len(subs_resp["submissions"]) <= 10
    if len(subs_resp["submissions"]) > 0:
        first = subs_resp["submissions"][0]
        assert "studentId" in first
        assert "studentEmail" in first
        assert "totalScore" in first
        assert "proctoring" in first



