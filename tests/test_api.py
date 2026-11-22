import asyncio
import json
import time
import unittest
from datetime import date, timedelta
from unittest import mock

from fastapi.testclient import TestClient

from vows_n_knots import api
from vows_n_knots.run import BuildCancelled, Plan, RunSummary

REVIEW_PRIORITIES = ["Venue shortlist", "Vendor research", "Budget allocation", "Travel logistics"]


def valid_body(**overrides):
    body = {
        "couple_name": "Amira and Noah",
        "city": "Chicago",
        "state": "Illinois",
        "wedding_date": (date.today() + timedelta(days=365)).isoformat(),
        "guest_count": 120,
        "budget_low": 35000,
        "budget_high": 65000,
        "currency": "USD",
        "priorities": REVIEW_PRIORITIES,
        "styles": ["Modern", "Romantic", "Garden"],
        "dietary": ["vegetarian"],
        "venue_setting": "Indoor-outdoor",
        "max_travel_minutes": 45,
        "traditions": "",
    }
    body.update(overrides)
    return body


def parse_sse(text):
    events = []
    for block in text.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines())
        events.append((lines["event"], json.loads(lines["data"])))
    return events


def fake_plan(brief, *, on_progress=None, **_):
    on_progress(api.ProgressEvent("task_started", "secret query about Chicago venues", "Venue shortlist", "venue"))
    on_progress(api.ProgressEvent("task_finished", "ok", "Venue shortlist", "venue"))
    on_progress(api.ProgressEvent("synthesis_started", ""))
    return Plan(
        text="# Your plan",
        section_status={"Venue shortlist": "ok"},
        summary=RunSummary(1, 0, 0, 0.1, 0.2, 0.3),
    )


class ApiTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(api.app)

    def test_health(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_research_count_is_the_plan_count(self):
        response = self.client.post("/api/research/count", json={"priorities": REVIEW_PRIORITIES})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"searches": 15})

    def test_research_count_follows_priorities(self):
        response = self.client.post("/api/research/count", json={"priorities": ["Timeline"]})
        self.assertEqual(response.json(), {"searches": 0})
        response = self.client.post("/api/research/count", json={"priorities": []})
        self.assertEqual(response.json(), {"searches": 0})

    def test_research_count_rejects_unknown_priorities(self):
        response = self.client.post("/api/research/count", json={"priorities": ["Karaoke"]})
        self.assertEqual(response.status_code, 422)

    def test_rejects_invalid_requests(self):
        cases = {
            "guest count below range": {"guest_count": 5},
            "guest count above range": {"guest_count": 1001},
            "budget not in steps": {"budget_low": 35002},
            "budget below range": {"budget_low": 1000},
            "low above high": {"budget_low": 65000, "budget_high": 35000},
            "exact date in the past": {"wedding_date": "2020-01-01"},
            "month-only date": {"wedding_date": "2027-07"},
            "unknown priority": {"priorities": ["Karaoke"]},
            "unknown dietary tag": {"dietary": ["pescatarian"]},
            "unknown travel time": {"max_travel_minutes": 50},
            "unknown venue setting": {"venue_setting": "Underwater"},
            "unknown currency": {"currency": "XYZ"},
        }
        for label, overrides in cases.items():
            with self.subTest(label):
                response = self.client.post("/api/plan/stream", json=valid_body(**overrides))
                self.assertEqual(response.status_code, 422)

    def test_unknown_city_is_rejected_with_a_message(self):
        response = self.client.post(
            "/api/plan/stream", json=valid_body(city="Springfield Nowhere", state="Illinois")
        )
        self.assertEqual(response.status_code, 422)
        self.assertIn("No place named", response.json()["detail"])

    def test_states_lists_fifty_states_and_dc(self):
        states = self.client.get("/api/states").json()
        self.assertEqual(len(states), 51)
        self.assertIn({"code": "IL", "name": "Illinois"}, states)
        self.assertEqual(states, sorted(states, key=lambda s: s["name"]))

    def test_cities_use_display_names_and_sorted_order(self):
        cities = self.client.get("/api/states/il/cities").json()
        names = [city["name"] for city in cities]
        self.assertIn("Chicago", names)
        self.assertIn("Chicago Heights", names)
        self.assertNotIn("Chicago city", names)
        self.assertEqual(names, sorted(names, key=str.lower))
        self.assertTrue(all("id" in city for city in cities))

    def test_unknown_state_has_no_cities(self):
        response = self.client.get("/api/states/ZZ/cities")
        self.assertEqual(response.status_code, 404)

    def test_stream_sends_progress_then_plan_without_queries(self):
        with mock.patch.object(api, "run_plan", side_effect=fake_plan):
            response = self.client.post("/api/plan/stream", json=valid_body())
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("secret query", response.text)
        events = parse_sse(response.text)
        self.assertEqual([name for name, _ in events], ["progress", "progress", "progress", "plan"])
        self.assertEqual(events[0][1], {"kind": "task_started", "section": "Venue shortlist", "category": "venue"})
        self.assertEqual(events[1][1]["status"], "ok")
        self.assertEqual(events[-1][1]["text"], "# Your plan")
        self.assertEqual(events[-1][1]["section_status"], {"Venue shortlist": "ok"})
        self.assertEqual(events[-1][1]["summary"]["searches"], 1)

    def test_month_only_stream_is_accepted(self):
        month = (date.today() + timedelta(days=400)).strftime("%Y-%m")
        body = valid_body(wedding_date=None, wedding_month=month)
        with mock.patch.object(api, "run_plan", side_effect=fake_plan):
            response = self.client.post("/api/plan/stream", json=body)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(parse_sse(response.text)[-1][0], "plan")

    def test_month_only_rules(self):
        cases = {
            "month in the past": valid_body(wedding_date=None, wedding_month="2020-01"),
            "both date and month": valid_body(wedding_month="2099-01"),
            "neither date nor month": valid_body(wedding_date=None),
            "bad month format": valid_body(wedding_date=None, wedding_month="July 2027"),
        }
        for label, body in cases.items():
            with self.subTest(label):
                response = self.client.post("/api/plan/stream", json=body)
                self.assertEqual(response.status_code, 422)

    def test_stream_reports_failure_without_internal_detail(self):
        def broken(brief, **_):
            raise RuntimeError("TAVILY_API_KEY=abc123 is wrong")

        with mock.patch.object(api, "run_plan", side_effect=broken):
            response = self.client.post("/api/plan/stream", json=valid_body())
        events = parse_sse(response.text)
        self.assertEqual(events, [("failed", {"message": api.FAILURE_MESSAGE})])
        self.assertNotIn("abc123", response.text)

    def test_stream_validates_before_building(self):
        with mock.patch.object(api, "run_plan") as run:
            response = self.client.post("/api/plan/stream", json=valid_body(guest_count=5))
        self.assertEqual(response.status_code, 422)
        run.assert_not_called()


