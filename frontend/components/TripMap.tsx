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

const MARKER_COLORS: Record<string, string> = {
  route_origin: "#000000",
  route_destination: "#000000",
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

function DestinationCard({
  title,
  subtitle,
  price,
  imageUrl,
}: {
  title: string;
  type: string;
  subtitle: string;
  price?: number | null;
  imageUrl?: string;
}) {
  const defaultImage =
    "https://source.unsplash.com/600x800/?" + encodeURIComponent(title) + ",travel";
  return (
    <div className="relative w-full h-[420px] rounded-2xl overflow-hidden shadow-md flex-shrink-0 group">
      <img
        src={imageUrl || defaultImage}
        alt={title}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute bottom-4 left-4 right-4">
        <h3 className="text-2xl font-bold text-white tracking-tight drop-shadow-md">{title}</h3>
        <div className="flex items-center gap-3 mt-1 mb-4 text-xs font-medium text-white/90">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {subtitle}
          </span>
          {price && (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              From &euro;{Math.round(price)} per person
            </span>
          )}
        </div>
        <button className="w-full py-3 bg-white text-gray-900 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors shadow-lg flex items-center justify-center gap-2">
          <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
          Selected
        </button>
      </div>
    </div>
  );
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

    for (const stay of trip.stays) {
      if (!stay.coordinates) continue;
      const pos: L.LatLngTuple = [stay.coordinates.lat, stay.coordinates.lng];
      const priceStr = stay.total_price ? " | " + stay.total_price + " EUR" : "";
      Lf.marker(pos, { icon: makeDivIcon(Lf, MARKER_COLORS.stay, stay.name, stay.total_price) })
        .bindPopup("<b>" + stay.name + "</b><br/>" + stay.address + "<br/>" + stay.nights + " night" + (stay.nights !== 1 ? "s" : "") + priceStr)
        .addTo(group);
      bounds.push(pos);
    }

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

  const hasContent = trip && (trip.routes.length > 0 || trip.stays.length > 0 || trip.activities.length > 0);
  const totalItems = hasContent ? trip.routes.length + trip.stays.length + trip.activities.length : 0;

  return (
    <div className="relative h-full w-full flex bg-gray-100">
      {hasContent && (
        <div className="w-[360px] h-full bg-white z-[500] border-r border-gray-200 flex flex-col shadow-2xl">
          <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 truncate pr-4">{trip.name}</h2>
            <button className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors flex-shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {trip.routes.length > 0 && (
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Routes</div>
            )}
            {trip.routes.map((r, i) => (
              <DestinationCard
                key={"route-" + i}
                title={r.origin + " to " + r.destination}
                type="Route"
                subtitle={r.duration + " \u2022 " + r.travel_mode}
              />
            ))}
            {trip.stays.length > 0 && (
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-4">Stays</div>
            )}
            {trip.stays.map((s, i) => (
              <DestinationCard
                key={"stay-" + i}
                title={s.name}
                type="Stay"
                subtitle={s.nights + " Nights"}
                price={s.total_price}
              />
            ))}
            {trip.activities.length > 0 && (
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-4">Activities</div>
            )}
            {trip.activities.map((a, i) => (
              <DestinationCard key={"act-" + i} title={a.name} type="Activity" subtitle={a.type} />
            ))}
          </div>

          <div className="p-4 border-t border-gray-100 bg-white flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Chosen destinations ({totalItems})</span>
            <button className="px-5 py-2.5 bg-[#FF385C] text-white text-sm font-semibold rounded-xl hover:bg-[#cc1c40] transition-colors shadow-md">
              Generate Trip
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 relative">
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
    </div>
  );
}

