---
name: google-travel-apis
description: How to use Google Routes API and Places API for travel agent functionality - finding places, planning routes, and building itineraries. Use when building travel agents, planning routes, finding hotels/restaurants, or when the user mentions Google APIs, directions, or place searches.
---

# Google Travel APIs

Use Google's Routes API and Places API to build travel agent functionality: find places, calculate routes, and create itineraries.

## Quick start

Find hotels near a location:

```bash
curl -X POST "https://places.googleapis.com/v1/places:searchText" \
  -H "X-Goog-Api-Key: YOUR_API_KEY" \
  -H "X-Goog-FieldMask: places.displayName,places.formattedAddress,places.rating" \
  -d '{"textQuery": "hotels near Times Square New York"}'
```

Get directions between two places:

```bash
curl -X POST "https://routes.googleapis.com/directions/v2:computeRoutes" \
  -H "X-Goog-Api-Key: YOUR_API_KEY" \
  -H "X-Goog-FieldMask: routes.duration,routes.distanceMeters" \
  -d '{
    "origin": {"address": "JFK Airport"},
    "destination": {"address": "Times Square"},
    "travelMode": "DRIVE"
  }'
```

## Instructions

### Step 1: Get API credentials

1. Go to Google Cloud Console
2. Create or select a project
3. Enable Places API (New) and Routes API
4. Create an API key
5. Restrict the key to only these APIs

### Step 2: Choose the right endpoint

| Need | API | Endpoint |
|------|-----|----------|
| Find places by name/query | Places | `places:searchText` |
| Find places near coordinates | Places | `places:searchNearby` |
| Get place details | Places | `places/{placeId}` |
| Autocomplete suggestions | Places | `places:autocomplete` |
| Directions A to B | Routes | `directions/v2:computeRoutes` |
| Distance matrix | Routes | `distanceMatrix/v2:computeRouteMatrix` |

### Step 3: Make API calls

**Text search (find places by query):**
```python
import requests

response = requests.post(
    "https://places.googleapis.com/v1/places:searchText",
    headers={
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "places.displayName,places.rating,places.formattedAddress"
    },
    json={"textQuery": "hotels near Eiffel Tower Paris", "maxResultCount": 10}
)
places = response.json()["places"]
```

**Nearby search (find places near coordinates):**
```python
response = requests.post(
    "https://places.googleapis.com/v1/places:searchNearby",
    headers={
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "places.displayName,places.types"
    },
    json={
        "locationRestriction": {
            "circle": {
                "center": {"latitude": 48.8584, "longitude": 2.2945},
                "radius": 1000.0
            }
        },
        "includedTypes": ["restaurant"]
    }
)
```

**Compute route:**
```python
response = requests.post(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    headers={
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.legs"
    },
    json={
        "origin": {"address": "Paris, France"},
        "destination": {"address": "Brussels, Belgium"},
        "travelMode": "DRIVE"
    }
)
route = response.json()["routes"][0]
duration = route["duration"]  # e.g., "10800s" (3 hours)
```

### Step 4: Handle responses

Parse and format for user:

```python
def format_place(place):
    return {
        "name": place["displayName"]["text"],
        "address": place.get("formattedAddress", ""),
        "rating": place.get("rating", "N/A"),
        "price_level": place.get("priceLevel", "N/A")
    }

def format_route(route):
    duration_secs = int(route["duration"].rstrip("s"))
    hours = duration_secs // 3600
    minutes = (duration_secs % 3600) // 60
    km = route["distanceMeters"] / 1000
    return f"{hours}h {minutes}m ({km:.1f} km)"
```

## Examples

### Example 1: Hotel search workflow

