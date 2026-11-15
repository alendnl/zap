import pytest
from fastapi.testclient import TestClient
import mongomock
from app.main import app
from app.db.mongodb import set_test_database, clear_database_cache

@pytest.fixture(autouse=True)
def setup_mock_db():
    mock_client = mongomock.MongoClient()
    mock_db = mock_client["test_zap_platform"]
    set_test_database(mock_db)
    yield
    set_test_database(None)
    clear_database_cache()

client = TestClient(app)

def test_list_mcq_auto_seeds():
    # Initial request should auto-seed default questions
    response = client.get("/api/v1/mcq/questions?summary=true")
    assert response.status_code == 200
    questions = response.json()
    assert len(questions) == 10
    
    # Check that categories exist
    categories = {q["category"] for q in questions}
    assert "DSA" in categories
    assert "DBMS" in categories
    assert "NETWORKS" in categories
    assert "OOPS" in categories

def test_filter_mcq_by_category_and_difficulty():
    response = client.get("/api/v1/mcq/questions?category=DSA")
    assert response.status_code == 200
    dsa_questions = response.json()
    assert len(dsa_questions) > 0
    assert all(q["category"] == "DSA" for q in dsa_questions)

    response_hard = client.get("/api/v1/mcq/questions?difficulty=HARD")
    assert response_hard.status_code == 200
    hard_questions = response_hard.json()
    assert all(q["difficulty"] == "HARD" for q in hard_questions)

def test_search_mcq():
    response = client.get("/api/v1/mcq/questions?search=QuickSort")
    assert response.status_code == 200
    # Search for Halving
    response_halving = client.get("/api/v1/mcq/questions?search=Halving")
    assert response_halving.status_code == 200
    assert len(response_halving.json()) >= 1

def test_get_single_mcq_question():
    list_res = client.get("/api/v1/mcq/questions")
    first_id = list_res.json()[0]["id"]

    res = client.get(f"/api/v1/mcq/questions/{first_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == first_id
    assert "options" in data
    assert len(data["options"]) >= 2
    assert any(opt["isCorrect"] for opt in data["options"])

def test_create_mcq_question_with_code_options():
    payload = {
        "title": "Finding Middle Element of Singly Linked List",
        "slug": "finding-middle-element-singly-linked-list",
        "category": "DSA",
        "difficulty": "EASY",
        "tags": ["dsa", "two-pointers"],
        "questionType": "text",
        "statement": "Which pointer movement step correctly identifies the middle of a linked list in one pass?",
        "options": [
            {
                "type": "code",
                "text": "Fast and Slow Pointers",
                "code": "slow = slow.next\nfast = fast.next.next",
                "codeLanguage": "python",
                "isCorrect": True,
                "explanation": "Slow moves by 1 and fast moves by 2."
            },
            {
                "type": "code",
                "text": "Equal Step",
                "code": "slow = slow.next\nfast = fast.next",
                "codeLanguage": "python",
                "isCorrect": False,
                "explanation": "Both pointers advance equally."
            }
        ],
        "explanation": "Tortoise and Hare algorithm.",
        "points": 1,
        "status": "PUBLISHED"
    }

    create_res = client.post("/api/v1/mcq/questions", json=payload)
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["title"] == payload["title"]
    assert created["category"] == "DSA"
    assert len(created["options"]) == 2
    assert created["options"][0]["isCorrect"] is True
    assert created["options"][0]["codeLanguage"] == "python"

    # Verify retrieval
    get_res = client.get(f"/api/v1/mcq/questions/{created['id']}")
    assert get_res.status_code == 200
    assert get_res.json()["title"] == payload["title"]

def test_create_mcq_validation_errors():
    # Missing title
    res1 = client.post("/api/v1/mcq/questions", json={
        "title": "   ",
        "statement": "Valid statement",
        "options": [{"text": "A", "isCorrect": True}, {"text": "B", "isCorrect": False}]
    })
    assert res1.status_code == 422

    # Less than 2 options
    res2 = client.post("/api/v1/mcq/questions", json={
        "title": "Valid title",
        "statement": "Valid statement",
        "options": [{"text": "A", "isCorrect": True}]
    })
    assert res2.status_code == 422

    # No correct option
    res3 = client.post("/api/v1/mcq/questions", json={
        "title": "Valid title",
        "statement": "Valid statement",
        "options": [
            {"text": "A", "isCorrect": False},
            {"text": "B", "isCorrect": False}
        ]
    })
    assert res3.status_code == 422

def test_update_and_delete_mcq_question():
    # Create question first
    payload = {
        "title": "Temporary MCQ Question",
        "category": "NETWORKS",
        "difficulty": "MEDIUM",
        "statement": "What is the standard port for HTTPS?",
        "options": [
            {"type": "text", "text": "443", "isCorrect": True},
            {"type": "text", "text": "80", "isCorrect": False}
        ]
    }
    create_res = client.post("/api/v1/mcq/questions", json=payload)
    assert create_res.status_code == 201
    qid = create_res.json()["id"]

    # Update question
    update_res = client.put(f"/api/v1/mcq/questions/{qid}", json={
        "title": "Updated HTTPS Port Question",
        "points": 5
    })
    assert update_res.status_code == 200
    assert update_res.json()["title"] == "Updated HTTPS Port Question"
    assert update_res.json()["points"] == 5

    # Delete question
    del_res = client.delete(f"/api/v1/mcq/questions/{qid}")
    assert del_res.status_code == 204

    # Verify 404
    assert client.get(f"/api/v1/mcq/questions/{qid}").status_code == 404
