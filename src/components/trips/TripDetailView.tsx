"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  Camera,
  Car,
  Check,
  CheckCircle2,
  Circle,
  CloudCheck,
  Copy,
  Globe,
  ImageDown,
  Link2,
  Loader2,
  Lock,
  MessageCircle,
  Pencil,
  Plus,
  Receipt,
  Save,
  Send,
  Ticket,
  Trash2,
  UserCheck,
  Users,
  Utensils,
  Wallet,
} from "lucide-react";
import { TripExpenseSheet } from "@/components/trips/TripExpenseSheet";
import { TripMembersSheet } from "@/components/trips/TripMembersSheet";
import { formatCurrency } from "@/lib/currency";
import { calculateTrip } from "@/lib/trip-engine";
import {
  formatTripTransferNudge,
  formatTripWhatsAppSummary,
  shareOrDownloadTripCardImage,
} from "@/lib/trip-formatter";
import type {
  SavedFriend,
  ScanQuota,
  Trip,
  TripExpense,
  TripExpenseCategory,
  TripMember,
  TripTransfer,
} from "@/lib/types";
import {
  buildWhatsAppShareUrl,
  hasPaymentInfo,
} from "@/lib/whatsapp-formatter";

interface TripDetailViewProps {
  trip: Trip;
  savedFriends: SavedFriend[];
  isSignedIn: boolean;
  supabaseEnabled: boolean;
  savingTrip: boolean;
  onBackToList: () => void;
  onUpdateTrip: (updater: (prev: Trip) => Trip) => void;
  onDeleteExpenseWithUndo: (expenseId: string) => void;
  onSaveTripToCloud: () => void;
  onToggleTripPublic: (nextPublic: boolean) => void;
  onOpenAccount: () => void;
  onQuotaUpdate: (next: ScanQuota) => void;
}

type TripTab = "bills" | "balances" | "settle";

function CategoryIcon({ category }: { category: TripExpenseCategory }) {
  switch (category) {
    case "food":
      return <Utensils className="h-4 w-4" />;
    case "stay":
      return <BedDouble className="h-4 w-4" />;
    case "transport":
      return <Car className="h-4 w-4" />;
    case "activity":
      return <Ticket className="h-4 w-4" />;
    default:
      return <Receipt className="h-4 w-4" />;
  }
}

