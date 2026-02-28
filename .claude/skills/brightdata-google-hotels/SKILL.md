---
name: brightdata-google-hotels
description: Scrape real-time hotel data from Google Hotels using Bright Data SERP API. Use when searching for hotels, getting hotel prices, checking availability by date, or building hotel search tools. Two methods available — Bright Data API (recommended, production-grade) and free Selenium scraper (small-scale only).
---

# Bright Data — Google Hotels API

Scrape real-time hotel data from Google Hotels. Covers two methods:
1. **Bright Data SERP API** — enterprise-grade, reliable, pay-per-success, no IP blocks
2. **Free Selenium scraper** — small-scale only, fragile, gets blocked

Source: https://github.com/luminati-io/google-hotels-api
Docs: https://docs.brightdata.com/scraping-automation/serp-api/

---

## Method 1 — Bright Data SERP API (Recommended)

### Auth & Setup

1. Sign up at https://brightdata.com (new users get $5 credit)
2. Go to Proxies & Scraping → SERP API → Get Started → create a Zone
3. Get your `API_TOKEN` and `ZONE_NAME` from the zone's Overview page

Two access modes — Direct API and Native Proxy — use either interchangeably.

### Direct API Access (simplest)

```python
import httpx
import asyncio

BRIGHTDATA_URL = "https://api.brightdata.com/request"

async def get_hotel_prices(
    entity_id: str,
    check_in: str,         # YYYY-MM-DD
    check_out: str,        # YYYY-MM-DD
    adults: int = 2,
    currency: str = "EUR",
    free_cancellation: bool = False,
) -> dict:
    """
    Get hotel prices from Google Hotels via Bright Data.
    entity_id: Google hotel entity ID (see "Finding Entity IDs" below)
    """
    params = f"brd_dates={check_in},{check_out}&brd_occupancy={adults}&brd_currency={currency}&brd_json=1"
    if free_cancellation:
        params += "&brd_free_cancellation=true"

    url = f"https://www.google.com/travel/hotels/entity/{entity_id}/prices?{params}"

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

### Native Proxy Access (alternative)

```python
import httpx

PROXY_HOST = "brd.superproxy.io"
PROXY_PORT = 33335

def get_proxy_url(customer_id: str, zone_name: str, zone_password: str) -> str:
    return f"http://brd-customer-{customer_id}-zone-{zone_name}:{zone_password}@{PROXY_HOST}:{PROXY_PORT}"

async def get_hotel_prices_proxy(
    entity_id: str,
    check_in: str,
    check_out: str,
    adults: int = 2,
    currency: str = "EUR",
) -> dict:
    proxy_url = get_proxy_url(CUSTOMER_ID, ZONE_NAME, ZONE_PASSWORD)
    url = (
        f"https://www.google.com/travel/hotels/entity/{entity_id}/prices"
        f"?brd_dates={check_in},{check_out}"
        f"&brd_occupancy={adults}"
        f"&brd_currency={currency}"
        f"&brd_json=1"
    )
    async with httpx.AsyncClient(
        proxies={"https://": proxy_url},
        verify=False,  # load Bright Data SSL cert in production
        timeout=30.0,
    ) as client:
        res = await client.get(url)
        res.raise_for_status()
        return res.json()
```

---

## Finding Hotel Entity IDs

Entity IDs look like: `CgoIyNaqqL33x5ovEAE`

**Method 1 — Manual:**
1. Search the hotel name in Google
2. Right-click → View page source
3. `Ctrl+F` search `/entity` to find the entity ID in the URL

**Method 2 — From search results:**
Use a Google Hotels search URL and parse the entity links:
```
https://www.google.com/travel/search?q=hotels+in+Copenhagen
```
Entity IDs appear in links like `/travel/hotels/entity/CgoIyNaqqL33x5ovEAE/`

---

## All URL Parameters

Append to the Google Hotels URL as query params:

### Booking

| Parameter | Description | Example |
|---|---|---|
| `brd_dates` | Check-in and check-out | `brd_dates=2026-03-05,2026-03-10` |
| `brd_occupancy` | Adults + optional child ages | `brd_occupancy=2` or `brd_occupancy=3,6,9` |
| `brd_free_cancellation` | Refundable only | `brd_free_cancellation=true` |
| `brd_accomodation_type` | hotels or vacation_rentals | `brd_accomodation_type=hotels` |
| `brd_currency` | Price currency | `brd_currency=EUR` |

### Localization

| Parameter | Description | Example |
|---|---|---|
| `gl` | Country code for results | `gl=de` |
| `hl` | Language code | `hl=en` |

### Device

| Parameter | Description |
|---|---|
| `brd_mobile=0` | Desktop (default) |
| `brd_mobile=1` | Random mobile |
| `brd_mobile=ios` | iPhone |
| `brd_mobile=android` | Android |

### Response Format

| Parameter | Description |
|---|---|
| `brd_json=1` | JSON response (use this) |
| `brd_json=html` | JSON + full nested HTML |

---

## Response Structure

```json
{
  "hotel": {
    "name": "Marriott Copenhagen",
    "address": "Kalvebod Brygge 5, 1560 Copenhagen",
    "rating": 4.2,
    "reviews": 1834,
    "stars": 5
  },
  "prices": [
    {
      "source": "Booking.com",
      "price": 189,
      "currency": "EUR",
      "room_type": "Standard Room",
      "free_cancellation": true,
      "link": "https://..."
    }
  ],
  "amenities": ["WiFi", "Pool", "Gym", "Restaurant"],
  "images": ["https://..."]
}
```

---

## ADK Tool Pattern (Python)

```python
import os
import httpx

