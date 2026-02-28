---
name: lufthansa-api
description: Access real-time Lufthansa flight data via the official Lufthansa Open API. Use when checking flight status, retrieving flight schedules, looking up airport/airline reference data, getting seat maps, or building travel agents for Lufthansa Group flights (LH, LX, OS, SN, EN, WK, 4Y).
---

# Lufthansa Open API

Official REST API from Lufthansa Group. Covers real-time flight status, schedules, reference data (airports, airlines, aircraft), seat maps, lounges, and cargo. OAuth 2.0 auth, JSON responses (XML also available).

Docs: https://developer.lufthansa.com/docs
Playground: https://developer.lufthansa.com/io-docs
Register: https://developer.lufthansa.com/member/register

**Airline codes covered:** LH (Lufthansa), LX (Swiss), OS (Austrian), SN (Brussels Airlines), EN (Air Dolomiti), WK (Edelweiss), 4Y (Eurowings Discover)

## Auth — OAuth 2.0 Client Credentials

Tokens last 21,600 seconds (6 hours). Cache and reuse — don't fetch a new token per request.

```bash
# Get token
curl -X POST "https://api.lufthansa.com/v1/oauth/token" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "grant_type=client_credentials"

# Response
{"access_token":"d8bmzggu72dy69tzkffe6vaa","token_type":"bearer","expires_in":21600}
```

**Known quirk:** response says `token_type: "bearer"` (lowercase) but you must send `Authorization: Bearer TOKEN` (uppercase B) in requests.

```bash
# All requests use this header
Authorization: Bearer YOUR_ACCESS_TOKEN
Accept: application/json   # default is XML — always include this for JSON
```

## Base URL

```
https://api.lufthansa.com/v1/
```

## TypeScript Token Manager

```typescript
class LufthansaClient {
  private token: string | null = null;
  private tokenExpiry = 0;

  async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiry) return this.token;

    const res = await fetch('https://api.lufthansa.com/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.LH_CLIENT_ID!,
        client_secret: process.env.LH_CLIENT_SECRET!,
        grant_type: 'client_credentials',
      }),
    });
    const data = await res.json();
    this.token = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // 60s buffer
    return this.token!;
  }

  async get(path: string): Promise<any> {
    const token = await this.getToken();
    const res = await fetch(`https://api.lufthansa.com/v1${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) throw new Error(`LH API ${res.status}: ${await res.text()}`);
    return res.json();
  }
}

const lh = new LufthansaClient();
```

---

## Endpoints

### Flight Status

**By flight number** (range: 7 days past → 5 days future):
```
GET /operations/flightstatus/{flightNumber}/{date}
```
```bash
# LH 400 on specific date
curl "https://api.lufthansa.com/v1/operations/flightstatus/LH400/2026-03-05" \
  -H "Authorization: Bearer TOKEN" -H "Accept: application/json"
```

**By route (city pair)**:
```
GET /operations/flightstatus/{origin}/{destination}/{date}
```
```bash
GET /operations/flightstatus/FRA/JFK/2026-03-05
```

**Arrivals at airport** (window up to 4h):
```
GET /operations/flightstatus/arrivals/{airportCode}/{fromDateTime}/{until}
```

**Departures at airport**:
```
GET /operations/flightstatus/departures/{airportCode}/{fromDateTime}/{until}
```

**Flight Status Response fields:**
```json
{
  "FlightStatusResource": {
    "Flights": {
      "Flight": {
        "Departure": {
          "AirportCode": "FRA",
          "ScheduledTimeLocal": { "DateTime": "2026-03-05T10:50" },
          "ScheduledTimeUTC": { "DateTime": "2026-03-05T09:50Z" },
          "ActualTimeLocal": { "DateTime": "2026-03-05T11:06" },
          "TimeStatus": {
            "Code": "DL",
            "Definition": "Flight Delayed"
          },
          "Terminal": { "Name": "1", "Gate": "Z50" }
        },
        "Arrival": {
          "AirportCode": "JFK",
          "ScheduledTimeLocal": { "DateTime": "2026-03-05T13:45" },
          "ActualTimeLocal": { "DateTime": "2026-03-05T16:34" },
          "TimeStatus": { "Code": "DL", "Definition": "Flight Delayed" },
          "Terminal": { "Name": "C", "Gate": "002" }
        },
        "MarketingCarrier": { "AirlineID": "LH", "FlightNumber": "400" },
        "OperatingCarrier": { "AirlineID": "LH", "FlightNumber": "400" },
        "Equipment": { "AircraftCode": "34E" },
        "FlightStatus": { "Code": "LD", "Definition": "Flight Landed" }
      }
    }
  }
}
```

**FlightStatus codes:**
- `CD` — Cancelled
- `DP` — Departed
- `LD` — Landed
- `RT` — Rerouted
- `NA` — No status

**TimeStatus codes:**
- `OT` — On Time
- `DL` — Delayed
- `FE` — Early
- `NI` — Next Information
- `NO` — No status

---

### Flight Schedules

Timetable data for LH Group airlines. Aggregated by date range.

```
GET /flight-schedules/flightschedules/passenger?airlines=LH&flightNumberRanges=400-405&startDate=05MAR26&endDate=10MAR26&daysOfOperation=1234567&timeMode=UTC
```

Parameters:
- `airlines` — comma-separated airline codes (LH, LX, OS, SN, EN, WK, 4Y)
- `flightNumberRanges` — e.g. `400-405` or `400`
- `startDate` / `endDate` — format: `DDMMMYY` (e.g. `05MAR26`)
- `daysOfOperation` — `1234567` = Mon-Sun (1=Mon, 7=Sun)
- `timeMode` — `UTC` or `LT`

Departure/arrival times are in **minutes since midnight** (e.g. `590` = 9:50 UTC).

---

### Reference Data

Static directories — airport codes, airline codes, aircraft types.

```bash
# All airports (paginated)
GET /references/airports?limit=100&offset=0

