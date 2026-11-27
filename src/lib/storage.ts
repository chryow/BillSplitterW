import { normalizeCurrencyCode } from "./currency";
import type { AppStep, BillState, PaymentInfo } from "./types";

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
    return {
      step: validStep,
      bill: {
        ...parsed.bill,
        currency: safeCurrency,
        feeSplitMode: "proportional",
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
