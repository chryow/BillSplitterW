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
  TWD: {
    code: "TWD",
    name: "New Taiwan Dollar",
    symbol: "NT$",
    decimals: 0,
    thousandSeparator: ",",
    decimalSeparator: ".",
    symbolSpacing: false,
    flag: "🇹🇼",
  },
};

export const CURRENCY_LIST: CurrencyConfig[] = [
  CURRENCIES.IDR,
  CURRENCIES.USD,
  CURRENCIES.SGD,
  CURRENCIES.MYR,
  CURRENCIES.EUR,
  CURRENCIES.JPY,
  CURRENCIES.TWD,
];

const MAX_SAFE_AMOUNT = 999_999_999;

export function getCurrencyConfig(
  currency: string | null | undefined
): CurrencyConfig {
  if (currency && currency in CURRENCIES) {
    return CURRENCIES[currency as CurrencyCode];
  }
  return CURRENCIES.IDR;
}

export function isSupportedCurrency(
  code: string | null | undefined
): code is CurrencyCode {
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
  if (upper === "$" || upper === "US$" || upper === "USD$") return "USD";
  if (upper === "S$" || upper === "SG$") return "SGD";
  if (upper === "RM") return "MYR";
  if (upper === "€") return "EUR";
  if (upper === "¥" || upper === "YEN") return "JPY";
  if (
    upper === "NT$" ||
    upper === "NT" ||
    upper === "NTD" ||
    upper === "TW$" ||
    upper === "新台幣" ||
    upper === "台幣"
  ) {
    return "TWD";
  }
  if (upper in CURRENCIES) return upper as CurrencyCode;
  return fallback;
}

export function getCurrencyFactor(currency: CurrencyCode): number {
  return getCurrencyConfig(currency).decimals === 0 ? 1 : 100;
}

export function roundForCurrency(
  amount: number,
  currency: CurrencyCode
): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const clamped = Math.min(amount, MAX_SAFE_AMOUNT);
  const config = getCurrencyConfig(currency);
  return config.decimals === 0
    ? Math.round(clamped)
    : Number(clamped.toFixed(2));
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
  const config = getCurrencyConfig(currency);
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
export function formatEditableAmount(
  amount: number,
  currency: CurrencyCode
): string {
  const config = getCurrencyConfig(currency);
  const safe = Number.isFinite(amount) ? amount : 0;
  if (safe <= 0) return "";
  if (config.decimals === 0) {
    return Math.round(safe).toString();
  }
  return Number(safe.toFixed(2)).toString();
}

/**
 * Parses user-typed currency strings tolerating:
 * - Zero-decimal currencies (IDR, JPY): strips dot/comma thousand separators ("45.000" -> 45000).
 * - Two-decimal currencies (USD, SGD, MYR, EUR):
 *   - Standard dot decimals ("12.50" -> 12.5, "0.99" -> 0.99, "1,250.50" -> 1250.5)
 *   - Comma decimals ("12,50" -> 12.5, "1.250,50" -> 1250.5)
 *   - Thousand-grouped integers ("1,250" -> 1250)
 */
export function parseAmountInput(raw: string, currency: CurrencyCode): number {
  const cleaned = raw.trim().replace(/[^\d.,]/g, "");
  if (!cleaned) return 0;

  const config = getCurrencyConfig(currency);
  if (config.decimals === 0) {
    const digitsOnly = cleaned.replace(/[.,]/g, "");
    const parsed = Number.parseInt(digitsOnly, 10);
    return Number.isFinite(parsed)
      ? Math.min(Math.max(0, parsed), MAX_SAFE_AMOUNT)
      : 0;
  }

  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  let normalized: string;

  if (lastDot !== -1 && lastComma !== -1) {
    // Both separators present: whichever appears last is the decimal separator
    if (lastComma > lastDot) {
      // e.g. "1.250,50"
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      // e.g. "1,250.50"
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (lastComma !== -1) {
    // Only comma(s) present: single comma with 1-2 trailing digits is decimal ("12,50")
    const commaCount = (cleaned.match(/,/g) ?? []).length;
    const digitsAfterComma = cleaned.length - lastComma - 1;
    if (commaCount === 1 && digitsAfterComma > 0 && digitsAfterComma <= 2) {
      normalized = cleaned.replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (lastDot !== -1) {
    // Only dot(s) present: multiple dots are thousand separators ("1.250.000")
    const dotCount = (cleaned.match(/\./g) ?? []).length;
    normalized = dotCount > 1 ? cleaned.replace(/\./g, "") : cleaned;
  } else {
    normalized = cleaned;
  }

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return roundForCurrency(Math.max(0, parsed), currency);
}
