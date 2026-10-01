from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from app.db.mongodb import get_database
from app.questions.models import Question, QuestionCreate, QuestionUpdate
from app.questions.service import QuestionService

router = APIRouter(prefix="", tags=["questions"])

def get_question_service(db = Depends(get_database)) -> QuestionService:
    return QuestionService(db)

@router.get("/questions", response_model=List[Question])
@router.get("/api/v1/questions", response_model=List[Question])
def list_questions(
    status: Optional[str] = None,
    service: QuestionService = Depends(get_question_service)
):
    return service.list_questions(status=status)

@router.get("/questions/{question_id}", response_model=Question)
@router.get("/api/v1/questions/{question_id}", response_model=Question)
def get_question(
    question_id: str,
    service: QuestionService = Depends(get_question_service)
):
    question = service.get_question(question_id)
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Question '{question_id}' not found"
        )
    return question

@router.post("/questions", response_model=Question, status_code=status.HTTP_201_CREATED)
@router.post("/api/v1/questions", response_model=Question, status_code=status.HTTP_201_CREATED)
def create_question(
    payload: QuestionCreate,
    service: QuestionService = Depends(get_question_service)
):
    # Verify slug uniqueness if desired
    existing = service.get_question(payload.slug)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Question with slug '{payload.slug}' already exists"
        )
    return service.create_question(payload)

@router.put("/questions/{question_id}", response_model=Question)
@router.put("/api/v1/questions/{question_id}", response_model=Question)
def update_question(
    question_id: str,
    payload: QuestionUpdate,
    service: QuestionService = Depends(get_question_service)
):
    updated = service.update_question(question_id, payload)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Question '{question_id}' not found"
        )
    return updated

@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/api/v1/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(
    question_id: str,
    service: QuestionService = Depends(get_question_service)
):
    deleted = service.delete_question(question_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Question '{question_id}' not found"
        )
    return None
