# Backend: Code-Planned Research for Wedding Plans

- **Date:** 2026-11-20
- **Status:** Draft, awaiting approval
- **Scope:** Backend only. The frontend, including the input UX, is a separate design.

## Intent and why

The sample brief run in `logs/tavily_logs.log` took about 785 seconds (about 800 as reported) and made 120 Tavily searches from 10 delegations. The log shows where the calls went:

- 28 searches on one article, one per cost category.
- About 10 searches trying to define "photography-forward schedule", a phrase that comes from the sample brief.
- 5 of 10 delegations covering the same cost research, split between two sub-agents.
- 52 searches using 2024 or 2025 for a 2027 wedding.
- 9 searches for "cost per guest", a figure the UI computes but never passes to the planner.

The model chooses the queries and the number of searches, so both time and calls are unpredictable. This design moves the research plan into code, so the brief determines the searches.

## Scope, as directed

- **Simple, not multi-agent.** Research is a fixed set of tasks built from the brief, followed by one plain model call. There is no agent loop and no org-style hierarchy. The sub-agents leave the search path.
- **Parity with the legacy app.** Every input and output the legacy app has still works: the same brief fields (some restructured as described below), the markdown plan, the download, and saved runs for the session. Until the new frontend replaces `legacy_app.py`, the legacy app should be able to call the new backend.
- **Optimize response time and API calls.** Those are the two measured goals in this design.
- **Existing libraries only.** Use LangChain (`init_chat_model` for the model), `tavily-python` (already installed, including its async client), `python-dotenv`, and Streamlit, plus the Python standard library (`asyncio` and `sqlite3` for the cache). Add no new framework or dependency.

## Goals

- **Run time (proposed):** under 3 minutes cold cache, under 1 minute warm cache, for the sample brief.
- **Tavily calls (proposed):** 15 to 25 per plan on a cold cache, near zero on a warm cache.
- Every price, venue and vendor claim in the plan can be traced to a logged search result.
- The same structured brief always produces the same research tasks.
- Each run reports its search count, cache hits, and time spent in the model and in search, separately.

## Non-goals

- The frontend and input UX (separate design).
- Follow-up searches chosen by the model.
- Persisting plans beyond the cache. Saved runs are a frontend concern.
- Locations outside the US.
- Changing the LLM provider or model.
- Multi-agent or org-style agent hierarchies, and any new framework or dependency.

## Anti-goals

- **Fast but ungrounded:** a plan with prices or venue names that no search result supports.
- **Stale data presented as current:** cached prices shown without their age.
- **Silent gaps:** a research task that fails must mark its section as having no data, not leave it out.

## Constraints

- Python 3.13 project. Agents are built with LangChain `create_agent`.
- Tavily client: `tavily` 1.1.0. The sync client uses `requests`, and `AsyncTavilyClient` uses `aiohttp`. Defaults are `search_depth="basic"` and `max_results=5`. `include_domains` is supported.
- Default model: `nvidia/nemotron-3-ultra-550b-a55b`, built through `create_chat_model`.
- The Tavily key comes from `.env`.
- Location data comes from a US Census Gazetteer snapshot kept in the repo. The app makes no runtime call to a location API.
- `legacy_app.py` imports `prompts`, `agents` and `models` as top-level modules, which don't resolve under the `src/` layout. Fixing these imports is part of this work.

## Approaches

**A. Keep LLM sub-agents with guardrails.** Add a search budget, a shared cache and the async client. This is the smallest change. The model still chooses queries, so the Tavily count stays unpredictable, and each search still needs a round trip through the model.

**B. Code-planned research (chosen).** Code builds the research tasks from the structured brief, runs them in parallel through a cache, and makes one model call to write the plan from the results. The Tavily count is predictable and the model is out of the search loop. The cost is that the model can't chase a lead the plan didn't include.

**C. Hybrid.** B plus at most one bounded follow-up search per section. More flexible, but harder to bound.

**Why B:** the log shows the search loop drives both time and call count, and B removes the model from that loop. C can be added later, once B has been measured.

## Design

### 1. Structured brief

The backend accepts a structured brief object. The form that produces it belongs to the frontend design.

