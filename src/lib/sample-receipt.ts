import { PARTICIPANT_COLORS } from "./config";
import type { BillState } from "./types";

/**
 * Realistic Indonesian restaurant receipt for instant testing without an API key.
 * Subtotal: 326,000 | Service (5%): 16,300 | PB1 Tax (10%): 34,230 | Promo: -25,000
 * Grand Total: 351,530
 */
export function createSampleReceiptState(defaultSelfName = "You"): BillState {
  const p1 = "sample-p1";
  const p2 = "sample-p2";
  const p3 = "sample-p3";

  return {
    savedBillId: null,
    shareSlug: null,
    isPublic: true,
    merchantName: "Kopi & Kitchen Senopati",
    currency: "IDR",
    items: [
      {
        id: "sample-item-1",
        name: "Nasi Goreng Kampung",
        qty: 2,
        unitPrice: 48000,
        totalPrice: 96000,
        assigneeIds: [p1, p2],
      },
      {
        id: "sample-item-2",
        name: "Ayam Bakar Madu",
        qty: 1,
        unitPrice: 62000,
        totalPrice: 62000,
        assigneeIds: [p3],
      },
      {
        id: "sample-item-3",
        name: "Iced Caramel Latte",
        qty: 2,
        unitPrice: 38000,
        totalPrice: 76000,
        assigneeIds: [p1, p3],
      },
      {
        id: "sample-item-4",
        name: "Es Teh Lychee",
        qty: 1,
        unitPrice: 28000,
        totalPrice: 28000,
        assigneeIds: [p2],
      },
      {
        id: "sample-item-5",
        name: "Crispy Calamari (Shared)",
        qty: 1,
        unitPrice: 64000,
        totalPrice: 64000,
        assigneeIds: [p1, p2, p3],
      },
    ],
    tax: 34230,
    serviceCharge: 16300,
    deliveryFee: 0,
    discount: 25000,
    scannedGrandTotal: 351530,
    warnings: [],
    participants: [
      { id: p1, name: defaultSelfName, color: PARTICIPANT_COLORS[0] },
      { id: p2, name: "Budi", color: PARTICIPANT_COLORS[1] },
      { id: p3, name: "Sari", color: PARTICIPANT_COLORS[2] },
    ],
    feeSplitMode: "proportional",
    paidByParticipantId: p1,
    settledParticipantIds: [],
  };
}

export function createEmptyBillState(
  currency: BillState["currency"] = "IDR",
  defaultSelfName = "You"
): BillState {
  const firstPersonId = `p-${Date.now()}-1`;
  return {
    savedBillId: null,
    shareSlug: null,
    isPublic: true,
    merchantName: "",
    currency,
    items: [
      {
        id: `item-${Date.now()}-1`,
        name: "",
        qty: 1,
        unitPrice: 0,
        totalPrice: 0,
        assigneeIds: [],
      },
    ],
    tax: 0,
    serviceCharge: 0,
    deliveryFee: 0,
    discount: 0,
    scannedGrandTotal: null,
    warnings: [],
    participants: [
      { id: firstPersonId, name: defaultSelfName, color: PARTICIPANT_COLORS[0] },
    ],
    feeSplitMode: "proportional",
    paidByParticipantId: firstPersonId,
    settledParticipantIds: [],
  };
}
