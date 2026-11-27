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
    <section className="space-y-5 pt-4 pb-12">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
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
          className="group flex min-h-[76px] w-full items-center gap-4 rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)] px-5 py-4 text-left text-white transition-all hover:bg-[var(--accent-hover)] active:scale-[0.99]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Plus className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold tracking-tight">
              Start a New Trip
            </p>
            <p className="mt-0.5 text-xs text-white/85">
              Combine quick bills &amp; scanned receipts under one crew
            </p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 opacity-80 transition-transform group-hover:translate-x-0.5" />
        </button>

        <button
          type="button"
          onClick={onTrySampleTrip}
          className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-strong)] px-4 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/50 hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
        >
          <Sparkles className="h-4 w-4 text-[var(--accent-text)]" />
          <span>Try Sample Trip (Bali Weekend)</span>
        </button>
      </div>

      {/* Trips List */}
      <div className="space-y-2.5">
        <h2 className="px-0.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Your Trips ({trips.length})
        </h2>

        {trips.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 text-center">
            <Compass className="mx-auto h-7 w-7 text-[var(--text-muted)]" />
            <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
              No trips yet
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Create a trip above or tap &ldquo;Try Sample Trip&rdquo; to see
              multi-bill debt simplification in action.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
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
                  className="flex items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 transition-colors hover:border-[var(--border-strong)]"
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

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                      <span>
                        {trip.expenses.length} bill
                        {trip.expenses.length === 1 ? "" : "s"} ·{" "}
                        {trip.members.length} people
                      </span>
                      {allSettled ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-text)]">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          Settled
                        </span>
                      ) : calc.transfers.length > 0 ? (
                        <span className="rounded-full bg-[var(--bg-surface-2)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
                          {settledCount}/{calc.transfers.length} transfers
                        </span>
                      ) : null}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteTrip(trip.id)}
                    aria-label={`Delete ${trip.name}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)]"
                  >
                    <Trash2 className="h-4 w-4" />
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
              <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                Trip Name
              </span>
              <input
                type="text"
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                placeholder="e.g. Bali Weekend, Bandung Roadtrip"
                className="mt-1 h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                Currency
              </span>
              <select
                value={tripCurrency}
                onChange={(e) =>
                  setTripCurrency(e.target.value as CurrencyCode)
                }
                className="mt-1 h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2.5 font-mono text-xs font-semibold text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
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
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">
              Crew ({draftMembers.length})
            </span>

            <div className="flex flex-wrap gap-1.5">
              {draftMembers.map((member) => (
                <div
                  key={member.id}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] pl-2.5 pr-1.5 text-xs font-medium text-[var(--text-primary)]"
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
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)]"
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
                className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
              />
              <button
                type="submit"
                disabled={!memberInput.trim()}
                className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl bg-[var(--bg-hover)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent)] hover:text-white disabled:opacity-45"
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
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--accent)]/35 bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent-text)]"
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
                    className="shrink-0 rounded-full border border-dashed border-[var(--border-strong)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
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
            className="min-h-[48px] w-full rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-45"
          >
            Create Trip
          </button>
        </div>
      </BottomSheet>
    </section>
  );
}
