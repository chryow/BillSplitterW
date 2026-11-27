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
  Wallet,
} from "lucide-react";
import { ColophonFooter } from "@/components/layout/ColophonFooter";
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
  delivery_fee: number;
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
        deliveryFee: bill.delivery_fee,
        discount: bill.discount,
        participants: bill.participants,
        feeSplitMode: "proportional",
      }),
    [
      cur,
      bill.items,
      bill.tax,
      bill.service_charge,
      bill.delivery_fee,
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
            Split a Bill
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 space-y-4 px-4 pt-4 pb-6">
        <div className="rounded-[3px] border border-[var(--border-strong)] bg-[var(--bg-surface)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="micro-label text-[var(--text-muted)]">
                Shared Breakdown &middot; {formattedDate}
              </p>
              <h1 className="font-editorial mt-0.5 truncate text-xl font-semibold tracking-tight">
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
              <p className="micro-label text-[var(--text-muted)]">
                Grand Total
              </p>
              <p className="mt-0.5 font-mono text-lg font-bold text-[var(--accent-text)] tabular-nums">
                {formatCurrency(split.grandTotal, cur)}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--border-subtle)] pt-2.5 font-mono text-[11px] text-[var(--text-secondary)]">
            <span>
              ITEMS{" "}
              <strong className="text-[var(--text-primary)] tabular-nums">
                {formatCurrency(split.itemsSubtotal, cur)}
              </strong>
            </span>
            {split.tax > 0 && (
              <span>
                TAX{" "}
                <strong className="text-[var(--text-primary)] tabular-nums">
                  {formatCurrency(split.tax, cur)}
                </strong>
              </span>
            )}
            {split.serviceCharge > 0 && (
              <span>
                SVC{" "}
                <strong className="text-[var(--text-primary)] tabular-nums">
                  {formatCurrency(split.serviceCharge, cur)}
                </strong>
              </span>
            )}
            {split.deliveryFee > 0 && (
              <span>
                DELIV{" "}
                <strong className="text-[var(--text-primary)] tabular-nums">
                  {formatCurrency(split.deliveryFee, cur)}
                </strong>
              </span>
            )}
            {split.discount > 0 && (
              <span>
                DISC{" "}
                <strong className="text-[var(--success-text)] tabular-nums">
                  -{formatCurrency(split.discount, cur)}
                </strong>
              </span>
            )}
            {settlement.collectibleCount > 0 && (
              <span className="ml-auto text-[var(--text-muted)] tabular-nums">
                {settlement.settledCount}/{settlement.collectibleCount} PAID
              </span>
            )}
          </div>
        </div>

        {/* Dedicated Payment Info Card with 1-tap Copy Account Number */}
        {hasPaymentInfo(bill.payment_info) && (
          <div className="card-letterpress rounded-[3px] border bg-[var(--bg-surface)] p-4">
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
                <span className="rounded-[2px] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-primary)]">
                  {bill.payment_info.provider}
                </span>
              )}
            </div>

            {bill.payment_info.accountNumber.trim() && (
              <div className="mt-2.5 flex items-center justify-between gap-2 rounded-[2px] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-3 py-2">
                <span className="min-w-0 truncate font-mono text-base font-bold tracking-wide text-[var(--text-primary)] select-all">
                  {bill.payment_info.accountNumber.trim()}
                </span>
                <button
                  type="button"
                  onClick={handleCopyAccountNumber}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[2px] border border-[var(--border-strong)] bg-[var(--ink-solid)] px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-on-solid)] transition-colors duration-150 ease-out hover:bg-[var(--ink-solid-hover)]"
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
                className={`rounded-[3px] border bg-[var(--bg-surface)] p-3.5 ${
                  isSettled
                    ? "border-[var(--success-border)] bg-[var(--bg-surface-2)]/40"
                    : "border-[var(--border-subtle)]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: person.color }}
                    />
                    <h2 className="truncate text-sm font-semibold">
                      {person.name}
                    </h2>
                    {isPayer && (
                      <span className="shrink-0 rounded-[2px] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.06em] text-[var(--text-secondary)]">
                        Paid bill
                      </span>
                    )}
                    {isSettled && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-[2px] border border-[var(--success-border)] bg-[var(--success-soft)] px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.06em] text-[var(--success-text)]">
                        <CheckCircle2 className="h-2.5 w-2.5" />
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
                  <ul className="mt-2.5 divide-y divide-[var(--border-subtle)]/70 border-t border-[var(--border-subtle)] pt-1 text-xs">
                    {person.items.map((item, idx) => (
                      <li
                        key={`${item.itemId}-${idx}`}
                        className="flex items-center justify-between gap-2 py-1.5 text-[var(--text-secondary)]"
                      >
                        <span className="min-w-0 truncate">
                          {item.qty > 1 ? `${item.qty}x ` : ""}
                          {item.name}
                          {item.isCustomShare ? (
                            <span className="ml-1.5 rounded-[2px] border border-[var(--border-strong)] bg-[var(--bg-surface-2)] px-1 py-0.5 font-mono text-[10px] text-[var(--text-primary)]">
                              {item.shareWeight}/{item.totalShares}
                            </span>
                          ) : item.shareCount > 1 ? (
                            <span className="ml-1.5 rounded-[2px] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-1 py-0.5 font-mono text-[10px] text-[var(--text-muted)]">
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
                  person.deliveryShare > 0 ||
                  person.discountShare > 0) && (
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-[var(--border-subtle)] pt-2 font-mono text-[11px] text-[var(--text-muted)] tabular-nums">
                    {person.taxShare > 0 && (
                      <span>Tax +{formatCurrency(person.taxShare, cur)}</span>
                    )}
                    {person.serviceShare > 0 && (
                      <span>
                        Svc +{formatCurrency(person.serviceShare, cur)}
                      </span>
                    )}
                    {person.deliveryShare > 0 && (
                      <span>
                        Deliv +{formatCurrency(person.deliveryShare, cur)}
                      </span>
                    )}
                    {person.discountShare > 0 && (
                      <span className="text-[var(--success-text)]">
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

      <ColophonFooter withBottomBarOffset />

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border-strong)] bg-[var(--bg-app)]">
        <div className="mx-auto flex w-full max-w-lg items-center gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handleCopySummary}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[3px] border border-[var(--border-strong)] bg-[var(--accent)] px-4 font-mono text-xs font-semibold uppercase tracking-[0.06em] text-[#F7F5F0] transition-colors duration-150 ease-out hover:bg-[var(--accent-hover)]"
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
            aria-label="Share via WhatsApp"
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
