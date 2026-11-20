"""Structured wedding brief and the adapter from the legacy form payload."""

import re
import textwrap
from dataclasses import dataclass
from datetime import date
from typing import Any, Mapping, Sequence

from vows_n_knots.locations import US_STATES, Place, find_place

CURRENCIES = ("USD", "EUR", "GBP", "CAD", "AUD")
PRIORITY_OPTIONS = (
    "Venue shortlist",
    "Vendor research",
    "Budget allocation",
    "Guest experience",
    "Timeline",
    "Design direction",
    "Risk management",
    "Travel logistics",
)
DIETARY_KEYWORDS = ("vegetarian", "vegan", "gluten-free", "halal", "kosher")
DEFAULT_MAX_TRAVEL_MINUTES = 60

_MINUTES_RE = re.compile(r"(\d+)\s*minutes", re.IGNORECASE)
_STATE_BY_NAME = {name.lower(): code for code, name in US_STATES.items()}


class BriefError(ValueError):
    pass


@dataclass(frozen=True)
class StructuredBrief:
    couple_name: str
    state_code: str
    state_name: str
    city_id: str
    city_name: str
    wedding_date: date
    wedding_year: int
    season: str
    ceremony_type: str
    guest_count: int
    currency: str
    budget_low: int
    budget_high: int
    budget_per_guest: float
    priorities: tuple[str, ...]
    tone: str
    styles: tuple[str, ...]
    dietary: tuple[str, ...]
    indoor_outdoor: str
    max_travel_minutes: int
    must_haves: str
    constraints: str
    traditions: str


def _season(month: int) -> str:
    if month in (12, 1, 2):
        return "winter"
    if month in (3, 4, 5):
        return "spring"
    if month in (6, 7, 8):
        return "summer"
    return "fall"


def _resolve_place(location: str, places: Sequence[Place]) -> tuple[Place, str]:
    city, comma, state = (part.strip() for part in location.partition(","))
    if not comma or not city or not state:
        raise BriefError(f"Location must look like 'City, State': {location!r}")
    state_code = state.upper() if state.upper() in US_STATES else _STATE_BY_NAME.get(state.lower())
    if state_code is None:
        raise BriefError(f"Unknown US state: {state!r}")
    place = find_place(places, state_code, city)
    if place is None:
        raise BriefError(f"No place named {city!r} in {US_STATES[state_code]}")
    return place, state_code


def _indoor_outdoor(text: str) -> str:
    text = text.lower()
    if "indoor-outdoor" in text or ("indoor" in text and "outdoor" in text):
        return "indoor-outdoor"
    return "either"


def brief_from_legacy_form(form: Mapping[str, Any], places: Sequence[Place]) -> StructuredBrief:
    place, state_code = _resolve_place(form["wedding_location"], places)

    guest_count = form["guest_count"]
    if not 10 <= guest_count <= 1000:
        raise BriefError(f"Guest count must be 10 to 1000, got {guest_count}")

    budget_low, budget_high = form["budget_range"]
    if not 0 <= budget_low <= budget_high:
        raise BriefError(f"Invalid budget range: {budget_low} to {budget_high}")

    currency = form["currency"]
    if currency not in CURRENCIES:
        raise BriefError(f"Currency must be one of {CURRENCIES}, got {currency!r}")

    priorities = tuple(form["planning_priorities"])
    unknown = [p for p in priorities if p not in PRIORITY_OPTIONS]
    if unknown:
        raise BriefError(f"Unknown planning priorities: {unknown}")

    wedding_date = form["wedding_date"]
    must_haves = form["must_haves"]
    constraints = form["constraints"]
    minutes = _MINUTES_RE.search(constraints)

    return StructuredBrief(
        couple_name=form["couple_name"],
        state_code=state_code,
        state_name=US_STATES[state_code],
        city_id=place.place_id,
        city_name=form["wedding_location"].partition(",")[0].strip(),
        wedding_date=wedding_date,
        wedding_year=wedding_date.year,
        season=_season(wedding_date.month),
        ceremony_type=form["ceremony_type"],
        guest_count=guest_count,
        currency=currency,
        budget_low=budget_low,
        budget_high=budget_high,
        budget_per_guest=round((budget_low + budget_high) / 2 / guest_count, 2),
        priorities=priorities,
        tone=form["tone"],
        styles=tuple(form["wedding_styles"]),
        dietary=tuple(k for k in DIETARY_KEYWORDS if k in must_haves.lower()),
        indoor_outdoor=_indoor_outdoor(f"{constraints} {must_haves}"),
        max_travel_minutes=int(minutes.group(1)) if minutes else DEFAULT_MAX_TRAVEL_MINUTES,
        must_haves=must_haves,
        constraints=constraints,
        traditions=form["traditions"],
    )


def brief_to_text(brief: StructuredBrief) -> str:
    styles = ", ".join(brief.styles) or "Flexible"
    priorities = ", ".join(brief.priorities) or "Balanced planning support"
    requested = [
        "- Executive summary with the planning concept.",
        *(f"- {option}." for option in PRIORITY_OPTIONS if option in brief.priorities),
        "- Risks, tradeoffs, and open questions for the couple.",
    ]

    text = textwrap.dedent(
        f"""
        Couple or event name: {brief.couple_name}
        Wedding location: {brief.city_name}, {brief.state_name}
        Target date: {brief.wedding_date.strftime("%B %d, %Y")}
        Guest count: {brief.guest_count}
        Budget range: {brief.currency} {brief.budget_low:,} to {brief.budget_high:,}
        Budget per guest (midpoint): {brief.currency} {brief.budget_per_guest:,.2f}
        Event scope: {brief.ceremony_type}
        Preferred style: {styles}
        Planning priorities: {priorities}
        Planner tone: {brief.tone}

        Must-haves:
        {brief.must_haves.strip() or "None specified."}

        Constraints and sensitivities:
        {brief.constraints.strip() or "None specified."}

        Cultural, family, or ceremonial details:
        {brief.traditions.strip() or "None specified."}
        """
    ).strip()
    return text + "\n\nRequested final plan:\n" + "\n".join(requested)
