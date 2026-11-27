"use client";

import type { AppStep } from "@/lib/types";

interface StepIndicatorProps {
  currentStep: AppStep;
  canNavigateTo: (step: AppStep) => boolean;
  onSelectStep: (step: AppStep) => void;
}

const STEPS: { step: AppStep; label: string }[] = [
  { step: 1, label: "Start" },
  { step: 2, label: "Items" },
  { step: 3, label: "Assign" },
  { step: 4, label: "Split" },
];

export function StepIndicator({
  currentStep,
  canNavigateTo,
  onSelectStep,
}: StepIndicatorProps) {
  return (
    <nav
      aria-label="Split workflow steps"
      className="mx-auto grid w-full max-w-md grid-cols-4 gap-1.5 px-4 pt-3 pb-1"
    >
      {STEPS.map(({ step, label }) => {
        const active = step === currentStep;
        const completed = step < currentStep;
        const reachable = canNavigateTo(step);

        return (
          <button
            key={step}
            type="button"
            disabled={!reachable}
            onClick={() => reachable && onSelectStep(step)}
            className="group flex flex-col gap-1.5 text-left disabled:cursor-not-allowed"
          >
            <div
              className={`h-1 w-full rounded-full transition-colors ${
                active
                  ? "bg-[var(--accent)]"
                  : completed
                    ? "bg-[var(--accent)]/55"
                    : "bg-[var(--border-strong)]"
              }`}
            />
            <span
              className={`text-[11px] font-medium transition-colors ${
                active
                  ? "text-[var(--text-primary)]"
                  : completed
                    ? "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"
                    : "text-[var(--text-muted)]"
              }`}
            >
              {step}. {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
