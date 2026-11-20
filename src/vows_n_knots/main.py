import sys
from pathlib import Path

_SRC = Path(__file__).resolve().parent.parent
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from vows_n_knots.brief import brief_from_legacy_form
from vows_n_knots.cache import SearchCache
from vows_n_knots.config.logging_config import configure_logging, get_logger
from vows_n_knots.config.research import CACHE_PATH
from vows_n_knots.config.settings import PROJECT_ROOT, load_settings
from vows_n_knots.locations import load_places
from vows_n_knots.run import run_plan
from vows_n_knots.sample_brief import sample_form_values

_settings = load_settings()
configure_logging(_settings.log_level)

logger = get_logger(__name__)


def main() -> None:
    logger.info("Asking user for their requirements...")
    typed = input("Please enter your requirements and preferences for your wedding:\n")

    places = load_places(PROJECT_ROOT / "data" / "us_places.csv")
    brief = brief_from_legacy_form({**sample_form_values(), "must_haves": typed}, places)

    logger.info("Running research and synthesis...")
    cache = SearchCache(CACHE_PATH)
    try:
        plan = run_plan(brief, cache=cache)
    finally:
        cache.close()

    print("\nWedding plan: ")
    print(plan.text)


if __name__ == "__main__":
    main()
