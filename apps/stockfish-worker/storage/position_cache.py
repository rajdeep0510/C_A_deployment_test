from typing import Any, Optional, Tuple


class PositionCache:
    """
    In-memory cache keyed by (zobrist_hash, multipv).
    Shared across all games in a server process — opening positions repeat
    across thousands of games so this eliminates redundant engine calls.
    """

    def __init__(self, max_size: int = 50_000):
        self._cache: dict[Tuple[int, int], Any] = {}
        self._max_size = max_size

    def get(self, zobrist_hash: int, multipv: int) -> Optional[Any]:
        return self._cache.get((zobrist_hash, multipv))

    def put(self, zobrist_hash: int, multipv: int, value: Any) -> None:
        if len(self._cache) >= self._max_size:
            # Evict oldest half when full (simple strategy, avoids LRU overhead)
            keys = list(self._cache.keys())
            for k in keys[: len(keys) // 2]:
                del self._cache[k]
        self._cache[(zobrist_hash, multipv)] = value

    def __len__(self) -> int:
        return len(self._cache)
