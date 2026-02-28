# ✈️ LufthansaHackathon2026

AI travel agent built at the **Lufthansa x Google Hackathon 2026**.

## What it does

A multi-agent travel assistant that combines:
- **Lufthansa Open API** — real-time flight status, schedules, seat maps
- **HasData Google Flights** — flight search across all airlines
- **Google ADK + Gemini** — reasoning, tool use, live search grounding
- **Google Places & Routes** — hotels, restaurants, directions

## Stack

| Layer | Tech |
|---|---|
| Agent framework | [Google ADK](https://google.github.io/adk-docs/) (Python) |
| LLM | Gemini 2.5 Flash |
| Backend API | FastAPI |
| Flight data | [Lufthansa Open API](https://developer.lufthansa.com) + [HasData](https://hasdata.com) |
| Live search | ADK Google Search Grounding |
| Travel data | Google Places API, Google Routes API |

## Project Structure

```
src/
  agents/     # ADK agent definitions
  tools/      # Tool functions (ADK tool registry)
  services/   # Business logic + API clients
  models/     # Pydantic models
  utils/      # Pure helper functions
backend/      # FastAPI entry point
.claude/      # AI agent context + skills
docs/         # API docs
```

## Setup

```bash
# Install dependencies
uv sync

# Set env vars
cp .env.example .env
# Edit .env with your API keys

# Run backend
uv run uvicorn backend.main:app --reload

# Run agent CLI
uv run python -m src.agents.main
```

## Env Variables

```env
LH_CLIENT_ID=           # Lufthansa API key
LH_CLIENT_SECRET=       # Lufthansa API secret
HASDATA_API_KEY=        # HasData API key
GOOGLE_API_KEY=         # Google AI Studio key (or Vertex AI config)
GOOGLE_MAPS_API_KEY=    # Google Places + Routes
```

## Built at

Lufthansa x Google Hackathon — Hamburg, February 2026
