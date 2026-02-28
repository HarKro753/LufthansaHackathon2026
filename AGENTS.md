# LufthansaHackathon2026 — Agent Context

AI travel agent built at the Lufthansa x Google Hackathon 2026.

**Stack:** Python 3.12 + Google ADK + FastAPI (backend) · TypeScript + React (frontend/demo UI)
**APIs:** Lufthansa Open API · HasData Google Flights · Google ADK Search Grounding · Google Places/Routes

## Project Structure

```
src/
  agents/     # ADK agent definitions (root_agent + sub-agents)
  tools/      # Tool functions — thin wrappers only
  services/   # Business logic + external API clients
  models/     # Pydantic models / TypeScript interfaces — types only, no logic
  utils/      # Pure functions only — no I/O, no state
backend/      # FastAPI entry point
.claude/skills/ # Read the relevant skill before implementing any API integration
docs/
```

## Skills — Read Before Implementing

| Skill | Use when |
|---|---|
| `.claude/skills/lufthansa-api/` | Flight status, schedules, seat maps, reference data, cargo, MQTT |
| `.claude/skills/hasdata-flights-api/` | Searching flights across all airlines |
| `.claude/skills/adk-python/` | Building ADK agents, defining tools, multi-agent setup |
| `.claude/skills/adk-google-search-grounding/` | Adding live Google Search to ADK agents |
| `.claude/skills/google-travel-apis/` | Google Places (hotels, restaurants) + Routes (directions) |
| `.claude/skills/python-fastapi/` | FastAPI patterns, Pydantic v2, async endpoints |
| `.claude/skills/travel-agent-apis/` | General travel API patterns |
| `.claude/skills/brightdata-google-hotels/` | Scrape Google Hotels prices via Bright Data SERP API |

## API Keys (.env)

```env
LH_CLIENT_ID=
LH_CLIENT_SECRET=
HASDATA_API_KEY=
GOOGLE_API_KEY=
GOOGLE_MAPS_API_KEY=
```

---

## Python Rules

Apply when working on any `.py` file — `src/`, `backend/`, tests.

You are a senior Python developer with expertise in SOLID principles and clean code.
You prioritize code that is easy to read over code that is quick to write.
Your coding practice is test-driven development.

<project-structure>
- src/agents/     ADK Agent definitions — root_agent and sub-agents
- src/tools/      Tool layer — one file per tool, thin wrappers only
- src/services/   Business logic — API clients, state, external I/O
- src/models/     Pydantic v2 models — types only, no logic
- src/utils/      Pure functions — no I/O, no state, no side effects
- backend/        FastAPI app — routing, middleware, entry point
</project-structure>

<rules>
- strongly typed — all functions have type annotations, use Pydantic v2 for all data models
- async first — use async/await for all I/O (API calls, DB reads, file access)
- never raise exceptions in ADK tools — return {"error": "descriptive message"} so the agent can recover
- pure utils — src/utils/ contains only pure functions, zero side effects, zero I/O
- services own logic and state — API clients, caching, business rules live in src/services/
- tools are thin wrappers — parse ADK tool call args → call service → return dict. Zero logic in tools.
- all types in src/models/ — no inline Pydantic models inside tools or services
- docstrings are LLM prompts — ADK's Gemini reads tool docstrings to decide when/how to call the tool. Write them as: "Use this when X. Args: Y. Returns Z."
- use uv for dependencies — uv add not pip install, uv run to execute
- meaningful error messages — include context, not just "Error"
- colocate tests with source files — tool.py → tool_test.py
</rules>

<python-tools>
- tools import service namespaces directly
- tools are readable at a glance — what it does without reading service code
- parameter type annotations generate the ADK JSON schema automatically — annotate everything
- return dict always — never raw objects, never raise
</python-tools>

<python-services>
- services contain business logic, state, and all external API calls
- pass identifying params (like session_id) to service methods — don't return closures or wrapper instances
- cache expensive resources (e.g. LH OAuth tokens) inside the service
</python-services>

