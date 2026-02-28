"use client";

interface LoadingScreenProps {
  step: number;
}

const STEPS = [
  { label: "Parsing location data", icon: "📍" },
  { label: "Filtering redundant signals", icon: "🔍" },
  { label: "Analyzing transport habits", icon: "🚗" },
  { label: "Mapping destinations", icon: "🗺️" },
  { label: "Generating trip suggestions", icon: "✨" },
];

export default function LoadingScreen({ step }: LoadingScreenProps) {
  const progress = Math.min(((step + 1) / STEPS.length) * 100, 100);

  return (
    <div className="loading-page fade-in">
      <div className="loading-content">
        <div className="loading-brand">LuftGo</div>

        <h2 className="loading-title">
          Analyzing your travel{" "}
          <span className="serif-italic">history</span>
        </h2>
        <p className="loading-subtitle">
          We&apos;re crunching your data to build a personalized profile.
        </p>

        <div className="loading-progress-bar">
          <div
            className="loading-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="loading-checklist">
          {STEPS.map(({ label, icon }, i) => (
            <div
              key={i}
              className={`loading-check-item ${i < step ? "done" : i === step ? "active" : "pending"}`}
            >
              <span className="loading-check-icon">
                {i < step ? "✓" : icon}
              </span>
              <span className="loading-check-label">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
