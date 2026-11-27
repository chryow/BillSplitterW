"use client";

import { EDITORIAL_THEME } from "@/lib/theme";

interface ColophonFooterProps {
  /** Adds extra bottom clearance when a page renders a fixed bottom action bar */
  withBottomBarOffset?: boolean;
}

/**
 * Editorial publisher's imprint (colophon) anchored cleanly at the bottom of every page.
 */
export function ColophonFooter({
  withBottomBarOffset = false,
}: ColophonFooterProps) {
  return (
    <footer
      className={`mt-auto w-full border-t border-[var(--border-subtle)] bg-[var(--bg-app)] ${
        withBottomBarOffset ? "pb-20" : "pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      }`}
    >
      <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
        <span className="truncate">
          {EDITORIAL_THEME.appName} &middot; {EDITORIAL_THEME.version}
        </span>

        <span className="inline-flex shrink-0 items-center gap-2 text-[var(--text-secondary)]">
          <span>{EDITORIAL_THEME.colophonLabel}</span>
          <span
            aria-hidden="true"
            className="inline-block h-[5px] w-[5px] shrink-0 bg-[var(--accent)]"
          />
        </span>
      </div>
    </footer>
  );
}