<python-imports>
- tools → services, utils, models
- services → utils, models
- utils → models only
- no circular dependencies
</python-imports>

<fastapi>
- type all request/response bodies with Pydantic models
- async def for all endpoints
- proper HTTP status codes (200/201/400/404/500)
- never expose raw exceptions or stack traces to clients
- use dependency injection for shared resources (DB, API clients)
</fastapi>

---

## TypeScript Rules

Apply when working on any `.ts` or `.tsx` file.

You are a senior TypeScript and React developer with expertise in SOLID and clean code principles.
You prioritize code that is easy to read over code that is quick to write.
Your coding practice is test-driven development.

<project-structure>
- src/ (Frontend)
  - app/          Next.js app router pages
  - components/   Reusable UI components
  - hooks/        Custom React hooks
  - utils/        Pure utility functions
  - constants/    Application constants
  - middleware.ts Route protection

- packages/backend/src/ (Backend — if TypeScript backend used)
  - agent/        Agent orchestration (loop.ts, prompt.ts, session.ts)
  - tools/        Tool layer — one namespace per tool
  - services/     Business logic — one namespace per service
  - models/       Types only — plain exported interfaces, NO namespaces
  - utils/        Pure functions — one namespace per file
  - index.ts      Entry point — namespace-free
  - api.ts        HTTP routing (namespace Api)
  - config.ts     Env loading (namespace Config)
</project-structure>

<rules>
- prefer explicit if/else blocks over inline ternary operators for complex logic
- write strongly typed code — never use the any type
- if possible use const, otherwise let, never var
- if possible write pure functions
- use named exports — no default exports
- do not create container classes — export individual constants and functions
- use import type when importing symbols only as types
- use export type when re-exporting types
- all class fields should be private — expose via getter and setter methods
- models are a central data model throughout the whole codebase — don't mix with services/tools/utils
- don't define many small models — prefer a single model with nested smaller models
- services contain logic — not components, not utils
- keep directory structure flat — only 1 level deep
- separate hooks into dedicated files under hooks/
- default to server components — add use client only when necessary
- prefer CSS animations over JavaScript-driven animations
- debounce expensive event handlers (search, resize, scroll)
- use direct path imports instead of barrel imports
- provide meaningful error messages for users and developers
- catch errors at UI level unless there is a specific reason not to
- do not write inline comments unless intent is genuinely unclear (95% of code is self-explaining)
</rules>

<backend-namespaces>
- every backend file MUST wrap ALL exports in a single export namespace
- ONLY exceptions: models/ files and index.ts
- NOTHING lives outside the namespace — no constants, no helpers, no side-effect calls
- private helpers go inside the namespace as non-exported members
- models/ files NEVER have namespaces — plain exported interfaces/types only
</backend-namespaces>

<backend-imports>
- tools → services, utils, models
- services → utils, models
- utils → models only
- models → models only
- NO circular dependencies
</backend-imports>

<security>
- validate and sanitize all user inputs server-side
- use HttpOnly cookies for sensitive tokens — never localStorage for JWTs
- never expose sensitive environment variables to the client (NEXT_PUBLIC_ exposes them)
- implement CSRF protection for mutations
- use middleware.ts for route protection
- implement rate limiting on auth endpoints
- use parameterized queries to prevent SQL injection
- never expose stack traces or internal error details to users
</security>

<next-js>
- prefer Next.js components over plain HTML elements
- configure fetch caching explicitly — cache: 'force-cache' or 'no-store'
- avoid accessing cookies/headers in layouts (makes them dynamic)
- use middleware.ts for route protection
</next-js>

---

## Git Conventions

- commit after every meaningful change — do not batch into one final commit
- push to main (hackathon mode — skip PR overhead)
- commit format: `feat: add flight status tool`, `fix: LH token expiry handling`, `chore: add env example`

## Notification

When done with any task:
```bash
openclaw message send --channel telegram --target 8186358692 --message "✅ Done: LufthansaHackathon2026 — [what you did]"
```
