import { GoogleGenAI, ThinkingLevel, Type, type Schema } from "@google/genai";
import { GEMINI_MODEL } from "../config";
import type { ScannedReceiptItem, ScannedReceiptResponse } from "../types";

const RECEIPT_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    merchant_name: {
      type: Type.STRING,
      nullable: true,
      description: "Store or restaurant name at the top of the receipt, or null if unreadable.",
    },
    currency: {
      type: Type.STRING,
      nullable: true,
      description: "ISO 4217 3-letter currency code (e.g. IDR, USD, SGD, MYR, EUR, JPY) or null.",
    },
    items: {
      type: Type.ARRAY,
      description: "Line items purchased on the receipt (exclude subtotal, tax, service, discount, grand total, and payment lines).",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          qty: { type: Type.NUMBER },
          unit_price: { type: Type.NUMBER },
          total_price: { type: Type.NUMBER },
        },
        required: ["name", "qty", "unit_price", "total_price"],
      },
    },
    subtotal: {
      type: Type.NUMBER,
      nullable: true,
      description: "Subtotal before tax/service/discount if explicitly printed, else null.",
    },
    tax: {
      type: Type.NUMBER,
      description: "Total tax amount (e.g. PB1, PPN, Tax, VAT, GST). Use 0 if none.",
    },
    service_charge: {
      type: Type.NUMBER,
      description: "Service charge amount (e.g. Service, Svc, SC). Use 0 if none.",
    },
    discount: {
      type: Type.NUMBER,
      description: "Total promo/voucher/discount amount as a POSITIVE number. Use 0 if none.",
    },
    grand_total: {
      type: Type.NUMBER,
      nullable: true,
      description: "Final total payable on the receipt, or null if unreadable.",
    },
    warnings: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Short warnings for blurry text, cut-off sections, or uncertain prices.",
    },
  },
  required: [
    "merchant_name",
    "currency",
    "items",
    "subtotal",
    "tax",
    "service_charge",
    "discount",
    "grand_total",
    "warnings",
  ],
};

const RECEIPT_OCR_PROMPT = `You are a high-accuracy receipt parser built for Indonesian and international restaurant/retail receipts.
Extract structured data from the receipt image and return JSON matching the schema strictly.

Rules:
1. Number formatting:
   - Carefully distinguish dot vs comma thousand separators vs decimals.
   - Indonesian receipts (Rp / IDR) commonly use dots or commas as thousand separators and NO decimals (e.g. "Rp 45.000" or "45,000" -> 45000).
   - International receipts (USD, SGD, MYR, EUR) may include 2 decimals (e.g. "$12.50" -> 12.5, "1,250.50" -> 1250.5).
   - Japanese Yen (JPY) has no decimals (e.g. "¥1,200" -> 1200).
2. Currency detection:
   - Return the 3-letter ISO code when evident ("IDR" for Rp/PB1/PPN/Indonesian receipts, "USD", "SGD", "MYR", "EUR", "JPY"), otherwise null.
3. Line items:
   - Extract only purchased items. Exclude subtotal, tax, service charge, discounts, rounding lines, cash/change, and payment methods.
   - If an item shows quantity (e.g. "2x Iced Latte 76.000"), set qty: 2, total_price: 76000, unit_price: 38000.
   - If quantity is omitted, default qty to 1 and set unit_price = total_price.
4. Tax, Service Charge, and Discount:
   - Combine PB1, PPN, VAT, GST, or Tax into "tax" (0 if absent).
   - Put Service / Svc / SC / Service Charge into "service_charge" (0 if absent).
   - Put promo, voucher, member discount, or cashback deductions into "discount" as a POSITIVE number (e.g. "-15.000" on receipt -> discount: 15000). Use 0 if absent.
5. Warnings:
   - Add a brief user-friendly string in "warnings" if any line is blurry, cropped, folded, or ambiguous. Return [] if clear.`;

function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function sanitizeReceiptResponse(raw: unknown): ScannedReceiptResponse {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const rawItems = Array.isArray(obj.items) ? obj.items : [];
  const items: ScannedReceiptItem[] = rawItems
    .map((entry) => {
      const item = (entry && typeof entry === "object" ? entry : {}) as Record<
        string,
        unknown
      >;
      const name = typeof item.name === "string" ? item.name.trim() : "";
      if (!name) return null;

      const qty = Math.max(1, Math.round(toFiniteNumber(item.qty, 1)));
      let totalPrice = Math.max(0, toFiniteNumber(item.total_price, 0));
      let unitPrice = Math.max(0, toFiniteNumber(item.unit_price, 0));

      if (totalPrice === 0 && unitPrice > 0) {
        totalPrice = Number((unitPrice * qty).toFixed(2));
      } else if (unitPrice === 0 && totalPrice > 0) {
        unitPrice = Number((totalPrice / qty).toFixed(2));
      }

      return {
        name,
        qty,
        unit_price: unitPrice,
        total_price: totalPrice,
      };
    })
    .filter((item): item is ScannedReceiptItem => item !== null);

  const warnings = Array.isArray(obj.warnings)
    ? obj.warnings
        .filter((w): w is string => typeof w === "string" && w.trim().length > 0)
        .map((w) => w.trim())
    : [];

  return {
    merchant_name:
      typeof obj.merchant_name === "string" && obj.merchant_name.trim()
        ? obj.merchant_name.trim()
        : null,
    currency:
      typeof obj.currency === "string" && obj.currency.trim()
        ? obj.currency.trim().toUpperCase()
        : null,
    items,
    subtotal: toNullableNumber(obj.subtotal),
    tax: Math.max(0, toFiniteNumber(obj.tax, 0)),
    service_charge: Math.max(0, toFiniteNumber(obj.service_charge, 0)),
    discount: Math.abs(toFiniteNumber(obj.discount, 0)),
    grand_total: toNullableNumber(obj.grand_total),
    warnings,
  };
}

export async function extractReceiptWithGemini(
  imageBuffer: Buffer,
  mimeType: string,
  apiKey: string
): Promise<ScannedReceiptResponse> {
  const ai = new GoogleGenAI({ apiKey });

  // Strictly use Structured JSON Output + minimal thinking, without custom
  // temperature, topP, topK, frequencyPenalty, or presencePenalty parameters.
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        inlineData: {
          mimeType,
          data: imageBuffer.toString("base64"),
        },
      },
      { text: RECEIPT_OCR_PROMPT },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: RECEIPT_RESPONSE_SCHEMA,
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.MINIMAL,
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Empty OCR response from Gemini.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Could not parse structured JSON from Gemini.");
  }

  return sanitizeReceiptResponse(parsed);
}
