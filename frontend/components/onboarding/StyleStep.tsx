"use client";

import { useState } from "react";

interface StyleStepProps {
  profile: {
    preferences: string[];
    traveler_type: string;
    weekend_explorer: boolean;
    daily_rhythm: string;
    primary_transport: string;
  };
  onUpdatePreferences: (prefs: string[]) => void;
  onNext: () => void;
  onBack: () => void;
}

const PREFERENCE_GROUPS = [
  {
    label: "Travel Mode",
    icon: "🚀",
    options: [
      "Prefers driving over public transit",
      "Prefers public transit over driving",
      "Active cyclist",
      "Walks more than drives — urban lifestyle",
    ],
  },
  {
    label: "Travel Frequency",
    icon: "✈️",
    options: [
      "Frequent flyer",
      "Occasional flyer",
      "Prefers staying local",
    ],
  },
  {
    label: "Travel Style",
    icon: "🎒",
    options: [
      "Prefers budget travel",
      "Prefers luxury travel",
      "Enjoys solo travel",
      "Enjoys group travel",
    ],
  },
  {
    label: "Interests",
    icon: "❤️",
    options: [
      "Enjoys nature & outdoors",
      "Enjoys city exploration",
      "Foodie — loves culinary experiences",
      "History & culture enthusiast",
      "Beach lover",
      "Mountain enthusiast",
      "Nightlife & social scenes",
      "Art & museums",
    ],
  },
];

export default function StyleStep({
  profile,
  onUpdatePreferences,
  onNext,
  onBack,
}: StyleStepProps) {
  const [prefs, setPrefs] = useState<string[]>(profile.preferences);

  const togglePref = (pref: string) => {
    const updated = prefs.includes(pref)
      ? prefs.filter((p) => p !== pref)
      : [...prefs, pref];
    setPrefs(updated);
    onUpdatePreferences(updated);
  };

  const traits: { icon: string; label: string }[] = [];

  if (profile.weekend_explorer) {
    traits.push({ icon: "🗺️", label: "Weekend Explorer" });
  }
  traits.push({
    icon:
      profile.daily_rhythm === "Early Bird"
        ? "🌅"
        : profile.daily_rhythm === "Night Owl"
          ? "🦉"
          : "☀️",
    label: profile.daily_rhythm,
  });
  if (profile.primary_transport === "Driving") {
    traits.push({ icon: "🚗", label: "Road Tripper" });
  } else if (profile.primary_transport === "Walking") {
    traits.push({ icon: "🚶", label: "City Walker" });
  } else if (
    ["Train", "Bus", "Subway", "Tram"].includes(profile.primary_transport)
  ) {
    traits.push({ icon: "🚇", label: "Transit Pro" });
  }

  return (
    <div className="wizard-page fade-in">
      <div className="wizard-page-header">
        <h2 style={{ fontSize: "2.8rem", lineHeight: "1.1" }}>
          Your Travel <span className="serif-italic">Style</span>
        </h2>
        <p style={{ marginTop: "1rem", lineHeight: "1.5" }}>
          We detected these from your data. Adjust anything that doesn&apos;t
          feel right.
        </p>
      </div>

      <div className="style-traits-row">
        {traits.map((t, i) => (
          <div
            className={`style-trait-badge fade-in stagger-${(i % 4) + 1}`}
            key={t.label}
          >
            <span className="style-trait-icon">{t.icon}</span>
            <span className="style-trait-label">{t.label}</span>
          </div>
        ))}
      </div>

      {PREFERENCE_GROUPS.map((group) => (
        <div className="wizard-card" key={group.label}>
          <div className="wizard-card-header">
            {group.icon} {group.label}
            <span className="edit-hint">tap to toggle</span>
          </div>
          <div className="pref-toggle-grid">
            {group.options.map((pref) => (
              <button
                key={pref}
                className={`pref-toggle ${prefs.includes(pref) ? "active" : ""}`}
                onClick={() => togglePref(pref)}
              >
                {prefs.includes(pref) ? "✓" : "+"} {pref}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="wizard-nav">
        <button className="wizard-back-btn" onClick={onBack}>
          ← Back
        </button>
        <button className="wizard-next-btn" onClick={onNext}>
          See Recommendations →
        </button>
      </div>
    </div>
  );
}
