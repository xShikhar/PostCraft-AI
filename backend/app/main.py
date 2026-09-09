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
#
# Note: `'unsafe-inline'` is allowed for `style-src` to support shadcn/ui's
# generated styles. We do NOT allow `'unsafe-inline'` for `script-src` — all
# our scripts are bundled by Next.js. If you embed third-party widgets, you'll
# need a nonce-based CSP.
IS_PROD = settings.ENVIRONMENT == "production"
CSP_DIRECTIVES = (
    "default-src 'self'; "
    "script-src 'self'; "
    f"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com{' https://cdn.tailwindcss.com' if not IS_PROD else ''}; "
    "img-src 'self' data: https:; "
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
    lifespan=lifespan,
)

# Wire slowapi's limiter state into the app so decorators can track state.
app.state.limiter = auth_limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- Security middleware stack ---

# 1. TrustedHostMiddleware — prevent HTTP Host header attacks
# TrustedHostMiddleware in Starlette is FINICKY: setting it after CORS or other
# middlewares means its 400 short-circuits CORS preflights. Wire it FIRST.
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.allowed_hosts_list,
)

# 2. Custom security headers middleware (CSP, X-Content-Type-Options, etc.)
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = CSP_DIRECTIVES
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # Disable powerful browser features we don't need.
    response.headers["Permissions-Policy"] = (
        "camera=(), microphone=(), geolocation=(), payment=()"
    )
    return response

# 3. CORS — must be last so it can short-circuit preflight
#    CORS_ORIGINS comes from settings; never use "*" with allow_credentials=True.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(generations_router)
app.include_router(editor_router)
app.include_router(admin_router)
app.include_router(users_router)
