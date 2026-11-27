import { PARTICIPANT_COLORS } from "./config";
import type { PaymentInfo, Trip } from "./types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Realistic 3-person Bali Weekend sample trip showcasing:
 * 1. Quick equal split bill (Villa paid by You)
 * 2. Quick partial/transport bill (Car & Fuel paid by Budi)
 * 3. Full itemized restaurant receipt with PB1 + service + promo (Dinner paid by Sari)
 */
export function createSampleTrip(
  defaultSelfName = "You",
  selfPaymentInfo?: PaymentInfo
): Trip {
  const now = new Date().toISOString();
  const date = todayIso();
  const m1 = `tm-${Date.now()}-1`;
  const m2 = `tm-${Date.now()}-2`;
  const m3 = `tm-${Date.now()}-3`;

  return {
    id: `trip-${Date.now()}`,
    savedTripId: null,
    shareSlug: null,
    isPublic: true,
    name: "Bali Weekend",
    currency: "IDR",
    members: [
      {
        id: m1,
        name: defaultSelfName,
        color: PARTICIPANT_COLORS[0],
        paymentInfo: selfPaymentInfo,
      },
      {
        id: m2,
        name: "Budi",
        color: PARTICIPANT_COLORS[1],
        paymentInfo: {
          provider: "BCA",
          accountNumber: "5480192837",
          accountName: "Budi Santoso",
          note: "",
        },
      },
      {
        id: m3,
        name: "Sari",
        color: PARTICIPANT_COLORS[2],
        paymentInfo: {
          provider: "GoPay",
          accountNumber: "0812-8899-4411",
          accountName: "Sari Dewi",
          note: "",
        },
      },
    ],
    expenses: [
      {
        id: `exp-${Date.now()}-1`,
        title: "Villa Seminyak (2 Nights)",
        date,
        category: "stay",
        paidByMemberId: m1,
        mode: "quick",
        amount: 2400000,
        assigneeIds: [m1, m2, m3],
      },
      {
        id: `exp-${Date.now()}-2`,
        title: "Car Rental + Petrol",
        date,
        category: "transport",
        paidByMemberId: m2,
        mode: "quick",
        amount: 750000,
        assigneeIds: [m1, m2, m3],
      },
      {
        id: `exp-${Date.now()}-3`,
        title: "Naughty Nuri's Dinner",
        date,
        category: "food",
        paidByMemberId: m3,
        mode: "itemized",
        amount: 556700,
        assigneeIds: [m1, m2, m3],
        items: [
          {
            id: `ti-${Date.now()}-1`,
            name: "Signature BBQ Ribs",
            qty: 2,
            unitPrice: 175000,
            totalPrice: 350000,
            assigneeIds: [m1, m2],
          },
          {
            id: `ti-${Date.now()}-2`,
            name: "Grilled Chicken Satay",
            qty: 1,
            unitPrice: 95000,
            totalPrice: 95000,
            assigneeIds: [m3],
          },
          {
            id: `ti-${Date.now()}-3`,
            name: "Fresh Coconut (Shared)",
            qty: 3,
            unitPrice: 35000,
            totalPrice: 105000,
            assigneeIds: [m1, m2, m3],
          },
        ],
        serviceCharge: 27500,
        tax: 57750,
        discount: 50000,
      },
    ],
    settledTransferKeys: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createNewTrip(
  name: string,
  currency: Trip["currency"],
  members: Trip["members"]
): Trip {
  const now = new Date().toISOString();
  return {
    id: `trip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    savedTripId: null,
    shareSlug: null,
    isPublic: true,
    name: name.trim() || "New Trip",
    currency,
    members,
    expenses: [],
    settledTransferKeys: [],
    createdAt: now,
    updatedAt: now,
  };
}