| Group | Fields | Used by |
|---|---|---|
| Location | US state (USPS code), city (Census place ID) | Research and cache keys |
| Wedding | date (reduced to year and season), ceremony type | Research and planner |
| Guests | count | Research (venue capacity) and derived values |
| Budget | total range, currency, derived per-guest value computed in code | Research (cost) and planner |
| Dietary | tags | Catering research |
| Venue requirements | indoor/outdoor, maximum travel minutes | Venue research |
| Priorities | subset of the 8 form options | Selects research tasks and output sections |
| Preferences | tone, styles | Planner only, never searched |
| Notes | must-haves, constraints, traditions (free text) | Planner only, never searched |

**Priority mapping (confirmed):**

| Priority | Research tasks | Planner-only work |
|---|---|---|
| Venue shortlist | Venue search by location, capacity, indoor/outdoor and travel time | |
| Vendor research | Caterer search (by dietary tag), photographer search, music search | |
| Budget allocation | One cost query per category, using the reference year from config | |
| Travel logistics | Transport search | |
| Timeline | | Yes |
| Risk management | | Yes |
| Design direction | | Yes |
| Guest experience | | Yes |

**Photography-forward schedule (proposed, pending confirmation):** the planner interprets the phrase from the notes and runs no search for it. Venue-specific details, such as portrait policy or sunset time, come only from venue research results.

**Cost research (proposed, pending confirmation):** one owner, the research plan. Each cost category gets one query. The budget section reads those results, and no sub-agent repeats them.

### 2. Research plan

- A pure function turns the structured brief into a list of tasks. Each task has a section, a category, a query, and optional `include_domains`.
- Queries come from fixed templates filled from structured fields, in a fixed order, so the same brief always produces the same queries. Text is lowercased and whitespace is collapsed before a query is used.
- Target for the sample brief: 15 to 25 tasks.
- The cost reference year comes from config. The model never picks it.

### 3. Execution

- Tasks run concurrently with `AsyncTavilyClient`, capped by a concurrency limit.
- Each task checks the cache first. On a miss, it calls Tavily and stores the raw response.
- A task that fails after its retry marks its section as "no data" in the results given to synthesis.

### 4. Cache

- **Key:** normalized query, search parameters, and location ID.
- **Store:** a SQLite file in the project (for example `data/cache.sqlite`, gitignored). It survives Streamlit reruns and restarts.
- **Time to live:** 1 day for venue availability and vendor lists; 30 days for prices and cost data. Both are configurable.
- Store the raw Tavily response, not the formatted text, so formatting changes don't invalidate the cache.

### 5. Synthesis

- One model call with no tools. Its input is the compact structured brief, the planner prompt, and the research results grouped by section.
- Each result keeps its URL. The prompt requires a source for every figure and every venue or vendor claim.
- The sub-agent objects and the `delegate_to_sub_agent_*` tools leave this flow. This follows from B.

### 6. Interface with the frontend

- `run_plan(brief, on_progress) -> Plan`
- Progress events: `task_started`, `task_finished` (with a cache-hit flag), `synthesis_started`, `done`, `failed`.
- `Plan` contains the markdown text, a status for each section (ok or no data), and a run summary: searches, cache hits, model seconds, search seconds, total seconds.

### 7. Measurement

- Each run logs model time and search time separately. The current log can't separate them.
- Acceptance: run the sample brief cold and then warm, and report search count, cache hits and times against the targets above.

## Calls made in this draft (for review)

- **Output sections** follow the selected priorities, plus an executive summary and risks.
- **Shortlist size:** 3 to 5 venues.
- **Cost categories:** venue, catering, photography, videography, music, flowers, attire, cake, transport, invitations.
- **Dietary tags:** vegetarian, vegan, gluten-free, halal, kosher, other.
- **Concurrency limit:** 5.
- **Retry:** one retry on a transient error.
- **Result size:** `max_results` 5 per task, with content trimmed before synthesis.

## Decisions after approval

The author answered the open items after approving the design.

- **Currency:** the legacy selector stays (EUR, GBP, CAD, AUD, USD), for parity. The plan states that its prices are US-based figures.
- **Scope:** the 50 states plus DC. Territories are excluded. The Census snapshot is filtered to these.
- **Cost reference year:** 2026, the current year, set in config. Current-year cost data may be sparse, so the cost results should be checked during measurement.
- **Photography-forward handling, cost ownership and targets:** confirmed as proposed. The measurement step tests the targets.

## Left to the builder

Module layout, prompt wording, SQLite schema, async runner details, and test approach.
