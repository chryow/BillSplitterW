import { fromMinorUnits, toMinorUnits } from "./currency";
import type {
  BillItem,
  CurrencyCode,
  FeeSplitMode,
  Participant,
  PersonAssignedItem,
  PersonSplit,
  SplitCalculationResult,
} from "./types";

export interface SplitInput {
  currency: CurrencyCode;
  items: BillItem[];
  tax: number;
  serviceCharge: number;
  discount: number;
  participants: Participant[];
  feeSplitMode: FeeSplitMode;
}

/**
 * Distributes an integer `totalMinor` across slots proportionally to `weights`
 * using the largest-remainder (Hamilton) method so the integer outputs ALWAYS
 * sum exactly to `totalMinor`.
 *
 * `tieBreakOffset` rotates exact-tie remainders so repeated equal splits do not
 * always assign the extra minor unit to index 0.
 */
export function allocateLargestRemainder(
  totalMinor: number,
  weights: number[],
  tieBreakOffset = 0
): number[] {
  const n = weights.length;
  if (n === 0) return [];
  if (totalMinor === 0) return new Array<number>(n).fill(0);

  const sign = totalMinor < 0 ? -1 : 1;
  const absTotal = Math.abs(Math.trunc(totalMinor));
  const weightSum = weights.reduce((acc, w) => acc + (w > 0 ? w : 0), 0);

  // If all weights are 0 (e.g. zero-subtotal edge case), fall back to equal distribution
  const effectiveWeights =
    weightSum > 0 ? weights.map((w) => (w > 0 ? w : 0)) : new Array<number>(n).fill(1);
  const effectiveSum = weightSum > 0 ? weightSum : n;

  const exactShares = effectiveWeights.map((w) => (absTotal * w) / effectiveSum);
  const floors = exactShares.map((s) => Math.floor(s));
  const remainder = absTotal - floors.reduce((acc, f) => acc + f, 0);

  const ranked = exactShares
    .map((s, index) => ({
      index,
      fraction: s - Math.floor(s),
      weight: effectiveWeights[index],
      tieOrder: (index - (tieBreakOffset % n) + n) % n,
    }))
    // Only give remainders to slots with positive weight when distributing proportionally
    .filter((entry) => entry.weight > 0)
    .sort((a, b) => {
      if (Math.abs(b.fraction - a.fraction) > 1e-12) {
        return b.fraction - a.fraction;
      }
      return a.tieOrder - b.tieOrder;
    });

  for (let i = 0; i < remainder && i < ranked.length; i++) {
    floors[ranked[i].index] += 1;
  }

  return floors.map((v) => (v === 0 ? 0 : v * sign));
}

/**
 * Pure split calculation engine.
 * - Zero-decimal currencies (IDR, JPY) round to nearest integer.
 * - 2-decimal currencies (USD, SGD, MYR, EUR) round to 2 decimal places.
 * - Largest-remainder rounding guarantees sum(people.total) === grandTotal whenever
 *   at least one participant exists and all items are assigned.
 */
