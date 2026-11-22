import unittest
from pathlib import Path

from tests.test_brief import sample_form
from vows_n_knots.brief import brief_from_legacy_form
from vows_n_knots.locations import load_places
from vows_n_knots.research import (
    COST_CATEGORIES,
    build_research_tasks,
    count_research_searches,
)

FIXTURE = Path(__file__).parent / "fixtures" / "places_sample.csv"
SAMPLE_PRIORITIES = ["Venue shortlist", "Vendor research", "Budget allocation", "Timeline"]


class ResearchTasksTest(unittest.TestCase):
    def setUp(self):
        self.places = load_places(FIXTURE)

    def build(self, priorities):
        form = sample_form(planning_priorities=priorities)
        return brief_from_legacy_form(form, self.places)

    def sections(self, tasks):
        return [task.section for task in tasks]

    def test_sample_priorities_give_fourteen_tasks(self):
        tasks = build_research_tasks(self.build(SAMPLE_PRIORITIES))
        self.assertEqual(len(tasks), 14)
        self.assertEqual(self.sections(tasks).count("Venue shortlist"), 1)
        self.assertEqual(self.sections(tasks).count("Vendor research"), 3)
        self.assertEqual(self.sections(tasks).count("Budget allocation"), 10)
        self.assertEqual(
            [t.category for t in tasks if t.section == "Budget allocation"], list(COST_CATEGORIES)
        )

    def test_count_matches_the_plan(self):
        brief = self.build(SAMPLE_PRIORITIES + ["Travel logistics"])
        self.assertEqual(count_research_searches(brief), len(build_research_tasks(brief)))

    def test_priority_count_matches_the_plan_for_every_combination(self):
        from itertools import combinations

        from vows_n_knots.brief import PRIORITY_OPTIONS
        from vows_n_knots.research import research_search_count

        for size in range(len(PRIORITY_OPTIONS) + 1):
            for chosen in combinations(PRIORITY_OPTIONS, size):
                with self.subTest(priorities=chosen):
                    brief = self.build(list(chosen))
                    self.assertEqual(
                        research_search_count(chosen), len(build_research_tasks(brief))
                    )

    def test_review_example_is_fifteen_searches(self):
        # The Review wireframe: four priorities, including Travel logistics.
        priorities = ["Venue shortlist", "Vendor research", "Budget allocation", "Travel logistics"]
        self.assertEqual(count_research_searches(self.build(priorities)), 15)

    def test_travel_logistics_adds_one_task(self):
        tasks = build_research_tasks(self.build(SAMPLE_PRIORITIES + ["Travel logistics"]))
        self.assertEqual(len(tasks), 15)
        self.assertEqual(tasks[-1].section, "Travel logistics")
        self.assertEqual(tasks[-1].category, "transport")

    def test_no_priorities_give_no_tasks(self):
        self.assertEqual(build_research_tasks(self.build([])), [])

    def test_timeline_alone_gives_no_tasks(self):
        self.assertEqual(build_research_tasks(self.build(["Timeline"])), [])

    def test_cost_queries_use_reference_year(self):
        tasks = build_research_tasks(self.build(["Budget allocation"]))
        self.assertEqual(len(tasks), 10)
        for task in tasks:
            self.assertEqual(task.cache_class, "price")
            self.assertIn("2026", task.query)
            self.assertNotIn("2027", task.query)

    def test_fixed_priority_order_ignores_selection_order(self):
        tasks = build_research_tasks(
            self.build(["Travel logistics", "Budget allocation", "Vendor research", "Venue shortlist"])
        )
        order = list(dict.fromkeys(self.sections(tasks)))
        self.assertEqual(order, ["Venue shortlist", "Vendor research", "Budget allocation", "Travel logistics"])

    def test_query_templates(self):
        tasks = build_research_tasks(self.build(SAMPLE_PRIORITIES + ["Travel logistics"]))
        queries = {(t.section, t.category): t.query for t in tasks}
        self.assertEqual(
            queries[("Venue shortlist", "venue")],
            "Chicago Illinois wedding venues capacity 120 guests indoor-outdoor within 45 minutes of downtown",
        )
        self.assertEqual(
            queries[("Vendor research", "catering")],
            "Chicago Illinois wedding catering vegetarian 120 guests",
        )
        self.assertEqual(
            queries[("Vendor research", "photography")],
            "Chicago Illinois wedding photographers summer 2027",
        )
        self.assertEqual(
            queries[("Vendor research", "music")],
            "Chicago Illinois wedding live music bands DJ 2027",
        )
        self.assertEqual(
            queries[("Travel logistics", "transport")],
            "Chicago Illinois wedding guest shuttle transportation 120 guests",
        )
        self.assertEqual(
            queries[("Budget allocation", "cake")], "Chicago Illinois average wedding cake cost 2026"
        )

    def test_full_service_when_no_dietary_tags(self):
        form = sample_form(planning_priorities=["Vendor research"], must_haves="")
        tasks = build_research_tasks(brief_from_legacy_form(form, self.places))
        self.assertIn("wedding catering full-service 120 guests", tasks[0].query)

    def test_cache_classes(self):
        tasks = build_research_tasks(self.build(SAMPLE_PRIORITIES + ["Travel logistics"]))
        for task in tasks:
            expected = "price" if task.section == "Budget allocation" else "availability"
            self.assertEqual(task.cache_class, expected)

    def test_deterministic(self):
        brief = self.build(SAMPLE_PRIORITIES)
        self.assertEqual(build_research_tasks(brief), build_research_tasks(brief))


if __name__ == "__main__":
    unittest.main()
