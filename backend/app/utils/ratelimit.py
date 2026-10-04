"""Rate limiters: a blocking sliding-window limiter for provider credits and a
simple per-key limiter for sensitive endpoints such as login."""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from app.utils.errors import RateLimitedError


class CreditLimiter:
    """Sliding-window limiter measured in provider "credits" per minute.

    ``acquire`` waits (up to ``max_wait`` seconds) for capacity instead of failing
    immediately, which smooths short bursts. If capacity will not free up in time a
    ``RateLimitedError`` is raised with a ``retry_after`` hint.
    """

    def __init__(self, credits_per_minute: int, max_wait: float = 8.0, window: float = 60.0):
        self.capacity = max(1, credits_per_minute)
        self.max_wait = max_wait
        self.window = window
        self._events: deque[tuple[float, int]] = deque()
        self._lock = threading.Lock()

    def _used(self, now: float) -> int:
        while self._events and now - self._events[0][0] >= self.window:
            self._events.popleft()
        return sum(c for _, c in self._events)

    def acquire(self, credits: int = 1) -> None:
        credits = min(max(1, credits), self.capacity)
        deadline = time.monotonic() + self.max_wait
        while True:
            with self._lock:
                now = time.monotonic()
                used = self._used(now)
                if used + credits <= self.capacity:
                    self._events.append((now, credits))
                    return
                # Earliest moment enough credits will have expired.
                needed = used + credits - self.capacity
                freed, wait_until = 0, now
                for ts, c in self._events:
                    freed += c
                    wait_until = ts + self.window
                    if freed >= needed:
                        break
                wait = max(0.05, wait_until - now)
            if time.monotonic() + wait > deadline:
                raise RateLimitedError(
                    "The market-data provider request budget is exhausted. Please try again shortly.",
                    retry_after=int(wait) + 1,
                )
            time.sleep(min(wait, 1.0))


class KeyedLimiter:
    """Allow ``limit`` events per ``window`` seconds for each key (e.g. client IP)."""

    def __init__(self, limit: int, window: float):
        self.limit, self.window = limit, window
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            q = self._events[key]
            while q and now - q[0] >= self.window:
                q.popleft()
            if len(q) >= self.limit:
                raise RateLimitedError(
                    "Too many attempts. Please wait a minute and try again.",
                    retry_after=int(self.window - (now - q[0])) + 1,
                )
            q.append(now)

    def reset(self) -> None:
        with self._lock:
            self._events.clear()
