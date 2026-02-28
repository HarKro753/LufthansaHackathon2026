# ✈️ LH Travel Agent

AI travel agent built at the **Lufthansa x Google Hackathon 2026**.

## Stack

| Layer | Tech |
|---|---|
| Agent framework | [Google ADK](https://google.github.io/adk-docs/) (Python) |
| LLM | Gemini 2.5 Flash |
| Backend | FastAPI + uvicorn |
| Frontend | Next.js 15 + Bun + Tailwind |

## Setup

### Backend

```bash
cd backend
cp .env.example .env
# Add your GOOGLE_API_KEY to .env

uv sync
uv run uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
bun install
bun run dev
```

Open http://localhost:3000

### Docker

```bash
# Create backend/.env with your keys first
cp backend/.env.example backend/.env

# Build and run both services
docker compose up --build
```

- Backend: http://localhost:8000
- Frontend: http://localhost:3000

## Env

```env
# backend/.env
GOOGLE_GENAI_USE_VERTEXAI=FALSE
GOOGLE_API_KEY=your_google_ai_studio_key
```

Get a key at https://aistudio.google.com/app/apikey
