import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.api.auth import auth_limiter
from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.generations import router as generations_router
from app.api.editor import router as editor_router
from app.api.admin import router as admin_router
from app.api.users import router as users_router
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Sentry — only initialize if SENTRY_DSN is set (i.e. in production).
# In dev/local, this is a no-op so you don't have to create a Sentry project
# just to run the app. Set SENTRY_DSN in your .env / prod secrets manager.
_sentry_dsn = os.getenv("SENTRY_DSN")
if _sentry_dsn:
    import sentry_sdk
    sentry_sdk.init(
        dsn=_sentry_dsn,
        environment=os.getenv("ENVIRONMENT", "development"),
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        # Don't send PII by default. Resumes, draft text, and chat history
        # are user-generated content — must never end up in error reports.
        send_default_pii=False,
        before_send=lambda event, hint: event,  # placeholder for future scrubbing
    )
    logger.info("Sentry error reporting initialized.")
else:
    logger.info("SENTRY_DSN not set — error reporting disabled.")

# CSP & security headers: applied via custom middleware below
# (Starlette removed its built-in SecurityMiddleware in newer versions.)
CSP_DIRECTIVES = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "img-src 'self' data:; "
    "connect-src 'self'; "
    "font-src 'self' https://fonts.gstatic.com; "
    "frame-ancestors 'none'; "
    "base-uri 'self';"
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting PostCraft AI backend...")
    yield
    logger.info("Shutting down PostCraft AI backend...")

app = FastAPI(
    title="PostCraft AI",
    version="0.1.0",
    lifespan=lifespan
)

# Wire slowapi's limiter state into the app so decorators can track state.
app.state.limiter = auth_limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- Security middleware stack ---

# 1. TrustedHostMiddleware — prevent HTTP Host header attacks
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.ALLOWED_HOSTS,
)

# 2. Custom security headers middleware (CSP, X-Content-Type-Options, etc.)
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = CSP_DIRECTIVES
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

# 3. CORS — must be last so it can short-circuit preflight
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(generations_router)
app.include_router(editor_router)
app.include_router(admin_router)
app.include_router(users_router)
