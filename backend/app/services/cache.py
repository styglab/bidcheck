from collections import OrderedDict
from collections.abc import Callable, Hashable
from time import monotonic
from typing import Any


class TTLCache:
    """Bounded process-local cache; expiry is checked on both reads and writes."""

    def __init__(self, max_entries: int, ttl: float, *, clock: Callable[[], float] = monotonic):
        self.max_entries = max_entries
        self.ttl = ttl
        self.clock = clock
        self._entries: OrderedDict[Hashable, tuple[float, Any]] = OrderedDict()

    def _expire(self) -> None:
        now = self.clock()
        for key in [key for key, (expires, _) in self._entries.items() if expires <= now]:
            del self._entries[key]

    def get(self, key: Hashable) -> Any:
        self._expire()
        entry = self._entries.get(key)
        return entry[1] if entry else None

    def set(self, key: Hashable, value: Any) -> None:
        self._expire()
        self._entries.pop(key, None)
        self._entries[key] = (self.clock() + self.ttl, value)
        while len(self._entries) > self.max_entries:
            self._entries.popitem(last=False)

    def clear(self) -> None:
        self._entries.clear()