class CancelOnDisconnectTest(unittest.TestCase):
    def brief(self):
        return api._brief(api.BriefRequest(**valid_body()))

    def test_closing_the_stream_sets_the_cancel_flag(self):
        seen = {}

        def long_build(brief, *, on_progress=None, cancel=None, **_):
            seen["cancel"] = cancel
            on_progress(api.ProgressEvent("task_started", "", "Venue shortlist", "venue"))
            for _ in range(500):  # stands in for a build that runs for a long time
                if cancel.is_set():
                    raise BuildCancelled("stopped")
                time.sleep(0.01)
            return Plan(text="never", section_status={}, summary=RunSummary(0, 0, 0, 0, 0, 0))

        async def scenario():
            with mock.patch.object(api, "run_plan", side_effect=long_build):
                stream = api._build_events(self.brief())
                first = await stream.__anext__()
                self.assertIn("event: progress", first)
                await stream.aclose()  # what happens when the browser closes the connection
            for _ in range(200):
                if seen["cancel"].is_set():
                    return True
                await asyncio.sleep(0.02)
            return False

        self.assertTrue(asyncio.run(scenario()))

    def test_finishing_the_stream_does_not_cancel(self):
        seen = {}

        def quick_build(brief, *, on_progress=None, cancel=None, **_):
            seen["cancel"] = cancel
            return Plan(text="done", section_status={}, summary=RunSummary(0, 0, 0, 0, 0, 0))

        async def scenario():
            with mock.patch.object(api, "run_plan", side_effect=quick_build):
                events = [event async for event in api._build_events(self.brief())]
            await asyncio.sleep(0.05)
            return events

        events = asyncio.run(scenario())
        self.assertIn("event: plan", events[-1])
        self.assertFalse(seen["cancel"].is_set())


if __name__ == "__main__":
    unittest.main()
