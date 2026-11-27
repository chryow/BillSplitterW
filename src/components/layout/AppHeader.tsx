"use client";

import { ChevronDown, Moon, Sun, User } from "lucide-react";
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
    <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-2)]">
      <div className="mx-auto flex h-14 w-full max-w-lg items-center justify-between gap-2 px-4">
        <button
          type="button"
          onClick={onLogoClick}
          className="group flex items-center gap-2 py-1 pr-2 text-left transition-opacity duration-150 ease-out hover:opacity-80"
        >
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 shrink-0 bg-[var(--accent)]"
          />
          <span className="font-editorial text-[19px] font-semibold tracking-tight text-[var(--text-primary)]">
            BillSplitterW
          </span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenCurrency}
            aria-label="Switch currency"
            className="flex h-8 items-center gap-1 rounded-[3px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 font-mono text-[11px] font-semibold tracking-[0.06em] text-[var(--text-primary)] transition-colors duration-150 ease-out hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
          >
            <span>{currency}</span>
            <ChevronDown className="h-3 w-3 text-[var(--text-muted)]" />
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={
              theme === "dark"
                ? "Switch to Paper (light) mode"
                : "Switch to Night Ink (dark) mode"
            }
            className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors duration-150 ease-out hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            {theme === "dark" ? (
              <Sun className="h-3.5 w-3.5" />
            ) : (
              <Moon className="h-3.5 w-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenAccount}
            aria-label={
              user ? "Account and saved history" : "Sign in or guest mode"
            }
            className="flex h-8 items-center gap-1.5 rounded-[3px] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-primary)] transition-colors duration-150 ease-out hover:bg-[var(--ink-solid)] hover:text-[var(--ink-on-solid)]"
          >
            {user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="h-4 w-4 rounded-[2px] border border-[var(--border-subtle)] object-cover"
              />
            ) : (
              <User className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="max-w-[76px] truncate">
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
