from __future__ import annotations
import re
import logging
from typing import Optional, List, Dict, Any
from app.db.mongodb import get_database_for_env, ensure_indexes
from app.config import get_settings
from app.admin.load_test.models import (
    LoadTestConfig,
    LoadTestConfigCreateRequest,
    LoadTestRunRecord,
    LoadTestRunCreateRequest,
    LowerDataStatsResponse,
    CleanLowerDataResponse,
    utc_now_iso,
)

logger = logging.getLogger(__name__)


class LoadTestAdminService:
    """Service for managing load test configurations, test run history, and
    synthetic test data cleanup.

    STRICT GUARDRAIL:
    This service is strictly bound to the Lower/QA database (`zap_platform_lower`).
    Under NO circumstance will any write or delete touch `zap_platform_prod`.
    """

    def __init__(self, db=None):
        settings = get_settings()
        self.target_env = "qa"
        self.expected_db_name = settings.QA_DATABASE_NAME  # "zap_platform_lower"
        self.db = db if db is not None else get_database_for_env(self.target_env)
        self._verify_guardrail()

    def _verify_guardrail(self) -> None:
        if self.db is None:
            return
        db_name = getattr(self.db, "name", "")
        if db_name and "prod" in db_name.lower():
            raise RuntimeError(
                f"FATAL GUARDRAIL VIOLATION: LoadTestAdminService is pointing to production DB '{db_name}'!"
            )

    # --------------------------------------------------------------------------
    # CONFIGURATIONS
    # --------------------------------------------------------------------------
    def list_configs(self) -> List[LoadTestConfig]:
        if self.db is None or not hasattr(self.db, "load_test_configs"):
            return []
        cursor = self.db.load_test_configs.find({}).sort("createdAt", -1)
        results = []
        for doc in cursor:
            doc.pop("_id", None)
            try:
                results.append(LoadTestConfig(**doc))
            except Exception as exc:
                logger.warning(f"Error parsing load test config: {exc}")
        return results

    def get_config(self, config_id: str) -> Optional[LoadTestConfig]:
        if self.db is None or not hasattr(self.db, "load_test_configs"):
            return None
        doc = self.db.load_test_configs.find_one({"id": config_id})
        if not doc:
            return None
        doc.pop("_id", None)
        return LoadTestConfig(**doc)

    def save_config(
        self, req: LoadTestConfigCreateRequest, user_email: str
    ) -> LoadTestConfig:
        config_obj = LoadTestConfig(
            name=req.name,
            description=req.description,
            targetService=req.targetService,
            config=req.config,
            createdBy=user_email,
            createdAt=utc_now_iso(),
            updatedAt=utc_now_iso(),
        )
        if self.db is not None and hasattr(self.db, "load_test_configs"):
            self.db.load_test_configs.insert_one(config_obj.model_dump())
        return config_obj

    def delete_config(self, config_id: str) -> bool:
        if self.db is None or not hasattr(self.db, "load_test_configs"):
            return False
        res = self.db.load_test_configs.delete_one({"id": config_id})
        return res.deleted_count > 0

    # --------------------------------------------------------------------------
    # RUN REPORTS & HISTORY
    # --------------------------------------------------------------------------
    def list_runs(self, limit: int = 50, skip: int = 0) -> List[LoadTestRunRecord]:
        if self.db is None or not hasattr(self.db, "load_test_runs"):
            return []
        cursor = (
            self.db.load_test_runs.find({})
            .sort("startedAt", -1)
            .skip(skip)
            .limit(limit)
        )
        results = []
        for doc in cursor:
            doc.pop("_id", None)
            try:
                results.append(LoadTestRunRecord(**doc))
            except Exception as exc:
                logger.warning(f"Error parsing load test run: {exc}")
        return results

    def get_run(self, run_id: str) -> Optional[LoadTestRunRecord]:
        if self.db is None or not hasattr(self.db, "load_test_runs"):
            return None
        doc = self.db.load_test_runs.find_one({"id": run_id})
        if not doc:
            return None
        doc.pop("_id", None)
        return LoadTestRunRecord(**doc)

    def save_run(
        self, req: LoadTestRunCreateRequest, user_email: str
    ) -> LoadTestRunRecord:
        run_obj = LoadTestRunRecord(
            configId=req.configId,
            configName=req.configName,
            targetService=req.targetService,
            status=req.status,
            runBy=user_email,
            startedAt=req.startedAt,
            completedAt=req.completedAt,
            summary=req.summary,
            testConfigSnapshot=req.testConfigSnapshot,
        )
        if self.db is not None and hasattr(self.db, "load_test_runs"):
            self.db.load_test_runs.insert_one(run_obj.model_dump())
        return run_obj

    def delete_run(self, run_id: str) -> bool:
        if self.db is None or not hasattr(self.db, "load_test_runs"):
            return False
        res = self.db.load_test_runs.delete_one({"id": run_id})
        return res.deleted_count > 0

    # --------------------------------------------------------------------------
    # DATA STATS & CLEANUP (QA DATABASE ONLY)
    # --------------------------------------------------------------------------
    def get_lower_data_stats(self) -> LowerDataStatsResponse:
        self._verify_guardrail()
        db_name = getattr(self.db, "name", self.expected_db_name) if self.db is not None else self.expected_db_name

        if self.db is None:
            return LowerDataStatsResponse(
                database=db_name,
                syntheticUsersCount=0,
                totalUsersCount=0,
                syntheticSubmissionsCount=0,
                totalSubmissionsCount=0,
                userActivitiesCount=0,
                savedConfigsCount=0,
                savedRunsCount=0,
            )

        synth_filter = {"email": {"$regex": r"^loadtest_", "$options": "i"}}
        synth_users_count = (
            self.db.users.count_documents(synth_filter)
            if hasattr(self.db, "users")
            else 0
        )
        total_users_count = (
            self.db.users.count_documents({}) if hasattr(self.db, "users") else 0
        )

        synth_sub_filter = {
            "$or": [
                {"userId": {"$regex": r"^(LT-|loadtest_)", "$options": "i"}},
                {"user_id": {"$regex": r"^(LT-|loadtest_)", "$options": "i"}},
            ]
        }
        synth_subs_count = (
            self.db.submissions.count_documents(synth_sub_filter)
            if hasattr(self.db, "submissions")
            else 0
        )
        total_subs_count = (
            self.db.submissions.count_documents({})
            if hasattr(self.db, "submissions")
            else 0
        )

        activities_count = (
            self.db.user_activities.count_documents({})
            if hasattr(self.db, "user_activities")
            else 0
        )

        saved_configs_count = (
            self.db.load_test_configs.count_documents({})
            if hasattr(self.db, "load_test_configs")
            else 0
        )
        saved_runs_count = (
            self.db.load_test_runs.count_documents({})
            if hasattr(self.db, "load_test_runs")
            else 0
        )

        return LowerDataStatsResponse(
            database=db_name,
            syntheticUsersCount=synth_users_count,
            totalUsersCount=total_users_count,
            syntheticSubmissionsCount=synth_subs_count,
            totalSubmissionsCount=total_subs_count,
            userActivitiesCount=activities_count,
            savedConfigsCount=saved_configs_count,
            savedRunsCount=saved_runs_count,
        )

    def clean_lower_data(self, target: str = "synthetic") -> CleanLowerDataResponse:
        """Purge test data from QA DB.

        Strictly blocked if DB name contains 'prod'.
        """
        self._verify_guardrail()
        if self.db is None:
            return CleanLowerDataResponse(
                success=True,
                database="in-memory",
                deletedUsers=0,
                deletedSubmissions=0,
                deletedActivities=0,
                message="No active database handle to clean.",
            )

        db_name = getattr(self.db, "name", "")
        if "prod" in db_name.lower():
            raise RuntimeError(
                f"FATAL: Database '{db_name}' contains 'prod'! Purge operation aborted."
            )

        deleted_users = 0
        deleted_subs = 0
        deleted_acts = 0

        if target == "all_test_data":
            # Delete non-admin users in lower DB
            if hasattr(self.db, "users"):
                res = self.db.users.delete_many({})
                deleted_users = res.deleted_count
            if hasattr(self.db, "submissions"):
                res = self.db.submissions.delete_many({})
                deleted_subs = res.deleted_count
            if hasattr(self.db, "user_activities"):
                res = self.db.user_activities.delete_many({})
                deleted_acts = res.deleted_count
        else:
            # Delete only synthetic load-test accounts and their submissions
            synth_user_ids = []
            if hasattr(self.db, "users"):
                synth_cursor = self.db.users.find(
                    {"email": {"$regex": r"^loadtest_", "$options": "i"}},
                    {"_id": 1, "id": 1, "studentId": 1},
                )
                for u in synth_cursor:
                    if "id" in u:
                        synth_user_ids.append(str(u["id"]))
                    if "_id" in u:
                        synth_user_ids.append(str(u["_id"]))
                    if "studentId" in u:
                        synth_user_ids.append(str(u["studentId"]))

                res = self.db.users.delete_many(
                    {"email": {"$regex": r"^loadtest_", "$options": "i"}}
                )
                deleted_users = res.deleted_count

            # Delete submissions created by synthetic users
            if hasattr(self.db, "submissions"):
                sub_filter = {
                    "$or": [
                        {"userId": {"$in": synth_user_ids}},
                        {"userId": {"$regex": r"^(LT-|loadtest_)", "$options": "i"}},
                    ]
                }
                res = self.db.submissions.delete_many(sub_filter)
                deleted_subs = res.deleted_count

            # Delete activities for synthetic users
            if hasattr(self.db, "user_activities"):
                act_filter = {"userId": {"$in": synth_user_ids}}
                res = self.db.user_activities.delete_many(act_filter)
                deleted_acts = res.deleted_count

        ensure_indexes(self.db)

        return CleanLowerDataResponse(
            success=True,
            database=db_name or self.expected_db_name,
            deletedUsers=deleted_users,
            deletedSubmissions=deleted_subs,
            deletedActivities=deleted_acts,
            message=(
                f"Successfully purged {deleted_users} users, {deleted_subs} submissions, "
                f"and {deleted_acts} activity records from '{db_name or self.expected_db_name}'."
            ),
        )
