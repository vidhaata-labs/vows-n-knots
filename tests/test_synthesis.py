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
    SynthesisStopped,
    build_messages,
    format_results,
    synthesize,
    write_plan,
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


class StreamModel:
    """Yields the given pieces as stream chunks. `closed` is set when the stream is closed."""

    def __init__(self, pieces, finish_reason=None):
        self.pieces = pieces
        self.finish_reason = finish_reason
        self.closed = False

    def stream(self, messages):
        try:
            last = len(self.pieces) - 1
            for index, piece in enumerate(self.pieces):
                meta = {"finish_reason": self.finish_reason} if index == last and self.finish_reason else {}
                yield SimpleNamespace(content=piece, response_metadata=meta)
        finally:
            self.closed = True


def requested_section(messages):
    human = messages[-1].content
    marker = 'Write only the section "## '
    start = human.index(marker) + len(marker)
    return human[start:human.index('"', start)]


class PartModel:
    """Answers each part with its own heading. Records what each part was given."""

    def __init__(self):
        self.received = {}

    def invoke(self, messages):
        section = requested_section(messages)
        self.received[section] = messages[-1].content
        return SimpleNamespace(content=f"## {section}\nbody of {section}")


class WritePlanTests(unittest.TestCase):
    sections = ["Venue shortlist", "Vendor research", "Timeline"]

    def test_parts_are_joined_in_order_with_the_summary_first(self):
        text = write_plan(PartModel(), "brief", self.sections, [])
        self.assertEqual(
            text,
            "## Summary\nbody of Summary\n\n"
            "## Venue shortlist\nbody of Venue shortlist\n\n"
            "## Vendor research\nbody of Vendor research\n\n"
            "## Timeline\nbody of Timeline",
        )

    def test_a_section_part_sees_only_its_own_research(self):
        results = [make_result("Venue shortlist", url="https://venue.example/a"),
                   make_result("Vendor research", url="https://vendor.example/b")]
        model = PartModel()
        write_plan(model, "brief", self.sections, results)
        self.assertIn("https://venue.example/a", model.received["Venue shortlist"])
        self.assertNotIn("https://vendor.example/b", model.received["Venue shortlist"])
        self.assertIn("https://vendor.example/b", model.received["Vendor research"])

    def test_the_summary_part_sees_all_the_research(self):
        results = [make_result("Venue shortlist", url="https://venue.example/a"),
                   make_result("Vendor research", url="https://vendor.example/b")]
        model = PartModel()
        write_plan(model, "brief", self.sections, results)
        self.assertIn("https://venue.example/a", model.received["Summary"])
        self.assertIn("https://vendor.example/b", model.received["Summary"])

    def test_a_section_without_research_is_told_not_to_invent_figures(self):
        model = PartModel()
        write_plan(model, "brief", self.sections, [])
        self.assertIn("no research", model.received["Timeline"])
        self.assertIn("do not invent", model.received["Timeline"])

    def test_each_part_starts_with_its_own_heading_instruction(self):
        model = PartModel()
        write_plan(model, "brief", self.sections, [])
        self.assertIn('Write only the section "## Venue shortlist"', model.received["Venue shortlist"])
        self.assertIn("Do not write", model.received["Venue shortlist"])

    def test_one_failing_part_raises_and_stops_the_others(self):
        class BrokenVendor(PartModel):
            def invoke(self, messages):
                if requested_section(messages) == "Vendor research":
                    raise RuntimeError("model down for vendors")
                return super().invoke(messages)

        with self.assertRaisesRegex(RuntimeError, "model down for vendors"):
            write_plan(BrokenVendor(), "brief", self.sections, [])

    def test_stop_closes_every_part(self):
        class StreamingParts:
            def __init__(self):
                self.closed = []
                self.started = 0

            def stream(self, messages):
                section = requested_section(messages)
                try:
                    for _ in range(50):
                        yield SimpleNamespace(content="x" * 10, response_metadata={})
                finally:
                    self.closed.append(section)

        model = StreamingParts()
        with self.assertRaises(SynthesisStopped):
            write_plan(model, "brief", self.sections, [], should_stop=lambda: True)
        self.assertEqual(sorted(model.closed), sorted(["Summary", *self.sections]))

    def test_progress_is_the_total_across_parts(self):
        seen = []
        write_plan(PartModel(), "brief", self.sections, [], on_progress=seen.append)
        final = seen[-1]
        expected = sum(len(f"## {s}\nbody of {s}") for s in ["Summary", *self.sections])
        self.assertEqual(final, expected)


class StreamingSynthesisTests(unittest.TestCase):
    def test_pieces_are_joined_in_order(self):
        self.assertEqual(synthesize(StreamModel(["Ve", "nue ", "plan"]), "brief", []), "Venue plan")

    def test_list_content_chunks_are_read(self):
        class ListChunks:
            def stream(self, messages):
                yield SimpleNamespace(content=[{"type": "text", "text": "a"}])
                yield SimpleNamespace(content=[{"type": "text", "text": "b"}])

        self.assertEqual(synthesize(ListChunks(), "brief", []), "ab")

    def test_progress_reports_characters_written_so_far(self):
        seen = []
        synthesize(StreamModel(["ab", "cde"]), "brief", [], on_progress=seen.append)
        self.assertEqual(seen, [2, 5])

    def test_stop_closes_the_stream_and_raises(self):
        model = StreamModel(["one", "two", "three", "four"])
        calls = {"n": 0}

        def should_stop():
            calls["n"] += 1
            return calls["n"] > 2  # the browser leaves after two pieces

        with self.assertRaises(SynthesisStopped):
            synthesize(model, "brief", [], should_stop=should_stop)
        self.assertTrue(model.closed)

    def test_no_stop_reads_the_whole_stream_and_closes_it(self):
        model = StreamModel(["a", "b"])
        self.assertEqual(synthesize(model, "brief", [], should_stop=lambda: False), "ab")
        self.assertTrue(model.closed)

    def test_length_finish_reason_on_the_last_chunk_raises(self):
        with self.assertRaisesRegex(SynthesisError, "cut off"):
            synthesize(StreamModel(["partial"], finish_reason="length"), "brief", [])

    def test_empty_stream_raises(self):
        with self.assertRaisesRegex(SynthesisError, "no text"):
            synthesize(StreamModel([""]), "brief", [])

    def test_model_without_stream_falls_back_to_invoke(self):
        self.assertEqual(synthesize(FakeModel("plan"), "brief", []), "plan")


if __name__ == "__main__":
    unittest.main()
