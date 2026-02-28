"use client";

import type { TripFlight } from "@/types/trip";

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatPrice(price: number | null, currency: string): string {
  if (price === null) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function stopsLabel(stops: number): string {
  if (stops === 0) return "Nonstop";
  if (stops === 1) return "1 stop";
  return `${stops} stops`;
}

export function FlightCard({ flight }: { flight: TripFlight }) {
  const depTime = formatTime(flight.departure_time);
  const arrTime = formatTime(flight.arrival_time);
  const depDate = formatDate(flight.departure_time);
  const arrDate = formatDate(flight.arrival_time);
  const sameDay = depDate === arrDate;

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      {/* Airline header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center">
            <svg
              className="w-3.5 h-3.5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </div>
          <span className="text-sm font-semibold text-gray-900">
            {flight.airline}
          </span>
          {flight.flight_number && (
            <span className="text-xs text-gray-400 font-mono">
              {flight.flight_number}
            </span>
          )}
        </div>
        {flight.cabin_class && flight.cabin_class !== "economy" && (
          <span className="text-[11px] font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full capitalize">
            {flight.cabin_class.replace("_", " ")}
          </span>
        )}
      </div>

      {/* Route visualization */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between">
          {/* Departure */}
          <div className="text-center min-w-[60px]">
            <div className="text-2xl font-bold text-gray-900 tracking-tight">
              {flight.origin}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{depTime}</div>
            <div className="text-[11px] text-gray-400">{depDate}</div>
          </div>

          {/* Flight path */}
          <div className="flex-1 mx-4">
            <div className="text-center text-[11px] text-gray-500 font-medium mb-1">
              {flight.duration ?? ""}
            </div>
            <div className="relative flex items-center">
              <div className="flex-1 h-[2px] bg-gray-200 rounded-full" />
              <svg
                className="w-4 h-4 text-gray-900 mx-1 -rotate-90"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
              </svg>
              <div className="flex-1 h-[2px] bg-gray-200 rounded-full" />
            </div>
            <div className="text-center text-[11px] text-gray-400 mt-1">
              {stopsLabel(flight.stops)}
              {flight.stop_airports && flight.stop_airports.length > 0 && (
                <span className="text-gray-400">
                  {" "}
                  via {flight.stop_airports.join(", ")}
                </span>
              )}
            </div>
          </div>

          {/* Arrival */}
          <div className="text-center min-w-[60px]">
            <div className="text-2xl font-bold text-gray-900 tracking-tight">
              {flight.destination}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{arrTime}</div>
            {!sameDay && (
              <div className="text-[11px] text-gray-400">{arrDate}</div>
            )}
          </div>
        </div>
      </div>

      {/* Footer: price + booking */}
      {(flight.price !== null || flight.booking_link) && (
        <div className="px-4 py-2.5 border-t border-gray-50 flex items-center justify-between bg-gray-50/50">
          {flight.price !== null ? (
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-gray-900">
                {formatPrice(flight.price, flight.currency)}
              </span>
              <span className="text-xs text-gray-400">/person</span>
            </div>
          ) : (
            <div />
          )}
          {flight.booking_link && (
            <a
              href={flight.booking_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-[#FF385C] hover:text-[#cc1c40] transition-colors px-3 py-1.5 rounded-lg border border-[#FFB3C1] hover:bg-[#FFF0F3]"
            >
              Book Flight
            </a>
          )}
        </div>
      )}
    </div>
  );
}
