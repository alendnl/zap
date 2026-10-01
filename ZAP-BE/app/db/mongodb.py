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
    # Fallback to local memory dictionary or mongomock if no client initialized
    try:
        import mongomock
        mock_client = mongomock.MongoClient()
        db_manager.client = mock_client
        db_manager.db = mock_client[get_settings().DATABASE_NAME]
        return db_manager.db
    except Exception:
        return None

def set_test_database(mock_db: Any):
    """Set custom database instance for unit and integration testing."""
    db_manager.db = mock_db
