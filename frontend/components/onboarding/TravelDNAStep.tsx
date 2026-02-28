"use client";

import { useEffect, useState } from "react";

interface TravelDNAStepProps {
  profile: {
    home_city: string;
    traveler_type: string;
    traveler_tagline: string;
    total_flights: number;
    total_km: number;
    geographic_diversity: number;
    date_range: { start: string; end: string };
  };
  onNext: () => void;
}

function AnimatedNumber({
  target,
  suffix = "",
  duration = 1200,
}: {
  target: number;
  suffix?: string;
  duration?: number;
}) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);

  return (
    <>
      {current.toLocaleString()}
      {suffix}
    </>
  );
}

export default function TravelDNAStep({
  profile,
  onNext,
}: TravelDNAStepProps) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const typeIcons: Record<string, string> = {
    "Global Explorer": "🌍",
    "Frequent Flyer": "✈️",
    "Road Trip Enthusiast": "🛣️",
    "Urban Commuter": "🏙️",
    "Transit Navigator": "🚇",
    "Urban Walker": "🚶",
    "Weekend Explorer": "🗺️",
    "Balanced Traveler": "⚖️",
  };

  const yearsOfData = (() => {
    try {
      const start = new Date(profile.date_range.start);
      const end = new Date(profile.date_range.end);
      const years =
        (end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      return Math.max(Math.round(years * 10) / 10, 0.1);
    } catch {
      return 0;
    }
  })();

  return (
    <div className="wizard-page fade-in">
      <div className="dna-reveal-container">
        <div className={`dna-type-reveal ${revealed ? "revealed" : ""}`}>
          <span className="dna-type-icon">
            {typeIcons[profile.traveler_type] || "🧭"}
          </span>
          <div className="dna-type-label">Your Traveler Type</div>
          <h1 className="dna-type-name">
            {profile.traveler_type.split(" ").map((word, i) => (
              <span key={i}>
                {i === profile.traveler_type.split(" ").length - 1 ? (
                  <span className="serif-italic">{word}</span>
                ) : (
                  word + " "
                )}
              </span>
            ))}
          </h1>
          <p className="dna-type-tagline">{profile.traveler_tagline}</p>
        </div>

        <div className={`dna-stats-grid ${revealed ? "revealed" : ""}`}>
          <div className="dna-stat-card">
            <div className="dna-stat-icon">📍</div>
            <div className="dna-stat-value accent">{profile.home_city}</div>
            <div className="dna-stat-label">Home Base</div>
          </div>

          <div className="dna-stat-card">
            <div className="dna-stat-icon">✈️</div>
            <div className="dna-stat-value">
              <AnimatedNumber target={profile.total_flights} />
            </div>
            <div className="dna-stat-label">Flights Taken</div>
          </div>

          <div className="dna-stat-card">
            <div className="dna-stat-icon">🛤️</div>
            <div className="dna-stat-value">
              <AnimatedNumber target={profile.total_km} suffix=" km" />
            </div>
            <div className="dna-stat-label">Total Distance</div>
          </div>

          <div className="dna-stat-card">
            <div className="dna-stat-icon">🗓️</div>
            <div className="dna-stat-value">
              {yearsOfData}{" "}
              <span style={{ fontSize: "0.6em", fontWeight: 400 }}>years</span>
            </div>
            <div className="dna-stat-label">of Travel Data</div>
          </div>
        </div>
      </div>

      <button className="wizard-next-btn" onClick={onNext}>
        See How You Move →
      </button>
    </div>
  );
}
