import asyncio
import os
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from tests.test_brief import sample_form
from vows_n_knots.brief import brief_from_legacy_form
from vows_n_knots.cache import SearchCache
from vows_n_knots.config.settings import ConfigurationError
from vows_n_knots.locations import load_places
from vows_n_knots.run import BuildCancelled, run_plan
from vows_n_knots.synthesis import SynthesisError

FIXTURE = Path(__file__).parent / "fixtures" / "places_sample.csv"
SAMPLE_PRIORITIES = ["Venue shortlist", "Vendor research", "Budget allocation", "Timeline"]
# A full plan is written in parts: the Summary, then one part per priority.
PART_COUNT = 1 + len(SAMPLE_PRIORITIES)


def plan_of(text, parts=PART_COUNT):
    return "\n\n".join([text] * parts)


class FakeClient:
    def __init__(self):
        self.calls = 0

    async def search(self, **kwargs):
        self.calls += 1
        return {"results": []}


class FailingClient:
    def __init__(self):
        self.calls = 0

    async def search(self, **kwargs):
        self.calls += 1
        raise RuntimeError("boom")


class FakeModel:
    def __init__(self):
        self.calls = 0

    def invoke(self, messages):
        self.calls += 1
        return SimpleNamespace(content="plan text")


class RunPlanTest(unittest.TestCase):
    def setUp(self):
        self.places = load_places(FIXTURE)

    def build(self, priorities=SAMPLE_PRIORITIES):
        return brief_from_legacy_form(sample_form(planning_priorities=priorities), self.places)

    def test_sample_brief_runs_fourteen_searches(self):
        client, model = FakeClient(), FakeModel()
        plan = run_plan(self.build(), cache=SearchCache(None), search_client=client,
                        model=model, retry_delay=0)
        self.assertEqual(client.calls, 14)
        self.assertEqual(plan.summary.searches, 14)
        self.assertEqual(plan.summary.cache_hits, 0)
        self.assertEqual(plan.summary.failed_tasks, 0)
        self.assertEqual(plan.text, plan_of("plan text"))
        self.assertEqual(model.calls, PART_COUNT)
        self.assertEqual(plan.section_status, {
            "Venue shortlist": "ok",
            "Vendor research": "ok",
            "Budget allocation": "ok",
            "Timeline": "planner only",
        })

    def test_second_run_uses_cache(self):
        cache = SearchCache(None)
        run_plan(self.build(), cache=cache, search_client=FakeClient(), model=FakeModel(),
                 retry_delay=0)
        client = FakeClient()
        plan = run_plan(self.build(), cache=cache, search_client=client, model=FakeModel(),
                        retry_delay=0)
        self.assertEqual(client.calls, 0)
        self.assertEqual(plan.summary.searches, 0)
        self.assertEqual(plan.summary.cache_hits, 14)

    def test_no_priorities_makes_no_searches_but_still_plans(self):
        client, model = FakeClient(), FakeModel()
        plan = run_plan(self.build([]), search_client=client, model=model, retry_delay=0)
        self.assertEqual(client.calls, 0)
        self.assertEqual(plan.summary.searches, 0)
        self.assertEqual(model.calls, 1)
        self.assertEqual(plan.text, "plan text")
        self.assertEqual(plan.section_status, {})

    def test_missing_tavily_key_raises_before_search_or_model(self):
        model = FakeModel()
        env = {k: v for k, v in os.environ.items() if k != "TAVILY_API_KEY"}
        with mock.patch.dict(os.environ, env, clear=True), \
                mock.patch("vows_n_knots.run.load_env"):
            with self.assertRaises(ConfigurationError),                     self.assertLogs("vows_n_knots.run", level="ERROR"):
                run_plan(self.build(), model=model, retry_delay=0)
        self.assertEqual(model.calls, 0)

    def test_failing_client_gives_no_data_and_still_plans(self):
        client, model = FailingClient(), FakeModel()
        with self.assertLogs("vows_n_knots", level="INFO"):
            plan = run_plan(self.build(), search_client=client, model=model, retry_delay=0)
        self.assertEqual(plan.section_status["Venue shortlist"], "no data")
        self.assertEqual(plan.summary.failed_tasks, 14)
        self.assertEqual(plan.summary.searches, client.calls)
        self.assertEqual(plan.text, plan_of("plan text"))

    def test_progress_events(self):
        events = []
        run_plan(self.build(), search_client=FakeClient(), model=FakeModel(),
                 on_progress=events.append, retry_delay=0)
        kinds = [event.kind for event in events]
        for kind in ("task_started", "task_finished", "synthesis_started", "done"):
            self.assertIn(kind, kinds)
        self.assertEqual(kinds[-1], "done")

    def test_task_events_carry_section_and_category(self):
        events = []
        run_plan(self.build(["Venue shortlist"]), search_client=FakeClient(),
                 model=FakeModel(), on_progress=events.append, retry_delay=0)
        for kind in ("task_started", "task_finished"):
            task_events = [e for e in events if e.kind == kind]
            self.assertTrue(task_events)
            for event in task_events:
                self.assertEqual(event.section, "Venue shortlist")
                self.assertTrue(event.category)

    def test_raising_progress_callback_does_not_abort_the_run(self):
        def broken(event):
            raise RuntimeError("listener broke")

        model = FakeModel()
        with self.assertLogs("vows_n_knots.run", level="WARNING") as logs:
            plan = run_plan(self.build(), search_client=FakeClient(), model=model,
                            on_progress=broken, retry_delay=0)
        self.assertEqual(plan.text, plan_of("plan text"))
        self.assertEqual(model.calls, PART_COUNT)
        self.assertTrue(any("listener broke" in line for line in logs.output))
        self.assertFalse(any("Run failed" in line for line in logs.output))

    def test_raising_done_callback_still_returns_the_plan(self):
        events = []

        def broken_on_done(event):
            events.append(event.kind)
            if event.kind == "done":
                raise RuntimeError("done listener broke")

        with self.assertLogs("vows_n_knots.run", level="WARNING"):
            plan = run_plan(self.build(), search_client=FakeClient(), model=FakeModel(),
                            on_progress=broken_on_done, retry_delay=0)
        self.assertEqual(plan.text, plan_of("plan text"))
        self.assertEqual(events[-1], "done")
        self.assertNotIn("failed", events)

    def test_truncated_synthesis_raises_and_returns_no_plan(self):
        class TruncatedModel:
            def invoke(self, messages):
                return SimpleNamespace(content="partial",
                                       response_metadata={"finish_reason": "length"})

        events = []
        plan = None
        with self.assertRaises(SynthesisError), \
                self.assertLogs("vows_n_knots.run", level="ERROR"):
            plan = run_plan(self.build(), search_client=FakeClient(), model=TruncatedModel(),
                            on_progress=events.append, retry_delay=0)
        self.assertIsNone(plan)
        self.assertEqual(events[-1].kind, "failed")

    def test_failure_emits_failed_and_reraises(self):
        class BrokenModel:
            def invoke(self, messages):
                raise RuntimeError("model down")

        events = []
        with self.assertRaises(RuntimeError),                 self.assertLogs("vows_n_knots.run", level="ERROR"):
            run_plan(self.build(), search_client=FakeClient(), model=BrokenModel(),
                     on_progress=events.append, retry_delay=0)
        self.assertEqual(events[-1].kind, "failed")
        self.assertIn("model down", events[-1].detail)


