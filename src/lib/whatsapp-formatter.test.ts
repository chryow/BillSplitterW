import { describe, expect, it } from "vitest";
import { calculateSplit } from "./split-engine";
import {
  buildWhatsAppShareUrl,
  formatPersonNudge,
  formatWhatsAppSummary,
} from "./whatsapp-formatter";

describe("whatsapp-formatter", () => {
  const split = calculateSplit({
    currency: "IDR",
    items: [
      {
        id: "i1",
        name: "Truffle Pizza",
        qty: 1,
        unitPrice: 90000,
        totalPrice: 90000,
        assigneeIds: ["p1", "p2"],
        assigneeShares: { p1: 2, p2: 1 },
      },
    ],
    tax: 9000,
    serviceCharge: 0,
    discount: 0,
    participants: [
      { id: "p1", name: "You", color: "#10B981" },
      { id: "p2", name: "Budi", color: "#38BDF8" },
    ],
    feeSplitMode: "proportional",
  });

  it("formats a polite individual nudge with items, custom ratio, and payment details", () => {
    const text = formatPersonNudge({
      merchantName: "Kopi Senopati",
      person: split.people[1],
      currency: "IDR",
      payerName: "You",
      paymentInfo: {
        provider: "BCA",
        accountNumber: "1234567890",
        accountName: "Christian",
        note: "",
      },
      shareUrl: "https://example.com/bill/abc",
    });

    expect(text).toContain("Hi Budi!");
    expect(text).toContain("*Kopi Senopati*");
    expect(text).toContain("*Rp 33.000*");
    expect(text).toContain("Truffle Pizza (1/3)");
    expect(text).toContain("BCA · 1234567890");
    expect(text).toContain("https://example.com/bill/abc");
  });

  it("includes payer, settled checkmark, and rounding buffer note in group summary", () => {
    const summary = formatWhatsAppSummary({
      merchantName: "Kopi Senopati",
      feeSplitMode: "proportional",
      split,
      paidByParticipantId: "p1",
      settledParticipantIds: ["p2"],
      roundingStep: 1000,
      roundingSurplus: 500,
    });

    expect(summary).toContain("Paid by: *You*");
    expect(summary).toContain("_(paid bill)_");
    expect(summary).toContain("👤 *Budi* — *Rp 33.000* ✅");
    expect(summary).toContain("Rounded up to nearest Rp 1.000 (+Rp 500 buffer)");
    expect(buildWhatsAppShareUrl(summary)).toContain("https://wa.me/?text=");
  });

  it("includes delivery fee share in both group summary and individual nudge", () => {
    const deliverySplit = calculateSplit({
      currency: "IDR",
      items: [
        {
          id: "i1",
          name: "Ayam Geprek",
          qty: 1,
          unitPrice: 30000,
          totalPrice: 30000,
          assigneeIds: ["p1"],
        },
        {
          id: "i2",
          name: "Es Kopi",
          qty: 1,
          unitPrice: 20000,
          totalPrice: 20000,
          assigneeIds: ["p2"],
        },
      ],
      tax: 0,
      serviceCharge: 0,
      deliveryFee: 14000,
      discount: 0,
      participants: [
        { id: "p1", name: "You", color: "#10B981" },
        { id: "p2", name: "Budi", color: "#38BDF8" },
      ],
      feeSplitMode: "proportional",
    });

    const summary = formatWhatsAppSummary({
      merchantName: "GoFood Order",
      feeSplitMode: "proportional",
      split: deliverySplit,
    });
    expect(summary).toContain("Deliv Rp 7.000");

    const nudge = formatPersonNudge({
      merchantName: "GoFood Order",
      person: deliverySplit.people[1],
      currency: "IDR",
    });
    expect(nudge).toContain("*Rp 27.000*");
    expect(nudge).toContain("Deliv Rp 7.000");
  });
});
