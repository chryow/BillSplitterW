"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Scissors,
  Trash2,
} from "lucide-react";
import { AmountInput } from "@/components/ui/AmountInput";
import { StatusBanner } from "@/components/ui/StatusBanner";
import {
  formatCurrency,
  getCurrencyConfig,
  roundForCurrency,
} from "@/lib/currency";
import { checkReceiptMath, splitItemQuantity } from "@/lib/split-engine";
import type { BillItem, BillState } from "@/lib/types";

interface ReviewStepProps {
  bill: BillState;
  onUpdateBill: (updater: (prev: BillState) => BillState) => void;
  onOpenCurrency: () => void;
  onBack: () => void;
  onNext: () => void;
}

function makeItemId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function ReviewStep({
  bill,
  onUpdateBill,
  onOpenCurrency,
  onBack,
  onNext,
}: ReviewStepProps) {
  const cur = bill.currency;
  const currencyInfo = getCurrencyConfig(cur);
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});

  const mathCheck = checkReceiptMath(
    bill.items,
    bill.tax,
    bill.serviceCharge,
    bill.discount,
    bill.scannedGrandTotal,
    cur
  );

  const updateItem = (id: string, patch: Partial<BillItem>) => {
    onUpdateBill((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    }));
  };

  const applyQty = (item: BillItem, nextQty: number) => {
    const qty = Math.min(99, Math.max(1, nextQty));
    const nextUnit =
      item.unitPrice > 0
        ? item.unitPrice
        : roundForCurrency(item.totalPrice / qty, cur);
    const nextTotal =
      item.unitPrice > 0
        ? roundForCurrency(nextUnit * qty, cur)
        : item.totalPrice;

    updateItem(item.id, {
      qty,
      unitPrice: nextUnit,
      totalPrice: nextTotal,
    });
  };

  const handleQtyChange = (item: BillItem, rawQty: string) => {
    const digitsOnly = rawQty.replace(/[^\d]/g, "").slice(0, 2);
    setQtyDrafts((prev) => ({ ...prev, [item.id]: digitsOnly }));
    if (digitsOnly !== "") {
      const parsed = Number.parseInt(digitsOnly, 10);
      if (Number.isFinite(parsed) && parsed >= 1) {
        applyQty(item, parsed);
      }
    }
  };

  const handleQtyBlur = (item: BillItem) => {
    const draft = qtyDrafts[item.id];
    setQtyDrafts((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    if (draft !== undefined) {
      const parsed = Number.parseInt(draft, 10);
      applyQty(item, Number.isFinite(parsed) && parsed >= 1 ? parsed : 1);
    }
  };

  const handlePriceChange = (item: BillItem, totalPrice: number) => {
    const unitPrice =
      item.qty > 0
        ? roundForCurrency(totalPrice / item.qty, cur)
        : totalPrice;
    updateItem(item.id, { totalPrice, unitPrice });
  };

  const handleSplitQty = (item: BillItem) => {
    const expanded = splitItemQuantity(item, cur, makeItemId);
    onUpdateBill((prev) => ({
      ...prev,
      items: prev.items.flatMap((row) => (row.id === item.id ? expanded : [row])),
    }));
  };

  const handleAddItem = () => {
    onUpdateBill((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: makeItemId(),
          name: "",
          qty: 1,
          unitPrice: 0,
          totalPrice: 0,
          assigneeIds: [],
        },
      ],
    }));
  };

  const handleDeleteItem = (id: string) => {
    onUpdateBill((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
    }));
  };

  const validItemsCount = bill.items.filter(
    (i) => i.name.trim().length > 0 || i.totalPrice > 0
  ).length;

  return (
    <section className="space-y-4 pt-3 pb-28">
      {/* Merchant + Currency Header Card */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5">
        <div className="flex items-end gap-2.5">
          <label className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Place / Merchant
            </span>
            <input
              type="text"
              value={bill.merchantName}
              onChange={(e) =>
                onUpdateBill((prev) => ({
                  ...prev,
                  merchantName: e.target.value,
                }))
              }
              placeholder="e.g. Kopi & Kitchen"
              className="mt-1 h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-3 text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={onOpenCurrency}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-3 font-mono text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            <span>{currencyInfo.flag}</span>
            <span>{cur}</span>
          </button>
        </div>
      </div>

      {/* OCR Warnings */}
      {bill.warnings.length > 0 && (
        <StatusBanner
          variant="warning"
          title="Please double-check a few lines"
          message={bill.warnings.join(" • ")}
          onDismiss={() =>
            onUpdateBill((prev) => ({ ...prev, warnings: [] }))
          }
        />
      )}

      {/* Automatic Math Check Banner */}
      {bill.scannedGrandTotal !== null && (
        <StatusBanner
          variant={mathCheck.isMatch ? "success" : "warning"}
          title={
            mathCheck.isMatch
              ? "Receipt total matches"
              : `Off by ${formatCurrency(Math.abs(mathCheck.difference), cur)}`
          }
          message={
            mathCheck.isMatch
              ? `Items + fees − discount equals ${formatCurrency(bill.scannedGrandTotal, cur)}.`
              : `Calculated ${formatCurrency(mathCheck.computedGrandTotal, cur)} vs receipt total ${formatCurrency(bill.scannedGrandTotal, cur)} (${mathCheck.difference > 0 ? "over" : "under"} by ${formatCurrency(Math.abs(mathCheck.difference), cur)}). Adjust items or fees below.`
          }
          actionLabel={
            mathCheck.isMatch ? undefined : "Accept calculated total"
          }
          onAction={
            mathCheck.isMatch
              ? undefined
              : () =>
                  onUpdateBill((prev) => ({
                    ...prev,
                    scannedGrandTotal: mathCheck.computedGrandTotal,
                  }))
          }
        />
      )}

      {/* Editable Line Items */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Items ({bill.items.length})
          </h2>
          <button
            type="button"
            onClick={handleAddItem}
            className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-[var(--accent-soft)] px-2.5 text-xs font-semibold text-[var(--accent-text)] transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Item
          </button>
        </div>

        <div className="space-y-2">
          {bill.items.map((item, idx) => (
            <div
              key={item.id}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) =>
                    updateItem(item.id, { name: e.target.value })
                  }
                  placeholder={`Item ${idx + 1} name`}
                  aria-label={`Item ${idx + 1} name`}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2.5 text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleDeleteItem(item.id)}
                  aria-label={`Delete ${item.name || "item"}`}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <label className="flex h-10 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2.5">
                  <span className="text-[11px] font-medium text-[var(--text-muted)]">
                    Qty
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={qtyDrafts[item.id] ?? String(item.qty)}
                    onChange={(e) => handleQtyChange(item, e.target.value)}
                    onBlur={() => handleQtyBlur(item)}
                    aria-label="Quantity"
                    className="w-8 bg-transparent text-center font-mono text-sm font-semibold text-[var(--text-primary)] tabular-nums focus:outline-none"
                  />
                </label>

                <label className="flex h-10 min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2.5">
                  <span className="font-mono text-xs text-[var(--text-muted)]">
                    {currencyInfo.symbol}
                  </span>
                  <AmountInput
                    value={item.totalPrice}
                    currency={cur}
                    onChange={(nextVal) => handlePriceChange(item, nextVal)}
                    ariaLabel="Line total price"
                    className="w-full min-w-0 bg-transparent text-right font-mono text-sm font-semibold text-[var(--text-primary)] tabular-nums placeholder:text-[var(--text-muted)] focus:outline-none"
                  />
                </label>

                {item.qty > 1 && (
                  <button
                    type="button"
                    onClick={() => handleSplitQty(item)}
                    title={`Split ${item.qty}x into ${item.qty} separate 1x items`}
                    className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg border border-[var(--accent)]/35 bg-[var(--accent-soft)] px-2.5 text-xs font-semibold text-[var(--accent-text)] transition-opacity hover:opacity-90"
                  >
                    <Scissors className="h-3.5 w-3.5" />
                    Split Qty
                  </button>
                )}
              </div>
            </div>
          ))}

          {bill.items.length === 0 && (
            <button
              type="button"
              onClick={handleAddItem}
              className="flex min-h-[64px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-strong)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
            >
              <Plus className="h-4 w-4" />
              Add your first item
            </button>
          )}
        </div>
      </div>

      {/* Tax, Service Charge & Discount */}
      <div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Fees &amp; Discounts
        </h2>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <label className="block">
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">
              Tax (PB1 / PPN)
            </span>
            <div className="mt-1 flex h-10 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2.5">
              <span className="font-mono text-xs text-[var(--text-muted)]">
                {currencyInfo.symbol}
              </span>
              <AmountInput
                value={bill.tax}
                currency={cur}
                onChange={(nextTax) =>
                  onUpdateBill((prev) => ({ ...prev, tax: nextTax }))
                }
                ariaLabel="Tax amount"
                className="w-full min-w-0 bg-transparent text-right font-mono text-sm font-semibold text-[var(--text-primary)] tabular-nums focus:outline-none"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">
              Service Charge
            </span>
            <div className="mt-1 flex h-10 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2.5">
              <span className="font-mono text-xs text-[var(--text-muted)]">
                {currencyInfo.symbol}
              </span>
              <AmountInput
                value={bill.serviceCharge}
                currency={cur}
                onChange={(nextService) =>
                  onUpdateBill((prev) => ({
                    ...prev,
                    serviceCharge: nextService,
                  }))
                }
                ariaLabel="Service charge amount"
                className="w-full min-w-0 bg-transparent text-right font-mono text-sm font-semibold text-[var(--text-primary)] tabular-nums focus:outline-none"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">
              Discount / Promo
            </span>
            <div className="mt-1 flex h-10 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2.5">
              <span className="font-mono text-xs text-[var(--accent-text)]">
                -{currencyInfo.symbol}
              </span>
              <AmountInput
                value={bill.discount}
                currency={cur}
                onChange={(nextDiscount) =>
                  onUpdateBill((prev) => ({ ...prev, discount: nextDiscount }))
                }
                ariaLabel="Discount amount"
                className="w-full min-w-0 bg-transparent text-right font-mono text-sm font-semibold text-[var(--accent-text)] tabular-nums focus:outline-none"
              />
            </div>
          </label>
        </div>

        <div className="space-y-1 border-t border-[var(--border-subtle)] pt-2.5 text-xs">
          <div className="flex items-center justify-between text-[var(--text-secondary)]">
            <span>Items Subtotal</span>
            <span className="font-mono tabular-nums">
              {formatCurrency(mathCheck.computedSubtotal, cur)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm font-semibold text-[var(--text-primary)]">
            <span>Grand Total</span>
            <span className="font-mono tabular-nums">
              {formatCurrency(mathCheck.computedGrandTotal, cur)}
            </span>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border-subtle)] bg-[var(--bg-app)]/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-md items-center gap-2.5 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to Start"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <button
            type="button"
            disabled={validItemsCount === 0}
            onClick={onNext}
            className="flex h-12 flex-1 items-center justify-between rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-45"
          >
            <span>Assign People</span>
            <span className="flex items-center gap-1.5 font-mono text-xs tabular-nums">
              {formatCurrency(mathCheck.computedGrandTotal, cur)}
              <ArrowRight className="h-4 w-4" />
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
