"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { TripState } from "@/types/trip";
import type L from "leaflet";

const LIGHT_TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, byte: number;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
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
  route_origin: "#000000",
  route_destination: "#000000",
  flight_origin: "#FF385C",
  flight_destination: "#FF385C",
  stay: "#FF385C",
  restaurant: "#ef4444",
  attraction: "#eab308",
  activity: "#10b981",
};

function makeDivIcon(leaflet: typeof L, color: string, label: string, price?: number | null) {
  const displayLabel = price ? "\u20ac" + Math.round(price) + " / " + label : label;
  const truncated = displayLabel.length > 20 ? displayLabel.slice(0, 19) + "\u2026" : displayLabel;
  return leaflet.divIcon({
    html:
      '<div style="display:inline-flex;align-items:center;padding:6px 12px;background:#ffffff;border-radius:20px;white-space:nowrap;font-family:ui-sans-serif,system-ui,sans-serif;font-size:13px;font-weight:700;color:#111111;box-shadow:0 4px 12px rgba(0,0,0,0.15);border:2px solid #ffffff;transform:translate(-50%,-50%);gap:6px;">' +
      '<span style="width:8px;height:8px;border-radius:50%;background-color:' + color + '"></span>' +
      truncated + "</div>",
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
        zoomControl: false,
        attributionControl: false,
      });
      Lf.control.zoom({ position: "topright" }).addTo(map);
      Lf.tileLayer(LIGHT_TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
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
          .bindPopup("<b>" + route.origin + "</b><br/>" + route.origin_address)
          .addTo(group);
        bounds.push(pos);
      }
      if (route.destination_coordinates) {
        const pos: L.LatLngTuple = [route.destination_coordinates.lat, route.destination_coordinates.lng];
        Lf.marker(pos, { icon: makeDivIcon(Lf, MARKER_COLORS.route_destination, route.destination) })
          .bindPopup("<b>" + route.destination + "</b><br/>" + route.destination_address)
          .addTo(group);
        bounds.push(pos);
      }
      if (route.polyline) {
        const decoded = decodePolyline(route.polyline);
        if (decoded.length > 0) {
          Lf.polyline(decoded, { color: "#000000", weight: 3, opacity: 0.8, dashArray: "10 5" }).addTo(group);
        }
      } else if (route.origin_coordinates && route.destination_coordinates) {
        Lf.polyline(
          [
            [route.origin_coordinates.lat, route.origin_coordinates.lng],
            [route.destination_coordinates.lat, route.destination_coordinates.lng],
          ],
          { color: "#000000", weight: 3, opacity: 0.7, dashArray: "8 6" }
        ).addTo(group);
      }
    }

    // --- Flights ---
    for (const flight of trip.flights ?? []) {
      const originCoords = AIRPORT_COORDS[flight.origin];
      const destCoords = AIRPORT_COORDS[flight.destination];

      const priceStr = flight.price ? " | " + flight.price + " " + flight.currency : "";
      const stopsStr = flight.stops === 0 ? "Nonstop" : flight.stops + " stop" + (flight.stops > 1 ? "s" : "");

      if (originCoords) {
        const pos: L.LatLngTuple = originCoords;
        Lf.marker(pos, { icon: makeDivIcon(Lf, MARKER_COLORS.flight_origin, flight.origin) })
          .bindPopup("<b>" + flight.origin + "</b><br/>" + flight.airline + " " + (flight.flight_number ?? "") + "<br/>" + stopsStr + priceStr)
          .addTo(group);
        bounds.push(pos);
      }

      if (destCoords) {
        const pos: L.LatLngTuple = destCoords;
        Lf.marker(pos, { icon: makeDivIcon(Lf, MARKER_COLORS.flight_destination, flight.destination) })
          .bindPopup("<b>" + flight.destination + "</b><br/>" + flight.airline + " " + (flight.flight_number ?? "") + "<br/>" + stopsStr + priceStr)
          .addTo(group);
        bounds.push(pos);
      }

      // Draw dashed arc between airports
      if (originCoords && destCoords) {
        Lf.polyline([originCoords, destCoords], {
          color: "#FF385C",
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
      const priceStr = stay.total_price ? " | " + stay.total_price + " EUR" : "";
      Lf.marker(pos, { icon: makeDivIcon(Lf, MARKER_COLORS.stay, stay.name, stay.total_price) })
        .bindPopup("<b>" + stay.name + "</b><br/>" + stay.address + "<br/>" + stay.nights + " night" + (stay.nights !== 1 ? "s" : "") + priceStr)
        .addTo(group);
      bounds.push(pos);
    }

    // --- Activities ---
    for (const activity of trip.activities) {
      if (!activity.coordinates) continue;
      const pos: L.LatLngTuple = [activity.coordinates.lat, activity.coordinates.lng];
      const color = MARKER_COLORS[activity.type] ?? MARKER_COLORS.activity;
      Lf.marker(pos, { icon: makeDivIcon(Lf, color, activity.name) })
        .bindPopup("<b>" + activity.name + "</b><br/>" + activity.address + (activity.rating ? "<br/>Rating: " + activity.rating : ""))
        .addTo(group);
      bounds.push(pos);
    }

    if (bounds.length > 0) {
      map.fitBounds(Lf.latLngBounds(bounds), { padding: [50, 50], maxZoom: 15 });
    }
  }, [trip, mapReady]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full bg-gray-100" />
      {!trip && mapReady && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[400]">
          <div className="bg-white/80 backdrop-blur-md rounded-2xl px-8 py-6 text-center shadow-lg border border-gray-100 max-w-sm">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-lg font-bold text-gray-900">Discover the world</p>
            <p className="text-sm text-gray-500 mt-2">
              Chat with the AI to start planning your adventure. Destinations will appear here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
