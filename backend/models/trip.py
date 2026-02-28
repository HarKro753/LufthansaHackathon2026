"""Trip state models — Pydantic v2 models for trip planning persistence."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class Coordinates(BaseModel):
    lat: float
    lng: float


class ExternalLink(BaseModel):
    title: str
    url: str


class TransitSegment(BaseModel):
    departure_stop: str
    arrival_stop: str
    departure_time: str
    arrival_time: str
    line_name: str
    line_short: str | None = None
    vehicle_type: str
    headsign: str | None = None
    stop_count: int | None = None
    agency: str | None = None


class TripRoute(BaseModel):
    id: str = Field(default_factory=lambda: __import__("uuid").uuid4().hex)
    origin: str
    origin_address: str
    origin_coordinates: Coordinates | None = None
    destination: str
    destination_address: str
    destination_coordinates: Coordinates | None = None
    departure_time: datetime
    arrival_time: datetime
    travel_mode: str
    distance: str
    duration: str
    duration_minutes: int = 0
    google_maps_url: str | None = None
    ticket_links: list[ExternalLink] | None = None
    polyline: str | None = None
    selection_reason: str = ""


class TripStay(BaseModel):
    id: str = Field(default_factory=lambda: __import__("uuid").uuid4().hex)
    name: str
    address: str
    coordinates: Coordinates | None = None
    place_id: str | None = None
    entity_id: str | None = None
    check_in_date: datetime
    check_out_date: datetime
    nights: int
    price_per_night: float | None = None
    total_price: float | None = None
    currency: str = "EUR"
    booking_source: str | None = None
    booking_link: str | None = None
    rating: float | None = None
    reviews: int | None = None
    stars: int | None = None
    amenities: list[str] | None = None
    website: str | None = None
    selection_reason: str = ""


class TripActivity(BaseModel):
    id: str = Field(default_factory=lambda: __import__("uuid").uuid4().hex)
    name: str
    address: str
    coordinates: Coordinates | None = None
    place_id: str | None = None
    type: Literal["restaurant", "attraction", "activity"] = "activity"
    scheduled_date: datetime | None = None
    scheduled_time: str | None = None
    duration: int | None = None
    rating: float | None = None
    price_level: str | None = None
    selection_reason: str = ""


class TripState(BaseModel):
    id: str = Field(default_factory=lambda: __import__("uuid").uuid4().hex)
    name: str
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    routes: list[TripRoute] = Field(default_factory=list)
    stays: list[TripStay] = Field(default_factory=list)
    activities: list[TripActivity] = Field(default_factory=list)
    start_date: datetime | None = None
    end_date: datetime | None = None


class GeocodedLocation(BaseModel):
    lat: float
    lng: float
    formatted_address: str
    place_id: str
