from typing import Optional, Any
from fastapi import Request
from app.config import get_settings


class DatabaseManager:
    """Caches one client/db per environment name."""
    clients: dict[str, Any] = {}
    dbs: dict[str, Any] = {}


db_manager = DatabaseManager()


def get_request_environment(request: Optional[Request] = None) -> str:
    """Read the environment from the X-ZAP-ENV header, defaulting to the
    configured default environment."""
    settings = get_settings()
    if request is None:
        requested_env = settings.DEFAULT_ENVIRONMENT
    else:
        requested_env = request.headers.get("X-ZAP-ENV", settings.DEFAULT_ENVIRONMENT)
    return "qa" if requested_env == "qa" else "production"


def get_database_for_env(env: str):
    """Return the MongoDB database for the given environment, creating and
    caching it on first use."""
    if env in db_manager.dbs:
        return db_manager.dbs[env]

    settings = get_settings()
    env_cfg = settings.get_environment_config(env)

    # Production must use the configured Atlas database. Do not silently fall
    # back to an in-memory database when a remote URI is configured.
    if settings.MONGODB_URI.startswith(("mongodb://", "mongodb+srv://")) and not settings.MONGODB_URI.startswith(
        ("mongodb://localhost", "mongodb://127.0.0.1")
    ):
        from pymongo import MongoClient

        client = MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
        db_manager.clients[env] = client
        db_manager.dbs[env] = client[env_cfg.database_name]
        return db_manager.dbs[env]

    # Keep the dependency-free in-memory fallback for local development and
    # tests when no remote MongoDB URI is configured.
    try:
        import mongomock
        mock_client = mongomock.MongoClient()
        db_manager.clients[env] = mock_client
        db_manager.dbs[env] = mock_client[env_cfg.database_name]
        return db_manager.dbs[env]
    except Exception:
        return None


def get_database(request: Request = None):
    """FastAPI dependency: returns the database for the request's environment
    (X-ZAP-ENV header, defaulting to DEFAULT_ENVIRONMENT)."""
    return get_database_for_env(get_request_environment(request))


def clear_database_cache(env: Optional[str] = None) -> None:
    """Close and remove cached database clients and handles.

    With no environment, clears every cached environment.
    """
    environments = [env] if env is not None else list(db_manager.clients.keys())
    for cached_env in environments:
        client = db_manager.clients.pop(cached_env, None)
        if client is not None:
            close = getattr(client, "close", None)
            if close:
                close()
        db_manager.dbs.pop(cached_env, None)


def set_test_database(mock_db: Any, env: Optional[str] = None):
    """Set a custom database instance for unit and integration testing.

    The environment defaults to the configured default environment.
    """
    env = env or get_settings().DEFAULT_ENVIRONMENT
    if db_manager.clients.get(env) is not None and mock_db is None:
        close = getattr(db_manager.clients[env], "close", None)
        if close:
            close()
        db_manager.clients.pop(env, None)
    db_manager.dbs[env] = mock_db
