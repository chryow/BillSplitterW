import { normalizeCurrencyCode } from "./currency";
import type { AppStep, BillState, PaymentInfo, Trip } from "./types";

const ACTIVE_BILL_KEY = "billsplitterw:active-bill:v1";
const PAYMENT_INFO_KEY = "billsplitterw:payment-info:v1";
const THEME_KEY = "billsplitterw:theme:v1";

export interface StoredSession {
  step: AppStep;
  bill: BillState;
}

export const EMPTY_PAYMENT_INFO: PaymentInfo = {
  provider: "",
  accountNumber: "",
  accountName: "",
  note: "",
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadActiveSession(): StoredSession | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_BILL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (!parsed.bill || !Array.isArray(parsed.bill.items)) return null;
    const step = parsed.step;
    const validStep: AppStep =
      step === 1 || step === 2 || step === 3 || step === 4 ? step : 1;
    const safeCurrency = normalizeCurrencyCode(parsed.bill.currency, "IDR");
    const participants = Array.isArray(parsed.bill.participants)
      ? parsed.bill.participants
      : [];
    const validIds = new Set(participants.map((p) => p.id));
    const rawPaidBy =
      typeof parsed.bill.paidByParticipantId === "string" &&
      validIds.has(parsed.bill.paidByParticipantId)
        ? parsed.bill.paidByParticipantId
        : participants[0]?.id ?? null;
    const rawSettled = Array.isArray(parsed.bill.settledParticipantIds)
      ? parsed.bill.settledParticipantIds.filter(
          (id): id is string => typeof id === "string" && validIds.has(id)
        )
      : [];

    const rawDeliveryFee =
      typeof parsed.bill.deliveryFee === "number" &&
      Number.isFinite(parsed.bill.deliveryFee) &&
      parsed.bill.deliveryFee >= 0
        ? parsed.bill.deliveryFee
        : 0;

    return {
      step: validStep,
      bill: {
        ...parsed.bill,
        currency: safeCurrency,
        deliveryFee: rawDeliveryFee,
        feeSplitMode: "proportional",
        paidByParticipantId: rawPaidBy,
        settledParticipantIds: rawSettled,
      },
    };
  } catch {
    return null;
  }
}

export function saveActiveSession(session: StoredSession): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(ACTIVE_BILL_KEY, JSON.stringify(session));
  } catch {
    // Ignore quota/private-mode storage errors silently
  }
}

export function clearActiveSession(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(ACTIVE_BILL_KEY);
  } catch {
    // Ignore
  }
}

export function loadLocalPaymentInfo(): PaymentInfo {
  if (!isBrowser()) return { ...EMPTY_PAYMENT_INFO };
  try {
    const raw = window.localStorage.getItem(PAYMENT_INFO_KEY);
    if (!raw) return { ...EMPTY_PAYMENT_INFO };
    const parsed = JSON.parse(raw) as Partial<PaymentInfo>;
    return {
      provider: typeof parsed.provider === "string" ? parsed.provider : "",
      accountNumber:
        typeof parsed.accountNumber === "string" ? parsed.accountNumber : "",
      accountName: typeof parsed.accountName === "string" ? parsed.accountName : "",
      note: typeof parsed.note === "string" ? parsed.note : "",
    };
  } catch {
    return { ...EMPTY_PAYMENT_INFO };
  }
}

export function saveLocalPaymentInfo(info: PaymentInfo): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(PAYMENT_INFO_KEY, JSON.stringify(info));
  } catch {
    // Ignore
  }
}

export type ThemeMode = "dark" | "light";

export function loadTheme(): ThemeMode {
  if (!isBrowser()) return "dark";
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return stored === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function saveTheme(theme: ThemeMode): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore
  }
}

const LOCAL_TRIPS_KEY = "billsplitterw:trips:v1";

export function loadLocalTrips(): Trip[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_TRIPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t): t is Trip => Boolean(t && typeof t === "object" && t.id && t.name))
      .map((t) => ({
        ...t,
        currency: normalizeCurrencyCode(t.currency, "IDR"),
        members: Array.isArray(t.members) ? t.members : [],
        expenses: Array.isArray(t.expenses) ? t.expenses : [],
        settledTransferKeys: Array.isArray(t.settledTransferKeys)
          ? t.settledTransferKeys
          : [],
      }));
  } catch {
    return [];
  }
}

export function saveLocalTrips(trips: Trip[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(LOCAL_TRIPS_KEY, JSON.stringify(trips));
  } catch {
    // Ignore storage quota errors
  }
}
