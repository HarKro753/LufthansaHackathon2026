"""Google Places API tool — search for hotels, restaurants, attractions.

Results are cached in the session store for reference by add_to_trip (via placeIndex).
"""

import json
import os

import httpx
from google.adk.tools.tool_context import ToolContext

from models.session import StoredPlaceResult
from models.trip import Coordinates
from services import session_store
from utils.date_utils import parse_date, format_date_for_display

PLACES_BASE = "https://places.googleapis.com/v1/places:searchText"

FIELD_MASK = ",".join(
    [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.rating",
        "places.userRatingCount",
        "places.priceLevel",
        "places.internationalPhoneNumber",
        "places.websiteUri",
        "places.googleMapsUri",
        "places.primaryTypeDisplayName",
        "places.currentOpeningHours",
        "places.editorialSummary",
    ]
)

PRICE_MAP = {
    "PRICE_LEVEL_FREE": "Free",
    "PRICE_LEVEL_INEXPENSIVE": "€",
    "PRICE_LEVEL_MODERATE": "€€",
    "PRICE_LEVEL_EXPENSIVE": "€€€",
    "PRICE_LEVEL_VERY_EXPENSIVE": "€€€€",
}


async def search_places(
    text_query: str,
    max_price_per_night: float = 0.0,
    check_in_date: str = "",
    check_out_date: str = "",
    nights: int = 0,
    limit: int = 10,
    tool_context: ToolContext | None = None,
) -> str:
    """Search for places, restaurants, hotels, attractions, or any location using a text query. Each result has a placeIndex — use it with add_to_trip to add the selected place as a stay or activity. For hotel searches, you can specify check-in date, check-out date or number of nights, and maximum price per night.

    Args:
        text_query: Natural language search query, e.g. 'hotels near Copenhagen airport', 'restaurants in Hamburg', 'attractions Berlin'. Include location context.
        max_price_per_night: Maximum price per night in EUR for hotel/accommodation searches. Use 0 to skip.
        check_in_date: Check-in date for hotel stays (ISO 8601, 'today', 'tomorrow', or 'March 15').
        check_out_date: Check-out date for hotel stays. Either specify this OR the 'nights' parameter.
        nights: Number of nights for hotel stay. If check_in_date is provided, check_out_date will be calculated.
        limit: Maximum number of results to return. Defaults to 10.

    Returns places with placeIndex for use with add_to_trip.
    """
    api_key = os.getenv("GOOGLE_MAPS_API_KEY", "")
    if not api_key:
        return json.dumps({"error": "GOOGLE_MAPS_API_KEY not configured"})

    if not text_query:
        return json.dumps({"error": "text_query parameter is required"})

    session_id = _get_session_id(tool_context)

    # Parse date params
    check_in_dt = parse_date(check_in_date) if check_in_date else None
    check_out_dt = parse_date(check_out_date) if check_out_date else None

    if check_in_dt and nights > 0 and not check_out_dt:
        from datetime import timedelta

        check_out_dt = check_in_dt + timedelta(days=nights)

    if check_in_dt and check_out_dt and nights <= 0:
        import math

        nights = max(
            1, math.ceil((check_out_dt.timestamp() - check_in_dt.timestamp()) / 86400)
        )

    # Enhance query with price context
    enhanced_query = text_query
    if max_price_per_night > 0:
        if max_price_per_night <= 50:
            enhanced_query = f"budget {text_query}"
        elif max_price_per_night <= 100:
            enhanced_query = f"affordable {text_query}"
        elif max_price_per_night <= 200:
            enhanced_query = f"mid-range {text_query}"
        else:
            enhanced_query = f"upscale {text_query}"

    payload: dict = {
        "textQuery": enhanced_query,
        "maxResultCount": min(max(1, limit), 20),
        "languageCode": "en",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(
                PLACES_BASE,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": api_key,
                    "X-Goog-FieldMask": FIELD_MASK,
                },
            )
            res.raise_for_status()
            data = res.json()
    except httpx.HTTPStatusError as e:
        return json.dumps(
            {
                "error": f"Places API error {e.response.status_code}: {e.response.text[:200]}"
            }
        )
    except Exception as e:
        return json.dumps({"error": str(e)})

    places = data.get("places", [])
    if not places:
        return json.dumps(
            {"places": [], "message": f"No places found for: {text_query}"}
        )

    results = []
    for index, p in enumerate(places[:limit]):
        location = p.get("location", {})
        coords = None
        if location.get("latitude") is not None:
            coords = {"lat": location["latitude"], "lng": location["longitude"]}

        result = {
            "placeIndex": index,
            "name": p.get("displayName", {}).get("text", "Unknown"),
            "address": p.get("formattedAddress", ""),
            "placeId": p.get("id", ""),
            "coordinates": coords,
            "rating": p.get("rating"),
            "totalRatings": p.get("userRatingCount"),
            "priceLevel": PRICE_MAP.get(p.get("priceLevel", ""), None),
            "openNow": p.get("currentOpeningHours", {}).get("openNow"),
            "website": p.get("websiteUri"),
            "mapsUrl": p.get("googleMapsUri"),
            "type": p.get("primaryTypeDisplayName", {}).get("text", ""),
            "summary": p.get("editorialSummary", {}).get("text"),
        }
        results.append({k: v for k, v in result.items() if v is not None})

    # Store in session for add_to_trip resolution
    stored = [
        StoredPlaceResult(
            place_index=r["placeIndex"],
            name=r.get("name", ""),
            address=r.get("address", ""),
            place_id=r.get("placeId", ""),
            coordinates=Coordinates(**r["coordinates"])
            if r.get("coordinates")
            else None,
            rating=r.get("rating"),
            price_level=r.get("priceLevel"),
            open_now=r.get("openNow"),
            website=r.get("website"),
        )
        for r in results
    ]
    session_store.store_place_results(session_id, stored)

    response: dict = {"places": results}
    stay_details: dict = {}
    if check_in_dt:
        stay_details["checkInDate"] = format_date_for_display(check_in_dt)
    if check_out_dt:
        stay_details["checkOutDate"] = format_date_for_display(check_out_dt)
    if nights > 0:
        stay_details["nights"] = nights
    if max_price_per_night > 0:
        stay_details["maxPricePerNight"] = max_price_per_night
    if stay_details:
        response["stayDetails"] = stay_details

    return json.dumps(response)


def _get_session_id(tool_context: ToolContext | None) -> str:
    if tool_context and tool_context.state.get("session_id"):
        return str(tool_context.state["session_id"])
    return "default"
