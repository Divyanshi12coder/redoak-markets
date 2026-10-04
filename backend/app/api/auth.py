from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import DbSession, client_ip
from app.auth.security import burn_password_check, create_access_token, hash_password, verify_password
from app.models import User, UserPreferences, Watchlist
from app.schemas.auth import LoginIn, RegisterIn, TokenOut
from app.utils.ratelimit import KeyedLimiter

router = APIRouter(prefix="/api/auth", tags=["auth"])

# 10 attempts per minute per client IP for both endpoints (brute-force / enumeration friction).
_limiter = KeyedLimiter(limit=10, window=60)


def reset_limiter() -> None:
    _limiter.reset()


def _throttle(request: Request) -> None:
    _limiter.check(client_ip(request))


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(_throttle)], summary="Create an account")
def register(body: RegisterIn, db: DbSession) -> TokenOut:
    if db.scalar(select(User.id).where(User.email == body.email)):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="An account with this email already exists.")
    user = User(name=body.name, email=body.email, password_hash=hash_password(body.password))
    user.watchlist = Watchlist()
    user.preferences = UserPreferences()
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # lost a race with a concurrent registration
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, detail="An account with this email already exists.")
    token, expires = create_access_token(user.id)
    return TokenOut(access_token=token, expires_in=expires, user=user)  # type: ignore[arg-type]


@router.post("/login", response_model=TokenOut, dependencies=[Depends(_throttle)], summary="Log in")
def login(body: LoginIn, db: DbSession) -> TokenOut:
    user = db.scalar(select(User).where(User.email == body.email))
    if user is None:
        burn_password_check(body.password)  # keep response time similar for unknown emails
        ok = False
    else:
        ok = verify_password(body.password, user.password_hash)
    if not ok or user is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token, expires = create_access_token(user.id)
    return TokenOut(access_token=token, expires_in=expires, user=user)  # type: ignore[arg-type]
