"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  Minus,
  Plus,
  SlidersHorizontal,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { DEFAULT_QUICK_NAMES, PARTICIPANT_COLORS } from "@/lib/config";
import { formatCurrency } from "@/lib/currency";
import type {
  BillItem,
  BillState,
  Participant,
  SavedFriend,
} from "@/lib/types";

interface AssignStepProps {
  bill: BillState;
  savedFriends: SavedFriend[];
  isSignedIn: boolean;
  onUpdateBill: (updater: (prev: BillState) => BillState) => void;
  onSaveFriend: (name: string, color: string) => void;
  onDeleteSavedFriend: (friendId: string) => void;
  onBack: () => void;
  onNext: () => void;
}

function getShareWeight(item: BillItem, participantId: string): number {
  const w = item.assigneeShares?.[participantId];
  return typeof w === "number" && Number.isFinite(w) && w >= 1
    ? Math.round(w)
    : 1;
}

export function AssignStep({
  bill,
  savedFriends,
  isSignedIn,
  onUpdateBill,
  onSaveFriend,
  onDeleteSavedFriend,
  onBack,
  onNext,
}: AssignStepProps) {
  const [newName, setNewName] = useState("");
  const [activeItemId, setActiveItemId] = useState<string | null>(
    bill.items[0]?.id ?? null
  );
  const [customShareItemIds, setCustomShareItemIds] = useState<
    Record<string, boolean>
  >({});

  const cur = bill.currency;
  const existingNamesLower = new Set(
    bill.participants.map((p) => p.name.trim().toLowerCase())
  );
  const savedNamesLower = new Set(
    savedFriends.map((f) => f.name.trim().toLowerCase())
  );

  const nextColor = (): string => {
    const used = new Set(bill.participants.map((p) => p.color));
    const free = PARTICIPANT_COLORS.find((c) => !used.has(c));
    return (
      free ??
      PARTICIPANT_COLORS[bill.participants.length % PARTICIPANT_COLORS.length]
    );
  };

  const addParticipant = (rawName: string, preferredColor?: string) => {
    const trimmed = rawName.trim();
    if (!trimmed) return;
    if (existingNamesLower.has(trimmed.toLowerCase())) {
      setNewName("");
      return;
    }

    const participant: Participant = {
      id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      color: preferredColor ?? nextColor(),
    };

    onUpdateBill((prev) => ({
      ...prev,
      participants: [...prev.participants, participant],
      paidByParticipantId: prev.paidByParticipantId ?? participant.id,
    }));
    setNewName("");
  };

  const removeParticipant = (participantId: string) => {
    if (bill.participants.length <= 1) return;
    onUpdateBill((prev) => {
      const remaining = prev.participants.filter((p) => p.id !== participantId);
      const nextPaidBy =
        prev.paidByParticipantId === participantId
          ? remaining[0]?.id ?? null
          : prev.paidByParticipantId;

      return {
        ...prev,
        participants: remaining,
        paidByParticipantId: nextPaidBy,
        settledParticipantIds: prev.settledParticipantIds.filter(
          (id) => id !== participantId
        ),
        items: prev.items.map((item) => {
          const nextShares = item.assigneeShares
            ? { ...item.assigneeShares }
            : undefined;
          if (nextShares) {
            delete nextShares[participantId];
          }
          return {
            ...item,
            assigneeIds: item.assigneeIds.filter((id) => id !== participantId),
            assigneeShares: nextShares,
          };
        }),
      };
    });
  };

  const toggleItemAssignee = (itemId: string, participantId: string) => {
    onUpdateBill((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== itemId) return item;
        const exists = item.assigneeIds.includes(participantId);
        const nextShares = item.assigneeShares ? { ...item.assigneeShares } : {};
        if (exists) {
          delete nextShares[participantId];
        } else if (!nextShares[participantId]) {
          nextShares[participantId] = 1;
        }
        return {
          ...item,
          assigneeIds: exists
            ? item.assigneeIds.filter((id) => id !== participantId)
            : [...item.assigneeIds, participantId],
          assigneeShares:
            Object.keys(nextShares).length > 0 ? nextShares : undefined,
        };
      }),
    }));
  };

  const adjustItemShare = (
    itemId: string,
    participantId: string,
    delta: number
  ) => {
    onUpdateBill((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== itemId) return item;
        const current = getShareWeight(item, participantId);
        const nextWeight = Math.min(20, Math.max(1, current + delta));
        return {
          ...item,
          assigneeShares: {
            ...(item.assigneeShares ?? {}),
            [participantId]: nextWeight,
          },
        };
      }),
    }));
  };

  const resetItemSharesEqual = (itemId: string) => {
    onUpdateBill((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId ? { ...item, assigneeShares: undefined } : item
      ),
    }));
  };

  const splitItemAll = (itemId: string) => {
    const allIds = bill.participants.map((p) => p.id);
    onUpdateBill((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== itemId) return item;
        const alreadyAll =
          allIds.length > 0 &&
          allIds.every((id) => item.assigneeIds.includes(id));
        return {
          ...item,
          assigneeIds: alreadyAll ? [] : allIds,
          assigneeShares: undefined,
        };
      }),
    }));
  };

  const participantById = new Map(bill.participants.map((p) => [p.id, p]));
  const assignedCount = bill.items.filter((i) => i.assigneeIds.length > 0).length;
  const totalItems = bill.items.length;

  const quickSuggestions = DEFAULT_QUICK_NAMES.filter(
    (name) =>
      !existingNamesLower.has(name.toLowerCase()) &&
      !savedNamesLower.has(name.toLowerCase())
  ).slice(0, 4);

  const availableSavedFriends = savedFriends.filter(
    (f) => !existingNamesLower.has(f.name.trim().toLowerCase())
  );

  return (
    <section className="space-y-4 pt-3 pb-28">
      {/* Participants Panel */}
      <div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            People ({bill.participants.length})
          </h2>
          <span className="text-[11px] text-[var(--text-muted)]">
            Tap items below to assign
          </span>
        </div>

        {/* Active Participant Chips */}
        <div className="flex flex-wrap gap-1.5">
          {bill.participants.map((person) => {
            const canSaveFriend =
              isSignedIn &&
              person.name.toLowerCase() !== "you" &&
              !savedNamesLower.has(person.name.trim().toLowerCase());

            return (
              <div
                key={person.id}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] pl-2.5 pr-1.5 text-xs font-medium text-[var(--text-primary)]"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: person.color }}
                />
                <span>{person.name}</span>
                {canSaveFriend && (
                  <button
                    type="button"
                    onClick={() => onSaveFriend(person.name, person.color)}
                    title={`Save ${person.name} to frequent friends`}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--accent-text)]"
                  >
                    <Bookmark className="h-3 w-3" />
                  </button>
                )}
                {bill.participants.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeParticipant(person.id)}
                    aria-label={`Remove ${person.name}`}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Add Person Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addParticipant(newName);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Add person (e.g. Budi, Sari)..."
            className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl bg-[var(--bg-hover)] px-3.5 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--accent)] hover:text-white disabled:opacity-45"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </form>

        {/* Quick-Add Suggestions + Saved Friends */}
        {(availableSavedFriends.length > 0 || quickSuggestions.length > 0) && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {availableSavedFriends.map((friend) => (
              <div
                key={friend.id}
                className="inline-flex shrink-0 items-center rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[11px] font-medium text-[var(--accent-text)]"
              >
                <button
                  type="button"
                  onClick={() => addParticipant(friend.name, friend.color)}
                  className="flex items-center gap-1 py-1 pl-2.5 pr-1.5"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: friend.color }}
                  />
                  <span>+ {friend.name}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteSavedFriend(friend.id)}
                  aria-label={`Remove ${friend.name} from saved friends`}
                  className="pr-2 opacity-60 hover:opacity-100"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
            {quickSuggestions.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => addParticipant(name)}
                className="shrink-0 rounded-full border border-dashed border-[var(--border-strong)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--text-primary)]"
              >
                + {name}
              </button>
            ))}
          </div>
        )}

        {/* Who Paid the Bill selector */}
        {bill.participants.length > 1 && (
          <div className="flex items-center gap-2 border-t border-[var(--border-subtle)] pt-2.5">
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-[var(--text-muted)]">
              <Wallet className="h-3 w-3" />
              Paid by:
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {bill.participants.map((person) => {
                const isPayer = bill.paidByParticipantId === person.id;
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() =>
                      onUpdateBill((prev) => ({
                        ...prev,
                        paidByParticipantId: person.id,
                        settledParticipantIds: prev.settledParticipantIds.filter(
                          (id) => id !== person.id
                        ),
                      }))
                    }
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
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
        )}
      </div>

      {/* Tap-to-Assign Items */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Assign Items ({assignedCount}/{totalItems})
          </h2>
          {assignedCount < totalItems && (
            <span className="text-[11px] font-medium text-[var(--warning-text)]">
              {totalItems - assignedCount} unassigned
            </span>
          )}
        </div>

        <div className="space-y-2">
          {bill.items.map((item: BillItem) => {
            const isOpen = activeItemId === item.id;
            const assignees = item.assigneeIds
              .map((id) => participantById.get(id))
              .filter((p): p is Participant => Boolean(p));
            const allAssigned =
              bill.participants.length > 0 &&
              bill.participants.every((p) => item.assigneeIds.includes(p.id));
            const weights = assignees.map((p) => getShareWeight(item, p.id));
            const totalShares = weights.reduce((a, b) => a + b, 0);
            const hasCustomWeights =
              assignees.length > 1 && weights.some((w) => w !== weights[0]);
            const showCustomSteppers =
              assignees.length > 1 &&
              (Boolean(customShareItemIds[item.id]) || hasCustomWeights);

            return (
              <div
                key={item.id}
                className={`rounded-2xl border transition-colors ${
                  isOpen
                    ? "border-[var(--accent)]/45 bg-[var(--bg-surface)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveItemId(isOpen ? null : item.id)}
                  className="flex min-h-[58px] w-full items-center justify-between gap-3 px-3.5 py-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {item.qty > 1 && (
                        <span className="rounded-md bg-[var(--bg-surface-2)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--text-secondary)]">
                          {item.qty}x
                        </span>
                      )}
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {item.name || "Unnamed item"}
                      </p>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {assignees.length === 0 ? (
                        <span className="text-[11px] text-[var(--warning-text)]">
                          Tap to assign
                        </span>
                      ) : (
                        assignees.map((p) => {
                          const w = getShareWeight(item, p.id);
                          return (
                            <span
                              key={p.id}
                              className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]"
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: p.color }}
                              />
                              {p.name}
                              {hasCustomWeights && (
                                <span className="font-mono text-[10px] text-[var(--accent-text)]">
                                  {w}/{totalShares}
                                </span>
                              )}
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-semibold text-[var(--text-primary)] tabular-nums">
                      {formatCurrency(item.totalPrice, cur)}
                    </p>
                    {assignees.length > 1 && (
                      <p className="font-mono text-[11px] text-[var(--text-muted)] tabular-nums">
                        {hasCustomWeights
                          ? weights.join(":")
                          : `÷${assignees.length}`}
                      </p>
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="space-y-3 border-t border-[var(--border-subtle)] px-3.5 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {bill.participants.map((person) => {
                        const selected = item.assigneeIds.includes(person.id);
                        return (
                          <button
                            key={person.id}
                            type="button"
                            onClick={() =>
                              toggleItemAssignee(item.id, person.id)
                            }
                            className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-all active:scale-[0.98] ${
                              selected
                                ? "border-[var(--accent)]/60 bg-[var(--accent-soft)] text-[var(--text-primary)]"
                                : "border-[var(--border-subtle)] bg-[var(--bg-surface-2)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                            }`}
                          >
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: person.color }}
                            />
                            <span>{person.name}</span>
                            {selected && (
                              <Check className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                            )}
                          </button>
                        );
                      })}

                      {bill.participants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => splitItemAll(item.id)}
                          className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors ${
                            allAssigned
                              ? "border-[var(--border-strong)] bg-[var(--bg-hover)] text-[var(--text-primary)]"
                              : "border-dashed border-[var(--border-strong)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50 hover:text-[var(--text-primary)]"
                          }`}
                        >
                          <Users className="h-3.5 w-3.5" />
                          {allAssigned ? "Clear All" : "Split All"}
                        </button>
                      )}
                    </div>

                    {/* Unequal Custom Share Steppers (only surfaced when 2+ people share this item) */}
                    {assignees.length > 1 && (
                      <div className="border-t border-[var(--border-subtle)] pt-2.5">
                        {!showCustomSteppers ? (
                          <button
                            type="button"
                            onClick={() =>
                              setCustomShareItemIds((prev) => ({
                                ...prev,
                                [item.id]: true,
                              }))
                            }
                            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-text)]"
                          >
                            <SlidersHorizontal className="h-3 w-3" />
                            Adjust unequal shares (e.g. 2:1 portions)
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-medium text-[var(--text-muted)]">
                                Custom shares (total {totalShares})
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  resetItemSharesEqual(item.id);
                                  setCustomShareItemIds((prev) => ({
                                    ...prev,
                                    [item.id]: false,
                                  }));
                                }}
                                className="text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                              >
                                Reset equal
                              </button>
                            </div>
                            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                              {assignees.map((person) => {
                                const weight = getShareWeight(item, person.id);
                                return (
                                  <div
                                    key={person.id}
                                    className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2.5 py-1.5"
                                  >
                                    <div className="flex min-w-0 items-center gap-1.5">
                                      <span
                                        className="h-2 w-2 shrink-0 rounded-full"
                                        style={{ backgroundColor: person.color }}
                                      />
                                      <span className="truncate text-xs font-medium text-[var(--text-primary)]">
                                        {person.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        disabled={weight <= 1}
                                        onClick={() =>
                                          adjustItemShare(item.id, person.id, -1)
                                        }
                                        aria-label={`Decrease ${person.name}'s share`}
                                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-35"
                                      >
                                        <Minus className="h-3 w-3" />
                                      </button>
                                      <span className="w-7 text-center font-mono text-xs font-semibold text-[var(--text-primary)] tabular-nums">
                                        {weight}×
                                      </span>
                                      <button
                                        type="button"
                                        disabled={weight >= 20}
                                        onClick={() =>
                                          adjustItemShare(item.id, person.id, 1)
                                        }
                                        aria-label={`Increase ${person.name}'s share`}
                                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-35"
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
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border-subtle)] bg-[var(--bg-app)]/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-md items-center gap-2.5 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to Items"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <button
            type="button"
            disabled={bill.participants.length === 0}
            onClick={onNext}
            className="flex h-12 flex-1 items-center justify-between rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-45"
          >
            <span>See Final Breakdown</span>
            <span className="flex items-center gap-1.5 text-xs">
              {assignedCount}/{totalItems} assigned
              <ArrowRight className="h-4 w-4" />
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
