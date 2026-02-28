"""Update trip tool — modifies an existing item in the trip."""

import json
from datetime import datetime

from google.adk.tools.tool_context import ToolContext

from services import session_store
from utils.date_utils import parse_date


async def update_trip(
    item_id: str,
    name: str = "",
    address: str = "",
    departure_time: str = "",
    arrival_time: str = "",
    travel_mode: str = "",
    check_in_date: str = "",
    check_out_date: str = "",
    nights: int = 0,
    price_per_night: float = 0.0,
    rating: float = 0.0,
    scheduled_date: str = "",
    scheduled_time: str = "",
    selection_reason: str = "",
    tool_context: ToolContext | None = None,
) -> str:
    """Update an existing item (route, stay, or activity) in the current trip. Provide the item ID and the fields to update.

    Args:
        item_id: The ID of the item to update.
        name: New name for the item.
        address: New address.
        departure_time: For routes: New departure time (ISO 8601).
        arrival_time: For routes: New arrival time (ISO 8601).
        travel_mode: For routes: New travel mode.
        check_in_date: For stays: New check-in date (ISO 8601).
        check_out_date: For stays: New check-out date (ISO 8601).
        nights: For stays: New number of nights.
        price_per_night: For stays: New price per night.
        rating: New rating.
        scheduled_date: For activities: New scheduled date (ISO 8601).
        scheduled_time: For activities: New scheduled time.
        selection_reason: Updated reason for selection.

    Returns dict with success status.
    """
    session_id = _get_session_id(tool_context)

    if not session_store.has_trip(session_id):
        return json.dumps({"error": "No trip exists. Use create_trip first."})

    if not item_id:
        return json.dumps({"error": "item_id parameter is required"})

    updates: dict = {}

    # Only include non-empty fields
    date_fields = {
        "departure_time": departure_time,
        "arrival_time": arrival_time,
        "check_in_date": check_in_date,
        "check_out_date": check_out_date,
        "scheduled_date": scheduled_date,
    }

    for field, value in date_fields.items():
        if value:
            parsed = parse_date(value)
            if parsed:
                updates[field] = parsed

    if name:
        updates["name"] = name
    if address:
        updates["address"] = address
    if travel_mode:
        updates["travel_mode"] = travel_mode
    if scheduled_time:
        updates["scheduled_time"] = scheduled_time
    if selection_reason:
        updates["selection_reason"] = selection_reason
    if nights > 0:
        updates["nights"] = nights
    if price_per_night > 0:
        updates["price_per_night"] = price_per_night
    if rating > 0:
        updates["rating"] = rating

    # Auto-calculate check_out from check_in + nights
    if "nights" in updates and "check_in_date" in updates:
        check_in = updates["check_in_date"]
        n = updates["nights"]
        from datetime import timedelta

        updates["check_out_date"] = check_in + timedelta(days=n)

    # Auto-calculate total price
    if "price_per_night" in updates:
        trip = session_store.get_trip(session_id)
        if trip:
            for stay in trip.stays:
                if stay.id == item_id:
                    n = updates.get("nights", stay.nights)
                    updates["total_price"] = updates["price_per_night"] * n
                    break

    if not updates:
        return json.dumps({"error": "No valid update fields provided"})

    success = session_store.update_item(session_id, item_id, updates)

    if not success:
        return json.dumps({"error": f"Item {item_id} not found"})

    return json.dumps({"success": True, "itemId": item_id})


def _get_session_id(tool_context: ToolContext | None) -> str:
    if tool_context and tool_context.state.get("session_id"):
        return str(tool_context.state["session_id"])
    return "default"
