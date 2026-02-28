"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { TripState } from "@/types/trip";
import type L from "leaflet";

const DARK_TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

/**
 * Decode a Google Encoded Polyline string into an array of [lat, lng] tuples.
 * Algorithm: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

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

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

// Well-known airport coordinates for rendering flight lines on the map
const AIRPORT_COORDS: Record<string, [number, number]> = {
  FRA: [50.0379, 8.5622], MUC: [48.3538, 11.7861], BER: [52.3667, 13.5033],
  HAM: [53.6304, 9.9882], DUS: [51.2895, 6.7668], CGN: [50.8659, 7.1427],
  STR: [48.6899, 9.2220], CPH: [55.6181, 12.6561], AMS: [52.3086, 4.7639],
  CDG: [49.0097, 2.5479], ORY: [48.7233, 2.3794], LHR: [51.4700, -0.4543],
  LGW: [51.1537, -0.1821], STN: [51.8850, 0.2350], BCN: [41.2971, 2.0785],
  MAD: [40.4983, -3.5676], FCO: [41.8003, 12.2389], MXP: [45.6306, 8.7281],
  VIE: [48.1103, 16.5697], ZRH: [47.4647, 8.5492], BRU: [50.9010, 4.4844],
  LIS: [38.7756, -9.1354], ATH: [37.9364, 23.9445], IST: [41.2753, 28.7519],
  WAW: [52.1657, 20.9671], PRG: [50.1008, 14.2600], BUD: [47.4298, 19.2611],
  OSL: [60.1939, 11.1004], ARN: [59.6519, 17.9186], HEL: [60.3172, 24.9633],
  DUB: [53.4264, -6.2499], EDI: [55.9500, -3.3725], GVA: [46.2381, 6.1090],
  NCE: [43.6584, 7.2159], AGP: [36.6749, -4.4991], PMI: [39.5517, 2.7388],
  TXL: [52.5597, 13.2877], SXF: [52.3800, 13.5225], NUE: [49.4987, 11.0669],
  JFK: [40.6413, -73.7781], LAX: [33.9416, -118.4085], SFO: [37.6213, -122.3790],
  ORD: [41.9742, -87.9073], MIA: [25.7959, -80.2870], BKK: [13.6900, 100.7501],
  SIN: [1.3644, 103.9915], HND: [35.5494, 139.7798], NRT: [35.7647, 140.3864],
  DXB: [25.2532, 55.3657], DOH: [25.2731, 51.6081],
};

const MARKER_COLORS: Record<string, string> = {
  route_origin: "#58a6ff",
  route_destination: "#58a6ff",
  flight_origin: "#f472b6",
  flight_destination: "#f472b6",
  stay: "#f59e0b",
  restaurant: "#ef4444",
  attraction: "#a78bfa",
  activity: "#19C37D",
};

function makeDivIcon(leaflet: typeof L, color: string, label: string) {
  const truncated = label.length > 20 ? label.slice(0, 19) + "\u2026" : label;
  return leaflet.divIcon({
    html: `<div style="
      display:inline-flex;align-items:center;padding:4px 10px;
      background:${color};border-radius:16px;white-space:nowrap;
      font-family:Arial,sans-serif;font-size:12px;font-weight:600;
      color:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);
      transform:translate(-50%,-50%);
    ">${truncated}</div>`,
    className: "",
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

interface TripMapProps {
  trip: TripState | null;
}

export function TripMap({ trip }: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const leafletRef = useRef<typeof L | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Initialize Leaflet map once via dynamic import (SSR-safe)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    import("leaflet").then((leaflet) => {
      if (cancelled || !containerRef.current) return;

      leafletRef.current = leaflet.default ?? leaflet;
      const Lf = leafletRef.current;

      const map = Lf.map(containerRef.current, {
        center: [48.1351, 11.582],
        zoom: 5,
        zoomControl: true,
        attributionControl: true,
      });

      Lf.tileLayer(DARK_TILE_URL, {
        attribution: TILE_ATTRIBUTION,
        maxZoom: 19,
      }).addTo(map);

      layerGroupRef.current = Lf.layerGroup().addTo(map);
      mapRef.current = map;
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerGroupRef.current = null;
        leafletRef.current = null;
        setMapReady(false);
      }
    };
  }, []);

  // Update markers and polylines when trip changes
  useEffect(() => {
    const Lf = leafletRef.current;
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!Lf || !map || !group || !mapReady) return;

    group.clearLayers();

    if (!trip) return;

    const bounds: L.LatLngTuple[] = [];

    // --- Routes ---
    for (const route of trip.routes) {
      if (route.origin_coordinates) {
        const pos: L.LatLngTuple = [route.origin_coordinates.lat, route.origin_coordinates.lng];
        Lf.marker(pos, { icon: makeDivIcon(Lf, MARKER_COLORS.route_origin, route.origin) })
          .bindPopup(`<b>${route.origin}</b><br/>${route.origin_address}`)
          .addTo(group);
        bounds.push(pos);
      }

      if (route.destination_coordinates) {
        const pos: L.LatLngTuple = [route.destination_coordinates.lat, route.destination_coordinates.lng];
        Lf.marker(pos, { icon: makeDivIcon(Lf, MARKER_COLORS.route_destination, route.destination) })
          .bindPopup(`<b>${route.destination}</b><br/>${route.destination_address}`)
          .addTo(group);
        bounds.push(pos);
      }

      if (route.polyline) {
        const decoded = decodePolyline(route.polyline);
        if (decoded.length > 0) {
          Lf.polyline(decoded, {
            color: "#58a6ff",
            weight: 3,
            opacity: 0.8,
          }).addTo(group);
        }
      } else if (route.origin_coordinates && route.destination_coordinates) {
        const from: L.LatLngTuple = [route.origin_coordinates.lat, route.origin_coordinates.lng];
        const to: L.LatLngTuple = [route.destination_coordinates.lat, route.destination_coordinates.lng];
        Lf.polyline([from, to], {
          color: "#58a6ff",
          weight: 3,
          opacity: 0.7,
          dashArray: "8 6",
        }).addTo(group);
      }
    }

    // --- Flights ---
    for (const flight of trip.flights ?? []) {
      const originCoords = AIRPORT_COORDS[flight.origin];
      const destCoords = AIRPORT_COORDS[flight.destination];

      const priceStr = flight.price ? ` | ${flight.price} ${flight.currency}` : "";
      const stopsStr = flight.stops === 0 ? "Nonstop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`;

      if (originCoords) {
        const pos: L.LatLngTuple = originCoords;
        Lf.marker(pos, { icon: makeDivIcon(Lf, MARKER_COLORS.flight_origin, flight.origin) })
          .bindPopup(`<b>${flight.origin}</b><br/>${flight.airline} ${flight.flight_number ?? ""}<br/>${stopsStr}${priceStr}`)
          .addTo(group);
        bounds.push(pos);
      }

      if (destCoords) {
        const pos: L.LatLngTuple = destCoords;
        Lf.marker(pos, { icon: makeDivIcon(Lf, MARKER_COLORS.flight_destination, flight.destination) })
          .bindPopup(`<b>${flight.destination}</b><br/>${flight.airline} ${flight.flight_number ?? ""}<br/>${stopsStr}${priceStr}`)
          .addTo(group);
        bounds.push(pos);
      }

      // Draw dashed arc between airports
      if (originCoords && destCoords) {
        Lf.polyline([originCoords, destCoords], {
          color: "#f472b6",
          weight: 2.5,
          opacity: 0.7,
          dashArray: "10 8",
        }).addTo(group);
      }
    }

    // --- Stays ---
    for (const stay of trip.stays) {
      if (!stay.coordinates) continue;
      const pos: L.LatLngTuple = [stay.coordinates.lat, stay.coordinates.lng];
      const priceStr = stay.total_price ? ` | ${stay.total_price} ${stay.currency}` : "";
      Lf.marker(pos, { icon: makeDivIcon(Lf, MARKER_COLORS.stay, stay.name) })
        .bindPopup(`<b>${stay.name}</b><br/>${stay.address}<br/>${stay.nights} night${stay.nights !== 1 ? "s" : ""}${priceStr}`)
        .addTo(group);
      bounds.push(pos);
    }

    // --- Activities ---
    for (const activity of trip.activities) {
      if (!activity.coordinates) continue;
      const pos: L.LatLngTuple = [activity.coordinates.lat, activity.coordinates.lng];
      const color = MARKER_COLORS[activity.type] ?? MARKER_COLORS.activity;
      Lf.marker(pos, { icon: makeDivIcon(Lf, color, activity.name) })
        .bindPopup(`<b>${activity.name}</b><br/>${activity.address}${activity.rating ? "<br/>Rating: " + activity.rating : ""}`)
        .addTo(group);
      bounds.push(pos);
    }

    // Fit map to bounds
    if (bounds.length > 0) {
      map.fitBounds(Lf.latLngBounds(bounds), { padding: [50, 50], maxZoom: 15 });
    }
  }, [trip, mapReady]);

  const hasItems = trip && (
    trip.routes.length > 0 ||
    (trip.flights?.length ?? 0) > 0 ||
    trip.stays.length > 0 ||
    trip.activities.length > 0
  );

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {/* Trip summary overlay */}
      {trip && hasItems && (
        <div className="absolute top-3 left-3 z-[1000] bg-[#1e1e2e]/90 backdrop-blur-sm rounded-lg border border-white/10 px-3 py-2 max-w-[260px]">
          <p className="text-xs font-semibold text-white truncate">{trip.name}</p>
          <div className="flex flex-wrap gap-3 mt-1 text-[10px] text-white/50">
            {trip.routes.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: MARKER_COLORS.route_origin }} />
                {trip.routes.length} route{trip.routes.length !== 1 ? "s" : ""}
              </span>
            )}
            {(trip.flights?.length ?? 0) > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: MARKER_COLORS.flight_origin }} />
                {trip.flights.length} flight{trip.flights.length !== 1 ? "s" : ""}
              </span>
            )}
            {trip.stays.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: MARKER_COLORS.stay }} />
                {trip.stays.length} stay{trip.stays.length !== 1 ? "s" : ""}
              </span>
            )}
            {trip.activities.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: MARKER_COLORS.activity }} />
                {trip.activities.length}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Empty state overlay when no trip */}
      {!trip && mapReady && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
          <div className="bg-[#1e1e2e]/80 backdrop-blur-sm rounded-xl px-6 py-4 text-center border border-white/10">
            <svg className="w-10 h-10 mx-auto mb-2 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm text-white/40">Start planning your trip</p>
            <p className="text-xs text-white/20 mt-1">Locations will appear here</p>
          </div>
        </div>
      )}
    </div>
  );
}