class ThinkingFakeModel:
    def __init__(self):
        self.thinking_args = []

    def with_thinking_mode(self, enabled):
        self.thinking_args.append(enabled)
        return self

    def invoke(self, messages):
        return SimpleNamespace(content="plan", response_metadata={"finish_reason": "stop"})


class PlainFakeModel:
    def invoke(self, messages):
        return SimpleNamespace(content="plan", response_metadata={"finish_reason": "stop"})


class ThinkingModeTest(unittest.TestCase):
    def setUp(self):
        places = load_places(FIXTURE)
        self.brief = brief_from_legacy_form(sample_form(planning_priorities=SAMPLE_PRIORITIES), places)

    def test_built_model_has_thinking_disabled(self):
        fake = ThinkingFakeModel()
        with mock.patch("vows_n_knots.run.create_chat_model", return_value=fake):
            plan = run_plan(self.brief, search_client=FakeClient(), retry_delay=0)
        self.assertEqual(fake.thinking_args, [False])
        self.assertEqual(plan.text, plan_of("plan"))

    def test_built_model_without_thinking_mode_still_runs(self):
        with mock.patch("vows_n_knots.run.create_chat_model", return_value=PlainFakeModel()):
            plan = run_plan(self.brief, search_client=FakeClient(), retry_delay=0)
        self.assertEqual(plan.text, plan_of("plan"))

    def test_injected_model_is_left_unchanged(self):
        fake = ThinkingFakeModel()
        run_plan(self.brief, search_client=FakeClient(), model=fake, retry_delay=0)
        self.assertEqual(fake.thinking_args, [])


