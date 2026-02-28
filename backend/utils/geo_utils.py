"""Geo utilities — Google Maps URL generation, transit segment extraction."""

from models.trip import GeocodedLocation, TransitSegment


def generate_route_url(
    origin: GeocodedLocation,
    destination: GeocodedLocation,
    travel_mode: str,
) -> str:
    """Generate a Google Maps directions URL for two geocoded locations."""
    mode_codes: dict[str, str] = {
        "DRIVE": "0",
        "BICYCLE": "1",
        "WALK": "2",
        "TRANSIT": "3",
        "TWO_WHEELER": "0",
    }
    mode_code = mode_codes.get(travel_mode, "0")

    center_lat = (origin.lat + destination.lat) / 2
    center_lng = (origin.lng + destination.lng) / 2

    lat_diff = abs(origin.lat - destination.lat)
    lng_diff = abs(origin.lng - destination.lng)
    max_diff = max(lat_diff, lng_diff)

    if max_diff > 10:
        zoom = 6
    elif max_diff > 5:
        zoom = 7
    elif max_diff > 2:
        zoom = 8
    elif max_diff > 1:
        zoom = 9
    else:
        zoom = 10

    base_path = f"{origin.lat},{origin.lng}/{destination.lat},{destination.lng}"
    auto_mode = "/am=t" if travel_mode == "TRANSIT" else ""
    data_param = f"!3m2!1e3!4b1!4m2!4m1!3e{mode_code}"

    return (
        f"https://www.google.com/maps/dir/{base_path}"
        f"/@{center_lat},{center_lng},{zoom}z{auto_mode}"
        f"/data={data_param}"
    )


def extract_transit_segments(legs: list[dict] | None) -> list[dict]:
    """Extract transit segments from Routes API leg data."""
    if not legs:
        return []

    segments: list[dict] = []

    for leg in legs:
        steps = leg.get("steps", [])
        for step in steps:
            td = step.get("transitDetails")
            if not td:
                continue

            stop_details = td.get("stopDetails", {})
            localized = td.get("localizedValues", {})
            transit_line = td.get("transitLine", {})

            segments.append(
                {
                    "departure_stop": (
                        stop_details.get("departureStop", {}).get("name", "Unknown")
                    ),
                    "arrival_stop": (
                        stop_details.get("arrivalStop", {}).get("name", "Unknown")
                    ),
                    "departure_time": (
                        localized.get("departureTime", {}).get("time", {}).get("text")
                        or stop_details.get("departureTime", "Unknown")
                    ),
                    "arrival_time": (
                        localized.get("arrivalTime", {}).get("time", {}).get("text")
                        or stop_details.get("arrivalTime", "Unknown")
                    ),
                    "line_name": transit_line.get("name", "Unknown line"),
                    "line_short": transit_line.get("nameShort"),
                    "vehicle_type": (
                        transit_line.get("vehicle", {}).get("type")
                        or transit_line.get("vehicle", {})
                        .get("name", {})
                        .get("text", "TRANSIT")
                    ),
                    "headsign": td.get("headsign"),
                    "stop_count": td.get("stopCount"),
                    "agency": (
                        transit_line.get("agencies", [{}])[0].get("name")
                        if transit_line.get("agencies")
                        else None
                    ),
                }
            )

    return segments
