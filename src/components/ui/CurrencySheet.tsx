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
      subtitle="Scanned receipts & existing prices auto-convert using live FX rates"
    >
      <div className="divide-y divide-[var(--border-subtle)] rounded-[3px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
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
              className={`flex min-h-[52px] w-full items-center justify-between px-3.5 py-2.5 text-left transition-colors duration-150 ease-out ${
                active
                  ? "bg-[var(--bg-surface-2)]"
                  : "bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-2)]"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-base" aria-hidden="true">
                  {cur.flag}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold tracking-[0.06em] text-[var(--text-primary)]">
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
                <span className="flex h-5 w-5 items-center justify-center rounded-[2px] bg-[var(--accent)] text-[#F7F5F0]">
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
