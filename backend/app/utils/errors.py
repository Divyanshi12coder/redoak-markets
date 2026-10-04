"""Domain exceptions that map cleanly onto HTTP responses."""
from __future__ import annotations


class AppError(Exception):
    status_code = 500
    code = "internal_error"

    def __init__(self, message: str, *, retry_after: int | None = None):
        super().__init__(message)
        self.message = message
        self.retry_after = retry_after


class SymbolNotFoundError(AppError):
    status_code = 404
    code = "symbol_not_found"


class RateLimitedError(AppError):
    status_code = 429
    code = "rate_limited"


class ProviderError(AppError):
    status_code = 502
    code = "provider_error"


class ProviderNotConfiguredError(AppError):
    status_code = 503
    code = "provider_not_configured"


class InsufficientDataError(AppError):
    status_code = 422
    code = "insufficient_data"


class InvalidTickerError(AppError):
    status_code = 422
    code = "invalid_ticker"
