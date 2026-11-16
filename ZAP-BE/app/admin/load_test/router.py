from __future__ import annotations
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Header, status, Request
from app.db.mongodb import get_database_for_env
from app.admin.service import AdminService
from app.admin.load_test.models import (
    LoadTestConfig,
    LoadTestConfigCreateRequest,
    LoadTestRunRecord,
    LoadTestRunCreateRequest,
    LowerDataStatsResponse,
    CleanLowerDataRequest,
    CleanLowerDataResponse,
)
from app.admin.load_test.service import LoadTestAdminService

router = APIRouter(prefix="/api/v1/admin/load-test", tags=["admin-load-test"])


def verify_admin_access(
    email: Optional[str] = Query(None, description="Admin email address"),
    x_admin_email: Optional[str] = Header(None, alias="X-Admin-Email"),
) -> str:
    admin_email = (email or x_admin_email or "").strip()
    if not admin_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin email header (X-Admin-Email) or query parameter is required.",
        )

    # Check admin privileges across production and QA databases
    prod_db = get_database_for_env("production")
    qa_db = get_database_for_env("qa")
    if not (AdminService(prod_db).is_admin(admin_email) or AdminService(qa_db).is_admin(admin_email)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Forbidden: '{admin_email}' does not have admin privileges.",
        )

    return admin_email


def get_load_test_service() -> LoadTestAdminService:
    # Strictly locked to lower / QA database
    qa_db = get_database_for_env("qa")
    return LoadTestAdminService(qa_db)


# ------------------------------------------------------------------------------
# CONFIGURATIONS
# ------------------------------------------------------------------------------
@router.get("/configs", response_model=List[LoadTestConfig])
def list_configs(
    admin_email: str = Depends(verify_admin_access),
    service: LoadTestAdminService = Depends(get_load_test_service),
):
    return service.list_configs()


@router.post("/configs", response_model=LoadTestConfig, status_code=status.HTTP_201_CREATED)
def create_config(
    payload: LoadTestConfigCreateRequest,
    admin_email: str = Depends(verify_admin_access),
    service: LoadTestAdminService = Depends(get_load_test_service),
):
    return service.save_config(payload, admin_email)


@router.get("/configs/{config_id}", response_model=LoadTestConfig)
def get_config(
    config_id: str,
    admin_email: str = Depends(verify_admin_access),
    service: LoadTestAdminService = Depends(get_load_test_service),
):
    cfg = service.get_config(config_id)
    if not cfg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Load test configuration '{config_id}' not found.",
        )
    return cfg


@router.delete("/configs/{config_id}")
def delete_config(
    config_id: str,
    admin_email: str = Depends(verify_admin_access),
    service: LoadTestAdminService = Depends(get_load_test_service),
):
    deleted = service.delete_config(config_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Load test configuration '{config_id}' not found.",
        )
    return {"success": True, "deletedConfigId": config_id}


# ------------------------------------------------------------------------------
# RUN REPORTS & HISTORY
# ------------------------------------------------------------------------------
@router.get("/runs", response_model=List[LoadTestRunRecord])
def list_runs(
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    admin_email: str = Depends(verify_admin_access),
    service: LoadTestAdminService = Depends(get_load_test_service),
):
    return service.list_runs(limit=limit, skip=skip)


@router.post("/runs", response_model=LoadTestRunRecord, status_code=status.HTTP_201_CREATED)
def record_run(
    payload: LoadTestRunCreateRequest,
    admin_email: str = Depends(verify_admin_access),
    service: LoadTestAdminService = Depends(get_load_test_service),
):
    return service.save_run(payload, admin_email)


@router.get("/runs/{run_id}", response_model=LoadTestRunRecord)
def get_run(
    run_id: str,
    admin_email: str = Depends(verify_admin_access),
    service: LoadTestAdminService = Depends(get_load_test_service),
):
    run_record = service.get_run(run_id)
    if not run_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Load test run record '{run_id}' not found.",
        )
    return run_record


@router.delete("/runs/{run_id}")
def delete_run(
    run_id: str,
    admin_email: str = Depends(verify_admin_access),
    service: LoadTestAdminService = Depends(get_load_test_service),
):
    deleted = service.delete_run(run_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Load test run record '{run_id}' not found.",
        )
    return {"success": True, "deletedRunId": run_id}


# ------------------------------------------------------------------------------
# LOWER DB STATS & CLEANUP
# ------------------------------------------------------------------------------
@router.get("/data-stats", response_model=LowerDataStatsResponse)
def get_lower_data_stats(
    admin_email: str = Depends(verify_admin_access),
    service: LoadTestAdminService = Depends(get_load_test_service),
):
    return service.get_lower_data_stats()


@router.post("/clean-data", response_model=CleanLowerDataResponse)
def clean_lower_data(
    payload: CleanLowerDataRequest,
    admin_email: str = Depends(verify_admin_access),
    service: LoadTestAdminService = Depends(get_load_test_service),
):
    if payload.confirmation.strip().lower() != "clean-lower":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation string mismatch. You must pass confirmation='clean-lower' to execute purge.",
        )
    try:
        return service.clean_lower_data(target=payload.target)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
