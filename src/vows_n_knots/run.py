"""Run a brief end to end: research searches, then synthesis into a plan."""

from __future__ import annotations

import asyncio
import os
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from vows_n_knots.adapters.model import create_chat_model
from vows_n_knots.brief import StructuredBrief, brief_to_text
from vows_n_knots.cache import SearchCache
from vows_n_knots.config.logging_config import get_logger
from vows_n_knots.config.research import (
    SYNTHESIS_MAX_OUTPUT_TOKENS,
    SYNTHESIS_TIMEOUT_SECONDS,
)
from vows_n_knots.config.settings import ConfigurationError, load_env
from vows_n_knots.research import build_research_tasks
from vows_n_knots.search import TaskResult, run_tasks
from vows_n_knots.synthesis import SynthesisStopped, write_plan

logger = get_logger(__name__)

# How many characters of plan text go by between "writing" progress events.
WRITING_REPORT_CHARS = 500


class BuildCancelled(RuntimeError):
    """The build was cancelled, for example because the browser left. No plan is returned."""


@dataclass(frozen=True)
class ProgressEvent:
    kind: str
    detail: str
    section: str = ""
    category: str = ""


@dataclass(frozen=True)
class RunSummary:
    searches: int
    cache_hits: int
    failed_tasks: int
    search_seconds: float
    model_seconds: float
    total_seconds: float


@dataclass(frozen=True)
class Plan:
    text: str
    section_status: dict[str, str]
    summary: RunSummary


class _CountingClient:
    """Wraps a search client and counts every call, retries included."""

    def __init__(self, client: Any):
        self._client = client
        self.calls = 0

    async def search(self, **kwargs: Any) -> Any:
        self.calls += 1
        return await self._client.search(**kwargs)


def _section_status(brief: StructuredBrief, results: list[TaskResult]) -> dict[str, str]:
    by_section: dict[str, list[TaskResult]] = {}
    for result in results:
        by_section.setdefault(result.task.section, []).append(result)

    status: dict[str, str] = {}
    for priority in brief.priorities:
        section_results = by_section.get(priority)
        if section_results is None:
            status[priority] = "planner only"
            continue
        failed = sum(1 for r in section_results if r.status == "failed")
        if failed == len(section_results):
            status[priority] = "no data"
        elif failed:
            status[priority] = "partial"
        else:
            status[priority] = "ok"
    return status


async def _run_searches(
    tasks: Any,
    client: Any,
    cache: Any,
    location_id: str,
    *,
    cancel: threading.Event | None,
    **kwargs: Any,
) -> Any:
    """Run the research tasks. A cancel stops new searches; searches already in flight finish."""
    should_stop = cancel.is_set if cancel is not None else None
    return await run_tasks(tasks, client, cache, location_id, should_stop=should_stop, **kwargs)


def run_plan(
    brief: StructuredBrief,
    *,
    on_progress: Callable[[ProgressEvent], None] | None = None,
    cache: SearchCache | None = None,
    search_client: Any | None = None,
    model: Any | None = None,
    retry_delay: float | None = None,
    cancel: threading.Event | None = None,
) -> Plan:
    """Research the brief and synthesize a plan. Must not be called inside a running event loop.

    `retry_delay` is a test seam: when set it overrides the search module's retry delay.
    """

    def emit(kind: str, detail: str = "", section: str = "", category: str = "") -> None:
        if on_progress is None:
            return
        try:
            on_progress(ProgressEvent(kind, detail, section, category))
        except Exception as exc:
            logger.warning("on_progress callback failed for %s: %s", kind, exc)

    started = time.monotonic()
    try:
        tasks = build_research_tasks(brief)
        if tasks and search_client is None:
            load_env()
            if not os.getenv("TAVILY_API_KEY"):
                raise ConfigurationError("TAVILY_API_KEY is not set, so web research cannot run.")
            from tavily import AsyncTavilyClient

            search_client = AsyncTavilyClient()

        counting = _CountingClient(search_client) if tasks else None
        extra = {} if retry_delay is None else {"retry_delay": retry_delay}

        search_started = time.monotonic()
        results = asyncio.run(_run_searches(
            tasks, counting, cache, brief.city_id,
            cancel=cancel,
            on_event=lambda kind, detail, task: emit(kind, detail, task.section, task.category),
            **extra,
        )) if tasks else []
        search_seconds = time.monotonic() - search_started

        if cancel is not None and cancel.is_set():
            raise BuildCancelled("Build cancelled before writing the plan.")
        emit("synthesis_started")
        if model is None:
            model = create_chat_model(
                max_output_tokens=SYNTHESIS_MAX_OUTPUT_TOKENS,
                timeout=SYNTHESIS_TIMEOUT_SECONDS,
            )
            # Hidden reasoning makes synthesis much slower; turn it off where supported.
            with_thinking_mode = getattr(model, "with_thinking_mode", None)
            if callable(with_thinking_mode):
                model = with_thinking_mode(enabled=False)
        model_started = time.monotonic()
        reported = 0

        def on_written(chars: int) -> None:
            # Report progress every WRITING_REPORT_CHARS characters, not on every token.
            nonlocal reported
            if chars - reported >= WRITING_REPORT_CHARS:
                reported = chars
                emit("writing", str(chars))

        try:
            text = write_plan(
                model, brief_to_text(brief), brief.priorities, results,
                should_stop=cancel.is_set if cancel is not None else None,
                on_progress=on_written,
            )
        except SynthesisStopped as exc:
            raise BuildCancelled("Build cancelled while writing the plan.") from exc
        model_seconds = time.monotonic() - model_started

        summary = RunSummary(
            searches=counting.calls if counting else 0,
            cache_hits=sum(1 for r in results if r.status == "cached"),
            failed_tasks=sum(1 for r in results if r.status == "failed"),
            search_seconds=search_seconds,
            model_seconds=model_seconds,
            total_seconds=time.monotonic() - started,
        )
        logger.info(
            "Run finished: %d searches, %d cache hits, %d failed tasks, "
            "search %.2fs, model %.2fs, total %.2fs",
            summary.searches, summary.cache_hits, summary.failed_tasks,
            summary.search_seconds, summary.model_seconds, summary.total_seconds,
        )
        plan = Plan(text, _section_status(brief, results), summary)
        emit("done")
        return plan
    except BuildCancelled as exc:
        logger.info("Run cancelled: %s", exc)
        emit("failed", "cancelled")
        raise
    except Exception as exc:
        logger.error("Run failed: %s", exc)
        emit("failed", str(exc))
        raise
