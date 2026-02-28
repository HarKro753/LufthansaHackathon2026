---
name: brightdata-google-flights
description: Scrape real-time flight data from Google Flights using Bright Data SERP API. Use when searching for flight prices, schedules, airline comparisons, or building travel booking tools. Supports multi-city, round-trip, and one-way searches with advanced filtering.
---

# Bright Data — Google Flights API

Scrape real-time flight schedules and pricing from Google Flights via Bright Data SERP API.

**Docs:** https://docs.brightdata.com/scraping-automation/serp-api/

---

## CRITICAL — Correct URL Format

**DO NOT use `google.com/travel/flights`** — the Bright Data SERP API returns `gs_json_not_supported` for that endpoint. `brd_json=1` is NOT supported on Google Travel URLs.

**DO use `google.com/search` with `udm=13`** — this is the Google "Airline options" tab, which the SERP API can parse into structured JSON.

### Working URL format:

```
https://www.google.com/search?q=flights+from+{origin}+to+{destination}+{departure_date}&hl=en&gl=de&udm=13&brd_json=1
```

### Broken URL format (DO NOT USE):

```
https://www.google.com/travel/flights?q=...&brd_json=1  ← RETURNS EMPTY / ERROR
```

---

## Auth & Setup

1. Sign up at [Bright Data](https://brightdata.com)
2. Navigate to **Proxies & Scraping** → **SERP API** → **Get Started**
3. Retrieve your `API_TOKEN` and `ZONE_NAME`

---

## Direct API Access (Recommended)

```python
import os
import httpx

BRIGHTDATA_URL = "https://api.brightdata.com/request"


async def search_flights_by_route(
    origin: str,
    destination: str,
    departure_date: str,
    return_date: str = "",
    language: str = "en",
    country: str = "de",
) -> dict:
    api_token = os.getenv("BRIGHTDATA_API_TOKEN", "")
    zone_name = os.getenv("BRIGHTDATA_ZONE_NAME", "")

    if not api_token or not zone_name:
        return {"error": "BRIGHTDATA_API_TOKEN and BRIGHTDATA_ZONE_NAME must be set"}

    date_str = departure_date
    if return_date:
        date_str = f"{departure_date}+to+{return_date}"

    query = f"flights+from+{origin}+to+{destination}+{date_str}"

    # udm=13 = Google "Airline options" tab
    # brd_json=1 = Bright Data returns parsed JSON
    search_url = (
        f"https://www.google.com/search"
        f"?q={query}"
        f"&hl={language}"
        f"&gl={country}"
        f"&udm=13"
        f"&brd_json=1"
    )

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
```

---

## Actual Response Structure (from `udm=13`)

The response is a Google SERP JSON with flight airline cards:

```json
{
  "general": {
    "search_engine": "google",
    "query": "flights from Frankfurt to Copenhagen March 15 2026",
    "search_type": "airline_options",
    "timestamp": "2026-02-28T14:18:27.194Z"
  },
  "flights": {
    "items": [
      {
        "title": "LufthansaNonstopfrom €207",
        "link": "https://www.google.com/travel/clk/g?w=...",
        "rank": 1,
        "global_rank": 2
      },
      {
        "title": "KLMConnectingfrom €243",
        "link": "https://www.google.com/travel/clk/g?w=...",
        "rank": 2,
        "global_rank": 4
      },
      {
        "title": "AustrianConnectingfrom €255",
        "link": "https://www.google.com/travel/clk/g?w=...",
        "rank": 3,
        "global_rank": 6
      }
    ]
  },
  "top_ads": [
    {
      "link": "https://www.lufthansa.com/...",
      "title": "Copenhagen flight from 141 € - Return flight from 141 €",
      "description": "Fly nonstop with Lufthansa from Frankfurt to Copenhagen from 141 €.",
      "extensions": [
        { "type": "site_link", "link": "...", "text": "Copenhagen from 141 €" }
      ]
    }
  ]
}
```

### Key fields:

- **`flights.items[].title`**: Compact string like `"LufthansaNonstopfrom €207"` — contains airline, stops info, and price
- **`flights.items[].link`**: Google booking redirect link
- **`top_ads`**: Airline ads with more detailed pricing and direct booking links

### Title parsing:

The `title` field is a concatenated string. Common patterns:

- `"LufthansaNonstopfrom €207"` → Lufthansa, Nonstop, €207
- `"KLMConnectingfrom €243"` → KLM, Connecting (1+ stops), €243
- `"SAS ScandinavianNonstopfrom €189"` → SAS Scandinavian, Nonstop, €189

---

## URL Parameters

These go on the `google.com/search` URL:

| Parameter    | Description                                 | Example                              |
| ------------ | ------------------------------------------- | ------------------------------------ |
| `q`          | Natural language flight query               | `flights+from+FRA+to+CPH+2026-03-15` |
| `udm=13`     | **Required** — Airline options view         | `13`                                 |
| `brd_json=1` | **Required** — JSON output from Bright Data | `1`                                  |
| `hl`         | Language                                    | `en`                                 |
| `gl`         | Country                                     | `de`                                 |

---

## Env Variables

```env
BRIGHTDATA_API_TOKEN=your_api_token
BRIGHTDATA_ZONE_NAME=your_serp_zone  # e.g. serp_api1
```

## Notes

- **DO NOT** use `google.com/travel/flights` — it returns `gs_json_not_supported`
- **DO** use `google.com/search?udm=13` — this is the airline options tab
- The `brd_` travel parameters (`brd_dates`, `brd_cabin_class`, etc.) do NOT work on `google.com/search` — encode the date in the query string instead
- Pass raw JSON to the LLM — don't try to parse the compact title strings in code
- IATA codes give better results than city names
- Results change frequently — do not cache for more than 15 minutes
