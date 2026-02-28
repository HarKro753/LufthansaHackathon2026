"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  AdvancedMarkerAnchorPoint,
  InfoWindow,
  useAdvancedMarkerRef,
  useMap,
} from "@vis.gl/react-google-maps";
import type {
  TripState,
  TripRoute,
  TripFlight,
  TripStay,
  TripActivity,
} from "@/types/trip";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const MAP_ID = "trip-map";

const DEFAULT_CENTER = { lat: 48.1351, lng: 11.582 };
const DEFAULT_ZOOM = 5;

// Well-known airport coordinates for rendering flight lines on the map
const AIRPORT_COORDS: Record<string, { lat: number; lng: number }> = {
  FRA: { lat: 50.0379, lng: 8.5622 },
  MUC: { lat: 48.3538, lng: 11.7861 },
  BER: { lat: 52.3667, lng: 13.5033 },
  HAM: { lat: 53.6304, lng: 9.9882 },
  DUS: { lat: 51.2895, lng: 6.7668 },
  CGN: { lat: 50.8659, lng: 7.1427 },
  STR: { lat: 48.6899, lng: 9.222 },
  CPH: { lat: 55.6181, lng: 12.6561 },
  AMS: { lat: 52.3086, lng: 4.7639 },
  CDG: { lat: 49.0097, lng: 2.5479 },
  ORY: { lat: 48.7233, lng: 2.3794 },
  LHR: { lat: 51.47, lng: -0.4543 },
  LGW: { lat: 51.1537, lng: -0.1821 },
  STN: { lat: 51.885, lng: 0.235 },
  BCN: { lat: 41.2971, lng: 2.0785 },
  MAD: { lat: 40.4983, lng: -3.5676 },
  FCO: { lat: 41.8003, lng: 12.2389 },
  MXP: { lat: 45.6306, lng: 8.7281 },
  VIE: { lat: 48.1103, lng: 16.5697 },
  ZRH: { lat: 47.4647, lng: 8.5492 },
  BRU: { lat: 50.901, lng: 4.4844 },
  LIS: { lat: 38.7756, lng: -9.1354 },
  ATH: { lat: 37.9364, lng: 23.9445 },
  IST: { lat: 41.2753, lng: 28.7519 },
  WAW: { lat: 52.1657, lng: 20.9671 },
  PRG: { lat: 50.1008, lng: 14.26 },
  BUD: { lat: 47.4298, lng: 19.2611 },
  OSL: { lat: 60.1939, lng: 11.1004 },
  ARN: { lat: 59.6519, lng: 17.9186 },
  HEL: { lat: 60.3172, lng: 24.9633 },
  DUB: { lat: 53.4264, lng: -6.2499 },
  EDI: { lat: 55.95, lng: -3.3725 },
  GVA: { lat: 46.2381, lng: 6.109 },
  NCE: { lat: 43.6584, lng: 7.2159 },
  AGP: { lat: 36.6749, lng: -4.4991 },
  PMI: { lat: 39.5517, lng: 2.7388 },
  TXL: { lat: 52.5597, lng: 13.2877 },
  SXF: { lat: 52.38, lng: 13.5225 },
  NUE: { lat: 49.4987, lng: 11.0669 },
  JFK: { lat: 40.6413, lng: -73.7781 },
  LAX: { lat: 33.9416, lng: -118.4085 },
  SFO: { lat: 37.6213, lng: -122.379 },
  ORD: { lat: 41.9742, lng: -87.9073 },
  MIA: { lat: 25.7959, lng: -80.287 },
  BKK: { lat: 13.69, lng: 100.7501 },
  SIN: { lat: 1.3644, lng: 103.9915 },
  HND: { lat: 35.5494, lng: 139.7798 },
  NRT: { lat: 35.7647, lng: 140.3864 },
  DXB: { lat: 25.2532, lng: 55.3657 },
  DOH: { lat: 25.2731, lng: 51.6081 },
};

