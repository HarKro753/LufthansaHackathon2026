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

const MARKER_COLORS: Record<string, string> = {
  route_origin: "#58a6ff",
  route_destination: "#58a6ff",
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

    // --- Stays ---
    for (const stay of trip.stays) {
      if (!stay.coordinates) continue;
      const pos: L.LatLngTuple = [stay.coordinates.lat, stay.coordinates.lng];
      const priceStr = stay.total_price ? ` | ${stay.total_price} EUR` : "";
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

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {/* Trip summary overlay */}
      {trip && (trip.routes.length > 0 || trip.stays.length > 0 || trip.activities.length > 0) && (
        <div className="absolute top-3 left-3 z-[1000] bg-[#1e1e2e]/90 backdrop-blur-sm rounded-lg border border-white/10 px-3 py-2 max-w-[220px]">
          <p className="text-xs font-semibold text-white truncate">{trip.name}</p>
          <div className="flex gap-3 mt-1 text-[10px] text-white/50">
            {trip.routes.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: MARKER_COLORS.route_origin }} />
                {trip.routes.length} route{trip.routes.length !== 1 ? "s" : ""}
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
