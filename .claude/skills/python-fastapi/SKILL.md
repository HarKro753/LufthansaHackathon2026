# Python FastAPI Best Practices

Modern Python backend patterns with full type safety. Use for any Python API service.

## Stack

- **FastAPI** — async HTTP + WebSocket framework
- **Pydantic v2** — data validation + serialization
- **uv** — package manager (replaces pip/poetry)
- **aiosqlite** — async SQLite
- **httpx** — async HTTP client
- **uvicorn** — ASGI server

## Project Structure

```
backend/
  src/
    main.py          # FastAPI app, lifespan, router mounts
    models.py        # Pydantic models (request/response schemas)
    db.py            # Database setup + queries
    routers/
      agents.py      # /agents routes
      messages.py    # /messages routes
    services/
      openclaw.py    # OpenClaw client wrapper
  pyproject.toml
  .python-version
```

## pyproject.toml

```toml
[project]
name = "backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.115.0",
  "uvicorn[standard]>=0.30.0",
  "pydantic>=2.8.0",
  "httpx>=0.27.0",
  "aiosqlite>=0.20.0",
]

[project.optional-dependencies]
dev = ["ruff", "pyright", "pytest-asyncio", "httpx"]

[tool.ruff.lint]
select = ["E", "F", "I", "UP"]

[tool.pyright]
pythonVersion = "3.12"
typeCheckingMode = "basic"
```

## App Entry Point

```python
# main.py
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db
from .routers import agents, messages


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    await init_db()
    yield


app = FastAPI(title="My Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents.router, prefix="/agents")
app.include_router(messages.router, prefix="/messages")
```

## Pydantic Models

```python
# models.py
from datetime import datetime
from pydantic import BaseModel, Field
from uuid import UUID, uuid4


class AgentRegister(BaseModel):
    name: str
    gateway_url: str
    gateway_token: str
    session_key: str


class Agent(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    name: str
    gateway_url: str
    session_key: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class MessageSend(BaseModel):
    from_agent_id: UUID
    to_agent_id: UUID
    content: str


class Message(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    from_agent_id: UUID
    to_agent_id: UUID
    content: str
    delivered: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

## Database (aiosqlite)

```python
# db.py
import aiosqlite
from pathlib import Path

DB_PATH = Path("data.db")


async def init_db() -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS agents (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                gateway_url TEXT NOT NULL,
                gateway_token TEXT NOT NULL,
                session_key TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                from_agent_id TEXT NOT NULL,
                to_agent_id TEXT NOT NULL,
                content TEXT NOT NULL,
                delivered INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
        """)
        await db.commit()


async def get_db() -> aiosqlite.Connection:
    return aiosqlite.connect(DB_PATH)
```

## Router Pattern

```python
# routers/agents.py
from uuid import UUID
from fastapi import APIRouter, HTTPException
import aiosqlite
from ..models import Agent, AgentRegister
from ..db import DB_PATH

router = APIRouter(tags=["agents"])


@router.post("/", response_model=Agent)
async def register_agent(body: AgentRegister) -> Agent:
    agent = Agent(name=body.name, gateway_url=body.gateway_url, session_key=body.session_key)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO agents (id, name, gateway_url, gateway_token, session_key, created_at) VALUES (?,?,?,?,?,?)",
            (str(agent.id), agent.name, body.gateway_url, body.gateway_token, body.session_key, agent.created_at.isoformat()),
        )
        await db.commit()
    return agent


@router.get("/", response_model=list[Agent])
async def list_agents() -> list[Agent]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM agents ORDER BY created_at DESC")
        rows = await cursor.fetchall()
    return [Agent(**dict(row)) for row in rows]
```

## WebSocket Pattern

```python
# routers/ws.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json

router = APIRouter()

connected: dict[str, WebSocket] = {}


@router.websocket("/ws/{agent_id}")
async def agent_ws(websocket: WebSocket, agent_id: str) -> None:
    await websocket.accept()
    connected[agent_id] = websocket
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            # broadcast to all or route to specific agent
            await websocket.send_json({"type": "ack", "id": msg.get("id")})
    except WebSocketDisconnect:
        connected.pop(agent_id, None)
```

## Running

```bash
# Install uv first: curl -LsSf https://astral.sh/uv/install.sh | sh
uv sync
uv run uvicorn src.main:app --reload --port 8000
```

## Type Checking Rules

- All functions must have return type annotations
- Use `dict[str, Any]` not `Dict[str, Any]` (Python 3.10+)
- Use `list[X]` not `List[X]`
- Use `X | None` not `Optional[X]`
- Use `from __future__ import annotations` only if needed for forward refs
- Pydantic models: always inherit from `BaseModel`, never use `dict` for structured data
- No `Any` unless truly unavoidable — use TypedDict or Pydantic models instead
