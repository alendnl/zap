from __future__ import annotations
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime, timezone
import uuid


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class LoadTestConfig(BaseModel):
    id: str = Field(default_factory=lambda: f"ltcfg-{uuid.uuid4().hex[:8]}")
    name: str
    description: Optional[str] = ""
    targetService: str = "api"  # "api" | "executor"
    config: Dict[str, Any] = Field(default_factory=dict)
    createdBy: Optional[str] = ""
    createdAt: str = Field(default_factory=utc_now_iso)
    updatedAt: str = Field(default_factory=utc_now_iso)


class LoadTestConfigCreateRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    targetService: str = "api"  # "api" | "executor"
    config: Dict[str, Any] = Field(default_factory=dict)


class EndpointMetric(BaseModel):
    count: int = 0
    fails: int = 0
    avg_ms: float = 0.0
    min_ms: float = 0.0
    max_ms: float = 0.0
    p50_ms: float = 0.0
    p90_ms: float = 0.0
    p95_ms: float = 0.0
    p99_ms: float = 0.0


class LoadTestRunSummary(BaseModel):
    totalTimeSeconds: float = 0.0
    totalRequests: int = 0
    successfulRequests: int = 0
    failedRequests: int = 0
    successRate: float = 0.0
    overallRps: float = 0.0
    peakRps: float = 0.0
    statusCounts: Dict[str, int] = Field(default_factory=dict)
    latencyPercentiles: Dict[str, float] = Field(default_factory=dict)
    endpoints: Dict[str, EndpointMetric] = Field(default_factory=dict)
    languageBreakdown: Optional[Dict[str, Any]] = None


class LoadTestRunRecord(BaseModel):
    id: str = Field(default_factory=lambda: f"ltrun-{uuid.uuid4().hex[:8]}")
    configId: Optional[str] = None
    configName: str
    targetService: str  # "api" | "executor"
    status: str = "COMPLETED"  # "COMPLETED" | "ABORTED"
    runBy: Optional[str] = ""
    startedAt: str = Field(default_factory=utc_now_iso)
    completedAt: str = Field(default_factory=utc_now_iso)
    summary: LoadTestRunSummary
    testConfigSnapshot: Dict[str, Any] = Field(default_factory=dict)


class LoadTestRunCreateRequest(BaseModel):
    configId: Optional[str] = None
    configName: str
    targetService: str
    status: str = "COMPLETED"
    startedAt: str
    completedAt: str
    summary: LoadTestRunSummary
    testConfigSnapshot: Dict[str, Any] = Field(default_factory=dict)


class LowerDataStatsResponse(BaseModel):
    database: str
    syntheticUsersCount: int
    totalUsersCount: int
    syntheticSubmissionsCount: int
    totalSubmissionsCount: int
    userActivitiesCount: int
    savedConfigsCount: int
    savedRunsCount: int


class CleanLowerDataRequest(BaseModel):
    target: str = "synthetic"  # "synthetic" (only loadtest_* accounts & submissions) or "all_test_data"
    confirmation: str  # must be "clean-lower"


class CleanLowerDataResponse(BaseModel):
    success: bool
    database: str
    deletedUsers: int
    deletedSubmissions: int
    deletedActivities: int
    message: str
