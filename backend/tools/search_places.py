"""Google Places API tool (New Places API)."""

import json
import os
import httpx

PLACES_BASE = "https://places.googleapis.com/v1/places:searchText"

FIELD_MASK = ",".join(
    [
        "places.displayName",
        "places.formattedAddress",
        "places.rating",
        "places.userRatingCount",
        "places.priceLevel",
        "places.internationalPhoneNumber",
        "places.websiteUri",
        "places.googleMapsUri",
        "places.primaryTypeDisplayName",
        "places.regularOpeningHours",
        "places.editorialSummary",
    ]
)


async def search_places(
    text_query: str,
    location_bias_lat: float | None = None,
    location_bias_lng: float | None = None,
    location_bias_radius: float = 5000.0,
    included_type: str | None = None,
    max_result_count: int = 5,
) -> dict:
    """Search for places like hotels, restaurants, airports, or attractions using Google Places.

    Use this when the user asks about places to stay, eat, visit, or travel to.
    Returns real place info including name, address, rating, website, and opening hours.

    Args:
        text_query: Natural language search query, e.g. "hotels near Copenhagen airport"
            or "best restaurants in Hamburg city center".
        location_bias_lat: Optional latitude to bias results toward a location.
        location_bias_lng: Optional longitude to bias results toward a location.
        location_bias_radius: Search radius in meters (default 5000).
        included_type: Optional place type filter, e.g. "hotel", "restaurant",
            "airport", "tourist_attraction", "museum".
        max_result_count: Max number of results to return (1-20, default 5).

    Returns dict with list of places including name, address, rating, and links.
    """
    api_key = os.getenv("GOOGLE_MAPS_API_KEY", "")
    if not api_key:
        return {"error": "GOOGLE_MAPS_API_KEY not configured"}

    payload: dict = {
        "textQuery": text_query,
        "maxResultCount": min(max(1, max_result_count), 20),
        "languageCode": "en",
    }

    if location_bias_lat is not None and location_bias_lng is not None:
        payload["locationBias"] = {
            "circle": {
                "center": {
                    "latitude": location_bias_lat,
                    "longitude": location_bias_lng,
                },
                "radius": location_bias_radius,
            }
        }

    if included_type:
        payload["includedType"] = included_type

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
        return {
            "error": f"Places API error {e.response.status_code}: {e.response.text[:200]}"
        }
    except Exception as e:
        return {"error": str(e)}

    places = data.get("places", [])
    if not places:
        return {"results": [], "message": f"No places found for: {text_query}"}

    results = []
    for p in places:
        price_map = {
            "PRICE_LEVEL_FREE": "Free",
            "PRICE_LEVEL_INEXPENSIVE": "€",
            "PRICE_LEVEL_MODERATE": "€€",
            "PRICE_LEVEL_EXPENSIVE": "€€€",
            "PRICE_LEVEL_VERY_EXPENSIVE": "€€€€",
        }
        item: dict = {
            "name": p.get("displayName", {}).get("text", "Unknown"),
            "address": p.get("formattedAddress", ""),
            "type": p.get("primaryTypeDisplayName", {}).get("text", ""),
            "rating": p.get("rating"),
            "total_ratings": p.get("userRatingCount"),
            "price_level": price_map.get(p.get("priceLevel", ""), None),
            "phone": p.get("internationalPhoneNumber"),
            "website": p.get("websiteUri"),
            "maps_url": p.get("googleMapsUri"),
            "summary": p.get("editorialSummary", {}).get("text"),
        }

        hours = p.get("regularOpeningHours", {})
        if hours.get("weekdayDescriptions"):
            item["opening_hours"] = hours["weekdayDescriptions"]

        results.append({k: v for k, v in item.items() if v is not None})

    return {"query": text_query, "count": len(results), "results": results}
