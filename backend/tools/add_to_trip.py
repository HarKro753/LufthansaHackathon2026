"""Add to trip tool — adds a route, stay, or activity to the current trip.

Reference-based: pass routeIndex (from get_routes) or placeIndex (from search_places).
All data is resolved automatically from cached results.
"""

import json
import math
import uuid
from datetime import datetime

from google.adk.tools.tool_context import ToolContext

from typing import Literal

from models.trip import Coordinates, ExternalLink, TripActivity, TripRoute, TripStay
from services import session_store
from utils.date_utils import parse_date
from utils.format_utils import parse_duration_to_minutes


async def add_to_trip(
    item_type: str,
    selection_reason: str,
    route_index: int = -1,
    place_index: int = -1,
    check_in_date: str = "",
    check_out_date: str = "",
    activity_type: str = "activity",
    scheduled_date: str = "",
    tool_context: ToolContext | None = None,
) -> str:
    """Add a route, stay, or activity to the trip. Reference-based: pass routeIndex (from get_routes) for routes, or placeIndex (from search_places) for stays/activities. For stays also pass checkInDate and checkOutDate as ISO 8601 datetime. For activities optionally pass activityType and scheduledDate.

    Args:
        item_type: 'route', 'stay', or 'activity'.
        selection_reason: Why this option was selected.
        route_index: Route: routeIndex from get_routes results. Use -1 if not applicable.
        place_index: Stay/Activity: placeIndex from search_places results. Use -1 if not applicable.
        check_in_date: Stay: Check-in date/time (ISO 8601, e.g. 2026-03-15T14:00:00).
        check_out_date: Stay: Check-out date/time (ISO 8601, e.g. 2026-03-17T11:00:00).
        activity_type: Activity type: 'restaurant', 'attraction', or 'activity'. Defaults to 'activity'.
        scheduled_date: Activity: Scheduled date/time (ISO 8601).

    Returns dict with success status and itemId.
    """
    session_id = _get_session_id(tool_context)

    if not session_store.has_trip(session_id):
        return json.dumps({"error": "No trip exists. Use create_trip first."})

    if not item_type:
        return json.dumps({"error": "item_type is required"})
    if not selection_reason:
        return json.dumps({"error": "selection_reason is required"})

    if item_type == "route":
        return _add_route(session_id, route_index, selection_reason)
    if item_type == "stay":
        return _add_stay(
            session_id, place_index, check_in_date, check_out_date, selection_reason
        )
    if item_type == "activity":
        return _add_activity(
            session_id, place_index, activity_type, scheduled_date, selection_reason
        )

    return json.dumps(
        {"error": f"Invalid item_type: {item_type}. Must be route, stay, or activity."}
    )


def _add_route(session_id: str, route_index: int, reason: str) -> str:
    if route_index < 0:
        return json.dumps(
            {
                "error": "route_index is required. Use the routeIndex from get_routes results."
            }
        )

    stored = session_store.get_route_result(session_id, route_index)
    if not stored:
        return json.dumps(
            {
                "error": f"No route found for routeIndex {route_index}. Call get_routes first."
            }
        )

    dep_time = parse_date(stored.departure_time)
    arr_time = parse_date(stored.arrival_time)

    if not dep_time or not arr_time:
        return json.dumps(
            {"error": "Could not parse departure/arrival time from stored route."}
        )

    route = TripRoute(
        id=uuid.uuid4().hex,
        origin=stored.origin.get("address", ""),
        origin_address=stored.origin.get("address", ""),
        origin_coordinates=Coordinates(
            lat=stored.origin["lat"], lng=stored.origin["lng"]
        )
        if stored.origin.get("lat")
        else None,
        destination=stored.destination.get("address", ""),
        destination_address=stored.destination.get("address", ""),
        destination_coordinates=Coordinates(
            lat=stored.destination["lat"], lng=stored.destination["lng"]
        )
        if stored.destination.get("lat")
        else None,
        departure_time=dep_time,
        arrival_time=arr_time,
        travel_mode=stored.travel_mode,
        distance=stored.distance,
        duration=stored.duration,
        duration_minutes=parse_duration_to_minutes(stored.duration),
        google_maps_url=stored.url,
        ticket_links=[
            ExternalLink(title=t["title"], url=t["url"]) for t in stored.ticket_links
        ]
        if stored.ticket_links
        else None,
        polyline=stored.polyline,
        selection_reason=reason,
    )

    session_store.add_route(session_id, route)
    return json.dumps({"success": True, "itemType": "route", "itemId": route.id})


def _add_stay(
    session_id: str, place_index: int, check_in: str, check_out: str, reason: str
) -> str:
    if place_index < 0:
        return json.dumps(
            {
                "error": "place_index is required. Use the placeIndex from search_places results."
            }
        )

    stored = session_store.get_place_result(session_id, place_index)
    if not stored:
        return json.dumps(
            {
                "error": f"No place found for placeIndex {place_index}. Call search_places first."
            }
        )

    check_in_dt = parse_date(check_in)
    if not check_in_dt:
        return json.dumps({"error": "check_in_date is required (ISO 8601)"})

    check_out_dt = parse_date(check_out)
    if not check_out_dt:
        return json.dumps({"error": "check_out_date is required (ISO 8601)"})

    nights = max(
        1, math.ceil((check_out_dt.timestamp() - check_in_dt.timestamp()) / 86400)
    )

    stay = TripStay(
        id=uuid.uuid4().hex,
        name=stored.name,
        address=stored.address,
        coordinates=stored.coordinates,
        place_id=stored.place_id,
        check_in_date=check_in_dt,
        check_out_date=check_out_dt,
        nights=nights,
        rating=stored.rating,
        website=stored.website,
        selection_reason=reason,
    )

    session_store.add_stay(session_id, stay)
    return json.dumps({"success": True, "itemType": "stay", "itemId": stay.id})


def _add_activity(
    session_id: str, place_index: int, act_type: str, scheduled: str, reason: str
) -> str:
    if place_index < 0:
        return json.dumps(
            {
                "error": "place_index is required. Use the placeIndex from search_places results."
            }
        )

    stored = session_store.get_place_result(session_id, place_index)
    if not stored:
        return json.dumps(
            {
                "error": f"No place found for placeIndex {place_index}. Call search_places first."
            }
        )

    valid_types = ["restaurant", "attraction", "activity"]
    normalized_type = act_type.lower() if act_type else "activity"
    if normalized_type not in valid_types:
        return json.dumps({"error": f"activity_type must be: {', '.join(valid_types)}"})

    scheduled_dt = parse_date(scheduled) if scheduled else None

    activity = TripActivity(
        id=uuid.uuid4().hex,
        name=stored.name,
        address=stored.address,
        coordinates=stored.coordinates,
        place_id=stored.place_id,
        type=normalized_type,  # type: ignore[arg-type]
        scheduled_date=scheduled_dt,
        rating=stored.rating,
        price_level=stored.price_level,
        selection_reason=reason,
    )

    session_store.add_activity(session_id, activity)
    return json.dumps({"success": True, "itemType": "activity", "itemId": activity.id})


def _get_session_id(tool_context: ToolContext | None) -> str:
    if tool_context and tool_context.state.get("session_id"):
        return str(tool_context.state["session_id"])
    return "default"
