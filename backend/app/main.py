"""
Talakunchi Networks — Intern Management System Backend
FastAPI application entry point.
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth, interns, tasks, handovers, departments, admin, audit, notifications, projects, approvals, daily_logs

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


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Baseline hardening headers on every response."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
    if settings.ENVIRONMENT == "production":
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response

# Register routers
app.include_router(auth.router)
app.include_router(interns.router)
app.include_router(tasks.router)
app.include_router(handovers.router)
app.include_router(departments.router)
app.include_router(projects.router)
app.include_router(approvals.router)
app.include_router(daily_logs.router)
app.include_router(admin.router)
app.include_router(audit.router)
app.include_router(notifications.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "intern-management-backend"}
