---
name: adk-python
description: Build AI agents with Google's Agent Development Kit (ADK) for Python. Use when creating agents with Gemini models, defining tools, building multi-agent systems, managing session state, or running agents locally. Python only.
---

# Google ADK — Python

Build production-grade AI agents with Google's Agent Development Kit. Agents are powered by Gemini models, equipped with tools, and composable into multi-agent hierarchies.

Docs: https://google.github.io/adk-docs/
Source: https://github.com/google/adk-python

## Requirements

- Python 3.10+
- `pip install google-adk`
- Gemini API key (Google AI Studio) OR Google Cloud project (Vertex AI)

## Project Structure

```
my_project/
  my_agent/
    __init__.py     # from . import agent
    agent.py        # root_agent definition lives here
    .env            # API keys
```

Create with CLI:
```bash
adk create my_agent
```

Or manually:
```bash
mkdir my_agent
echo "from . import agent" > my_agent/__init__.py
touch my_agent/agent.py my_agent/.env
```

## Auth

### Google AI Studio (simplest)
```env
# my_agent/.env
GOOGLE_GENAI_USE_VERTEXAI=FALSE
GOOGLE_API_KEY=your_key_here
```
Get key: https://aistudio.google.com/app/apikey

### Vertex AI (production)
```env
GOOGLE_GENAI_USE_VERTEXAI=TRUE
GOOGLE_CLOUD_PROJECT=your_project_id
GOOGLE_CLOUD_LOCATION=us-central1
```
Then: `gcloud auth login` + enable Vertex AI API.

## Minimal Agent

```python
# agent.py
from google.adk.agents import Agent

root_agent = Agent(
    name="my_agent",
    model="gemini-2.5-flash",
    description="What this agent does (used by parent agents for routing).",
    instruction="You are a helpful assistant. Be concise.",
)
```

**Required:** `name`, `model`
**Recommended:** `description` (needed for multi-agent routing), `instruction`

## Defining Tools

ADK auto-wraps Python functions as tools. The docstring IS the tool description — write it for the LLM.

```python
from google.adk.agents import Agent

def search_flights(origin: str, destination: str, date: str) -> dict:
    """Search for available flights between two airports on a given date.
    
    Args:
        origin: IATA airport code for departure (e.g. 'HAM', 'LHR')
        destination: IATA airport code for arrival (e.g. 'CPH', 'JFK')
        date: Travel date in YYYY-MM-DD format
    
    Returns dict with flight options and prices.
    """
    # your implementation
    return {"flights": [...], "cheapest": 89}

def get_weather(city: str) -> dict:
    """Get current weather for a city. Use when the user asks about weather."""
    return {"city": city, "temp": 18, "condition": "cloudy"}

root_agent = Agent(
    name="travel_agent",
    model="gemini-2.5-flash",
    description="Helps users plan trips — flights, weather, and itineraries.",
    instruction="""You help users plan travel.
Use search_flights when they ask about flights.
Use get_weather when they ask about weather at a destination.
Always confirm trip details before searching.""",
    tools=[search_flights, get_weather],
)
```

**Rules for tools:**
- Type-annotate ALL parameters — ADK generates the JSON schema from annotations
- Return `dict` or `str` — not raw objects
- On error: return `{"error": "message"}` — never raise exceptions in tools
- Docstring = LLM's only guide to when/how to call the tool

## Session State

Persist data across turns within a session. Access via `tool_context.state`.

```python
from google.adk.tools import ToolContext

def save_user_preference(preference: str, tool_context: ToolContext) -> dict:
    """Save a user preference for later use in the conversation."""
    tool_context.state["user_preference"] = preference
    return {"saved": True}

def get_user_preference(tool_context: ToolContext) -> dict:
    """Retrieve the user's saved preference."""
    pref = tool_context.state.get("user_preference", "not set")
    return {"preference": pref}
```

Inject state into instructions using `{var}` syntax:
```python
root_agent = Agent(
    instruction="User's preferred language: {language?}. Always respond in that language if set.",
    # {language?} — the ? means don't error if missing
)
```

## Multi-Agent Systems

Compose agents into hierarchies. Parent delegates to children based on `description`.

