"""Settings for web research: cache lifetimes, concurrency and search options."""

from vows_n_knots.config.settings import PROJECT_ROOT

COST_REFERENCE_YEAR = 2026
TTL_AVAILABILITY_SECONDS = 86_400
TTL_PRICE_SECONDS = 30 * 86_400
CONCURRENCY = 5
RETRIES = 1
MAX_RESULTS = 5
SEARCH_DEPTH = "basic"
SYNTHESIS_MAX_OUTPUT_TOKENS = 16384
SYNTHESIS_TIMEOUT_SECONDS = 600
SYNTHESIS_SNIPPET_CHARS = 300
CACHE_PATH =PROJECT_ROOT / "data" / "cache.sqlite"
