"""
Timeline Analysis Service
=========================
Analyzes Google Maps Timeline JSON exports to derive travel patterns,
habits, and personalized trip suggestions.

Ported from travel-agent Flask backend to standalone service module.
"""

import json
import os
import time
from datetime import datetime
from collections import Counter, defaultdict
from math import radians, cos, sin, asin, sqrt


# ─────────────────── Geo Helpers ───────────────────

def _parse_latlng(s: str):
    try:
        parts = s.replace("°", "").split(",")
        return float(parts[0].strip()), float(parts[1].strip())
    except Exception:
        return None, None


def _haversine(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 2 * 6371 * asin(sqrt(a))


def _parse_time(ts: str):
    try:
        return datetime.fromisoformat(ts)
    except Exception:
        return None


_CITY_REGIONS = [
    ((52.3, 13.0, 52.7, 13.8), "Berlin, Germany"),
    ((53.3, 9.7, 53.7, 10.2), "Hamburg, Germany"),
    ((48.0, 11.3, 48.3, 11.8), "Munich, Germany"),
    ((50.0, 8.5, 50.2, 8.8), "Frankfurt, Germany"),
    ((51.3, 6.6, 51.6, 7.2), "Düsseldorf, Germany"),
    ((50.8, 6.8, 51.1, 7.2), "Cologne, Germany"),
    ((48.7, 9.1, 48.9, 9.3), "Stuttgart, Germany"),
    ((47.3, 8.4, 47.5, 8.6), "Zurich, Switzerland"),
    ((48.1, 16.2, 48.3, 16.5), "Vienna, Austria"),
    ((40.6, -74.2, 40.9, -73.7), "New York, USA"),
    ((37.7, -122.5, 37.8, -122.3), "San Francisco, USA"),
    ((51.4, -0.5, 51.6, 0.3), "London, UK"),
    ((48.8, 2.2, 48.9, 2.5), "Paris, France"),
    ((41.3, 2.0, 41.5, 2.3), "Barcelona, Spain"),
    ((40.3, -3.8, 40.5, -3.6), "Madrid, Spain"),
    ((28.4, 76.8, 28.8, 77.4), "Delhi, India"),
    ((19.0, 72.7, 19.3, 73.0), "Mumbai, India"),
    ((12.8, 77.4, 13.1, 77.8), "Bangalore, India"),
    ((13.0, 80.1, 13.2, 80.3), "Chennai, India"),
    ((8.4, 76.8, 8.6, 77.0), "Trivandrum, India"),
    ((8.8, 76.5, 9.1, 76.7), "Kollam, India"),
    ((9.9, 76.2, 10.1, 76.4), "Kochi, India"),
    ((10.7, 76.6, 11.0, 76.8), "Palakkad, India"),
    ((11.2, 75.7, 11.4, 75.9), "Kozhikode, India"),
    ((25.1, 55.1, 25.4, 55.4), "Dubai, UAE"),
    ((1.2, 103.6, 1.5, 104.0), "Singapore"),
    ((35.5, 139.5, 35.8, 139.9), "Tokyo, Japan"),
    ((22.1, 113.8, 22.5, 114.3), "Hong Kong"),
    ((-33.9, 151.0, -33.7, 151.3), "Sydney, Australia"),
    ((55.5, 37.3, 55.9, 37.9), "Moscow, Russia"),
    ((45.3, 9.0, 45.6, 9.3), "Milan, Italy"),
    ((41.8, 12.3, 42.0, 12.6), "Rome, Italy"),
    ((43.7, 11.1, 43.8, 11.3), "Florence, Italy"),
    ((52.0, 4.2, 52.5, 5.0), "Amsterdam, Netherlands"),
    ((50.8, 4.2, 50.9, 4.5), "Brussels, Belgium"),
    ((38.7, -9.2, 38.8, -9.1), "Lisbon, Portugal"),
    ((37.9, 23.6, 38.1, 23.8), "Athens, Greece"),
    ((47.3, 4.8, 47.4, 5.1), "Dijon, France"),
    ((55.6, 12.4, 55.8, 12.7), "Copenhagen, Denmark"),
    ((47.4, 19.0, 47.6, 19.2), "Budapest, Hungary"),
    ((42.5, 18.0, 42.8, 18.2), "Dubrovnik, Croatia"),
    ((45.5, 10.5, 45.8, 10.8), "Lake Garda, Italy"),
    ((47.2, 11.3, 47.4, 11.5), "Innsbruck, Austria"),
    ((47.7, 12.9, 47.9, 13.2), "Salzburg, Austria"),
    ((49.3, 11.0, 49.5, 11.2), "Nuremberg, Germany"),
]

_COUNTRY_RANGES = [
    ((6, 68, 36, 98), "India"),
    ((47, 5, 55, 15), "Germany"),
    ((35, -10, 72, 40), "Europe"),
    ((24, -125, 50, -66), "USA"),
    ((-50, 110, -10, 155), "Australia"),
    ((20, 100, 45, 145), "East Asia"),
    ((20, 45, 32, 60), "Middle East"),
]

_geocache: dict = {}


def _city_from_coords(lat, lng):
    key = (round(lat, 3), round(lng, 3))
    if key in _geocache:
        return _geocache[key]
    for (la, lo, la2, lo2), name in _CITY_REGIONS:
        if la <= lat <= la2 and lo <= lng <= lo2:
            _geocache[key] = name
            return name
    for (la, lo, la2, lo2), name in _COUNTRY_RANGES:
        if la <= lat <= la2 and lo <= lng <= lo2:
            r = f"Somewhere in {name}"
            _geocache[key] = r
            return r
    r = f"({lat:.2f}, {lng:.2f})"
    _geocache[key] = r
    return r


# ─────────────── Single-Pass Analysis Engine ───────────────

def analyze_timeline(data: dict) -> dict:
    """Process Timeline.json in a single pass and return structured insights."""
    t0 = time.time()
    segments = data.get("semanticSegments", [])

    # Pre-allocate
    mode_stats = defaultdict(lambda: {"count": 0, "total_km": 0, "total_min": 0})
    visit_type_counts: Counter = Counter()
    place_stats = defaultdict(lambda: {"count": 0, "total_min": 0, "coords": None})
    visit_coords: list = []
    flights: list = []
    hour_counts: Counter = Counter()
    month_counts: Counter = Counter()

    skipped = 0
    for seg in segments:
        if "timelinePath" in seg and "visit" not in seg and "activity" not in seg:
            skipped += 1
            continue

        st = _parse_time(seg.get("startTime", ""))
        et = _parse_time(seg.get("endTime", ""))
        dur = ((et - st).total_seconds() / 60) if st and et else 0

        if st:
            hour_counts[st.hour] += 1
            month_counts[st.month] += 1

        if "visit" in seg:
            tc = seg["visit"].get("topCandidate", {})
            sem = tc.get("semanticType", "UNKNOWN")
            visit_type_counts[sem] += 1
            pid = tc.get("placeId", "unknown")
            loc = tc.get("placeLocation", {}).get("latLng", "")
            lat, lng = _parse_latlng(loc)
            place_stats[pid]["count"] += 1
            place_stats[pid]["total_min"] += dur
            if lat and lng:
                place_stats[pid]["coords"] = (lat, lng)
                visit_coords.append((lat, lng))

        if "activity" in seg:
            act = seg["activity"]
            mode = act.get("topCandidate", {}).get("type", "UNKNOWN")
            dist_m = act.get("distanceMeters", 0)
            if mode == "FLYING":
                sc = _parse_latlng(act.get("start", {}).get("latLng", ""))
                ec = _parse_latlng(act.get("end", {}).get("latLng", ""))
                flights.append({
                    "date": st.strftime("%Y-%m-%d") if st else "Unknown",
                    "origin": _city_from_coords(*sc) if sc[0] else "Unknown",
                    "destination": _city_from_coords(*ec) if ec[0] else "Unknown",
                    "duration_hrs": round(dur / 60, 1),
                    "distance_km": round(dist_m / 1000),
                })
                mode_stats[mode]["count"] += 1
                mode_stats[mode]["total_km"] += dist_m / 1000
                mode_stats[mode]["total_min"] += dur
            elif dist_m > 0:
                mode_stats[mode]["count"] += 1
                mode_stats[mode]["total_km"] += dist_m / 1000
                mode_stats[mode]["total_min"] += dur

    # Home base
    home_city = "Unknown"
    home_lat, home_lng = 0, 0
    if visit_coords:
        rounded = Counter((round(lat, 2), round(lng, 2)) for lat, lng in visit_coords)
        home_lat, home_lng = rounded.most_common(1)[0][0]
        home_city = _city_from_coords(home_lat, home_lng)

    # Top destinations (away from home)
    dest_counter: Counter = Counter()
    for lat, lng in visit_coords:
        d = _haversine(home_lat, home_lng, lat, lng)
        if d > 10:
            dest_counter[_city_from_coords(lat, lng)] += 1

    top_destinations = [{"city": c, "visits": n} for c, n in dest_counter.most_common(15)]

    # Transport breakdown
    transport = []
    for mode in [
        "IN_PASSENGER_VEHICLE", "WALKING", "IN_TRAIN", "IN_BUS",
        "IN_SUBWAY", "IN_TRAM", "CYCLING", "FLYING", "MOTORCYCLING", "IN_FERRY",
    ]:
        s = mode_stats.get(mode)
        if s and s["count"] > 0:
            label = mode.replace("IN_PASSENGER_VEHICLE", "Driving").replace("IN_", "").replace("_", " ").title()
            if mode == "FLYING":
                label = "Flying"
            transport.append({
                "mode": label,
                "trips": s["count"],
                "total_km": round(s["total_km"]),
                "total_hours": round(s["total_min"] / 60, 1),
            })
    transport.sort(key=lambda x: x["total_km"], reverse=True)

    # Primary transport
    non_fly = [t for t in transport if t["mode"] != "Flying"]
    primary_transport = non_fly[0]["mode"] if non_fly else "Unknown"

    # Preferences
    prefs = []
    walking = mode_stats.get("WALKING", {}).get("count", 0)
    driving = mode_stats.get("IN_PASSENGER_VEHICLE", {}).get("count", 0)
    transit = sum(mode_stats.get(m, {}).get("count", 0) for m in ["IN_BUS", "IN_TRAIN", "IN_SUBWAY", "IN_TRAM"])
    cycling = mode_stats.get("CYCLING", {}).get("count", 0)

    if driving > transit:
        prefs.append("Prefers driving over public transit")
    elif transit > driving:
        prefs.append("Prefers public transit over driving")
    if walking > driving:
        prefs.append("Walks more than drives — urban lifestyle")
    if cycling > 50:
        prefs.append("Active cyclist")
    if len(flights) > 20:
        prefs.append("Frequent flyer")
    elif len(flights) > 5:
        prefs.append("Occasional flyer")

    geo_diversity = len(set((round(lat, 1), round(lng, 1)) for lat, lng in visit_coords))
    if geo_diversity > 50:
        prefs.append("Highly mobile — extensive travel footprint")
    elif geo_diversity > 20:
        prefs.append("Moderately well-traveled")

    # Peak activity
    peak_hour = hour_counts.most_common(1)[0][0] if hour_counts else 12
    peak_months = [m for m, _ in month_counts.most_common(3)]
    month_names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    travel_season = ", ".join(month_names[m] for m in sorted(peak_months) if m < len(month_names))

    # Date range
    dates = [seg.get("startTime", "")[:10] for seg in segments if seg.get("startTime")]
    date_range = {"start": min(dates) if dates else "N/A", "end": max(dates) if dates else "N/A"}

    # ─── Deep pattern analysis ───

    total_km = sum(s["total_km"] for s in mode_stats.values())

    commute_distances = []
    commute_durations = []
    weekend_activity_count = 0
    weekday_activity_count = 0

    for seg in segments:
        st_t = _parse_time(seg.get("startTime", ""))
        et_t = _parse_time(seg.get("endTime", ""))
        if not st_t or not et_t:
            continue
        dur_min = (et_t - st_t).total_seconds() / 60
        is_weekend = st_t.weekday() >= 5

        if "activity" in seg:
            act = seg["activity"]
            mode = act.get("topCandidate", {}).get("type", "UNKNOWN")
            dist_m = act.get("distanceMeters", 0)
            if is_weekend:
                weekend_activity_count += 1
            else:
                weekday_activity_count += 1
            if (
                not is_weekend
                and mode == "IN_PASSENGER_VEHICLE"
                and (6 <= st_t.hour <= 9 or 16 <= st_t.hour <= 19)
            ):
                commute_distances.append(dist_m / 1000)
                commute_durations.append(dur_min)

    commute_avg_km = round(sum(commute_distances) / len(commute_distances), 1) if commute_distances else 0
    commute_avg_min = round(sum(commute_durations) / len(commute_durations)) if commute_durations else 0

    # Daily rhythm
    if peak_hour < 9:
        daily_rhythm = "Early Bird"
    elif peak_hour < 17:
        daily_rhythm = "Daytime Mover"
    else:
        daily_rhythm = "Night Owl"

    # Routine score
    visit_place_counter: Counter = Counter()
    for seg in segments:
        if "visit" in seg:
            pid = seg["visit"].get("topCandidate", {}).get("placeId", "")
            if pid:
                visit_place_counter[pid] += 1
    total_visit_events = sum(visit_place_counter.values())
    top3_pct = round(
        sum(c for _, c in visit_place_counter.most_common(3)) / total_visit_events * 100
    ) if total_visit_events else 0

    # Weekend explorer
    weekend_ratio = weekend_activity_count / max(weekday_activity_count, 1)
    is_weekend_explorer = weekend_ratio > 0.3

    # Flights per month
    flight_dates_all = []
    for seg in segments:
        if "activity" in seg and seg["activity"].get("topCandidate", {}).get("type") == "FLYING":
            fd = _parse_time(seg.get("startTime", ""))
            if fd:
                flight_dates_all.append(fd)
    flight_dates_all.sort()
    if len(flight_dates_all) >= 2:
        months_span = max((flight_dates_all[-1] - flight_dates_all[0]).days / 30, 1)
        flights_per_month = round(len(flight_dates_all) / months_span, 1)
    else:
        flights_per_month = 0

    # Traveler type
    traveler_type = "Balanced Traveler"
    if len(flights) > 20 and geo_diversity > 40:
        traveler_type = "Global Explorer"
    elif len(flights) > 10:
        traveler_type = "Frequent Flyer"
    elif driving > transit and commute_avg_km > 5:
        if is_weekend_explorer:
            traveler_type = "Road Trip Enthusiast"
        else:
            traveler_type = "Urban Commuter"
    elif transit > driving:
        traveler_type = "Transit Navigator"
    elif walking > driving:
        traveler_type = "Urban Walker"
    elif is_weekend_explorer and len(flights) > 3:
        traveler_type = "Weekend Explorer"

    type_taglines = {
        "Global Explorer": "You've seen more of the world than most — always chasing the next horizon.",
        "Frequent Flyer": "Airports are your second home. You rack up miles like a pro.",
        "Road Trip Enthusiast": "Open roads call your name. You love the freedom of driving to your next adventure.",
        "Urban Commuter": "Your daily rhythm is dialed in — efficient, consistent, city-smart.",
        "Transit Navigator": "Trains, buses, trams — you move through cities like a local.",
        "Urban Walker": "You explore on foot, soaking in neighborhoods one step at a time.",
        "Weekend Explorer": "Weekdays are routine, but weekends? That's when the adventure begins.",
        "Balanced Traveler": "A bit of everything — you adapt your travel style to the destination.",
    }

    # Distributions
    month_distribution = {month_names[m]: month_counts.get(m, 0) for m in range(1, 13)}

    day_names_ordered = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    day_map = {"Monday": "Mon", "Tuesday": "Tue", "Wednesday": "Wed", "Thursday": "Thu", "Friday": "Fri", "Saturday": "Sat", "Sunday": "Sun"}
    weekday_counts: Counter = Counter()
    for seg in segments:
        st_t = _parse_time(seg.get("startTime", ""))
        if st_t:
            weekday_counts[st_t.strftime("%A")] += 1
    weekday_distribution = {day_map.get(d, d): weekday_counts.get(d, 0) for d in day_names_ordered}

    hour_distribution = {f"{h:02d}": hour_counts.get(h, 0) for h in range(24)}

    elapsed = round(time.time() - t0, 2)

    return {
        "processing_time_sec": elapsed,
        "total_segments": len(segments),
        "kept_segments": len(segments) - skipped,
        "date_range": date_range,
        "home_city": home_city,
        "primary_transport": primary_transport,
        "transport_breakdown": transport,
        "total_flights": len(flights),
        "flights": flights,
        "top_destinations": top_destinations,
        "geographic_diversity": geo_diversity,
        "preferences": prefs,
        "travel_season": travel_season,
        "visit_categories": dict(visit_type_counts.most_common()),
        # Deep insights
        "traveler_type": traveler_type,
        "traveler_tagline": type_taglines.get(traveler_type, ""),
        "total_km": round(total_km),
        "commute_avg_km": commute_avg_km,
        "commute_avg_min": commute_avg_min,
        "daily_rhythm": daily_rhythm,
        "routine_score": top3_pct,
        "weekend_explorer": is_weekend_explorer,
        "flights_per_month": flights_per_month,
        "month_distribution": month_distribution,
        "weekday_distribution": weekday_distribution,
        "hour_distribution": hour_distribution,
    }


# ─────────────── Trip Suggestion Engine ───────────────

TRIP_DATABASE = [
    {"city": "Barcelona, Spain", "type": "beach_culture", "region": "Southern Europe", "drive_from_munich_hrs": 12, "flight_hrs": 2.2, "best_months": [4, 5, 6, 9, 10], "tags": ["beach", "architecture", "nightlife", "food"]},
    {"city": "Rome, Italy", "type": "culture_history", "region": "Southern Europe", "drive_from_munich_hrs": 9, "flight_hrs": 1.8, "best_months": [3, 4, 5, 9, 10, 11], "tags": ["history", "food", "architecture", "art"]},
    {"city": "Paris, France", "type": "culture_romance", "region": "Western Europe", "drive_from_munich_hrs": 8, "flight_hrs": 1.5, "best_months": [4, 5, 6, 9, 10], "tags": ["culture", "food", "art", "romance"]},
    {"city": "Amsterdam, Netherlands", "type": "culture", "region": "Western Europe", "drive_from_munich_hrs": 8, "flight_hrs": 1.5, "best_months": [4, 5, 6, 7, 8, 9], "tags": ["culture", "canals", "nightlife", "art"]},
    {"city": "Vienna, Austria", "type": "culture_music", "region": "Central Europe", "drive_from_munich_hrs": 4, "flight_hrs": 1.2, "best_months": [4, 5, 6, 9, 10, 12], "tags": ["music", "culture", "architecture", "coffee"]},
    {"city": "Prague, Czech Republic", "type": "culture_history", "region": "Central Europe", "drive_from_munich_hrs": 4, "flight_hrs": 1.2, "best_months": [4, 5, 6, 9, 10], "tags": ["history", "beer", "architecture", "budget"]},
    {"city": "Lisbon, Portugal", "type": "beach_culture", "region": "Southern Europe", "drive_from_munich_hrs": 24, "flight_hrs": 3.5, "best_months": [4, 5, 6, 9, 10], "tags": ["beach", "food", "nightlife", "budget"]},
    {"city": "Copenhagen, Denmark", "type": "design_culture", "region": "Northern Europe", "drive_from_munich_hrs": 10, "flight_hrs": 1.8, "best_months": [5, 6, 7, 8, 9], "tags": ["design", "food", "cycling", "hygge"]},
    {"city": "Budapest, Hungary", "type": "relaxation", "region": "Central Europe", "drive_from_munich_hrs": 7, "flight_hrs": 1.5, "best_months": [4, 5, 6, 9, 10], "tags": ["thermal baths", "nightlife", "budget", "architecture"]},
    {"city": "Dubrovnik, Croatia", "type": "beach_history", "region": "Southern Europe", "drive_from_munich_hrs": 10, "flight_hrs": 2.0, "best_months": [5, 6, 9, 10], "tags": ["beach", "history", "game of thrones", "islands"]},
    {"city": "Florence, Italy", "type": "art_culture", "region": "Southern Europe", "drive_from_munich_hrs": 7, "flight_hrs": 1.5, "best_months": [3, 4, 5, 9, 10, 11], "tags": ["art", "food", "wine", "renaissance"]},
    {"city": "Salzburg, Austria", "type": "nature_culture", "region": "Central Europe", "drive_from_munich_hrs": 1.5, "flight_hrs": None, "best_months": [6, 7, 8, 12], "tags": ["mountains", "music", "lakes", "skiing"]},
    {"city": "Lake Garda, Italy", "type": "nature_relaxation", "region": "Southern Europe", "drive_from_munich_hrs": 5, "flight_hrs": None, "best_months": [5, 6, 7, 8, 9], "tags": ["lake", "nature", "relaxation", "sailing"]},
    {"city": "Zurich, Switzerland", "type": "nature_luxury", "region": "Central Europe", "drive_from_munich_hrs": 3.5, "flight_hrs": 1.2, "best_months": [6, 7, 8, 9, 12, 1, 2], "tags": ["mountains", "luxury", "skiing", "chocolate"]},
    {"city": "Brussels, Belgium", "type": "food_culture", "region": "Western Europe", "drive_from_munich_hrs": 7, "flight_hrs": 1.3, "best_months": [4, 5, 6, 9, 10], "tags": ["food", "chocolate", "beer", "eu"]},
    {"city": "Milan, Italy", "type": "fashion_culture", "region": "Southern Europe", "drive_from_munich_hrs": 6, "flight_hrs": 1.3, "best_months": [4, 5, 9, 10], "tags": ["fashion", "food", "design", "shopping"]},
    {"city": "Innsbruck, Austria", "type": "nature_skiing", "region": "Central Europe", "drive_from_munich_hrs": 2, "flight_hrs": None, "best_months": [1, 2, 3, 6, 7, 8, 12], "tags": ["skiing", "mountains", "hiking", "nature"]},
    {"city": "Athens, Greece", "type": "history_beach", "region": "Southern Europe", "drive_from_munich_hrs": 20, "flight_hrs": 2.5, "best_months": [4, 5, 6, 9, 10], "tags": ["history", "beach", "food", "islands"]},
    {"city": "Stockholm, Sweden", "type": "design_nature", "region": "Northern Europe", "drive_from_munich_hrs": 16, "flight_hrs": 2.2, "best_months": [5, 6, 7, 8], "tags": ["design", "nature", "archipelago", "nordic"]},
    {"city": "Edinburgh, UK", "type": "culture_nature", "region": "Northern Europe", "drive_from_munich_hrs": 18, "flight_hrs": 2.5, "best_months": [5, 6, 7, 8, 12], "tags": ["history", "whisky", "nature", "festivals"]},
]


def suggest_trips(analysis: dict) -> list:
    """Generate personalized trip suggestions based on analysis data."""
    visited_cities = set()
    for d in analysis["top_destinations"]:
        visited_cities.add(d["city"])
    for f in analysis["flights"]:
        visited_cities.add(f["origin"])
        visited_cities.add(f["destination"])

    prefers_driving = analysis["primary_transport"] == "Driving"
    current_month = datetime.now().month
    month_names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    suggestions = []
    for trip in TRIP_DATABASE:
        city = trip["city"]
        already_visited = city in visited_cities
        score = 50

        if prefers_driving and trip.get("drive_from_munich_hrs") and trip["drive_from_munich_hrs"] <= 8:
            score += 25
            transport_suggestion = f"🚗 {trip['drive_from_munich_hrs']}h drive from {analysis['home_city']}"
        elif trip.get("flight_hrs"):
            score += 10
            transport_suggestion = f"✈️ {trip['flight_hrs']}h flight"
        else:
            transport_suggestion = f"🚗 {trip.get('drive_from_munich_hrs', '?')}h drive"

        if current_month in trip.get("best_months", []):
            score += 15
        if already_visited:
            score -= 20
        if not already_visited:
            score += 10

        reasons = []
        if not already_visited:
            reasons.append("New destination for you!")
        else:
            reasons.append("A favorite you've visited before")
        if prefers_driving and trip.get("drive_from_munich_hrs", 99) <= 6:
            reasons.append("Perfect weekend road trip distance")
        if current_month in trip.get("best_months", []):
            reasons.append("Great time to visit (peak season)")

        suggestions.append({
            "city": city,
            "region": trip["region"],
            "tags": trip["tags"],
            "transport": transport_suggestion,
            "score": score,
            "already_visited": already_visited,
            "reasons": reasons,
            "best_months": [month_names[m] for m in trip.get("best_months", [])],
        })

    suggestions.sort(key=lambda x: x["score"], reverse=True)
    return suggestions[:8]


# ─────────────── Email → Timeline Mapping ───────────────

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")

EMAIL_MAPPING = {
    "rishi@gmail.com": "Timeline.json",
    "hans.mueller@gmail.com": "MockTimeline.json",
}

_analysis_cache: dict = {}


def build_response(analysis: dict) -> dict:
    """Build the standard API response from analysis results."""
    trips = suggest_trips(analysis)
    return {
        "profile": {
            "home_city": analysis["home_city"],
            "primary_transport": analysis["primary_transport"],
            "transport_breakdown": analysis["transport_breakdown"],
            "total_flights": analysis["total_flights"],
            "top_destinations": analysis["top_destinations"],
            "geographic_diversity": analysis["geographic_diversity"],
            "preferences": analysis["preferences"],
            "travel_season": analysis["travel_season"],
            "date_range": analysis["date_range"],
            "traveler_type": analysis["traveler_type"],
            "traveler_tagline": analysis["traveler_tagline"],
            "total_km": analysis["total_km"],
            "commute_avg_km": analysis["commute_avg_km"],
            "commute_avg_min": analysis["commute_avg_min"],
            "daily_rhythm": analysis["daily_rhythm"],
            "routine_score": analysis["routine_score"],
            "weekend_explorer": analysis["weekend_explorer"],
            "flights_per_month": analysis["flights_per_month"],
            "month_distribution": analysis["month_distribution"],
            "weekday_distribution": analysis["weekday_distribution"],
            "hour_distribution": analysis["hour_distribution"],
        },
        "flights": analysis.get("flights", []),
        "suggestions": trips,
        "meta": {
            "processing_time_sec": analysis["processing_time_sec"],
            "total_segments": analysis["total_segments"],
            "kept_segments": analysis["kept_segments"],
        },
    }


def login_with_email(email: str) -> dict | None:
    """Look up a user's Timeline by their Gmail and return analysis + suggestions.
    Returns None if email is not found."""
    email = email.strip().lower()

    if email not in EMAIL_MAPPING:
        return None

    if email in _analysis_cache:
        return _analysis_cache[email]

    filepath = os.path.join(DATA_DIR, EMAIL_MAPPING[email])
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Timeline file not found on server for {email}")

    with open(filepath, "r") as f:
        data = json.load(f)

    analysis = analyze_timeline(data)
    response = build_response(analysis)
    response["email"] = email

    _analysis_cache[email] = response
    return response


def upload_and_analyze(data: dict) -> dict:
    """Analyze an uploaded Timeline.json dict."""
    if "semanticSegments" not in data:
        raise ValueError("Not a valid Google Maps Timeline export. Missing 'semanticSegments'.")

    analysis = analyze_timeline(data)
    return build_response(analysis)
