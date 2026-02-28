"""Get routes tool — computes routes between two locations using Google Routes API.

Returns route options with distance, duration, and transit details.
Each route has a routeIndex for use with add_to_trip.
"""

import json
import os
from datetime import datetime

import httpx
from google.adk.tools.tool_context import ToolContext

from models.session import StoredRouteResult
from models.trip import GeocodedLocation
from services import session_store
from utils.date_utils import parse_departure_time
from utils.format_utils import format_distance, format_duration
from utils.geo_utils import extract_transit_segments, generate_route_url

GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"

VALID_TRAVEL_MODES = ["DRIVE", "WALK", "BICYCLE", "TRANSIT", "TWO_WHEELER"]

TRANSIT_FIELD_MASK = ",".join(
    [
        "routes.duration",
        "routes.distanceMeters",
        "routes.staticDuration",
        "routes.description",
        "routes.warnings",
        "routes.localizedValues",
        "routes.polyline",
        "routes.legs.steps.startLocation",
        "routes.legs.steps.transitDetails",
        "routes.legs.steps.travelMode",
        "routes.travelAdvisory.transitFare",
        "routes.legs.steps.transitDetails.transitLine.uri",
        "routes.legs.steps.transitDetails.transitLine.agencies.uri",
        "routes.legs.steps.transitDetails.transitLine.agencies.name",
    ]
)

DEFAULT_FIELD_MASK = ",".join(
    [
        "routes.duration",
        "routes.distanceMeters",
        "routes.staticDuration",
        "routes.description",
        "routes.warnings",
        "routes.localizedValues",
        "routes.polyline",
        "routes.legs.steps.startLocation",
    ]
)


def _to_naive(dt: datetime) -> datetime:
    """Strip timezone info for safe comparison with naive datetimes."""
    return dt.replace(tzinfo=None) if dt.tzinfo else dt


def _to_utc_string(dt: datetime) -> str:
    """Format datetime as UTC ISO 8601 string for Google Routes API."""
    if dt.tzinfo is None:
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    from datetime import timezone as tz

    utc_dt = dt.astimezone(tz.utc)
    return utc_dt.strftime("%Y-%m-%dT%H:%M:%SZ")


async def _geocode(address: str, api_key: str) -> GeocodedLocation | None:
    """Geocode an address to coordinates using Google Geocoding API."""
    url = f"{GEOCODE_URL}?address={address}&key={api_key}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url)
        if not resp.is_success:
            return None
        data = resp.json()

    results = data.get("results", [])
    if not results:
        return None

    result = results[0]
    location = result["geometry"]["location"]
    return GeocodedLocation(
        lat=location["lat"],
        lng=location["lng"],
        formatted_address=result["formatted_address"],
        place_id=result["place_id"],
    )


