import mongomock
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.mongodb import set_test_database, clear_database_cache


@pytest.fixture(autouse=True)
def setup_test_db():
    mock_db = mongomock.MongoClient()["zap_platform_prod"]
    set_test_database(mock_db, "production")
    yield mock_db
    clear_database_cache()


def test_check_admin_access_unauthorized(setup_test_db):
    client = TestClient(app)
    res = client.get("/api/v1/admin/check-access?email=student@example.com")
    assert res.status_code == 200
    data = res.json()
    assert data["isAdmin"] is False
    assert data["email"] == "student@example.com"


def test_check_admin_access_authorized(setup_test_db):
    mock_db = setup_test_db
    # Populate admin collection
    mock_db.admin.insert_one({"email": "admin@codezap.in", "role": "superadmin"})

    client = TestClient(app)
    # Exact match
    res = client.get("/api/v1/admin/check-access?email=admin@codezap.in")
    assert res.status_code == 200
    assert res.json()["isAdmin"] is True

    # Case-insensitive match
    res_caps = client.get("/api/v1/admin/check-access?email=ADMIN@CODEZAP.IN")
    assert res_caps.status_code == 200
    assert res_caps.json()["isAdmin"] is True


def test_get_users_dashboard_forbidden_for_non_admin(setup_test_db):
    client = TestClient(app)
    res = client.get("/api/v1/admin/users?email=nonadmin@example.com")
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"]


def test_get_users_dashboard_success_and_metrics(setup_test_db):
    mock_db = setup_test_db
    # Add admin
    mock_db.admin.insert_one({"email": "admin@zap.dev"})

    # Add questions
    mock_db.questions.insert_many([
        {"id": "q1", "slug": "two-sum", "title": "Two Sum", "difficulty": "EASY"},
        {"id": "q2", "slug": "three-sum", "title": "Three Sum", "difficulty": "MEDIUM"},
        {"id": "q3", "slug": "median-arrays", "title": "Median of Two Sorted Arrays", "difficulty": "HARD"},
    ])

    # Add users
    mock_db.users.insert_many([
        {
            "id": "u1",
            "name": "Alice Smith",
            "studentId": "MIT001",
            "collegeName": "MIT",
            "email": "alice@mit.edu",
            "createdAt": "2026-10-01T10:00:00Z",
        },
        {
            "id": "u2",
            "name": "Bob Jones",
            "studentId": "STAN001",
            "collegeName": "Stanford",
            "email": "bob@stanford.edu",
            "createdAt": "2026-10-02T10:00:00Z",
        },
    ])

    # Add user activities
    mock_db.user_activities.insert_one({
        "userId": "u1",
        "totalSolved": 2,
        "solvedQuestionIds": ["q1", "q2"],
        "attemptedQuestionIds": ["q1", "q2", "q3"],
        "updatedAt": "2026-10-20T10:00:00Z",
    })

    # Add submissions
    mock_db.submissions.insert_many([
        {
            "id": "s1",
            "userId": "u1",
            "questionId": "q1",
            "verdict": "ACCEPTED",
            "createdAt": "2026-10-10T12:00:00Z",
            "mode": "SUBMIT",
        },
        {
            "id": "s2",
            "userId": "u1",
            "questionId": "q2",
            "verdict": "ACCEPTED",
            "createdAt": "2026-10-12T12:00:00Z",
            "mode": "SUBMIT",
        },
        {
            "id": "s3",
            "userId": "u1",
            "questionId": "q3",
            "verdict": "WRONG_ANSWER",
            "createdAt": "2026-10-15T12:00:00Z",
            "mode": "SUBMIT",
        },
        {
            "id": "s4",
            "userId": "u2",
            "questionId": "q1",
            "verdict": "ACCEPTED",
            "createdAt": "2026-10-16T12:00:00Z",
            "mode": "SUBMIT",
        },
    ])

    client = TestClient(app)
    res = client.get("/api/v1/admin/users?email=admin@zap.dev")
    assert res.status_code == 200
    data = res.json()

    # Verify overview
    overview = data["overview"]
    assert overview["totalStudents"] == 2
    assert overview["totalColleges"] == 2
    assert overview["totalSolvedQuestions"] >= 3
    assert len(overview["topColleges"]) >= 1

    # Verify colleges list
    assert sorted(data["colleges"]) == ["MIT", "Stanford"]

    # Verify user stats
    users = data["users"]
    assert len(users) == 2

    alice = next(u for u in users if u["email"] == "alice@mit.edu")
    assert alice["name"] == "Alice Smith"
    assert alice["collegeName"] == "MIT"
    assert alice["totalSolved"] == 2
    assert alice["solvedBreakdown"]["easy"] == 1
    assert alice["solvedBreakdown"]["medium"] == 1
    assert alice["solvedBreakdown"]["hard"] == 0
    assert alice["totalSubmissions"] == 3
    assert alice["accuracyRate"] == 66.7


