"use client";

interface Suggestion {
  city: string;
  region: string;
  tags: string[];
  transport: string;
  score: number;
  already_visited: boolean;
  reasons: string[];
  best_months: string[];
}

function TripSuggestion({
  suggestion,
  index,
}: {
  suggestion: Suggestion;
  index: number;
}) {
  const travelImageIds = [1014, 1015, 1016, 1035, 1040, 1045, 137, 192];
  const imageId = travelImageIds[index % travelImageIds.length];
  const imageUrl = `https://picsum.photos/id/${imageId}/800/600`;

  return (
    <div className={`trip-card fade-in stagger-${(index % 4) + 1}`}>
      <div
        className="trip-image-placeholder"
        style={{ backgroundImage: `url(${imageUrl})` }}
      >
        {suggestion.already_visited && (
          <span className="trip-visited-badge">Visited Before</span>
        )}
      </div>

      <div className="trip-content">
        <div className="trip-header">
          <div>
            <div className="trip-city">{suggestion.city}</div>
            <div className="trip-region">{suggestion.region}</div>
          </div>
          <div className="trip-transport">{suggestion.transport}</div>
        </div>

        <div className="trip-reasons">
          {suggestion.reasons.map((r, i) => (
            <div className="trip-reason" key={i}>
              {r}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface SuggestionsStepProps {
  suggestions: Suggestion[];
  email?: string;
  onBack: () => void;
  onFinish: () => void;
}

export default function SuggestionsStep({
  suggestions,
  email,
  onBack,
  onFinish,
}: SuggestionsStepProps) {
  return (
    <div className="wizard-page fade-in">
      <div className="wizard-page-header">
        <h2 style={{ fontSize: "3rem", lineHeight: "1.1" }}>
          Discover the World&apos;s <br />
          <span className="serif-italic">Hidden</span> Wonders
        </h2>
        <p style={{ marginTop: "1.5rem", lineHeight: "1.5" }}>
          {email ? (
            <>
              Find the unique moments and remarkable destinations curated for{" "}
              <strong>{email}</strong>.
            </>
          ) : (
            <>
              Find the unique moments and remarkable destinations tailored to
              your travel history.
            </>
          )}
        </p>
      </div>

      <div
        style={{
          marginBottom: "1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h3 style={{ fontSize: "1.6rem", fontWeight: 700 }}>
          Top Destinations
        </h3>
        <span
          style={{
            fontSize: "0.85rem",
            fontWeight: 600,
            border: "1px solid var(--border)",
            padding: "0.4rem 1rem",
            borderRadius: "2rem",
            cursor: "pointer",
          }}
        >
          Explore all destinations
        </span>
      </div>

      <div className="suggestions-grid">
        {suggestions.map((s, i) => (
          <TripSuggestion key={s.city} suggestion={s} index={i} />
        ))}
      </div>

      <div className="wizard-nav" style={{ marginTop: "1.5rem" }}>
        <button className="wizard-back-btn" onClick={onBack}>
          ← Back
        </button>
        <button className="wizard-next-btn" onClick={onFinish}>
          ✨ Start Planning
        </button>
      </div>
    </div>
  );
}
