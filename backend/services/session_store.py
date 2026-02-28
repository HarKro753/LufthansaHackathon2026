"""Session store service — file-based JSON persistence for trip state.

Manages sessions, trips, and cached tool results (routes/places).
Each session is stored as a JSON file in .travelagent/sessions/.
"""

import json
import os
import uuid
from datetime import datetime
from pathlib import Path

from models.session import (
    ChatMessageRecord,
    SessionData,
    StoredFlightResult,
    StoredHostelResult,
    StoredPlaceResult,
    StoredRouteResult,
)
from models.trip import TripActivity, TripFlight, TripRoute, TripState, TripStay

SESSIONS_DIR = Path(os.getcwd()) / ".travelagent" / "sessions"


def _ensure_sessions_dir() -> None:
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)


def _session_path(session_id: str) -> Path:
    sanitized = "".join(c for c in session_id if c.isalnum() or c == "-")
    return SESSIONS_DIR / f"{sanitized}.json"


def _save_session(session: SessionData) -> None:
    _ensure_sessions_dir()
    session.updated_at = datetime.now().isoformat()
    path = _session_path(session.id)
    path.write_text(session.model_dump_json(indent=2))


def _recalculate_trip_dates(trip: TripState) -> None:
    """Automatically update trip start/end dates from all items."""
    all_dates: list[datetime] = []

    for route in trip.routes:
        all_dates.append(route.departure_time)
        all_dates.append(route.arrival_time)

    for flight in trip.flights:
        all_dates.append(flight.departure_time)
        all_dates.append(flight.arrival_time)

    for stay in trip.stays:
        all_dates.append(stay.check_in_date)
        all_dates.append(stay.check_out_date)

    for activity in trip.activities:
        if activity.scheduled_date:
            all_dates.append(activity.scheduled_date)

    if all_dates:
        trip.start_date = min(all_dates)
        trip.end_date = max(all_dates)


# ── Session CRUD ─────────────────────────────────────────────────────


def generate_session_id() -> str:
    return str(uuid.uuid4())


def create_session(session_id: str) -> SessionData:
    _ensure_sessions_dir()
    now = datetime.now().isoformat()
    session = SessionData(id=session_id, created_at=now, updated_at=now)
    _save_session(session)
    return session


def get_session(session_id: str) -> SessionData | None:
    path = _session_path(session_id)
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text())
        return SessionData.model_validate(data)
    except Exception:
        return None


def get_or_create_session(session_id: str) -> SessionData:
    """Get existing session or create a new one."""
    session = get_session(session_id)
    if session is None:
        session = create_session(session_id)
    return session


def delete_session(session_id: str) -> bool:
    path = _session_path(session_id)
    if not path.exists():
        return False
    path.unlink()
    return True


# ── Trip CRUD ────────────────────────────────────────────────────────


def set_trip(session_id: str, trip: TripState | None) -> None:
    session = get_or_create_session(session_id)
    session.trip = trip
    _save_session(session)


def get_trip(session_id: str) -> TripState | None:
    session = get_session(session_id)
    return session.trip if session else None


def has_trip(session_id: str) -> bool:
    return get_trip(session_id) is not None


def create_trip(
    session_id: str,
    name: str,
    start_date: datetime | None = None,
) -> TripState:
    trip = TripState(
        id=uuid.uuid4().hex,
        name=name,
        start_date=start_date,
    )
    set_trip(session_id, trip)
    return trip


def clear_trip(session_id: str) -> None:
    set_trip(session_id, None)


# ── Trip item CRUD ───────────────────────────────────────────────────


def add_route(session_id: str, route: TripRoute) -> TripRoute:
    trip = get_trip(session_id)
    if not trip:
        raise ValueError("No trip exists. Create a trip first.")
    trip.routes.append(route)
    trip.updated_at = datetime.now()
    _recalculate_trip_dates(trip)
    set_trip(session_id, trip)
    return route


def add_flight(session_id: str, flight: TripFlight) -> TripFlight:
    trip = get_trip(session_id)
    if not trip:
        raise ValueError("No trip exists. Create a trip first.")
    trip.flights.append(flight)
    trip.updated_at = datetime.now()
    _recalculate_trip_dates(trip)
    set_trip(session_id, trip)
    return flight