export function TripDetailView({
  trip,
  savedFriends,
  isSignedIn,
  supabaseEnabled,
  savingTrip,
  onBackToList,
  onUpdateTrip,
  onDeleteExpenseWithUndo,
  onSaveTripToCloud,
  onToggleTripPublic,
  onOpenAccount,
  onQuotaUpdate,
}: TripDetailViewProps) {
  const [tab, setTab] = useState<TripTab>("bills");
  const [membersSheetOpen, setMembersSheetOpen] = useState(false);
  const [expenseSheet, setExpenseSheet] = useState<{
    open: boolean;
    editing: TripExpense | null;
    mode: "quick" | "itemized";
  }>({ open: false, editing: null, mode: "quick" });

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(trip.name);
  const [copiedId, setCopiedId] = useState<string | null>(null);
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

  const shareUrl =
    trip.shareSlug && trip.isPublic && typeof window !== "undefined"
      ? `${window.location.origin}/trip/${trip.shareSlug}`
      : null;

  const settledTransferCount = calc.transfers.filter((t) =>
    settledSet.has(t.key)
  ).length;

  const markCopied = (key: string) => {
    setCopiedId(key);
    setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 2000);
  };

  const handleSaveExpense = (expense: TripExpense) => {
    onUpdateTrip((prev) => {
      const exists = prev.expenses.some((e) => e.id === expense.id);
      return {
        ...prev,
        expenses: exists
          ? prev.expenses.map((e) => (e.id === expense.id ? expense : e))
          : [expense, ...prev.expenses],
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const handleChangeMembers = (nextMembers: TripMember[]) => {
    const validIds = new Set(nextMembers.map((m) => m.id));
    onUpdateTrip((prev) => ({
      ...prev,
      members: nextMembers,
      expenses: prev.expenses.map((exp) => ({
        ...exp,
        paidByMemberId: validIds.has(exp.paidByMemberId)
          ? exp.paidByMemberId
          : nextMembers[0]?.id ?? "",
        assigneeIds: exp.assigneeIds.filter((id) => validIds.has(id)),
      })),
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleToggleTransferSettled = (transferKey: string) => {
    onUpdateTrip((prev) => {
      const exists = prev.settledTransferKeys.includes(transferKey);
      return {
        ...prev,
        settledTransferKeys: exists
          ? prev.settledTransferKeys.filter((k) => k !== transferKey)
          : [...prev.settledTransferKeys, transferKey],
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const buildSummaryText = () =>
    formatTripWhatsAppSummary({ trip, calc, shareUrl });

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

  const handleSaveTripImage = async () => {
    setExportingImage(true);
    try {
      await shareOrDownloadTripCardImage({ trip, calc });
    } finally {
      setExportingImage(false);
    }
  };

  const handleCopyTransferAccount = async (transfer: TripTransfer) => {
    const raw = transfer.toPaymentInfo?.accountNumber.trim();
    if (!raw) return;
    await navigator.clipboard.writeText(raw);
    markCopied(`acct-${transfer.key}`);
  };

  const handleNudgeTransfer = (transfer: TripTransfer) => {
    const text = formatTripTransferNudge({
      tripName: trip.name,
      currency: cur,
      transfer,
      shareUrl,
    });
    window.open(buildWhatsAppShareUrl(text), "_blank", "noopener,noreferrer");
  };

  const handleCopyShareLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    markCopied("link");
  };

  const commitNameEdit = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== trip.name) {
      onUpdateTrip((prev) => ({
        ...prev,
        name: trimmed,
        updatedAt: new Date().toISOString(),
      }));
    } else {
      setNameDraft(trip.name);
    }
    setEditingName(false);
  };

  return (
    <section className="space-y-4 pt-3 pb-28">
      {/* Top Trip Header Card */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={onBackToList}
              aria-label="Back to Trips"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            {editingName ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  commitNameEdit();
                }}
                className="min-w-0 flex-1"
              >
                <input
                  type="text"
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={commitNameEdit}
                  className="h-8 w-full rounded-lg border border-[var(--accent)] bg-[var(--bg-surface-2)] px-2 text-sm font-semibold text-[var(--text-primary)] focus:outline-none"
                />
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setNameDraft(trip.name);
                  setEditingName(true);
                }}
                className="group flex min-w-0 items-center gap-1.5 text-left"
              >
                <h1 className="truncate text-lg font-semibold tracking-tight text-[var(--text-primary)]">
                  {trip.name}
                </h1>
                <Pencil className="h-3 w-3 shrink-0 text-[var(--text-muted)] opacity-60 group-hover:opacity-100" />
              </button>
            )}
          </div>

          <div className="shrink-0 text-right">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Total Spend
            </p>
            <p className="font-mono text-base font-bold text-[var(--accent-text)] tabular-nums">
              {formatCurrency(calc.totalSpend, cur)}
            </p>
          </div>
        </div>

        {/* Crew chips + Manage Crew/Payment Info button */}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {trip.members.map((m) => (
              <span
                key={m.id}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--bg-surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: m.color }}
                />
                {m.name}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setMembersSheetOpen(true)}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2 text-[11px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          >
            <Users className="h-3 w-3 text-[var(--accent-text)]" />
            Crew &amp; Pay
          </button>
        </div>
      </div>

      {/* 3 Compact Tabs: Bills | Balances | Settle Up */}
      <div
        className="grid grid-cols-3 gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1"
        role="tablist"
      >
        {(
          [
            { id: "bills", label: `Bills (${trip.expenses.length})` },
            { id: "balances", label: "Balances" },
            {
              id: "settle",
              label:
                calc.transfers.length > 0
                  ? `Settle (${settledTransferCount}/${calc.transfers.length})`
                  : "Settle Up",
            },
          ] as const
        ).map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={`min-h-[36px] rounded-lg px-2 text-xs font-semibold transition-colors ${
                active
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: BILLS */}
      {tab === "bills" && (
        <div className="space-y-2.5">
          {trip.expenses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] p-7 text-center">
              <Receipt className="mx-auto h-7 w-7 text-[var(--text-muted)]" />
              <p className="mt-2.5 text-sm font-semibold text-[var(--text-primary)]">
                No bills in this trip yet
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Add a quick bill (hotel, Grab, tickets) or scan a restaurant
                receipt.
              </p>
              <button
                type="button"
                onClick={() =>
                  setExpenseSheet({ open: true, editing: null, mode: "quick" })
                }
                className="mt-4 inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 text-xs font-semibold text-white hover:bg-[var(--accent-hover)]"
              >
                <Plus className="h-4 w-4" />
                Add First Bill
              </button>
            </div>
          ) : (
            trip.expenses.map((expense) => {
              const summary = calc.expenseSummaries[expense.id];
              const payer = memberById.get(expense.paidByMemberId);
              const splitMemberIds = Object.keys(summary?.sharesByMemberId ?? {});
              const assigneeLabel =
                expense.mode === "itemized"
                  ? `${expense.items?.length ?? 0} items · itemized`
                  : splitMemberIds.length === trip.members.length
                    ? "Split equally (all)"
                    : splitMemberIds
                        .map((id) => memberById.get(id)?.name)
                        .filter(Boolean)
                        .join(", ") || "Unassigned";

              return (
                <div
                  key={expense.id}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 transition-colors hover:border-[var(--border-strong)]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-surface-2)] text-[var(--accent-text)]">
                    <CategoryIcon category={expense.category} />
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setExpenseSheet({
                        open: true,
                        editing: expense,
                        mode: expense.mode,
                      })
                    }
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                      {expense.title}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-[var(--text-secondary)]">
                      Paid by{" "}
                      <strong className="text-[var(--text-primary)]">
                        {payer?.name ?? "Unknown"}
                      </strong>{" "}
                      · {assigneeLabel}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                      {expense.date}
                    </p>
                  </button>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="font-mono text-sm font-bold text-[var(--text-primary)] tabular-nums">
                      {formatCurrency(summary?.total ?? expense.amount, cur)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteExpenseWithUndo(expense.id)}
                      aria-label={`Delete ${expense.title}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: BALANCES */}
      {tab === "balances" && (
        <div className="space-y-2.5">
          {calc.balances.map((bal) => {
            const hasPay = hasPaymentInfo(bal.paymentInfo);
            return (
              <div
                key={bal.memberId}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: bal.color }}
                    />
                    <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
                      {bal.name}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 font-mono text-sm font-bold tabular-nums ${
                      bal.netBalance > 0
                        ? "text-[var(--accent-text)]"
                        : bal.netBalance < 0
                          ? "text-[var(--warning-text)]"
                          : "text-[var(--text-muted)]"
                    }`}
                  >
                    {bal.netBalance > 0
                      ? `+${formatCurrency(bal.netBalance, cur)}`
                      : formatCurrency(bal.netBalance, cur)}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-[var(--border-subtle)] pt-2 text-[11px] text-[var(--text-secondary)]">
                  <span>
                    Paid{" "}
                    <strong className="font-mono text-[var(--text-primary)] tabular-nums">
                      {formatCurrency(bal.totalPaid, cur)}
                    </strong>{" "}
                    · Share{" "}
                    <strong className="font-mono text-[var(--text-primary)] tabular-nums">
                      {formatCurrency(bal.totalShare, cur)}
                    </strong>
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {bal.netBalance > 0
                      ? "Gets back"
                      : bal.netBalance < 0
                        ? "Owes"
                        : "Settled"}
                  </span>
                </div>

                {bal.netBalance > 0 && !hasPay && (
                  <button
                    type="button"
                    onClick={() => setMembersSheetOpen(true)}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-text)] hover:opacity-85"
                  >
                    <Wallet className="h-3 w-3" />
                    Add {bal.name}&apos;s bank / e-wallet so friends can pay
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: SETTLE UP */}
      {tab === "settle" && (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Minimum Transfers ({calc.transfers.length})
            </h2>
            <button
              type="button"
              disabled={exportingImage}
              onClick={handleSaveTripImage}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-[11px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
            >
              {exportingImage ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ImageDown className="h-3 w-3 text-[var(--accent-text)]" />
              )}
              Save Card
            </button>
          </div>

          {calc.transfers.length === 0 ? (
            <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent-soft)] p-5 text-center">
              <CheckCircle2 className="mx-auto h-6 w-6 text-[var(--accent-text)]" />
              <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                Everyone is completely settled!
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Add more trip bills anytime and transfers will recalculate
                automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {calc.transfers.map((transfer) => {
                const isSettled = settledSet.has(transfer.key);
                const payInfo = transfer.toPaymentInfo;
                const hasPay = hasPaymentInfo(payInfo);

                return (
                  <article
                    key={transfer.key}
                    className={`rounded-2xl border p-3.5 transition-colors ${
                      isSettled
                        ? "border-[var(--accent)]/35 bg-[var(--bg-surface)]/80"
                        : "border-[var(--border-subtle)] bg-[var(--bg-surface)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: transfer.fromColor }}
                        />
                        <span className="truncate">{transfer.fromName}</span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: transfer.toColor }}
                        />
                        <span className="truncate">{transfer.toName}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleTransferSettled(transfer.key)}
                        className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold transition-colors ${
                          isSettled
                            ? "border-[var(--accent)]/45 bg-[var(--accent-soft)] text-[var(--accent-text)]"
                            : "border-[var(--border-subtle)] bg-[var(--bg-surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
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
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span
                        className={`font-mono text-lg font-bold tabular-nums ${
                          isSettled
                            ? "text-[var(--text-muted)] line-through"
                            : "text-[var(--accent-text)]"
                        }`}
                      >
                        {formatCurrency(transfer.amount, cur)}
                      </span>

                      {!isSettled && (
                        <button
                          type="button"
                          onClick={() => handleNudgeTransfer(transfer)}
                          className="inline-flex h-7 items-center gap-1 rounded-lg bg-[var(--accent-soft)] px-2.5 text-[11px] font-semibold text-[var(--accent-text)] hover:opacity-90"
                        >
                          <Send className="h-3 w-3" />
                          Nudge {transfer.fromName}
                        </button>
                      )}
                    </div>

                    {/* Creditor's per-member payment info */}
                    {hasPay && payInfo ? (
                      <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs font-semibold text-[var(--text-primary)]">
                            {[payInfo.provider, payInfo.accountNumber]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          {payInfo.accountName && (
                            <p className="truncate text-[10px] text-[var(--text-muted)]">
                              a/n {payInfo.accountName}
                            </p>
                          )}
                        </div>
                        {payInfo.accountNumber.trim() && (
                          <button
                            type="button"
                            onClick={() => handleCopyTransferAccount(transfer)}
                            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg bg-[var(--bg-surface)] px-2.5 text-[11px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                          >
                            {copiedId === `acct-${transfer.key}` ? (
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
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setMembersSheetOpen(true)}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--accent-text)]"
                      >
                        <Wallet className="h-3 w-3" />
                        Add {transfer.toName}&apos;s bank / e-wallet
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {/* Save Trip & Public Share Link Card */}
          {supabaseEnabled && (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5">
              {isSignedIn ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {trip.savedTripId ? (
                        <CloudCheck className="h-4 w-4 text-[var(--accent-text)]" />
                      ) : (
                        <Globe className="h-4 w-4 text-[var(--text-secondary)]" />
                      )}
                      <span className="text-xs font-semibold text-[var(--text-primary)]">
                        {trip.savedTripId
                          ? "Synced to cloud"
                          : "Save trip & create share link"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {trip.savedTripId && (
                        <button
                          type="button"
                          onClick={() => onToggleTripPublic(!trip.isPublic)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                          {trip.isPublic ? (
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
                      )}
                      <button
                        type="button"
                        disabled={savingTrip}
                        onClick={onSaveTripToCloud}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--bg-surface-2)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-60"
                      >
                        {savingTrip ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        {trip.savedTripId ? "Sync" : "Save"}
                      </button>
                    </div>
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
                        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg bg-[var(--bg-surface)] px-2.5 text-[11px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                      >
                        {copiedId === "link" ? (
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
                      Share one live link with the whole crew?
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Sign in with Google to sync trips &amp; create{" "}
                      <code className="font-mono">/trip/...</code> links.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenAccount}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-2)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                  >
                    <UserCheck className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                    Sign in
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sticky Bottom Action Bar (context-aware per tab) */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border-subtle)] bg-[var(--bg-app)]/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-md items-center gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {tab === "settle" ? (
            <>
              <button
                type="button"
                onClick={handleCopySummary}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
              >
                {copiedId === "summary" ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Copied Trip Summary!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy Trip Summary</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-4 text-xs font-semibold text-[var(--accent-text)] hover:opacity-90"
              >
                <MessageCircle className="h-4 w-4" />
                <span>WhatsApp</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() =>
                  setExpenseSheet({ open: true, editing: null, mode: "quick" })
                }
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
              >
                <Plus className="h-4 w-4" />
                <span>Add Bill</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setExpenseSheet({
                    open: true,
                    editing: null,
                    mode: "itemized",
                  })
                }
                className="flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              >
                <Camera className="h-4 w-4 text-[var(--accent-text)]" />
                <span>Itemized / Scan</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <TripMembersSheet
        open={membersSheetOpen}
        onClose={() => setMembersSheetOpen(false)}
        members={trip.members}
        savedFriends={savedFriends}
        onChangeMembers={handleChangeMembers}
      />

      {expenseSheet.open && (
        <TripExpenseSheet
          key={expenseSheet.editing?.id ?? `new-${expenseSheet.mode}`}
          open={expenseSheet.open}
          onClose={() =>
            setExpenseSheet({ open: false, editing: null, mode: "quick" })
          }
          currency={trip.currency}
          members={trip.members}
          initialExpense={expenseSheet.editing}
          initialMode={expenseSheet.mode}
          isSignedIn={isSignedIn}
          onRequireSignIn={() => {
            setExpenseSheet({ open: false, editing: null, mode: "quick" });
            onOpenAccount();
          }}
          onQuotaUpdate={onQuotaUpdate}
          onSave={handleSaveExpense}
        />
      )}
    </section>
  );
}
