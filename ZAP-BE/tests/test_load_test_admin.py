import pytest
from fastapi.testclient import TestClient
import mongomock
from app.main import app
from app.db.mongodb import set_test_database, clear_database_cache
from app.admin.service import AdminService
from app.admin.load_test.service import LoadTestAdminService


@pytest.fixture(autouse=True)
def setup_test_databases():
    clear_database_cache()
    mock_qa = mongomock.MongoClient()["zap_platform_lower"]
    mock_prod = mongomock.MongoClient()["zap_platform_prod"]

    set_test_database(mock_qa, "qa")
    set_test_database(mock_prod, "production")

    # Seed admin user in QA
    mock_qa.admin.insert_one({"email": "admin@codezap.test", "role": "admin"})

    yield mock_qa, mock_prod

    clear_database_cache()


def test_load_test_auth_guardrails():
    client = TestClient(app)

    # 1. No email provided -> 401
    resp = client.get("/api/v1/admin/load-test/configs")
    assert resp.status_code == 401

    # 2. Non-admin email provided -> 403
    resp = client.get("/api/v1/admin/load-test/configs?email=student@codezap.test")
    assert resp.status_code == 403

    # 3. Valid admin email -> 200
    resp = client.get(
        "/api/v1/admin/load-test/configs",
        headers={"X-Admin-Email": "admin@codezap.test"},
    )
    assert resp.status_code == 200
    assert resp.json() == []


def test_load_test_config_crud():
    client = TestClient(app)
    admin_headers = {"X-Admin-Email": "admin@codezap.test"}

    # 1. Create a config
    payload = {
        "name": "API Burst Test",
        "description": "50 virtual users testing questions endpoint",
        "targetService": "api",
        "config": {
            "users": 50,
            "durationSeconds": 30,
            "endpoint": "/api/v1/questions",
            "rampUp": "gradual",
        },
    }
    resp = client.post(
        "/api/v1/admin/load-test/configs",
        json=payload,
        headers=admin_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    config_id = data["id"]
    assert data["name"] == "API Burst Test"
    assert data["targetService"] == "api"

    # 2. List configs
    resp = client.get("/api/v1/admin/load-test/configs", headers=admin_headers)
    assert resp.status_code == 200
    configs = resp.json()
    assert len(configs) == 1
    assert configs[0]["id"] == config_id

    # 3. Get single config
    resp = client.get(
        f"/api/v1/admin/load-test/configs/{config_id}", headers=admin_headers
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "API Burst Test"

    # 4. Delete config
    resp = client.delete(
        f"/api/v1/admin/load-test/configs/{config_id}", headers=admin_headers
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    # 5. Verify deleted
    resp = client.get(
        f"/api/v1/admin/load-test/configs/{config_id}", headers=admin_headers
    )
    assert resp.status_code == 404


def test_load_test_runs_and_data_cleanup(setup_test_databases):
    mock_qa, _ = setup_test_databases
    client = TestClient(app)
    admin_headers = {"X-Admin-Email": "admin@codezap.test"}

    # 1. Seed some synthetic users and submissions in QA
    mock_qa.users.insert_many([
        {
            "id": "LT-u1",
            "email": "loadtest_u1@codezap.test",
            "name": "LT User 1",
            "studentId": "LT-u1",
        },
        {
            "id": "LT-u2",
            "email": "loadtest_u2@codezap.test",
            "name": "LT User 2",
            "studentId": "LT-u2",
        },
        {
            "id": "real-1",
            "email": "student@college.edu",
            "name": "Real Student",
            "studentId": "ST-01",
        },
    ])
    mock_qa.submissions.insert_many([
        {"id": "sub-1", "userId": "LT-u1", "status": "COMPLETED"},
        {"id": "sub-2", "userId": "LT-u2", "status": "COMPLETED"},
        {"id": "sub-3", "userId": "real-1", "status": "COMPLETED"},
    ])

    # 2. Check data stats
    resp = client.get("/api/v1/admin/load-test/data-stats", headers=admin_headers)
    assert resp.status_code == 200
    stats = resp.json()
    assert stats["syntheticUsersCount"] == 2
    assert stats["totalUsersCount"] == 3
    assert stats["syntheticSubmissionsCount"] == 2
    assert stats["totalSubmissionsCount"] == 3

    # 3. Clean without confirmation string -> 400
    resp = client.post(
        "/api/v1/admin/load-test/clean-data",
        json={"target": "synthetic", "confirmation": "wrong-string"},
        headers=admin_headers,
    )
    assert resp.status_code == 400

    # 4. Clean with confirmation string -> 200
    resp = client.post(
        "/api/v1/admin/load-test/clean-data",
        json={"target": "synthetic", "confirmation": "clean-lower"},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    clean_res = resp.json()
    assert clean_res["deletedUsers"] == 2
    assert clean_res["deletedSubmissions"] == 2

    # 5. Verify real user still remains
    stats_after = client.get(
        "/api/v1/admin/load-test/data-stats", headers=admin_headers
    ).json()
    assert stats_after["syntheticUsersCount"] == 0
    assert stats_after["totalUsersCount"] == 1
    assert stats_after["syntheticSubmissionsCount"] == 0
    assert stats_after["totalSubmissionsCount"] == 1


def test_guardrail_prevents_cleaning_production():
    mock_prod = mongomock.MongoClient()["zap_platform_prod"]
    with pytest.raises(RuntimeError) as exc_info:
        LoadTestAdminService(mock_prod)
    assert "FATAL GUARDRAIL VIOLATION" in str(exc_info.value)
