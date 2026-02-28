"""Remove from trip tool — removes an item from the current trip."""

import json

from google.adk.tools.tool_context import ToolContext

from services import session_store


async def remove_from_trip(
    item_id: str,
    tool_context: ToolContext | None = None,
) -> str:
    """Remove an item (route, stay, or activity) from the current trip by its ID.

    Args:
        item_id: The ID of the item to remove.

    Returns dict with success status.
    """
    session_id = _get_session_id(tool_context)

    if not session_store.has_trip(session_id):
        return json.dumps({"error": "No trip exists. Use create_trip first."})

    if not item_id:
        return json.dumps({"error": "item_id parameter is required"})

    success = session_store.remove_item(session_id, item_id)

    if not success:
        return json.dumps({"error": f"Item {item_id} not found"})

    return json.dumps({"success": True, "itemId": item_id})


def _get_session_id(tool_context: ToolContext | None) -> str:
    if tool_context and tool_context.state.get("session_id"):
        return str(tool_context.state["session_id"])
    return "default"
