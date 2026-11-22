"""Deterministic research plan: which web searches a brief needs."""

from collections.abc import Iterable
from dataclasses import dataclass

from vows_n_knots.brief import StructuredBrief
from vows_n_knots.config.research import COST_REFERENCE_YEAR

COST_CATEGORIES: tuple[str, ...] = (
    "venue",
    "catering",
    "photography",
    "videography",
    "music",
    "flowers",
    "attire",
    "cake",
    "transport",
    "invitations",
)


@dataclass(frozen=True)
class ResearchTask:
    section: str
    category: str
    query: str
    cache_class: str  # "availability" or "price"
    include_domains: tuple[str, ...] = ()


def research_search_count(priorities: Iterable[str]) -> int:
    """How many searches the research plan runs for these priorities.

    Only the priorities decide the count: each selected section adds a fixed number of tasks.
    A test checks this against build_research_tasks, so the two cannot drift apart.
    """
    selected = set(priorities)
    count = 0
    if "Venue shortlist" in selected:
        count += 1
    if "Vendor research" in selected:
        count += 3  # catering, photography, music
    if "Budget allocation" in selected:
        count += len(COST_CATEGORIES)
    if "Travel logistics" in selected:
        count += 1
    return count


def count_research_searches(brief: StructuredBrief) -> int:
    """How many searches the research plan runs for this brief."""
    return research_search_count(brief.priorities)


def build_research_tasks(brief: StructuredBrief) -> list[ResearchTask]:
    where = f"{brief.city_name} {brief.state_name}"
    guests = brief.guest_count
    dietary = " ".join(brief.dietary) or "full-service"
    selected = set(brief.priorities)
    tasks: list[ResearchTask] = []

    if "Venue shortlist" in selected:
        tasks.append(ResearchTask(
            "Venue shortlist", "venue",
            f"{where} wedding venues capacity {guests} guests {brief.indoor_outdoor} "
            f"within {brief.max_travel_minutes} minutes of downtown",
            "availability",
        ))
    if "Vendor research" in selected:
        tasks += [
            ResearchTask("Vendor research", "catering",
                         f"{where} wedding catering {dietary} {guests} guests", "availability"),
            ResearchTask("Vendor research", "photography",
                         f"{where} wedding photographers {brief.season} {brief.wedding_year}", "availability"),
            ResearchTask("Vendor research", "music",
                         f"{where} wedding live music bands DJ {brief.wedding_year}", "availability"),
        ]
    if "Budget allocation" in selected:
        tasks += [
            ResearchTask("Budget allocation", category,
                         f"{where} average wedding {category} cost {COST_REFERENCE_YEAR}", "price")
            for category in COST_CATEGORIES
        ]
    if "Travel logistics" in selected:
        tasks.append(ResearchTask(
            "Travel logistics", "transport",
            f"{where} wedding guest shuttle transportation {guests} guests",
            "availability",
        ))
    return tasks
