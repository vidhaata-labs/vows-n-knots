"""Turn the brief and search results into prompts for the synthesis model, and run them.

The plan is written in parts: a Summary, then one part per priority section. The parts run at the
same time, which is much faster than one long call. Each part starts with its own `##` heading, so
the joined text splits into the same sections the frontend shows.
"""

from __future__ import annotations

import threading
from collections.abc import Callable, Sequence
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any

from langchain.messages import AnyMessage, HumanMessage, SystemMessage

from vows_n_knots.config.research import SYNTHESIS_SNIPPET_CHARS
from vows_n_knots.prompts import SYNTHESIS_SYSTEM_PROMPT
from vows_n_knots.search import TaskResult

SUMMARY_SECTION = "Summary"


def format_results(
    results: Sequence[TaskResult], max_chars: int = SYNTHESIS_SNIPPET_CHARS
) -> str:
    """Group results by section (order of first appearance) as text for the model."""
    sections: dict[str, list[str]] = {}
    for result in results:
        lines = sections.setdefault(result.task.section, [])
        if result.response is None:
            lines.append(f"No data: {result.error}")
            continue
        if result.retrieved_at is not None:
            retrieved = datetime.fromtimestamp(result.retrieved_at, tz=timezone.utc)
            lines.append(f"Retrieved: {retrieved:%Y-%m-%d}")
        items = result.response.get("results")
        if not items:
            lines.append("No data: search returned no results")
            continue
        for item in items:
            content = item.get("content", "")
            if len(content) > max_chars:
                content = content[:max_chars] + "..."
            lines.append(f"- {item.get('title', '')}\n  URL: {item.get('url', '')}\n  {content}")
    return "\n\n".join(
        f"## {section}\n" + "\n".join(lines) for section, lines in sections.items()
    )


def build_messages(brief_text: str, results: Sequence[TaskResult]) -> list[AnyMessage]:
    human = f"# Brief\n{brief_text}\n\n# Research\n{format_results(results)}"
    return [SystemMessage(SYNTHESIS_SYSTEM_PROMPT), HumanMessage(human)]


def _part_instruction(section: str, has_research: bool) -> str:
    if section == SUMMARY_SECTION:
        return (
            'Write only the section "## Summary". It is a short overview for the couple: what they asked '
            "for, what the research found, and what to do next. The other sections are written separately, "
            "so do not write them."
        )
    instruction = (
        f'Write only the section "## {section}", starting with that heading. Do not write an introduction, '
        "a summary or other sections; they are written separately."
    )
    if not has_research:
        instruction += (
            " This section has no research, so write it from the brief only and do not invent "
            "venues, vendors or prices."
        )
    return instruction


def build_part_messages(
    brief_text: str, section: str, results: Sequence[TaskResult]
) -> list[AnyMessage]:
    """Messages for one part of the plan. The Summary sees all the research; a section sees its own."""
    if section == SUMMARY_SECTION:
        part_results = list(results)
    else:
        part_results = [r for r in results if r.task.section == section]
    has_research = bool(part_results)
    human = (
        f"# Brief\n{brief_text}\n\n# Research\n{format_results(part_results)}\n\n"
        f"# Task\n{_part_instruction(section, has_research)}"
    )
    return [SystemMessage(SYNTHESIS_SYSTEM_PROMPT), HumanMessage(human)]


class SynthesisError(RuntimeError):
    """The synthesis model returned a truncated or empty plan."""


class SynthesisStopped(RuntimeError):
    """The caller asked to stop while the plan was being written. The model call was closed."""


def _content_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    return "".join(
        part if isinstance(part, str) else part.get("text", "")
        for part in content
        if isinstance(part, str) or part.get("type") == "text"
    )


def synthesize(
    model: Any,
    brief_text: str,
    results: Sequence[TaskResult],
    *,
    should_stop: Callable[[], bool] | None = None,
    on_progress: Callable[[int], None] | None = None,
) -> str:
    """Write the whole plan in one call. The parallel path is `write_plan`."""
    return synthesize_messages(
        model, build_messages(brief_text, results), should_stop=should_stop, on_progress=on_progress
    )


