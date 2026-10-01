import pytest
from fastapi.testclient import TestClient
import mongomock
from app.main import app
from app.db.mongodb import set_test_database, db_manager

@pytest.fixture(autouse=True)
def setup_mock_db():
    mock_client = mongomock.MongoClient()
    mock_db = mock_client["test_zap_platform"]
    set_test_database(mock_db)
    yield
    set_test_database(None)

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_create_and_get_question():
    payload = {
        "slug": "two-sum",
        "title": "Two Sum",
        "difficulty": "EASY",
        "tags": ["array", "hash-map"],
        "statement": "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
        "examples": [
            {
                "input": "nums = [2,7,11,15], target = 9",
                "output": "[0,1]",
                "explanation": "Because nums[0] + nums[1] == 9, we return [0, 1]."
            }
        ],
        "constraints": ["2 <= nums.length <= 10^4"],
        "testCases": [
            {
                "visibility": "PUBLIC",
                "input": "[2,7,11,15]\n9",
                "expectedOutput": "[0, 1]",
                "enabled": True
            },
            {
                "visibility": "HIDDEN",
                "input": "[3,2,4]\n6",
                "expectedOutput": "[1, 2]",
                "enabled": True
            }
        ],
        "executionLimits": {
            "timeMs": 2000,
            "memoryMb": 256,
            "outputKb": 1024
        },
        "supportedLanguages": ["python", "java", "cpp", "node"]
    }

    # Create question
    create_res = client.post("/api/v1/questions", json=payload)
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["slug"] == "two-sum"
    assert created["title"] == "Two Sum"
    assert len(created["testCases"]) == 2
    assert created["version"] == 1
    q_id = created["id"]

    # Get by ID
    get_res = client.get(f"/api/v1/questions/{q_id}")
    assert get_res.status_code == 200
    assert get_res.json()["title"] == "Two Sum"

    # Get by Slug
    get_slug_res = client.get("/api/v1/questions/two-sum")
    assert get_slug_res.status_code == 200
    assert get_slug_res.json()["id"] == q_id

    # List questions
    list_res = client.get("/api/v1/questions")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # Update question
    update_res = client.put(f"/api/v1/questions/{q_id}", json={"title": "Two Sum Updated"})
    assert update_res.status_code == 200
    assert update_res.json()["title"] == "Two Sum Updated"
    assert update_res.json()["version"] == 2

    # Delete question
    del_res = client.delete(f"/api/v1/questions/{q_id}")
    assert del_res.status_code == 204

    # Confirm deletion
    get_after_del = client.get(f"/api/v1/questions/{q_id}")
    assert get_after_del.status_code == 404
