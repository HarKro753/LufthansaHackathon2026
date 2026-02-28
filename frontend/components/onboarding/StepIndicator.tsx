"use client";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  labels: string[];
}

export default function StepIndicator({
  currentStep,
  totalSteps,
  labels,
}: StepIndicatorProps) {
  return (
    <div className="step-indicator">
      <div className="step-bar">
        <div
          className="step-bar-fill"
          style={{ width: `${(currentStep / (totalSteps - 1)) * 100}%` }}
        />
      </div>
      <div className="step-labels">
        {labels.map((label, i) => (
          <div
            key={i}
            className={`step-label ${i < currentStep ? "done" : i === currentStep ? "active" : ""}`}
          >
            <div
              className={`step-dot ${i < currentStep ? "done" : i === currentStep ? "active" : ""}`}
            >
              {i < currentStep ? "✓" : i + 1}
            </div>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
