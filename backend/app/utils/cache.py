"""A small thread-safe TTL cache with stale-on-error fallback and per-key single flight."""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Callable, Generic, TypeVar

from app.utils.errors import AppError

T = TypeVar("T")


@dataclass
class CacheResult(Generic[T]):
    value: T
    fetched_at: float
    stale: bool = False


class StaleCache:
    """Caches loader results.

    * Fresh entries (younger than ``ttl``) are returned without calling the loader.
    * If the loader fails with a provider/rate-limit error, an expired entry younger
      than ``stale_ttl`` is returned flagged as stale instead of breaking the UI.
    * Concurrent requests for the same key share one loader call.
    """

    def __init__(self, stale_ttl: float = 6 * 3600, max_entries: int = 512):
        self._data: dict[str, tuple[float, object]] = {}
        self._locks: dict[str, threading.Lock] = {}
        self._guard = threading.Lock()
        self._stale_ttl = stale_ttl
        self._max_entries = max_entries

    def _lock_for(self, key: str) -> threading.Lock:
        with self._guard:
            return self._locks.setdefault(key, threading.Lock())

    def get_or_load(self, key: str, ttl: float, loader: Callable[[], T]) -> CacheResult[T]:
        entry = self._data.get(key)
        if entry and time.time() - entry[0] < ttl:
            return CacheResult(entry[1], entry[0])  # type: ignore[arg-type]

        with self._lock_for(key):
            entry = self._data.get(key)
            now = time.time()
            if entry and now - entry[0] < ttl:
                return CacheResult(entry[1], entry[0])  # type: ignore[arg-type]
            try:
                value = loader()
            except AppError:
                if entry and now - entry[0] < self._stale_ttl:
                    return CacheResult(entry[1], entry[0], stale=True)  # type: ignore[arg-type]
                raise
            self._store(key, value)
            return CacheResult(value, time.time())

    def get_fresh(self, key: str, ttl: float) -> CacheResult | None:
        entry = self._data.get(key)
        if entry and time.time() - entry[0] < ttl:
            return CacheResult(entry[1], entry[0])
        return None

    def get_stale(self, key: str) -> CacheResult | None:
        entry = self._data.get(key)
        if entry and time.time() - entry[0] < self._stale_ttl:
            return CacheResult(entry[1], entry[0], stale=True)
        return None

    def put(self, key: str, value: object) -> None:
        self._store(key, value)

    def _store(self, key: str, value: object) -> None:
        with self._guard:
            if len(self._data) >= self._max_entries:
                oldest = min(self._data, key=lambda k: self._data[k][0])
                self._data.pop(oldest, None)
            self._data[key] = (time.time(), value)

    def clear(self) -> None:
        with self._guard:
            self._data.clear()
