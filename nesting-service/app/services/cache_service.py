from __future__ import annotations

from dataclasses import dataclass, field
from time import time
from typing import Any


@dataclass(slots=True)
class CacheEntry:
    value: Any
    ts: float = field(default_factory=time)


class LocalCacheService:
    def __init__(self, max_items: int = 5000) -> None:
        self.max_items = max_items
        self._store: dict[str, CacheEntry] = {}

    def get(self, key: str):
        entry = self._store.get(key)
        return None if entry is None else entry.value

    def set(self, key: str, value: Any) -> None:
        if len(self._store) >= self.max_items:
            oldest = min(self._store.items(), key=lambda kv: kv[1].ts)[0]
            self._store.pop(oldest, None)
        self._store[key] = CacheEntry(value=value)
