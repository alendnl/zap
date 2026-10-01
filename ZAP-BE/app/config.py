from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "ZAP Backend API"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    MONGODB_URI: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "zap_platform"
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    model_config = SettingsConfigDict(env_file=".env", extra="allow")


@lru_cache()
def get_settings() -> Settings:
    return Settings()
