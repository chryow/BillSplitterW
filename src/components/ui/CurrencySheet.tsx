"use client";

import { Check } from "lucide-react";
import { BottomSheet } from "@/components/layout/BottomSheet";
import { CURRENCY_LIST, formatCurrency } from "@/lib/currency";
import type { CurrencyCode } from "@/lib/types";

interface CurrencySheetProps {
  open: boolean;
  onClose: () => void;
  selected: CurrencyCode;
  onSelect: (code: CurrencyCode) => void;
}

export function CurrencySheet({
  open,
  onClose,
  selected,
  onSelect,
}: CurrencySheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Select Currency"
      subtitle="Formatting and rounding adjust automatically"
    >
      <div className="space-y-1.5">
        {CURRENCY_LIST.map((cur) => {
          const active = cur.code === selected;
          const preview = cur.decimals === 0 ? 45000 : 12.5;
          return (
            <button
              key={cur.code}
              type="button"
              onClick={() => {
                onSelect(cur.code);
                onClose();
              }}
              className={`flex min-h-[52px] w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                active
                  ? "border-[var(--accent)]/50 bg-[var(--accent-soft)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-surface-2)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg" aria-hidden="true">
                  {cur.flag}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      {cur.code}
                    </span>
                    <span className="font-mono text-xs text-[var(--text-secondary)] tabular-nums">
                      {formatCurrency(preview, cur.code)}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">{cur.name}</p>
                </div>
              </div>

              {active && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-white">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
