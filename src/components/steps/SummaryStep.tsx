"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  CloudCheck,
  Copy,
  Globe,
  Link2,
  Loader2,
  RotateCcw,
  Save,
  UserCheck,
  Wallet,
} from "lucide-react";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { formatCurrency } from "@/lib/currency";
import { calculateSplit } from "@/lib/split-engine";
import type { BillState, PaymentInfo } from "@/lib/types";
import {
  formatWhatsAppSummary,
  hasPaymentInfo,
} from "@/lib/whatsapp-formatter";

interface SummaryStepProps {
  bill: BillState;
  paymentInfo: PaymentInfo;
  isSignedIn: boolean;
  supabaseEnabled: boolean;
  savingBill: boolean;
  onPaymentInfoChange: (next: PaymentInfo) => void;
  onSaveBillToCloud: () => void;
  onOpenAccount: () => void;
  onBackToAssign: () => void;
  onNewSplit: () => void;
}

export function SummaryStep({
  bill,
  paymentInfo,
  isSignedIn,
  supabaseEnabled,
  savingBill,
  onPaymentInfoChange,
  onSaveBillToCloud,
  onOpenAccount,
  onBackToAssign,
  onNewSplit,
}: SummaryStepProps) {
  const [paymentOpen, setPaymentOpen] = useState(hasPaymentInfo(paymentInfo));
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const cur = bill.currency;
  const split = calculateSplit({
    currency: bill.currency,
    items: bill.items,
    tax: bill.tax,
    serviceCharge: bill.serviceCharge,
    discount: bill.discount,
    participants: bill.participants,
    feeSplitMode: bill.feeSplitMode,
  });

  const shareUrl =
    bill.shareSlug && bill.isPublic && typeof window !== "undefined"
      ? `${window.location.origin}/bill/${bill.shareSlug}`
      : null;

  const handleCopyWhatsApp = async () => {
    const text = formatWhatsAppSummary({
      merchantName: bill.merchantName,
      feeSplitMode: bill.feeSplitMode,
      split,
      paymentInfo,
      shareUrl,
    });
    await navigator.clipboard.writeText(text);
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 2200);
  };

  const handleCopyShareLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  return (
    <section className="space-y-4 pt-3 pb-28">
      {/* Bill Grand Total Overview */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Final Split
            </p>
            <h1 className="mt-0.5 truncate text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              {bill.merchantName.trim() || "Split Bill"}
            </h1>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] text-[var(--text-muted)]">Grand Total</p>
            <p className="font-mono text-lg font-semibold text-[var(--accent-text)] tabular-nums">
              {formatCurrency(split.grandTotal, cur)}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--border-subtle)] pt-2.5 text-[11px] text-[var(--text-secondary)]">
          <span>
            Items:{" "}
            <strong className="font-mono text-[var(--text-primary)] tabular-nums">
              {formatCurrency(split.itemsSubtotal, cur)}
            </strong>
          </span>
          {split.tax > 0 && (
            <span>
              Tax:{" "}
              <strong className="font-mono text-[var(--text-primary)] tabular-nums">
                {formatCurrency(split.tax, cur)}
              </strong>
            </span>
          )}
          {split.serviceCharge > 0 && (
            <span>
              Svc:{" "}
              <strong className="font-mono text-[var(--text-primary)] tabular-nums">
                {formatCurrency(split.serviceCharge, cur)}
              </strong>
            </span>
          )}
          {split.discount > 0 && (
            <span>
              Disc:{" "}
              <strong className="font-mono text-[var(--accent-text)] tabular-nums">
                -{formatCurrency(split.discount, cur)}
              </strong>
            </span>
          )}
          <span className="ml-auto capitalize text-[var(--text-muted)]">
            {bill.feeSplitMode} fees
          </span>
        </div>
      </div>

      {/* Unassigned items warning */}
      {split.unassignedItemIds.length > 0 && (
        <StatusBanner
          variant="warning"
          title={`${split.unassignedItemIds.length} unassigned item${split.unassignedItemIds.length > 1 ? "s" : ""}`}
          message={`${formatCurrency(split.unassignedSubtotal, cur)} isn't assigned to anyone yet.`}
          actionLabel="Go back & assign"
          onAction={onBackToAssign}
        />
      )}

      {/* Per-Person Breakdown Cards */}
      <div className="space-y-2.5">
        {split.people.map((person) => (
          <article
            key={person.participantId}
            className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: person.color }}
                />
                <h2 className="truncate text-sm font-semibold text-[var(--text-primary)]">
                  {person.name}
                </h2>
              </div>
              <span className="shrink-0 font-mono text-base font-bold text-[var(--text-primary)] tabular-nums">
                {formatCurrency(person.total, cur)}
              </span>
            </div>

            {person.items.length > 0 ? (
              <ul className="mt-2.5 space-y-1 border-t border-[var(--border-subtle)] pt-2.5 text-xs">
                {person.items.map((item, idx) => (
                  <li
                    key={`${item.itemId}-${idx}`}
                    className="flex items-center justify-between gap-2 text-[var(--text-secondary)]"
                  >
                    <span className="min-w-0 truncate">
                      {item.qty > 1 ? `${item.qty}x ` : ""}
                      {item.name || "Item"}
                      {item.shareCount > 1 && (
                        <span className="ml-1 rounded bg-[var(--bg-surface-2)] px-1 py-0.5 font-mono text-[10px] text-[var(--text-muted)]">
                          ÷{item.shareCount}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-mono tabular-nums text-[var(--text-primary)]">
                      {formatCurrency(item.amount, cur)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 border-t border-[var(--border-subtle)] pt-2 text-xs text-[var(--text-muted)]">
                No items assigned
              </p>
            )}

            {(person.taxShare > 0 ||
              person.serviceShare > 0 ||
              person.discountShare > 0) && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--border-subtle)] pt-2 text-[11px] text-[var(--text-muted)]">
                {person.taxShare > 0 && (
                  <span className="font-mono tabular-nums">
                    Tax +{formatCurrency(person.taxShare, cur)}
                  </span>
                )}
                {person.serviceShare > 0 && (
                  <span className="font-mono tabular-nums">
                    Svc +{formatCurrency(person.serviceShare, cur)}
                  </span>
                )}
                {person.discountShare > 0 && (
                  <span className="font-mono tabular-nums text-[var(--accent-text)]">
                    Disc -{formatCurrency(person.discountShare, cur)}
                  </span>
                )}
              </div>
            )}
          </article>
        ))}

        {/* Exact Sum Reconciliation Strip */}
        <div className="flex items-center justify-between px-1 text-[11px] text-[var(--text-muted)]">
          <span>Sum of individual totals</span>
          <span className="font-mono font-semibold text-[var(--text-secondary)] tabular-nums">
            {formatCurrency(split.sumOfPeopleTotals, cur)}
            {split.unassignedItemIds.length === 0 &&
              split.sumOfPeopleTotals === split.grandTotal &&
              " · Exact match ✓"}
          </span>
        </div>
      </div>

      {/* Collapsible Payment Info Panel */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
        <button
          type="button"
          onClick={() => setPaymentOpen((prev) => !prev)}
          className="flex min-h-[52px] w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-[var(--bg-surface-2)]"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <Wallet className="h-4 w-4 shrink-0 text-[var(--accent-text)]" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--text-primary)]">
                Payment Info
                <span className="ml-1.5 font-normal text-[var(--text-muted)]">
                  (included in WhatsApp summary)
                </span>
              </p>
              {!paymentOpen && hasPaymentInfo(paymentInfo) && (
                <p className="truncate text-[11px] text-[var(--text-secondary)]">
                  {[paymentInfo.provider, paymentInfo.accountNumber]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          </div>
          {paymentOpen ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
          )}
        </button>

        {paymentOpen && (
          <div className="space-y-2.5 border-t border-[var(--border-subtle)] px-4 py-3.5">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <label className="block">
                <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                  Bank / E-Wallet
                </span>
                <input
                  type="text"
                  value={paymentInfo.provider}
                  onChange={(e) =>
                    onPaymentInfoChange({
                      ...paymentInfo,
                      provider: e.target.value,
                    })
                  }
                  placeholder="e.g. BCA, GoPay, PayNow"
                  className="mt-1 h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                  Account / Phone Number
                </span>
                <input
                  type="text"
                  value={paymentInfo.accountNumber}
                  onChange={(e) =>
                    onPaymentInfoChange({
                      ...paymentInfo,
                      accountNumber: e.target.value,
                    })
                  }
                  placeholder="e.g. 1234567890"
                  className="mt-1 h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2.5 font-mono text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <label className="block">
                <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                  Account Name
                </span>
                <input
                  type="text"
                  value={paymentInfo.accountName}
                  onChange={(e) =>
                    onPaymentInfoChange({
                      ...paymentInfo,
                      accountName: e.target.value,
                    })
                  }
                  placeholder="e.g. Budi Santoso"
                  className="mt-1 h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                  Note (optional)
                </span>
                <input
                  type="text"
                  value={paymentInfo.note}
                  onChange={(e) =>
                    onPaymentInfoChange({
                      ...paymentInfo,
                      note: e.target.value,
                    })
                  }
                  placeholder="e.g. Thanks!"
                  className="mt-1 h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                />
              </label>
            </div>

            <p className="text-[11px] text-[var(--text-muted)]">
              {isSignedIn
                ? "Auto-saved locally & synced to your Google account for future bills."
                : "Auto-saved in this browser so it pre-fills on future bills."}
            </p>
          </div>
        )}
      </div>

      {/* Save to History & Shareable Link (Login Mode / Guest Nudge) */}
      {supabaseEnabled && (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5">
          {isSignedIn ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {bill.savedBillId ? (
                    <CloudCheck className="h-4 w-4 text-[var(--accent-text)]" />
                  ) : (
                    <Globe className="h-4 w-4 text-[var(--text-secondary)]" />
                  )}
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    {bill.savedBillId
                      ? "Saved to your history"
                      : "Save bill & create share link"}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={savingBill}
                  onClick={onSaveBillToCloud}
                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-[var(--bg-surface-2)] px-3 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-60"
                >
                  {savingBill ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  {bill.savedBillId ? "Update" : "Save"}
                </button>
              </div>

              {shareUrl && (
                <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-3 py-2">
                  <Link2 className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" />
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--text-secondary)]">
                    {shareUrl}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg bg-[var(--bg-surface)] px-2.5 text-[11px] font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="h-3 w-3 text-[var(--accent-text)]" />
                        Copied
                      </>
                    ) : (
                      "Copy Link"
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  Want a shareable link &amp; cloud history?
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Sign in with Google to save bills &amp; sync payment info.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenAccount}
                className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-2)] px-3 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
              >
                <UserCheck className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                Sign in
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sticky Bottom Action Bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border-subtle)] bg-[var(--bg-app)]/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-md items-center gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onBackToAssign}
            aria-label="Back to Assign"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleCopyWhatsApp}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] active:scale-[0.99]"
          >
            {copiedWhatsApp ? (
              <>
                <Check className="h-4 w-4" />
                <span>Copied for WhatsApp!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy WhatsApp Summary</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onNewSplit}
            title="Start a new bill"
            aria-label="Start a new split"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
