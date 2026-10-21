"""Tiny in-memory sliding-window rate limiter (per process).

Good enough for a single instance; put a shared store (Redis) or a gateway limit in front
when running several replicas.
"""

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

from app.config import get_settings

_hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)


def reset() -> None:
    _hits.clear()


def rate_limit(name: str, limit: int, window_seconds: int):
    def dependency(request: Request) -> None:
        if not get_settings().rate_limit_enabled:
            return
        ip = request.client.host if request.client else "unknown"
        bucket = _hits[(name, ip)]
        now = time.monotonic()
        while bucket and now - bucket[0] > window_seconds:
            bucket.popleft()
        if len(bucket) >= limit:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Too many requests, please try again later.",
                headers={"Retry-After": str(window_seconds)},
            )
        bucket.append(now)

    return dependency