export function calculateSplit(input: SplitInput): SplitCalculationResult {
  const { currency, items, participants, feeSplitMode } = input;

  const participantIndexById = new Map<string, number>();
  participants.forEach((p, idx) => participantIndexById.set(p.id, idx));

  const n = participants.length;
  const itemsSubtotalMinor = items.reduce(
    (sum, item) => sum + Math.max(0, toMinorUnits(item.totalPrice, currency)),
    0
  );
  const taxMinor = Math.max(0, toMinorUnits(input.tax, currency));
  const serviceMinor = Math.max(0, toMinorUnits(input.serviceCharge, currency));
  const rawDiscountMinor = Math.max(0, toMinorUnits(input.discount, currency));
  // Cap effective discount so grand total cannot go below 0
  const maxDiscountable = itemsSubtotalMinor + taxMinor + serviceMinor;
  const effectiveDiscountMinor = Math.min(rawDiscountMinor, maxDiscountable);
  const grandTotalMinor = Math.max(
    0,
    itemsSubtotalMinor + taxMinor + serviceMinor - effectiveDiscountMinor
  );

  const perPersonItems: PersonAssignedItem[][] = Array.from({ length: n }, () => []);
  const personItemSubtotalMinor = new Array<number>(n).fill(0);
  const personExactItemWeight = new Array<number>(n).fill(0);

  let assignedSubtotalMinor = 0;
  let unassignedSubtotalMinor = 0;
  const unassignedItemIds: string[] = [];

  items.forEach((item, itemIdx) => {
    const itemMinor = Math.max(0, toMinorUnits(item.totalPrice, currency));
    const uniqueValidAssignees = Array.from(
      new Set(item.assigneeIds.filter((id) => participantIndexById.has(id)))
    );

    if (uniqueValidAssignees.length === 0) {
      unassignedSubtotalMinor += itemMinor;
      unassignedItemIds.push(item.id);
      return;
    }

    assignedSubtotalMinor += itemMinor;
    const equalWeights = new Array<number>(uniqueValidAssignees.length).fill(1);
    const sharesMinor = allocateLargestRemainder(itemMinor, equalWeights, itemIdx);
    const exactUnitShare = itemMinor / uniqueValidAssignees.length;

    uniqueValidAssignees.forEach((assigneeId, shareIdx) => {
      const pIdx = participantIndexById.get(assigneeId)!;
      const shareMinor = sharesMinor[shareIdx];
      personItemSubtotalMinor[pIdx] += shareMinor;
      personExactItemWeight[pIdx] += exactUnitShare;
      perPersonItems[pIdx].push({
        itemId: item.id,
        name: item.name,
        qty: item.qty,
        shareCount: uniqueValidAssignees.length,
        amount: fromMinorUnits(shareMinor, currency),
      });
    });
  });

  if (n === 0) {
    return {
      currency,
      itemsSubtotal: fromMinorUnits(itemsSubtotalMinor, currency),
      tax: fromMinorUnits(taxMinor, currency),
      serviceCharge: fromMinorUnits(serviceMinor, currency),
      discount: fromMinorUnits(effectiveDiscountMinor, currency),
      grandTotal: fromMinorUnits(grandTotalMinor, currency),
      assignedSubtotal: fromMinorUnits(assignedSubtotalMinor, currency),
      unassignedSubtotal: fromMinorUnits(unassignedSubtotalMinor, currency),
      unassignedItemIds,
      people: [],
      sumOfPeopleTotals: 0,
    };
  }

  // Determine fee/discount weights
  const totalItemWeight = personExactItemWeight.reduce((acc, w) => acc + w, 0);
  const feeWeights =
    feeSplitMode === "equal" || totalItemWeight === 0
      ? new Array<number>(n).fill(1)
      : personExactItemWeight;

  // Target bill total covered by assigned items + fees - discount
  const targetPeopleSumMinor = Math.max(
    0,
    assignedSubtotalMinor + taxMinor + serviceMinor - effectiveDiscountMinor
  );
  const effectivePeopleDiscountMinor = Math.min(
    effectiveDiscountMinor,
    assignedSubtotalMinor + taxMinor + serviceMinor
  );

  const taxSharesMinor = allocateLargestRemainder(taxMinor, feeWeights, 0);
  const serviceSharesMinor = allocateLargestRemainder(serviceMinor, feeWeights, 1);
  let discountSharesMinor = allocateLargestRemainder(
    effectivePeopleDiscountMinor,
    feeWeights,
    2
  );

  // Prevent any individual person's total from dipping negative (e.g. equal discount
  // split when one person ordered less than the average discount). Rebalance excess
  // discount onto people with remaining positive capacity so totals stay >= 0 and
  // sum(people.total) === targetPeopleSumMinor.
  const preDiscountTotals = personItemSubtotalMinor.map(
    (sub, i) => sub + taxSharesMinor[i] + serviceSharesMinor[i]
  );

  let overflowDiscount = 0;
  for (let i = 0; i < n; i++) {
    if (discountSharesMinor[i] > preDiscountTotals[i]) {
      overflowDiscount += discountSharesMinor[i] - preDiscountTotals[i];
      discountSharesMinor[i] = preDiscountTotals[i];
    }
  }

  if (overflowDiscount > 0) {
    const capacities = preDiscountTotals.map((cap, i) =>
      Math.max(0, cap - discountSharesMinor[i])
    );
    const totalCap = capacities.reduce((a, b) => a + b, 0);
    if (totalCap > 0) {
      const extraDiscount = allocateLargestRemainder(
        Math.min(overflowDiscount, totalCap),
        capacities,
        0
      );
      discountSharesMinor = discountSharesMinor.map((d, i) => d + extraDiscount[i]);
    }
  }

  const personTotalsMinor = preDiscountTotals.map(
    (pre, i) => pre - discountSharesMinor[i]
  );

  // Final safety check: reconcile any rare 1-unit drift against targetPeopleSumMinor
  const currentSumMinor = personTotalsMinor.reduce((acc, v) => acc + v, 0);
  const diffMinor = targetPeopleSumMinor - currentSumMinor;
  if (diffMinor !== 0 && n > 0) {
    // Adjust the person with the largest positive total
    let bestIdx = 0;
    for (let i = 1; i < n; i++) {
      if (personTotalsMinor[i] > personTotalsMinor[bestIdx]) {
        bestIdx = i;
      }
    }
    personTotalsMinor[bestIdx] = Math.max(0, personTotalsMinor[bestIdx] + diffMinor);
  }

  const people: PersonSplit[] = participants.map((p, i) => ({
    participantId: p.id,
    name: p.name,
    color: p.color,
    items: perPersonItems[i],
    itemSubtotal: fromMinorUnits(personItemSubtotalMinor[i], currency),
    taxShare: fromMinorUnits(taxSharesMinor[i], currency),
    serviceShare: fromMinorUnits(serviceSharesMinor[i], currency),
    discountShare: fromMinorUnits(discountSharesMinor[i], currency),
    total: fromMinorUnits(personTotalsMinor[i], currency),
  }));

  const sumOfPeopleTotalsMinor = personTotalsMinor.reduce((acc, v) => acc + v, 0);

  return {
    currency,
    itemsSubtotal: fromMinorUnits(itemsSubtotalMinor, currency),
    tax: fromMinorUnits(taxMinor, currency),
    serviceCharge: fromMinorUnits(serviceMinor, currency),
    discount: fromMinorUnits(effectiveDiscountMinor, currency),
    grandTotal: fromMinorUnits(grandTotalMinor, currency),
    assignedSubtotal: fromMinorUnits(assignedSubtotalMinor, currency),
    unassignedSubtotal: fromMinorUnits(unassignedSubtotalMinor, currency),
    unassignedItemIds,
    people,
    sumOfPeopleTotals: fromMinorUnits(sumOfPeopleTotalsMinor, currency),
  };
}

