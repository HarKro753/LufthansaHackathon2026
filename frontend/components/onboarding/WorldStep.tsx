"use client";

import { useState } from "react";

interface WorldStepProps {
  profile: {
    top_destinations: { city: string; visits: number }[];
    total_flights: number;
    geographic_diversity: number;
    travel_season: string;
    flights_per_month: number;
    month_distribution: Record<string, number>;
  };
  flights: {
    date: string;
    origin: string;
    destination: string;
    duration_hrs: number;
    distance_km: number;
  }[];
  onNext: () => void;
  onBack: () => void;
}

export default function WorldStep({
  profile,
  flights,
  onNext,
  onBack,
}: WorldStepProps) {
  const [showAllFlights, setShowAllFlights] = useState(false);
  const visibleFlights = showAllFlights ? flights : flights.slice(0, 5);

  const monthOrder = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const monthEntries: [string, number][] = monthOrder.map((m) => [
    m,
    (profile.month_distribution || {})[m] || 0,
  ]);
  const maxMonthVal = Math.max(...monthEntries.map(([, v]) => v), 1);

  const tier1 = profile.top_destinations.slice(0, 3);
  const tier2 = profile.top_destinations.slice(3, 8);
  const tier3 = profile.top_destinations.slice(8, 12);

  return (
    <div className="wizard-page fade-in">
      <div className="wizard-page-header">
        <h2 style={{ fontSize: "2.8rem", lineHeight: "1.1" }}>
          Your <span className="serif-italic">World</span>
        </h2>
        <p style={{ marginTop: "1rem", lineHeight: "1.5" }}>
          Places you&apos;ve explored and your flight footprint.
        </p>
      </div>

      <div className="world-quick-stats">
        <div className="world-stat">
          <span className="world-stat-number">
            {profile.geographic_diversity}
          </span>
          <span className="world-stat-label">Areas Explored</span>
        </div>
        <div className="world-stat-divider" />
        <div className="world-stat">
          <span className="world-stat-number">{profile.total_flights}</span>
          <span className="world-stat-label">Flights Taken</span>
        </div>
        <div className="world-stat-divider" />
        <div className="world-stat">
          <span className="world-stat-number">
            {profile.flights_per_month}/mo
          </span>
          <span className="world-stat-label">Flight Frequency</span>
        </div>
        <div className="world-stat-divider" />
        <div className="world-stat">
          <span className="world-stat-number">
            {profile.travel_season || "Year-round"}
          </span>
          <span className="world-stat-label">Peak Season</span>
        </div>
      </div>

      <div className="wizard-card">
        <div className="wizard-card-header">🌍 Top Destinations</div>

        {tier1.length > 0 && (
          <div className="dest-tier dest-tier-featured">
            {tier1.map((d, i) => (
              <div
                className={`dest-featured-card fade-in stagger-${i + 1}`}
                key={d.city}
              >
                <div className="dest-featured-rank">#{i + 1}</div>
                <div className="dest-featured-city">{d.city}</div>
                <div className="dest-featured-visits">{d.visits} visits</div>
              </div>
            ))}
          </div>
        )}

        {tier2.length > 0 && (
          <div className="dest-tier dest-tier-regular">
            {tier2.map((d, i) => (
              <div className="dest-row" key={d.city}>
                <span className="dest-rank">{i + 4}</span>
                <span className="dest-city">{d.city}</span>
                <span className="dest-visits">{d.visits} visits</span>
              </div>
            ))}
          </div>
        )}

        {tier3.length > 0 && (
          <div className="dest-tier dest-tier-minor">
            {tier3.map((d) => (
              <div className="dest-minor-row" key={d.city}>
                <span className="dest-minor-city">{d.city}</span>
                <span className="dest-minor-visits">{d.visits}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="wizard-card">
        <div className="wizard-card-header">📅 When You Travel</div>
        <div className="month-heatmap">
          {monthEntries.map(([month, val]) => {
            const intensity = val / maxMonthVal;
            return (
              <div key={month} className="month-heatmap-cell">
                <div
                  className="month-heatmap-bar"
                  style={{
                    height: `${Math.max(intensity * 100, 8)}%`,
                    backgroundColor: `rgba(255, 56, 92, ${Math.max(intensity * 0.85, 0.1)})`,
                  }}
                />
                <span className="month-heatmap-label">{month}</span>
              </div>
            );
          })}
        </div>
      </div>

      {flights.length > 0 && (
        <div className="wizard-card">
          <div className="wizard-card-header">
            ✈️ Flight History
            <span className="flight-count-badge">
              {flights.length} flights
            </span>
          </div>
          <div className="flight-list">
            {visibleFlights.map((f, i) => (
              <div className="flight-row" key={i}>
                <span className="flight-date">{f.date}</span>
                <span className="flight-route">
                  {f.origin} → {f.destination}
                </span>
                <span className="flight-detail">
                  {f.duration_hrs}h · {f.distance_km.toLocaleString()} km
                </span>
              </div>
            ))}
          </div>
          {flights.length > 5 && (
            <button
              className="show-more-btn"
              onClick={() => setShowAllFlights(!showAllFlights)}
            >
              {showAllFlights
                ? "Show less"
                : `Show all ${flights.length} flights`}
            </button>
          )}
        </div>
      )}

      <div className="wizard-nav">
        <button className="wizard-back-btn" onClick={onBack}>
          ← Back
        </button>
        <button className="wizard-next-btn" onClick={onNext}>
          Your Travel Style →
        </button>
      </div>
    </div>
  );
}
