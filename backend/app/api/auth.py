import uuid
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from jose import jwt, JWTError
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.database import get_db
from app.models import User
from app.core.security import verify_password, get_password_hash, create_access_token, SECRET_KEY, ALGORITHM
from app.core.config import get_settings

settings = get_settings()

# Per-IP rate limiter for auth endpoints. In-memory; swap to Redis backend
# (slowapi supports it) before scaling beyond a single instance.
auth_limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

class Token(BaseModel):
    access_token: str
    token_type: str

class UserCreate(BaseModel):
    username: str
    password: str

async def get_current_user(token: str = Depends(oauth2_scheme), session: AsyncSession = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise credentials_exception

    stmt = select(User).where(User.id == user_uuid)
    res = await session.execute(stmt)
    user = res.scalars().first()
    if user is None:
        raise credentials_exception

    # Auto-promote user if listed in ADMIN_USERNAMES env var
    if user.username.lower() in settings.admin_usernames_set and not user.is_admin:
        user.is_admin = True
        await session.commit()

    return user

@router.post("/signup", response_model=Token)
@auth_limiter.limit("3/minute")
async def signup(
    request: Request,
    user_req: UserCreate,
    session: AsyncSession = Depends(get_db),
):
    # Check if username exists
    stmt = select(User).where(User.username == user_req.username)
    res = await session.execute(stmt)
    if res.scalars().first():
        raise HTTPException(status_code=400, detail="Username already registered")
        
    is_admin = user_req.username.lower() in settings.admin_usernames_set
    new_user = User(
        username=user_req.username,
        password_hash=get_password_hash(user_req.password),
        is_admin=is_admin,
    )
    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)
    
    access_token = create_access_token(data={"sub": str(new_user.id)})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login", response_model=Token)
@auth_limiter.limit("5/minute")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_db),
):
    stmt = select(User).where(User.username == form_data.username)
    res = await session.execute(stmt)
    user = res.scalars().first()
    
    if not user or not user.password_hash:
        raise HTTPException(status_code=400, detail="Incorrect username or password")
        
    if not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
        
    # Auto-promote user if listed in ADMIN_USERNAMES env var
    if user.username.lower() in settings.admin_usernames_set and not user.is_admin:
        user.is_admin = True
        await session.commit()

    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}
