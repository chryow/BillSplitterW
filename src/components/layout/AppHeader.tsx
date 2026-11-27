"use client";

import { ChevronDown, Moon, ReceiptText, Sun, User } from "lucide-react";
import type { ThemeMode } from "@/lib/storage";
import type { CurrencyCode } from "@/lib/types";

interface AppHeaderProps {
  currency: CurrencyCode;
  theme: ThemeMode;
  user: {
    displayName: string;
    avatarUrl: string | null;
  } | null;
  savedCount: number;
  onLogoClick: () => void;
  onOpenCurrency: () => void;
  onToggleTheme: () => void;
  onOpenAccount: () => void;
}

export function AppHeader({
  currency,
  theme,
  user,
  savedCount,
  onLogoClick,
  onOpenCurrency,
  onToggleTheme,
  onOpenAccount,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-app)]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between gap-2 px-4">
        <button
          type="button"
          onClick={onLogoClick}
          className="flex items-center gap-2 rounded-xl py-1 pr-2 text-left transition-opacity hover:opacity-85"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)]">
            <ReceiptText className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
            BillSplitterW
          </span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenCurrency}
            aria-label="Switch currency"
            className="flex h-9 items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 font-mono text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            <span>{currency}</span>
            <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenAccount}
            aria-label={user ? "Account and saved history" : "Sign in or guest mode"}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            {user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="h-5 w-5 rounded-full object-cover"
              />
            ) : (
              <User className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
            )}
            <span className="max-w-[68px] truncate">
              {user
                ? savedCount > 0
                  ? `Saved (${savedCount})`
                  : "Account"
                : "Sign in"}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
