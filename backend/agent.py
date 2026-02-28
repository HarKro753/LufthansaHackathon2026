"""ADK travel agent with trip planning, routing, and state persistence.

Architecture:
  root_agent (gemini-2.5-flash)
    └── native tools (registered via tools/registry.py)
        ├── create_trip      — start a new trip plan
        ├── get_trip         — view current trip state
        ├── add_to_trip      — add route/flight/stay/activity by reference
        ├── get_routes       — compute routes via Google Routes API
        ├── search_flights   — find flights with real prices via Bright Data
        ├── search_hostels   — find hostels with real prices via Bright Data
        ├── update_trip      — modify existing trip items
        ├── remove_from_trip — remove items from trip
        ├── edit_context     — save traveler preferences
        └── read_context     — read traveler profile/memory
"""

from datetime import datetime, timezone
from pathlib import Path

from google.adk.agents import Agent

from services import user_context
from tools.registry import ALL_TOOLS

MODEL = "gemini-3-flash-preview"

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
    description="AI travel agent — plans complete trips with flights, routes, hostels, and activities.",
    instruction=_build_system_prompt(),
    tools=ALL_TOOLS,
)
