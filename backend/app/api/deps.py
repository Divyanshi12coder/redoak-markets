"""Shared FastAPI dependencies."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Path, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.security import decode_access_token
from app.database.session import get_db
from app.models import User
from app.services.analysis import AnalysisService
from app.services.container import get_analysis_service, get_market_service
from app.services.market import MarketDataService, RANGES
from app.utils.tickers import normalise_ticker

bearer = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]


def _user_from_credentials(creds: HTTPAuthorizationCredentials | None, db: Session) -> User | None:
    if creds is None or creds.scheme.lower() != "bearer":
        return None
    user_id = decode_access_token(creds.credentials)
    return db.get(User, user_id) if user_id is not None else None


def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)], db: DbSession
) -> User:
    user = _user_from_credentials(creds, db)
    if user is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required or session expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_optional_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)], db: DbSession
) -> User | None:
    return _user_from_credentials(creds, db)


def valid_ticker(ticker: Annotated[str, Path(description="Ticker symbol, e.g. AAPL", max_length=12)]) -> str:
    return normalise_ticker(ticker)


def valid_range(
    range: Annotated[str, Query(description="One of " + ", ".join(RANGES), pattern=r"^(1D|5D|1M|3M|6M|1Y|5Y)$")] = "6M",
) -> str:
    return range


def client_ip(request: Request) -> str:
    # Behind Render/Vercel proxies the first X-Forwarded-For hop is the client.
    fwd = request.headers.get("x-forwarded-for")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]
Ticker = Annotated[str, Depends(valid_ticker)]
RangeParam = Annotated[str, Depends(valid_range)]
Analysis = Annotated[AnalysisService, Depends(get_analysis_service)]
Market = Annotated[MarketDataService, Depends(get_market_service)]