```python
# User: "Find hotels near the Eiffel Tower"

# 1. Search for hotels
places = search_text("hotels near Eiffel Tower Paris")

# 2. Get details for top results
for place in places[:3]:
    details = get_place_details(place["id"])
    
# 3. Calculate walking time to Eiffel Tower
for hotel in hotels:
    route = compute_route(hotel["address"], "Eiffel Tower")
    hotel["walk_time"] = route["duration"]

# 4. Present to user
"Here are 3 hotels near the Eiffel Tower:
1. Hotel ABC - 4.5★ - 5 min walk - €150/night
2. Hotel XYZ - 4.2★ - 8 min walk - €120/night
3. Hotel 123 - 4.0★ - 12 min walk - €95/night"
```

### Example 2: Day trip planning

```python
# User: "Plan a day visiting museums in Rome"

# 1. Find museums
museums = search_nearby(
    center={"latitude": 41.9028, "longitude": 12.4964},  # Rome center
    radius=5000,
    types=["museum"]
)

# 2. Get opening hours
for museum in museums:
    details = get_place_details(museum["id"], fields=["regularOpeningHours"])

# 3. Compute route matrix for optimal order
matrix = compute_route_matrix(
    origins=[m["address"] for m in museums],
    destinations=[m["address"] for m in museums]
)

# 4. Optimize visiting order (nearest neighbor or similar)
optimized_order = optimize_route(museums, matrix)

# 5. Generate itinerary
"Your Rome museum day:
9:00 - Vatican Museums (3 hours)
12:30 - Walk 15 min to lunch
14:00 - Borghese Gallery (2 hours)
16:30 - Walk 20 min
17:00 - Capitoline Museums (2 hours)"
```

### Example 3: Multi-city trip

```python
# User: "How long to drive Paris → Brussels → Amsterdam?"

routes = []
cities = ["Paris", "Brussels", "Amsterdam"]

for i in range(len(cities) - 1):
    route = compute_route(cities[i], cities[i+1], mode="DRIVE")
    routes.append({
        "from": cities[i],
        "to": cities[i+1],
        "duration": route["duration"],
        "distance": route["distanceMeters"]
    })

# Present
"Paris to Brussels: 3h 15m (320 km)
Brussels to Amsterdam: 2h 30m (210 km)
Total: 5h 45m driving (530 km)"
```

## Best practices

### Cost optimization

- **Use field masks**: Only request fields you need
  - Cheap: `displayName,formattedAddress`
  - Expensive: `reviews,photos,regularOpeningHours`

- **Cache place IDs**: They don't change, avoid repeated searches

- **Session tokens**: Group autocomplete requests to reduce billing

### Error handling

| Error | Cause | Solution |
|-------|-------|----------|
| `ZERO_RESULTS` | No places match | Broaden search area or terms |
| `OVER_QUERY_LIMIT` | Rate limit hit | Add delays, check quota |
| `REQUEST_DENIED` | API key issue | Check key restrictions |
| `INVALID_REQUEST` | Bad parameters | Validate inputs |

### Graceful degradation

```python
if not hotels_found:
    expand_search_radius()
    suggest_nearby_areas()

if route_unavailable:
    try_alternative_mode()  # Try transit instead of drive
    suggest_nearby_starting_point()
```

## Requirements

### API setup

1. Google Cloud project with billing enabled
2. APIs enabled:
   - Places API (New)
   - Routes API
3. API key with appropriate restrictions

### Field masks (required)

Always specify `X-Goog-FieldMask` header:

```
# Places
places.displayName,places.formattedAddress,places.rating,places.location

# Routes  
routes.duration,routes.distanceMeters,routes.legs.steps
```

### Travel modes

| Mode | Use For |
|------|---------|
| `DRIVE` | Car, taxi |
| `TRANSIT` | Public transport |
| `WALK` | Walking |
| `BICYCLE` | Biking |
| `TWO_WHEELER` | Motorcycle |

### Important place types

```
Accommodation: lodging, hotel, resort_hotel
Food: restaurant, cafe, bar
Transport: airport, train_station, bus_station
Attractions: tourist_attraction, museum, amusement_park
Services: atm, pharmacy, hospital
```

### Dependencies

- HTTP client (requests, httpx, etc.)
- Google Cloud API key
- JSON parser
