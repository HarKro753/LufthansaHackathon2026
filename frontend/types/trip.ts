export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ExternalLink {
  title: string;
  url: string;
}

export interface TransitSegment {
  departure_stop: string;
  arrival_stop: string;
  departure_time: string;
  arrival_time: string;
  line_name: string;
  line_short: string | null;
  vehicle_type: string;
  headsign: string | null;
  stop_count: number | null;
  agency: string | null;
}

export interface TripRoute {
  id: string;
  origin: string;
  origin_address: string;
  origin_coordinates: Coordinates | null;
  destination: string;
  destination_address: string;
  destination_coordinates: Coordinates | null;
  departure_time: string;
  arrival_time: string;
  travel_mode: string;
  distance: string;
  duration: string;
  duration_minutes: number;
  google_maps_url: string | null;
  ticket_links: ExternalLink[] | null;
  polyline: string | null;
  selection_reason: string;
}

export interface TripStay {
  id: string;
  name: string;
  address: string;
  coordinates: Coordinates | null;
  place_id: string | null;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  price_per_night: number | null;
  total_price: number | null;
  rating: number | null;
  website: string | null;
  selection_reason: string;
}

export interface TripActivity {
  id: string;
  name: string;
  address: string;
  coordinates: Coordinates | null;
  place_id: string | null;
  type: "restaurant" | "attraction" | "activity";
  scheduled_date: string | null;
  scheduled_time: string | null;
  duration: number | null;
  rating: number | null;
  price_level: string | null;
  selection_reason: string;
}

export interface TripState {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  routes: TripRoute[];
  stays: TripStay[];
  activities: TripActivity[];
  start_date: string | null;
  end_date: string | null;
}
