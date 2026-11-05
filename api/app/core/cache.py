import time
import threading
from copy import deepcopy
from typing import Any, Optional

_MAX_SIZE = 2000

_store: dict[str, tuple[Any, float]] = {}
_lock = threading.Lock()


def cache_get(key: str) -> Optional[Any]:
    with _lock:
        item = _store.get(key)
        if item is None:
            return None
        value, expires_at = item
        if expires_at < time.monotonic():
            _store.pop(key, None)
            return None
        return deepcopy(value)


def cache_set(key: str, value: Any, ttl: int = 300) -> None:
    with _lock:
        if len(_store) >= _MAX_SIZE:
            _store.pop(next(iter(_store)), None)  # грубая эвикция
        _store[key] = (deepcopy(value), time.monotonic() + ttl)


def cache_invalidate(prefix: str = "") -> None:
    """Удаляет все ключи с указанным префиксом (или всё, если prefix='')."""
    with _lock:
        if not prefix:
            _store.clear()
            return
        for k in [k for k in _store if k.startswith(prefix)]:
            _store.pop(k, None)


def cache_stats() -> dict:
    with _lock:
        return {"size": len(_store), "max_size": _MAX_SIZE}