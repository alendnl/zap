from app.config import Settings
from app.db.mongodb import get_request_environment
from fastapi import Request


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