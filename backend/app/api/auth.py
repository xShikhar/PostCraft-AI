import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response, Form
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field, field_validator
from jose import jwt, JWTError
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.core.database import get_db
from app.models import User, VectorDeletionJob
from app.core.security import verify_password, get_password_hash, create_access_token, SECRET_KEY, ALGORITHM
from app.core.config import get_settings

settings = get_settings()
TERMS_VERSION = "2026-10-15"

def rate_limit_key(request: Request) -> str:
    if request.url.path.startswith("/api/auth/"):
        return "ip:" + get_remote_address(request)
    parts = request.headers.get("authorization", "").split(None, 1)
    token = parts[1] if len(parts) == 2 and parts[0].lower() == "bearer" else ""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return "user:" + str(uuid.UUID(payload["sub"]))
    except (JWTError, ValueError, KeyError, TypeError, AttributeError):
        return "ip:" + get_remote_address(request)

auth_limiter = Limiter(key_func=rate_limit_key, storage_uri=settings.RATE_LIMIT_STORAGE_URI, headers_enabled=True)
router = APIRouter(prefix="/api/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

class Token(BaseModel):
    access_token: str
    token_type: str

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=255, pattern=r"^[a-zA-Z0-9_.@+\-]+$")
    password: str = Field(min_length=8, max_length=128)
    terms_version: str
    agreed_to_terms: bool
    remember_me: bool = False

    @field_validator("username", mode="before")
    @classmethod
    def normalize(cls, value):
        return value.strip().lower() if isinstance(value, str) else value

async def get_current_user(token: str = Depends(oauth2_scheme), session: AsyncSession = Depends(get_db)) -> User:
    invalid = HTTPException(status_code=401, detail="Could not validate credentials", headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = uuid.UUID(payload["sub"])
    except (JWTError, ValueError, KeyError, TypeError, AttributeError):
        raise invalid
    user = await session.get(User, user_id)
    if user is None or await session.get(VectorDeletionJob, user_id):
        raise invalid
    return user

@router.post("/signup", response_model=Token)
@auth_limiter.limit("3/minute")
async def signup(request: Request, response: Response, user_req: UserCreate, session: AsyncSession = Depends(get_db)):
    if not user_req.agreed_to_terms or user_req.terms_version != TERMS_VERSION:
        raise HTTPException(status_code=422, detail="Accept the current Privacy Policy and Terms to sign up.")
    if (await session.execute(select(User.id).where(func.lower(User.username) == user_req.username))).first():
        raise HTTPException(status_code=400, detail="Username already registered")
    user = User(username=user_req.username, password_hash=get_password_hash(user_req.password), is_admin=False,
                terms_version=TERMS_VERSION, terms_accepted_at=datetime.now(timezone.utc))
    session.add(user)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=400, detail="Username already registered") from None
    return {"access_token": create_access_token({"sub": str(user.id)}, timedelta(days=30 if user_req.remember_me else 7)), "token_type": "bearer"}

@router.post("/login", response_model=Token)
@auth_limiter.limit("5/minute")
async def login(request: Request, response: Response, form_data: OAuth2PasswordRequestForm = Depends(),
                remember_me: bool = Form(False), session: AsyncSession = Depends(get_db)):
    user = (await session.execute(select(User).where(func.lower(User.username) == form_data.username.strip().lower()))).scalars().first()
    if not user or not user.password_hash or len(form_data.password) > 128 or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    if await session.get(VectorDeletionJob, user.id):
        raise HTTPException(status_code=401, detail="Account deletion is in progress")
    return {"access_token": create_access_token({"sub": str(user.id)}, timedelta(days=30 if remember_me else 7)), "token_type": "bearer"}
