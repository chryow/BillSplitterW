"use client";

import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

export type BannerVariant = "info" | "warning" | "error" | "success";

interface StatusBannerProps {
  variant: BannerVariant;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}

export function StatusBanner({
  variant,
  title,
  message,
  actionLabel,
  onAction,
  onDismiss,
}: StatusBannerProps) {
  const styles: Record<BannerVariant, string> = {
    info: "bg-[var(--bg-surface-2)] border-[var(--border-strong)] text-[var(--text-primary)]",
    warning:
      "bg-[var(--warning-bg)] border-[var(--warning-border)] text-[var(--warning-text)]",
    error:
      "bg-[var(--danger-bg)] border-[var(--danger-border)] text-[var(--danger-text)]",
    success:
      "bg-[var(--accent-soft)] border-[var(--accent)]/30 text-[var(--accent-text)]",
  };

  const Icon =
    variant === "success"
      ? CheckCircle2
      : variant === "info"
        ? Info
        : AlertTriangle;

  return (
    <div
      className={`rounded-xl border px-3.5 py-3 text-xs leading-relaxed ${styles[variant]}`}
      role={variant === "error" || variant === "warning" ? "alert" : "status"}
    >
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          {title && <p className="font-semibold">{title}</p>}
          <p className={title ? "mt-0.5 opacity-90" : ""}>{message}</p>
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="mt-2 inline-flex items-center rounded-lg border border-current/25 bg-current/10 px-2.5 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90"
            >
              {actionLabel}
            </button>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg opacity-75 transition-opacity hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
