from typing import List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from app.db.mongodb import get_database
from app.questions.models import Question, QuestionCreate, QuestionUpdate, QuestionSummary
from app.questions.service import QuestionService

router = APIRouter(prefix="", tags=["questions"])

def get_question_service(db = Depends(get_database)) -> QuestionService:
    return QuestionService(db)

@router.get("/questions", response_model=Union[List[QuestionSummary], List[Question]])
@router.get("/api/v1/questions", response_model=Union[List[QuestionSummary], List[Question]])
def list_questions(
    response: Response,
    status: Optional[str] = None,
    difficulty: Optional[str] = None,
    search: Optional[str] = None,
    page: Optional[int] = Query(None, ge=1, description="Page number for pagination"),
    limit: Optional[int] = Query(None, ge=1, le=100, description="Items per page"),
    summary: bool = Query(True, description="Return lightweight summaries without statements or test cases"),
    include_hidden: bool = Query(False, description="Include hidden test cases"),
    service: QuestionService = Depends(get_question_service)
):
    result = service.list_questions(
        status=status,
        difficulty=difficulty,
        search=search,
        page=page,
        limit=limit,
        summary=summary,
        include_hidden=include_hidden,
    )
    if isinstance(result, dict) and "items" in result:
        response.headers["X-Total-Count"] = str(result["total"])
        response.headers["X-Page"] = str(result["page"])
        response.headers["X-Total-Pages"] = str(result["totalPages"])
        return result["items"]
    return result

@router.get("/questions/{question_id}", response_model=Question)
@router.get("/api/v1/questions/{question_id}", response_model=Question)
def get_question(
    question_id: str,
    include_hidden: bool = Query(False, description="Include hidden test cases"),
    service: QuestionService = Depends(get_question_service)
):
    question = service.get_question(question_id, include_hidden=include_hidden)
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
    if payload.slug:
        existing_with_slug = service.get_question(payload.slug)
        if existing_with_slug and existing_with_slug.id != question_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Question with slug '{payload.slug}' already exists"
            )
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
