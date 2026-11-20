"""Route chat-model construction by provider name.

The provider comes from `LLM_PROVIDER` unless the caller passes one.
Wired providers: google_genai, groq, openai, nvidia.
NVIDIA uses init_chat_model(model_provider="nvidia", ...).
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from typing import Any

from vows_n_knots.config.settings import (
    PROVIDER_KEY_ENV,
    SUPPORTED_PROVIDERS,
    ConfigurationError,
    load_settings,
)

_MODELS: dict[tuple[str, str], Any] = {}


def create_chat_model(
    provider: str | None = None,
    model: str | None = None,
    env: Mapping[str, str] | None = None,
) -> Any:
    """Build the LangChain chat model for the selected provider.

    `provider` overrides `LLM_PROVIDER`. `model` overrides that provider's
    configured model name. Repeated calls with the same provider and model
    return the same instance.

    Raises:
        ConfigurationError: the provider is unsupported, or its API key is unset.
    """
    settings = load_settings(env)
    source = os.environ if env is None else env
    selected = (provider if provider is not None else settings.llm_provider).strip().lower()
    if selected not in SUPPORTED_PROVIDERS:
        raise ConfigurationError(
            f"Provider must be one of {', '.join(SUPPORTED_PROVIDERS)}; got {selected!r}."
        )

    model_name = (model or settings.chat_model_names[selected]).strip()
    _require_api_key(selected, model_name, source)

    cache_key = (selected, model_name)
    cached = _MODELS.get(cache_key)
    if cached is None:
        cached = _build_chat_model(selected, model_name)
        _MODELS[cache_key] = cached
    return cached


def _require_api_key(provider: str, model: str, env: Mapping[str, str]) -> None:
    key_name = PROVIDER_KEY_ENV[provider]
    if not (env.get(key_name) or "").strip():
        raise ConfigurationError(f"{key_name} is not set, so {model} cannot be used.")


def _build_chat_model(provider: str, model: str) -> Any:
    from langchain.chat_models import init_chat_model

    return init_chat_model(model_provider=provider, model=model)
