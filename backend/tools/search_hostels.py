"""Search hostels tool — finds hostels with real prices via Bright Data Google Hotels.

Returns the raw JSON response from Bright Data SERP API. No parsing — let the LLM
interpret the response directly.
"""

import json
import math
from datetime import timedelta

from google.adk.tools.tool_context import ToolContext

from services import brightdata_hotels
from utils.date_utils import parse_date


async def search_hostels(
    location: str,
    check_in_date: str,
    check_out_date: str = "",
    nights: int = 0,
    adults: int = 2,
    currency: str = "EUR",
    tool_context: ToolContext | None = None,
) -> str:
    """Search for hostels at a location with real prices from Google via Bright Data. Returns raw search results with hostel/hotel options.

    Use this when the user wants to find accommodation, hostels, or a place to stay.

    Args:
        location: City or area to search, e.g. "Copenhagen", "Berlin Mitte", "Hamburg city center".
        check_in_date: Check-in date in YYYY-MM-DD format.
        check_out_date: Check-out date in YYYY-MM-DD format. Either specify this OR the 'nights' parameter.
        nights: Number of nights. If check_in_date is provided without check_out_date, this is used to calculate it.
        adults: Number of adult guests. Defaults to 2.
        currency: 3-letter currency code for prices. Defaults to EUR.

    Returns raw JSON from Google with hostel/hotel search results.
    """
    if not location:
        return json.dumps({"error": "location parameter is required"})
    if not check_in_date:
        return json.dumps({"error": "check_in_date parameter is required"})

    check_in_dt = parse_date(check_in_date)
    if not check_in_dt:
        return json.dumps({"error": f"Could not parse check_in_date: {check_in_date}"})

    check_out_dt = parse_date(check_out_date) if check_out_date else None

    if not check_out_dt and nights > 0:
        check_out_dt = check_in_dt + timedelta(days=nights)
    elif not check_out_dt:
        check_out_dt = check_in_dt + timedelta(days=1)

    check_in_str = check_in_dt.strftime("%Y-%m-%d")
    check_out_str = check_out_dt.strftime("%Y-%m-%d")

    raw_data = await brightdata_hotels.search_hostels_by_location(
        location=location,
        check_in=check_in_str,
        check_out=check_out_str,
        adults=adults,
        currency=currency,
    )

    if "error" in raw_data:
        return json.dumps({"error": raw_data["error"]})

    # Strip large base64 images and navigation noise to save tokens
    raw_data.pop("navigation", None)
    raw_data.pop("pagination", None)
    raw_data.pop("related", None)
    raw_data.pop("people_also_ask", None)

    for item in raw_data.get("organic", []):
        item.pop("image", None)
        item.pop("image_base64", None)
        item.pop("icon", None)

    for ad in raw_data.get("top_ads", []):
        ad.pop("image", None)
        ad.pop("image_base64", None)
        ad.pop("referral_link", None)

    raw_data.pop("bottom_ads", None)

    return json.dumps(raw_data)
