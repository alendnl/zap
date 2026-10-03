from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.questions.router import router as questions_router
from app.submissions.router import router as submissions_router
from executor.tasks.handler import router as executor_tasks_router

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
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

# Include executor task consumer (Cloud Tasks HTTP target)
app.include_router(executor_tasks_router)
