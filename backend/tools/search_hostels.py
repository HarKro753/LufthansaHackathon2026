"""Search hostels tool — finds hostels with real prices via Bright Data Google Hotels.

Results are cached in the session store for reference by add_to_trip (via hostelIndex).
Replaces the old Google Places search_places tool for accommodation searches.
"""

import json
import math
from datetime import timedelta

from google.adk.tools.tool_context import ToolContext

from models.session import HostelPriceOption, StoredHostelResult
from models.trip import Coordinates
from services import brightdata_hotels, session_store
from utils.date_utils import parse_date, format_date_for_display


async def search_hostels(
    location: str,
    check_in_date: str,
    check_out_date: str = "",
    nights: int = 0,
    adults: int = 2,
    currency: str = "EUR",
    limit: int = 10,
    tool_context: ToolContext | None = None,
) -> str:
    """Search for hostels at a location with real prices from booking providers. Returns hostel options with actual nightly rates from Booking.com, Hostelworld, etc. Each result has a hostelIndex — use it with add_to_trip to add the selected hostel as a stay.

    Use this when the user wants to find accommodation, hostels, or a place to stay.

    Args:
        location: City or area to search, e.g. "Copenhagen", "Berlin Mitte", "Hamburg city center".
        check_in_date: Check-in date (ISO 8601 YYYY-MM-DD, or natural language like 'tomorrow', 'March 15').
        check_out_date: Check-out date (ISO 8601 YYYY-MM-DD). Either specify this OR the 'nights' parameter.
        nights: Number of nights. If check_in_date is provided without check_out_date, this is used to calculate it. Defaults to 0.
        adults: Number of adult guests. Defaults to 2.
        currency: 3-letter currency code for prices. Defaults to EUR.
        limit: Maximum number of hostels to return. Defaults to 10.

    Returns hostels with hostelIndex, name, rating, real prices, and booking links for use with add_to_trip.
    """
    if not location:
        return json.dumps({"error": "location parameter is required"})
    if not check_in_date:
        return json.dumps({"error": "check_in_date parameter is required"})

    session_id = _get_session_id(tool_context)

    # Parse dates
    check_in_dt = parse_date(check_in_date)
    if not check_in_dt:
        return json.dumps({"error": f"Could not parse check_in_date: {check_in_date}"})

    check_out_dt = parse_date(check_out_date) if check_out_date else None

    if not check_out_dt and nights > 0:
        check_out_dt = check_in_dt + timedelta(days=nights)
    elif not check_out_dt:
        check_out_dt = check_in_dt + timedelta(days=1)

    if check_in_dt and check_out_dt and nights <= 0:
        nights = max(
            1,
            math.ceil((check_out_dt.timestamp() - check_in_dt.timestamp()) / 86400),
        )

    check_in_str = check_in_dt.strftime("%Y-%m-%d")
    check_out_str = check_out_dt.strftime("%Y-%m-%d")

    # Call Bright Data service
    raw_data = await brightdata_hotels.search_hostels_by_location(
        location=location,
        check_in=check_in_str,
        check_out=check_out_str,
        adults=adults,
        currency=currency,
    )

    if "error" in raw_data:
        return json.dumps({"error": raw_data["error"]})

    # Parse response — Bright Data SERP returns varying structures
    hostels = _parse_hostel_results(
        raw_data, limit, currency, check_in_str, check_out_str
    )

    if not hostels:
        return json.dumps(
            {
                "hostels": [],
                "message": f"No hostels found in {location} for {check_in_str} to {check_out_str}",
            }
        )

    # Store in session for add_to_trip resolution
    stored = [
        StoredHostelResult(
            hostel_index=h["hostelIndex"],
            name=h["name"],
            address=h.get("address", ""),
            entity_id=h.get("entityId"),
            coordinates=Coordinates(**h["coordinates"])
            if h.get("coordinates")
            else None,
            rating=h.get("rating"),
            reviews=h.get("reviews"),
            stars=h.get("stars"),
            amenities=h.get("amenities"),
            prices=[HostelPriceOption(**p) for p in h["prices"]]
            if h.get("prices")
            else None,
            cheapest_price=h.get("cheapestPrice"),
            currency=currency,
            images=h.get("images"),
            check_in=check_in_str,
            check_out=check_out_str,
        )
        for h in hostels
    ]
    session_store.store_hostel_results(session_id, stored)

    # Build slim response for the LLM (no images, no raw data)
    slim_hostels = []
    for h in hostels:
        slim = {
            "hostelIndex": h["hostelIndex"],
            "name": h["name"],
            "address": h.get("address", ""),
            "rating": h.get("rating"),
            "reviews": h.get("reviews"),
            "stars": h.get("stars"),
            "cheapestPrice": h.get("cheapestPrice"),
            "currency": currency,
            "prices": h.get("prices", [])[:3],  # Top 3 price options only
            "amenities": h.get("amenities", [])[:5],  # Top 5 amenities
        }
        slim_hostels.append({k: v for k, v in slim.items() if v is not None})

    return json.dumps(
        {
            "location": location,
            "checkIn": format_date_for_display(check_in_dt),
            "checkOut": format_date_for_display(check_out_dt),
            "nights": nights,
            "adults": adults,
            "currency": currency,
            "hostels": slim_hostels,
        }
    )


