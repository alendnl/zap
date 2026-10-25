from __future__ import annotations
from fastapi import APIRouter, Depends, Request
from app.db.mongodb import get_database
from app.activity.models import UserActivity, UserActivitySummary
from app.activity.service import ActivityService

router = APIRouter(prefix="/api/v1/users", tags=["activity"])


def get_activity_service(db = Depends(get_database)) -> ActivityService:
    return ActivityService(db)


@router.get("/{user_id}/activity", response_model=UserActivity)
def get_user_activity(
    user_id: str,
    service: ActivityService = Depends(get_activity_service)
):
    return service.get_activity(user_id)


@router.get("/{user_id}/activity/summary", response_model=UserActivitySummary)
def get_user_activity_summary(
    user_id: str,
    service: ActivityService = Depends(get_activity_service)
):
    return service.get_summary(user_id)
