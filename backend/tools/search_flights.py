"""Search flights tool — finds flights with real prices via Bright Data Google Flights.

Returns the raw JSON response from Bright Data SERP API. No parsing — let the LLM
interpret the response directly.
"""

import json

from google.adk.tools.tool_context import ToolContext

from services import brightdata_flights


async def search_flights(
    origin: str,
    destination: str,
    departure_date: str,
    return_date: str = "",
    adults: int = 1,
    cabin_class: str = "economy",
    currency: str = "EUR",
    max_stops: int = -1,
    tool_context: ToolContext | None = None,
) -> str:
    """Search for flights between two airports with real prices from Google Flights via Bright Data. Returns raw flight data including airline options with prices and booking links.

    Use this when the user wants to fly somewhere, find flights, or compare flight options.
    Always use 3-letter IATA airport codes (e.g. FRA for Frankfurt, MUC for Munich, CPH for Copenhagen, BCN for Barcelona).

    The response contains a 'flights' key with 'items' — each item has a 'title' like "LufthansaNonstopfrom €207" and a 'link' for booking.
    It may also contain 'top_ads' with airline ads that include prices and direct booking links.

    Args:
        origin: Origin IATA airport code, e.g. "FRA", "MUC", "BER".
        destination: Destination IATA airport code, e.g. "CPH", "BCN", "LHR".
        departure_date: Departure date in YYYY-MM-DD format.
        return_date: Optional return date for round trips (YYYY-MM-DD). Leave empty for one-way.
        adults: Number of adult passengers. Defaults to 1.
        cabin_class: Cabin class: 'economy', 'premium_economy', 'business', or 'first'. Defaults to 'economy'.
        currency: 3-letter currency code for prices. Defaults to EUR.
        max_stops: Maximum number of stops. 0 = non-stop only, 1 = max 1 stop. Use -1 for any.

    Returns raw JSON from Google Flights with airline options, prices, and booking links.
    """
    if not origin:
        return json.dumps({"error": "origin parameter is required (IATA code)"})
    if not destination:
        return json.dumps({"error": "destination parameter is required (IATA code)"})
    if not departure_date:
        return json.dumps({"error": "departure_date parameter is required"})

    origin = origin.strip().upper()
    destination = destination.strip().upper()

    if len(origin) != 3 or not origin.isalpha():
        return json.dumps(
            {
                "error": f"Invalid origin IATA code: '{origin}'. Must be 3 letters like 'FRA'."
            }
        )
    if len(destination) != 3 or not destination.isalpha():
        return json.dumps(
            {
                "error": f"Invalid destination IATA code: '{destination}'. Must be 3 letters like 'CPH'."
            }
        )

    stops_param = max_stops if max_stops >= 0 else None

    raw_data = await brightdata_flights.search_flights_by_route(
        origin=origin,
        destination=destination,
        departure_date=departure_date,
        return_date=return_date,
        adults=adults,
        cabin_class=cabin_class,
        currency=currency,
        stops=stops_param,
    )

    if "error" in raw_data:
        return json.dumps({"error": raw_data["error"]})

    # Strip large base64 images and navigation noise to save tokens
    raw_data.pop("navigation", None)
    raw_data.pop("pagination", None)
    raw_data.pop("related", None)
    raw_data.pop("people_also_ask", None)
    raw_data.pop("organic", None)

    for ad in raw_data.get("top_ads", []):
        ad.pop("image", None)
        ad.pop("image_base64", None)
        ad.pop("referral_link", None)
        for ext in ad.get("extensions", []):
            ext.pop("image", None)

    for item in raw_data.get("flights", {}).get("items", []):
        item.pop("image", None)
        item.pop("image_base64", None)

    raw_data.pop("bottom_ads", None)

    return json.dumps(raw_data)