def _parse_hostel_results(
    raw_data: dict,
    limit: int,
    currency: str,
    check_in: str,
    check_out: str,
) -> list[dict]:
    """Parse Bright Data SERP response into a normalized hostel list.

    The Bright Data SERP API can return data in multiple formats depending
    on the Google Hotels page structure. This handles the common patterns.
    """
    hostels: list[dict] = []

    # Pattern 1: Direct hotel/hostel list in response
    raw_hotels = (
        raw_data.get("hotels")
        or raw_data.get("results")
        or raw_data.get("organic")
        or []
    )

    # Pattern 2: Nested under a search key
    if not raw_hotels and isinstance(raw_data.get("search"), dict):
        raw_hotels = raw_data["search"].get("hotels", [])

    # Pattern 3: Single hotel detail page
    if not raw_hotels and raw_data.get("hotel"):
        raw_hotels = [raw_data]

    # Pattern 4: The response itself is a list
    if not raw_hotels and isinstance(raw_data, list):
        raw_hotels = raw_data

    for index, item in enumerate(raw_hotels[:limit]):
        hotel = item if not item.get("hotel") else item["hotel"]

        # Extract coordinates
        coords = None
        if hotel.get("gps_coordinates"):
            gps = hotel["gps_coordinates"]
            coords = {
                "lat": gps.get("latitude", gps.get("lat")),
                "lng": gps.get("longitude", gps.get("lng")),
            }
        elif hotel.get("latitude") and hotel.get("longitude"):
            coords = {"lat": hotel["latitude"], "lng": hotel["longitude"]}

        # Extract prices from various response shapes
        prices: list[dict] = []
        raw_prices = item.get("prices") or hotel.get("prices") or []

        if isinstance(raw_prices, list):
            for p in raw_prices:
                if isinstance(p, dict):
                    price_val = p.get("price") or p.get("rate") or p.get("total")
                    if isinstance(price_val, str):
                        price_val = float(
                            price_val.replace("$", "")
                            .replace(",", "")
                            .replace("€", "")
                            .strip()
                        )
                    if price_val:
                        prices.append(
                            {
                                "source": p.get("source", p.get("provider", "Unknown")),
                                "price": float(price_val),
                                "currency": p.get("currency", currency),
                                "room_type": p.get("room_type"),
                                "free_cancellation": p.get("free_cancellation", False),
                                "link": p.get("link") or p.get("url"),
                            }
                        )

        # Fallback: single price on the hotel object
        if not prices:
            single_price = hotel.get("price") or hotel.get("rate")
            if single_price:
                if isinstance(single_price, str):
                    single_price = float(
                        single_price.replace("$", "")
                        .replace(",", "")
                        .replace("€", "")
                        .strip()
                    )
                prices.append(
                    {
                        "source": hotel.get("source", "Google Hotels"),
                        "price": float(single_price),
                        "currency": currency,
                        "room_type": None,
                        "free_cancellation": False,
                        "link": hotel.get("link") or hotel.get("url"),
                    }
                )

        cheapest = min((p["price"] for p in prices), default=None) if prices else None

        # Extract entity ID from link if present
        entity_id = hotel.get("entity_id")
        if not entity_id and hotel.get("link"):
            link = hotel["link"]
            if "/entity/" in link:
                entity_id = link.split("/entity/")[1].split("/")[0].split("?")[0]

        hostel = {
            "hostelIndex": index,
            "name": hotel.get("name", hotel.get("title", "Unknown")),
            "address": hotel.get("address", hotel.get("location", "")),
            "entityId": entity_id,
            "coordinates": coords,
            "rating": hotel.get("rating"),
            "reviews": hotel.get("reviews", hotel.get("review_count")),
            "stars": hotel.get("stars", hotel.get("star_rating")),
            "amenities": hotel.get("amenities", []),
            "prices": prices,
            "cheapestPrice": cheapest,
            "images": hotel.get("images", [])[:3],
        }
        hostels.append(hostel)

    return hostels


def _get_session_id(tool_context: ToolContext | None) -> str:
    if tool_context and tool_context.state.get("session_id"):
        return str(tool_context.state["session_id"])
    return "default"
