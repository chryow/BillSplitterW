"use client";

import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { BottomSheet } from "@/components/layout/BottomSheet";
import { TripDetailView } from "@/components/trips/TripDetailView";
import { DEFAULT_QUICK_NAMES, PARTICIPANT_COLORS } from "@/lib/config";
import { CURRENCY_LIST, formatCurrency } from "@/lib/currency";
import { calculateTrip } from "@/lib/trip-engine";
import type {
  CurrencyCode,
  PaymentInfo,
  SavedFriend,
  ScanQuota,
  Trip,
  TripMember,
} from "@/lib/types";

interface TripsViewProps {
  trips: Trip[];
  activeTripId: string | null;
  defaultSelfName: string;
  defaultPaymentInfo: PaymentInfo;
  savedFriends: SavedFriend[];
  isSignedIn: boolean;
  supabaseEnabled: boolean;
  savingTrip: boolean;
  onSelectTrip: (tripId: string | null) => void;
  onCreateTrip: (
    name: string,
    currency: CurrencyCode,
    members: TripMember[]
  ) => void;
  onTrySampleTrip: () => void;
  onUpdateTrip: (tripId: string, updater: (prev: Trip) => Trip) => void;
  onDeleteTrip: (tripId: string) => void;
  onDeleteExpenseWithUndo: (tripId: string, expenseId: string) => void;
  onSaveTripToCloud: (tripId: string) => void;
  onToggleTripPublic: (tripId: string, nextPublic: boolean) => void;
  onOpenAccount: () => void;
  onQuotaUpdate: (next: ScanQuota) => void;
}

