"use client";

import { useEffect, useState } from "react";

interface TransportItem {
  mode: string;
  trips: number;
  total_km: number;
  total_hours: number;
}

interface MovementStepProps {
  profile: {
    primary_transport: string;
    transport_breakdown: TransportItem[];
    commute_avg_km: number;
    commute_avg_min: number;
    daily_rhythm: string;
    routine_score: number;
    weekend_explorer: boolean;
    hour_distribution: Record<string, number>;
    weekday_distribution: Record<string, number>;
  };
  onNext: () => void;
  onBack: () => void;
}

function AnimatedBar({ width, delay }: { width: number; delay: number }) {
  const [animWidth, setAnimWidth] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setAnimWidth(width), delay);
    return () => clearTimeout(timer);
  }, [width, delay]);
  return (
    <div
      className="transport-bar-fill animated-bar"
      style={{ width: `${Math.max(animWidth, 2)}%` }}
    />
  );
}

export default function MovementStep({
  profile,
  onNext,
  onBack,
}: MovementStepProps) {
  const maxKm = Math.max(
    ...profile.transport_breakdown.map((t) => t.total_km),
    1
  );

  const rhythmIcon =
    profile.daily_rhythm === "Early Bird"
      ? "🌅"
      : profile.daily_rhythm === "Night Owl"
        ? "🦉"
        : "☀️";
  const rhythmDesc =
    profile.daily_rhythm === "Early Bird"
      ? "You're most active in the early morning hours."
      : profile.daily_rhythm === "Night Owl"
        ? "You come alive when the sun goes down."
        : "Your activity peaks during daytime hours.";

  const hourEntries: [string, number][] = Array.from(
    { length: 24 },
    (_, h) => {
      const key = h.toString().padStart(2, "0");
      return [key, (profile.hour_distribution || {})[key] || 0];
    }
  );
  const maxHourVal = Math.max(...hourEntries.map(([, v]) => v), 1);

  const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dayEntries: [string, number][] = dayOrder.map((d) => [
    d,
    (profile.weekday_distribution || {})[d] || 0,
  ]);
  const maxDayVal = Math.max(...dayEntries.map(([, v]) => v), 1);

  return (
    <div className="wizard-page fade-in">
      <div className="wizard-page-header">
        <h2 style={{ fontSize: "2.8rem", lineHeight: "1.1" }}>
          How You <span className="serif-italic">Move</span>
        </h2>
        <p style={{ marginTop: "1rem", lineHeight: "1.5" }}>
          Your transportation habits and daily patterns.
        </p>
      </div>

      <div className="wizard-card">
        <div className="wizard-card-header">🚗 Transport Breakdown</div>
        <div className="transport-bars">
          {profile.transport_breakdown.map((t, i) => (
            <div className="transport-bar-row" key={t.mode}>
              <span className="transport-bar-label">{t.mode}</span>
              <div className="transport-bar-track">
                <AnimatedBar
                  width={(t.total_km / maxKm) * 100}
                  delay={200 + i * 150}
                />
              </div>
              <span className="transport-bar-value">
                {t.total_km.toLocaleString()} km
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="movement-insights-row">
        <div className="insight-card">
          <div className="insight-icon">{rhythmIcon}</div>
          <div className="insight-title">{profile.daily_rhythm}</div>
          <div className="insight-desc">{rhythmDesc}</div>
        </div>

        {profile.commute_avg_km > 0 && (
          <div className="insight-card">
            <div className="insight-icon">🚗</div>
            <div className="insight-title">
              {profile.commute_avg_km} km · {profile.commute_avg_min} min
            </div>
            <div className="insight-desc">Your average daily commute</div>
          </div>
        )}

        <div className="insight-card">
          <div className="insight-icon">
            {profile.routine_score > 70 ? "🔄" : "🧭"}
          </div>
          <div className="insight-title">
            {profile.routine_score}% Routine
          </div>
          <div className="insight-desc">
            {profile.routine_score > 70
              ? "You stick to familiar spots"
              : "You love exploring new places"}
          </div>
        </div>
      </div>

      <div className="wizard-card">
        <div className="wizard-card-header">📊 Activity Patterns</div>
        <div className="heatmap-section">
          <div className="heatmap-group">
            <div className="heatmap-label">Hours of the Day</div>
            <div className="hour-heatmap">
              {hourEntries.map(([hour, val]) => {
                const intensity = val / maxHourVal;
                return (
                  <div
                    key={hour}
                    className="heatmap-cell"
                    style={{
                      backgroundColor: `rgba(255, 56, 92, ${Math.max(intensity * 0.9, 0.05)})`,
                    }}
                    title={`${hour}:00 — ${val} activities`}
                  >
                    <span className="heatmap-cell-label">
                      {parseInt(hour) % 3 === 0 ? `${hour}` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="heatmap-group">
            <div className="heatmap-label">Day of the Week</div>
            <div className="weekday-bars">
              {dayEntries.map(([day, val]) => {
                const pct = (val / maxDayVal) * 100;
                return (
                  <div key={day} className="weekday-bar-col">
                    <div className="weekday-bar-track">
                      <div
                        className="weekday-bar-fill"
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                    <span className="weekday-bar-label">{day}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="wizard-nav">
        <button className="wizard-back-btn" onClick={onBack}>
          ← Back
        </button>
        <button className="wizard-next-btn" onClick={onNext}>
          Explore Your World →
        </button>
      </div>
    </div>
  );
}
