from __future__ import annotations

import sqlite3
from datetime import UTC, datetime
from pathlib import Path


class UsageStore:
    """Small persistent daily request counter. Use Redis for a multi-instance deployment."""

    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        connection = self._connect()
        try:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS daily_usage (
                    user_id TEXT NOT NULL,
                    usage_day TEXT NOT NULL,
                    request_count INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (user_id, usage_day)
                )
                """
            )
        finally:
            connection.close()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=10, isolation_level=None)
        connection.execute("PRAGMA busy_timeout = 10000")
        return connection

    @staticmethod
    def _today() -> str:
        return datetime.now(UTC).date().isoformat()

    def reserve(
        self, user_id: str, limit: int, usage_day: str | None = None
    ) -> int | None:
        """Atomically consume one request; return remaining quota, or None at the limit."""
        day = usage_day or self._today()
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            connection.execute(
                "INSERT OR IGNORE INTO daily_usage (user_id, usage_day, request_count) VALUES (?, ?, 0)",
                (user_id, day),
            )
            row = connection.execute(
                "SELECT request_count FROM daily_usage WHERE user_id = ? AND usage_day = ?",
                (user_id, day),
            ).fetchone()
            used = int(row[0]) if row else 0
            if used >= limit:
                connection.execute("ROLLBACK")
                return None
            used += 1
            connection.execute(
                "UPDATE daily_usage SET request_count = ? WHERE user_id = ? AND usage_day = ?",
                (used, user_id, day),
            )
            connection.execute("COMMIT")
            return max(0, limit - used)
        except Exception:
            if connection.in_transaction:
                connection.execute("ROLLBACK")
            raise
        finally:
            connection.close()

    def remaining(self, user_id: str, limit: int, usage_day: str | None = None) -> int:
        day = usage_day or self._today()
        connection = self._connect()
        try:
            row = connection.execute(
                "SELECT request_count FROM daily_usage WHERE user_id = ? AND usage_day = ?",
                (user_id, day),
            ).fetchone()
        finally:
            connection.close()
        used = int(row[0]) if row else 0
        return max(0, limit - used)
