---
name: travel-agent-apis
description: APIs for building an AI travel agent - accommodation (Booking.com, vacation rentals), routes, places, and how to combine them. Use when building travel booking systems, integrating with Booking.com API, or when the user asks about travel APIs.
---

# Travel Agent APIs

Build an AI travel agent using Booking.com for accommodations (including vacation rentals) and Google APIs for routes and attractions. This skill covers the full stack needed for a travel booking system.

## Quick start

Search for apartments in Paris:

```python
# Booking.com Demand API
import requests
from requests.auth import HTTPBasicAuth

# 1. Get city ID
cities = requests.get(
    "https://distribution-xml.booking.com/2.10/json/cities",
    params={"name": "Paris", "country": "fr"},
    auth=HTTPBasicAuth(USERNAME, PASSWORD)
).json()
city_id = cities["result"][0]["city_id"]

# 2. Search accommodations
hotels = requests.get(
    "https://distribution-xml.booking.com/2.10/json/hotels",
    params={
        "city_ids": city_id,
        "checkin": "2026-03-15",
        "checkout": "2026-03-18",
        "guest_qty": 2,
        "accommodation_types": "201,208,213"  # Apartments, vacation homes, villas
    },
    auth=HTTPBasicAuth(USERNAME, PASSWORD)
).json()
```

## Instructions

### Step 1: Choose your APIs

| Need | API | Notes |
|------|-----|-------|
| Hotels & vacation rentals | Booking.com | Primary accommodation source |
| Restaurants & attractions | Google Places | Best for POI discovery |
| Directions & travel times | Google Routes | Route planning |
| Flights | Amadeus or Skyscanner | Not covered here |

**Important**: Airbnb has NO public API (shut down 2018). Use Booking.com's apartments/vacation homes instead.

### Step 2: Set up Booking.com access

1. Register as affiliate: https://secure.booking.com/affiliate-program/
2. Apply for API access through Partner Centre
3. Receive credentials (username/password for Basic Auth)

### Step 3: Implement accommodation search

```python
def search_accommodations(city, country, checkin, checkout, guests, acc_type="any"):
    # Get city ID
    city_response = requests.get(
        f"{BOOKING_BASE}/cities",
        params={"name": city, "country": country},
        auth=auth
    )
    city_id = city_response.json()["result"][0]["city_id"]
    
    # Map accommodation types
    type_map = {
        "hotel": "204",
        "apartment": "201",
        "villa": "213",
        "vacation_home": "208",
        "hostel": "205",
        "any": "201,204,205,208,213"
    }
    
    # Search
    params = {
        "city_ids": city_id,
        "checkin": checkin,
        "checkout": checkout,
        "guest_qty": guests,
        "accommodation_types": type_map.get(acc_type, type_map["any"])
    }
    
    response = requests.get(f"{BOOKING_BASE}/hotels", params=params, auth=auth)
    return response.json()["result"]
```

### Step 4: Get pricing and availability

```python
def get_availability(hotel_ids, checkin, checkout):
    response = requests.get(
        f"{BOOKING_BASE}/blockAvailability",
        params={
            "hotel_ids": ",".join(hotel_ids),
            "checkin": checkin,
            "checkout": checkout
        },
        auth=auth
    )
    return response.json()
```

### Step 5: Combine with Google APIs

```python
def enrich_with_location_data(accommodations, attractions_query):
    # For each accommodation, find nearby attractions
    for acc in accommodations:
        # Get walking distance to key attractions
        route = compute_route(
            acc["address"],
            attractions_query,
            mode="WALK"
        )
        acc["walk_time"] = route["duration"]
        
        # Find nearby restaurants
        restaurants = search_nearby(
            center=acc["location"],
            radius=500,
            types=["restaurant"]
        )
        acc["nearby_restaurants"] = restaurants[:3]
    
    return accommodations
```

## Examples

### Example 1: Full accommodation search

