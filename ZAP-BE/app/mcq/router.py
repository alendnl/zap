from typing import List, Optional, Union, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.db.mongodb import get_database
from app.mcq.models import (
    MCQQuestion,
    MCQQuestionCreate,
    MCQQuestionUpdate,
    MCQQuestionSummary,
)
from app.mcq.service import MCQService

router = APIRouter(prefix="", tags=["mcq"])


def get_mcq_service(db=Depends(get_database)) -> MCQService:
    return MCQService(db)


@router.get("/mcq/questions", response_model=Union[List[MCQQuestionSummary], List[MCQQuestion]])
@router.get("/api/v1/mcq/questions", response_model=Union[List[MCQQuestionSummary], List[MCQQuestion]])
def list_mcq_questions(
    category: Optional[str] = Query(None, description="Filter by category (DSA, DBMS, NETWORKS, OOPS)"),
    difficulty: Optional[str] = Query(None, description="Filter by difficulty (EASY, MEDIUM, HARD)"),
    status: Optional[str] = Query(None, description="Filter by status (PUBLISHED, DRAFT, ARCHIVED)"),
    search: Optional[str] = Query(None, description="Search query across title, statement, category, tags"),
    summary: bool = Query(True, description="Return lightweight summaries without full explanations"),
    service: MCQService = Depends(get_mcq_service),
):
    return service.list_questions(
        category=category,
        difficulty=difficulty,
        status=status,
        search=search,
        summary=summary,
    )


@router.get("/mcq/questions/{question_id}", response_model=MCQQuestion)
@router.get("/api/v1/mcq/questions/{question_id}", response_model=MCQQuestion)
def get_mcq_question(
    question_id: str,
    service: MCQService = Depends(get_mcq_service),
):
    question = service.get_question(question_id)
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"MCQ Question '{question_id}' not found",
        )
    return question


@router.post("/mcq/questions", response_model=MCQQuestion, status_code=status.HTTP_201_CREATED)
@router.post("/api/v1/mcq/questions", response_model=MCQQuestion, status_code=status.HTTP_201_CREATED)
def create_mcq_question(
    payload: MCQQuestionCreate,
    service: MCQService = Depends(get_mcq_service),
):
    if not payload.title.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Question title cannot be blank.",
        )
    if not payload.statement.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Question statement cannot be blank.",
        )
    if len(payload.options) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="An MCQ question must provide at least 2 options.",
        )
    if not any(opt.isCorrect for opt in payload.options):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one option must be designated as the correct answer.",
        )

    # Check for existing slug if provided
    if payload.slug:
        existing = service.get_question(payload.slug)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"MCQ Question with slug '{payload.slug}' already exists",
            )

    return service.create_question(payload)


@router.put("/mcq/questions/{question_id}", response_model=MCQQuestion)
@router.put("/api/v1/mcq/questions/{question_id}", response_model=MCQQuestion)
def update_mcq_question(
    question_id: str,
    payload: MCQQuestionUpdate,
    service: MCQService = Depends(get_mcq_service),
):
    if payload.options is not None:
        if len(payload.options) < 2:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="An MCQ question must provide at least 2 options.",
            )
        if not any(opt.isCorrect for opt in payload.options):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="At least one option must be designated as the correct answer.",
            )

    if payload.slug:
        existing_with_slug = service.get_question(payload.slug)
        if existing_with_slug and existing_with_slug.id != question_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"MCQ Question with slug '{payload.slug}' already exists",
            )

    updated = service.update_question(question_id, payload)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"MCQ Question '{question_id}' not found",
        )
    return updated


@router.delete("/mcq/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/api/v1/mcq/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mcq_question(
    question_id: str,
    service: MCQService = Depends(get_mcq_service),
):
    deleted = service.delete_question(question_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"MCQ Question '{question_id}' not found",
        )
    return None


@router.post("/mcq/seed", response_model=Dict[str, Any])
@router.post("/api/v1/mcq/seed", response_model=Dict[str, Any])
def seed_mcq_questions(
    force: bool = Query(False, description="Force overwrite existing seed questions"),
    service: MCQService = Depends(get_mcq_service),
):
    result = service.seed_default_questions(force=force)
    return {"status": "ok", **result}

