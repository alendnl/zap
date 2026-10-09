import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.mongodb import set_test_database
import mongomock


@pytest.fixture(autouse=True)
def setup_mock_db():
    mock_client = mongomock.MongoClient()
    mock_db = mock_client["test_zap_platform"]
    set_test_database(mock_db)
    yield
    set_test_database(None)


client = TestClient(app)


def test_student_signup_and_login():
    signup_payload = {
        "name": "Jane Doe",
        "studentId": "CS-2026-001",
        "collegeName": "Stanford University",
        "email": "jane.doe@stanford.edu",
        "password": "secretpassword123",
    }

    # 1. Sign Up
    res = client.post("/api/v1/auth/signup", json=signup_payload)
    assert res.status_code == 201
    data = res.json()
    assert "token" in data
    assert data["student"]["name"] == "Jane Doe"
    assert data["student"]["studentId"] == "CS-2026-001"
    assert data["student"]["collegeName"] == "Stanford University"
    assert data["student"]["email"] == "jane.doe@stanford.edu"

    # 2. Duplicate email rejected
    dup_res = client.post("/api/v1/auth/signup", json=signup_payload)
    assert dup_res.status_code == 409
    assert "already exists" in dup_res.json()["detail"]

    # 3. Duplicate student ID rejected
    diff_email_payload = dict(signup_payload)
    diff_email_payload["email"] = "other.email@stanford.edu"
    dup_id_res = client.post("/api/v1/auth/signup", json=diff_email_payload)
    assert dup_id_res.status_code == 409
    assert "Student ID" in dup_id_res.json()["detail"]

    # 4. Successful login
    login_res = client.post("/api/v1/auth/login", json={
        "email": "jane.doe@stanford.edu",
        "password": "secretpassword123",
    })
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "token" in login_data
    assert login_data["student"]["name"] == "Jane Doe"

    # 5. Invalid password rejected
    bad_login = client.post("/api/v1/auth/login", json={
        "email": "jane.doe@stanford.edu",
        "password": "wrongpassword",
    })
    assert bad_login.status_code == 401

    # 6. Login using Student ID instead of email
    id_login_res = client.post("/api/v1/auth/login", json={
        "email": "CS-2026-001",
        "password": "secretpassword123",
    })
    assert id_login_res.status_code == 200
    assert id_login_res.json()["student"]["email"] == "jane.doe@stanford.edu"

    # 7. Profile lookup
    profile_res = client.get("/api/v1/auth/profile?student_id=CS-2026-001")
    assert profile_res.status_code == 200
    assert profile_res.json()["name"] == "Jane Doe"

