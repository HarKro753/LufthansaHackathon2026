"""ICS calendar export service — generates .ics files from trip state."""

from datetime import datetime

from models.trip import TripState, TripRoute, TripStay, TripActivity


def _pad(n: int) -> str:
    return str(n).zfill(2)


def _to_ics_datetime(dt: datetime) -> str:
    return f"{dt.year}{_pad(dt.month)}{_pad(dt.day)}T{_pad(dt.hour)}{_pad(dt.minute)}00"


def _to_ics_date(dt: datetime) -> str:
    return f"{dt.year}{_pad(dt.month)}{_pad(dt.day)}"


def _escape(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
    )


def _build_route_event(route: TripRoute) -> str:
    lines = [
        "BEGIN:VEVENT",
        f"UID:{route.id}@lh-travel-agent",
        f"DTSTART:{_to_ics_datetime(route.departure_time)}",
        f"DTEND:{_to_ics_datetime(route.arrival_time)}",
        f"SUMMARY:{_escape(f'{route.travel_mode}: {route.origin} -> {route.destination}')}",
        f"DESCRIPTION:{_escape(f'{route.distance} | {route.duration}' + (f'\\n{route.selection_reason}' if route.selection_reason else ''))}",
        f"LOCATION:{_escape(route.origin_address)}",
    ]
    if route.google_maps_url:
        lines.append(f"URL:{route.google_maps_url}")
    lines.append("END:VEVENT")
    return "\r\n".join(lines)


def _build_stay_event(stay: TripStay) -> str:
    desc_parts = [f"{stay.nights} night{'s' if stay.nights != 1 else ''}"]
    if stay.total_price is not None:
        desc_parts.append(f"Total: {stay.total_price} EUR")
    if stay.rating is not None:
        desc_parts.append(f"Rating: {stay.rating}")
    if stay.selection_reason:
        desc_parts.append(stay.selection_reason)

    lines = [
        "BEGIN:VEVENT",
        f"UID:{stay.id}@lh-travel-agent",
        f"DTSTART;VALUE=DATE:{_to_ics_date(stay.check_in_date)}",
        f"DTEND;VALUE=DATE:{_to_ics_date(stay.check_out_date)}",
        f"SUMMARY:{_escape(f'Stay: {stay.name}')}",
        f"DESCRIPTION:{_escape(' | '.join(desc_parts))}",
        f"LOCATION:{_escape(stay.address)}",
    ]
    if stay.website:
        lines.append(f"URL:{stay.website}")
    lines.append("END:VEVENT")
    return "\r\n".join(lines)


def _build_activity_event(activity: TripActivity) -> str:
    duration_minutes = activity.duration or 60
    lines = ["BEGIN:VEVENT", f"UID:{activity.id}@lh-travel-agent"]

    if activity.scheduled_date and activity.scheduled_time:
        start_dt = activity.scheduled_date.replace(
            hour=int(activity.scheduled_time.split(":")[0]),
            minute=int(activity.scheduled_time.split(":")[1]),
        )
        lines.append(f"DTSTART:{_to_ics_datetime(start_dt)}")

        from datetime import timedelta

        end_dt = start_dt + timedelta(minutes=duration_minutes)
        lines.append(f"DTEND:{_to_ics_datetime(end_dt)}")
    elif activity.scheduled_date:
        lines.append(f"DTSTART;VALUE=DATE:{_to_ics_date(activity.scheduled_date)}")
        lines.append(f"DTEND;VALUE=DATE:{_to_ics_date(activity.scheduled_date)}")
    else:
        now = datetime.now()
        lines.append(f"DTSTART;VALUE=DATE:{_to_ics_date(now)}")
        lines.append(f"DTEND;VALUE=DATE:{_to_ics_date(now)}")

    type_label = activity.type.capitalize()
    lines.append(f"SUMMARY:{_escape(f'{type_label}: {activity.name}')}")

    desc_parts: list[str] = []
    if activity.rating is not None:
        desc_parts.append(f"Rating: {activity.rating}")
    if activity.price_level:
        desc_parts.append(f"Price: {activity.price_level}")
    if activity.selection_reason:
        desc_parts.append(activity.selection_reason)
    lines.append(f"DESCRIPTION:{_escape(' | '.join(desc_parts))}")
    lines.append(f"LOCATION:{_escape(activity.address)}")
    lines.append("END:VEVENT")

    return "\r\n".join(lines)


def generate_ics(trip: TripState) -> str:
    """Generate a complete .ics calendar string from a TripState."""
    events: list[str] = []

    for route in trip.routes:
        events.append(_build_route_event(route))
    for stay in trip.stays:
        events.append(_build_stay_event(stay))
    for activity in trip.activities:
        events.append(_build_activity_event(activity))

    return "\r\n".join(
        [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//LH Travel Agent//EN",
            f"X-WR-CALNAME:{_escape(trip.name)}",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            *events,
            "END:VCALENDAR",
        ]
    )
