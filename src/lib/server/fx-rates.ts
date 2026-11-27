import {
  getFallbackRateTable,
  type ExchangeRateResult,
} from "../fx";
import type { CurrencyCode } from "../types";

const SUPPORTED_CODES: CurrencyCode[] = [
  "IDR",
  "USD",
  "SGD",
  "MYR",
  "EUR",
  "JPY",
  "TWD",
];

const FX_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface CachedFxTable {
  rates: Record<CurrencyCode, number>;
  source: "live" | "fallback";
  updatedAt: string;
  expiresAt: number;
}

const globalForFx = globalThis as unknown as {
  __billSplitterFxCache?: Map<CurrencyCode, CachedFxTable>;
};

const fxCache =
  globalForFx.__billSplitterFxCache ?? new Map<CurrencyCode, CachedFxTable>();
globalForFx.__billSplitterFxCache = fxCache;

async function fetchJsonWithTimeout(
  url: string,
  timeoutMs = 3500
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 21600 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extractSupportedRates(
  rawRates: Record<string, unknown>,
  base: CurrencyCode
): Record<CurrencyCode, number> | null {
  const fallback = getFallbackRateTable(base);
  const out = {} as Record<CurrencyCode, number>;
  let validCount = 0;

  for (const code of SUPPORTED_CODES) {
    if (code === base) {
      out[code] = 1;
      validCount++;
      continue;
    }
    const raw = rawRates[code];
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
      out[code] = raw;
      validCount++;
    } else {
      out[code] = fallback[code];
    }
  }

  return validCount >= 4 ? out : null;
}

/**
 * Fetches live mid-market FX rates for `base` (cached 6h per instance),
 * trying open.er-api.com then frankfurter.app, and seamlessly falling back
 * to built-in approximate rates if offline or timed out.
 */
export async function getLiveRateTable(base: CurrencyCode): Promise<{
  base: CurrencyCode;
  rates: Record<CurrencyCode, number>;
  source: "live" | "fallback";
  updatedAt: string;
}> {
  const cached = fxCache.get(base);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      base,
      rates: cached.rates,
      source: cached.source,
      updatedAt: cached.updatedAt,
    };
  }

  // Primary free no-key FX source (supports IDR, SGD, MYR, USD, EUR, JPY)
  const primary = (await fetchJsonWithTimeout(
    `https://open.er-api.com/v6/latest/${base}`
  )) as { rates?: Record<string, unknown> } | null;

  if (primary?.rates) {
    const parsed = extractSupportedRates(primary.rates, base);
    if (parsed) {
      const entry: CachedFxTable = {
        rates: parsed,
        source: "live",
        updatedAt: new Date().toISOString(),
        expiresAt: Date.now() + FX_CACHE_TTL_MS,
      };
      fxCache.set(base, entry);
      return {
        base,
        rates: entry.rates,
        source: entry.source,
        updatedAt: entry.updatedAt,
      };
    }
  }

  // Secondary free no-key FX source
  const secondary = (await fetchJsonWithTimeout(
    `https://api.frankfurter.app/latest?from=${base}`
  )) as { rates?: Record<string, unknown> } | null;

  if (secondary?.rates) {
    const parsed = extractSupportedRates(secondary.rates, base);
    if (parsed) {
      const entry: CachedFxTable = {
        rates: parsed,
        source: "live",
        updatedAt: new Date().toISOString(),
        expiresAt: Date.now() + FX_CACHE_TTL_MS,
      };
      fxCache.set(base, entry);
      return {
        base,
        rates: entry.rates,
        source: entry.source,
        updatedAt: entry.updatedAt,
      };
    }
  }

  // Graceful fallback (cache for shorter 15 min so live recovers quickly)
  const fallbackRates = getFallbackRateTable(base);
  const fallbackEntry: CachedFxTable = {
    rates: fallbackRates,
    source: "fallback",
    updatedAt: new Date().toISOString(),
    expiresAt: Date.now() + 15 * 60 * 1000,
  };
  fxCache.set(base, fallbackEntry);
  return {
    base,
    rates: fallbackEntry.rates,
    source: fallbackEntry.source,
    updatedAt: fallbackEntry.updatedAt,
  };
}

export async function getExchangeRate(
  from: CurrencyCode,
  to: CurrencyCode
): Promise<ExchangeRateResult> {
  if (from === to) {
    return { from, to, rate: 1, source: "live" };
  }
  const table = await getLiveRateTable(from);
  return {
    from,
    to,
    rate: table.rates[to],
    source: table.source,
  };
}
