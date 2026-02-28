---
name: hasdata-flights-api
description: Search real-time Google Flights data via the HasData API. Use when building travel agents, flight search features, or when the user wants to find flights, compare prices, or check availability between airports. Supports one-way, round-trip, and multi-city searches.
---

# HasData Google Flights API

Real-time flight search via HasData's Google Flights scraping API. 15 credits per request. Structured JSON response with prices, airlines, stops, and departure tokens for round-trip follow-up.

Docs: https://docs.hasdata.com/apis/google-travel/flights

## Auth

All requests require `x-api-key` header. Get key at https://app.hasdata.com

```bash
x-api-key: <your-api-key>
```

## Base URL

```
GET https://api.hasdata.com/scrape/google/flights
```

## Quick Start

```bash
# One-way flight Hamburg → Copenhagen
curl -G "https://api.hasdata.com/scrape/google/flights" \
  -H "x-api-key: YOUR_KEY" \
  --data-urlencode "departureId=HAM" \
  --data-urlencode "arrivalId=CPH" \
  --data-urlencode "outboundDate=2026-03-05" \
  --data-urlencode "type=oneWay" \
  --data-urlencode "currency=EUR"

# Round-trip with class filter
curl -G "https://api.hasdata.com/scrape/google/flights" \
  -H "x-api-key: YOUR_KEY" \
  --data-urlencode "departureId=HAM" \
  --data-urlencode "arrivalId=JFK" \
  --data-urlencode "outboundDate=2026-04-01" \
  --data-urlencode "returnDate=2026-04-10" \
  --data-urlencode "type=roundTrip" \
  --data-urlencode "travelClass=Economy" \
  --data-urlencode "currency=EUR"
```

## Key Parameters

| Parameter | Required | Description |
|---|---|---|
| `departureId` | Yes | IATA airport code (e.g. HAM, LHR, JFK) or location kgmid (`/m/02_286`) |
| `arrivalId` | Yes | IATA airport code or kgmid. Comma-separate for multi-airport (e.g. `JFK,LGA`) |
| `outboundDate` | Yes | `yyyy-MM-dd` format |
| `returnDate` | No | Required for `roundTrip`. `yyyy-MM-dd` format |
| `type` | No | `roundTrip` (default), `oneWay`, `multiCity` |
| `multiCityJson` | No | JSON array for multi-city: `[{"departureId":"HAM","arrivalId":"CPH","date":"2026-03-05"}]` |
| `travelClass` | No | `Economy`, `Premium Economy`, `Business`, `First` |
| `adults` | No | Number of adult passengers (≥1) |
| `children` | No | Number of child passengers |
| `stops` | No | Max stops filter |
| `sortBy` | No | `price`, `departure_time`, `arrival_time`, `duration` |
| `currency` | No | ISO currency code (e.g. `EUR`, `USD`) |
| `gl` | No | Two-letter country code to localize results |
| `hl` | No | Two-letter language code |
| `showHidden` | No | Include hidden/unlisted options |

## Response Structure

```json
{
  "bestFlights": [...],       // top recommended results
  "otherFlights": [...],      // remaining options
  "priceInsights": {
    "lowestPrice": 89,
    "priceLevel": "low",
    "typicalPriceRange": [80, 150]
  }
}
```

Each flight object:
```json
{
  "flights": [
    {
      "departureAirport": { "name": "Hamburg", "id": "HAM", "time": "06:30" },
      "arrivalAirport": { "name": "Copenhagen", "id": "CPH", "time": "07:45" },
      "duration": 75,
      "airplane": "Airbus A320",
      "airline": "Lufthansa",
      "airlineLogo": "https://...",
      "flightNumber": "LH 822",
      "travelClass": "Economy",
      "legroom": "74 cm",
      "extensions": ["In-seat USB outlet", "On-demand video"]
    }
  ],
  "totalDuration": 75,
  "price": 89,
  "type": "One way",
  "departureToken": "abc123..."  // use for round-trip return leg query
}
```

## Round-Trip Pattern

Step 1 — get outbound flights, note `departureToken` from chosen flight.
Step 2 — query again with `departureToken` to get matching return flights:

```bash
curl -G "https://api.hasdata.com/scrape/google/flights" \
  -H "x-api-key: YOUR_KEY" \
  --data-urlencode "departureId=HAM" \
  --data-urlencode "arrivalId=JFK" \
  --data-urlencode "outboundDate=2026-04-01" \
  --data-urlencode "returnDate=2026-04-10" \
  --data-urlencode "departureToken=TOKEN_FROM_STEP_1"
```

## TypeScript Usage

```typescript
async function searchFlights(params: {
  from: string;
  to: string;
  date: string;
  returnDate?: string;
  currency?: string;
}) {
  const url = new URL('https://api.hasdata.com/scrape/google/flights');
  url.searchParams.set('departureId', params.from);
  url.searchParams.set('arrivalId', params.to);
  url.searchParams.set('outboundDate', params.date);
  url.searchParams.set('type', params.returnDate ? 'roundTrip' : 'oneWay');
  if (params.returnDate) url.searchParams.set('returnDate', params.returnDate);
  if (params.currency) url.searchParams.set('currency', params.currency);

  const res = await fetch(url.toString(), {
    headers: { 'x-api-key': process.env.HASDATA_API_KEY! }
  });
  return res.json();
}
```

## Notes

- Credits shared across all HasData APIs (15 per flight request)
- Credits expire at end of billing period — no rollover
- Use IATA codes for airports, kgmid for cities/regions (enables multi-airport city search)
- For travel agents: combine with Google Routes API (directions) and Places API (hotels/restaurants)