const MARKER_COLORS: Record<string, string> = {
  route_origin: "#000000",
  route_destination: "#000000",
  flight_origin: "#FF385C",
  flight_destination: "#FF385C",
  stay: "#FF385C",
  restaurant: "#ef4444",
  attraction: "#eab308",
  activity: "#10b981",
};

function decodePolyline(encoded: string): google.maps.LatLngLiteral[] {
  const points: google.maps.LatLngLiteral[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let shift = 0,
      result = 0,
      byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

// ─── Marker pill (styled HTML overlay) ───

interface MarkerPillProps {
  color: string;
  label: string;
  price?: number | null;
}

function MarkerPill({ color, label, price }: MarkerPillProps) {
  const displayLabel = price ? `\u20ac${Math.round(price)} / ${label}` : label;
  const truncated =
    displayLabel.length > 20
      ? displayLabel.slice(0, 19) + "\u2026"
      : displayLabel;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 12px",
        background: "#ffffff",
        borderRadius: 20,
        whiteSpace: "nowrap",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: 13,
        fontWeight: 700,
        color: "#111111",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        border: "2px solid #ffffff",
        gap: 6,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
      {truncated}
    </div>
  );
}

// ─── Individual marker with InfoWindow ───

interface TripMarkerProps {
  position: google.maps.LatLngLiteral;
  color: string;
  label: string;
  price?: number | null;
  popupContent: string;
  activeMarkerId: string | null;
  markerId: string;
  onMarkerClick: (id: string) => void;
  onInfoClose: () => void;
}

function TripMarker({
  position,
  color,
  label,
  price,
  popupContent,
  activeMarkerId,
  markerId,
  onMarkerClick,
  onInfoClose,
}: TripMarkerProps) {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={position}
        anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
        onClick={() => onMarkerClick(markerId)}
      >
        <MarkerPill color={color} label={label} price={price} />
      </AdvancedMarker>

      {activeMarkerId === markerId && marker && (
        <InfoWindow anchor={marker} onCloseClick={onInfoClose} maxWidth={280}>
          <div dangerouslySetInnerHTML={{ __html: popupContent }} />
        </InfoWindow>
      )}
    </>
  );
}

// ─── Polyline drawing component (uses imperative google.maps API) ───

interface PolylineData {
  id: string;
  path: google.maps.LatLngLiteral[];
  color: string;
  weight: number;
  opacity: number;
  dashPattern?: number[];
}

function Polylines({ lines }: { lines: PolylineData[] }) {
  const map = useMap();
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!map) return;

    // Clear previous polylines
    for (const p of polylinesRef.current) {
      p.setMap(null);
    }
    polylinesRef.current = [];

    for (const line of lines) {
      const polyline = new google.maps.Polyline({
        path: line.path,
        strokeColor: line.color,
        strokeWeight: line.weight,
        strokeOpacity: line.opacity,
        geodesic: true,
        icons: line.dashPattern
          ? [
              {
                icon: {
                  path: "M 0,-1 0,1",
                  strokeOpacity: 1,
                  scale: line.weight,
                },
                offset: "0",
                repeat: `${line.dashPattern[0] + line.dashPattern[1]}px`,
              },
            ]
          : undefined,
        map,
      });
      polylinesRef.current.push(polyline);
    }

    return () => {
      for (const p of polylinesRef.current) {
        p.setMap(null);
      }
      polylinesRef.current = [];
    };
  }, [map, lines]);

  return null;
}

// ─── Fit bounds controller ───

function FitBounds({ bounds }: { bounds: google.maps.LatLngLiteral[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || bounds.length === 0) return;

    const gmBounds = new google.maps.LatLngBounds();
    for (const point of bounds) {
      gmBounds.extend(point);
    }
    map.fitBounds(gmBounds, { top: 50, right: 50, bottom: 50, left: 50 });
  }, [map, bounds]);

  return null;
}

// ─── Build markers + polylines from trip data ───

