"""Session state models — stored route/place results and session data."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from models.trip import Coordinates, TripState


class StoredRouteResult(BaseModel):
    """Full route data stored server-side (includes polyline the LLM doesn't see)."""

    route_index: int
    origin: dict  # {address, lat, lng}
    destination: dict  # {address, lat, lng}
    travel_mode: str
    distance: str
    distance_meters: int
    duration: str
    duration_seconds: int
    description: str | None = None
    departure_time: str
    arrival_time: str
    polyline: str | None = None
    url: str
    ticket_links: list[dict] | None = None


class StoredPlaceResult(BaseModel):
    """Full place data stored server-side for reference by add_to_trip."""

    place_index: int
    name: str
    address: str
    place_id: str
    coordinates: Coordinates | None = None
    rating: float | None = None
    price_level: str | None = None
    open_now: bool | None = None
    website: str | None = None


class ChatMessageRecord(BaseModel):
    """A single persisted chat message (user or assistant text only)."""

    role: Literal["user", "assistant"]
    content: str
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())


class SessionData(BaseModel):
    """Persisted session state including trip and cached tool results."""

    id: str
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    trip: TripState | None = None
    route_results: list[StoredRouteResult] | None = None
    place_results: list[StoredPlaceResult] | None = None
    chat_history: list[ChatMessageRecord] = Field(default_factory=list)
