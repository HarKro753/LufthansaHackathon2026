"use client";

import type { TimelineItem } from "@/types/chat";
import { FlightCard } from "@/components/FlightCard";
import { StayCard } from "@/components/StayCard";
import { RouteCard } from "@/components/RouteCard";
import { ActivityCard } from "@/components/ActivityCard";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getTimelineIcon(item: TimelineItem) {
  if (item.itemType === "flight") {
    return (
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
      </svg>
    );
  }
  if (item.itemType === "stay") {
    return (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    );
  }
  if (item.itemType === "route") {
    const mode = item.data.travel_mode.toLowerCase();
    if (mode.includes("transit") || mode.includes("rail") || mode.includes("train")) {
      return (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 18l4 4 4-4M12 2v16M4 6h16M6 10h12M8 14h8" />
        </svg>
      );
    }
    if (mode.includes("drive") || mode.includes("car") || mode.includes("driving")) {
      return (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10M19.4 16H5" />
        </svg>
      );
    }
    return (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    );
  }
  // activity
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

function getTimelineLabel(item: TimelineItem): string {
  if (item.itemType === "flight") return "Flight";
  if (item.itemType === "stay") return "Stay";
  if (item.itemType === "route") {
    const mode = item.data.travel_mode.toLowerCase();
    if (mode.includes("transit") || mode.includes("rail") || mode.includes("train")) return "Train";
    if (mode.includes("drive") || mode.includes("car") || mode.includes("driving")) return "Drive";
    if (mode.includes("bus")) return "Bus";
    if (mode.includes("walk")) return "Walk";
    return "Transfer";
  }
  if (item.itemType === "activity") {
    if (item.data.type === "restaurant") return "Restaurant";
    if (item.data.type === "attraction") return "Attraction";
    return "Activity";
  }
  return "";
}

function getTimelineDate(item: TimelineItem): string {
  if (item.itemType === "flight") return formatDate(item.data.departure_time);
  if (item.itemType === "stay") {
    const ci = formatDate(item.data.check_in_date);
    const co = formatDate(item.data.check_out_date);
    return `${ci} - ${co}`;
  }
  if (item.itemType === "route") return formatDate(item.data.departure_time);
  if (item.itemType === "activity" && item.data.scheduled_date) {
    return formatDate(item.data.scheduled_date);
  }
  return "";
}

function getIconColor(item: TimelineItem): string {
  if (item.itemType === "flight") return "bg-gray-900 text-white";
  if (item.itemType === "stay") return "bg-[#FF385C] text-white";
  if (item.itemType === "route") {
    const mode = item.data.travel_mode.toLowerCase();
    if (mode.includes("transit") || mode.includes("rail") || mode.includes("train")) return "bg-blue-600 text-white";
    if (mode.includes("drive") || mode.includes("car") || mode.includes("driving")) return "bg-emerald-600 text-white";
    return "bg-gray-600 text-white";
  }
  return "bg-amber-500 text-white";
}

interface TimelineCardProps {
  item: TimelineItem;
  isLast: boolean;
}

export function TimelineCard({ item, isLast }: TimelineCardProps) {
  const label = getTimelineLabel(item);
  const dateStr = getTimelineDate(item);
  const icon = getTimelineIcon(item);
  const iconColor = getIconColor(item);

  return (
    <div className="relative flex gap-3 mb-1">
      {/* Vertical line + icon */}
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-7 h-7 rounded-full ${iconColor} flex items-center justify-center z-10`}>
          {icon}
        </div>
        {!isLast && (
          <div className="w-[2px] flex-1 bg-gray-200 min-h-[12px]" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-4">
        {/* Label header */}
        <div className="flex items-center gap-2 mb-2 mt-1">
          <span className="text-sm font-semibold text-gray-900">{label}</span>
          {dateStr && (
            <span className="text-xs text-gray-400">{dateStr}</span>
          )}
        </div>

        {/* Card */}
        {item.itemType === "flight" && <FlightCard flight={item.data} />}
        {item.itemType === "stay" && <StayCard stay={item.data} />}
        {item.itemType === "route" && <RouteCard route={item.data} />}
        {item.itemType === "activity" && <ActivityCard activity={item.data} />}
      </div>
    </div>
  );
}
