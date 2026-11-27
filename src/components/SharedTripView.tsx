"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  ImageDown,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { ColophonFooter } from "@/components/layout/ColophonFooter";
import { formatCurrency } from "@/lib/currency";
import { calculateTrip } from "@/lib/trip-engine";
import {
  formatTripWhatsAppSummary,
  shareOrDownloadTripCardImage,
} from "@/lib/trip-formatter";
import type { Trip } from "@/lib/types";
import {
  buildWhatsAppShareUrl,
  hasPaymentInfo,
} from "@/lib/whatsapp-formatter";

export function SharedTripView({ trip }: { trip: Trip }) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);
  const [exportingImage, setExportingImage] = useState(false);

  const cur = trip.currency;
  const calc = useMemo(
    () =>
      calculateTrip({
        currency: trip.currency,
        members: trip.members,
        expenses: trip.expenses,
      }),
    [trip.currency, trip.members, trip.expenses]
  );

  const memberById = useMemo(
    () => new Map(trip.members.map((m) => [m.id, m])),
    [trip.members]
  );
  const settledSet = useMemo(
    () => new Set(trip.settledTransferKeys),
    [trip.settledTransferKeys]
  );

  const markCopied = (key: string) => {
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000);
  };

  const buildSummaryText = () =>
    formatTripWhatsAppSummary({
      trip,
      calc,
      shareUrl: typeof window !== "undefined" ? window.location.href : null,
    });

  const handleCopySummary = async () => {
    await navigator.clipboard.writeText(buildSummaryText());
    markCopied("summary");
  };

  const handleOpenWhatsApp = () => {
    window.open(
      buildWhatsAppShareUrl(buildSummaryText()),
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleSaveImage = async () => {
    setExportingImage(true);
    try {
      await shareOrDownloadTripCardImage({ trip, calc });
    } finally {
      setExportingImage(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--bg-app)] text-[var(--text-primary)]">
      <header className="sticky top-0 z-20 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-2)]">
        <div className="mx-auto flex h-14 w-full max-w-lg items-center justify-between px-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-[var(--text-primary)]"
          >
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 shrink-0 bg-[var(--accent)]"
            />
            <span className="font-editorial text-[19px] font-semibold tracking-tight">
              BillSplitterW
            </span>
          </Link>

          <Link
            href="/"
            className="rounded-[3px] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-primary)] transition-colors duration-150 ease-out hover:bg-[var(--ink-solid)] hover:text-[var(--ink-on-solid)]"
          >
            Start Your Own
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 space-y-4 px-4 pt-4 pb-6">
        {/* Trip Summary Header */}
        <div className="rounded-[3px] border border-[var(--border-strong)] bg-[var(--bg-surface)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="micro-label text-[var(--text-muted)]">
                Shared Trip &middot; {trip.expenses.length} bill
                {trip.expenses.length === 1 ? "" : "s"}
              </p>
              <h1 className="font-editorial mt-0.5 truncate text-xl font-semibold tracking-tight">
                {trip.name}
              </h1>
            </div>
            <div className="shrink-0 text-right">
              <p className="micro-label text-[var(--text-muted)]">
                Total Spend
              </p>
              <p className="mt-0.5 font-mono text-lg font-bold text-[var(--accent-text)] tabular-nums">
                {formatCurrency(calc.totalSpend, cur)}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--border-subtle)] pt-2.5">
            {trip.members.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1 rounded-[2px] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-primary)]"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: m.color }}
                />
                {m.name}
              </span>
            ))}
          </div>
        </div>

        {/* Settle Up Transfers */}
        <div className="space-y-2.5">
          <h2 className="micro-label px-0.5 font-semibold text-[var(--text-muted)]">
            Settle Up ({calc.transfers.length} transfer
            {calc.transfers.length === 1 ? "" : "s"})
          </h2>

          {calc.transfers.length === 0 ? (
            <div className="rounded-[3px] border border-[var(--success-border)] bg-[var(--success-soft)] p-4 text-center font-mono text-xs font-semibold uppercase tracking-[0.06em] text-[var(--success-text)]">
              Everyone is settled up ✓
            </div>
          ) : (
            calc.transfers.map((transfer) => {
              const settled = settledSet.has(transfer.key);
              const pay = transfer.toPaymentInfo;
              return (
                <article
                  key={transfer.key}
                  className={`rounded-[3px] border bg-[var(--bg-surface)] p-3.5 ${
                    settled
                      ? "border-[var(--success-border)] bg-[var(--bg-surface-2)]/40"
                      : "border-[var(--border-subtle)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: transfer.fromColor }}
                      />
                      <span className="truncate">{transfer.fromName}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: transfer.toColor }}
                      />
                      <span className="truncate">{transfer.toName}</span>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {settled && (
                        <span className="inline-flex items-center gap-0.5 rounded-[2px] border border-[var(--success-border)] bg-[var(--success-soft)] px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.06em] text-[var(--success-text)]">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          Paid
                        </span>
                      )}
                      <span
                        className={`font-mono text-base font-bold tabular-nums ${
                          settled
                            ? "text-[var(--text-muted)] line-through"
                            : "text-[var(--accent-text)]"
                        }`}
                      >
                        {formatCurrency(transfer.amount, cur)}
                      </span>
                    </div>
                  </div>

                  {hasPaymentInfo(pay) && pay && (
                    <div className="mt-2.5 flex items-center justify-between gap-2 rounded-[2px] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs font-semibold text-[var(--text-primary)]">
                          {[pay.provider, pay.accountNumber]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {pay.accountName && (
                          <p className="truncate text-[11px] text-[var(--text-muted)]">
                            a/n {pay.accountName}
                          </p>
                        )}
                      </div>
                      {pay.accountNumber.trim() && (
                        <button
                          type="button"
                          onClick={async () => {
                            await navigator.clipboard.writeText(
                              pay.accountNumber.trim()
                            );
                            markCopied(`acct-${transfer.key}`);
                          }}
                          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[2px] border border-[var(--border-strong)] bg-[var(--ink-solid)] px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-on-solid)] transition-colors duration-150 ease-out hover:bg-[var(--ink-solid-hover)]"
                        >
                          {copiedKey === `acct-${transfer.key}` ? (
                            <>
                              <Check className="h-3 w-3" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              Copy
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>

        {/* Member Balances */}
        <div className="space-y-2">
          <h2 className="micro-label px-0.5 font-semibold text-[var(--text-muted)]">
            Balances
          </h2>
          <div className="divide-y divide-[var(--border-subtle)] rounded-[3px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            {calc.balances.map((bal) => (
              <div
                key={bal.memberId}
                className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: bal.color }}
                    />
                    <span className="font-semibold text-[var(--text-primary)]">
                      {bal.name}
                    </span>
                  </div>
                  <p className="mt-0.5 pl-4 font-mono text-[10px] text-[var(--text-muted)]">
                    PAID {formatCurrency(bal.totalPaid, cur)} &middot; SHARE{" "}
                    {formatCurrency(bal.totalShare, cur)}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-mono font-bold tabular-nums ${
                    bal.netBalance > 0
                      ? "text-[var(--success-text)]"
                      : bal.netBalance < 0
                        ? "text-[var(--accent-text)]"
                        : "text-[var(--text-muted)]"
                  }`}
                >
                  {bal.netBalance > 0
                    ? `+${formatCurrency(bal.netBalance, cur)}`
                    : formatCurrency(bal.netBalance, cur)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Expandable Bills List */}
        <div className="space-y-2">
          <h2 className="micro-label px-0.5 font-semibold text-[var(--text-muted)]">
            All Bills ({trip.expenses.length})
          </h2>
          <div className="divide-y divide-[var(--border-subtle)] rounded-[3px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            {trip.expenses.map((expense) => {
              const summary = calc.expenseSummaries[expense.id];
              const payer = memberById.get(expense.paidByMemberId);
              const isOpen = expandedBillId === expense.id;
              const shares = Object.entries(summary?.sharesByMemberId ?? {});

              return (
                <div key={expense.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedBillId(isOpen ? null : expense.id)
                    }
                    className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors duration-150 ease-out hover:bg-[var(--bg-surface-2)]/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {expense.title}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-[var(--text-muted)]">
                        Paid by {payer?.name ?? "Unknown"} &middot;{" "}
                        {expense.date}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-mono text-sm font-bold tabular-nums">
                        {formatCurrency(summary?.total ?? expense.amount, cur)}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="space-y-2 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-2)]/60 px-3.5 py-2.5 text-xs">
                      {expense.mode === "itemized" &&
                        expense.items &&
                        expense.items.length > 0 && (
                          <ul className="space-y-1 border-b border-[var(--border-subtle)] pb-2">
                            {expense.items.map((item) => (
                              <li
                                key={item.id}
                                className="flex items-center justify-between text-[var(--text-secondary)]"
                              >
                                <span className="truncate">
                                  {item.qty > 1 ? `${item.qty}x ` : ""}
                                  {item.name}
                                </span>
                                <span className="font-mono tabular-nums text-[var(--text-primary)]">
                                  {formatCurrency(item.totalPrice, cur)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}

                      <div className="space-y-1">
                        {shares.map(([memberId, amt]) => (
                          <div
                            key={memberId}
                            className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]"
                          >
                            <span>{memberById.get(memberId)?.name}</span>
                            <span className="font-mono font-semibold text-[var(--text-primary)] tabular-nums">
                              {formatCurrency(amt, cur)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <ColophonFooter withBottomBarOffset />

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border-strong)] bg-[var(--bg-app)]">
        <div className="mx-auto flex w-full max-w-lg items-center gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handleCopySummary}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[3px] border border-[var(--border-strong)] bg-[var(--accent)] px-4 font-mono text-xs font-semibold uppercase tracking-[0.06em] text-[#F7F5F0] transition-colors duration-150 ease-out hover:bg-[var(--accent-hover)]"
          >
            {copiedKey === "summary" ? (
              <>
                <Check className="h-4 w-4" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy Summary</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={exportingImage}
            onClick={handleSaveImage}
            aria-label="Save PNG card"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[3px] border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] transition-colors duration-150 ease-out hover:bg-[var(--ink-solid)] hover:text-[var(--ink-on-solid)] disabled:opacity-50"
          >
            {exportingImage ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImageDown className="h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-[3px] border border-[var(--success)] bg-[var(--success-soft)] px-3.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--success-text)] transition-colors duration-150 ease-out hover:bg-[var(--success)] hover:text-[#F7F5F0]"
          >
            <MessageCircle className="h-4 w-4" />
            <span>WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
}
