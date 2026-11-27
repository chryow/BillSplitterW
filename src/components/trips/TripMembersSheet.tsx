"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2, Wallet } from "lucide-react";
import { BottomSheet } from "@/components/layout/BottomSheet";
import { DEFAULT_QUICK_NAMES, PARTICIPANT_COLORS } from "@/lib/config";
import { EMPTY_PAYMENT_INFO } from "@/lib/storage";
import type { PaymentInfo, SavedFriend, TripMember } from "@/lib/types";
import { hasPaymentInfo } from "@/lib/whatsapp-formatter";

interface TripMembersSheetProps {
  open: boolean;
  onClose: () => void;
  members: TripMember[];
  savedFriends: SavedFriend[];
  onChangeMembers: (next: TripMember[]) => void;
}

export function TripMembersSheet({
  open,
  onClose,
  members,
  savedFriends,
  onChangeMembers,
}: TripMembersSheetProps) {
  const [newName, setNewName] = useState("");
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  const existingLower = new Set(
    members.map((m) => m.name.trim().toLowerCase())
  );

  const nextColor = (): string => {
    const used = new Set(members.map((m) => m.color));
    return (
      PARTICIPANT_COLORS.find((c) => !used.has(c)) ??
      PARTICIPANT_COLORS[members.length % PARTICIPANT_COLORS.length]
    );
  };

  const addMember = (rawName: string, color?: string) => {
    const trimmed = rawName.trim();
    if (!trimmed || existingLower.has(trimmed.toLowerCase())) {
      setNewName("");
      return;
    }
    const created: TripMember = {
      id: `tm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      color: color ?? nextColor(),
    };
    onChangeMembers([...members, created]);
    setNewName("");
  };

  const removeMember = (memberId: string) => {
    if (members.length <= 1) return;
    onChangeMembers(members.filter((m) => m.id !== memberId));
  };

  const updateMemberPayment = (memberId: string, patch: Partial<PaymentInfo>) => {
    onChangeMembers(
      members.map((m) => {
        if (m.id !== memberId) return m;
        const current = m.paymentInfo ?? { ...EMPTY_PAYMENT_INFO };
        return {
          ...m,
          paymentInfo: { ...current, ...patch },
        };
      })
    );
  };

  const availableSaved = savedFriends.filter(
    (f) => !existingLower.has(f.name.trim().toLowerCase())
  );
  const quickNames = DEFAULT_QUICK_NAMES.filter(
    (n) =>
      !existingLower.has(n.toLowerCase()) &&
      !savedFriends.some((f) => f.name.trim().toLowerCase() === n.toLowerCase())
  ).slice(0, 4);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Trip Crew & Payment Info"
      subtitle="Add bank or e-wallet details per person so friends know where to pay"
    >
      <div className="space-y-4">
        {/* Add member input */}
        <div className="space-y-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addMember(newName);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Add trip member..."
              className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newName.trim()}
              className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl bg-[var(--accent)] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-45"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </form>

          {(availableSaved.length > 0 || quickNames.length > 0) && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              {availableSaved.map((friend) => (
                <button
                  key={friend.id}
                  type="button"
                  onClick={() => addMember(friend.name, friend.color)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--accent)]/35 bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent-text)]"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: friend.color }}
                  />
                  + {friend.name}
                </button>
              ))}
              {quickNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => addMember(name)}
                  className="shrink-0 rounded-full border border-dashed border-[var(--border-strong)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  + {name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Member list with expandable per-member Payment Info */}
        <div className="space-y-2">
          {members.map((member) => {
            const openPay = expandedMemberId === member.id;
            const info = member.paymentInfo ?? EMPTY_PAYMENT_INFO;
            const hasPay = hasPaymentInfo(info);

            return (
              <div
                key={member.id}
                className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)]"
              >
                <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedMemberId(openPay ? null : member.id)
                    }
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: member.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {member.name}
                      </p>
                      <p className="truncate text-[11px] text-[var(--text-muted)]">
                        {hasPay
                          ? [info.provider, info.accountNumber]
                              .filter(Boolean)
                              .join(" · ")
                          : "Tap to add bank / e-wallet"}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--bg-surface)] px-2 py-1 text-[10px] font-semibold text-[var(--text-secondary)]">
                      <Wallet className="h-3 w-3 text-[var(--accent-text)]" />
                      {openPay ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </span>
                  </button>

                  {members.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMember(member.id)}
                      aria-label={`Remove ${member.name}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {openPay && (
                  <div className="space-y-2 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                          Bank / E-Wallet
                        </span>
                        <input
                          type="text"
                          value={info.provider}
                          onChange={(e) =>
                            updateMemberPayment(member.id, {
                              provider: e.target.value,
                            })
                          }
                          placeholder="e.g. BCA, GoPay"
                          className="mt-1 h-9 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                          Account / Phone Number
                        </span>
                        <input
                          type="text"
                          value={info.accountNumber}
                          onChange={(e) =>
                            updateMemberPayment(member.id, {
                              accountNumber: e.target.value,
                            })
                          }
                          placeholder="e.g. 1234567890"
                          className="mt-1 h-9 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2.5 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                        />
                      </label>
                    </div>
                    <label className="block">
                      <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                        Account Name
                      </span>
                      <input
                        type="text"
                        value={info.accountName}
                        onChange={(e) =>
                          updateMemberPayment(member.id, {
                            accountName: e.target.value,
                          })
                        }
                        placeholder={`e.g. ${member.name}`}
                        className="mt-1 h-9 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] w-full rounded-xl bg-[var(--accent)] text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
        >
          Done
        </button>
      </div>
    </BottomSheet>
  );
}
