"""Bright Data SERP API service — fetches hostel/hotel data from Google Hotels.

Uses Bright Data's Direct API access to scrape Google Hotels search results
and return structured JSON with real pricing from booking providers.
"""

import os

import httpx

BRIGHTDATA_URL = "https://api.brightdata.com/request"


async def search_hostels_by_location(
    location: str,
    check_in: str,
    check_out: str,
    adults: int = 2,
    currency: str = "EUR",
    language: str = "en",
    country: str = "de",
) -> dict:
    """Search for hostels at a location via Bright Data SERP API.

    Args:
        location: City or area, e.g. "Copenhagen" or "Berlin Mitte".
        check_in: Check-in date YYYY-MM-DD.
        check_out: Check-out date YYYY-MM-DD.
        adults: Number of adult guests.
        currency: 3-letter currency code.
        language: Language code for results.
        country: Country code for localization.

    Returns:
        Raw parsed JSON from Bright Data SERP response.
    """
    api_token = os.getenv("BRIGHTDATA_API_TOKEN", "")
    zone_name = os.getenv("BRIGHTDATA_ZONE_NAME", "")

    if not api_token or not zone_name:
        return {
            "error": "BRIGHTDATA_API_TOKEN and BRIGHTDATA_ZONE_NAME must be set in .env"
        }

    params = (
        f"brd_dates={check_in},{check_out}"
        f"&brd_occupancy={adults}"
        f"&brd_currency={currency}"
        f"&brd_json=1"
        f"&hl={language}"
        f"&gl={country}"
    )

    query = f"hostels+in+{location.replace(' ', '+')}"
    search_url = f"https://www.google.com/travel/search?q={query}&{params}"

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


async def get_hostel_prices(
    entity_id: str,
    check_in: str,
    check_out: str,
    adults: int = 2,
    currency: str = "EUR",
) -> dict:
    """Get detailed prices for a specific hostel by Google Hotels entity ID.

    Args:
        entity_id: Google Hotels entity ID, e.g. "CgoIyNaqqL33x5ovEAE".
        check_in: Check-in date YYYY-MM-DD.
        check_out: Check-out date YYYY-MM-DD.
        adults: Number of adult guests.
        currency: 3-letter currency code.

    Returns:
        Parsed JSON with hostel details, prices from multiple providers, and booking links.
    """
    api_token = os.getenv("BRIGHTDATA_API_TOKEN", "")
    zone_name = os.getenv("BRIGHTDATA_ZONE_NAME", "")

    if not api_token or not zone_name:
        return {
            "error": "BRIGHTDATA_API_TOKEN and BRIGHTDATA_ZONE_NAME must be set in .env"
        }

    params = (
        f"brd_dates={check_in},{check_out}"
        f"&brd_occupancy={adults}"
        f"&brd_currency={currency}"
        f"&brd_json=1"
    )

    url = f"https://www.google.com/travel/hotels/entity/{entity_id}/prices?{params}"

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
                    "url": url,
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