```python
from google.adk.agents import Agent

flight_agent = Agent(
    name="flight_agent",
    model="gemini-2.5-flash",
    description="Searches and books flights. Use for anything flight-related.",
    instruction="You are a flight specialist. Search for flights and present options clearly.",
    tools=[search_flights, book_flight],
)

hotel_agent = Agent(
    name="hotel_agent",
    model="gemini-2.5-flash",
    description="Finds and books hotels. Use for accommodation requests.",
    instruction="You are a hotel specialist. Find hotels matching the user's criteria.",
    tools=[search_hotels, book_hotel],
)

# Root coordinator — routes to sub-agents
root_agent = Agent(
    name="travel_coordinator",
    model="gemini-2.5-flash",
    description="Overall travel planning coordinator.",
    instruction="""You coordinate travel planning.
Delegate flight questions to flight_agent.
Delegate hotel questions to hotel_agent.
Synthesize results into a complete trip plan.""",
    sub_agents=[flight_agent, hotel_agent],
)
```

**Rules:**
- Each agent can only have ONE parent (`sub_agents` assigns parent automatically)
- `description` is what the parent LLM reads to decide which sub-agent to call — make it specific
- Use `global_instruction` on the root for instructions that apply to ALL agents in the tree

## Workflow Agents (deterministic orchestration)

For structured flows that don't need LLM routing:

```python
from google.adk.agents import SequentialAgent, ParallelAgent, LoopAgent

# Run agents one after another
pipeline = SequentialAgent(
    name="trip_pipeline",
    sub_agents=[research_agent, booking_agent, confirmation_agent],
)

# Run agents in parallel, collect all results
parallel = ParallelAgent(
    name="research_parallel",
    sub_agents=[flight_researcher, hotel_researcher, weather_checker],
)

# Loop until condition met
loop = LoopAgent(
    name="retry_loop",
    sub_agents=[attempt_booking_agent],
    max_iterations=3,
)
```

## Built-in Tools

```python
from google.adk.tools import google_search, code_execution

agent = Agent(
    tools=[
        google_search,      # Live Google Search grounding
        code_execution,     # Execute Python code in sandbox
    ]
)
```

## Running Locally

```bash
# Dev UI — browser at localhost:8000, select agent in top-left dropdown
# Run from PARENT of your agent folder
adk web

# Terminal chat
adk run my_agent

# Eval
adk eval my_agent eval_data.json
```

## Programmatic Runner

```python
import asyncio
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.types import Content, Part
from my_agent import agent

async def main():
    session_service = InMemorySessionService()
    session = await session_service.create_session(
        app_name="my_app",
        user_id="user_123",
    )
    
    runner = Runner(
        agent=agent.root_agent,
        app_name="my_app",
        session_service=session_service,
    )
    
    message = Content(parts=[Part(text="Find me a flight from Hamburg to Copenhagen on March 5")])
    
    async for event in runner.run_async(
        user_id="user_123",
        session_id=session.id,
        new_message=message,
    ):
        if event.is_final_response():
            print(event.content.parts[0].text)

asyncio.run(main())
```

## FastAPI Integration

```python
from fastapi import FastAPI
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from pydantic import BaseModel

app = FastAPI()
session_service = InMemorySessionService()
runner = Runner(agent=root_agent, app_name="my_app", session_service=session_service)

class ChatRequest(BaseModel):
    user_id: str
    session_id: str
    message: str

@app.post("/chat")
async def chat(req: ChatRequest):
    from google.adk.types import Content, Part
    message = Content(parts=[Part(text=req.message)])
    response_text = ""
    async for event in runner.run_async(
        user_id=req.user_id,
        session_id=req.session_id,
        new_message=message,
    ):
        if event.is_final_response():
            response_text = event.content.parts[0].text
    return {"response": response_text}
```

## Key Patterns

**Always return dicts from tools** — never raise, return `{"error": "..."}` instead.

**Instruction > description** — `instruction` shapes behavior, `description` shapes routing. Both matter.

**State for memory** — use `tool_context.state` for within-session persistence. For cross-session, use a real DB and inject via tools.

**Model choice** — `gemini-2.5-flash` for speed/cost, `gemini-2.5-pro` for complex reasoning. Flash is the default for most agent workloads.

**Tool docstrings** — the LLM reads the docstring to decide IF and HOW to call the tool. A bad docstring = tool never called or called wrong. Write it as: "Use this when X. Returns Y."
