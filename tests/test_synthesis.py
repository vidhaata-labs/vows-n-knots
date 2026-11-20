import unittest
from datetime import datetime, timezone
from types import SimpleNamespace

from langchain.messages import HumanMessage, SystemMessage

from vows_n_knots.config.research import SYNTHESIS_SNIPPET_CHARS
from vows_n_knots.prompts import SYNTHESIS_SYSTEM_PROMPT
from vows_n_knots.research import ResearchTask
from vows_n_knots.search import TaskResult
from vows_n_knots.synthesis import (
    SynthesisError,
    build_messages,
    format_results,
    synthesize,
)


def make_result(section: str, url: str = "https://example.com/a", content: str = "body",
                title: str = "Title", status: str = "ok", error: str | None = None,
                retrieved_at: float | None = None) -> TaskResult:
    task = ResearchTask(section, "venue", "query", "availability", ())
    response = None
    if status != "failed":
        response = {"results": [{"title": title, "url": url, "content": content}]}
    return TaskResult(task, status, response, error, 0.1, retrieved_at)


class FakeModel:
    def __init__(self, content):
        self.content = content
        self.received = None

    def invoke(self, messages):
        self.received = messages
        return SimpleNamespace(content=self.content)


class FormatResultsTests(unittest.TestCase):
    def test_groups_sections_and_includes_urls(self):
        text = format_results([
            make_result("Venue shortlist", url="https://v.example/1"),
            make_result("Catering", url="https://c.example/1"),
            make_result("Venue shortlist", url="https://v.example/2"),
        ])
        self.assertEqual(text.count("Venue shortlist"), 1)
        self.assertIn("Catering", text)
        for url in ("https://v.example/1", "https://v.example/2", "https://c.example/1"):
            self.assertIn(url, text)
        self.assertLess(text.index("Venue shortlist"), text.index("Catering"))

    def test_failed_task_reads_no_data_with_error(self):
        text = format_results([make_result("Catering", status="failed", error="TimeoutError: slow")])
        self.assertIn("No data: TimeoutError: slow", text)

    def test_long_content_is_cut_with_ellipsis(self):
        text = format_results([make_result("Venue shortlist", content="x" * 50)], max_chars=10)
        self.assertIn("x" * 10 + "...", text)
        self.assertNotIn("x" * 11, text)

    def test_default_snippet_cut_uses_configured_length(self):
        text = format_results([make_result("Venue shortlist", content="x" * 400)])
        self.assertIn("x" * SYNTHESIS_SNIPPET_CHARS + "...", text)
        self.assertNotIn("x" * (SYNTHESIS_SNIPPET_CHARS + 1), text)

    def test_cached_result_shows_its_retrieval_date(self):
        stored = datetime(2026, 11, 2, 12, tzinfo=timezone.utc).timestamp()
        text = format_results([make_result("Catering", status="cached", retrieved_at=stored)])
        self.assertIn("Retrieved: 2026-11-02", text)

    def test_fresh_result_shows_its_retrieval_date(self):
        searched = datetime(2026, 11, 20, 12, tzinfo=timezone.utc).timestamp()
        text = format_results([make_result("Catering", retrieved_at=searched)])
        self.assertIn("Retrieved: 2026-11-20", text)

    def test_result_without_retrieval_time_has_no_date(self):
        self.assertNotIn("Retrieved:", format_results([make_result("Catering")]))

    def test_empty_results_reads_no_data(self):
        result = make_result("Catering")
        result = TaskResult(result.task, "ok", {"results": []}, None, 0.1)
        self.assertIn("No data: search returned no results", format_results([result]))


class BuildMessagesTests(unittest.TestCase):
    def test_system_then_human_with_brief(self):
        messages = build_messages("BRIEF TEXT", [make_result("Venue shortlist")])
        self.assertIsInstance(messages[0], SystemMessage)
        self.assertIsInstance(messages[1], HumanMessage)
        self.assertEqual(len(messages), 2)
        self.assertIn("BRIEF TEXT", messages[1].content)
        self.assertIn("https://example.com/a", messages[1].content)

    def test_system_prompt_asks_for_retrieval_dates(self):
        messages = build_messages("BRIEF TEXT", [])
        self.assertIn("retrieval date", messages[0].content)


class MetaModel:
    def __init__(self, content, finish_reason=None, with_metadata=True):
        self.content = content
        self.finish_reason = finish_reason
        self.with_metadata = with_metadata

    def invoke(self, messages):
        response = SimpleNamespace(content=self.content)
        if self.with_metadata:
            response.response_metadata = {"finish_reason": self.finish_reason}
        return response


class SynthesisErrorTests(unittest.TestCase):
    def test_length_finish_reason_raises(self):
        with self.assertRaisesRegex(SynthesisError, "cut off"):
            synthesize(MetaModel("partial", "length"), "brief", [])

    def test_empty_content_raises(self):
        with self.assertRaisesRegex(SynthesisError, "no text"):
            synthesize(MetaModel("", "stop"), "brief", [])

    def test_whitespace_content_raises(self):
        with self.assertRaises(SynthesisError):
            synthesize(MetaModel("  \n\t ", "stop"), "brief", [])

    def test_stop_finish_reason_returns_text(self):
        self.assertEqual(synthesize(MetaModel("plan", "stop"), "brief", []), "plan")

    def test_missing_metadata_returns_text(self):
        self.assertEqual(synthesize(MetaModel("plan", with_metadata=False), "brief", []), "plan")


class SynthesizeTests(unittest.TestCase):
    def test_string_content_returned(self):
        model = FakeModel("plan")
        self.assertEqual(synthesize(model, "brief", []), "plan")
        self.assertIsInstance(model.received[0], SystemMessage)

    def test_list_content_text_parts_joined(self):
        model = FakeModel([{"type": "text", "text": "a"}, {"type": "text", "text": "b"}])
        self.assertEqual(synthesize(model, "brief", []), "ab")

    def test_mixed_string_and_dict_parts_joined(self):
        model = FakeModel(["a", {"type": "text", "text": "b"}])
        self.assertEqual(synthesize(model, "brief", []), "ab")


class PromptCitationRuleTest(unittest.TestCase):
    def test_prompt_demands_full_url_and_retrieved_date(self):
        self.assertIn("FULL", SYNTHESIS_SYSTEM_PROMPT)
        self.assertIn("URL", SYNTHESIS_SYSTEM_PROMPT)
        self.assertIn("Retrieved", SYNTHESIS_SYSTEM_PROMPT)


if __name__ == "__main__":
    unittest.main()
