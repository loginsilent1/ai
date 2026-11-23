from __future__ import annotations

from typing import TypedDict


class SearchResult(TypedDict):
    title: str
    url: str
    snippet: str


def search_web(query: str) -> list[SearchResult]:
    """Fetch a small set of current public web results; never persist the query/results."""
    try:
        from ddgs import DDGS

        raw_results = DDGS(timeout=8).text(query, max_results=4)
        results: list[SearchResult] = []
        for item in raw_results or []:
            title = str(item.get("title", "")).strip()
            url = str(item.get("href", item.get("url", ""))).strip()
            snippet = str(item.get("body", item.get("snippet", ""))).strip()
            if not title or not url.startswith(("https://", "http://")):
                continue
            results.append(
                {"title": title[:240], "url": url[:2048], "snippet": snippet[:1200]}
            )
        return results
    except Exception:  # noqa: BLE001 — search is optional and should fail closed.
        # Search is optional: the assistant can still respond while clearly noting that
        # live search was unavailable. Avoid logging query text or third-party errors.
        return []
