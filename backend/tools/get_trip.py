"""Get trip tool — retrieves the current trip plan."""

import json

from google.adk.tools.tool_context import ToolContext

from services import session_store


async def get_trip(
    tool_context: ToolContext | None = None,
) -> str:
    """Get the current trip plan with all routes, stays, and activities. Use this to show the user their complete trip summary, or to review the current state before making changes.

    Returns the full trip plan as JSON.
    """
    session_id = _get_session_id(tool_context)
    trip = session_store.get_trip(session_id)

    if not trip:
        return json.dumps({"error": "No trip exists. Use create_trip first."})

    return trip.model_dump_json()


def _get_session_id(tool_context: ToolContext | None) -> str:
    if tool_context and tool_context.state.get("session_id"):
        return str(tool_context.state["session_id"])
    return "default"