def synthesize_messages(
    model: Any,
    messages: list[AnyMessage],
    *,
    should_stop: Callable[[], bool] | None = None,
    on_progress: Callable[[int], None] | None = None,
) -> str:
    """Write one piece of the plan, streaming the model's output.

    `should_stop` is checked before each piece of output. When it returns True the stream is
    closed, so the model stops generating, and SynthesisStopped is raised. `on_progress` gets
    the number of characters written so far, after each piece.
    """
    if not callable(getattr(model, "stream", None)):
        # A model without streaming cannot be stopped mid-call; the stop is checked before the call.
        if should_stop is not None and should_stop():
            raise SynthesisStopped("The plan was stopped before it was written.")
        response = model.invoke(messages)
        text = _content_text(response.content)
        finish_reason = (getattr(response, "response_metadata", None) or {}).get("finish_reason")
        if on_progress is not None:
            on_progress(len(text))
    else:
        pieces, finish_reason = _stream_pieces(model, messages, should_stop, on_progress)
        text = "".join(pieces)
    if finish_reason == "length":
        raise SynthesisError("The plan was cut off at the model's output limit.")
    if not text.strip():
        raise SynthesisError("The model returned no text for the plan.")
    return text


def write_plan(
    model: Any,
    brief_text: str,
    sections: Sequence[str],
    results: Sequence[TaskResult],
    *,
    should_stop: Callable[[], bool] | None = None,
    on_progress: Callable[[int], None] | None = None,
) -> str:
    """Write the plan as parallel parts (Summary, then each section in brief order) and join them.

    `on_progress` gets the total characters written across all parts. If one part fails, the
    other parts are stopped and the first error is raised. A stop from `should_stop` stops all
    parts and raises SynthesisStopped.
    """
    parts = [SUMMARY_SECTION, *sections]
    written: dict[str, int] = {}
    lock = threading.Lock()
    abort = threading.Event()

    def stop_requested() -> bool:
        return abort.is_set() or (should_stop is not None and should_stop())

    def report(part: str, chars: int) -> None:
        if on_progress is None:
            return
        # Called under the lock: the callback is not thread-safe and parts run in parallel.
        with lock:
            written[part] = chars
            on_progress(sum(written.values()))

    def write_part(part: str) -> str:
        return synthesize_messages(
            model,
            build_part_messages(brief_text, part, results),
            should_stop=stop_requested,
            on_progress=lambda chars: report(part, chars),
        )

    texts: dict[str, str] = {}
    first_error: BaseException | None = None
    with ThreadPoolExecutor(max_workers=len(parts)) as pool:
        futures = {pool.submit(write_part, part): part for part in parts}
        for future in as_completed(futures):
            try:
                texts[futures[future]] = future.result()
            except BaseException as exc:
                abort.set()
                if first_error is None:
                    first_error = exc
    if first_error is not None:
        raise first_error
    return "\n\n".join(texts[part] for part in parts)


def _stream_pieces(
    model: Any,
    messages: list[AnyMessage],
    should_stop: Callable[[], bool] | None,
    on_progress: Callable[[int], None] | None,
) -> tuple[list[str], str | None]:
    pieces: list[str] = []
    finish_reason: str | None = None
    written = 0
    stream = model.stream(messages)
    try:
        for chunk in stream:
            if should_stop is not None and should_stop():
                raise SynthesisStopped("The plan was stopped while it was being written.")
            piece = _content_text(chunk.content)
            if piece:
                pieces.append(piece)
                written += len(piece)
                if on_progress is not None:
                    on_progress(written)
            reason = (getattr(chunk, "response_metadata", None) or {}).get("finish_reason")
            if reason:
                finish_reason = reason
    finally:
        close = getattr(stream, "close", None)
        if callable(close):
            close()
    return pieces, finish_reason
