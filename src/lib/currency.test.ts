import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  getCurrencyConfig,
  normalizeCurrencyCode,
  parseAmountInput,
  roundForCurrency,
} from "./currency";

describe("currency helpers", () => {
  it("normalizes currency codes and symbols safely", () => {
    expect(normalizeCurrencyCode("Rp")).toBe("IDR");
    expect(normalizeCurrencyCode("rupiah")).toBe("IDR");
    expect(normalizeCurrencyCode("$")).toBe("USD");
    expect(normalizeCurrencyCode("US$")).toBe("USD");
    expect(normalizeCurrencyCode("S$")).toBe("SGD");
    expect(normalizeCurrencyCode("RM")).toBe("MYR");
    expect(normalizeCurrencyCode("€")).toBe("EUR");
    expect(normalizeCurrencyCode("¥")).toBe("JPY");
    expect(normalizeCurrencyCode(null, "IDR")).toBe("IDR");
    expect(normalizeCurrencyCode("UNKNOWN", "IDR")).toBe("IDR");
  });

  it("parses 2-decimal USD inputs including dot and comma decimals", () => {
    expect(parseAmountInput("0.50", "USD")).toBe(0.5);
    expect(parseAmountInput(".75", "USD")).toBe(0.75);
    expect(parseAmountInput("12.", "USD")).toBe(12);
    expect(parseAmountInput("12.05", "USD")).toBe(12.05);
    expect(parseAmountInput("12,50", "USD")).toBe(12.5);
    expect(parseAmountInput("1,250.50", "USD")).toBe(1250.5);
    expect(parseAmountInput("1.250,50", "USD")).toBe(1250.5);
    expect(parseAmountInput("1,250", "USD")).toBe(1250);
  });

  it("parses zero-decimal IDR inputs with dot or comma thousand separators", () => {
    expect(parseAmountInput("45.000", "IDR")).toBe(45000);
    expect(parseAmountInput("45,000", "IDR")).toBe(45000);
    expect(parseAmountInput("1.250.000", "IDR")).toBe(1250000);
    expect(parseAmountInput("", "IDR")).toBe(0);
  });

  it("formats currencies accurately and safely falls back on invalid codes", () => {
    expect(formatCurrency(45000, "IDR")).toBe("Rp 45.000");
    expect(formatCurrency(12.5, "USD")).toBe("$12.50");
    expect(formatCurrency(1200, "JPY")).toBe("¥1,200");
    expect(getCurrencyConfig("INVALID").code).toBe("IDR");
    expect(roundForCurrency(12.567, "IDR")).toBe(13);
    expect(roundForCurrency(12.567, "USD")).toBe(12.57);
  });
});