def test_get_users_dashboard_filter_by_college(setup_test_db):
    mock_db = setup_test_db
    mock_db.admin.insert_one({"email": "admin@zap.dev"})

    mock_db.users.insert_many([
        {
            "id": "u1",
            "name": "Alice Smith",
            "studentId": "MIT001",
            "collegeName": "MIT",
            "email": "alice@mit.edu",
        },
        {
            "id": "u2",
            "name": "Bob Jones",
            "studentId": "STAN001",
            "collegeName": "Stanford",
            "email": "bob@stanford.edu",
        },
    ])

    client = TestClient(app)
    res = client.get("/api/v1/admin/users?email=admin@zap.dev&college=MIT")
    assert res.status_code == 200
    data = res.json()
    assert len(data["users"]) == 1
    assert data["users"][0]["collegeName"] == "MIT"
    assert data["users"][0]["email"] == "alice@mit.edu"


def test_get_users_dashboard_search(setup_test_db):
    mock_db = setup_test_db
    mock_db.admin.insert_one({"email": "admin@zap.dev"})

    mock_db.users.insert_many([
        {
            "id": "u1",
            "name": "Alice Smith",
            "studentId": "MIT001",
            "collegeName": "MIT",
            "email": "alice@mit.edu",
        },
        {
            "id": "u2",
            "name": "Bob Jones",
            "studentId": "STAN001",
            "collegeName": "Stanford",
            "email": "bob@stanford.edu",
        },
    ])

    client = TestClient(app)
    res = client.get("/api/v1/admin/users?email=admin@zap.dev&search=bob")
    assert res.status_code == 200
    data = res.json()
    assert len(data["users"]) == 1
    assert data["users"][0]["name"] == "Bob Jones"


def test_get_user_details_drilldown(setup_test_db):
    mock_db = setup_test_db
    mock_db.admin.insert_one({"email": "admin@zap.dev"})

    mock_db.questions.insert_one({
        "id": "q1",
        "slug": "two-sum",
        "title": "Two Sum",
        "difficulty": "EASY",
    })

    mock_db.users.insert_one({
        "id": "u1",
        "name": "Alice Smith",
        "studentId": "MIT001",
        "collegeName": "MIT",
        "email": "alice@mit.edu",
        "createdAt": "2026-10-01T10:00:00Z",
    })

    mock_db.submissions.insert_one({
        "id": "s1",
        "userId": "u1",
        "questionId": "q1",
        "language": "python",
        "verdict": "ACCEPTED",
        "createdAt": "2026-10-10T12:00:00Z",
        "mode": "SUBMIT",
    })

    client = TestClient(app)
    # Unauthorized
    res_unauth = client.get("/api/v1/admin/users/u1?email=imposter@test.com")
    assert res_unauth.status_code == 403

    # Authorized
    res = client.get("/api/v1/admin/users/u1?email=admin@zap.dev")
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Alice Smith"
    assert data["totalSolved"] == 1
    assert len(data["solvedQuestions"]) == 1
    assert data["solvedQuestions"][0]["slug"] == "two-sum"
    assert len(data["recentSubmissions"]) == 1
