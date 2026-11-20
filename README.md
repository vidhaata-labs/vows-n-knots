# Vows n Knots

Vows n Knots | A multi-agent AI wedding planner built with LangChain. Specialized agents collaborate on venue scouting, budget splits, catering, and schedules.

## Features

- **Main wedding planner agent** that coordinates the planning workflow from user requirements.
- **Sub-agents** that delegate web research (venue, catering, budget, scheduling) via Tavily search.
- **Pluggable LLM provider** (Google GenAI, Groq, OpenAI, NVIDIA) configured through environment variables.
- **Structured logging** to stdout and a rotating file under `logs/`.
- **Package entry point** via `python main.py` from the repository root.

## Project structure

```
vows-n-knots/
├── main.py                  # Repository-root runner: python main.py
├── pyproject.toml           # Packaging metadata and dependencies
├── .env.example             # Copy to .env and fill in API keys (never commit .env)
├── src/vows_n_knots/
│   ├── __init__.py          # Package marker
│   ├── main.py              # Main agent construction and invocation
│   ├── agents.py            # Sub-agents and delegation tools
│   ├── prompts.py           # Agent system and user prompts
│   ├── tools.py             # Web search tool (Tavily)
│   ├── adapters/
│   │   ├── __init__.py
│   │   └── model.py         # LLM provider routing (init_chat_model)
│   └── config/
│       ├── __init__.py
│       ├── logging_config.py# Stdout + rotating file logging
│       └── settings.py      # Environment-driven settings validation
├── docs/
│   └── ux/                  # Reserved for UX artifacts
├── logs/                    # Rotating application log (gitignored)
└── .venv/                   # Virtual environment (gitignored)
```

## Setup

### 1. Install dependencies

The project targets Python 3.13 and is managed with [uv](https://github.com/astral-sh/uv).

```powershell
# Create and sync the virtual environment
uv sync

# Activate it
.venv\Scripts\Activate.ps1
```

### 2. Configure environment variables

Copy the example file and fill in the keys for the provider you intend to use, plus the Tavily key used by web search:

```powershell
copy .env.example .env
# Edit .env and set LLM_PROVIDER, the matching API key, and TAVILY_API_KEY
```

Never commit `.env`; it is already listed in `.gitignore`.

Supported `LLM_PROVIDER` values: `google_genai`, `groq`, `openai`, `nvidia` (default `nvidia`).

## Usage

Run the planner from the repository root:

```powershell
python main.py
```

You will be prompted to enter your wedding requirements and preferences. The main agent then coordinates its sub-agents to research venues, catering, budget splits, and scheduling, and prints the final plan.

## Architecture

- `src/vows_n_knots/main.py` — builds the `MainWeddingPlannerAgent` with two delegation tools and invokes it with the user's requirements.
- `src/vows_n_knots/agents.py` — constructs `SubAgent1` and `SubAgent2`, each equipped with the `search_web` tool, and exposes `delegate_to_sub_agent_1` / `delegate_to_sub_agent_2`.
- `src/vows_n_knots/tools.py` — `search_web` tool backed by Tavily, returning formatted results.
- `src/vows_n_knots/adapters/model.py` — `create_chat_model` routes model construction by provider via LangChain's `init_chat_model`, with per-provider/model instance caching.
- `src/vows_n_knots/config/settings.py` — reads and validates `LLM_PROVIDER`, model names, and `LOG_LEVEL` from the environment.
- `src/vows_n_knots/config/logging_config.py` — configures root logging once, writing to stdout and `logs/vows_n_knots.log`.

## License

See [LICENSE](LICENSE).
