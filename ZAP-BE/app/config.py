from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "ZAP Backend API"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    MONGODB_URI: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "zap_platform"
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "https://codezap-arena.vercel.app"]

    # Google Cloud Tasks configuration
    GCP_PROJECT_ID: str = ""
    GCP_LOCATION: str = "us-central1"
    TASKS_QUEUE_NAME: str = "zap-submissions"
    EXECUTOR_TASK_URL: str = "http://localhost:8080/internal/tasks/execute"
    TASKS_SERVICE_ACCOUNT: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="allow")


@lru_cache()
def get_settings() -> Settings:
    return Settings()
