"""Create trip tool — starts a new trip plan.

Use this when the user wants to plan a new trip. Must be called before
adding routes, stays, or activities.
"""

import json
from datetime import datetime

from google.adk.tools.tool_context import ToolContext

from services import session_store
from utils.date_utils import parse_date


async def create_trip(
    trip_name: str,
    start_date: str = "",
    tool_context: ToolContext | None = None,
) -> str:
    """Create a new trip plan. Use this at the start of planning a new trip. Call this before adding routes, stays, or activities.

    Args:
        trip_name: A descriptive name for the trip, e.g. 'Copenhagen Weekend Getaway', 'Berlin Business Trip'.
        start_date: Optional planned start date (ISO 8601 or natural language like 'March 15').

    Returns dict with success status, tripId, and tripName.
    """
    if not trip_name:
        return json.dumps({"error": "trip_name parameter is required"})

    session_id = _get_session_id(tool_context)

    parsed_start: datetime | None = None
    if start_date:
        parsed_start = parse_date(start_date)

    trip = session_store.create_trip(session_id, trip_name, parsed_start)

    if tool_context:
        tool_context.state["trip_id"] = trip.id
        tool_context.state["trip_name"] = trip.name

    return json.dumps(
        {
            "success": True,
            "tripId": trip.id,
            "tripName": trip.name,
        }
    )


def _get_session_id(tool_context: ToolContext | None) -> str:
    if tool_context and tool_context.state.get("session_id"):
        return str(tool_context.state["session_id"])
    return "default"
