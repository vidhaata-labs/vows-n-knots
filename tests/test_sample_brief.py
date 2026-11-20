import unittest
from pathlib import Path

from vows_n_knots.brief import brief_from_legacy_form
from vows_n_knots.locations import load_places
from vows_n_knots.sample_brief import sample_form_values

FIXTURE = Path(__file__).parent / "fixtures" / "places_sample.csv"


class SampleBriefTest(unittest.TestCase):
    def test_sample_values_build_a_brief(self):
        brief = brief_from_legacy_form(sample_form_values(), load_places(FIXTURE))
        self.assertEqual(brief.state_code, "IL")
        self.assertEqual(brief.city_name, "Chicago")
        self.assertIn("Venue shortlist", brief.priorities)
        self.assertIn("Budget allocation", brief.priorities)


if __name__ == "__main__":
    unittest.main()
