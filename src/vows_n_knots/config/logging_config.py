"""Project-wide logging setup: stdout plus a rotating file in logs/."""

from __future__ import annotations

import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
LOG_DIR = PROJECT_ROOT / "logs"
LOG_FILE = LOG_DIR / "vows_n_knots.log"
LOG_FORMAT = (
    "%(asctime)s | %(levelname)-8s | %(name)s\n"
    "    %(pathname)s:%(lineno)d in %(funcName)s()\n"
    "    pid=%(process)d tid=%(thread)d | %(message)s"
)
LOG_DATEFMT = "%Y-%m-%d %H:%M:%S"


def configure_logging(level: str | None = None) -> None:
    """Configure root logging once, writing to stdout and logs/.

    When `level` is None the `LOG_LEVEL` environment variable is used (default INFO).
    """
    resolved = (level or os.getenv("LOG_LEVEL", "INFO")).upper()
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    formatter = logging.Formatter(LOG_FORMAT, datefmt=LOG_DATEFMT)

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)

    file_handler = RotatingFileHandler(
        LOG_FILE,
        maxBytes=5 * 1024 * 1024,
        backupCount=3,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)

    logging.basicConfig(
        level=resolved,
        handlers=[stream_handler, file_handler],
        force=True,
    )


def get_logger(name: str) -> logging.Logger:
    """Return a module-scoped logger."""
    return logging.getLogger(name)
