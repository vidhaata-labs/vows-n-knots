import tempfile
import unittest
from pathlib import Path

from vows_n_knots.cache import SearchCache, make_cache_key

PARAMS = {"num": 10, "gl": "us"}


class CacheKeyTest(unittest.TestCase):
    def test_normalized_query_gives_same_key(self):
        a = make_cache_key('Chicago "venues"  120', PARAMS, "IL-1714000")
        b = make_cache_key("chicago venues 120", PARAMS, "IL-1714000")
        self.assertEqual(a, b)

    def test_different_location_gives_different_key(self):
        a = make_cache_key("chicago venues", PARAMS, "IL-1714000")
        b = make_cache_key("chicago venues", PARAMS, "IL-1714001")
        self.assertNotEqual(a, b)


class SearchCacheTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dir = Path(self.tmp.name)

    def test_set_then_get_round_trips(self):
        cache = SearchCache(None)
        self.addCleanup(cache.close)
        cache.set("k", {"a": [1, 2]}, ttl_seconds=60, now=100.0)
        self.assertEqual(cache.get("k", now=120.0), {"a": [1, 2]})

    def test_get_entry_returns_the_time_written(self):
        cache = SearchCache(None)
        self.addCleanup(cache.close)
        cache.set("k", {"a": 1}, ttl_seconds=60, now=100.0)
        self.assertEqual(cache.get_entry("k", now=120.0), ({"a": 1}, 100.0))
        self.assertIsNone(cache.get_entry("k", now=161.0))
        self.assertIsNone(cache.get_entry("missing", now=120.0))

    def test_empty_response_is_a_hit(self):
        cache = SearchCache(None)
        self.addCleanup(cache.close)
        cache.set("k", {}, ttl_seconds=60, now=100.0)
        self.assertEqual(cache.get("k", now=101.0), {})

    def test_expired_entry_is_a_miss(self):
        cache = SearchCache(None)
        self.addCleanup(cache.close)
        cache.set("k", {"a": 1}, ttl_seconds=60, now=100.0)
        self.assertIsNone(cache.get("k", now=161.0))

    def test_persists_in_nested_path(self):
        path = self.dir / "sub" / "cache.db"
        cache = SearchCache(path)
        cache.set("k", {"a": 1}, ttl_seconds=60, now=100.0)
        cache.close()
        reopened = SearchCache(path)
        self.addCleanup(reopened.close)
        self.assertEqual(reopened.get("k", now=110.0), {"a": 1})

    def test_garbage_file_is_a_miss_without_raising(self):
        path = self.dir / "garbage.db"
        path.write_bytes(b"this is not a sqlite database" * 100)
        with self.assertLogs("vows_n_knots.cache", level="WARNING"):
            cache = SearchCache(path)
            self.addCleanup(cache.close)
            self.assertIsNone(cache.get("k"))
            cache.set("k", {"a": 1}, ttl_seconds=60)
            self.assertIsNone(cache.get("k"))

    def test_parent_is_a_file_is_disabled_without_raising(self):
        parent = self.dir / "afile"
        parent.write_text("x")
        with self.assertLogs("vows_n_knots.cache", level="WARNING"):
            cache = SearchCache(parent / "cache.db")
            self.addCleanup(cache.close)
            self.assertIsNone(cache.get("k"))

    def test_invalid_json_row_is_a_miss(self):
        cache = SearchCache(None)
        self.addCleanup(cache.close)
        cache._conn.execute(
            "INSERT INTO searches (key, response, stored_at, expires_at) VALUES (?, ?, ?, ?)",
            ("k", "{not json", 0.0, 1e12),
        )
        with self.assertLogs("vows_n_knots.cache", level="WARNING"):
            self.assertIsNone(cache.get("k", now=1.0))


if __name__ == "__main__":
    unittest.main()
