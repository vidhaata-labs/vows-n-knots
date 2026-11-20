"""Turn the brief and search results into a prompt for the synthesis model, and run it."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime, timezone
from typing import Any

from langchain.messages import AnyMessage, HumanMessage, SystemMessage

from vows_n_knots.config.research import SYNTHESIS_SNIPPET_CHARS
from vows_n_knots.prompts import SYNTHESIS_SYSTEM_PROMPT
from vows_n_knots.search import TaskResult


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


class SynthesisError(RuntimeError):
    """The synthesis model returned a truncated or empty plan."""


def synthesize(model: Any, brief_text: str, results: Sequence[TaskResult]) -> str:
    response = model.invoke(build_messages(brief_text, results))
    finish_reason = (getattr(response, "response_metadata", None) or {}).get("finish_reason")
    if finish_reason == "length":
        raise SynthesisError("The plan was cut off at the model's output limit.")
    content = response.content
    if isinstance(content, str):
        text = content
    else:
        text = "".join(
            part if isinstance(part, str) else part.get("text", "")
            for part in content
            if isinstance(part, str) or part.get("type") == "text"
        )
    if not text.strip():
        raise SynthesisError("The model returned no text for the plan.")
    return text
