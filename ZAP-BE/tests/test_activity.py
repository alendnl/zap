import pytest
import uuid
from fastapi.testclient import TestClient
import mongomock

from app.main import app
from app.db.mongodb import clear_database_cache, set_test_database, ensure_indexes
from app.activity.service import ActivityService
from app.activity.models import UserActivity, UserActivitySummary
from app.submissions.models import (
    Submission,
    SubmissionMode,
    SubmissionStatus,
    SubmissionVerdict,
    SubmissionCreateRequest,
)
from app.submissions.service import SubmissionService
from app.db.migrate_data import migrate_environment


@pytest.fixture(autouse=True)
def setup_mock_db():
    mock_client = mongomock.MongoClient()
    mock_db = mock_client["test_zap_platform"]
    ensure_indexes(mock_db)
    set_test_database(mock_db)
    yield mock_db
    set_test_database(None)
    clear_database_cache()


client = TestClient(app)


def test_activity_lifecycle_record_and_summary(setup_mock_db):
    mock_db = setup_mock_db
    user_id = str(uuid.uuid4())
    sub_service = SubmissionService(mock_db)
    act_service = ActivityService(mock_db)

    # 1. Initial activity for new user is empty
    summary = act_service.get_summary(user_id)
    assert summary.totalSolved == 0
    assert summary.totalAttempted == 0
    assert summary.solvedQuestionIds == []

    # 2. User submits a solution that gets WRONG_ANSWER
    sub1 = sub_service.create_submission(
        SubmissionCreateRequest(
            questionId="two-sum",
            language="python",
            mode=SubmissionMode.SUBMIT,
            sourceCode="return []",
            userId=user_id,
        )
    )
    sub_service.update_submission_status(
        submission_id=sub1.id,
        status=SubmissionStatus.COMPLETED,
        verdict=SubmissionVerdict.WRONG_ANSWER,
        execution_time_ms=15,
    )

    activity = act_service.get_activity(user_id)
    assert activity.totalSolved == 0
    assert activity.totalAttempted == 1
    assert "two-sum" in activity.attemptedQuestionIds
    assert "two-sum" not in activity.solvedQuestionIds
    assert activity.problems["two-sum"].status == "ATTEMPTED"
    assert activity.problems["two-sum"].bestVerdict == "WRONG_ANSWER"
    assert activity.problems["two-sum"].attemptsCount == 1

    # 3. User submits second attempt that gets ACCEPTED
    sub2 = sub_service.create_submission(
        SubmissionCreateRequest(
            questionId="two-sum",
            language="python",
            mode=SubmissionMode.SUBMIT,
            sourceCode="return [0, 1]",
            userId=user_id,
        )
    )
    sub_service.update_submission_status(
        submission_id=sub2.id,
        status=SubmissionStatus.COMPLETED,
        verdict=SubmissionVerdict.ACCEPTED,
        execution_time_ms=12,
    )

    activity2 = act_service.get_activity(user_id)
    assert activity2.totalSolved == 1
    assert activity2.totalAttempted == 1
    assert "two-sum" in activity2.solvedQuestionIds
    assert activity2.problems["two-sum"].status == "SOLVED"
    assert activity2.problems["two-sum"].bestVerdict == "ACCEPTED"
    assert activity2.problems["two-sum"].attemptsCount == 2
    assert activity2.problems["two-sum"].solvedAt is not None

    # 4. User attempts another question (valid-anagram) with RUN mode
    sub3 = sub_service.create_submission(
        SubmissionCreateRequest(
            questionId="valid-anagram",
            language="python",
            mode=SubmissionMode.RUN,
            sourceCode="return True",
            userId=user_id,
        )
    )
    sub_service.update_submission_status(
        submission_id=sub3.id,
        status=SubmissionStatus.COMPLETED,
        verdict=SubmissionVerdict.ACCEPTED,
        execution_time_ms=8,
    )

    # 5. Check REST API endpoints
    # Summary endpoint
    res_summary = client.get(f"/api/v1/users/{user_id}/activity/summary")
    assert res_summary.status_code == 200
    sum_data = res_summary.json()
    assert sum_data["userId"] == user_id
    assert sum_data["totalSolved"] == 2
    assert sum_data["totalAttempted"] == 2
    assert "two-sum" in sum_data["solvedQuestionIds"]
    assert "valid-anagram" in sum_data["solvedQuestionIds"]

    # Full activity endpoint
    res_full = client.get(f"/api/v1/users/{user_id}/activity")
    assert res_full.status_code == 200
    full_data = res_full.json()
    assert full_data["userId"] == user_id
    assert len(full_data["problems"]) == 2
    assert full_data["problems"]["two-sum"]["status"] == "SOLVED"
    assert full_data["problems"]["valid-anagram"]["runsCount"] == 1
    assert len(full_data["recentSubmissions"]) == 3


def test_submissions_index_creation(setup_mock_db):
    mock_db = setup_mock_db
    ensure_indexes(mock_db)

    # Verify submissions collection index information
    sub_indexes = mock_db.submissions.index_information()
    assert any("userId" in str(idx) for idx in sub_indexes.values())
    assert any("questionId" in str(idx) for idx in sub_indexes.values())

    # Verify user_activities collection index information
    act_indexes = mock_db.user_activities.index_information()
    assert any("userId" in str(idx) for idx in act_indexes.values())


def test_migration_script(setup_mock_db):
    mock_db = setup_mock_db
    user_id = str(uuid.uuid4())
    student_id = "ROLL-9988"
    user_email = "student9988@college.edu"

    # Insert a user
    mock_db.users.insert_one({
        "_id": user_id,
        "id": user_id,
        "name": "Jane Doe",
        "studentId": student_id,
        "collegeName": "Tech College",
        "email": user_email,
        "createdAt": "2026-10-25T00:00:00Z"
    })

    # Insert submissions where userId was the studentId
    mock_db.submissions.insert_one({
        "_id": "old-sub-1",
        "id": "old-sub-1",
        "userId": student_id,  # Old format (studentId instead of user UUID)
        "questionId": "two-sum",
        "language": "python",
        "mode": "SUBMIT",
        "sourceCode": "...",
        "status": "COMPLETED",
        "verdict": "ACCEPTED",
        "createdAt": "2026-10-25T01:00:00Z"
    })

    # Run migration in live mode
    stats = migrate_environment("production", dry_run=False)
    assert stats["submissions_scanned"] >= 1
    assert stats["submissions_updated"] >= 1

    # Check updated submission
    migrated_sub = mock_db.submissions.find_one({"_id": "old-sub-1"})
    assert migrated_sub["userId"] == user_id  # Successfully updated to user UUID!
    assert migrated_sub["userEmail"] == user_email

    # Check that user_activities was backfilled
    user_act = mock_db.user_activities.find_one({"userId": user_id})
    assert user_act is not None
    assert user_act["totalSolved"] == 1
    assert "two-sum" in user_act["solvedQuestionIds"]
