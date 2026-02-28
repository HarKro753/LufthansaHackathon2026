"""Bright Data SERP API service — fetches flight data from Google Flights.

Uses Google Search with udm=13 (Airline Options view) via Bright Data SERP API.
This returns structured JSON with airline names, prices, and booking links.
The google.com/travel/flights endpoint does NOT support brd_json — so we use
the Google Search airline options tab instead.
"""

import os

import httpx

BRIGHTDATA_URL = "https://api.brightdata.com/request"


async def search_flights_by_route(
    origin: str,
    destination: str,
    departure_date: str,
    return_date: str = "",
    adults: int = 1,
    cabin_class: str = "economy",
    currency: str = "EUR",
    stops: int | None = None,
    language: str = "en",
    country: str = "de",
) -> dict:
    """Search for flights between two airports via Bright Data SERP API.

    Uses Google Search airline options view (udm=13) which returns structured
    flight cards with airline, stops info, and pricing.

    Args:
        origin: Origin IATA airport code, e.g. "FRA", "MUC".
        destination: Destination IATA airport code, e.g. "CPH", "BCN".
        departure_date: Departure date YYYY-MM-DD.
        return_date: Optional return date YYYY-MM-DD for round trips.
        adults: Number of adult passengers.
        cabin_class: economy, premium_economy, business, or first.
        currency: 3-letter currency code.
        stops: Max number of stops (0 = non-stop, 1, 2). None = any.
        language: Language code for results.
        country: Country code for localization.

    Returns:
        Parsed JSON from Bright Data SERP response with flights.items list.
    """
    api_token = os.getenv("BRIGHTDATA_API_TOKEN", "")
    zone_name = os.getenv("BRIGHTDATA_ZONE_NAME", "")

    if not api_token or not zone_name:
        return {
            "error": "BRIGHTDATA_API_TOKEN and BRIGHTDATA_ZONE_NAME must be set in .env"
        }

    # Build a natural language query that triggers Google's flight widget
    date_str = departure_date
    if return_date:
        date_str = f"{departure_date}+to+{return_date}"

    query = f"flights+from+{origin}+to+{destination}+{date_str}"

    # udm=13 = Google "Airline options" tab — returns structured flight cards
    # brd_json=1 = Bright Data returns parsed JSON instead of raw HTML
    search_url = (
        f"https://www.google.com/search"
        f"?q={query}"
        f"&hl={language}"
        f"&gl={country}"
        f"&udm=13"
        f"&brd_json=1"
    )

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            res = await client.post(
                BRIGHTDATA_URL,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_token}",
                },
                json={
                    "zone": zone_name,
                    "url": search_url,
                    "format": "raw",
                },
            )
            res.raise_for_status()
            return res.json()
    except httpx.HTTPStatusError as e:
        return {
            "error": f"Bright Data API error {e.response.status_code}: {e.response.text[:300]}"
        }
    except httpx.TimeoutException:
        return {"error": "Bright Data API request timed out (45s)"}
    except Exception as e:
        return {"error": f"Bright Data request failed: {e}"}
