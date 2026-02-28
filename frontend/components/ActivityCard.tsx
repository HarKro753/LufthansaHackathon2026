"use client";

import type { TripActivity } from "@/types/trip";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getActivityIcon(type: TripActivity["type"]) {
  if (type === "restaurant") {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    );
  }
  if (type === "attraction") {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function getActivityLabel(type: TripActivity["type"]): string {
  if (type === "restaurant") return "Restaurant";
  if (type === "attraction") return "Attraction";
  return "Activity";
}

export function ActivityCard({ activity }: { activity: TripActivity }) {
  const label = getActivityLabel(activity.type);
  const icon = getActivityIcon(activity.type);
  const dateStr = activity.scheduled_date ? formatDate(activity.scheduled_date) : null;
  const timeStr = activity.scheduled_time ?? null;

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0 mt-0.5">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                {label}
              </span>
              {dateStr && (
                <span className="text-[11px] text-gray-400">
                  {dateStr}
                  {timeStr && ` at ${timeStr}`}
                </span>
              )}
            </div>
            <h4 className="text-sm font-semibold text-gray-900">
              {activity.name}
            </h4>
            {activity.address && (
              <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                {activity.address}
              </p>
            )}
            <div className="flex items-center gap-3 mt-1.5">
              {activity.rating !== null && activity.rating > 0 && (
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-xs text-gray-600 font-medium">{activity.rating.toFixed(1)}</span>
                </div>
              )}
              {activity.price_level && (
                <span className="text-xs text-gray-500">{activity.price_level}</span>
              )}
              {activity.duration !== null && activity.duration > 0 && (
                <span className="text-[11px] text-gray-400">
                  ~{activity.duration}min
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
