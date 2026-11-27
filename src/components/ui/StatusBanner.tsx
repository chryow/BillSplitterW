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
    info: "bg-[var(--bg-surface)] border-[var(--border-strong)] text-[var(--text-primary)]",
    warning:
      "bg-[var(--warning-bg)] border-[var(--warning-border)] text-[var(--warning-text)]",
    error:
      "bg-[var(--danger-bg)] border-[var(--danger-border)] text-[var(--danger-text)]",
    success:
      "bg-[var(--success-soft)] border-[var(--success-border)] text-[var(--success-text)]",
  };

  const Icon =
    variant === "success"
      ? CheckCircle2
      : variant === "info"
        ? Info
        : AlertTriangle;

  return (
    <div
      className={`rounded-[3px] border px-3.5 py-3 text-xs leading-relaxed ${styles[variant]}`}
      role={variant === "error" || variant === "warning" ? "alert" : "status"}
    >
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          {title && (
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em]">
              {title}
            </p>
          )}
          <p className={title ? "mt-1 text-[var(--text-primary)]" : ""}>
            {message}
          </p>
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="mt-2.5 inline-flex items-center rounded-[3px] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-primary)] transition-colors duration-150 ease-out hover:bg-[var(--ink-solid)] hover:text-[var(--ink-on-solid)]"
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
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px] opacity-75 transition-opacity duration-150 ease-out hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
