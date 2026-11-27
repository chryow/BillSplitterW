"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, ReceiptText, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { calculateSplit } from "@/lib/split-engine";
import type {
  BillItem,
  CurrencyCode,
  FeeSplitMode,
  Participant,
  PaymentInfo,
} from "@/lib/types";
import {
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
  created_at: string;
}

export function SharedBillView({ bill }: { bill: SharedBillData }) {
  const [copied, setCopied] = useState(false);

  const cur = bill.currency;
  const split = calculateSplit({
    currency: cur,
    items: bill.items,
    tax: bill.tax,
    serviceCharge: bill.service_charge,
    discount: bill.discount,
    participants: bill.participants,
    feeSplitMode: bill.fee_split_mode,
  });

  const handleCopy = async () => {
    const shareUrl =
      typeof window !== "undefined" ? window.location.href : null;
    const text = formatWhatsAppSummary({
      merchantName: bill.merchant_name,
      feeSplitMode: bill.fee_split_mode,
      split,
      paymentInfo: bill.payment_info,
      shareUrl,
    });
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const formattedDate = new Date(bill.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

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
          </div>
        </div>

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
                  <h2 className="truncate text-sm font-semibold">
                    {person.name}
                  </h2>
                </div>
                <span className="shrink-0 font-mono text-base font-bold tabular-nums">
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
          ))}
        </div>

        {hasPaymentInfo(bill.payment_info) && (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
              <Wallet className="h-4 w-4 text-[var(--accent-text)]" />
              <span>Payment Info</span>
            </div>
            <div className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
              {(bill.payment_info.provider || bill.payment_info.accountNumber) && (
                <p className="font-mono font-semibold text-[var(--text-primary)]">
                  {[bill.payment_info.provider, bill.payment_info.accountNumber]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {bill.payment_info.accountName && (
                <p className="text-xs">a/n {bill.payment_info.accountName}</p>
              )}
              {bill.payment_info.note && (
                <p className="text-xs text-[var(--text-muted)]">
                  {bill.payment_info.note}
                </p>
              )}
            </div>
          </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border-subtle)] bg-[var(--bg-app)]/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-md items-center gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handleCopy}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                <span>Copied WhatsApp Summary!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy WhatsApp Summary</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
