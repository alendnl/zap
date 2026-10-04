from app.config import Settings
from app.db.mongodb import get_request_environment
from fastapi import Request
from fastapi.testclient import TestClient
from pydantic_settings import SettingsConfigDict


class CORSSettings(Settings):
    model_config = SettingsConfigDict(env_file=None, extra="allow")


def _cors_test_client():
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    settings = CORSSettings()
    test_app = FastAPI()
    test_app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_origin_regex=settings.CORS_ORIGIN_REGEX,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    return TestClient(test_app)


def test_vercel_frontend_origin_passes_cors_preflight():
    response = _cors_test_client().options(
        "/api/v1/submissions",
        headers={
            "Origin": "https://codezap-arena.vercel.app",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-zap-env",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://codezap-arena.vercel.app"


def test_vercel_preview_origin_passes_cors_preflight():
    response = _cors_test_client().options(
        "/api/v1/submissions",
        headers={
            "Origin": "https://codezap-arena-git-main-alendnl.vercel.app",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-zap-env",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://codezap-arena-git-main-alendnl.vercel.app"


def test_untrusted_origin_is_not_allowed_by_cors():
    response = _cors_test_client().options(
        "/api/v1/submissions",
        headers={
            "Origin": "https://attacker.example",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-zap-env",
        },
    )

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_qa_environment_config():
    config = Settings().get_environment_config("qa")
    assert config.database_name == "zap_platform_lower"
    assert config.queue_name == "zap-submissions-lower"


def test_production_environment_config():
    config = Settings().get_environment_config("production")
    assert config.database_name == "zap_platform_prod"
    assert config.queue_name == "zap-submissions"


def test_unknown_environment_defaults_to_production():
    config = Settings().get_environment_config("unknown")
    assert config.database_name == "zap_platform_prod"
    assert config.queue_name == "zap-submissions"


def test_request_environment_defaults_unknown_header_to_production():
    scope = {"type": "http", "headers": [(b"x-zap-env", b"staging")]}
    request = Request(scope)
    assert get_request_environment(request) == "production"