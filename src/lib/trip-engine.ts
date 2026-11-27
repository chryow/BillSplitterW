import { fromMinorUnits, toMinorUnits } from "./currency";
import { allocateLargestRemainder, calculateSplit } from "./split-engine";
import type {
  CurrencyCode,
  TripCalculationResult,
  TripExpense,
  TripExpenseComputed,
  TripMember,
  TripMemberBalance,
  TripTransfer,
} from "./types";

export interface TripCalculationInput {
  currency: CurrencyCode;
  members: TripMember[];
  expenses: TripExpense[];
}

function getNormalizedWeight(
  shares: Record<string, number> | undefined,
  memberId: string
): number {
  const raw = shares?.[memberId];
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 1) {
    return Math.min(99, Math.round(raw));
  }
  return 1;
}

/**
 * Simplifies integer minor-unit net balances into the minimum number of transfers.
 * Step 1: Pairs exact 1-to-1 opposite balances first to avoid unnecessary hops.
 * Step 2: Greedily settles largest debtor against largest creditor until all balances hit 0.
 */
export function simplifyTripTransfers(
  currency: CurrencyCode,
  members: TripMember[],
  netMinorByMemberId: Map<string, number>
): TripTransfer[] {
  const memberById = new Map(members.map((m) => [m.id, m]));

  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];

  for (const member of members) {
    const net = netMinorByMemberId.get(member.id) ?? 0;
    if (net > 0) {
      creditors.push({ id: member.id, amount: net });
    } else if (net < 0) {
      debtors.push({ id: member.id, amount: -net });
    }
  }

  const transfers: TripTransfer[] = [];

  const pushTransfer = (fromId: string, toId: string, minorAmount: number) => {
    if (minorAmount <= 0) return;
    const from = memberById.get(fromId);
    const to = memberById.get(toId);
    if (!from || !to) return;
    transfers.push({
      key: `${fromId}->${toId}`,
      fromMemberId: fromId,
      fromName: from.name,
      fromColor: from.color,
      toMemberId: toId,
      toName: to.name,
      toColor: to.color,
      toPaymentInfo: to.paymentInfo,
      amount: fromMinorUnits(minorAmount, currency),
    });
  };

  // Pass 1: Match exact 1-to-1 balances first
  for (const debtor of debtors) {
    if (debtor.amount <= 0) continue;
    const exactMatch = creditors.find((c) => c.amount === debtor.amount);
    if (exactMatch) {
      pushTransfer(debtor.id, exactMatch.id, debtor.amount);
      debtor.amount = 0;
      exactMatch.amount = 0;
    }
  }

  // Pass 2: Greedy largest-debtor to largest-creditor matching
  while (true) {
    const activeDebtors = debtors
      .filter((d) => d.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    const activeCreditors = creditors
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    if (activeDebtors.length === 0 || activeCreditors.length === 0) {
      break;
    }

    const debtor = activeDebtors[0];
    const creditor = activeCreditors[0];
    const settled = Math.min(debtor.amount, creditor.amount);

    pushTransfer(debtor.id, creditor.id, settled);
    debtor.amount -= settled;
    creditor.amount -= settled;
  }

  return transfers;
}

/**
 * Pure deterministic Trip settlement engine:
 * - Handles both Quick Bills (single-owner, equal multi-person, or weighted shares)
 *   and full Itemized Receipts (delegating to `calculateSplit` with proportional tax/service/discount).
 * - Guarantees exact minor-unit conservation: sum(totalPaid) === sum(totalShare) === totalSpend
 *   and sum(netBalance) === 0 across all assigned bills.
 */
