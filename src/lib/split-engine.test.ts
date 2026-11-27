import { describe, expect, it } from "vitest";
import {
  allocateLargestRemainder,
  applyFriendlyRounding,
  calculateSplit,
  checkReceiptMath,
  computeSettlementSummary,
  getRoundingOptions,
  splitItemQuantity,
} from "./split-engine";
import type { BillItem, Participant } from "./types";

const P_YOU: Participant = { id: "p1", name: "You", color: "#10B981" };
const P_BUDI: Participant = { id: "p2", name: "Budi", color: "#38BDF8" };
const P_SARI: Participant = { id: "p3", name: "Sari", color: "#F59E0B" };

describe("split-engine", () => {
  it("handles single-owner items cleanly in IDR", () => {
    const items: BillItem[] = [
      {
        id: "i1",
        name: "Nasi Goreng",
        qty: 1,
        unitPrice: 45000,
        totalPrice: 45000,
        assigneeIds: ["p1"],
      },
      {
        id: "i2",
        name: "Mie Ayam",
        qty: 1,
        unitPrice: 35000,
        totalPrice: 35000,
        assigneeIds: ["p2"],
      },
    ];

    const result = calculateSplit({
      currency: "IDR",
      items,
      tax: 0,
      serviceCharge: 0,
      discount: 0,
      participants: [P_YOU, P_BUDI],
      feeSplitMode: "proportional",
    });

    expect(result.grandTotal).toBe(80000);
    expect(result.sumOfPeopleTotals).toBe(80000);
    expect(result.people[0].total).toBe(45000);
    expect(result.people[1].total).toBe(35000);
    expect(result.unassignedItemIds).toEqual([]);
  });

  it("splits multi-person shared items evenly and distributes 1-unit remainders", () => {
    const items: BillItem[] = [
      {
        id: "i1",
        name: "Shared Platter",
        qty: 1,
        unitPrice: 100000,
        totalPrice: 100000,
        assigneeIds: ["p1", "p2", "p3"],
      },
    ];

    const result = calculateSplit({
      currency: "IDR",
      items,
      tax: 0,
      serviceCharge: 0,
      discount: 0,
      participants: [P_YOU, P_BUDI, P_SARI],
      feeSplitMode: "proportional",
    });

    expect(result.grandTotal).toBe(100000);
    expect(result.sumOfPeopleTotals).toBe(100000);
    const totals = result.people.map((p) => p.total).sort((a, b) => b - a);
    expect(totals).toEqual([33334, 33333, 33333]);
  });

  it("applies proportional tax, service charge, and discount accurately", () => {
    // Subtotals: You = 60,000 (60%), Budi = 40,000 (40%), Total items = 100,000
    // Tax = 10,000, Service = 5,000, Discount = 20,000 => Grand Total = 95,000
    const items: BillItem[] = [
      {
        id: "i1",
        name: "Steak",
        qty: 1,
        unitPrice: 60000,
        totalPrice: 60000,
        assigneeIds: ["p1"],
      },
      {
        id: "i2",
        name: "Pasta",
        qty: 1,
        unitPrice: 40000,
        totalPrice: 40000,
        assigneeIds: ["p2"],
      },
    ];

    const result = calculateSplit({
      currency: "IDR",
      items,
      tax: 10000,
      serviceCharge: 5000,
      discount: 20000,
      participants: [P_YOU, P_BUDI],
      feeSplitMode: "proportional",
    });

    expect(result.grandTotal).toBe(95000);
    expect(result.sumOfPeopleTotals).toBe(95000);

    // You (60%): 60,000 + 6,000 + 3,000 - 12,000 = 57,000
    expect(result.people[0].itemSubtotal).toBe(60000);
    expect(result.people[0].taxShare).toBe(6000);
    expect(result.people[0].serviceShare).toBe(3000);
    expect(result.people[0].discountShare).toBe(12000);
    expect(result.people[0].total).toBe(57000);

    // Budi (40%): 40,000 + 4,000 + 2,000 - 8,000 = 38,000
    expect(result.people[1].itemSubtotal).toBe(40000);
    expect(result.people[1].taxShare).toBe(4000);
    expect(result.people[1].serviceShare).toBe(2000);
    expect(result.people[1].discountShare).toBe(8000);
    expect(result.people[1].total).toBe(38000);
  });

  it("supports equal fee & discount split mode", () => {
    const items: BillItem[] = [
      {
        id: "i1",
        name: "Wagyu",
        qty: 1,
        unitPrice: 150000,
        totalPrice: 150000,
        assigneeIds: ["p1"],
      },
      {
        id: "i2",
        name: "Iced Tea",
        qty: 1,
        unitPrice: 50000,
        totalPrice: 50000,
        assigneeIds: ["p2"],
      },
    ];

    const result = calculateSplit({
      currency: "IDR",
      items,
      tax: 20000,
      serviceCharge: 10000,
      discount: 10000,
      participants: [P_YOU, P_BUDI],
      feeSplitMode: "equal",
    });

    expect(result.grandTotal).toBe(220000);
    expect(result.sumOfPeopleTotals).toBe(220000);
    // Equal fees: +10,000 tax, +5,000 service, -5,000 discount = +10,000 each
    expect(result.people[0].total).toBe(160000);
    expect(result.people[1].total).toBe(60000);
  });

  it("handles zero-subtotal edge cases gracefully without NaN", () => {
    const result = calculateSplit({
      currency: "IDR",
      items: [
        {
          id: "i1",
          name: "Free Appetizer",
          qty: 1,
          unitPrice: 0,
          totalPrice: 0,
          assigneeIds: ["p1", "p2"],
        },
      ],
      tax: 10001,
      serviceCharge: 0,
      discount: 0,
      participants: [P_YOU, P_BUDI],
      feeSplitMode: "proportional",
    });

    expect(result.grandTotal).toBe(10001);
    expect(result.sumOfPeopleTotals).toBe(10001);
    expect(result.people.map((p) => p.total).sort((a, b) => b - a)).toEqual([
      5001,
      5000,
    ]);
    expect(Number.isNaN(result.people[0].total)).toBe(false);
  });

  it("handles zero participants and empty items cleanly", () => {
    const result = calculateSplit({
      currency: "USD",
      items: [],
      tax: 0,
      serviceCharge: 0,
      discount: 0,
      participants: [],
      feeSplitMode: "proportional",
    });

    expect(result.grandTotal).toBe(0);
    expect(result.sumOfPeopleTotals).toBe(0);
    expect(result.people).toEqual([]);
  });

  it("guarantees exact cent-level rounding remainder distribution for 2-decimal currencies (USD)", () => {
    // $10.00 split 3 ways + $1.00 tax + $0.50 service - $0.25 discount = $11.25
    const items: BillItem[] = [
      {
        id: "i1",
        name: "Nachos",
        qty: 1,
        unitPrice: 10,
        totalPrice: 10,
        assigneeIds: ["p1", "p2", "p3"],
      },
    ];

    const result = calculateSplit({
      currency: "USD",
      items,
      tax: 1,
      serviceCharge: 0.5,
      discount: 0.25,
      participants: [P_YOU, P_BUDI, P_SARI],
      feeSplitMode: "proportional",
    });

    expect(result.grandTotal).toBe(11.25);
    expect(result.sumOfPeopleTotals).toBe(11.25);
    const manualSum = Number(
      result.people.reduce((acc, p) => acc + p.total, 0).toFixed(2)
    );
    expect(manualSum).toBe(11.25);
    for (const p of result.people) {
      const cardSum = Number(
        (p.itemSubtotal + p.taxShare + p.serviceShare - p.discountShare).toFixed(2)
      );
      expect(p.total).toBe(cardSum);
    }
  });

  it("prevents negative individual totals when equal discount exceeds one person's items", () => {
    const items: BillItem[] = [
      {
        id: "i1",
        name: "Big Meal",
        qty: 1,
        unitPrice: 90000,
        totalPrice: 90000,
        assigneeIds: ["p1"],
      },
      {
        id: "i2",
        name: "Mineral Water",
        qty: 1,
        unitPrice: 5000,
        totalPrice: 5000,
        assigneeIds: ["p2"],
      },
    ];

    const result = calculateSplit({
      currency: "IDR",
      items,
      tax: 0,
      serviceCharge: 0,
      discount: 20000,
      participants: [P_YOU, P_BUDI],
      feeSplitMode: "equal",
    });

    expect(result.grandTotal).toBe(75000);
    expect(result.sumOfPeopleTotals).toBe(75000);
    expect(result.people[1].total).toBe(0);
    expect(result.people[0].total).toBe(75000);
  });

  it("handles zero-decimal JPY rounding remainders accurately", () => {
    const items: BillItem[] = [
      {
        id: "i1",
        name: "Ramen",
        qty: 1,
        unitPrice: 1250,
        totalPrice: 1250,
        assigneeIds: ["p1"],
      },
      {
        id: "i2",
        name: "Gyoza",
        qty: 1,
        unitPrice: 750,
        totalPrice: 750,
        assigneeIds: ["p2", "p3"],
      },
    ];

    const result = calculateSplit({
      currency: "JPY",
      items,
      tax: 201,
      serviceCharge: 0,
      discount: 0,
      participants: [P_YOU, P_BUDI, P_SARI],
      feeSplitMode: "proportional",
    });

    expect(result.grandTotal).toBe(2201);
    expect(result.sumOfPeopleTotals).toBe(2201);
    result.people.forEach((p) => {
      expect(Number.isInteger(p.total)).toBe(true);
    });
  });

  it("splits multi-quantity items into separate 1x rows preserving exact total", () => {
    let counter = 1;
    const item: BillItem = {
      id: "latte",
      name: "Iced Latte",
      qty: 3,
      unitPrice: 33333,
      totalPrice: 100000,
      assigneeIds: ["p1"],
    };

    const split = splitItemQuantity(item, "IDR", () => `gen-${counter++}`);
    expect(split).toHaveLength(3);
    expect(split.every((r) => r.qty === 1)).toBe(true);
    expect(split.reduce((sum, r) => sum + r.totalPrice, 0)).toBe(100000);
    expect(split[0].id).toBe("latte");
  });

  it("detects exact receipt math matches and differences", () => {
    const items: BillItem[] = [
      {
        id: "i1",
        name: "Coffee",
        qty: 2,
        unitPrice: 35000,
        totalPrice: 70000,
        assigneeIds: [],
      },
    ];

    const match = checkReceiptMath(items, 7000, 3500, 5000, 75500, "IDR");
    expect(match.isMatch).toBe(true);
    expect(match.difference).toBe(0);

    const mismatch = checkReceiptMath(items, 7000, 3500, 5000, 78000, "IDR");
    expect(mismatch.isMatch).toBe(false);
    expect(mismatch.difference).toBe(-2500);
  });

  it("allocateLargestRemainder always sums exactly to totalMinor", () => {
    const shares = allocateLargestRemainder(100, [1, 1, 1]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
    expect(shares.sort((a, b) => b - a)).toEqual([34, 33, 33]);
  });

  it("supports custom unequal per-person share weights with proportional tax", () => {
    // Shared Pizza = Rp 90,000 split 2:1 between You (60,000) and Budi (30,000)
    // Plus 10% PB1 Tax = Rp 9,000 -> You pays 6,000 tax (total 66,000), Budi pays 3,000 tax (total 33,000)
    const items: BillItem[] = [
      {
        id: "pizza",
        name: "Truffle Pizza",
        qty: 1,
        unitPrice: 90000,
        totalPrice: 90000,
        assigneeIds: ["p1", "p2"],
        assigneeShares: { p1: 2, p2: 1 },
      },
    ];

    const result = calculateSplit({
      currency: "IDR",
      items,
      tax: 9000,
      serviceCharge: 0,
      discount: 0,
      participants: [P_YOU, P_BUDI],
      feeSplitMode: "proportional",
    });

    expect(result.grandTotal).toBe(99000);
    expect(result.sumOfPeopleTotals).toBe(99000);
    expect(result.people[0].itemSubtotal).toBe(60000);
    expect(result.people[0].taxShare).toBe(6000);
    expect(result.people[0].total).toBe(66000);
    expect(result.people[0].items[0].isCustomShare).toBe(true);
    expect(result.people[0].items[0].shareWeight).toBe(2);
    expect(result.people[0].items[0].totalShares).toBe(3);

    expect(result.people[1].itemSubtotal).toBe(30000);
    expect(result.people[1].taxShare).toBe(3000);
    expect(result.people[1].total).toBe(33000);
    expect(result.people[1].items[0].shareWeight).toBe(1);
  });

  it("handles 3-way custom shares (3:2:1) with exact cent rounding in USD", () => {
    const items: BillItem[] = [
      {
        id: "platter",
        name: "Tapas Board",
        qty: 1,
        unitPrice: 25,
        totalPrice: 25,
        assigneeIds: ["p1", "p2", "p3"],
        assigneeShares: { p1: 3, p2: 2, p3: 1 },
      },
    ];

    const result = calculateSplit({
      currency: "USD",
      items,
      tax: 2.5,
      serviceCharge: 0,
      discount: 0,
      participants: [P_YOU, P_BUDI, P_SARI],
      feeSplitMode: "proportional",
    });

    expect(result.grandTotal).toBe(27.5);
    expect(result.sumOfPeopleTotals).toBe(27.5);
    expect(
      Number(result.people.reduce((sum, p) => sum + p.total, 0).toFixed(2))
    ).toBe(27.5);
    // You (3/6 = 50%) should owe the most, then Budi (2/6), then Sari (1/6)
    expect(result.people[0].total).toBeGreaterThan(result.people[1].total);
    expect(result.people[1].total).toBeGreaterThan(result.people[2].total);
  });

  it("computes settlement summary excluding the payer and tracking collected vs remaining", () => {
    const items: BillItem[] = [
      {
        id: "i1",
        name: "Meal A",
        qty: 1,
        unitPrice: 50000,
        totalPrice: 50000,
        assigneeIds: ["p1"],
      },
      {
        id: "i2",
        name: "Meal B",
        qty: 1,
        unitPrice: 40000,
        totalPrice: 40000,
        assigneeIds: ["p2"],
      },
      {
        id: "i3",
        name: "Meal C",
        qty: 1,
        unitPrice: 30000,
        totalPrice: 30000,
        assigneeIds: ["p3"],
      },
    ];

    const split = calculateSplit({
      currency: "IDR",
      items,
      tax: 0,
      serviceCharge: 0,
      discount: 0,
      participants: [P_YOU, P_BUDI, P_SARI],
      feeSplitMode: "proportional",
    });

    const summary = computeSettlementSummary(split, "p1", ["p2"]);
    expect(summary.payerName).toBe("You");
    expect(summary.totalOwedToPayer).toBe(70000);
    expect(summary.totalCollected).toBe(40000);
    expect(summary.totalRemaining).toBe(30000);
    expect(summary.collectibleCount).toBe(2);
    expect(summary.settledCount).toBe(1);
    expect(summary.unsettledCount).toBe(1);
  });

  it("rounds individual totals up cleanly to Rp 500 or Rp 1.000 without under-collecting", () => {
    const split = calculateSplit({
      currency: "IDR",
      items: [
        {
          id: "i1",
          name: "Shared Dish",
          qty: 1,
          unitPrice: 100000,
          totalPrice: 100000,
          assigneeIds: ["p1", "p2", "p3"],
        },
      ],
      tax: 0,
      serviceCharge: 0,
      discount: 0,
      participants: [P_YOU, P_BUDI, P_SARI],
      feeSplitMode: "proportional",
    });

    expect(getRoundingOptions("IDR").map((o) => o.step)).toEqual([0, 500, 1000]);

    const rounded500 = applyFriendlyRounding(split, 500);
    expect(rounded500.split.people.every((p) => p.total === 33500)).toBe(true);
    expect(rounded500.split.sumOfPeopleTotals).toBe(100500);
    expect(rounded500.roundingSurplus).toBe(500);

    const rounded1000 = applyFriendlyRounding(split, 1000);
    expect(rounded1000.split.people.every((p) => p.total === 34000)).toBe(true);
    expect(rounded1000.split.sumOfPeopleTotals).toBe(102000);
    expect(rounded1000.roundingSurplus).toBe(2000);
  });

  it("rounds 2-decimal USD shares up cleanly to $0.50 or $1.00", () => {
    const split = calculateSplit({
      currency: "USD",
      items: [
        {
          id: "i1",
          name: "Shared Nachos",
          qty: 1,
          unitPrice: 10,
          totalPrice: 10,
          assigneeIds: ["p1", "p2", "p3"],
        },
      ],
      tax: 0,
      serviceCharge: 0,
      discount: 0,
      participants: [P_YOU, P_BUDI, P_SARI],
      feeSplitMode: "proportional",
    });

    const roundedHalf = applyFriendlyRounding(split, 0.5);
    expect(roundedHalf.split.people.every((p) => p.total === 3.5)).toBe(true);
    expect(roundedHalf.split.sumOfPeopleTotals).toBe(10.5);
    expect(roundedHalf.roundingSurplus).toBe(0.5);
  });

  it("splits food delivery fee equally among orderers only while keeping tax & discount proportional", () => {
    // You ordered Rp 60,000 (60%), Budi ordered Rp 40,000 (40%), Sari ordered nothing (0%)
    // Tax = Rp 10,000 (proportional -> 6k / 4k / 0)
    // Discount = Rp 10,000 (proportional -> 6k / 4k / 0)
    // Delivery Fee = Rp 15,000 (equal among orderers You & Budi -> 7,500 / 7,500 / 0)
    const items: BillItem[] = [
      {
        id: "i1",
        name: "Bento Set A",
        qty: 1,
        unitPrice: 60000,
        totalPrice: 60000,
        assigneeIds: ["p1"],
      },
      {
        id: "i2",
        name: "Ramen Bowl",
        qty: 1,
        unitPrice: 40000,
        totalPrice: 40000,
        assigneeIds: ["p2"],
      },
    ];

    const result = calculateSplit({
      currency: "IDR",
      items,
      tax: 10000,
      serviceCharge: 0,
      deliveryFee: 15000,
      discount: 10000,
      participants: [P_YOU, P_BUDI, P_SARI],
      feeSplitMode: "proportional",
    });

    expect(result.deliveryFee).toBe(15000);
    expect(result.grandTotal).toBe(115000);
    expect(result.sumOfPeopleTotals).toBe(115000);

    // You: 60,000 + 6,000 tax - 6,000 disc + 7,500 delivery = 67,500
    expect(result.people[0].taxShare).toBe(6000);
    expect(result.people[0].discountShare).toBe(6000);
    expect(result.people[0].deliveryShare).toBe(7500);
    expect(result.people[0].total).toBe(67500);

    // Budi: 40,000 + 4,000 tax - 4,000 disc + 7,500 delivery = 47,500
    expect(result.people[1].taxShare).toBe(4000);
    expect(result.people[1].discountShare).toBe(4000);
    expect(result.people[1].deliveryShare).toBe(7500);
    expect(result.people[1].total).toBe(47500);

    // Sari ordered nothing -> pays 0 delivery and 0 total
    expect(result.people[2].deliveryShare).toBe(0);
    expect(result.people[2].total).toBe(0);
  });

  it("distributes 3-way delivery fee remainder cleanly and falls back to all participants if no items assigned", () => {
    const orderedResult = calculateSplit({
      currency: "IDR",
      items: [
        {
          id: "i1",
          name: "Shared Drinks",
          qty: 3,
          unitPrice: 20000,
          totalPrice: 60000,
          assigneeIds: ["p1", "p2", "p3"],
        },
      ],
      tax: 0,
      serviceCharge: 0,
      deliveryFee: 10000,
      discount: 0,
      participants: [P_YOU, P_BUDI, P_SARI],
      feeSplitMode: "proportional",
    });

    expect(orderedResult.grandTotal).toBe(70000);
    expect(orderedResult.sumOfPeopleTotals).toBe(70000);
    expect(
      orderedResult.people.map((p) => p.deliveryShare).sort((a, b) => b - a)
    ).toEqual([3334, 3333, 3333]);

    // Fallback when no items are assigned yet: splits delivery fee across all participants
    const fallbackResult = calculateSplit({
      currency: "IDR",
      items: [],
      tax: 0,
      serviceCharge: 0,
      deliveryFee: 12000,
      discount: 0,
      participants: [P_YOU, P_BUDI, P_SARI],
      feeSplitMode: "proportional",
    });

    expect(fallbackResult.grandTotal).toBe(12000);
    expect(fallbackResult.sumOfPeopleTotals).toBe(12000);
    expect(fallbackResult.people.map((p) => p.deliveryShare)).toEqual([
      4000, 4000, 4000,
    ]);
  });

  it("includes deliveryFee in checkReceiptMath calculation", () => {
    const items: BillItem[] = [
      {
        id: "i1",
        name: "Ayam Geprek",
        qty: 2,
        unitPrice: 25000,
        totalPrice: 50000,
        assigneeIds: [],
      },
    ];
    // 50,000 food + 5,000 tax + 0 service + 14,000 delivery - 10,000 promo = 59,000
    const check = checkReceiptMath(items, 5000, 0, 10000, 59000, "IDR", 14000);
    expect(check.computedGrandTotal).toBe(59000);
    expect(check.isMatch).toBe(true);
    expect(check.difference).toBe(0);
  });

  it("handles zero-decimal TWD splits and NT$5 / NT$10 friendly round-up options", () => {
    expect(getRoundingOptions("TWD").map((o) => o.step)).toEqual([0, 5, 10]);

    const split = calculateSplit({
      currency: "TWD",
      items: [
        {
          id: "i1",
          name: "Xiao Long Bao",
          qty: 1,
          unitPrice: 250,
          totalPrice: 250,
          assigneeIds: ["p1", "p2", "p3"],
        },
      ],
      tax: 0,
      serviceCharge: 25,
      discount: 0,
      participants: [P_YOU, P_BUDI, P_SARI],
      feeSplitMode: "proportional",
    });

    expect(split.grandTotal).toBe(275);
    expect(split.sumOfPeopleTotals).toBe(275);
    expect(split.people.every((p) => Number.isInteger(p.total))).toBe(true);

    const rounded10 = applyFriendlyRounding(split, 10);
    expect(rounded10.split.people.every((p) => p.total === 100)).toBe(true);
    expect(rounded10.split.sumOfPeopleTotals).toBe(300);
    expect(rounded10.roundingSurplus).toBe(25);
  });
});
