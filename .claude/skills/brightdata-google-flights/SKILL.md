---
name: brightdata-google-flights
description: Scrape real-time flight data from Google Flights using Bright Data SERP API. Use when searching for flight prices, schedules, airline comparisons, or building travel booking tools. Supports multi-city, round-trip, and one-way searches with advanced filtering.
---

# Bright Data — Google Flights API

Scrape real-time flight schedules and pricing from Google Flights. This implementation covers two distinct methods:

1. **Bright Data SERP API** — Enterprise-grade, bypasses CAPTCHAs and bot detection, pay-per-success.
2. **Free Selenium Scraper** — Small-scale, open-source approach (prone to IP blocks and CSS changes).

**Source:** [https://github.com/luminati-io/google-flights-api](https://github.com/luminati-io/google-flights-api)
**Docs:** [https://docs.brightdata.com/scraping-automation/serp-api/google-flights](https://www.google.com/search?q=https://docs.brightdata.com/scraping-automation/serp-api/google-flights)

---

## Method 1 — Bright Data SERP API (Recommended)

### Auth & Setup

1. Sign up at [Bright Data](https://brightdata.com).
2. Navigate to **Proxies & Scraping** → **SERP API** → **Get Started**.
3. Retrieve your `API_TOKEN` and `ZONE_NAME`.

### Direct API Access

```python
import httpx
import asyncio

BRIGHTDATA_URL = "https://api.brightdata.com/request"

async def get_flight_prices(
    origin: str,           # IATA code (e.g., "SFO")
    destination: str,      # IATA code (e.g., "JFK")
    departure_date: str,   # YYYY-MM-DD
    return_date: str = None,
    adults: int = 1,
    cabin_class: str = "economy", # economy, business, first
    currency: str = "USD"
) -> dict:
    """
    Fetch real-time flight prices and schedules from Google Flights.
    """
    dates = departure_date if not return_date else f"{departure_date},{return_date}"

    params = (
        f"brd_dates={dates}"
        f"&brd_occupancy={adults}"
        f"&brd_cabin_class={cabin_class}"
        f"&brd_currency={currency}"
        f"&brd_json=1"
    )

    # Search URL format for Google Flights
    url = f"https://www.google.com/travel/flights?q=Flights%20from%20{origin}%20to%20{destination}%20on%20{departure_date}&{params}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(
            BRIGHTDATA_URL,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {BRIGHTDATA_API_TOKEN}",
            },
            json={
                "zone": BRIGHTDATA_ZONE_NAME,
                "url": url,
                "format": "raw",
            },
        )
        res.raise_for_status()
        return res.json()

```

---

## URL Parameters Reference

Append these query parameters to the Google Flights URL for precise results:

### Flight Logistics

| Parameter         | Description                           | Example                                           |
| ----------------- | ------------------------------------- | ------------------------------------------------- |
| `brd_dates`       | Departure and optional Return date    | `2026-06-15,2026-06-22`                           |
| `brd_flight_type` | `round_trip`, `one_way`, `multi_city` | `round_trip`                                      |
| `brd_cabin_class` | Cabin grade                           | `economy`, `premium_economy`, `business`, `first` |
| `brd_stops`       | Max number of stops                   | `0` (Non-stop), `1`, `2`                          |
| `brd_occupancy`   | Adults, children, infants             | `1` or `2,1,0`                                    |

### Localization & Format

| Parameter      | Description                  | Example             |
| -------------- | ---------------------------- | ------------------- |
| `brd_currency` | 3-letter currency code       | `USD`, `EUR`, `GBP` |
| `gl`           | Country code for results     | `us`                |
| `hl`           | Language code for UI         | `en`                |
| `brd_json=1`   | **Required** for JSON output | `1`                 |

---

## Response Structure (JSON)

```json
{
  "search_metadata": {
    "status": "Success",
    "created_at": "2026-02-28T14:10:00Z"
  },
  "flights": [
    {
      "airline": "United Airlines",
      "flight_number": "UA123",
      "departure": "2026-06-15T08:00:00",
      "arrival": "2026-06-15T16:30:00",
      "duration": "5h 30m",
      "stops": 0,
      "price": 450,
      "currency": "USD",
      "class": "Economy",
      "booking_link": "https://www.google.com/travel/flights/..."
    }
  ],
  "price_insights": {
    "status": "low",
    "typical_range": [400, 650]
  }
}
```

---

## ADK Tool Pattern (Python)

```python
import os
import httpx

async def search_flights(
    origin: str,
    destination: str,
    departure_date: str,
    return_date: str = None,
    adults: int = 1,
    cabin: str = "economy"
) -> dict:
    """Searches Google Flights for the best deals using Bright Data SERP API.

    Args:
        origin: IATA code for the starting airport.
        destination: IATA code for the arrival airport.
        departure_date: Date in YYYY-MM-DD format.
        return_date: Optional return date in YYYY-MM-DD format.
        adults: Number of passengers.
        cabin: Class (economy, business, etc).
    """
    api_token = os.getenv("BRIGHTDATA_API_TOKEN")
    zone = os.getenv("BRIGHTDATA_ZONE_NAME")

    if not api_token or not zone:
        return {"error": "Missing Bright Data environment variables."}

    search_query = f"Flights from {origin} to {destination}"
    base_url = "https://www.google.com/travel/flights"

    dates = departure_date if not return_date else f"{departure_date},{return_date}"
    params = f"brd_dates={dates}&brd_occupancy={adults}&brd_cabin_class={cabin}&brd_json=1"

    full_url = f"{base_url}?q={search_query.replace(' ', '+')}&{params}"

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.brightdata.com/request",
            headers={"Authorization": f"Bearer {api_token}"},
            json={"zone": zone, "url": full_url, "format": "raw"}
        )
        return response.json()

```

---

## Method 2 — Free Selenium Scraper

**Warning:** Google Flights uses complex XHR requests and dynamic class names. This method is highly unstable and intended for educational purposes.

```python
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
import time

def scrape_flights_basic(origin, destination, date):
    options = webdriver.ChromeOptions()
    options.add_argument("--headless=new")

    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

    url = f"https://www.google.com/travel/flights?q=Flights%20to%20{destination}%20from%20{origin}%20on%20{date}"
    driver.get(url)

    # Wait for dynamic JS content
    time.sleep(5)

    soup = BeautifulSoup(driver.page_source, "html.parser")
    flights = []

    # Note: Selector classes like 'p62Qec' change frequently
    for item in soup.select(".p62Qec"):
        price = item.select_one(".YMl9be")
        airline = item.select_one(".Ir7Vq")
        if price and airline:
            flights.append({
                "airline": airline.text,
                "price": price.text
            })

    driver.quit()
    return flights

```

---

## Env Variables

```env
# Credentials for Bright Data
BRIGHTDATA_API_TOKEN=your_secure_token
BRIGHTDATA_ZONE_NAME=your_serp_zone

```

## Notes

- **Caching:** Google Flights results change by the minute. Do not cache results for more than 15 minutes.
- **IATA Codes:** For best results, always use 3-letter IATA codes (LHR, CDG, LAX) rather than city names.
- **Captcha:** If using Method 2, you will likely encounter a "Before you continue" cookie consent or a CAPTCHA. Method 1 handles these automatically.

Would you like me to generate a specific Python script to compare prices across multiple dates for a specific route?
