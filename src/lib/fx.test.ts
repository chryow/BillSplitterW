import { describe, expect, it } from "vitest";
import {
  convertAmount,
  convertReceiptToCurrency,
  formatExchangeRateLabel,
  getFallbackExchangeRate,
  inferReceiptCurrency,
} from "./fx";
import type { ScannedReceiptResponse } from "./types";

describe("fx & currency auto-detection", () => {
  it("infers IDR on unlabeled Indonesian receipts instead of letting them become S$400,000", () => {
    const receipt: ScannedReceiptResponse = {
      merchant_name: "Warung Kopi",
      currency: null,
      items: [
        { name: "Nasi Goreng", qty: 1, unit_price: 45000, total_price: 45000 },
        { name: "Iced Latte", qty: 2, unit_price: 35000, total_price: 70000 },
      ],
      subtotal: 115000,
      tax: 11500,
      service_charge: 5750,
      discount: 0,
      grand_total: 132250,
      warnings: [],
    };

    expect(inferReceiptCurrency(receipt)).toBe("IDR");
  });

  it("overrides false SGD label when prices are unmistakably IDR (e.g. 400,000)", () => {
    const mislabeled: ScannedReceiptResponse = {
      merchant_name: "Resto Senopati",
      currency: "SGD",
      items: [
        { name: "Ayam Bakar", qty: 4, unit_price: 100000, total_price: 400000 },
      ],
      subtotal: 400000,
      tax: 40000,
      service_charge: 20000,
      discount: 0,
      grand_total: 460000,
      warnings: [],
    };

    expect(inferReceiptCurrency(mislabeled)).toBe("IDR");
  });

  it("preserves legitimate SGD receipts with normal decimal pricing", () => {
    const sgdReceipt: ScannedReceiptResponse = {
      merchant_name: "Maxwell Hainanese Chicken Rice",
      currency: "SGD",
      items: [
        { name: "Chicken Rice", qty: 2, unit_price: 6.5, total_price: 13 },
        { name: "Kopi O", qty: 2, unit_price: 1.8, total_price: 3.6 },
      ],
      subtotal: 16.6,
      tax: 1.49,
      service_charge: 0,
      discount: 0,
      grand_total: 18.09,
      warnings: [],
    };

    expect(inferReceiptCurrency(sgdReceipt)).toBe("SGD");
  });

  it("auto-converts a Rp 400,000 IDR bill cleanly to SGD (~S$33.09) instead of S$400,000", () => {
    const idrReceipt: ScannedReceiptResponse = {
      merchant_name: "Kopi Kitchen",
      currency: "IDR",
      items: [
        { name: "Steak", qty: 2, unit_price: 175000, total_price: 350000 },
      ],
      subtotal: 350000,
      tax: 35000,
      service_charge: 15000,
      discount: 0,
      grand_total: 400000,
      warnings: [],
    };

    const rate = getFallbackExchangeRate("IDR", "SGD");
    const converted = convertReceiptToCurrency(
      idrReceipt,
      "IDR",
      "SGD",
      rate,
      "fallback"
    );

    expect(converted.currency).toBe("SGD");
    expect(converted.grand_total).toBeGreaterThan(25);
    expect(converted.grand_total).toBeLessThan(45);
    expect(converted.conversion?.fromCurrency).toBe("IDR");
    expect(converted.conversion?.toCurrency).toBe("SGD");
    expect(converted.conversion?.originalGrandTotal).toBe(400000);
  });

  it("formats exchange rate labels cleanly for both weak and strong currencies", () => {
    const idrToSgd = 1 / 12100;
    expect(formatExchangeRateLabel("IDR", "SGD", idrToSgd)).toBe(
      "1 SGD ≈ Rp 12.100"
    );
    expect(formatExchangeRateLabel("USD", "IDR", 16200)).toBe(
      "1 USD ≈ Rp 16.200"
    );
    expect(convertAmount(10, 16200, "IDR")).toBe(162000);
  });

  it("converts food delivery_fee alongside items, tax, and discount during FX conversion", () => {
    const deliveryReceipt: ScannedReceiptResponse = {
      merchant_name: "GoFood Martabak",
      currency: "IDR",
      items: [
        { name: "Martabak Manis", qty: 1, unit_price: 80000, total_price: 80000 },
      ],
      subtotal: 80000,
      tax: 8000,
      service_charge: 0,
      delivery_fee: 18000,
      discount: 10000,
      grand_total: 96000,
      warnings: [],
    };

    const rate = 1 / 12000; // 1 SGD = Rp 12,000
    const converted = convertReceiptToCurrency(
      deliveryReceipt,
      "IDR",
      "SGD",
      rate,
      "live"
    );

    expect(converted.currency).toBe("SGD");
    expect(converted.delivery_fee).toBe(1.5);
    expect(converted.grand_total).toBe(8);
  });

  it("infers TWD on Taiwanese receipts and converts TWD to IDR accurately", () => {
    const taiwanReceipt: ScannedReceiptResponse = {
      merchant_name: "鼎泰豐 台北信義店",
      currency: null,
      items: [
        { name: "小籠包", qty: 2, unit_price: 250, total_price: 500 },
        { name: "牛肉麵", qty: 1, unit_price: 300, total_price: 300 },
      ],
      subtotal: 800,
      tax: 0,
      service_charge: 80,
      delivery_fee: 0,
      discount: 0,
      grand_total: 880,
      warnings: [],
    };

    expect(inferReceiptCurrency(taiwanReceipt)).toBe("TWD");

    const rate = getFallbackExchangeRate("TWD", "IDR");
    const converted = convertReceiptToCurrency(
      taiwanReceipt,
      "TWD",
      "IDR",
      rate,
      "fallback"
    );

    expect(converted.currency).toBe("IDR");
    expect(converted.grand_total).toBeGreaterThan(350000);
    expect(converted.grand_total).toBeLessThan(550000);
    expect(converted.conversion?.fromCurrency).toBe("TWD");
    expect(converted.conversion?.toCurrency).toBe("IDR");
  });
});
