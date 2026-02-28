"""ADK travel agent with trip planning, routing, and state persistence.

Architecture:
  root_agent (gemini-2.5-flash)
    └── native tools (no MCP — all tools run in-process)
        ├── create_trip     — start a new trip plan
        ├── get_trip        — view current trip state
        ├── add_to_trip     — add route/stay/activity by reference
        ├── get_routes      — compute routes via Google Routes API
        ├── search_places   — find places via Google Places API
        ├── update_trip     — modify existing trip items
        ├── remove_from_trip — remove items from trip
        ├── edit_context    — save traveler preferences
        └── read_context    — read traveler profile/memory
"""

from datetime import datetime, timezone
from pathlib import Path

from google.adk.agents import Agent

from services import user_context
from tools.create_trip import create_trip
from tools.get_trip import get_trip
from tools.add_to_trip import add_to_trip
from tools.get_routes import get_routes
from tools.search_places import search_places
from tools.update_trip import update_trip
from tools.remove_from_trip import remove_from_trip
from tools.edit_context import edit_context
from tools.read_context import read_context

MODEL = "gemini-2.5-flash"

PROMPT_TEMPLATE = (Path(__file__).parent / "templates" / "prompt.txt").read_text()


def _build_system_prompt() -> str:
    """Build the system prompt with current time and user context injected."""
    now = datetime.now(timezone.utc)
    context = user_context.get_all_context()

    return PROMPT_TEMPLATE.format(
        current_date=now.strftime("%A, %B %d, %Y"),
        current_time=now.strftime("%H:%M"),
        timezone="UTC",
        traveler_context=context["traveler"],
        trip_memory=context["trip_memory"],
    )


root_agent = Agent(
    name="travel_agent",
    model=MODEL,
    description="AI travel agent — plans complete trips with routes, hotels, and activities.",
    instruction=_build_system_prompt(),
    tools=[
        create_trip,
        get_trip,
        add_to_trip,
        get_routes,
        search_places,
        update_trip,
        remove_from_trip,
        edit_context,
        read_context,
    ],
)
