"use client";

import { useRef, useState } from "react";
import {
  Camera,
  Check,
  Loader2,
  Minus,
  Plus,
  Scissors,
  SlidersHorizontal,
  Trash2,
  Users,
} from "lucide-react";
import { BottomSheet } from "@/components/layout/BottomSheet";
import { AmountInput } from "@/components/ui/AmountInput";
import { StatusBanner } from "@/components/ui/StatusBanner";
import {
  formatCurrency,
  getCurrencyConfig,
  roundForCurrency,
} from "@/lib/currency";
import { preprocessReceiptImage } from "@/lib/image-preprocess";
import { checkReceiptMath, splitItemQuantity } from "@/lib/split-engine";
import type {
  BillItem,
  CurrencyCode,
  ScanApiError,
  ScannedReceiptResponse,
  ScanQuota,
  TripExpense,
  TripExpenseCategory,
  TripMember,
} from "@/lib/types";

interface TripExpenseSheetProps {
  open: boolean;
  onClose: () => void;
  currency: CurrencyCode;
  members: TripMember[];
  initialExpense: TripExpense | null;
  initialMode?: "quick" | "itemized";
  isSignedIn: boolean;
  onRequireSignIn: () => void;
  onQuotaUpdate: (next: ScanQuota) => void;
  onSave: (expense: TripExpense) => void;
}

