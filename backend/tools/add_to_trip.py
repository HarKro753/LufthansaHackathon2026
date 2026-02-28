"""Add to trip tool — adds a route, flight, stay, or activity to the current trip.

Routes and activities use index-based references (from get_routes / search_places).
Flights and stays use direct parameter passing — the LLM extracts data from raw
search results and passes it here.
"""

import json
import math
import urllib.parse
import uuid
from datetime import datetime

from google.adk.tools.tool_context import ToolContext

from models.trip import (
    Coordinates,
    ExternalLink,
    TripActivity,
    TripFlight,
    TripRoute,
    TripStay,
)
from services import session_store
from utils.date_utils import parse_date
from utils.format_utils import parse_duration_to_minutes


async def add_to_trip(
    item_type: str,
    selection_reason: str,
    route_index: int = -1,
    place_index: int = -1,
    airline: str = "",
    flight_origin: str = "",
    flight_destination: str = "",
    departure_time: str = "",
    arrival_time: str = "",
    flight_duration: str = "",
    flight_stops: int = 0,
    flight_price: float = 0.0,
    flight_currency: str = "EUR",
    flight_booking_link: str = "",
    flight_cabin_class: str = "economy",
    flight_number: str = "",
    hostel_name: str = "",
    hostel_address: str = "",
    hostel_lat: float = 0.0,
    hostel_lng: float = 0.0,
    check_in_date: str = "",
    check_out_date: str = "",
    price_per_night: float = 0.0,
    hostel_currency: str = "EUR",
    hostel_rating: float = 0.0,
    hostel_reviews: int = 0,
    hostel_stars: int = 0,
    hostel_booking_link: str = "",
    hostel_booking_source: str = "",
    hostel_image_url: str = "",
    activity_type: str = "activity",
    scheduled_date: str = "",
    tool_context: ToolContext | None = None,
) -> str:
    """Add a route, flight, stay, or activity to the trip.

    For routes: pass route_index from get_routes results.
    For activities: pass place_index from search_places results.
    For flights: pass the flight details directly — airline, flight_origin (IATA), flight_destination (IATA), departure_time, arrival_time, flight_price, flight_booking_link, etc.
    For stays: pass the hostel details directly — hostel_name, hostel_address, check_in_date, check_out_date, price_per_night, hostel_booking_link, etc.

    Args:
        item_type: 'route', 'flight', 'stay', or 'activity'.
        selection_reason: Why this option was selected — shown to the user.
        route_index: Route: routeIndex from get_routes results. Use -1 if not applicable.
        place_index: Activity: placeIndex from search_places results. Use -1 if not applicable.
        airline: Flight: airline name, e.g. "Lufthansa", "Ryanair".
        flight_origin: Flight: origin IATA airport code, e.g. "FRA".
        flight_destination: Flight: destination IATA airport code, e.g. "CPH".
        departure_time: Flight/route: departure time in ISO 8601, e.g. "2026-03-15T08:30".
        arrival_time: Flight/route: arrival time in ISO 8601, e.g. "2026-03-15T10:45".
        flight_duration: Flight: duration string, e.g. "2h 15m".
        flight_stops: Flight: number of stops. 0 means nonstop.
        flight_price: Flight: price in the given currency.
        flight_currency: Flight: 3-letter currency code. Defaults to EUR.
        flight_booking_link: Flight: URL to book this flight.
        flight_cabin_class: Flight: cabin class — economy, premium_economy, business, first.
        flight_number: Flight: flight number if known, e.g. "LH1234".
        hostel_name: Stay: name of the hostel or hotel.
        hostel_address: Stay: address of the hostel.
        hostel_lat: Stay: latitude coordinate. Use 0.0 if unknown.
        hostel_lng: Stay: longitude coordinate. Use 0.0 if unknown.
        check_in_date: Stay: check-in date in YYYY-MM-DD format.
        check_out_date: Stay: check-out date in YYYY-MM-DD format.
        price_per_night: Stay: price per night in the given currency.
        hostel_currency: Stay: 3-letter currency code. Defaults to EUR.
        hostel_rating: Stay: rating out of 5 or 10. Use 0.0 if unknown.
        hostel_reviews: Stay: number of reviews. Use 0 if unknown.
        hostel_stars: Stay: star rating (1-5). Use 0 if unknown.
        hostel_booking_link: Stay: URL to book this hostel.
        hostel_booking_source: Stay: booking provider name, e.g. "Booking.com", "Hostelworld".
        hostel_image_url: Stay: URL to a photo/image of the hostel. Pass the image URL from the search results if available.
        activity_type: Activity type: 'restaurant', 'attraction', or 'activity'. Defaults to 'activity'.
        scheduled_date: Activity: scheduled date/time (ISO 8601).

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
    if item_type == "flight":
        return _add_flight_direct(
            session_id=session_id,
            airline=airline,
            flight_number=flight_number,
            origin=flight_origin,
            destination=flight_destination,
            departure=departure_time,
            arrival=arrival_time,
            duration=flight_duration,
            stops=flight_stops,
            price=flight_price,
            currency=flight_currency,
            booking_link=flight_booking_link,
            cabin_class=flight_cabin_class,
            reason=selection_reason,
        )
    if item_type == "stay":
        return _add_stay_direct(
            session_id=session_id,
            name=hostel_name,
            address=hostel_address,
            lat=hostel_lat,
            lng=hostel_lng,
            check_in=check_in_date,
            check_out=check_out_date,
            price_per_night=price_per_night,
            currency=hostel_currency,
            rating=hostel_rating,
            reviews=hostel_reviews,
            stars=hostel_stars,
            booking_link=hostel_booking_link,
            booking_source=hostel_booking_source,
            image_url=hostel_image_url,
            reason=selection_reason,
        )
    if item_type == "activity":
        return _add_activity(
            session_id, place_index, activity_type, scheduled_date, selection_reason
        )

    return json.dumps(
        {
            "error": f"Invalid item_type: {item_type}. Must be route, flight, stay, or activity."
        }
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


def _add_flight_direct(
    session_id: str,
    airline: str,
    flight_number: str,
    origin: str,
    destination: str,
    departure: str,
    arrival: str,
    duration: str,
    stops: int,
    price: float,
    currency: str,
    booking_link: str,
    cabin_class: str,
    reason: str,
) -> str:
    """Add a flight using data passed directly by the LLM."""
    if not airline:
        return json.dumps({"error": "airline is required for flights"})
    if not origin or not destination:
        return json.dumps(
            {"error": "flight_origin and flight_destination are required"}
        )
    if not departure:
        return json.dumps({"error": "departure_time is required for flights"})

    dep_time = parse_date(departure)
    if not dep_time:
        return json.dumps({"error": f"Could not parse departure_time: {departure}"})

    # arrival_time is optional — estimate if missing
    arr_time = parse_date(arrival) if arrival else None
    if not arr_time:
        # If no arrival time, just set it same as departure (will show as unknown)
        arr_time = dep_time

    flight = TripFlight(
        id=uuid.uuid4().hex,
        airline=airline,
        flight_number=flight_number or None,
        origin=origin.strip().upper(),
        destination=destination.strip().upper(),
        departure_time=dep_time,
        arrival_time=arr_time,
        duration=duration or None,
        stops=stops,
        cabin_class=cabin_class or "economy",
        price=price if price > 0 else None,
        currency=currency or "EUR",
        booking_link=booking_link or None,
        selection_reason=reason,
    )

    session_store.add_flight(session_id, flight)
    return json.dumps({"success": True, "itemType": "flight", "itemId": flight.id})


def _add_stay_direct(
    session_id: str,
    name: str,
    address: str,
    lat: float,
    lng: float,
    check_in: str,
    check_out: str,
    price_per_night: float,
    currency: str,
    rating: float,
    reviews: int,
    stars: int,
    booking_link: str,
    booking_source: str,
    image_url: str,
    reason: str,
) -> str:
    """Add a stay using data passed directly by the LLM."""
    if not name:
        return json.dumps({"error": "hostel_name is required for stays"})
    if not check_in:
        return json.dumps({"error": "check_in_date is required for stays"})
    if not check_out:
        return json.dumps({"error": "check_out_date is required for stays"})

    check_in_dt = parse_date(check_in)
    check_out_dt = parse_date(check_out)

    if not check_in_dt:
        return json.dumps({"error": f"Could not parse check_in_date: {check_in}"})
    if not check_out_dt:
        return json.dumps({"error": f"Could not parse check_out_date: {check_out}"})

    nights = max(
        1, math.ceil((check_out_dt.timestamp() - check_in_dt.timestamp()) / 86400)
    )

    total_price = price_per_night * nights if price_per_night > 0 else None
    coordinates = Coordinates(lat=lat, lng=lng) if lat != 0.0 and lng != 0.0 else None

    # Build a Google Maps search URL for the hotel
    maps_query = urllib.parse.quote_plus(f"{name} {address}".strip())
    google_maps_url = f"https://www.google.com/maps/search/?api=1&query={maps_query}"

    stay = TripStay(
        id=uuid.uuid4().hex,
        name=name,
        address=address or "",
        coordinates=coordinates,
        check_in_date=check_in_dt,
        check_out_date=check_out_dt,
        nights=nights,
        price_per_night=price_per_night if price_per_night > 0 else None,
        total_price=total_price,
        currency=currency or "EUR",
        booking_source=booking_source or None,
        booking_link=booking_link or None,
        rating=rating if rating > 0 else None,
        reviews=reviews if reviews > 0 else None,
        stars=stars if stars > 0 else None,
        image_url=image_url or None,
        google_maps_url=google_maps_url,
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