/**
 * Splits a single line item with qty > 1 into `qty` separate 1x rows while preserving
 * exact sum of prices (handles any rounding remainder cleanly on the last row).
 */
export function splitItemQuantity(
  item: BillItem,
  currency: CurrencyCode,
  idGenerator: () => string
): BillItem[] {
  const count = Math.floor(item.qty);
  if (count <= 1) return [item];

  const totalMinor = Math.max(0, toMinorUnits(item.totalPrice, currency));
  const equalShares = allocateLargestRemainder(
    totalMinor,
    new Array<number>(count).fill(1),
    0
  );

  return equalShares.map((shareMinor, index) => {
    const unitVal = fromMinorUnits(shareMinor, currency);
    return {
      id: index === 0 ? item.id : idGenerator(),
      name: item.name,
      qty: 1,
      unitPrice: unitVal,
      totalPrice: unitVal,
      assigneeIds: [...item.assigneeIds],
    };
  });
}

/**
 * Compares calculated grand total against scanned receipt grand total.
 */
export function checkReceiptMath(
  items: BillItem[],
  tax: number,
  serviceCharge: number,
  discount: number,
  scannedGrandTotal: number | null,
  currency: CurrencyCode
): {
  computedSubtotal: number;
  computedGrandTotal: number;
  difference: number;
  isMatch: boolean;
} {
  const subtotalMinor = items.reduce(
    (sum, item) => sum + Math.max(0, toMinorUnits(item.totalPrice, currency)),
    0
  );
  const taxMinor = Math.max(0, toMinorUnits(tax, currency));
  const serviceMinor = Math.max(0, toMinorUnits(serviceCharge, currency));
  const discountMinor = Math.max(0, toMinorUnits(discount, currency));
  const computedTotalMinor = Math.max(
    0,
    subtotalMinor + taxMinor + serviceMinor - discountMinor
  );

  if (scannedGrandTotal === null) {
    return {
      computedSubtotal: fromMinorUnits(subtotalMinor, currency),
      computedGrandTotal: fromMinorUnits(computedTotalMinor, currency),
      difference: 0,
      isMatch: true,
    };
  }

  const scannedMinor = toMinorUnits(scannedGrandTotal, currency);
  const diffMinor = computedTotalMinor - scannedMinor;

  return {
    computedSubtotal: fromMinorUnits(subtotalMinor, currency),
    computedGrandTotal: fromMinorUnits(computedTotalMinor, currency),
    difference: fromMinorUnits(diffMinor, currency),
    isMatch: diffMinor === 0,
  };
}
