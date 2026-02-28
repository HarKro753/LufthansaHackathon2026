"use client";

import type { TripRoute } from "@/types/trip";

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getTravelModeIcon(mode: string) {
  const normalized = mode.toLowerCase();

  if (normalized.includes("transit") || normalized.includes("rail") || normalized.includes("train")) {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 18l4 4 4-4M12 2v16M4 6h16M6 10h12M8 14h8" />
      </svg>
    );
  }

  if (normalized.includes("drive") || normalized.includes("car") || normalized.includes("driving")) {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10M19.4 16H5M17.6 6H21a1 1 0 011 1v6a1 1 0 01-1 1h-1.4" />
      </svg>
    );
  }

  if (normalized.includes("walk") || normalized.includes("pedestrian")) {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    );
  }

  if (normalized.includes("bicycle") || normalized.includes("bike") || normalized.includes("cycling")) {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="6" cy="17" r="3" />
        <circle cx="18" cy="17" r="3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 17L9 5h6l3 12M9 9h4" />
      </svg>
    );
  }

  // Default: route/directions icon
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  );
}

function getTravelModeLabel(mode: string): string {
  const normalized = mode.toLowerCase();
  if (normalized.includes("transit") || normalized.includes("rail") || normalized.includes("train")) return "Train";
  if (normalized.includes("drive") || normalized.includes("car") || normalized.includes("driving")) return "Drive";
  if (normalized.includes("walk") || normalized.includes("pedestrian")) return "Walk";
  if (normalized.includes("bicycle") || normalized.includes("bike") || normalized.includes("cycling")) return "Cycle";
  if (normalized.includes("bus")) return "Bus";
  if (normalized.includes("ferry")) return "Ferry";
  return "Transfer";
}

function getTravelModeColor(mode: string): { bg: string; border: string; text: string; accent: string } {
  const normalized = mode.toLowerCase();
  if (normalized.includes("transit") || normalized.includes("rail") || normalized.includes("train")) {
    return { bg: "bg-blue-50", border: "border-blue-100", text: "text-blue-700", accent: "text-blue-600" };
  }
  if (normalized.includes("drive") || normalized.includes("car") || normalized.includes("driving")) {
    return { bg: "bg-emerald-50", border: "border-emerald-100", text: "text-emerald-700", accent: "text-emerald-600" };
  }
  if (normalized.includes("bus")) {
    return { bg: "bg-orange-50", border: "border-orange-100", text: "text-orange-700", accent: "text-orange-600" };
  }
  return { bg: "bg-gray-50", border: "border-gray-100", text: "text-gray-700", accent: "text-gray-600" };
}

function shortLocation(full: string): string {
  if (!full) return "";
  // Take first meaningful part (city name, not full address)
  const parts = full.split(",");
  return parts[0].trim();
}

export function RouteCard({ route }: { route: TripRoute }) {
  const depTime = formatTime(route.departure_time);
  const arrTime = formatTime(route.arrival_time);
  const depDate = formatDate(route.departure_time);
  const modeLabel = getTravelModeLabel(route.travel_mode);
  const modeIcon = getTravelModeIcon(route.travel_mode);
  const colors = getTravelModeColor(route.travel_mode);

  const originShort = shortLocation(route.origin);
  const destShort = shortLocation(route.destination);

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      {/* Header with mode badge */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg ${colors.bg} flex items-center justify-center ${colors.accent}`}>
          {modeIcon}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">
            {modeLabel}
          </span>
          <span className="text-[11px] text-gray-400">
            {depDate}
          </span>
        </div>
        {route.distance && (
          <span className="text-[11px] text-gray-400 ml-auto">
            {route.distance}
          </span>
        )}
      </div>

      {/* Route visualization */}
      <div className="px-4 pb-3">
        <div className="flex items-stretch gap-3">
          {/* Timeline dots */}
          <div className="flex flex-col items-center py-0.5">
            <div className={`w-2.5 h-2.5 rounded-full border-2 ${colors.border} bg-white`} />
            <div className={`flex-1 w-[2px] ${colors.bg} my-1`} />
            <div className={`w-2.5 h-2.5 rounded-full ${colors.bg} border-2 ${colors.border}`} />
          </div>

          {/* Stops */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900 truncate">{originShort}</span>
              <span className="text-xs text-gray-500 shrink-0 ml-2">{depTime}</span>
            </div>

            <div className="my-2 flex items-center gap-2">
              <span className={`text-[11px] font-medium ${colors.text} ${colors.bg} px-2 py-0.5 rounded-full`}>
                {route.duration}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900 truncate">{destShort}</span>
              <span className="text-xs text-gray-500 shrink-0 ml-2">{arrTime}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer: Google Maps link */}
      {route.google_maps_url && (
        <div className="px-4 py-2.5 border-t border-gray-50 flex items-center justify-end bg-gray-50/50">
          <a
            href={route.google_maps_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            View on Google Maps
          </a>
        </div>
      )}
    </div>
  );
}
