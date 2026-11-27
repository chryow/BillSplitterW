import { describe, expect, it } from "vitest";
import { calculateTrip } from "./trip-engine";
import type { TripExpense, TripMember } from "./types";

const M_YOU: TripMember = {
  id: "m1",
  name: "You",
  color: "#10B981",
  paymentInfo: {
    provider: "BCA",
    accountNumber: "111222333",
    accountName: "You",
    note: "",
  },
};
const M_BUDI: TripMember = {
  id: "m2",
  name: "Budi",
  color: "#38BDF8",
  paymentInfo: {
    provider: "GoPay",
    accountNumber: "08123456789",
    accountName: "Budi",
    note: "",
  },
};
const M_SARI: TripMember = {
  id: "m3",
  name: "Sari",
  color: "#F59E0B",
};

describe("trip-engine", () => {
  it("simplifies multi-payer trip bills into minimum transfers in IDR", () => {
    // You pay Villa 900,000 split 3 ways (300k each)
    // Budi pays Car 300,000 split 3 ways (100k each)
    // Sari pays 0
    // Net: You +500k, Budi -100k, Sari -400k -> 2 transfers total: Sari->You 400k, Budi->You 100k
    const expenses: TripExpense[] = [
      {
        id: "e1",
        title: "Villa Seminyak",
        date: "2026-11-27",
        category: "stay",
        paidByMemberId: "m1",
        mode: "quick",
        amount: 900000,
        assigneeIds: ["m1", "m2", "m3"],
      },
      {
        id: "e2",
        title: "Car Rental",
        date: "2026-11-27",
        category: "transport",
        paidByMemberId: "m2",
        mode: "quick",
        amount: 300000,
        assigneeIds: ["m1", "m2", "m3"],
      },
    ];

    const result = calculateTrip({
      currency: "IDR",
      members: [M_YOU, M_BUDI, M_SARI],
      expenses,
    });

    expect(result.totalSpend).toBe(1200000);
    expect(result.balances.find((b) => b.memberId === "m1")?.netBalance).toBe(500000);
    expect(result.balances.find((b) => b.memberId === "m2")?.netBalance).toBe(-100000);
    expect(result.balances.find((b) => b.memberId === "m3")?.netBalance).toBe(-400000);

    expect(result.transfers).toHaveLength(2);
    expect(result.transfers[0]).toMatchObject({
      fromMemberId: "m3",
      toMemberId: "m1",
      amount: 400000,
    });
    expect(result.transfers[0].toPaymentInfo?.provider).toBe("BCA");
    expect(result.transfers[1]).toMatchObject({
      fromMemberId: "m2",
      toMemberId: "m1",
      amount: 100000,
    });
  });

  it("handles single-person assigned bills (1-to-1 loan) and exact-match simplification", () => {
    // Budi buys Sari's concert ticket (500k) assigned only to Sari
    // You pay dinner 300k for You + Budi (150k each)
    // Net: You +150k, Budi +350k, Sari -500k -> Sari pays Budi 350k and You 150k
    const expenses: TripExpense[] = [
      {
        id: "e1",
        title: "Sari Concert Ticket",
        date: "2026-11-27",
        category: "activity",
        paidByMemberId: "m2",
        mode: "quick",
        amount: 500000,
        assigneeIds: ["m3"],
      },
      {
        id: "e2",
        title: "Ramen",
        date: "2026-11-27",
        category: "food",
        paidByMemberId: "m1",
        mode: "quick",
        amount: 300000,
        assigneeIds: ["m1", "m2"],
      },
    ];

    const result = calculateTrip({
      currency: "IDR",
      members: [M_YOU, M_BUDI, M_SARI],
      expenses,
    });

    expect(result.totalSpend).toBe(800000);
    expect(result.transfers).toHaveLength(2);
    const toBudi = result.transfers.find((t) => t.toMemberId === "m2");
    expect(toBudi?.fromMemberId).toBe("m3");
    expect(toBudi?.amount).toBe(350000);
    expect(toBudi?.toPaymentInfo?.provider).toBe("GoPay");
  });

  it("combines itemized restaurant receipts (with proportional tax/service/discount) and quick bills accurately", () => {
    // Quick bill: You pay Grab 100,000 split You + Budi (50k each)
    // Itemized dinner paid by Sari:
    //   Steak 60,000 (You), Pasta 40,000 (Budi), Tax 10,000, Service 5,000, Discount 20,000 => 95,000 total
    //   You owes 57,000, Budi owes 38,000, Sari owes 0
    // Totals:
    //   You: paid 100k, share 107k => net -7k
    //   Budi: paid 0, share 88k => net -88k
    //   Sari: paid 95k, share 0 => net +95k
    const expenses: TripExpense[] = [
      {
        id: "grab",
        title: "Grab Airport",
        date: "2026-11-27",
        category: "transport",
        paidByMemberId: "m1",
        mode: "quick",
        amount: 100000,
        assigneeIds: ["m1", "m2"],
      },
      {
        id: "dinner",
        title: "Naughty Nuri's",
        date: "2026-11-27",
        category: "food",
        paidByMemberId: "m3",
        mode: "itemized",
        amount: 95000,
        assigneeIds: [],
        items: [
          {
            id: "i1",
            name: "Steak",
            qty: 1,
            unitPrice: 60000,
            totalPrice: 60000,
            assigneeIds: ["m1"],
          },
          {
            id: "i2",
            name: "Pasta",
            qty: 1,
            unitPrice: 40000,
            totalPrice: 40000,
            assigneeIds: ["m2"],
          },
        ],
        tax: 10000,
        serviceCharge: 5000,
        discount: 20000,
      },
    ];

    const result = calculateTrip({
      currency: "IDR",
      members: [M_YOU, M_BUDI, M_SARI],
      expenses,
    });

    expect(result.totalSpend).toBe(195000);
    expect(result.balances.find((b) => b.memberId === "m1")?.netBalance).toBe(-7000);
    expect(result.balances.find((b) => b.memberId === "m2")?.netBalance).toBe(-88000);
    expect(result.balances.find((b) => b.memberId === "m3")?.netBalance).toBe(95000);

    const netSum = result.balances.reduce((acc, b) => acc + b.netBalance, 0);
    expect(netSum).toBe(0);
    expect(result.transfers.reduce((acc, t) => acc + t.amount, 0)).toBe(95000);
  });

  it("handles 2-decimal USD rounding remainders and custom quick-bill weights cleanly", () => {
    const expenses: TripExpense[] = [
      {
        id: "e1",
        title: "Airbnb Room (2:1:1)",
        date: "2026-11-27",
        category: "stay",
        paidByMemberId: "m1",
        mode: "quick",
        amount: 100,
        assigneeIds: ["m1", "m2", "m3"],
        assigneeShares: { m1: 2, m2: 1, m3: 1 },
      },
      {
        id: "e2",
        title: "Uber",
        date: "2026-11-27",
        category: "transport",
        paidByMemberId: "m2",
        mode: "quick",
        amount: 10,
        assigneeIds: ["m1", "m2", "m3"],
      },
    ];

    const result = calculateTrip({
      currency: "USD",
      members: [M_YOU, M_BUDI, M_SARI],
      expenses,
    });

    expect(result.totalSpend).toBe(110);
    const netSum = Number(
      result.balances.reduce((acc, b) => acc + b.netBalance, 0).toFixed(2)
    );
    expect(netSum).toBe(0);

    // Every transfer settles all creditors cleanly
    const positiveSum = Number(
      result.balances
        .filter((b) => b.netBalance > 0)
        .reduce((acc, b) => acc + b.netBalance, 0)
        .toFixed(2)
    );
    const transferSum = Number(
      result.transfers.reduce((acc, t) => acc + t.amount, 0).toFixed(2)
    );
    expect(transferSum).toBe(positiveSum);
  });

  it("splits itemized food delivery fee equally among orderers inside a trip", () => {
    // You pay a GoFood order: You ordered 60k, Budi ordered 40k, Sari ordered nothing.
    // Delivery Fee = 16k (equal among You & Budi = 8k each). Total = 116k.
    // Budi owes You 48k; Sari owes 0.
    const expenses: TripExpense[] = [
      {
        id: "gofood",
        title: "GoFood Late Night",
        date: "2026-11-27",
        category: "food",
        paidByMemberId: "m1",
        mode: "itemized",
        amount: 116000,
        assigneeIds: [],
        items: [
          {
            id: "i1",
            name: "Nasi Goreng",
            qty: 1,
            unitPrice: 60000,
            totalPrice: 60000,
            assigneeIds: ["m1"],
          },
          {
            id: "i2",
            name: "Mie Goreng",
            qty: 1,
            unitPrice: 40000,
            totalPrice: 40000,
            assigneeIds: ["m2"],
          },
        ],
        tax: 0,
        serviceCharge: 0,
        deliveryFee: 16000,
        discount: 0,
      },
    ];

    const result = calculateTrip({
      currency: "IDR",
      members: [M_YOU, M_BUDI, M_SARI],
      expenses,
    });

    expect(result.totalSpend).toBe(116000);
    expect(result.balances.find((b) => b.memberId === "m1")?.netBalance).toBe(48000);
    expect(result.balances.find((b) => b.memberId === "m2")?.netBalance).toBe(-48000);
    expect(result.balances.find((b) => b.memberId === "m3")?.netBalance).toBe(0);
    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0]).toMatchObject({
      fromMemberId: "m2",
      toMemberId: "m1",
      amount: 48000,
    });
  });
});