```python
# User: "Find apartments in Barcelona for March 15-18, 2 guests"

# 1. Search Booking.com
accommodations = search_accommodations(
    city="Barcelona",
    country="es",
    checkin="2026-03-15",
    checkout="2026-03-18",
    guests=2,
    acc_type="apartment"
)

# 2. Get availability and pricing
hotel_ids = [a["hotel_id"] for a in accommodations[:10]]
availability = get_availability(hotel_ids, "2026-03-15", "2026-03-18")

# 3. Format results
results = []
for acc in accommodations[:5]:
    results.append({
        "name": acc["name"],
        "rating": acc["review_score"],
        "price": availability[acc["hotel_id"]]["min_price"],
        "address": acc["address"],
        "type": get_accommodation_type(acc["accommodation_type_id"])
    })

# 4. Present
"Found 5 apartments in Barcelona:
1. Modern Loft - 9.2★ - €120/night - Gothic Quarter
2. Beach Apartment - 8.8★ - €95/night - Barceloneta
..."
```

### Example 2: Combined trip planning

```python
# User: "Find me a nice apartment near the Louvre, suggest restaurants nearby"

# 1. Search apartments (Booking.com)
apartments = search_accommodations("Paris", "fr", "2026-03-15", "2026-03-18", 2, "apartment")

# 2. Filter by proximity to Louvre (Google Routes)
louvre_coords = {"latitude": 48.8606, "longitude": 2.3376}
for apt in apartments:
    route = compute_route(apt["address"], "Louvre Museum Paris", mode="WALK")
    apt["walk_to_louvre"] = route["duration"]

apartments_near_louvre = [a for a in apartments if parse_duration(a["walk_to_louvre"]) < 15]

# 3. Find restaurants (Google Places)
restaurants = search_nearby(
    center=louvre_coords,
    radius=500,
    types=["restaurant"]
)

# 4. Present combined results
"Here are 3 apartments near the Louvre:
1. Charming Studio - €120/night - 3 min walk to Louvre
2. Modern Loft - €180/night - 7 min walk to Louvre
...

Nearby restaurants:
1. Le Fumoir (French) - €€€ - 4.5★
2. Café Marly (French) - €€€€ - 4.3★
..."
```

### Example 3: Multi-destination itinerary

```python
# User: "Plan 5 days: Paris, Amsterdam, Brussels"

itinerary = []
cities = [
    {"name": "Paris", "country": "fr", "days": 2},
    {"name": "Amsterdam", "country": "nl", "days": 2},
    {"name": "Brussels", "country": "be", "days": 1}
]

for city in cities:
    # Get accommodations
    hotels = search_accommodations(city["name"], city["country"], ...)
    
    # Get attractions
    attractions = search_text(f"top attractions in {city['name']}")
    
    itinerary.append({
        "city": city["name"],
        "days": city["days"],
        "hotel": hotels[0],
        "attractions": attractions[:5]
    })

# Calculate travel between cities
for i in range(len(cities) - 1):
    route = compute_route(cities[i]["name"], cities[i+1]["name"], mode="TRANSIT")
    itinerary[i]["travel_to_next"] = route
```

## Best practices

### Accommodation types (Booking.com)

| Code | Type |
|------|------|
| 201 | Apartments |
| 204 | Hotels |
| 205 | Hostels |
| 206 | Guest houses |
| 208 | Holiday homes / Vacation rentals |
| 212 | B&Bs |
| 213 | Villas |
| 220 | Resorts |

### API combination strategy

1. **Booking.com first**: Get accommodations with real prices
2. **Google Places second**: Enrich with nearby attractions
3. **Google Routes third**: Calculate travel times

### Error handling

```python
def robust_search(city, country, checkin, checkout, guests):
    try:
        return search_accommodations(city, country, checkin, checkout, guests)
    except NoResultsError:
        # Try broader search
        return search_accommodations(city, country, checkin, checkout, guests, acc_type="any")
    except APIError as e:
        # Fall back to cached results or inform user
        return get_cached_results(city) or {"error": str(e)}
```

### Revenue model

You earn commission on bookings made through your affiliate links:
- Booking.com: 25-40% of their commission
- This means your travel agent can actually generate revenue

## Requirements

### Booking.com API

- **Base URL**: `https://distribution-xml.booking.com/2.10/json/`
- **Auth**: HTTP Basic Authentication
- **Required**: Affiliate account with API access

### Key endpoints

| Endpoint | Purpose |
|----------|---------|
| `/cities` | Get city IDs |
| `/hotels` | Search accommodations |
| `/blockAvailability` | Get pricing |
| `/hotels?hotel_ids=X` | Get hotel details |

### Google APIs (see google-travel-apis skill)

- Places API for attractions/restaurants
- Routes API for directions

### Dependencies

- HTTP client with Basic Auth support
- Google Cloud API key
- Booking.com affiliate credentials
