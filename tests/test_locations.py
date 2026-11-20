import unittest
from pathlib import Path

from vows_n_knots.locations import US_STATES, Place, find_place, load_places, normalize_city

FIXTURE = Path(__file__).parent / "fixtures" / "places_sample.csv"


class LocationsTest(unittest.TestCase):
    def setUp(self):
        self.places = load_places(FIXTURE)

    def test_us_states(self):
        self.assertEqual(len(US_STATES), 51)
        self.assertIn("DC", US_STATES)
        self.assertNotIn("PR", US_STATES)

    def test_load_places(self):
        self.assertEqual(len(self.places), 14)
        self.assertTrue(all(isinstance(p, Place) for p in self.places))

    def test_find_place_ignores_case_and_legal_suffix(self):
        place = find_place(self.places, "IL", "chicago")
        self.assertEqual(place.place_id, "1714000")

    def test_find_place_missing(self):
        self.assertIsNone(find_place(self.places, "IL", "Paris"))

    def test_find_place_is_scoped_to_state(self):
        self.assertEqual(find_place(self.places, "MO", "Springfield").place_id, "2965000")

    def test_find_place_multiword_name_ending_in_suffix_word(self):
        self.assertEqual(find_place(self.places, "OK", "Oklahoma City").place_id, "4055000")

    def test_find_place_balance_and_government_type(self):
        self.assertEqual(find_place(self.places, "TN", "Nashville").place_id, "4752006")
        self.assertEqual(find_place(self.places, "IN", "Indianapolis").place_id, "1836003")
        self.assertEqual(find_place(self.places, "AK", "Anchorage").place_id, "0203000")

    def test_find_place_urban_prefix(self):
        self.assertEqual(find_place(self.places, "HI", "Honolulu").place_id, "1571550")

    def test_find_place_city_city(self):
        self.assertEqual(find_place(self.places, "ID", "Boise").place_id, "1608830")
        self.assertEqual(find_place(self.places, "ID", "Boise City").place_id, "1608830")

    def test_find_place_saint_and_st_are_equivalent(self):
        for name in ("Saint Louis", "St. Louis", "St Louis"):
            with self.subTest(name=name):
                self.assertEqual(find_place(self.places, "MO", name).place_id, "2964999")

    def test_find_place_prefers_incorporated_over_cdp(self):
        self.assertEqual(find_place(self.places, "AZ", "Cottonwood").place_id, "0416410")

    def test_find_place_exact_wins_over_stripped_input(self):
        self.assertEqual(find_place(self.places, "IL", "Mason City").place_id, "1747475")
        self.assertEqual(find_place(self.places, "IL", "Mason").place_id, "1747449")

    def test_normalize_city(self):
        self.assertEqual(normalize_city("Chicago city"), "chicago")
        self.assertEqual(normalize_city("Oklahoma City city"), "oklahoma city")
        self.assertEqual(normalize_city("City"), "city")
        self.assertEqual(normalize_city("  New   York "), "new york")
        self.assertEqual(
            normalize_city("Nashville-Davidson metropolitan government (balance)"),
            "nashville-davidson",
        )
        self.assertEqual(normalize_city("Indianapolis city (balance)"), "indianapolis")
        self.assertEqual(normalize_city("Juneau city and borough"), "juneau")
        self.assertEqual(normalize_city("Lexington-Fayette urban county"), "lexington-fayette")
        self.assertEqual(normalize_city("St. Louis city"), "saint louis")


if __name__ == "__main__":
    unittest.main()