export function TripsView({
  trips,
  activeTripId,
  defaultSelfName,
  defaultPaymentInfo,
  savedFriends,
  isSignedIn,
  supabaseEnabled,
  savingTrip,
  onSelectTrip,
  onCreateTrip,
  onTrySampleTrip,
  onUpdateTrip,
  onDeleteTrip,
  onDeleteExpenseWithUndo,
  onSaveTripToCloud,
  onToggleTripPublic,
  onOpenAccount,
  onQuotaUpdate,
}: TripsViewProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [tripName, setTripName] = useState("");
  const [tripCurrency, setTripCurrency] = useState<CurrencyCode>("IDR");
  const [memberInput, setMemberInput] = useState("");
  const [draftMembers, setDraftMembers] = useState<TripMember[]>([]);

  const activeTrip = trips.find((t) => t.id === activeTripId) ?? null;

  const openCreateSheet = () => {
    setTripName("");
    setTripCurrency("IDR");
    setMemberInput("");
    setDraftMembers([
      {
        id: `tm-${Date.now()}-0`,
        name: defaultSelfName,
        color: PARTICIPANT_COLORS[0],
        paymentInfo: defaultPaymentInfo,
      },
    ]);
    setCreateOpen(true);
  };

  const addDraftMember = (rawName: string, preferredColor?: string) => {
    const trimmed = rawName.trim();
    if (!trimmed) return;
    if (
      draftMembers.some(
        (m) => m.name.trim().toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      setMemberInput("");
      return;
    }
    const used = new Set(draftMembers.map((m) => m.color));
    const color =
      preferredColor ??
      PARTICIPANT_COLORS.find((c) => !used.has(c)) ??
      PARTICIPANT_COLORS[draftMembers.length % PARTICIPANT_COLORS.length];

    setDraftMembers((prev) => [
      ...prev,
      {
        id: `tm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: trimmed,
        color,
      },
    ]);
    setMemberInput("");
  };

  const handleCreateSubmit = () => {
    if (!tripName.trim() || draftMembers.length === 0) return;
    onCreateTrip(tripName.trim(), tripCurrency, draftMembers);
    setCreateOpen(false);
  };

  if (activeTrip) {
    return (
      <TripDetailView
        trip={activeTrip}
        savedFriends={savedFriends}
        isSignedIn={isSignedIn}
        supabaseEnabled={supabaseEnabled}
        savingTrip={savingTrip}
        onBackToList={() => onSelectTrip(null)}
        onUpdateTrip={(updater) => onUpdateTrip(activeTrip.id, updater)}
        onDeleteExpenseWithUndo={(expenseId) =>
          onDeleteExpenseWithUndo(activeTrip.id, expenseId)
        }
        onSaveTripToCloud={() => onSaveTripToCloud(activeTrip.id)}
        onToggleTripPublic={(nextPublic) =>
          onToggleTripPublic(activeTrip.id, nextPublic)
        }
        onOpenAccount={onOpenAccount}
        onQuotaUpdate={onQuotaUpdate}
      />
    );
  }

  const existingDraftLower = new Set(
    draftMembers.map((m) => m.name.trim().toLowerCase())
  );
  const availableSavedFriends = savedFriends.filter(
    (f) => !existingDraftLower.has(f.name.trim().toLowerCase())
  );
  const quickSuggestions = DEFAULT_QUICK_NAMES.filter(
    (n) =>
      !existingDraftLower.has(n.toLowerCase()) &&
      !savedFriends.some((f) => f.name.trim().toLowerCase() === n.toLowerCase())
  ).slice(0, 4);

  return (
    <section className="space-y-5 pt-5 pb-10">
      <div className="space-y-2 border-b border-[var(--border-subtle)] pb-4">
        <p className="micro-label flex items-center gap-2 text-[var(--text-muted)]">
          <span
            aria-hidden="true"
            className="inline-block h-[5px] w-[5px] bg-[var(--accent)]"
          />
          <span>Multi-Bill Trip Ledger</span>
        </p>
        <h1 className="font-editorial text-[28px] leading-[1.15] font-semibold tracking-tight text-[var(--text-primary)]">
          Group Trips &amp; Tabs
        </h1>
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          Track multiple bills paid by different friends and simplify everyone
          into the fewest transfers.
        </p>
      </div>

      {/* Primary Actions */}
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={openCreateSheet}
          className="group flex min-h-[76px] w-full items-center gap-4 rounded-[3px] border border-[var(--border-strong)] bg-[var(--accent)] px-4 py-4 text-left text-[#F7F5F0] transition-colors duration-150 ease-out hover:bg-[var(--accent-hover)]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[2px] border border-[#F7F5F0]/35 bg-[#1A1A18]/15">
            <Plus className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-editorial text-lg font-semibold tracking-tight">
              Start a New Trip
            </p>
            <p className="mt-0.5 text-xs text-[#F7F5F0]/90">
              Combine quick bills &amp; scanned receipts under one crew
            </p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
        </button>

        <button
          type="button"
          onClick={onTrySampleTrip}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[3px] border border-dashed border-[var(--border-subtle)] px-4 font-mono text-xs font-medium uppercase tracking-[0.06em] text-[var(--text-secondary)] transition-colors duration-150 ease-out hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
        >
          <Sparkles className="h-3.5 w-3.5 text-[var(--accent-text)]" />
          <span>Try Sample Trip (Bali Weekend)</span>
        </button>
      </div>

      {/* Trips Ledger List */}
      <div className="rounded-[3px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-3.5 py-2.5">
          <h2 className="micro-label font-semibold text-[var(--text-primary)]">
            Your Trips ({trips.length})
          </h2>
          <span className="micro-label text-[var(--text-muted)]">
            Total Spend
          </span>
        </div>

        {trips.length === 0 ? (
          <div className="p-6 text-center">
            <Compass className="mx-auto h-6 w-6 text-[var(--text-muted)]" />
            <p className="mt-2 font-editorial text-base font-semibold text-[var(--text-primary)]">
              No trips yet
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Create a trip above or tap &ldquo;Try Sample Trip&rdquo; to see
              multi-bill debt simplification in action.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {trips.map((trip) => {
              const calc = calculateTrip({
                currency: trip.currency,
                members: trip.members,
                expenses: trip.expenses,
              });
              const settledCount = calc.transfers.filter((t) =>
                trip.settledTransferKeys.includes(t.key)
              ).length;
              const allSettled =
                calc.transfers.length > 0 &&
                settledCount === calc.transfers.length;

              return (
                <div
                  key={trip.id}
                  className="flex items-center gap-2 px-3.5 py-3 transition-colors duration-150 ease-out hover:bg-[var(--bg-surface-2)]/60"
                >
                  <button
                    type="button"
                    onClick={() => onSelectTrip(trip.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {trip.name}
                      </p>
                      <span className="shrink-0 font-mono text-sm font-bold text-[var(--accent-text)] tabular-nums">
                        {formatCurrency(calc.totalSpend, trip.currency)}
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-muted)]">
                      <span>
                        {trip.expenses.length} bill
                        {trip.expenses.length === 1 ? "" : "s"} &middot;{" "}
                        {trip.members.length} people
                      </span>
                      {allSettled ? (
                        <span className="inline-flex items-center gap-0.5 rounded-[2px] border border-[var(--success-border)] bg-[var(--success-soft)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--success-text)]">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          Settled
                        </span>
                      ) : calc.transfers.length > 0 ? (
                        <span className="rounded-[2px] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-1.5 py-0.5 text-[9px] text-[var(--text-secondary)]">
                          {settledCount}/{calc.transfers.length} transfers
                        </span>
                      ) : null}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteTrip(trip.id)}
                    aria-label={`Delete ${trip.name}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[2px] text-[var(--text-muted)] transition-colors duration-150 ease-out hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create New Trip Bottom Sheet */}
      <BottomSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Trip"
        subtitle="Set a base currency and add your travel crew"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <label className="block sm:col-span-2">
              <span className="micro-label block text-[var(--text-muted)]">
                Trip Name
              </span>
              <input
                type="text"
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                placeholder="e.g. Bali Weekend, Bandung Roadtrip"
                className="mt-1.5 h-9 w-full rounded-[3px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-strong)] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="micro-label block text-[var(--text-muted)]">
                Currency
              </span>
              <select
                value={tripCurrency}
                onChange={(e) =>
                  setTripCurrency(e.target.value as CurrencyCode)
                }
                className="mt-1.5 h-9 w-full rounded-[3px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 font-mono text-xs font-semibold text-[var(--text-primary)] focus:border-[var(--border-strong)] focus:outline-none"
              >
                {CURRENCY_LIST.map((cur) => (
                  <option key={cur.code} value={cur.code}>
                    {cur.flag} {cur.code}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-2">
            <span className="micro-label block text-[var(--text-muted)]">
              Crew ({draftMembers.length})
            </span>

            <div className="flex flex-wrap gap-1.5">
              {draftMembers.map((member) => (
                <div
                  key={member.id}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[2px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] pl-2.5 pr-1.5 text-xs font-medium text-[var(--text-primary)]"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: member.color }}
                  />
                  <span>{member.name}</span>
                  {draftMembers.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setDraftMembers((prev) =>
                          prev.filter((m) => m.id !== member.id)
                        )
                      }
                      aria-label={`Remove ${member.name}`}
                      className="flex h-5 w-5 items-center justify-center rounded-[2px] text-[var(--text-muted)] hover:text-[var(--danger-text)]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                addDraftMember(memberInput);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={memberInput}
                onChange={(e) => setMemberInput(e.target.value)}
                placeholder="Add friend..."
                className="h-9 min-w-0 flex-1 rounded-[3px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--border-strong)] focus:outline-none"
              />
              <button
                type="submit"
                disabled={!memberInput.trim()}
                className="inline-flex h-9 shrink-0 items-center gap-1 rounded-[3px] border border-[var(--border-strong)] bg-[var(--ink-solid)] px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-on-solid)] transition-colors duration-150 ease-out hover:bg-[var(--ink-solid-hover)] disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </form>

            {(availableSavedFriends.length > 0 ||
              quickSuggestions.length > 0) && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                {availableSavedFriends.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => addDraftMember(f.name, f.color)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-[2px] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-primary)]"
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: f.color }}
                    />
                    + {f.name}
                  </button>
                ))}
                {quickSuggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => addDraftMember(name)}
                    className="shrink-0 rounded-[2px] border border-dashed border-[var(--border-subtle)] px-2.5 py-1 font-mono text-[11px] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                  >
                    + {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={!tripName.trim() || draftMembers.length === 0}
            onClick={handleCreateSubmit}
            className="min-h-[44px] w-full rounded-[3px] border border-[var(--border-strong)] bg-[var(--accent)] px-4 font-mono text-xs font-semibold uppercase tracking-[0.06em] text-[#F7F5F0] transition-colors duration-150 ease-out hover:bg-[var(--accent-hover)] disabled:opacity-45"
          >
            Create Trip
          </button>
        </div>
      </BottomSheet>
    </section>
  );
}