def add_stay(session_id: str, stay: TripStay) -> TripStay:
    trip = get_trip(session_id)
    if not trip:
        raise ValueError("No trip exists. Create a trip first.")
    trip.stays.append(stay)
    trip.updated_at = datetime.now()
    _recalculate_trip_dates(trip)
    set_trip(session_id, trip)
    return stay


def add_activity(session_id: str, activity: TripActivity) -> TripActivity:
    trip = get_trip(session_id)
    if not trip:
        raise ValueError("No trip exists. Create a trip first.")
    trip.activities.append(activity)
    trip.updated_at = datetime.now()
    _recalculate_trip_dates(trip)
    set_trip(session_id, trip)
    return activity


def update_item(session_id: str, item_id: str, updates: dict) -> bool:
    trip = get_trip(session_id)
    if not trip:
        return False

    all_collections: list[list] = [
        trip.routes,
        trip.flights,
        trip.stays,
        trip.activities,
    ]

    for collection in all_collections:
        for item in collection:
            if item.id == item_id:
                for key, value in updates.items():
                    if hasattr(item, key):
                        setattr(item, key, value)
                trip.updated_at = datetime.now()
                _recalculate_trip_dates(trip)
                set_trip(session_id, trip)
                return True

    return False


def remove_item(session_id: str, item_id: str) -> bool:
    trip = get_trip(session_id)
    if not trip:
        return False

    for collection in [trip.routes, trip.flights, trip.stays, trip.activities]:
        for i, item in enumerate(collection):
            if item.id == item_id:
                collection.pop(i)
                trip.updated_at = datetime.now()
                _recalculate_trip_dates(trip)
                set_trip(session_id, trip)
                return True

    return False


# ── Cached tool results ──────────────────────────────────────────────


def store_route_results(
    session_id: str,
    results: list[StoredRouteResult],
) -> None:
    session = get_or_create_session(session_id)
    session.route_results = results
    _save_session(session)


def get_route_result(
    session_id: str,
    route_index: int,
) -> StoredRouteResult | None:
    session = get_session(session_id)
    if not session or not session.route_results:
        return None
    for r in session.route_results:
        if r.route_index == route_index:
            return r
    return None


def store_place_results(
    session_id: str,
    results: list[StoredPlaceResult],
) -> None:
    session = get_or_create_session(session_id)
    session.place_results = results
    _save_session(session)


def get_place_result(
    session_id: str,
    place_index: int,
) -> StoredPlaceResult | None:
    session = get_session(session_id)
    if not session or not session.place_results:
        return None
    for p in session.place_results:
        if p.place_index == place_index:
            return p
    return None


def store_hostel_results(
    session_id: str,
    results: list[StoredHostelResult],
) -> None:
    session = get_or_create_session(session_id)
    session.hostel_results = results
    _save_session(session)


def get_hostel_result(
    session_id: str,
    hostel_index: int,
) -> StoredHostelResult | None:
    session = get_session(session_id)
    if not session or not session.hostel_results:
        return None
    for h in session.hostel_results:
        if h.hostel_index == hostel_index:
            return h
    return None


def store_flight_results(
    session_id: str,
    results: list[StoredFlightResult],
) -> None:
    session = get_or_create_session(session_id)
    session.flight_results = results
    _save_session(session)


def get_flight_result(
    session_id: str,
    flight_index: int,
) -> StoredFlightResult | None:
    session = get_session(session_id)
    if not session or not session.flight_results:
        return None
    for f in session.flight_results:
        if f.flight_index == flight_index:
            return f
    return None


# ── Chat history persistence ──────────────────────────────────────────


def append_chat_message(
    session_id: str,
    role: str,
    content: str,
    timeline_item_ids: list[str] | None = None,
) -> None:
    """Append a user or assistant message to the persisted chat history.

    For assistant messages, timeline_item_ids lists the trip item IDs that
    were added during this response so the frontend can reconstruct timeline
    cards when restoring history.
    """
    session = get_or_create_session(session_id)
    session.chat_history.append(
        ChatMessageRecord(
            role=role,  # type: ignore[arg-type]
            content=content,
            timeline_item_ids=timeline_item_ids or [],
        )
    )
    _save_session(session)


def get_chat_history(session_id: str) -> list[ChatMessageRecord]:
    """Return the full persisted chat history for a session."""
    session = get_session(session_id)
    if not session:
        return []
    return session.chat_history


def clear_chat_history(session_id: str) -> None:
    """Clear the chat history for a session."""
    session = get_session(session_id)
    if session:
        session.chat_history = []
        _save_session(session)
