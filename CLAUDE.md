# LufthansaHackathon2026 — Agent Context

AI travel agent built at the Lufthansa x Google Hackathon 2026. Uses Google ADK (Python backend) + TypeScript frontend. Integrates Lufthansa Open API, HasData Flights, and Google ADK Search Grounding.

## Stack

- **Backend**: Python 3.12 + Google ADK + FastAPI
- **Frontend**: TypeScript + React (optional, for demo UI)
- **APIs**: Lufthansa Open API, HasData Google Flights, Google ADK Search Grounding, Google Places/Routes

## Project Structure

```
src/
  agents/        # ADK agent definitions (root_agent + sub-agents)
  tools/         # Tool functions (thin wrappers — parse args → call service → return dict)
  services/      # Business logic + external API calls (LH API, HasData, etc.)
  models/        # Pydantic models / TypeScript interfaces
  utils/         # Pure functions only — no I/O, no state
backend/         # FastAPI app entry point
.claude/skills/  # Agent skills — read these before working on related tasks
docs/            # API docs, architecture notes
```

## Python Rules

You are a senior Python developer. SOLID + clean code. Readability over quick writing. Test-driven.

### Code Rules

- **Strongly typed** — all functions have type annotations, use Pydantic v2 for data models
- **Async first** — use `async/await` for all I/O (API calls, DB, file reads)
- **Never raise in tools** — return `{"error": "message"}` instead; ADK agents recover from errors
- **Pure utils** — `src/utils/` contains only pure functions, no side effects, no I/O
- **Services hold state and logic** — API clients, business logic, caching live in `src/services/`
- **Tools are thin** — parse ADK tool call args → call service → return dict. No logic in tools.
- **Models in `src/models/`** — no inline Pydantic models in tools or services
- **Docstrings are LLM prompts** — tool docstrings are what ADK's Gemini reads to decide when/how to call the tool. Write them clearly: "Use this when X. Returns Y."
- **Error handling** — always catch exceptions in services, return typed error responses
- **`uv` for dependencies** — use `uv add` not `pip install`; `uv run` to execute

### FastAPI Rules

- Type all request/response bodies with Pydantic models
- Use `async def` for all endpoints
- Return proper HTTP status codes (200/201/400/404/500)
- Pass `CancellationToken` through async chains
- Never expose raw exceptions to clients

## TypeScript Rules

You are a senior TypeScript and React developer. SOLID + clean code. Readability > quick writing. TDD.

### Code Rules

- **No `any`** — ever. Use `unknown` and narrow with guards if needed.
- **Named exports only** — no default exports
- **Explicit if/else** over ternary for complex logic
- **Pure functions** in `src/utils/` — no side effects
- **Types in `src/models/`** — no inline interface definitions elsewhere
- **`const` over `let` over `var`**
- **Meaningful error messages** — include context, not just "Error occurred"
- **`fetch` with proper typing** — always type the response, handle errors explicitly

### Import Rules

- Tools → services/utils/models only
- Services → utils/models only
- Utils → models only
- No circular dependencies
- No barrel imports (`index.ts` re-exports are fine, importing from barrel is not)

## Skills Available

Read these before working on related tasks:

| Skill | When to use |
|---|---|
| `.claude/skills/lufthansa-api/` | Lufthansa flight status, schedules, seat maps, reference data |
| `.claude/skills/hasdata-flights-api/` | Flight search via HasData Google Flights scraper |
| `.claude/skills/adk-python/` | Building ADK agents, tools, multi-agent setup |
| `.claude/skills/adk-google-search-grounding/` | Adding live Google Search to ADK agents |
| `.claude/skills/google-travel-apis/` | Google Places API, Routes API for hotels/directions |
| `.claude/skills/python-fastapi/` | FastAPI patterns, Pydantic v2, async patterns |
| `.claude/skills/travel-agent-apis/` | General travel API patterns |

## API Keys (set in .env)

```env
# Lufthansa
LH_CLIENT_ID=
LH_CLIENT_SECRET=

# HasData
HASDATA_API_KEY=

# Google ADK
GOOGLE_API_KEY=               # Google AI Studio
# OR for Vertex AI:
GOOGLE_GENAI_USE_VERTEXAI=TRUE
GOOGLE_CLOUD_PROJECT=
GOOGLE_CLOUD_LOCATION=
```

## Git Conventions

- Commit after every meaningful change — do not batch everything into one final commit
- Branch naming: `feat/`, `fix/`, `chore/`
- Commit messages: `feat: add flight status tool`, `fix: handle LH API token expiry`
- Push to main (hackathon mode — no PR overhead)

## Notification

When done with any task, run:
```bash
openclaw message send --channel telegram --target 8186358692 --message "✅ Done: LufthansaHackathon2026 — [what you did]"
```
