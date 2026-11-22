"""HTTP API for the React frontend: the research count and a streamed plan build.

Serve with an ASGI server, for example `uvicorn vows_n_knots.api:app`.
Server and build settings are not part of this module.
"""

from __future__ import annotations

import asyncio
import json
import threading
from collections.abc import AsyncIterator
from dataclasses import asdict
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator, model_validator

from vows_n_knots.brief import PRIORITY_OPTIONS, BriefError, StructuredBrief, brief_from_legacy_form
from vows_n_knots.config.logging_config import configure_logging, get_logger
from vows_n_knots.locations import US_STATES, display_name, load_places
from vows_n_knots.research import research_search_count
from vows_n_knots.run import BuildCancelled, Plan, ProgressEvent, run_plan

configure_logging()  # stdout and logs/, so the server's cancel messages are visible
logger = get_logger(__name__)

PLACES_PATH = Path(__file__).resolve().parents[2] / "data" / "us_places.csv"
BUDGET_MIN, BUDGET_MAX, BUDGET_STEP = 5000, 250000, 5000
GUEST_MIN, GUEST_MAX = 10, 1000
CEREMONY_DEFAULT = "Ceremony and reception"
TONE_DEFAULT = "Warm and practical"
FAILURE_MESSAGE = "We couldn't finish your plan."

DietaryTag = Literal["vegetarian", "vegan", "gluten-free", "halal", "kosher", "other"]
VenueSetting = Literal["Indoor", "Outdoor", "Indoor-outdoor"]


class BriefRequest(BaseModel):
    """The couple's answers from the About you, Budget, Your wedding and Review screens."""

    couple_name: str = Field(min_length=1, max_length=120)
    city: str = Field(min_length=1, max_length=120)
    state: str = Field(min_length=2, max_length=60)
    # Exactly one of these: a full date, or a month only (YYYY-MM).
    wedding_date: date | None = None
    wedding_month: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}$")
    guest_count: int = Field(ge=GUEST_MIN, le=GUEST_MAX)
    budget_low: int
    budget_high: int
    currency: Literal["USD", "EUR", "GBP", "CAD", "AUD"] = "USD"
    priorities: list[str] = Field(default_factory=list)
    styles: list[str] = Field(default_factory=list)
    dietary: list[DietaryTag] = Field(default_factory=list)
    venue_setting: VenueSetting
    max_travel_minutes: Literal[30, 45, 60, 90]
    traditions: str = Field(default="", max_length=2000)

    @field_validator("priorities")
    @classmethod
    def _known_priorities(cls, value: list[str]) -> list[str]:
        unknown = [p for p in value if p not in PRIORITY_OPTIONS]
        if unknown:
            raise ValueError(f"Unknown priorities: {unknown}")
        return value

    @model_validator(mode="after")
    def _budget_and_date(self) -> BriefRequest:
        for name, value in (("budget_low", self.budget_low), ("budget_high", self.budget_high)):
            if not BUDGET_MIN <= value <= BUDGET_MAX or value % BUDGET_STEP:
                raise ValueError(
                    f"{name} must be {BUDGET_MIN} to {BUDGET_MAX} in steps of {BUDGET_STEP}"
                )
        if self.budget_low > self.budget_high:
            raise ValueError("The low budget must not be above the high budget.")
        if (self.wedding_date is None) == (self.wedding_month is None):
            raise ValueError("Give either a wedding date or a wedding month, not both.")
        if self.wedding_date is not None and self.wedding_date <= date.today():
            raise ValueError("Exact date must be later than today.")
        if self.wedding_month is not None and self.wedding_month < date.today().strftime("%Y-%m"):
            raise ValueError("Month only must be the current month or later.")
        return self


def _form(request: BriefRequest) -> dict[str, Any]:
    """Map the request onto the form shape that brief_from_legacy_form reads."""
    must_haves = f"Dietary needs: {', '.join(request.dietary)}." if request.dietary else ""
    return {
        "couple_name": request.couple_name.strip(),
        "wedding_location": f"{request.city.strip()}, {request.state.strip()}",
        "wedding_date": request.wedding_date,
        "wedding_month": request.wedding_month,
        "guest_count": request.guest_count,
        "currency": request.currency,
        "budget_range": (request.budget_low, request.budget_high),
        "ceremony_type": CEREMONY_DEFAULT,
        "wedding_styles": list(request.styles),
        "planning_priorities": list(request.priorities),
        "tone": TONE_DEFAULT,
        "must_haves": must_haves,
        "constraints": "",
        "traditions": request.traditions,
        "dietary": list(request.dietary),
        "venue_setting": request.venue_setting.lower(),
        "max_travel_minutes": request.max_travel_minutes,
    }


