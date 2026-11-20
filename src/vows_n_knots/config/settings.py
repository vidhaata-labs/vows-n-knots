"""Application settings read from the environment and the project .env file."""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[3]

SUPPORTED_PROVIDERS: tuple[str, ...] = ("google_genai", "groq", "openai", "nvidia")
DEFAULT_PROVIDER = "nvidia"
DEFAULT_CHAT_MODELS: dict[str, str] = {
    "google_genai": "gemini-3.1-flash-lite",
    "groq": "llama-3.1-8b-instant",
    "openai": "gpt-4o-mini",
    "nvidia": "nvidia/nemotron-3-ultra-550b-a55b",
}
MODEL_ENV_VARS: dict[str, str] = {
    "google_genai": "GOOGLE_MODEL",
    "groq": "GROQ_MODEL",
    "openai": "OPENAI_MODEL",
    "nvidia": "NVIDIA_MODEL",
}
PROVIDER_KEY_ENV: dict[str, str] = {
    "google_genai": "GOOGLE_API_KEY",
    "groq": "GROQ_API_KEY",
    "openai": "OPENAI_API_KEY",
    "nvidia": "NVIDIA_API_KEY",
}
LOG_LEVELS: tuple[str, ...] = ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL")


class ConfigurationError(Exception):
    """A setting is missing or outside its allowed set."""


@dataclass(frozen=True)
class Settings:
    """Validated provider, model, and logging settings."""

    llm_provider: str
    chat_model_names: dict[str, str]
    log_level: str


def load_env() -> None:
    """Load the project `.env` file without overriding variables already set."""
    load_dotenv(PROJECT_ROOT / ".env")


def _get(env: Mapping[str, str], name: str) -> str | None:
    """Return the stripped value of `name`, or None when unset or blank."""
    value = env.get(name)
    if value is None or not value.strip():
        return None
    return value.strip()


def load_settings(env: Mapping[str, str] | None = None) -> Settings:
    """Read and validate settings.

    When `env` is None, the project `.env` file is loaded into the process
    environment first and `os.environ` is used.

    Raises:
        ConfigurationError: a value is outside its allowed set.
    """
    if env is None:
        load_env()
        env = os.environ

    provider = (_get(env, "LLM_PROVIDER") or DEFAULT_PROVIDER).lower()
    if provider not in SUPPORTED_PROVIDERS:
        raise ConfigurationError(
            f"LLM_PROVIDER must be one of {', '.join(SUPPORTED_PROVIDERS)}; got {provider!r}."
        )

    chat_models = {
        name: _get(env, MODEL_ENV_VARS[name]) or DEFAULT_CHAT_MODELS[name]
        for name in SUPPORTED_PROVIDERS
    }

    log_level = (_get(env, "LOG_LEVEL") or "INFO").upper()
    if log_level not in LOG_LEVELS:
        raise ConfigurationError(
            f"LOG_LEVEL must be one of {', '.join(LOG_LEVELS)}; got {log_level!r}."
        )

    return Settings(
        llm_provider=provider,
        chat_model_names=chat_models,
        log_level=log_level,
    )
