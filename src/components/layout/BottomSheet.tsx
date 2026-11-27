"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
}: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="relative z-10 flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl sm:rounded-2xl animate-sheet-up">
        {/* Mobile grab bar */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-[var(--border-strong)]" />
        </div>

        <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold tracking-tight text-[var(--text-primary)]">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}