async def get_routes(
    origin: str,
    destination: str,
    travel_mode: str = "DRIVE",
    departure_time: str = "",
    arrival_time: str = "",
    tool_context: ToolContext | None = None,
) -> str:
    """Get routes between two locations. Returns distance, duration, departure/arrival times, and Google Maps link. Each route has a routeIndex — use it with add_to_trip to add the selected route. Use TRANSIT for trains/buses/public transport, DRIVE for car.

    Args:
        origin: Starting location (address or place name).
        destination: Destination location (address or place name).
        travel_mode: DRIVE, WALK, BICYCLE, TRANSIT, or TWO_WHEELER. Defaults to DRIVE.
        departure_time: Departure date/time (ISO 8601 or natural language like 'tomorrow', 'March 15').
        arrival_time: Arrival date/time (TRANSIT only, ISO 8601 or natural language).

    Returns routes with routeIndex, distance, duration, and Google Maps URL.
    """
    if not origin:
        return json.dumps({"error": "origin parameter is required"})
    if not destination:
        return json.dumps({"error": "destination parameter is required"})

    mode = travel_mode.upper()
    if mode not in VALID_TRAVEL_MODES:
        return json.dumps(
            {
                "error": f"Invalid travel mode. Must be one of: {', '.join(VALID_TRAVEL_MODES)}"
            }
        )

    api_key = os.getenv("GOOGLE_MAPS_API_KEY", "")
    if not api_key:
        return json.dumps({"error": "GOOGLE_MAPS_API_KEY not configured"})

    session_id = _get_session_id(tool_context)

    # Geocode both addresses
    origin_geo = await _geocode(origin, api_key)
    if not origin_geo:
        return json.dumps({"error": f'Could not find location for origin "{origin}"'})

    dest_geo = await _geocode(destination, api_key)
    if not dest_geo:
        return json.dumps(
            {"error": f'Could not find location for destination "{destination}"'}
        )

    # Parse times
    dep_time = parse_departure_time(departure_time) if departure_time else None
    arr_time = parse_departure_time(arrival_time) if arrival_time else None

    # Build request
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": TRANSIT_FIELD_MASK
        if mode == "TRANSIT"
        else DEFAULT_FIELD_MASK,
    }

    request_body: dict = {
        "origin": {
            "location": {
                "latLng": {"latitude": origin_geo.lat, "longitude": origin_geo.lng}
            },
        },
        "destination": {
            "location": {
                "latLng": {"latitude": dest_geo.lat, "longitude": dest_geo.lng}
            },
        },
        "travelMode": mode,
        "computeAlternativeRoutes": True,
        "languageCode": "en-US",
        "units": "METRIC",
    }

    now = datetime.now()
    if mode == "TRANSIT" and arr_time and _to_naive(arr_time) > now:
        request_body["arrivalTime"] = _to_utc_string(arr_time)
    elif dep_time and _to_naive(dep_time) > now:
        request_body["departureTime"] = _to_utc_string(dep_time)

    if mode == "DRIVE":
        request_body["routingPreference"] = "TRAFFIC_AWARE"
    elif mode == "TRANSIT":
        request_body["transitPreferences"] = {
            "allowedTravelModes": ["BUS", "SUBWAY", "TRAIN", "LIGHT_RAIL", "RAIL"],
        }

    # Call Routes API
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(ROUTES_URL, json=request_body, headers=headers)
            if not resp.is_success:
                return json.dumps(
                    {
                        "error": f"Routes API failed: {resp.status_code}: {resp.text[:200]}"
                    }
                )
            data = resp.json()
    except Exception as e:
        return json.dumps({"error": f"Routes API request failed: {e}"})

    api_routes = data.get("routes", [])
    if not api_routes:
        return json.dumps(
            {
                "origin": {
                    "address": origin_geo.formatted_address,
                    "lat": origin_geo.lat,
                    "lng": origin_geo.lng,
                },
                "destination": {
                    "address": dest_geo.formatted_address,
                    "lat": dest_geo.lat,
                    "lng": dest_geo.lng,
                },
                "travelMode": mode,
                "routes": [],
                "error": "No routes found",
            }
        )

    origin_info = {
        "address": origin_geo.formatted_address,
        "lat": origin_geo.lat,
        "lng": origin_geo.lng,
    }
    dest_info = {
        "address": dest_geo.formatted_address,
        "lat": dest_geo.lat,
        "lng": dest_geo.lng,
    }

    routes = []
    for index, route in enumerate(api_routes):
        duration_seconds = int(route.get("duration", "0s").replace("s", "")) or 0
        effective_departure = dep_time or now
        arrival_calculated = datetime.fromtimestamp(
            effective_departure.timestamp() + duration_seconds
        )

        # Extract ticket links for TRANSIT
        ticket_links: list[dict] = []
        if mode == "TRANSIT" and route.get("legs"):
            seen_urls: set[str] = set()
            for leg in route["legs"]:
                for step in leg.get("steps", []):
                    tl = step.get("transitDetails", {}).get("transitLine", {})
                    if tl.get("uri") and tl["uri"] not in seen_urls:
                        seen_urls.add(tl["uri"])
                        ticket_links.append(
                            {"title": tl.get("name", "Transit Line"), "url": tl["uri"]}
                        )
                    for agency in tl.get("agencies", []):
                        if agency.get("uri") and agency["uri"] not in seen_urls:
                            seen_urls.add(agency["uri"])
                            ticket_links.append(
                                {
                                    "title": agency.get("name", "Transit Agency"),
                                    "url": agency["uri"],
                                }
                            )

        localized = route.get("localizedValues", {})
        route_data = {
            "routeIndex": index,
            "distance": localized.get("distance", {}).get("text")
            or format_distance(route.get("distanceMeters", 0)),
            "distanceMeters": route.get("distanceMeters", 0),
            "duration": localized.get("duration", {}).get("text")
            or format_duration(route.get("duration", "0s")),
            "durationSeconds": duration_seconds,
            "staticDuration": localized.get("staticDuration", {}).get("text")
            or format_duration(route.get("staticDuration", "0s")),
            "description": route.get("description"),
            "warnings": route.get("warnings"),
            "departureTime": effective_departure.isoformat(),
            "arrivalTime": arrival_calculated.isoformat(),
            "transitSegments": extract_transit_segments(route.get("legs"))
            if mode == "TRANSIT"
            else None,
            "polyline": route.get("polyline", {}).get("encodedPolyline"),
            "url": generate_route_url(origin_geo, dest_geo, mode),
            "ticketLinks": ticket_links if ticket_links else None,
        }
        routes.append(route_data)

    # Store full results in session for add_to_trip to resolve
    stored_results = [
        StoredRouteResult(
            route_index=r["routeIndex"],
            origin=origin_info,
            destination=dest_info,
            travel_mode=mode,
            distance=r["distance"],
            distance_meters=r["distanceMeters"],
            duration=r["duration"],
            duration_seconds=r["durationSeconds"],
            description=r.get("description"),
            departure_time=r["departureTime"],
            arrival_time=r["arrivalTime"],
            polyline=r.get("polyline"),
            url=r["url"],
            ticket_links=r.get("ticketLinks"),
        )
        for r in routes
    ]
    session_store.store_route_results(session_id, stored_results)

    # Return slim version — no polylines (huge and useless for LLM reasoning)
    slim_routes = [{k: v for k, v in r.items() if k != "polyline"} for r in routes]

    return json.dumps(
        {
            "origin": origin_info,
            "destination": dest_info,
            "travelMode": mode,
            "routes": slim_routes,
        }
    )


def _get_session_id(tool_context: ToolContext | None) -> str:
    if tool_context and tool_context.state.get("session_id"):
        return str(tool_context.state["session_id"])
    return "default"
