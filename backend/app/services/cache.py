import asyncio
from collections import OrderedDict
from collections.abc import Awaitable, Callable, Hashable
from copy import deepcopy
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

    def set(self, key: Hashable, value: Any, *, ttl: float | None = None) -> None:
        self._expire()
        self._entries.pop(key, None)
        self._entries[key] = (self.clock() + (self.ttl if ttl is None else ttl), value)
        while len(self._entries) > self.max_entries:
            self._entries.popitem(last=False)

    def clear(self) -> None:
        self._entries.clear()


class AsyncTTLCache(TTLCache):
    """Share concurrent reads and cache values, while never caching exceptions."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._pending: dict[Hashable, asyncio.Task] = {}

    async def get_or_load(
        self,
        key: Hashable,
        loader: Callable[[], Awaitable[Any]],
        *,
        refresh: bool = False,
        ttl_for: Callable[[Any], float] | None = None,
    ):
        cached = self.get(key)
        if cached is not None and not refresh:
            return deepcopy(cached)
        task = self._pending.get(key)
        if task is None:

            async def load():
                try:
                    value = await loader()
                    self.set(key, deepcopy(value), ttl=ttl_for(value) if ttl_for else None)
                    return value
                finally:
                    self._pending.pop(key, None)

            task = asyncio.create_task(load())
            self._pending[key] = task
            # A cancelled waiter must not leave an unobserved background exception.
            task.add_done_callback(lambda done: None if done.cancelled() else done.exception())
        return deepcopy(await asyncio.shield(task))

    async def close(self):
        tasks = list(self._pending.values())
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
