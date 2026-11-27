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
          deliveryFee: bill.delivery_fee,
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
      title={user ? "Account & Ledger Archive" : "Guest Mode"}
      subtitle={
        user
          ? user.email ?? "Signed in with Google"
          : "Sign in with Google anytime to sync across devices"
      }
    >
      {!supabaseEnabled ? (
        <div className="space-y-3">
          <div className="rounded-[3px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <p className="font-editorial text-base font-semibold text-[var(--text-primary)]">
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
            className="min-h-[42px] w-full rounded-[3px] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 font-mono text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-primary)] transition-colors duration-150 ease-out hover:bg-[var(--ink-solid)] hover:text-[var(--ink-on-solid)]"
          >
            Continue in Guest Mode
          </button>
        </div>
      ) : !user ? (
        <div className="space-y-4">
          <div className="rounded-[3px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <p className="micro-label text-[var(--text-muted)]">
              Unlock with Google Sign-In
            </p>
            <ul className="mt-3 divide-y divide-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
              <li className="flex items-start gap-2.5 py-2 first:pt-0">
                <Camera className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" />
                <span>
                  <strong className="text-[var(--text-primary)]">
                    AI Receipt Scanning
                  </strong>{" "}
                  — snap a receipt to auto-fill items, tax &amp; promos
                </span>
              </li>
              <li className="flex items-start gap-2.5 py-2">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-primary)]" />
                <span>
                  <strong className="text-[var(--text-primary)]">
                    Saved Split History
                  </strong>{" "}
                  — view &amp; re-copy past bills from any device
                </span>
              </li>
              <li className="flex items-start gap-2.5 py-2">
                <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-primary)]" />
                <span>
                  <strong className="text-[var(--text-primary)]">
                    Synced Payment Info
                  </strong>{" "}
                  — bank or e-wallet details auto-fill everywhere
                </span>
              </li>
              <li className="flex items-start gap-2.5 py-2">
                <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-primary)]" />
                <span>
                  <strong className="text-[var(--text-primary)]">
                    Frequent Friends
                  </strong>{" "}
                  — 1-tap quick-pick tags for your regular group
                </span>
              </li>
              <li className="flex items-start gap-2.5 py-2 last:pb-0">
                <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-primary)]" />
                <span>
                  <strong className="text-[var(--text-primary)]">
                    Shareable Bill Links
                  </strong>{" "}
                  — clean read-only{" "}
                  <code className="font-mono text-[11px]">/bill/...</code> link
                  for friends
                </span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            disabled={authLoading}
            onClick={onSignInGoogle}
            className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[3px] border border-[var(--border-strong)] bg-[var(--accent)] px-4 font-mono text-xs font-semibold uppercase tracking-[0.06em] text-[#F7F5F0] transition-colors duration-150 ease-out hover:bg-[var(--accent-hover)] disabled:opacity-60"
          >
            <UserCheck className="h-4 w-4" />
            <span>
              {authLoading ? "Redirecting to Google..." : "Continue with Google"}
            </span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] w-full rounded-[3px] font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--text-secondary)] transition-colors duration-150 ease-out hover:text-[var(--text-primary)]"
          >
            Keep using Guest Mode (no login required)
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-[3px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  className="h-8 w-8 rounded-[2px] border border-[var(--border-strong)] object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-[2px] border border-[var(--border-strong)] bg-[var(--bg-surface-2)] font-mono text-xs font-bold text-[var(--text-primary)]">
                  {user.displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                  {user.displayName}
                </p>
                <p className="micro-label mt-0.5 text-[var(--success-text)]">
                  Synced across devices
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="flex min-h-[32px] items-center gap-1.5 rounded-[3px] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-primary)] transition-colors duration-150 ease-out hover:bg-[var(--ink-solid)] hover:text-[var(--ink-on-solid)]"
            >
              <LogOut className="h-3 w-3" />
              Sign out
            </button>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="micro-label text-[var(--text-muted)]">
                Saved Split History ({bills.length})
              </h3>
            </div>

            {billsLoading ? (
              <div className="rounded-[3px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 text-center font-mono text-xs text-[var(--text-secondary)]">
                Loading your saved splits...
              </div>
            ) : bills.length === 0 ? (
              <div className="rounded-[3px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 text-center">
                <Receipt className="mx-auto h-5 w-5 text-[var(--text-muted)]" />
                <p className="mt-2 font-editorial text-sm font-semibold text-[var(--text-primary)]">
                  No saved bills yet
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Tap &ldquo;Save&rdquo; on Step 4 to keep a bill and generate a
                  shareable link.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)] rounded-[3px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                {enrichedBills.map((entry) => {
                  const { bill, settlement, dateLabel } = entry;
                  return (
                    <div key={bill.id} className="p-3">
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
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-muted)]">
                            <span>
                              {dateLabel} &middot; {bill.participants.length}{" "}
                              people &middot; {bill.items.length} items
                            </span>
                            {settlement.collectibleCount > 0 && (
                              <span
                                className={`rounded-[2px] border px-1.5 py-0.5 text-[9px] font-semibold ${
                                  settlement.unsettledCount === 0
                                    ? "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success-text)]"
                                    : "border-[var(--border-subtle)] bg-[var(--bg-surface-2)] text-[var(--text-secondary)]"
                                }`}
                              >
                                {settlement.unsettledCount === 0
                                  ? "All settled"
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
                          className="inline-flex min-h-[28px] items-center gap-1 rounded-[2px] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--text-primary)] transition-colors duration-150 ease-out hover:border-[var(--border-strong)]"
                        >
                          {copiedId === `wa-${bill.id}` ? (
                            <Check className="h-3 w-3 text-[var(--success-text)]" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          WhatsApp
                        </button>

                        {bill.is_public && (
                          <button
                            type="button"
                            onClick={() => handleCopyLink(bill)}
                            className="inline-flex min-h-[28px] items-center gap-1 rounded-[2px] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--text-primary)] transition-colors duration-150 ease-out hover:border-[var(--border-strong)]"
                          >
                            {copiedId === `link-${bill.id}` ? (
                              <Check className="h-3 w-3 text-[var(--success-text)]" />
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
                          className="inline-flex min-h-[28px] items-center gap-1 rounded-[2px] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--text-secondary)] transition-colors duration-150 ease-out hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
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
                          className="inline-flex min-h-[28px] items-center gap-1 rounded-[2px] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2 font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--text-secondary)] transition-colors duration-150 ease-out hover:border-[var(--border-strong)]"
                        >
                          {bill.is_public ? (
                            <>
                              <Globe className="h-3 w-3 text-[var(--success-text)]" />
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
                          className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-[2px] text-[var(--text-muted)] transition-colors duration-150 ease-out hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)]"
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