interface MarkerData {
  id: string;
  position: google.maps.LatLngLiteral;
  color: string;
  label: string;
  price?: number | null;
  popupContent: string;
}

function buildMarkers(trip: TripState): MarkerData[] {
  const markers: MarkerData[] = [];

  // Routes
  for (const route of trip.routes) {
    if (route.origin_coordinates) {
      markers.push({
        id: `route-origin-${route.id}`,
        position: {
          lat: route.origin_coordinates.lat,
          lng: route.origin_coordinates.lng,
        },
        color: MARKER_COLORS.route_origin,
        label: route.origin,
        popupContent: `<b>${route.origin}</b><br/>${route.origin_address}`,
      });
    }
    if (route.destination_coordinates) {
      markers.push({
        id: `route-dest-${route.id}`,
        position: {
          lat: route.destination_coordinates.lat,
          lng: route.destination_coordinates.lng,
        },
        color: MARKER_COLORS.route_destination,
        label: route.destination,
        popupContent: `<b>${route.destination}</b><br/>${route.destination_address}`,
      });
    }
  }

  // Flights
  for (const flight of trip.flights ?? []) {
    const originCoords = AIRPORT_COORDS[flight.origin];
    const destCoords = AIRPORT_COORDS[flight.destination];
    const priceStr = flight.price
      ? ` | ${flight.price} ${flight.currency}`
      : "";
    const stopsStr =
      flight.stops === 0
        ? "Nonstop"
        : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`;

    if (originCoords) {
      markers.push({
        id: `flight-origin-${flight.id}`,
        position: originCoords,
        color: MARKER_COLORS.flight_origin,
        label: flight.origin,
        popupContent: `<b>${flight.origin}</b><br/>${flight.airline} ${flight.flight_number ?? ""}<br/>${stopsStr}${priceStr}`,
      });
    }
    if (destCoords) {
      markers.push({
        id: `flight-dest-${flight.id}`,
        position: destCoords,
        color: MARKER_COLORS.flight_destination,
        label: flight.destination,
        popupContent: `<b>${flight.destination}</b><br/>${flight.airline} ${flight.flight_number ?? ""}<br/>${stopsStr}${priceStr}`,
      });
    }
  }

  // Stays
  for (const stay of trip.stays) {
    if (!stay.coordinates) continue;
    const priceStr = stay.total_price ? ` | ${stay.total_price} EUR` : "";
    const starsStr = stay.stars ? "★".repeat(stay.stars) : "";
    const ratingStr = stay.rating ? `Rating: ${stay.rating}` : "";
    const metaLine = [starsStr, ratingStr].filter(Boolean).join(" · ");

    const imageHtml = stay.image_url
      ? `<img src="${stay.image_url}" alt="${stay.name}" style="width:100%;max-width:240px;height:140px;object-fit:cover;border-radius:8px;margin-bottom:8px;" />`
      : "";

    const mapsLinkHtml = stay.google_maps_url
      ? `<a href="${stay.google_maps_url}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;color:#1a73e8;font-size:12px;font-weight:600;text-decoration:none;">📍 Open in Google Maps</a>`
      : "";

    const bookingLinkHtml = stay.booking_link
      ? `<a href="${stay.booking_link}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:4px;margin-top:4px;color:#FF385C;font-size:12px;font-weight:600;text-decoration:none;">🔗 Book now${stay.booking_source ? ` on ${stay.booking_source}` : ""}</a>`
      : "";

    markers.push({
      id: `stay-${stay.id}`,
      position: { lat: stay.coordinates.lat, lng: stay.coordinates.lng },
      color: MARKER_COLORS.stay,
      label: stay.name,
      price: stay.total_price,
      popupContent: `<div style="max-width:240px;font-family:ui-sans-serif,system-ui,sans-serif;">${imageHtml}<div style="font-size:14px;font-weight:700;margin-bottom:2px;">${stay.name}</div><div style="font-size:12px;color:#666;margin-bottom:2px;">${stay.address}</div>${metaLine ? `<div style="font-size:12px;color:#444;margin-bottom:2px;">${metaLine}</div>` : ""}<div style="font-size:12px;color:#333;">${stay.nights} night${stay.nights !== 1 ? "s" : ""}${priceStr}</div><div style="display:flex;flex-direction:column;gap:2px;">${mapsLinkHtml}${bookingLinkHtml}</div></div>`,
    });
  }

  // Activities
  for (const activity of trip.activities) {
    if (!activity.coordinates) continue;
    const color = MARKER_COLORS[activity.type] ?? MARKER_COLORS.activity;
    markers.push({
      id: `activity-${activity.id}`,
      position: {
        lat: activity.coordinates.lat,
        lng: activity.coordinates.lng,
      },
      color,
      label: activity.name,
      popupContent: `<b>${activity.name}</b><br/>${activity.address}${activity.rating ? `<br/>Rating: ${activity.rating}` : ""}`,
    });
  }

  return markers;
}

function buildPolylines(trip: TripState): PolylineData[] {
  const lines: PolylineData[] = [];

  // Routes
  for (const route of trip.routes) {
    if (route.polyline) {
      const decoded = decodePolyline(route.polyline);
      if (decoded.length > 0) {
        lines.push({
          id: `route-poly-${route.id}`,
          path: decoded,
          color: "#000000",
          weight: 3,
          opacity: 0.8,
          dashPattern: [10, 5],
        });
      }
    } else if (route.origin_coordinates && route.destination_coordinates) {
      lines.push({
        id: `route-line-${route.id}`,
        path: [
          {
            lat: route.origin_coordinates.lat,
            lng: route.origin_coordinates.lng,
          },
          {
            lat: route.destination_coordinates.lat,
            lng: route.destination_coordinates.lng,
          },
        ],
        color: "#000000",
        weight: 3,
        opacity: 0.7,
        dashPattern: [8, 6],
      });
    }
  }

  // Flights
  for (const flight of trip.flights ?? []) {
    const originCoords = AIRPORT_COORDS[flight.origin];
    const destCoords = AIRPORT_COORDS[flight.destination];
    if (originCoords && destCoords) {
      lines.push({
        id: `flight-line-${flight.id}`,
        path: [originCoords, destCoords],
        color: "#FF385C",
        weight: 2.5,
        opacity: 0.7,
        dashPattern: [10, 8],
      });
    }
  }

  return lines;
}

// ─── Main component ───

interface TripMapProps {
  trip: TripState | null;
}

export function TripMap({ trip }: TripMapProps) {
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);

  const handleMarkerClick = useCallback((id: string) => {
    setActiveMarkerId((prev) => (prev === id ? null : id));
  }, []);

  const handleInfoClose = useCallback(() => {
    setActiveMarkerId(null);
  }, []);

  const markers = useMemo(() => (trip ? buildMarkers(trip) : []), [trip]);
  const polylines = useMemo(() => (trip ? buildPolylines(trip) : []), [trip]);
  const bounds = useMemo(() => markers.map((m) => m.position), [markers]);

  return (
    <div className="relative h-full w-full">
      <APIProvider apiKey={API_KEY}>
        <Map
          mapId={MAP_ID}
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={DEFAULT_ZOOM}
          gestureHandling="greedy"
          disableDefaultUI={false}
          zoomControl={true}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          style={{ width: "100%", height: "100%" }}
        >
          {markers.map((m) => (
            <TripMarker
              key={m.id}
              markerId={m.id}
              position={m.position}
              color={m.color}
              label={m.label}
              price={m.price}
              popupContent={m.popupContent}
              activeMarkerId={activeMarkerId}
              onMarkerClick={handleMarkerClick}
              onInfoClose={handleInfoClose}
            />
          ))}

          <Polylines lines={polylines} />

          {bounds.length > 0 && <FitBounds bounds={bounds} />}
        </Map>
      </APIProvider>
    </div>
  );
}
