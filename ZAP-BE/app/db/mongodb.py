from typing import Optional, Any
from app.config import get_settings

class DatabaseManager:
    client: Optional[Any] = None
    db: Optional[Any] = None

db_manager = DatabaseManager()

def get_database():
    """Dependency injector for MongoDB database instance."""
    if db_manager.db is not None:
        return db_manager.db

    settings = get_settings()

    # Production must use the configured Atlas database. Do not silently fall
    # back to an in-memory database when a remote URI is configured.
    if settings.MONGODB_URI.startswith(("mongodb://", "mongodb+srv://")) and not settings.MONGODB_URI.startswith(
        ("mongodb://localhost", "mongodb://127.0.0.1")
    ):
        from pymongo import MongoClient

        client = MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
        db_manager.client = client
        db_manager.db = client[settings.DATABASE_NAME]
        return db_manager.db

    # Keep the dependency-free in-memory fallback for local development and
    # tests when no remote MongoDB URI is configured.
    try:
        import mongomock
        mock_client = mongomock.MongoClient()
        db_manager.client = mock_client
        db_manager.db = mock_client[settings.DATABASE_NAME]
        return db_manager.db
    except Exception:
        return None

def set_test_database(mock_db: Any):
    """Set custom database instance for unit and integration testing."""
    if db_manager.client is not None and mock_db is None:
        close = getattr(db_manager.client, "close", None)
        if close:
            close()
        db_manager.client = None
    db_manager.db = mock_db
