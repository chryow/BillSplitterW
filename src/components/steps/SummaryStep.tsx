"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  CloudCheck,
  Compass,
  Copy,
  Globe,
  ImageDown,
  Link2,
  Loader2,
  MessageCircle,
  RotateCcw,
  Save,
  Send,
  UserCheck,
  Wallet,
} from "lucide-react";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { formatCurrency } from "@/lib/currency";
import { shareOrDownloadSplitImage } from "@/lib/split-card-image";
import {
  applyFriendlyRounding,
  calculateSplit,
  computeSettlementSummary,
  getRoundingOptions,
} from "@/lib/split-engine";
import type { BillState, PaymentInfo, PersonSplit } from "@/lib/types";
import {
  buildWhatsAppShareUrl,
  formatPersonNudge,
  formatWhatsAppSummary,
  hasPaymentInfo,
} from "@/lib/whatsapp-formatter";

interface SummaryStepProps {
  bill: BillState;
  paymentInfo: PaymentInfo;
  isSignedIn: boolean;
  supabaseEnabled: boolean;
  savingBill: boolean;
  availableTrips?: { id: string; name: string }[];
  onAddBillToTrip?: (tripId: string) => void;
  onPaymentInfoChange: (next: PaymentInfo) => void;
  onChangePaidBy: (participantId: string) => void;
  onToggleSettled: (participantId: string) => void;
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
  availableTrips = [],
  onAddBillToTrip,
  onPaymentInfoChange,
  onChangePaidBy,
  onToggleSettled,
  onSaveBillToCloud,
  onOpenAccount,
  onBackToAssign,
  onNewSplit,
}: SummaryStepProps) {
  const [paymentOpen, setPaymentOpen] = useState(hasPaymentInfo(paymentInfo));
  const [roundingStep, setRoundingStep] = useState<number>(0);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPersonId, setCopiedPersonId] = useState<string | null>(null);
  const [exportingImage, setExportingImage] = useState(false);

  const cur = bill.currency;
  const roundingOptions = useMemo(() => getRoundingOptions(cur), [cur]);
  const activeRoundingStep = roundingOptions.some((o) => o.step === roundingStep)
    ? roundingStep
    : 0;

  const baseSplit = useMemo(
    () =>
      calculateSplit({
        currency: bill.currency,
        items: bill.items,
        tax: bill.tax,
        serviceCharge: bill.serviceCharge,
        deliveryFee: bill.deliveryFee,
        discount: bill.discount,
        participants: bill.participants,
        feeSplitMode: "proportional",
      }),
    [
      bill.currency,
      bill.items,
      bill.tax,
      bill.serviceCharge,
      bill.deliveryFee,
      bill.discount,
      bill.participants,
    ]
  );

  const { split, roundingSurplus } = useMemo(
    () => applyFriendlyRounding(baseSplit, activeRoundingStep),
    [baseSplit, activeRoundingStep]
  );

  const settlement = useMemo(
    () =>
      computeSettlementSummary(
        split,
        bill.paidByParticipantId,
        bill.settledParticipantIds
      ),
    [split, bill.paidByParticipantId, bill.settledParticipantIds]
  );

  const settledSet = useMemo(
    () => new Set(bill.settledParticipantIds),
    [bill.settledParticipantIds]
  );

  const shareUrl =
    bill.shareSlug && bill.isPublic && typeof window !== "undefined"
      ? `${window.location.origin}/bill/${bill.shareSlug}`
      : null;

  const buildSummaryText = () =>
    formatWhatsAppSummary({
      merchantName: bill.merchantName,
      feeSplitMode: "proportional",
      split,
      paymentInfo,
      shareUrl,
      paidByParticipantId: bill.paidByParticipantId,
      settledParticipantIds: bill.settledParticipantIds,
      roundingStep: activeRoundingStep,
      roundingSurplus,
    });

  const handleCopyWhatsApp = async () => {
    await navigator.clipboard.writeText(buildSummaryText());
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 2200);
  };

  const handleOpenWhatsApp = () => {
    const url = buildWhatsAppShareUrl(buildSummaryText());
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleSaveCardImage = async () => {
    setExportingImage(true);
    try {
      await shareOrDownloadSplitImage({
        merchantName: bill.merchantName,
        split,
        paidByParticipantId: bill.paidByParticipantId,
        settledParticipantIds: bill.settledParticipantIds,
        paymentInfo,
        roundingStep: activeRoundingStep,
        dateLabel: new Date().toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
      });
    } finally {
      setExportingImage(false);
    }
  };

  const handleCopyPersonNudge = async (person: PersonSplit) => {
    const text = formatPersonNudge({
      merchantName: bill.merchantName,
      person,
      currency: cur,
      payerName: settlement.payerName,
      paymentInfo,
      shareUrl,
    });
    await navigator.clipboard.writeText(text);
    setCopiedPersonId(person.participantId);
    setTimeout(() => setCopiedPersonId(null), 1800);
  };

  const handleWhatsAppPersonNudge = (person: PersonSplit) => {
    const text = formatPersonNudge({
      merchantName: bill.merchantName,
      person,
      currency: cur,
      payerName: settlement.payerName,
      paymentInfo,
      shareUrl,
    });
    window.open(buildWhatsAppShareUrl(text), "_blank", "noopener,noreferrer");
  };

  const handleCopyShareLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  return (
    <section className="space-y-4 pt-3 pb-28">
      {/* Bill Grand Total + Settlement Progress + Round-Up Selector */}
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
          {split.deliveryFee > 0 && (
            <span>
              Delivery:{" "}
              <strong className="font-mono text-[var(--text-primary)] tabular-nums">
                {formatCurrency(split.deliveryFee, cur)}
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
        </div>

        {/* Friendly Round-Up Pills + Save PNG Card */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-[var(--text-muted)]">
              Round up:
            </span>
            <div className="inline-flex rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-0.5">
              {roundingOptions.map((opt) => {
                const active = activeRoundingStep === opt.step;
                return (
                  <button
                    key={opt.step}
                    type="button"
                    onClick={() => setRoundingStep(opt.step)}
                    className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold transition-colors ${
                      active
                        ? "bg-[var(--accent)] text-white"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            disabled={exportingImage}
            onClick={handleSaveCardImage}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2.5 text-[11px] font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50"
          >
            {exportingImage ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ImageDown className="h-3 w-3 text-[var(--accent-text)]" />
            )}
            Save Card
          </button>
        </div>

        {/* Who Paid + Settlement Progress Strip */}
        {bill.participants.length > 1 && (
          <div className="mt-3 space-y-2 border-t border-[var(--border-subtle)] pt-2.5">
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-[11px] font-medium text-[var(--text-muted)]">
                Paid by:
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {bill.participants.map((person) => {
                  const isPayer = bill.paidByParticipantId === person.id;
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => onChangePaidBy(person.id)}
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                        isPayer
                          ? "border-[var(--accent)]/50 bg-[var(--accent-soft)] text-[var(--accent-text)]"
                          : "border-[var(--border-subtle)] bg-[var(--bg-surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: person.color }}
                      />
                      {person.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {settlement.collectibleCount > 0 && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--text-secondary)]">
                  {settlement.unsettledCount === 0 ? (
                    <span className="font-semibold text-[var(--accent-text)]">
                      All settled ✓
                    </span>
                  ) : (
                    <>
                      Remaining
                      {settlement.payerName ? ` to ${settlement.payerName}` : ""}:{" "}
                      <strong className="font-mono text-[var(--text-primary)] tabular-nums">
                        {formatCurrency(settlement.totalRemaining, cur)}
                      </strong>
                    </>
                  )}
                </span>
                <span className="font-mono text-[var(--text-muted)] tabular-nums">
                  {settlement.settledCount}/{settlement.collectibleCount} paid
                </span>
              </div>
            )}
          </div>
        )}
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

      {/* Per-Person Breakdown Cards with Paid/Unpaid + Individual Nudge */}
      <div className="space-y-2.5">
        {split.people.map((person) => {
          const isPayer = bill.paidByParticipantId === person.participantId;
          const isSettled = !isPayer && settledSet.has(person.participantId);
          const showSettleButton = !isPayer && person.total > 0;

          return (
            <article
              key={person.participantId}
              className={`rounded-2xl border p-3.5 transition-colors ${
                isSettled
                  ? "border-[var(--accent)]/35 bg-[var(--bg-surface)]/80"
                  : "border-[var(--border-subtle)] bg-[var(--bg-surface)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: person.color }}
                  />
                  <h2 className="truncate text-sm font-semibold text-[var(--text-primary)]">
                    {person.name}
                  </h2>
                  {isPayer && (
                    <span className="shrink-0 rounded-full bg-[var(--bg-surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                      Paid bill
                    </span>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={`font-mono text-base font-bold tabular-nums ${
                      isSettled
                        ? "text-[var(--text-muted)] line-through"
                        : "text-[var(--text-primary)]"
                    }`}
                  >
                    {formatCurrency(person.total, cur)}
                  </span>

                  {showSettleButton && (
                    <button
                      type="button"
                      onClick={() => onToggleSettled(person.participantId)}
                      aria-pressed={isSettled}
                      aria-label={
                        isSettled
                          ? `Mark ${person.name} as unpaid`
                          : `Mark ${person.name} as paid`
                      }
                      className={`inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold transition-colors ${
                        isSettled
                          ? "border-[var(--accent)]/45 bg-[var(--accent-soft)] text-[var(--accent-text)]"
                          : "border-[var(--border-subtle)] bg-[var(--bg-surface-2)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {isSettled ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Paid
                        </>
                      ) : (
                        <>
                          <Circle className="h-3.5 w-3.5" />
                          Unpaid
                        </>
                      )}
                    </button>
                  )}
                </div>
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
                        {item.isCustomShare ? (
                          <span className="ml-1 rounded bg-[var(--accent-soft)] px-1 py-0.5 font-mono text-[10px] text-[var(--accent-text)]">
                            {item.shareWeight}/{item.totalShares}
                          </span>
                        ) : item.shareCount > 1 ? (
                          <span className="ml-1 rounded bg-[var(--bg-surface-2)] px-1 py-0.5 font-mono text-[10px] text-[var(--text-muted)]">
                            ÷{item.shareCount}
                          </span>
                        ) : null}
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
                person.deliveryShare > 0 ||
                person.discountShare > 0 ||
                (showSettleButton && !isSettled)) && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2 text-[11px] text-[var(--text-muted)]">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
                    {person.deliveryShare > 0 && (
                      <span className="font-mono tabular-nums">
                        Deliv +{formatCurrency(person.deliveryShare, cur)}
                      </span>
                    )}
                    {person.discountShare > 0 && (
                      <span className="font-mono tabular-nums text-[var(--accent-text)]">
                        Disc -{formatCurrency(person.discountShare, cur)}
                      </span>
                    )}
                  </div>

                  {showSettleButton && !isSettled && (
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopyPersonNudge(person)}
                        title={`Copy ${person.name}'s individual share`}
                        className="inline-flex h-7 items-center gap-1 rounded-lg bg-[var(--bg-surface-2)] px-2 text-[10px] font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                      >
                        {copiedPersonId === person.participantId ? (
                          <>
                            <Check className="h-3 w-3 text-[var(--accent-text)]" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            Copy
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleWhatsAppPersonNudge(person)}
                        title={`Send ${person.name} a WhatsApp reminder`}
                        className="inline-flex h-7 items-center gap-1 rounded-lg bg-[var(--accent-soft)] px-2 text-[10px] font-semibold text-[var(--accent-text)] transition-opacity hover:opacity-90"
                      >
                        <Send className="h-3 w-3" />
                        Nudge
                      </button>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}

        {/* Exact Sum / Rounding Buffer Reconciliation Strip */}
        <div className="flex items-center justify-between px-1 text-[11px] text-[var(--text-muted)]">
          <span>
            {activeRoundingStep > 0 && roundingSurplus > 0
              ? "Rounded total collected"
              : "Sum of individual totals"}
          </span>
          <span className="font-mono font-semibold text-[var(--text-secondary)] tabular-nums">
            {formatCurrency(split.sumOfPeopleTotals, cur)}
            {activeRoundingStep > 0 && roundingSurplus > 0
              ? ` (+${formatCurrency(roundingSurplus, cur)} buffer)`
              : split.unassignedItemIds.length === 0 &&
                  split.sumOfPeopleTotals === split.grandTotal
                ? " · Exact match ✓"
                : ""}
          </span>
        </div>
      </div>

      {/* Collapsible Payment Info Panel */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
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

      {/* Optional Send Bill into an existing Trip */}
      {availableTrips.length > 0 && onAddBillToTrip && (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
            <Compass className="h-4 w-4 text-[var(--accent-text)]" />
            <span>Add this itemized bill to a Trip</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {availableTrips.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onAddBillToTrip(t.id)}
                className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-3 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--accent-text)]"
              >
                + {t.name}
              </button>
            ))}
          </div>
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
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-3.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] active:scale-[0.99]"
          >
            {copiedWhatsApp ? (
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
            onClick={handleOpenWhatsApp}
            title="Open directly in WhatsApp"
            aria-label="Share via WhatsApp"
            className="flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-3.5 text-xs font-semibold text-[var(--accent-text)] transition-opacity hover:opacity-90 active:scale-[0.99]"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">WhatsApp</span>
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
