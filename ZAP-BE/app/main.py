from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.db.mongodb import get_database_for_env
from app.questions.router import router as questions_router
from app.submissions.router import router as submissions_router

settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        get_database_for_env(settings.DEFAULT_ENVIRONMENT)
    except Exception:
        pass
    yield

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health endpoint
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "ZAP-BE",
        "environment": settings.ENVIRONMENT
    }

# Include Question CRUD and Submission routers
app.include_router(questions_router)
app.include_router(submissions_router)
