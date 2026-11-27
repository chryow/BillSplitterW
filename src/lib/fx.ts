import {
  formatCurrency,
  normalizeCurrencyCode,
  roundForCurrency,
} from "./currency";
import type {
  CurrencyCode,
  ScannedReceiptResponse,
} from "./types";

/**
 * Mid-market fallback rates per 1 USD (used only when live FX API is unreachable).
 */
export const FALLBACK_RATES_PER_USD: Record<CurrencyCode, number> = {
  USD: 1,
  IDR: 16200,
  SGD: 1.34,
  MYR: 4.45,
  EUR: 0.92,
  JPY: 152,
};

export interface ExchangeRateResult {
  from: CurrencyCode;
  to: CurrencyCode;
  rate: number;
  source: "live" | "fallback";
}

export function getFallbackExchangeRate(
  from: CurrencyCode,
  to: CurrencyCode
): number {
  if (from === to) return 1;
  const fromPerUsd = FALLBACK_RATES_PER_USD[from];
  const toPerUsd = FALLBACK_RATES_PER_USD[to];
  return toPerUsd / fromPerUsd;
}

export function getFallbackRateTable(
  base: CurrencyCode
): Record<CurrencyCode, number> {
  const codes: CurrencyCode[] = ["IDR", "USD", "SGD", "MYR", "EUR", "JPY"];
  const table = {} as Record<CurrencyCode, number>;
  for (const code of codes) {
    table[code] = getFallbackExchangeRate(base, code);
  }
  return table;
}

export function convertAmount(
  amount: number,
  rate: number,
  targetCurrency: CurrencyCode
): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (!Number.isFinite(rate) || rate <= 0) {
    return roundForCurrency(amount, targetCurrency);
  }
  return roundForCurrency(amount * rate, targetCurrency);
}

/**
 * Formats an intuitive human-readable exchange rate label, e.g.:
 * - IDR -> SGD: "1 SGD ≈ Rp 12.090"
 * - USD -> IDR: "1 USD ≈ Rp 16.200"
 * - USD -> SGD: "1 USD ≈ S$1.34"
 */
export function formatExchangeRateLabel(
  from: CurrencyCode,
  to: CurrencyCode,
  rate: number
): string {
  if (from === to || !Number.isFinite(rate) || rate <= 0) return "";
  if (rate < 0.05) {
    const inverse = 1 / rate;
    return `1 ${to} ≈ ${formatCurrency(inverse, from)}`;
  }
  return `1 ${from} ≈ ${formatCurrency(rate, to)}`;
}

const INDONESIAN_CUES_REGEX =
  /\b(pb1|ppn|rp\.?|rupiah|tunai|kembalian|diskon|nasi|ayam|mie|soto|bakso|kopi|teh|es\s|jl\.?|jakarta|bandung|bali|surabaya|senopati|kemang|warung|resto)\b/i;

/**
 * Determines the receipt's actual currency from Gemini's output + defensive heuristics.
 * Prevents unlabeled Indonesian receipts (e.g. "400.000" without "Rp") from being
 * mislabeled as SGD/USD/MYR/EUR ("S$400,000").
 */
export function inferReceiptCurrency(
  receipt: ScannedReceiptResponse
): CurrencyCode | null {
  const explicit = receipt.currency
    ? normalizeCurrencyCode(receipt.currency, "IDR")
    : null;

  const positivePrices = receipt.items
    .map((i) => i.total_price)
    .filter((p) => Number.isFinite(p) && p > 0)
    .sort((a, b) => a - b);

  const allText = [
    receipt.merchant_name ?? "",
    ...receipt.items.map((i) => i.name),
  ].join(" ");
  const hasIndonesianCue = INDONESIAN_CUES_REGEX.test(allText);

  const medianPrice =
    positivePrices.length > 0
      ? positivePrices[Math.floor(positivePrices.length / 2)]
      : receipt.grand_total ?? 0;

  const allIntegers = positivePrices.every((p) => Number.isInteger(p));
  const looksLikeIdrMagnitude =
    allIntegers &&
    ((medianPrice >= 10000 && positivePrices.some((p) => p % 100 === 0)) ||
      (receipt.grand_total !== null &&
        receipt.grand_total >= 20000 &&
        Number.isInteger(receipt.grand_total) &&
        receipt.grand_total % 100 === 0));

  // If Gemini returned an explicit supported currency, double-check against obvious
  // IDR magnitude collisions (e.g. an Indonesian receipt misread as SGD/USD 400,000)
  if (receipt.currency && explicit) {
    const isTwoDecimalCurrency =
      explicit === "USD" ||
      explicit === "SGD" ||
      explicit === "MYR" ||
      explicit === "EUR";
    if (isTwoDecimalCurrency && looksLikeIdrMagnitude && hasIndonesianCue) {
      return "IDR";
    }
    if (
      isTwoDecimalCurrency &&
      allIntegers &&
      medianPrice >= 15000 &&
      positivePrices.every((p) => p % 100 === 0)
    ) {
      return "IDR";
    }
    return explicit;
  }

  // Gemini returned null: infer IDR when Indonesian cues or unmistakable IDR magnitudes exist
  if (hasIndonesianCue && medianPrice >= 1000) {
    return "IDR";
  }
  if (looksLikeIdrMagnitude) {
    return "IDR";
  }

  return null;
}

/**
 * Converts every monetary field of a scanned receipt into `targetCurrency` using `rate`.
 */
export function convertReceiptToCurrency(
  receipt: ScannedReceiptResponse,
  fromCurrency: CurrencyCode,
  targetCurrency: CurrencyCode,
  rate: number,
  source: "live" | "fallback"
): ScannedReceiptResponse {
  if (fromCurrency === targetCurrency) {
    return {
      ...receipt,
      currency: targetCurrency,
    };
  }

  const convertedItems = receipt.items.map((item) => {
    const qty = Math.max(1, Math.round(item.qty || 1));
    const convertedTotal = convertAmount(item.total_price, rate, targetCurrency);
    const convertedUnit = roundForCurrency(
      convertedTotal / qty,
      targetCurrency
    );
    return {
      ...item,
      qty,
      unit_price: convertedUnit,
      total_price: convertedTotal,
    };
  });

  const convertedTax = convertAmount(receipt.tax, rate, targetCurrency);
  const convertedService = convertAmount(
    receipt.service_charge,
    rate,
    targetCurrency
  );
  const convertedDiscount = convertAmount(
    receipt.discount,
    rate,
    targetCurrency
  );
  const convertedSubtotal =
    receipt.subtotal !== null
      ? convertAmount(receipt.subtotal, rate, targetCurrency)
      : null;
  const convertedGrandTotal =
    receipt.grand_total !== null
      ? convertAmount(receipt.grand_total, rate, targetCurrency)
      : null;

  return {
    ...receipt,
    currency: targetCurrency,
    items: convertedItems,
    subtotal: convertedSubtotal,
    tax: convertedTax,
    service_charge: convertedService,
    discount: convertedDiscount,
    grand_total: convertedGrandTotal,
    conversion: {
      fromCurrency,
      toCurrency: targetCurrency,
      rate,
      source,
      originalGrandTotal: receipt.grand_total,
    },
  };
}