async def search_hotels(
    location: str,
    check_in: str,
    check_out: str,
    adults: int = 2,
    currency: str = "EUR",
    free_cancellation: bool = False,
) -> dict:
    """Search for hotels at a location using Google Hotels data via Bright Data.

    Use this when the user asks about hotels, accommodation, or places to stay.
    Returns real prices from Booking.com, Hotels.com, and other providers.

    Args:
        location: City or area to search, e.g. "Copenhagen" or "Hamburg city center".
        check_in: Check-in date in YYYY-MM-DD format.
        check_out: Check-out date in YYYY-MM-DD format.
        adults: Number of adult guests (default 2).
        currency: 3-letter currency code (default EUR).
        free_cancellation: If True, only return refundable options.

    Returns dict with hotel list including prices, ratings, and booking links.
    """
    api_token = os.getenv("BRIGHTDATA_API_TOKEN", "")
    zone_name = os.getenv("BRIGHTDATA_ZONE_NAME", "")
    if not api_token or not zone_name:
        return {"error": "BRIGHTDATA_API_TOKEN and BRIGHTDATA_ZONE_NAME not configured"}

    # Use a search URL (not entity-specific) to list hotels in a location
    params = (
        f"brd_dates={check_in},{check_out}"
        f"&brd_occupancy={adults}"
        f"&brd_currency={currency}"
        f"&brd_json=1"
        f"&hl=en"
    )
    if free_cancellation:
        params += "&brd_free_cancellation=true"

    search_url = f"https://www.google.com/travel/search?q=hotels+in+{location.replace(' ', '+')}&{params}"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(
                "https://api.brightdata.com/request",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_token}",
                },
                json={"zone": zone_name, "url": search_url, "format": "raw"},
            )
            res.raise_for_status()
            data = res.json()
    except Exception as e:
        return {"error": str(e)}

    return {
        "location": location,
        "check_in": check_in,
        "check_out": check_out,
        "adults": adults,
        "currency": currency,
        "results": data,
    }
```

---

## Method 2 — Free Selenium Scraper (small scale only)

**Limitations:** High IP block risk, slow, fragile CSS selectors, unreliable at scale.

```bash
pip install pandas tqdm selenium beautifulsoup4 webdriver-manager lxml
```

```python
from selenium import webdriver
from selenium.webdriver import ChromeOptions
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup

def scrape_hotels(location: str, max_hotels: int = 20) -> list[dict]:
    options = ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    # Remove --headless to reduce detection during dev

    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()), options=options
    )

    url = f"https://www.google.com/travel/search?q=hotels+in+{location}"
    driver.get(url)

    WebDriverWait(driver, 20).until(
        EC.presence_of_element_located((By.CLASS_NAME, "BcKagd"))
    )

    soup = BeautifulSoup(driver.page_source, "lxml")
    hotels = []

    for card in soup.find_all("div", class_="BcKagd")[:max_hotels]:
        name_el = card.find("h2", class_="BgYkof")
        price_el = card.find("span", class_="qQOQpe prxS3d")
        rating_el = card.find("span", class_="KFi5wf lA0BZ")
        link_el = card.find("a", class_="PVOOXe")

        if name_el:
            hotels.append({
                "name": name_el.text,
                "price": price_el.text if price_el else None,
                "rating": rating_el.text if rating_el else None,
                "link": "https://www.google.com" + link_el["href"] if link_el else None,
            })

    driver.quit()
    return hotels
```

---

## Env Variables

```env
# Bright Data SERP API
BRIGHTDATA_API_TOKEN=your_api_token
BRIGHTDATA_ZONE_NAME=your_zone_name

# For native proxy access (alternative)
BRIGHTDATA_CUSTOMER_ID=
BRIGHTDATA_ZONE_PASSWORD=
```

## Notes

- Use **Direct API** in production — simpler auth, no proxy config
- Use **Native Proxy** if you need more control over SSL certs or specific proxy routing
- `brd_json=1` always — HTML parsing is fragile
- Free scraper breaks whenever Google updates CSS classes — use as a last resort only
- Bright Data pricing: pay-per-successful-request, check https://brightdata.com/pricing/serp