class CancelTest(unittest.TestCase):
    def setUp(self):
        self.places = load_places(FIXTURE)
        self.brief = brief_from_legacy_form(sample_form(planning_priorities=SAMPLE_PRIORITIES), self.places)

    def test_cancel_before_research_skips_searches_and_the_model(self):
        cancel = threading.Event()
        cancel.set()
        client, model = FakeClient(), FakeModel()
        events = []
        with self.assertRaises(BuildCancelled), self.assertLogs("vows_n_knots.run", level="INFO"):
            run_plan(self.brief, search_client=client, model=model, retry_delay=0,
                     cancel=cancel, on_progress=events.append)
        self.assertEqual(client.calls, 0)
        self.assertEqual(model.calls, 0)
        self.assertEqual(events[-1].kind, "failed")
        self.assertEqual(events[-1].detail, "cancelled")
        self.assertFalse(any(e.kind == "done" for e in events))

    def test_cancel_during_research_stops_further_searches(self):
        cancel = threading.Event()

        class SlowClient:
            def __init__(self):
                self.calls = 0

            async def search(self, **kwargs):
                self.calls += 1
                if self.calls == 3:
                    cancel.set()  # the browser leaves while searches are running
                await asyncio.sleep(0.5)
                return {"results": []}

        client, model = SlowClient(), FakeModel()
        with self.assertRaises(BuildCancelled), self.assertLogs("vows_n_knots.run", level="INFO"):
            run_plan(self.brief, search_client=client, model=model, retry_delay=0, cancel=cancel)
        self.assertLess(client.calls, 14)
        self.assertEqual(model.calls, 0)

    def test_cancel_during_research_logs_no_failed_attempts(self):
        # Cancelling used to interrupt in-flight Tavily calls, which logged a spurious
        # "Search attempt ... failed" and retried. The cancel now only stops new work.
        cancel = threading.Event()

        class SlowClient:
            def __init__(self):
                self.calls = 0

            async def search(self, **kwargs):
                self.calls += 1
                if self.calls == 3:
                    cancel.set()
                await asyncio.sleep(0.2)
                return {"results": []}

        with self.assertRaises(BuildCancelled), self.assertLogs("vows_n_knots", level="INFO") as logs:
            run_plan(self.brief, search_client=SlowClient(), model=FakeModel(), retry_delay=0, cancel=cancel)
        self.assertFalse(any("Search attempt" in line for line in logs.output), logs.output)

    def test_cancel_while_writing_closes_the_model_stream(self):
        cancel = threading.Event()

        class StreamingModel:
            closed = False

            def stream(self, messages):
                try:
                    for index in range(50):
                        if index == 3:
                            cancel.set()  # the browser leaves while the plan is being written
                        yield SimpleNamespace(content="x" * 100, response_metadata={})
                finally:
                    self.closed = True

        model = StreamingModel()
        events = []
        with self.assertRaises(BuildCancelled), self.assertLogs("vows_n_knots.run", level="INFO"):
            run_plan(self.brief, search_client=FakeClient(), model=model, retry_delay=0,
                     cancel=cancel, on_progress=events.append)
        self.assertTrue(model.closed)
        self.assertEqual(events[-1].kind, "failed")
        self.assertEqual(events[-1].detail, "cancelled")
        self.assertFalse(any(e.kind == "done" for e in events))

    def test_writing_progress_is_reported_every_500_characters(self):
        class Chunks:
            def stream(self, messages):
                for _ in range(20):  # 20 pieces of 100 characters, per part
                    yield SimpleNamespace(content="x" * 100, response_metadata={})

        events = []
        run_plan(self.brief, search_client=FakeClient(), model=Chunks(), retry_delay=0,
                 on_progress=events.append)
        writing = [e.detail for e in events if e.kind == "writing"]
        self.assertEqual(writing, [str(n) for n in range(500, 10001, 500)])

    def test_cancelled_searches_that_finished_stay_in_the_cache(self):
        cancel = threading.Event()

        class FastThenSlowClient:
            def __init__(self):
                self.calls = 0

            async def search(self, **kwargs):
                self.calls += 1
                if self.calls == 4:
                    cancel.set()
                if self.calls >= 4:
                    await asyncio.sleep(0.5)
                return {"results": []}

        cache = SearchCache(None)
        with self.assertRaises(BuildCancelled), self.assertLogs("vows_n_knots.run", level="INFO"):
            run_plan(self.brief, cache=cache, search_client=FastThenSlowClient(),
                     model=FakeModel(), retry_delay=0, cancel=cancel)

        # A retry reuses the searches that finished before the cancel, so it makes fewer calls.
        retry = FakeClient()
        plan = run_plan(self.brief, cache=cache, search_client=retry, model=FakeModel(), retry_delay=0)
        self.assertGreaterEqual(plan.summary.cache_hits, 3)
        self.assertEqual(retry.calls + plan.summary.cache_hits, 14)

    def test_cancel_after_research_stops_before_the_model(self):
        cancel = threading.Event()

        class CancellingClient(FakeClient):
            async def search(self, **kwargs):
                result = await super().search(**kwargs)
                if self.calls == 14:
                    cancel.set()  # cancelled just as the last search finishes
                return result

        model = FakeModel()
        with self.assertRaises(BuildCancelled), self.assertLogs("vows_n_knots.run", level="INFO"):
            run_plan(self.brief, search_client=CancellingClient(), model=model, retry_delay=0,
                     cancel=cancel)
        self.assertEqual(model.calls, 0)

    def test_no_cancel_flag_runs_to_completion(self):
        cancel = threading.Event()  # never set
        model = FakeModel()
        plan = run_plan(self.brief, search_client=FakeClient(), model=model, retry_delay=0,
                        cancel=cancel)
        self.assertEqual(plan.text, plan_of("plan text"))
        self.assertEqual(model.calls, PART_COUNT)


if __name__ == "__main__":
    unittest.main()
