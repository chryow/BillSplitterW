"use client";

import { useMemo, useState } from "react";
import {
  Camera,
  Check,
  Clock,
  Copy,
  CopyPlus,
  ExternalLink,
  Globe,
  Lock,
  LogOut,
  Receipt,
  Trash2,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { BottomSheet } from "@/components/layout/BottomSheet";
import { formatCurrency } from "@/lib/currency";
import { calculateSplit, computeSettlementSummary } from "@/lib/split-engine";
import type { SavedBillSummary } from "@/lib/types";
import { formatWhatsAppSummary } from "@/lib/whatsapp-formatter";

export interface AccountSheetProps {
  open: boolean;
  onClose: () => void;
  supabaseEnabled: boolean;
  user: {
    id: string;
    email?: string | null;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  authLoading: boolean;
  bills: SavedBillSummary[];
  billsLoading: boolean;
  onSignInGoogle: () => void;
  onSignOut: () => void;
  onOpenBill: (bill: SavedBillSummary) => void;
  onDuplicateBill: (bill: SavedBillSummary) => void;
  onDeleteBill: (billId: string) => void;
  onTogglePublic: (billId: string, nextPublic: boolean) => void;
}

export function AccountSheet({
  open,
  onClose,
  supabaseEnabled,
  user,
  authLoading,
  bills,
  billsLoading,
  onSignInGoogle,
  onSignOut,
  onOpenBill,
  onDuplicateBill,
  onDeleteBill,
  onTogglePublic,
}: AccountSheetProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const enrichedBills = useMemo(
    () =>
      bills.map((bill) => {
        const split = calculateSplit({
          currency: bill.currency,
          items: bill.items,
          tax: bill.tax,
          serviceCharge: bill.service_charge,
          discount: bill.discount,
          participants: bill.participants,
          feeSplitMode: "proportional",
        });
        const settlement = computeSettlementSummary(
          split,
          bill.paid_by_participant_id,
          bill.settled_participant_ids
        );
        const dateLabel = new Date(bill.created_at).toLocaleDateString(
          undefined,
          { month: "short", day: "numeric" }
        );
        return { bill, split, settlement, dateLabel };
      }),
    [bills]
  );

  const handleCopyWhatsApp = async (
    entry: (typeof enrichedBills)[number]
  ) => {
    const { bill, split } = entry;
    const shareUrl =
      bill.is_public && typeof window !== "undefined"
        ? `${window.location.origin}/bill/${bill.share_slug}`
        : null;
    const text = formatWhatsAppSummary({
      merchantName: bill.merchant_name,
      feeSplitMode: "proportional",
      split,
      paymentInfo: bill.payment_info,
      shareUrl,
      paidByParticipantId: bill.paid_by_participant_id,
      settledParticipantIds: bill.settled_participant_ids,
    });
    await navigator.clipboard.writeText(text);
    setCopiedId(`wa-${bill.id}`);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleCopyLink = async (bill: SavedBillSummary) => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/bill/${bill.share_slug}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(`link-${bill.id}`);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={user ? "Account & History" : "Guest Mode"}
      subtitle={
        user
          ? user.email ?? "Signed in with Google"
          : "Sign in with Google anytime to sync across devices"
      }
    >
      {!supabaseEnabled ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-4">
            <p className="text-sm font-medium text-[var(--text-primary)]">
              Running in Local Guest Mode
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
              Your active bill and payment details auto-save locally in this
              browser. Once Supabase environment variables are added to your
              deployment, Google Sign-In, cloud split history, saved friends,
              and shareable links activate automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] w-full rounded-xl bg-[var(--bg-hover)] px-4 text-sm font-medium text-[var(--text-primary)] transition-colors hover:opacity-90"
          >
            Continue in Guest Mode
          </button>
        </div>
      ) : !user ? (
        <div className="space-y-4">
          <div className="space-y-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-3.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Unlock with Google Sign-In
            </p>
            <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
              <li className="flex items-center gap-2.5">
                <Camera className="h-4 w-4 shrink-0 text-[var(--accent-text)]" />
                <span>
                  <strong className="text-[var(--text-primary)]">
                    AI Receipt Scanning
                  </strong>{" "}
                  — snap a receipt to auto-fill items, tax &amp; promos
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 shrink-0 text-[var(--accent-text)]" />
                <span>
                  <strong className="text-[var(--text-primary)]">
                    Saved Split History
                  </strong>{" "}
                  — view &amp; re-copy past bills from any device
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <Wallet className="h-4 w-4 shrink-0 text-[var(--accent-text)]" />
                <span>
                  <strong className="text-[var(--text-primary)]">
                    Synced Payment Info
                  </strong>{" "}
                  — bank or e-wallet details auto-fill everywhere
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <Users className="h-4 w-4 shrink-0 text-[var(--accent-text)]" />
                <span>
                  <strong className="text-[var(--text-primary)]">
                    Frequent Friends
                  </strong>{" "}
                  — 1-tap quick-pick chips for your regular group
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <Globe className="h-4 w-4 shrink-0 text-[var(--accent-text)]" />
                <span>
                  <strong className="text-[var(--text-primary)]">
                    Shareable Bill Links
                  </strong>{" "}
                  — clean read-only{" "}
                  <code className="font-mono">/bill/...</code> link for friends
                </span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            disabled={authLoading}
            onClick={onSignInGoogle}
            className="flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-60"
          >
            <UserCheck className="h-4 w-4" />
            <span>
              {authLoading ? "Redirecting to Google..." : "Continue with Google"}
            </span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] w-full rounded-xl text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            Keep using Guest Mode (no login required)
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-3.5 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  className="h-8 w-8 rounded-full border border-[var(--border-strong)] object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent-text)]">
                  {user.displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                  {user.displayName}
                </p>
                <p className="truncate text-[11px] text-[var(--text-muted)]">
                  Synced across devices
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-2.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Saved Split History ({bills.length})
              </h3>
            </div>

            {billsLoading ? (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-6 text-center text-xs text-[var(--text-secondary)]">
                Loading your saved splits...
              </div>
            ) : bills.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border-strong)] p-6 text-center">
                <Receipt className="mx-auto h-6 w-6 text-[var(--text-muted)]" />
                <p className="mt-2 text-xs font-medium text-[var(--text-secondary)]">
                  No saved bills yet
                </p>
                <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                  Tap &ldquo;Save&rdquo; on Step 4 to keep a bill and generate a
                  shareable link.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {enrichedBills.map((entry) => {
                  const { bill, settlement, dateLabel } = entry;
                  return (
                    <div
                      key={bill.id}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onOpenBill(bill);
                            onClose();
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--accent-text)]">
                            {bill.merchant_name || "Split Bill"}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                            <span>
                              {dateLabel} · {bill.participants.length} people ·{" "}
                              {bill.items.length} items
                            </span>
                            {settlement.collectibleCount > 0 && (
                              <span
                                className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                                  settlement.unsettledCount === 0
                                    ? "bg-[var(--accent-soft)] text-[var(--accent-text)]"
                                    : "bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                                }`}
                              >
                                {settlement.unsettledCount === 0
                                  ? "All settled ✓"
                                  : `${settlement.settledCount}/${settlement.collectibleCount} paid`}
                              </span>
                            )}
                          </div>
                        </button>
                        <span className="shrink-0 font-mono text-sm font-semibold text-[var(--text-primary)] tabular-nums">
                          {formatCurrency(bill.grand_total, bill.currency)}
                        </span>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-[var(--border-subtle)] pt-2">
                        <button
                          type="button"
                          onClick={() => handleCopyWhatsApp(entry)}
                          className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-[var(--bg-surface)] px-2.5 text-[11px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
                        >
                          {copiedId === `wa-${bill.id}` ? (
                            <Check className="h-3 w-3 text-[var(--accent-text)]" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          WhatsApp
                        </button>

                        {bill.is_public && (
                          <button
                            type="button"
                            onClick={() => handleCopyLink(bill)}
                            className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-[var(--bg-surface)] px-2.5 text-[11px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
                          >
                            {copiedId === `link-${bill.id}` ? (
                              <Check className="h-3 w-3 text-[var(--accent-text)]" />
                            ) : (
                              <ExternalLink className="h-3 w-3" />
                            )}
                            Link
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            onDuplicateBill(bill);
                            onClose();
                          }}
                          title="Reuse merchant & group for a new split"
                          className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-[var(--bg-surface)] px-2 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                        >
                          <CopyPlus className="h-3 w-3" />
                          Reuse
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onTogglePublic(bill.id, !bill.is_public)
                          }
                          title={
                            bill.is_public
                              ? "Public link active — click to make private"
                              : "Private — click to enable public link"
                          }
                          className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-[var(--bg-surface)] px-2 text-[11px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
                        >
                          {bill.is_public ? (
                            <>
                              <Globe className="h-3 w-3 text-[var(--accent-text)]" />
                              Public
                            </>
                          ) : (
                            <>
                              <Lock className="h-3 w-3" />
                              Private
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteBill(bill.id)}
                          aria-label="Delete saved bill"
                          className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
