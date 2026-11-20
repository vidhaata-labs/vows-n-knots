import unittest
from datetime import date
from pathlib import Path

from vows_n_knots.brief import BriefError, brief_from_legacy_form, brief_to_text
from vows_n_knots.locations import load_places

FIXTURE = Path(__file__).parent / "fixtures" / "places_sample.csv"


def sample_form(**overrides):
    form = {
        "couple_name": "Amira and Noah",
        "wedding_location": "Chicago, Illinois",
        "wedding_date": date(2027, 7, 15),
        "guest_count": 120,
        "currency": "USD",
        "budget_range": (35000, 65000),
        "ceremony_type": "Ceremony and reception",
        "wedding_styles": ["Modern", "Romantic"],
        "planning_priorities": ["Venue shortlist", "Timeline"],
        "tone": "Elegant and practical",
        "must_haves": "Indoor-outdoor venue, strong vegetarian menu.",
        "constraints": "Avoid venues more than 45 minutes from downtown.",
        "traditions": "Family tea ceremony.",
    }
    form.update(overrides)
    return form


class BriefTest(unittest.TestCase):
    def setUp(self):
        self.places = load_places(FIXTURE)

    def build(self, **overrides):
        return brief_from_legacy_form(sample_form(**overrides), self.places)

    def test_sample_values(self):
        brief = self.build()
        self.assertEqual(brief.state_code, "IL")
        self.assertEqual(brief.state_name, "Illinois")
        self.assertEqual(brief.city_name, "Chicago")
        self.assertEqual(brief.city_id, "1714000")
        self.assertEqual(brief.wedding_year, 2027)
        self.assertEqual(brief.season, "summer")
        self.assertEqual(brief.budget_per_guest, 416.67)
        self.assertEqual(brief.dietary, ("vegetarian",))
        self.assertEqual(brief.indoor_outdoor, "indoor-outdoor")
        self.assertEqual(brief.max_travel_minutes, 45)
        self.assertEqual(brief.currency, "USD")

    def test_state_code_accepted(self):
        self.assertEqual(self.build(wedding_location="chicago, il").state_code, "IL")

    def test_defaults(self):
        brief = self.build(must_haves="", constraints="")
        self.assertEqual(brief.dietary, ())
        self.assertEqual(brief.indoor_outdoor, "either")
        self.assertEqual(brief.max_travel_minutes, 60)

    def test_seasons(self):
        for month, season in ((12, "winter"), (2, "winter"), (3, "spring"), (8, "summer"), (9, "fall"), (11, "fall")):
            self.assertEqual(self.build(wedding_date=date(2027, month, 1)).season, season)

    def test_currency_stored_as_given(self):
        self.assertEqual(self.build(currency="EUR").currency, "EUR")

    def test_unknown_location_rejected(self):
        for location in ("Paris, France", "Chicago, Missouri", "Chicago"):
            with self.assertRaises(BriefError):
                self.build(wedding_location=location)

    def test_invalid_values_rejected(self):
        for overrides in (
            {"guest_count": 5},
            {"guest_count": 1001},
            {"budget_range": (65000, 35000)},
            {"budget_range": (-1, 100)},
            {"currency": "XYZ"},
            {"planning_priorities": ["Karaoke"]},
        ):
            with self.subTest(overrides=overrides):
                with self.assertRaises(BriefError):
                    self.build(**overrides)

    def test_brief_to_text(self):
        text = brief_to_text(self.build())
        self.assertIn("Budget range: USD 35,000 to 65,000", text)
        self.assertIn("Must-haves:", text)
        self.assertIn("Wedding location: Chicago, Illinois", text)
        self.assertIn("Target date: July 15, 2027", text)
        self.assertIn("Requested final plan:", text)
        self.assertIn("Constraints and sensitivities:", text)
        self.assertIn("Cultural, family, or ceremonial details:", text)

    def test_brief_to_text_budget_per_guest(self):
        text = brief_to_text(self.build())
        self.assertIn("Budget per guest (midpoint): USD 416.67", text)
        budget_line = text.index("Budget range:")
        self.assertEqual(text.index("Budget per guest"), text.index("\n", budget_line) + 1)

    def test_requested_sections_follow_selected_priorities(self):
        text = brief_to_text(self.build(planning_priorities=["Timeline", "Venue shortlist"]))
        requested = text.split("Requested final plan:\n", 1)[1].splitlines()
        self.assertEqual(requested, [
            "- Executive summary with the planning concept.",
            "- Venue shortlist.",
            "- Timeline.",
            "- Risks, tradeoffs, and open questions for the couple.",
        ])

    def test_requested_sections_without_priorities(self):
        text = brief_to_text(self.build(planning_priorities=[]))
        requested = text.split("Requested final plan:\n", 1)[1].splitlines()
        self.assertEqual(requested, [
            "- Executive summary with the planning concept.",
            "- Risks, tradeoffs, and open questions for the couple.",
        ])


if __name__ == "__main__":
    unittest.main()
