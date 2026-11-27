"use client";

import type { AppStep } from "@/lib/types";

interface StepIndicatorProps {
  currentStep: AppStep;
  canNavigateTo: (step: AppStep) => boolean;
  onSelectStep: (step: AppStep) => void;
}

const STEPS: { step: AppStep; index: string; label: string }[] = [
  { step: 1, index: "01", label: "Start" },
  { step: 2, index: "02", label: "Items" },
  { step: 3, index: "03", label: "Assign" },
  { step: 4, index: "04", label: "Split" },
];

export function StepIndicator({
  currentStep,
  canNavigateTo,
  onSelectStep,
}: StepIndicatorProps) {
  return (
    <nav
      aria-label="Split workflow steps"
      className="mx-auto grid w-full max-w-lg grid-cols-4 gap-2 px-4 pt-3 pb-1"
    >
      {STEPS.map(({ step, index, label }) => {
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
              className={`h-[2px] w-full transition-colors duration-150 ease-out ${
                active
                  ? "bg-[var(--accent)]"
                  : completed
                    ? "bg-[var(--border-strong)]"
                    : "bg-[var(--border-subtle)]"
              }`}
            />
            <span
              className={`font-mono text-[10px] uppercase tracking-[0.08em] transition-colors duration-150 ease-out ${
                active
                  ? "font-semibold text-[var(--accent-text)]"
                  : completed
                    ? "font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-text)]"
                    : "text-[var(--text-muted)]"
              }`}
            >
              {index} {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
