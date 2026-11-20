"""Run research tasks against a search client, with caching, retries and bounded concurrency."""

from __future__ import annotations

import asyncio
import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Any

from vows_n_knots.cache import SearchCache, make_cache_key
from vows_n_knots.config.logging_config import get_logger
from vows_n_knots.config.research import (
    CONCURRENCY,
    MAX_RESULTS,
    RETRIES,
    SEARCH_DEPTH,
    TTL_AVAILABILITY_SECONDS,
    TTL_PRICE_SECONDS,
)
from vows_n_knots.research import ResearchTask

logger = get_logger(__name__)


@dataclass(frozen=True)
class TaskResult:
    task: ResearchTask
    status: str  # "ok", "cached" or "failed"
    response: dict | None
    error: str | None
    seconds: float
    retrieved_at: float | None = None  # Unix time of the search; the stored time for "cached"


async def run_tasks(
    tasks: Sequence[ResearchTask],
    client: Any,
    cache: SearchCache | None,
    location_id: str,
    *,
    concurrency: int = CONCURRENCY,
    retries: int = RETRIES,
    retry_delay: float = 1.0,
    on_event: Callable[[str, str], None] | None = None,
) -> list[TaskResult]:
    """Run every task and return one result per task, in input order. Never raises per task."""
    semaphore = asyncio.Semaphore(concurrency)

    def emit(event: str, detail: str) -> None:
        if on_event is None:
            return
        try:
            on_event(event, detail)
        except Exception as exc:
            logger.warning("on_event callback failed for %s: %s", event, exc)

    async def run_one(task: ResearchTask) -> TaskResult:
        started = time.monotonic()
        emit("task_started", task.query)
        result = await _execute(task, started)
        if result.status == "failed":
            logger.warning(
                "Task [%s] %r: failed: %s", task.section, task.query, result.error
            )
        else:
            urls = [
                item.get("url", "")
                for item in (result.response or {}).get("results") or []
                if isinstance(item, dict)
            ]
            logger.info(
                "Task [%s] %r: %s, urls: %s", task.section, task.query, result.status, urls
            )
        emit("task_finished", result.status)
        return result

    async def _execute(task: ResearchTask, started: float) -> TaskResult:
        params = {
            "search_depth": SEARCH_DEPTH,
            "max_results": MAX_RESULTS,
            "include_domains": sorted(task.include_domains),
        }
        key = make_cache_key(task.query, params, location_id)
        if cache is not None:
            try:
                hit = cache.get_entry(key)
            except Exception as exc:
                logger.warning("Cache read failed for %r, treating as a miss: %s", task.query, exc)
                hit = None
            if hit is not None:
                response, stored_at = hit
                return TaskResult(
                    task, "cached", response, None, time.monotonic() - started, stored_at
                )

        ttl = TTL_PRICE_SECONDS if task.cache_class == "price" else TTL_AVAILABILITY_SECONDS
        async with semaphore:
            last_error = ""
            for attempt in range(retries + 1):
                try:
                    searched_at = time.time()
                    response = await client.search(
                        query=task.query,
                        search_depth=SEARCH_DEPTH,
                        max_results=MAX_RESULTS,
                        include_domains=list(task.include_domains) or None,
                    )
                except Exception as exc:
                    last_error = f"{type(exc).__name__}: {exc}"
                    logger.warning(
                        "Search attempt %d/%d failed for %r: %s",
                        attempt + 1, retries + 1, task.query, last_error,
                    )
                    if attempt < retries:
                        await asyncio.sleep(retry_delay)
                    continue
                if cache is not None:
                    try:
                        cache.set(key, response, ttl, now=searched_at)
                    except Exception as exc:
                        logger.warning("Cache write failed for %r: %s", task.query, exc)
                return TaskResult(
                    task, "ok", response, None, time.monotonic() - started, searched_at
                )
        return TaskResult(task, "failed", None, last_error, time.monotonic() - started)

    return list(await asyncio.gather(*(run_one(task) for task in tasks)))
