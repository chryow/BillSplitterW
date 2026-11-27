import type { CurrencyCode } from "./types";

export interface CurrencyConfig {
  code: CurrencyCode;
  name: string;
  symbol: string;
  decimals: 0 | 2;
  thousandSeparator: "." | ",";
  decimalSeparator: "," | ".";
  symbolSpacing: boolean;
  flag: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  IDR: {
    code: "IDR",
    name: "Indonesian Rupiah",
    symbol: "Rp",
    decimals: 0,
    thousandSeparator: ".",
    decimalSeparator: ",",
    symbolSpacing: true,
    flag: "🇮🇩",
  },
  USD: {
    code: "USD",
    name: "US Dollar",
    symbol: "$",
    decimals: 2,
    thousandSeparator: ",",
    decimalSeparator: ".",
    symbolSpacing: false,
    flag: "🇺🇸",
  },
  SGD: {
    code: "SGD",
    name: "Singapore Dollar",
    symbol: "S$",
    decimals: 2,
    thousandSeparator: ",",
    decimalSeparator: ".",
    symbolSpacing: false,
    flag: "🇸🇬",
  },
  MYR: {
    code: "MYR",
    name: "Malaysian Ringgit",
    symbol: "RM",
    decimals: 2,
    thousandSeparator: ",",
    decimalSeparator: ".",
    symbolSpacing: true,
    flag: "🇲🇾",
  },
  EUR: {
    code: "EUR",
    name: "Euro",
    symbol: "€",
    decimals: 2,
    thousandSeparator: ",",
    decimalSeparator: ".",
    symbolSpacing: false,
    flag: "🇪🇺",
  },
  JPY: {
    code: "JPY",
    name: "Japanese Yen",
    symbol: "¥",
    decimals: 0,
    thousandSeparator: ",",
    decimalSeparator: ".",
    symbolSpacing: false,
    flag: "🇯🇵",
  },
};

export const CURRENCY_LIST: CurrencyConfig[] = [
  CURRENCIES.IDR,
  CURRENCIES.USD,
  CURRENCIES.SGD,
  CURRENCIES.MYR,
  CURRENCIES.EUR,
  CURRENCIES.JPY,
];

export function isSupportedCurrency(code: string | null | undefined): code is CurrencyCode {
  if (!code) return false;
  return code.toUpperCase() in CURRENCIES;
}

export function normalizeCurrencyCode(
  code: string | null | undefined,
  fallback: CurrencyCode = "IDR"
): CurrencyCode {
  if (!code) return fallback;
  const upper = code.trim().toUpperCase();
  if (upper === "RP" || upper === "RUPIAH") return "IDR";
  if (upper === "RM") return "MYR";
  if (upper === "YEN") return "JPY";
  if (upper in CURRENCIES) return upper as CurrencyCode;
  return fallback;
}

export function getCurrencyFactor(currency: CurrencyCode): number {
  return CURRENCIES[currency].decimals === 0 ? 1 : 100;
}

export function toMinorUnits(amount: number, currency: CurrencyCode): number {
  const safe = Number.isFinite(amount) ? amount : 0;
  const factor = getCurrencyFactor(currency);
  return Math.round(safe * factor);
}

export function fromMinorUnits(minor: number, currency: CurrencyCode): number {
  const factor = getCurrencyFactor(currency);
  return factor === 1 ? Math.round(minor) : Number((minor / factor).toFixed(2));
}

export function formatCurrency(amount: number, currency: CurrencyCode): string {
  const config = CURRENCIES[currency];
  const safe = Number.isFinite(amount) ? amount : 0;
  const isNegative = safe < 0;
  const absVal = Math.abs(safe);

  const fixed =
    config.decimals === 0 ? Math.round(absVal).toString() : absVal.toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  const groupedInt = intPart.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    config.thousandSeparator
  );

  const formattedNumber =
    config.decimals === 0
      ? groupedInt
      : `${groupedInt}${config.decimalSeparator}${decPart}`;

  const space = config.symbolSpacing ? " " : "";
  const sign = isNegative ? "-" : "";
  return `${sign}${config.symbol}${space}${formattedNumber}`;
}

/**
 * Formats an editable numeric value cleanly for text inputs without currency symbol.
 */
export function formatEditableAmount(amount: number, currency: CurrencyCode): string {
  const config = CURRENCIES[currency];
  const safe = Number.isFinite(amount) ? amount : 0;
  if (safe === 0) return "";
  if (config.decimals === 0) {
    return Math.round(safe).toString();
  }
  return Number(safe.toFixed(2)).toString();
}

/**
 * Parses user-typed currency strings tolerating IDR dot thousand separators (e.g. "45.000")
 * and standard decimal inputs (e.g. "12.50" or "1,250.50").
 */
export function parseAmountInput(raw: string, currency: CurrencyCode): number {
  const cleaned = raw.trim().replace(/[^\d.,-]/g, "");
  if (!cleaned) return 0;

  const config = CURRENCIES[currency];
  if (config.decimals === 0) {
    // Strip all thousand separators (dots or commas) for zero-decimal currencies
    const digitsOnly = cleaned.replace(/[.,]/g, "");
    const parsed = Number.parseInt(digitsOnly, 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  // For 2-decimal currencies, remove thousand commas and keep last dot as decimal
  const normalized = cleaned.replace(/,/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? Math.max(0, Number(parsed.toFixed(2))) : 0;
}
