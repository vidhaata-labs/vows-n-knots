"""SQLite-backed cache for search responses, with a TTL per entry."""

from __future__ import annotations

import hashlib
import json
import re
import sqlite3
import time
from collections.abc import Mapping
from pathlib import Path

from vows_n_knots.config.logging_config import get_logger

logger = get_logger(__name__)

_WHITESPACE = re.compile(r"\s+")


def normalize_query(text: str) -> str:
    """Lowercase, drop double quotes, collapse whitespace and strip."""
    return _WHITESPACE.sub(" ", text.lower().replace('"', "")).strip()


def make_cache_key(query: str, search_params: Mapping[str, object], location_id: str) -> str:
    """Return a SHA-256 hex key for a normalized query, its params and the location."""
    payload = json.dumps(
        {"query": normalize_query(query), "params": dict(search_params), "location_id": location_id},
        sort_keys=True,
        default=str,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class SearchCache:
    """Key/response cache. If the database cannot be opened it stays disabled."""

    def __init__(self, path: Path | None):
        self._conn: sqlite3.Connection | None = None
        try:
            if path is None:
                target = ":memory:"
            else:
                path.parent.mkdir(parents=True, exist_ok=True)
                target = str(path)
            conn = sqlite3.connect(target, check_same_thread=False)
            try:
                conn.execute(
                    "CREATE TABLE IF NOT EXISTS searches ("
                    "key TEXT PRIMARY KEY, response TEXT NOT NULL, "
                    "stored_at REAL NOT NULL, expires_at REAL NOT NULL)"
                )
                conn.commit()
            except sqlite3.Error:
                conn.close()
                raise
            self._conn = conn
        except (sqlite3.Error, OSError) as exc:
            logger.warning("Search cache disabled, could not open %s: %s", path, exc)

    def get(self, key: str, now: float | None = None) -> dict | None:
        entry = self.get_entry(key, now)
        return None if entry is None else entry[0]

    def get_entry(self, key: str, now: float | None = None) -> tuple[dict, float] | None:
        """Return (response, stored_at) for a live entry, where stored_at is when it was written."""
        if self._conn is None:
            return None
        current = time.time() if now is None else now
        try:
            row = self._conn.execute(
                "SELECT response, stored_at, expires_at FROM searches WHERE key = ?", (key,)
            ).fetchone()
            if row is None or row[2] <= current:
                return None
            return json.loads(row[0]), row[1]
        except (sqlite3.Error, ValueError) as exc:
            logger.warning("Search cache read failed for key %s: %s", key, exc)
            return None

    def set(self, key: str, response: dict, ttl_seconds: int, now: float | None = None) -> None:
        if self._conn is None:
            return
        current = time.time() if now is None else now
        try:
            self._conn.execute(
                "INSERT OR REPLACE INTO searches (key, response, stored_at, expires_at) "
                "VALUES (?, ?, ?, ?)",
                (key, json.dumps(response), current, current + ttl_seconds),
            )
            self._conn.commit()
        except (sqlite3.Error, TypeError, ValueError) as exc:
            logger.warning("Search cache write failed for key %s: %s", key, exc)

    def close(self) -> None:
        if self._conn is not None:
            self._conn.close()
            self._conn = None