export function calculateTrip(input: TripCalculationInput): TripCalculationResult {
  const { currency, members, expenses } = input;
  const memberIds = new Set(members.map((m) => m.id));

  const paidMinorById = new Map<string, number>();
  const shareMinorById = new Map<string, number>();
  const paidCountById = new Map<string, number>();

  for (const m of members) {
    paidMinorById.set(m.id, 0);
    shareMinorById.set(m.id, 0);
    paidCountById.set(m.id, 0);
  }

  let totalSpendMinor = 0;
  const expenseSummaries: Record<string, TripExpenseComputed> = {};

  expenses.forEach((expense, expenseIdx) => {
    const validPayerId = memberIds.has(expense.paidByMemberId)
      ? expense.paidByMemberId
      : members[0]?.id ?? null;

    if (expense.mode === "itemized" && Array.isArray(expense.items)) {
      const split = calculateSplit({
        currency,
        items: expense.items,
        tax: expense.tax ?? 0,
        serviceCharge: expense.serviceCharge ?? 0,
        discount: expense.discount ?? 0,
        participants: members,
        feeSplitMode: "proportional",
      });

      const billTotalMinor = toMinorUnits(split.sumOfPeopleTotals, currency);
      const unassignedMinor = toMinorUnits(split.unassignedSubtotal, currency);

      totalSpendMinor += billTotalMinor;
      if (validPayerId && billTotalMinor > 0) {
        paidMinorById.set(
          validPayerId,
          (paidMinorById.get(validPayerId) ?? 0) + billTotalMinor
        );
        paidCountById.set(
          validPayerId,
          (paidCountById.get(validPayerId) ?? 0) + 1
        );
      }

      const sharesByMemberId: Record<string, number> = {};
      for (const person of split.people) {
        const personMinor = toMinorUnits(person.total, currency);
        sharesByMemberId[person.participantId] = person.total;
        shareMinorById.set(
          person.participantId,
          (shareMinorById.get(person.participantId) ?? 0) + personMinor
        );
      }

      expenseSummaries[expense.id] = {
        expenseId: expense.id,
        total: split.grandTotal,
        sharesByMemberId,
        unassignedAmount: fromMinorUnits(unassignedMinor, currency),
      };
      return;
    }

    // Quick bill mode
    const amountMinor = Math.max(0, toMinorUnits(expense.amount, currency));
    const validAssignees = Array.from(
      new Set(expense.assigneeIds.filter((id) => memberIds.has(id)))
    );

    const sharesByMemberId: Record<string, number> = {};
    if (amountMinor === 0 || validAssignees.length === 0) {
      expenseSummaries[expense.id] = {
        expenseId: expense.id,
        total: fromMinorUnits(amountMinor, currency),
        sharesByMemberId,
        unassignedAmount:
          validAssignees.length === 0
            ? fromMinorUnits(amountMinor, currency)
            : 0,
      };
      return;
    }

    totalSpendMinor += amountMinor;
    if (validPayerId) {
      paidMinorById.set(
        validPayerId,
        (paidMinorById.get(validPayerId) ?? 0) + amountMinor
      );
      paidCountById.set(
        validPayerId,
        (paidCountById.get(validPayerId) ?? 0) + 1
      );
    }

    const weights = validAssignees.map((id) =>
      getNormalizedWeight(expense.assigneeShares, id)
    );
    const allocated = allocateLargestRemainder(amountMinor, weights, expenseIdx);

    validAssignees.forEach((memberId, idx) => {
      const shareMinor = allocated[idx];
      sharesByMemberId[memberId] = fromMinorUnits(shareMinor, currency);
      shareMinorById.set(
        memberId,
        (shareMinorById.get(memberId) ?? 0) + shareMinor
      );
    });

    expenseSummaries[expense.id] = {
      expenseId: expense.id,
      total: fromMinorUnits(amountMinor, currency),
      sharesByMemberId,
      unassignedAmount: 0,
    };
  });

  const netMinorById = new Map<string, number>();
  const balances: TripMemberBalance[] = members.map((member) => {
    const paidMinor = paidMinorById.get(member.id) ?? 0;
    const shareMinor = shareMinorById.get(member.id) ?? 0;
    const netMinor = paidMinor - shareMinor;
    netMinorById.set(member.id, netMinor);

    return {
      memberId: member.id,
      name: member.name,
      color: member.color,
      paymentInfo: member.paymentInfo,
      totalPaid: fromMinorUnits(paidMinor, currency),
      totalShare: fromMinorUnits(shareMinor, currency),
      netBalance: fromMinorUnits(netMinor, currency),
      paidCount: paidCountById.get(member.id) ?? 0,
    };
  });

  const transfers = simplifyTripTransfers(currency, members, netMinorById);

  return {
    currency,
    totalSpend: fromMinorUnits(totalSpendMinor, currency),
    expenseSummaries,
    balances,
    transfers,
  };
}
