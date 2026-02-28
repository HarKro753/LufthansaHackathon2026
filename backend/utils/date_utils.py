"""Date parsing and formatting utilities — pure functions, no I/O."""

import re
from datetime import datetime, timedelta


MONTH_NAMES = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
]


def parse_date(date_str: str | None) -> datetime | None:
    """Parse a date string in various formats to a datetime object.

    Supports: ISO 8601, 'today', 'tomorrow', 'March 15', '14:30', duration strings.
    Returns None if unparseable.
    """
    if not date_str:
        return None

    # Try ISO 8601 first
    try:
        return datetime.fromisoformat(date_str)
    except (ValueError, TypeError):
        pass

    now = datetime.now()
    lower = date_str.lower().strip()

    if lower == "today":
        return now
    if lower == "tomorrow":
        return now + timedelta(days=1)

    # Time-only: "14:30" or "2:30 PM"
    time_match = re.match(r"^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$", lower, re.IGNORECASE)
    if time_match:
        hours = int(time_match.group(1))
        minutes = int(time_match.group(2))
        ampm = time_match.group(3)
        if ampm:
            ampm = ampm.lower()
            if ampm == "pm" and hours != 12:
                hours += 12
            if ampm == "am" and hours == 12:
                hours = 0
        return now.replace(hour=hours, minute=minutes, second=0, microsecond=0)

    # Duration: "2h 30min"
    duration_match = re.match(
        r"(\d+)\s*h(?:ours?)?\s*(\d+)?\s*m(?:ins?)?", lower, re.IGNORECASE
    )
    if duration_match:
        hours = int(duration_match.group(1))
        mins = int(duration_match.group(2)) if duration_match.group(2) else 0
        return now + timedelta(hours=hours, minutes=mins)

    # Month name + day: "March 15" or "15 March"
    for i, month_name in enumerate(MONTH_NAMES):
        regex = re.compile(
            rf"({month_name})\s+(\d{{1,2}})|(\d{{1,2}})\s+({month_name})",
            re.IGNORECASE,
        )
        match = regex.search(lower)
        if match:
            day = int(match.group(2) or match.group(3))
            date = datetime(now.year, i + 1, day)
            if date < now:
                date = date.replace(year=date.year + 1)
            return date

    return None


def parse_departure_time(departure_str: str | None) -> datetime | None:
    """Parse departure time with sensible defaults (9:00 AM for named dates)."""
    if not departure_str:
        return None

    # Try standard parse first
    result = parse_date(departure_str)
    if result:
        return result

    now = datetime.now()
    lower = departure_str.lower().strip()

    if lower == "tomorrow":
        tomorrow = now + timedelta(days=1)
        return tomorrow.replace(hour=9, minute=0, second=0, microsecond=0)

    if lower == "today":
        return now

    return None


def format_date_for_display(date: datetime) -> str:
    """Format a date for user-friendly display."""
    return date.strftime("%A, %B %d, %Y")


def format_datetime_iso(date: datetime) -> str:
    """Format datetime as ISO 8601."""
    return date.isoformat()


def format_date_iso(date: datetime) -> str:
    """Format date as YYYY-MM-DD."""
    return date.strftime("%Y-%m-%d")
