from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.auth.security import MAX_PASSWORD_BYTES


def _check_password(v: str) -> str:
    if len(v.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError(f"Password must be at most {MAX_PASSWORD_BYTES} bytes long")
    return v


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128, description="8-72 bytes; never stored in plaintext")

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be blank")
        return v

    @field_validator("email")
    @classmethod
    def _lower_email(cls, v: str) -> str:
        return v.lower()

    @field_validator("password")
    @classmethod
    def _password_bytes(cls, v: str) -> str:
        return _check_password(v)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def _lower_email(cls, v: str) -> str:
        return v.lower()


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class PreferencesOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    default_range: str
    chart_type: str
    indicators: list[str]


class PreferencesIn(BaseModel):
    default_range: str = Field(pattern=r"^(1D|5D|1M|3M|6M|1Y|5Y)$")
    chart_type: str = Field(pattern=r"^(candles|line|area)$")
    indicators: list[str] = Field(max_length=12)

    @field_validator("indicators")
    @classmethod
    def _known(cls, v: list[str]) -> list[str]:
        allowed = {"sma20", "sma50", "sma200", "ema20", "ema50", "bollinger", "rsi", "macd", "volume"}
        bad = [i for i in v if i not in allowed]
        if bad:
            raise ValueError(f"Unknown indicator(s): {', '.join(bad)}")
        return list(dict.fromkeys(v))


class ProfileOut(BaseModel):
    user: UserOut
    preferences: PreferencesOut
    recent_tickers: list[str]


class HistoryItemOut(BaseModel):
    ticker: str
    analyzed_at: datetime


class MlHistoryItemOut(BaseModel):
    ticker: str
    model_version: str
    regime: str
    confidence: float
    volatility_regime: str
    anomaly_detected: bool
    data_source: str
    analyzed_at: datetime
