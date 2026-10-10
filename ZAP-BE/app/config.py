from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class EnvironmentConfig(BaseModel):
    """Per-environment settings. Only the database name and queue name differ
    between QA and production; everything else is shared."""
    database_name: str
    queue_name: str


class Settings(BaseSettings):
    APP_NAME: str = "ZAP Backend API"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    MONGODB_URI: str = "mongodb://localhost:27017"
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "https://codezap-arena.vercel.app",
        "https://www.codezap-arena.vercel.app",
        "https://run.codezap.in",
        "https://www.codezap.in/"
    ]
    CORS_ORIGIN_REGEX: str | None = r"https://codezap-arena-[a-z0-9-]+-alendnl[.]vercel[.]app"

    # Shared Cloud Tasks / executor config (single API + single executor)
    GCP_PROJECT_ID: str = ""
    GCP_LOCATION: str = "us-central1"
    EXECUTOR_TASK_URL: str = "http://localhost:8080/internal/tasks/execute"
    TASKS_OIDC_AUDIENCE: str = "http://localhost:8080"
    TASKS_SERVICE_ACCOUNT: str = ""
    TASKS_EXECUTION_LEASE_SECONDS: int = 360

    # Per-environment (only DB name + queue name differ)
    DEFAULT_ENVIRONMENT: str = "production"
    QA_DATABASE_NAME: str = "zap_platform_lower"
    QA_QUEUE_NAME: str = "zap-submissions-lower"
    PRODUCTION_DATABASE_NAME: str = "zap_platform_prod"
    PRODUCTION_QUEUE_NAME: str = "zap-submissions"

    model_config = SettingsConfigDict(env_file=".env", extra="allow")

    def get_environment_config(self, env: str) -> EnvironmentConfig:
        """Return the per-environment config. Unknown envs default to production."""
        if env == "qa":
            return EnvironmentConfig(
                database_name=self.QA_DATABASE_NAME,
                queue_name=self.QA_QUEUE_NAME,
            )
        return EnvironmentConfig(
            database_name=self.PRODUCTION_DATABASE_NAME,
            queue_name=self.PRODUCTION_QUEUE_NAME,
        )


@lru_cache()
def get_settings() -> Settings:
    return Settings()
