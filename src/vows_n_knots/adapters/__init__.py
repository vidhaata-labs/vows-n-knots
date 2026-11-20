"""External service adapters."""

from vows_n_knots.adapters.model import create_chat_model
from vows_n_knots.config.settings import ConfigurationError

__all__ = ["ConfigurationError", "create_chat_model"]
