import asyncio
import time
import unittest

from vows_n_knots.cache import SearchCache, make_cache_key
from vows_n_knots.config.research import (
    MAX_RESULTS,
    SEARCH_DEPTH,
    SYNTHESIS_MAX_OUTPUT_TOKENS,
    SYNTHESIS_SNIPPET_CHARS,
    SYNTHESIS_TIMEOUT_SECONDS,
    TTL_AVAILABILITY_SECONDS,
)
from vows_n_knots.research import ResearchTask
from vows_n_knots.search import run_tasks

LOCATION = "IL-1714000"


def make_task(query: str = "chicago venues", cache_class: str = "availability",
              include_domains: tuple[str, ...] = ()) -> ResearchTask:
    return ResearchTask("Venue shortlist", "venue", query, cache_class, include_domains)


def key_for(task: ResearchTask) -> str:
    params = {
        "search_depth": SEARCH_DEPTH,
        "max_results": MAX_RESULTS,
        "include_domains": sorted(task.include_domains),
    }
    return make_cache_key(task.query, params, LOCATION)


class FakeClient:
    def __init__(self, fail_calls=(), fail_queries=(), delay: float = 0):
        self.calls: list[dict] = []
        self.fail_calls = set(fail_calls)
        self.fail_queries = set(fail_queries)
        self.delay = delay
        self.in_flight = 0
        self.max_in_flight = 0

    async def search(self, query, search_depth, max_results, include_domains):
        self.calls.append({
            "query": query,
            "search_depth": search_depth,
            "max_results": max_results,
            "include_domains": include_domains,
        })
        number = len(self.calls)
        self.in_flight += 1
        self.max_in_flight = max(self.max_in_flight, self.in_flight)
        try:
            await asyncio.sleep(self.delay)
            if number in self.fail_calls or query in self.fail_queries:
                raise RuntimeError(f"boom on call {number}")
            return {"query": query, "results": []}
        finally:
            self.in_flight -= 1


class RunTasksTest(unittest.TestCase):
    def setUp(self):
        self.cache = SearchCache(None)
        self.addCleanup(self.cache.close)

    def run_it(self, tasks, client, cache="default", **kwargs):
        cache = self.cache if cache == "default" else cache
        kwargs.setdefault("retry_delay", 0)
        return asyncio.run(run_tasks(tasks, client, cache, LOCATION, **kwargs))

    def test_cache_hit_makes_no_client_call(self):
        task = make_task()
        self.cache.set(key_for(task), {"cached": True}, 60)
        client = FakeClient()
        [result] = self.run_it([task], client)
        self.assertEqual(result.status, "cached")
        self.assertEqual(result.response, {"cached": True})
        self.assertEqual(client.calls, [])

    def test_cached_result_carries_the_stored_time(self):
        task = make_task()
        stored = time.time() - 3 * 86400
        self.cache.set(key_for(task), {"cached": True}, 30 * 86400, now=stored)
        [result] = self.run_it([task], FakeClient())
        self.assertEqual(result.status, "cached")
        self.assertEqual(result.retrieved_at, stored)

    def test_fresh_result_carries_the_search_time(self):
        before = time.time()
        [result] = self.run_it([make_task()], FakeClient())
        self.assertEqual(result.status, "ok")
        self.assertGreaterEqual(result.retrieved_at, before)
        self.assertLessEqual(result.retrieved_at, time.time())

    def test_empty_dict_in_cache_is_a_hit(self):
        task = make_task()
        self.cache.set(key_for(task), {}, 60)
        client = FakeClient()
        [result] = self.run_it([task], client)
        self.assertEqual(result.status, "cached")
        self.assertEqual(client.calls, [])

    def test_miss_stores_response_then_second_run_is_cached(self):
        task = make_task()
        client = FakeClient()
        [first] = self.run_it([task], client)
        self.assertEqual(first.status, "ok")
        self.assertEqual(self.cache.get(key_for(task)), first.response)
        [second] = self.run_it([task], client)
        self.assertEqual(second.status, "cached")
        self.assertEqual(len(client.calls), 1)

    def test_client_gets_search_parameters(self):
        task = make_task(include_domains=("a.com", "b.com"))
        client = FakeClient()
        self.run_it([task], client)
        self.assertEqual(client.calls[0]["search_depth"], SEARCH_DEPTH)
        self.assertEqual(client.calls[0]["max_results"], MAX_RESULTS)
        self.assertEqual(client.calls[0]["include_domains"], ["a.com", "b.com"])
        client = FakeClient()
        self.run_it([make_task("other query")], client)
        self.assertIsNone(client.calls[0]["include_domains"])

    def test_transient_failure_is_retried(self):
        client = FakeClient(fail_calls={1})
        with self.assertLogs("vows_n_knots.search", level="WARNING"):
            [result] = self.run_it([make_task()], client)
        self.assertEqual(result.status, "ok")
        self.assertEqual(len(client.calls), 2)

    def test_permanent_failure_does_not_raise_and_others_succeed(self):
        tasks = [make_task("good one"), make_task("bad one"), make_task("good two")]
        client = FakeClient(fail_queries={"bad one"})
        with self.assertLogs("vows_n_knots.search", level="WARNING"):
            results = self.run_it(tasks, client)
        self.assertEqual([r.status for r in results], ["ok", "failed", "ok"])
        self.assertTrue(results[1].error)
        self.assertIsNone(results[1].response)

    def test_concurrency_is_bounded(self):
        tasks = [make_task(f"query {i}") for i in range(12)]
        client = FakeClient(delay=0.01)
        self.run_it(tasks, client, concurrency=3)
        self.assertLessEqual(client.max_in_flight, 3)
        self.assertEqual(len(client.calls), 12)

    def test_results_keep_input_order(self):
        tasks = [make_task(f"query {i}") for i in range(8)]
        results = self.run_it(tasks, FakeClient(delay=0.01), concurrency=4)
        self.assertEqual([r.task for r in results], tasks)

    def test_price_entry_outlives_availability_ttl(self):
        task = make_task("cake cost", cache_class="price")
        self.run_it([task], FakeClient())
        later = time.time() + TTL_AVAILABILITY_SECONDS + 1
        self.assertIsNotNone(self.cache.get(key_for(task), now=later))

    def test_availability_entry_expires_after_its_ttl(self):
        task = make_task()
        self.run_it([task], FakeClient())
        later = time.time() + TTL_AVAILABILITY_SECONDS + 1
        self.assertIsNone(self.cache.get(key_for(task), now=later))

    def test_events_are_reported(self):
        events = []
        self.run_it([make_task()], FakeClient(), on_event=lambda *e: events.append(e))
        self.assertEqual(events, [("task_started", "chicago venues"), ("task_finished", "ok")])

    def test_successful_task_is_logged_with_section_query_status_and_urls(self):
        class UrlClient:
            async def search(self, **kwargs):
                return {"results": [{"url": "https://venue.example/a"}, {"url": "https://venue.example/b"}]}

        with self.assertLogs("vows_n_knots.search", level="INFO") as logs:
            self.run_it([make_task()], UrlClient())
        info = [r.getMessage() for r in logs.records if r.levelname == "INFO"]
        self.assertEqual(len(info), 1)
        for part in ("Venue shortlist", "chicago venues", "ok",
                     "https://venue.example/a", "https://venue.example/b"):
            self.assertIn(part, info[0])

    def test_failed_task_is_logged_at_warning(self):
        with self.assertLogs("vows_n_knots.search", level="INFO") as logs:
            self.run_it([make_task()], FakeClient(fail_queries={"chicago venues"}))
        final = logs.records[-1]
        self.assertEqual(final.levelname, "WARNING")
        self.assertIn("failed", final.getMessage())
        self.assertNotIn("INFO", [r.levelname for r in logs.records])

    def test_works_without_a_cache(self):
        client = FakeClient()
        [result] = self.run_it([make_task()], client, cache=None)
        self.assertEqual(result.status, "ok")