const CATEGORIES: { value: TripExpenseCategory; label: string }[] = [
  { value: "food", label: "Food" },
  { value: "stay", label: "Stay" },
  { value: "transport", label: "Transport" },
  { value: "activity", label: "Activity" },
  { value: "other", label: "Other" },
];

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TripExpenseSheet({
  open,
  onClose,
  currency,
  members,
  initialExpense,
  initialMode = "quick",
  isSignedIn,
  onRequireSignIn,
  onQuotaUpdate,
  onSave,
}: TripExpenseSheetProps) {
  const allMemberIds = members.map((m) => m.id);
  const currencyInfo = getCurrencyConfig(currency);

  const [mode, setMode] = useState<"quick" | "itemized">(
    initialExpense?.mode ?? initialMode
  );
  const [title, setTitle] = useState(initialExpense?.title ?? "");
  const [date, setDate] = useState(initialExpense?.date ?? todayIso());
  const [category, setCategory] = useState<TripExpenseCategory>(
    initialExpense?.category ?? "food"
  );
  const [paidByMemberId, setPaidByMemberId] = useState(
    initialExpense?.paidByMemberId ?? members[0]?.id ?? ""
  );

  // Quick mode state
  const [amount, setAmount] = useState(initialExpense?.amount ?? 0);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    initialExpense?.assigneeIds?.length
      ? initialExpense.assigneeIds
      : allMemberIds
  );
  const [assigneeShares, setAssigneeShares] = useState<Record<string, number>>(
    initialExpense?.assigneeShares ?? {}
  );
  const [showQuickWeights, setShowQuickWeights] = useState(
    Boolean(
      initialExpense?.assigneeShares &&
        Object.values(initialExpense.assigneeShares).some((w) => w > 1)
    )
  );

  // Itemized mode state
  const [items, setItems] = useState<BillItem[]>(
    initialExpense?.items?.length
      ? initialExpense.items
      : [
          {
            id: makeId("ti"),
            name: "",
            qty: 1,
            unitPrice: 0,
            totalPrice: 0,
            assigneeIds: allMemberIds,
          },
        ]
  );
  const [tax, setTax] = useState(initialExpense?.tax ?? 0);
  const [serviceCharge, setServiceCharge] = useState(
    initialExpense?.serviceCharge ?? 0
  );
  const [discount, setDiscount] = useState(initialExpense?.discount ?? 0);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Receipt OCR inside trip
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanBanner, setScanBanner] = useState<string | null>(null);

  const itemizedMath = checkReceiptMath(
    items,
    tax,
    serviceCharge,
    discount,
    null,
    currency
  );

  const toggleQuickAssignee = (memberId: string) => {
    setAssigneeIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const adjustQuickWeight = (memberId: string, delta: number) => {
    setAssigneeShares((prev) => {
      const current = prev[memberId] ?? 1;
      return { ...prev, [memberId]: Math.min(20, Math.max(1, current + delta)) };
    });
  };

  const toggleItemAssignee = (itemId: string, memberId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const exists = item.assigneeIds.includes(memberId);
        return {
          ...item,
          assigneeIds: exists
            ? item.assigneeIds.filter((id) => id !== memberId)
            : [...item.assigneeIds, memberId],
        };
      })
    );
  };

  const handleScanFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setScanBanner(null);
    setScanning(true);

    try {
      const processed = await preprocessReceiptImage(file);
      const formData = new FormData();
      formData.append(
        "file",
        new File([processed.blob], "receipt.jpg", { type: processed.mimeType })
      );
      formData.append("targetCurrency", currency);

      const response = await fetch("/api/scan-receipt", {
        method: "POST",
        body: formData,
      });

      const remHeader = response.headers.get("X-RateLimit-Remaining");
      const limHeader = response.headers.get("X-RateLimit-Limit");
      if (remHeader !== null) {
        const remaining = Math.max(0, Number.parseInt(remHeader, 10));
        const limit =
          limHeader !== null ? Math.max(1, Number.parseInt(limHeader, 10)) : 10;
        if (Number.isFinite(remaining) && Number.isFinite(limit)) {
          onQuotaUpdate({
            used: Math.max(0, limit - remaining),
            remaining,
            limit,
          });
        }
      }

      const payload = (await response.json().catch(() => null)) as
        | ScannedReceiptResponse
        | ScanApiError
        | null;

      if (!response.ok || !payload || !("items" in payload)) {
        const errMsg =
          (payload as ScanApiError | null)?.message ||
          "Couldn't read receipt automatically. Enter items manually below.";
        setScanBanner(errMsg);
        return;
      }

      setMode("itemized");
      if (payload.merchant_name) setTitle(payload.merchant_name);
      setCategory("food");
      setTax(roundForCurrency(payload.tax ?? 0, currency));
      setServiceCharge(roundForCurrency(payload.service_charge ?? 0, currency));
      setDiscount(roundForCurrency(payload.discount ?? 0, currency));

      const parsedItems: BillItem[] =
        payload.items.length > 0
          ? payload.items.map((item) => ({
              id: makeId("ti"),
              name: item.name,
              qty: Math.max(1, Math.round(item.qty || 1)),
              unitPrice: roundForCurrency(item.unit_price, currency),
              totalPrice: roundForCurrency(item.total_price, currency),
              assigneeIds: allMemberIds,
            }))
          : [
              {
                id: makeId("ti"),
                name: "",
                qty: 1,
                unitPrice: 0,
                totalPrice: 0,
                assigneeIds: allMemberIds,
              },
            ];
      setItems(parsedItems);
      setExpandedItemId(parsedItems[0]?.id ?? null);

      const notices: string[] = [];
      if (payload.conversion) {
        const { fromCurrency, toCurrency, rate, originalGrandTotal } =
          payload.conversion;
        const rateText =
          rate < 0.05
            ? `1 ${toCurrency} ≈ ${formatCurrency(1 / rate, fromCurrency)}`
            : `1 ${fromCurrency} ≈ ${formatCurrency(rate, toCurrency)}`;
        notices.push(
          `Auto-converted from ${fromCurrency}${originalGrandTotal ? ` (${formatCurrency(originalGrandTotal, fromCurrency)})` : ""} → ${toCurrency} (${rateText})`
        );
      }
      if (payload.warnings.length > 0) {
        notices.push(...payload.warnings);
      }
      if (notices.length > 0) {
        setScanBanner(notices.join(" • "));
      }
    } catch (err) {
      setScanBanner(
        err instanceof Error ? err.message : "Could not process receipt image."
      );
    } finally {
      setScanning(false);
    }
  };

  const canSave =
    title.trim().length > 0 &&
    Boolean(paidByMemberId) &&
    (mode === "quick"
      ? amount > 0 && assigneeIds.length > 0
      : itemizedMath.computedGrandTotal > 0);

  const handleSubmit = () => {
    if (!canSave) return;

    const expense: TripExpense = {
      id: initialExpense?.id ?? makeId("exp"),
      title: title.trim(),
      date: date || todayIso(),
      category,
      paidByMemberId,
      mode,
      amount: mode === "quick" ? amount : itemizedMath.computedGrandTotal,
      assigneeIds: mode === "quick" ? assigneeIds : allMemberIds,
      ...(mode === "quick" && showQuickWeights
        ? { assigneeShares }
        : {}),
      ...(mode === "itemized"
        ? {
            items: items.filter(
              (i) => i.name.trim().length > 0 || i.totalPrice > 0
            ),
            tax,
            serviceCharge,
            discount,
          }
        : {}),
    };

    onSave(expense);
    onClose();
  };

  const allQuickSelected =
    members.length > 0 && members.every((m) => assigneeIds.includes(m.id));

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={initialExpense ? "Edit Trip Bill" : "Add Bill to Trip"}
      subtitle="Assign a full bill or scan an itemized restaurant receipt"
    >
      <div className="space-y-4">
        {/* Mode Switcher + AI Scan Shortcut */}
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-0.5">
            {(
              [
                { id: "quick", label: "Quick Bill" },
                { id: "itemized", label: "Itemized" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                className={`min-h-[32px] rounded-lg px-3 text-xs font-semibold transition-colors ${
                  mode === tab.id
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleScanFile}
            className="hidden"
          />
          <button
            type="button"
            disabled={scanning}
            onClick={() => {
              if (!isSignedIn) {
                onRequireSignIn();
                return;
              }
              fileInputRef.current?.click();
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-3 text-xs font-semibold text-[var(--accent-text)] transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {scanning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
            <span>{scanning ? "Scanning..." : "Scan Receipt"}</span>
          </button>
        </div>

        {scanBanner && (
          <StatusBanner
            variant="warning"
            message={scanBanner}
            onDismiss={() => setScanBanner(null)}
          />
        )}

        {/* Title + Date */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <label className="block sm:col-span-2">
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">
              Bill / Place Name
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Villa Seminyak, Grab, Dinner"
              className="mt-1 h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">
              Date
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2.5 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
            />
          </label>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setCategory(cat.value)}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                category === cat.value
                  ? "border-[var(--accent)]/50 bg-[var(--accent-soft)] text-[var(--accent-text)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Paid By */}
        <div>
          <span className="text-[11px] font-medium text-[var(--text-secondary)]">
            Paid by
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {members.map((member) => {
              const active = paidByMemberId === member.id;
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setPaidByMemberId(member.id)}
                  className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors ${
                    active
                      ? "border-[var(--accent)]/60 bg-[var(--accent-soft)] text-[var(--text-primary)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface-2)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: member.color }}
                  />
                  {member.name}
                  {active && (
                    <Check className="h-3 w-3 text-[var(--accent-text)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Bill Mode */}
        {mode === "quick" ? (
          <div className="space-y-3.5">
            <label className="block">
              <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                Total Amount
              </span>
              <div className="mt-1 flex h-11 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-3">
                <span className="font-mono text-sm text-[var(--text-muted)]">
                  {currencyInfo.symbol}
                </span>
                <AmountInput
                  value={amount}
                  currency={currency}
                  onChange={setAmount}
                  ariaLabel="Bill total amount"
                  className="w-full min-w-0 bg-transparent text-right font-mono text-base font-bold text-[var(--text-primary)] tabular-nums focus:outline-none"
                />
              </div>
            </label>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                  Assigned to ({assigneeIds.length}/{members.length})
                </span>
                {members.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setAssigneeIds(allQuickSelected ? [] : allMemberIds)
                    }
                    className="text-[11px] font-semibold text-[var(--accent-text)] hover:opacity-85"
                  >
                    {allQuickSelected ? "Clear all" : "Split all"}
                  </button>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {members.map((member) => {
                  const selected = assigneeIds.includes(member.id);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => toggleQuickAssignee(member.id)}
                      className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors ${
                        selected
                          ? "border-[var(--accent)]/60 bg-[var(--accent-soft)] text-[var(--text-primary)]"
                          : "border-[var(--border-subtle)] bg-[var(--bg-surface-2)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                      }`}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: member.color }}
                      />
                      {member.name}
                      {selected && (
                        <Check className="h-3 w-3 text-[var(--accent-text)]" />
                      )}
                    </button>
                  );
                })}
              </div>

              {assigneeIds.length > 1 && (
                <div className="mt-2.5">
                  {!showQuickWeights ? (
                    <button
                      type="button"
                      onClick={() => setShowQuickWeights(true)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent-text)]"
                    >
                      <SlidersHorizontal className="h-3 w-3" />
                      Adjust custom shares (e.g. 2:1)
                    </button>
                  ) : (
                    <div className="space-y-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-2.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[var(--text-muted)]">
                          Custom shares
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setAssigneeShares({});
                            setShowQuickWeights(false);
                          }}
                          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                          Reset equal
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {members
                          .filter((m) => assigneeIds.includes(m.id))
                          .map((member) => {
                            const w = assigneeShares[member.id] ?? 1;
                            return (
                              <div
                                key={member.id}
                                className="flex items-center justify-between rounded-lg bg-[var(--bg-surface)] px-2.5 py-1.5"
                              >
                                <span className="truncate text-xs font-medium text-[var(--text-primary)]">
                                  {member.name}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={w <= 1}
                                    onClick={() =>
                                      adjustQuickWeight(member.id, -1)
                                    }
                                    className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border-subtle)] text-[var(--text-primary)] disabled:opacity-35"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  <span className="w-6 text-center font-mono text-xs font-semibold tabular-nums">
                                    {w}×
                                  </span>
                                  <button
                                    type="button"
                                    disabled={w >= 20}
                                    onClick={() =>
                                      adjustQuickWeight(member.id, 1)
                                    }
                                    className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border-subtle)] text-[var(--text-primary)] disabled:opacity-35"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Itemized Mode */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Items ({items.length})
              </span>
              <button
                type="button"
                onClick={() =>
                  setItems((prev) => [
                    ...prev,
                    {
                      id: makeId("ti"),
                      name: "",
                      qty: 1,
                      unitPrice: 0,
                      totalPrice: 0,
                      assigneeIds: allMemberIds,
                    },
                  ])
                }
                className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-text)]"
              >
                <Plus className="h-3 w-3" />
                Add Item
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => {
                const isOpen = expandedItemId === item.id;
                const assignedNames = members
                  .filter((m) => item.assigneeIds.includes(m.id))
                  .map((m) => m.name);

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-2.5 space-y-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((row) =>
                              row.id === item.id
                                ? { ...row, name: e.target.value }
                                : row
                            )
                          )
                        }
                        placeholder={`Item ${idx + 1}`}
                        className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-xs font-medium text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                      />
                      <div className="flex h-9 w-28 items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2">
                        <span className="font-mono text-[10px] text-[var(--text-muted)]">
                          {currencyInfo.symbol}
                        </span>
                        <AmountInput
                          value={item.totalPrice}
                          currency={currency}
                          onChange={(nextVal) =>
                            setItems((prev) =>
                              prev.map((row) =>
                                row.id === item.id
                                  ? {
                                      ...row,
                                      totalPrice: nextVal,
                                      unitPrice: roundForCurrency(
                                        nextVal / Math.max(1, row.qty),
                                        currency
                                      ),
                                    }
                                  : row
                              )
                            )
                          }
                          className="w-full min-w-0 bg-transparent text-right font-mono text-xs font-semibold text-[var(--text-primary)] tabular-nums focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setItems((prev) =>
                            prev.filter((row) => row.id !== item.id)
                          )
                        }
                        aria-label="Delete item"
                        className="flex h-9 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedItemId(isOpen ? null : item.id)
                        }
                        className="inline-flex min-w-0 items-center gap-1 truncate text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent-text)]"
                      >
                        <Users className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {assignedNames.length === 0
                            ? "Unassigned — tap to assign"
                            : assignedNames.length === members.length
                              ? "Everyone"
                              : assignedNames.join(", ")}
                        </span>
                      </button>

                      {item.qty > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setItems((prev) =>
                              prev.flatMap((row) =>
                                row.id === item.id
                                  ? splitItemQuantity(row, currency, () =>
                                      makeId("ti")
                                    )
                                  : [row]
                              )
                            )
                          }
                          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-text)]"
                        >
                          <Scissors className="h-2.5 w-2.5" />
                          Split {item.qty}x
                        </button>
                      )}
                    </div>

                    {isOpen && (
                      <div className="flex flex-wrap gap-1.5 border-t border-[var(--border-subtle)] pt-2">
                        {members.map((member) => {
                          const selected = item.assigneeIds.includes(member.id);
                          return (
                            <button
                              key={member.id}
                              type="button"
                              onClick={() =>
                                toggleItemAssignee(item.id, member.id)
                              }
                              className={`inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[11px] font-semibold ${
                                selected
                                  ? "border-[var(--accent)]/60 bg-[var(--accent-soft)] text-[var(--text-primary)]"
                                  : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                              }`}
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: member.color }}
                              />
                              {member.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Compact Tax, Service & Discount with quick % chips */}
            <div className="grid grid-cols-3 gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-2.5">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--text-secondary)]">
                    Svc
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setServiceCharge(
                        roundForCurrency(
                          itemizedMath.computedSubtotal * 0.05,
                          currency
                        )
                      )
                    }
                    className="font-mono text-[9px] font-semibold text-[var(--accent-text)]"
                  >
                    +5%
                  </button>
                </div>
                <AmountInput
                  value={serviceCharge}
                  currency={currency}
                  onChange={setServiceCharge}
                  className="mt-1 h-8 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 text-right font-mono text-xs font-semibold text-[var(--text-primary)] tabular-nums focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--text-secondary)]">
                    Tax
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setTax(
                        roundForCurrency(
                          (itemizedMath.computedSubtotal + serviceCharge) * 0.1,
                          currency
                        )
                      )
                    }
                    className="font-mono text-[9px] font-semibold text-[var(--accent-text)]"
                  >
                    +10%
                  </button>
                </div>
                <AmountInput
                  value={tax}
                  currency={currency}
                  onChange={setTax}
                  className="mt-1 h-8 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 text-right font-mono text-xs font-semibold text-[var(--text-primary)] tabular-nums focus:outline-none"
                />
              </div>

              <div>
                <span className="block text-[10px] text-[var(--text-secondary)]">
                  Discount
                </span>
                <AmountInput
                  value={discount}
                  currency={currency}
                  onChange={setDiscount}
                  className="mt-1 h-8 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 text-right font-mono text-xs font-semibold text-[var(--accent-text)] tabular-nums focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between px-1 text-xs font-semibold">
              <span className="text-[var(--text-secondary)]">Bill Total</span>
              <span className="font-mono text-[var(--accent-text)] tabular-nums">
                {formatCurrency(itemizedMath.computedGrandTotal, currency)}
              </span>
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={!canSave}
          onClick={handleSubmit}
          className="min-h-[48px] w-full rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-45"
        >
          {initialExpense ? "Save Changes" : "Add Bill to Trip"}
        </button>
      </div>
    </BottomSheet>
  );
}
