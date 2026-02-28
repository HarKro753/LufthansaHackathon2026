"use client";

import { useState } from "react";
import type { TripState } from "@/types/trip";

const API_BASE = "http://localhost:8000";

interface CalendarExportProps {
  trip: TripState | null;
}

export function CalendarExport({ trip }: CalendarExportProps) {
  const [downloading, setDownloading] = useState(false);

  if (!trip) return null;

  const totalEvents =
    trip.routes.length + trip.stays.length + trip.activities.length;
  if (totalEvents === 0) return null;

  const handleExport = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`${API_BASE}/api/trip/export`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`Export failed: ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const disposition = res.headers.get("content-disposition");
      const filenameMatch = disposition?.match(/filename="?(.+?)"?$/);
      a.download =
        filenameMatch?.[1] ?? `${trip.name.replace(/[^a-zA-Z0-9]/g, "_")}.ics`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Calendar export failed:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={downloading}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-[#2a2a2a] border border-white/10 text-white/60 hover:text-white hover:border-white/20 hover:bg-[#333] disabled:opacity-40 disabled:cursor-not-allowed"
      title={`Export ${totalEvents} event${totalEvents !== 1 ? "s" : ""} to calendar`}
    >
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      {downloading ? "Exporting..." : "Export .ics"}
    </button>
  );
}