class SynthesisBudgetTest(unittest.TestCase):
    def test_synthesis_budget_values(self):
        self.assertEqual(SYNTHESIS_MAX_OUTPUT_TOKENS, 16384)
        self.assertEqual(SYNTHESIS_TIMEOUT_SECONDS, 600)
        self.assertEqual(SYNTHESIS_SNIPPET_CHARS, 300)


class BrokenCache:
    def __init__(self, fail_get=False, fail_set=False):
        self.fail_get = fail_get
        self.fail_set = fail_set

    def get_entry(self, key, now=None):
        if self.fail_get:
            raise RuntimeError("get broke")
        return None

    def set(self, key, response, ttl_seconds, now=None):
        if self.fail_set:
            raise RuntimeError("set broke")


class RunTasksResilienceTest(unittest.TestCase):
    def run_it(self, tasks, client, cache, **kwargs):
        return asyncio.run(run_tasks(tasks, client, cache, LOCATION, retry_delay=0, **kwargs))

    def test_cache_get_failure_is_a_miss(self):
        client = FakeClient()
        with self.assertLogs("vows_n_knots.search", level="WARNING"):
            [result] = self.run_it([make_task()], client, BrokenCache(fail_get=True))
        self.assertEqual(result.status, "ok")
        self.assertEqual(len(client.calls), 1)

    def test_cache_set_failure_keeps_the_result(self):
        with self.assertLogs("vows_n_knots.search", level="WARNING") as logs:
            [result] = self.run_it([make_task()], FakeClient(), BrokenCache(fail_set=True))
        self.assertEqual(result.status, "ok")
        self.assertIsNotNone(result.response)
        self.assertTrue(any("Cache write failed" in line for line in logs.output))

    def test_on_event_failure_does_not_abort_the_run(self):
        def bad_listener(event, detail):
            raise RuntimeError("listener broke")

        tasks = [make_task(f"query {i}") for i in range(3)]
        with self.assertLogs("vows_n_knots.search", level="WARNING"):
            results = self.run_it(tasks, FakeClient(), None, on_event=bad_listener)
        self.assertEqual([r.status for r in results], ["ok", "ok", "ok"])


if __name__ == "__main__":
    unittest.main()
