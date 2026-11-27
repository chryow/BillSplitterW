"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  CheckCircle2,
  Copy,
  ImageDown,
  Loader2,
  MessageCircle,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { shareOrDownloadSplitImage } from "@/lib/split-card-image";
import { calculateSplit, computeSettlementSummary } from "@/lib/split-engine";
import type {
  BillItem,
  CurrencyCode,
  FeeSplitMode,
  Participant,
  PaymentInfo,
} from "@/lib/types";
import {
  buildWhatsAppShareUrl,
  formatWhatsAppSummary,
  hasPaymentInfo,
} from "@/lib/whatsapp-formatter";

export interface SharedBillData {
  share_slug: string;
  merchant_name: string;
  currency: CurrencyCode;
  fee_split_mode: FeeSplitMode;
  tax: number;
  service_charge: number;
  discount: number;
  items: BillItem[];
  participants: Participant[];
  payment_info: PaymentInfo;
  paid_by_participant_id: string | null;
  settled_participant_ids: string[];
  created_at: string;
}

export function SharedBillView({ bill }: { bill: SharedBillData }) {
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [exportingImage, setExportingImage] = useState(false);

  const cur = bill.currency;
  const split = useMemo(
    () =>
      calculateSplit({
        currency: cur,
        items: bill.items,
        tax: bill.tax,
        serviceCharge: bill.service_charge,
        discount: bill.discount,
        participants: bill.participants,
        feeSplitMode: "proportional",
      }),
    [
      cur,
      bill.items,
      bill.tax,
      bill.service_charge,
      bill.discount,
      bill.participants,
    ]
  );

  const settlement = useMemo(
    () =>
      computeSettlementSummary(
        split,
        bill.paid_by_participant_id,
        bill.settled_participant_ids
      ),
    [split, bill.paid_by_participant_id, bill.settled_participant_ids]
  );
  const settledSet = useMemo(
    () => new Set(bill.settled_participant_ids),
    [bill.settled_participant_ids]
  );

  const buildSummaryText = () =>
    formatWhatsAppSummary({
      merchantName: bill.merchant_name,
      feeSplitMode: "proportional",
      split,
      paymentInfo: bill.payment_info,
      shareUrl: typeof window !== "undefined" ? window.location.href : null,
      paidByParticipantId: bill.paid_by_participant_id,
      settledParticipantIds: bill.settled_participant_ids,
    });

  const handleCopySummary = async () => {
    await navigator.clipboard.writeText(buildSummaryText());
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2200);
  };

  const handleOpenWhatsApp = () => {
    const url = buildWhatsAppShareUrl(buildSummaryText());
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCopyAccountNumber = async () => {
    const raw = bill.payment_info.accountNumber.trim();
    if (!raw) return;
    await navigator.clipboard.writeText(raw);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2000);
  };

  const formattedDate = new Date(bill.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const handleSaveCardImage = async () => {
    setExportingImage(true);
    try {
      await shareOrDownloadSplitImage({
        merchantName: bill.merchant_name,
        split,
        paidByParticipantId: bill.paid_by_participant_id,
        settledParticipantIds: bill.settled_participant_ids,
        paymentInfo: bill.payment_info,
        dateLabel: formattedDate,
      });
    } finally {
      setExportingImage(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[var(--bg-app)] text-[var(--text-primary)]">
      <header className="sticky top-0 z-20 border-b border-[var(--border-subtle)] bg-[var(--bg-app)]/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight text-[var(--text-primary)]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)]">
              <ReceiptText className="h-4 w-4" />
            </span>
            BillSplitterW
          </Link>

          <Link
            href="/"
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            Split a Bill
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md space-y-4 px-4 pt-4 pb-28">
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-[var(--text-muted)]">
                Shared Breakdown · {formattedDate}
              </p>
              <h1 className="mt-0.5 truncate text-xl font-semibold tracking-tight">
                {bill.merchant_name || "Split Bill"}
              </h1>
              {settlement.payerName && (
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Paid by{" "}
                  <strong className="text-[var(--text-primary)]">
                    {settlement.payerName}
                  </strong>
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] text-[var(--text-muted)]">Grand Total</p>
              <p className="font-mono text-lg font-bold text-[var(--accent-text)] tabular-nums">
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
            {settlement.collectibleCount > 0 && (
              <span className="ml-auto font-mono text-[var(--text-muted)] tabular-nums">
                {settlement.settledCount}/{settlement.collectibleCount} paid
              </span>
            )}
          </div>
        </div>

        {/* Dedicated Payment Info Card with 1-tap Copy Account Number */}
        {hasPaymentInfo(bill.payment_info) && (
          <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--bg-surface)] p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                <Wallet className="h-4 w-4 text-[var(--accent-text)]" />
                <span>
                  {settlement.payerName
                    ? `Transfer to ${settlement.payerName}`
                    : "Payment Info"}
                </span>
              </div>
              {bill.payment_info.provider && (
                <span className="rounded-full bg-[var(--bg-surface-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                  {bill.payment_info.provider}
                </span>
              )}
            </div>

            {bill.payment_info.accountNumber.trim() && (
              <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-3 py-2.5">
                <span className="min-w-0 truncate font-mono text-base font-bold tracking-wide text-[var(--text-primary)] select-all">
                  {bill.payment_info.accountNumber.trim()}
                </span>
                <button
                  type="button"
                  onClick={handleCopyAccountNumber}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 text-xs font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] active:scale-[0.98]"
                >
                  {copiedAccount ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            )}

            <div className="mt-2 space-y-0.5 text-xs text-[var(--text-secondary)]">
              {bill.payment_info.accountName && (
                <p>a/n {bill.payment_info.accountName}</p>
              )}
              {bill.payment_info.note && (
                <p className="text-[var(--text-muted)]">
                  {bill.payment_info.note}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2.5">
          {split.people.map((person) => {
            const isPayer = bill.paid_by_participant_id === person.participantId;
            const isSettled = !isPayer && settledSet.has(person.participantId);

            return (
              <article
                key={person.participantId}
                className={`rounded-2xl border p-3.5 ${
                  isSettled
                    ? "border-[var(--accent)]/35 bg-[var(--bg-surface)]/80"
                    : "border-[var(--border-subtle)] bg-[var(--bg-surface)]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: person.color }}
                    />
                    <h2 className="truncate text-sm font-semibold">
                      {person.name}
                    </h2>
                    {isPayer && (
                      <span className="shrink-0 rounded-full bg-[var(--bg-surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                        Paid bill
                      </span>
                    )}
                    {isSettled && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-text)]">
                        <CheckCircle2 className="h-3 w-3" />
                        Paid
                      </span>
                    )}
                  </div>
                  <span
                    className={`shrink-0 font-mono text-base font-bold tabular-nums ${
                      isSettled
                        ? "text-[var(--text-muted)] line-through"
                        : "text-[var(--text-primary)]"
                    }`}
                  >
                    {formatCurrency(person.total, cur)}
                  </span>
                </div>

                {person.items.length > 0 && (
                  <ul className="mt-2.5 space-y-1 border-t border-[var(--border-subtle)] pt-2.5 text-xs">
                    {person.items.map((item, idx) => (
                      <li
                        key={`${item.itemId}-${idx}`}
                        className="flex items-center justify-between gap-2 text-[var(--text-secondary)]"
                      >
                        <span className="min-w-0 truncate">
                          {item.qty > 1 ? `${item.qty}x ` : ""}
                          {item.name}
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
                )}

                {(person.taxShare > 0 ||
                  person.serviceShare > 0 ||
                  person.discountShare > 0) && (
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-[var(--border-subtle)] pt-2 text-[11px] text-[var(--text-muted)]">
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
            );
          })}
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border-subtle)] bg-[var(--bg-app)]/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-md items-center gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handleCopySummary}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
          >
            {copiedSummary ? (
              <>
                <Check className="h-4 w-4" />
                <span>Copied Summary!</span>
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
            onClick={handleSaveCardImage}
            title="Save or share PNG summary card"
            aria-label="Save PNG card"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50"
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
            aria-label="Share via WhatsApp"
            className="flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-4 text-xs font-semibold text-[var(--accent-text)] transition-opacity hover:opacity-90"
          >
            <MessageCircle className="h-4 w-4" />
            <span>WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
}
