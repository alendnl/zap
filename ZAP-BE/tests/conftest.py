import pytest
from app.submissions.rate_limiter import get_submission_rate_limiter


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    get_submission_rate_limiter().reset()
    yield
    get_submission_rate_limiter().reset()
