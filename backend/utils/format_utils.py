"""Formatting utilities — pure functions for duration, distance, travel modes."""

import re


def format_duration(duration_str: str) -> str:
    """Format a Routes API duration string (e.g. '10800s') to human readable."""
    seconds = int(duration_str.replace("s", ""))
    if seconds <= 0:
        return duration_str
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    return f"{hours}h {minutes}min" if hours > 0 else f"{minutes}min"


def format_distance(meters: int) -> str:
    """Format distance in meters to human readable."""
    if meters >= 1000:
        return f"{meters / 1000:.1f} km"
    return f"{meters} m"


def format_travel_mode(mode: str) -> str:
    """Convert a travel mode code to human-readable label."""
    mode_map: dict[str, str] = {
        "DRIVE": "Driving",
        "WALK": "Walking",
        "BICYCLE": "Cycling",
        "TRANSIT": "Public Transit",
        "TWO_WHEELER": "Motorcycle/Scooter",
    }
    return mode_map.get(mode, mode)


def parse_duration_to_minutes(duration: str) -> int:
    """Parse a formatted duration string (e.g. '2h 30min') to total minutes."""
    hours_match = re.search(r"(\d+)\s*h", duration, re.IGNORECASE)
    mins_match = re.search(r"(\d+)\s*m", duration, re.IGNORECASE)
    total = 0
    if hours_match:
        total += int(hours_match.group(1)) * 60
    if mins_match:
        total += int(mins_match.group(1))
    return total