# Single airport
GET /references/airports/FRA

# Nearest airports by coordinates
GET /references/airports/nearest/{latitude},{longitude}

# Airlines
GET /references/airlines/LH

# Aircraft types
GET /references/aircraft/74H

# Countries
GET /references/countries/DE

# Cities
GET /references/cities/HAM
```

Airport response includes: IATA code, names in multiple languages, coordinates, UTC offset, country.

---

### Offers

**Seat Maps** — visual seat layout for a specific flight:
```
GET /offers/seatmaps/{flightNumber}/{origin}/{destination}/{date}/{cabinClass}
```
```bash
GET /offers/seatmaps/LH400/FRA/JFK/2026-03-05/M
# Cabin classes: M=Economy, C=Business, F=First, E=Premium Economy
```

**Lounges** — Lufthansa lounges at an airport:
```
GET /offers/lounges/{location}?cabinClass=C&tierCode=SEN
```
- `tierCode`: HON=HON Circle, SEN=Senator, FTL=Frequent Traveller

---

### Cargo

```bash
# Track a shipment
GET /cargo/shipmenttracking/{aWBPrefix}-{aWBNumber}

# Cargo flight routes
GET /cargo/routes/{origin}/{destination}/{fromDate}/{productCode}
```

---

### Notifications (Real-time via MQTT)

Subscribe to flight update events via MQTT broker. Useful for live flight tracking without polling.

```bash
# 1. Get OAuth token (as above)
# 2. Subscribe to topic
POST /notifications/push/subscribe
{ "topic": "FlightUpdate/LH400/2026-03-05" }

# 3. Get JWT for MQTT connection
GET /notifications/jwt/token

# 4. Connect to MQTT broker with JWT
# broker: mqtt.lufthansa.com
```

Events pushed: departure updates, arrival updates, delay notifications, gate changes, cancellations.

---

## Paging

Large result sets are paginated. Response includes `Meta.Link` with `rel="next"`:
```json
{
  "Meta": {
    "TotalCount": 230,
    "Limit": 100,
    "Offset": 0,
    "Link": [
      { "@Href": "...?limit=100&offset=100", "@Rel": "next" }
    ]
  }
}
```

Use `limit` and `offset` query params on all reference endpoints.

---

## Error Codes

| HTTP | Meaning |
|---|---|
| 400 | Bad request — check params |
| 401 | Invalid/expired token — re-authenticate |
| 403 | Quota exceeded or plan restriction |
| 404 | Not found (flight/airport doesn't exist) |
| 410 | Gone — data outside available range |
| 500 | Server error — retry |

---

## Rate Limits

- **Public Plan** — limited requests, sufficient for exploration and development
- **Commercial/Partner Plan** — contact Lufthansa for raised quotas
- Token endpoint: don't hammer it — tokens last 6 hours, cache them

---

## Use Cases

| Goal | Endpoint |
|---|---|
| Check if LH flight is on time | `/operations/flightstatus/LH400/2026-03-05` |
| Get all departures from FRA today | `/operations/flightstatus/departures/FRA/{datetime}/{+4h}` |
| Build a timetable for LH FRA→JFK | `/flight-schedules/flightschedules/passenger?airlines=LH&...` |
| Seat selection UI | `/offers/seatmaps/LH400/FRA/JFK/2026-03-05/M` |
| Find nearest airport to coordinates | `/references/airports/nearest/53.55,10.00` |
| Track cargo shipment | `/cargo/shipmenttracking/020-12345678` |
| Live flight updates (no polling) | MQTT notifications |

## Notes

- **XML is default** — always send `Accept: application/json` or you get XML
- **Marketing vs Operating carrier** — a flight sold as LH may operate as OS. Always check both `MarketingCarrier` and `OperatingCarrier`.
- **Times as minutes** in schedules (not ISO 8601) — `590` = 9:50. Convert: `Math.floor(590/60)` hours, `590%60` minutes.
- **Date format differs** — flight status uses `yyyy-MM-dd`, schedules use `DDMMMYY` (e.g. `05MAR26`)
- Partner API (fares, deeplinks, seat details) requires separate Partner Plan token and agreement
