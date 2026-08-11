"""
Talakunchi Networks — Intern Management System Backend
FastAPI application entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth, interns, tasks, handovers, departments, admin, audit, notifications

app = FastAPI(
    title="Talakunchi Intern Management System",
    description="Secure, role-based intern management platform for Talakunchi Networks.",
    version="1.0.0",
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url=None,
)

# CORS — restrict to frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(interns.router)
app.include_router(tasks.router)
app.include_router(handovers.router)
app.include_router(departments.router)
app.include_router(admin.router)
app.include_router(audit.router)
app.include_router(notifications.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "intern-management-backend"}
