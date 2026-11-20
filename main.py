"""Run the wedding planner from the repository root."""

import sys
from pathlib import Path

_SRC = Path(__file__).resolve().parent / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from vows_n_knots.main import main

if __name__ == "__main__":
    main()