@lru_cache(maxsize=1)
def _places():
    return load_places(PLACES_PATH)


def _brief(request: BriefRequest) -> StructuredBrief:
    try:
        return brief_from_legacy_form(_form(request), _places())
    except BriefError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _progress_payload(event: ProgressEvent) -> dict[str, Any]:
    # Search queries are never sent to the browser, so the event detail is dropped,
    # except the result status of a finished search.
    payload: dict[str, Any] = {
        "kind": event.kind,
        "section": event.section,
        "category": event.category,
    }
    if event.kind == "task_finished":
        payload["status"] = event.detail
    return payload


def _plan_payload(plan: Plan) -> dict[str, Any]:
    return {
        "text": plan.text,
        "section_status": plan.section_status,
        "summary": asdict(plan.summary),
    }


async def _build_events(brief: StructuredBrief) -> AsyncIterator[str]:
    """Run the build in a worker thread and stream its progress as server-sent events."""
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[tuple[str, Any]] = asyncio.Queue()

    def on_progress(event: ProgressEvent) -> None:
        loop.call_soon_threadsafe(queue.put_nowait, ("progress", event))

    cancel = threading.Event()
    finished = False

    async def run() -> None:
        try:
            plan = await asyncio.to_thread(run_plan, brief, on_progress=on_progress, cancel=cancel)
        except BuildCancelled:
            return  # the browser has left; nobody is listening for the outcome
        except Exception as exc:
            logger.exception("Plan build failed")
            await queue.put(("failed", exc))
        else:
            await queue.put(("plan", plan))

    worker = asyncio.create_task(run())  # keep a reference so the task is not collected
    try:
        while True:
            kind, payload = await queue.get()
            if kind == "progress":
                yield _sse("progress", _progress_payload(payload))
            elif kind == "plan":
                finished = True
                yield _sse("plan", _plan_payload(payload))
                return
            else:
                finished = True
                yield _sse("failed", {"message": FAILURE_MESSAGE})
                return
    finally:
        # The browser closed, or the stream was otherwise stopped before the plan was ready.
        # Setting the flag stops the research at its next check, so no more searches run.
        if not finished:
            cancel.set()
            logger.info("Stream closed before the plan was ready; cancelling the build.")


app = FastAPI(title="Vows n Knots API", version="0.2.0")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/states")
def states() -> list[dict[str, str]]:
    """The 50 states and DC, for the State picker."""
    return [
        {"code": code, "name": name}
        for code, name in sorted(US_STATES.items(), key=lambda item: item[1])
    ]


@app.get("/api/states/{state_code}/cities")
def cities(state_code: str) -> list[dict[str, str]]:
    """Census places in one state, for the searchable City list. Only these can be chosen."""
    code = state_code.upper()
    if code not in US_STATES:
        raise HTTPException(status_code=404, detail=f"Unknown state: {state_code}")
    places = sorted(
        (place for place in _places() if place.state_code == code),
        key=lambda place: display_name(place.name).lower(),
    )
    return [{"id": place.place_id, "name": display_name(place.name)} for place in places]


class PrioritiesRequest(BaseModel):
    """The priorities chosen on Budget and priorities. The search count depends on nothing else."""

    priorities: list[str] = Field(default_factory=list)

    @field_validator("priorities")
    @classmethod
    def _known_priorities(cls, value: list[str]) -> list[str]:
        unknown = [p for p in value if p not in PRIORITY_OPTIONS]
        if unknown:
            raise ValueError(f"Unknown priorities: {unknown}")
        return value


@app.post("/api/research/count")
def research_count(request: PrioritiesRequest) -> dict[str, int]:
    """How many searches the build will run for these priorities."""
    return {"searches": research_search_count(request.priorities)}


@app.post("/api/plan/stream")
def stream_plan(request: BriefRequest) -> StreamingResponse:
    """Build a plan. Streams `progress` events, then one `plan` or `failed` event."""
    return StreamingResponse(_build_events(_brief(request)), media_type="text/event-stream")
