import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RECEIPT_CACHE_MAX_ENTRIES, RECEIPT_CACHE_TTL_MS } from "../config";
import type { ScannedReceiptResponse } from "../types";

interface CacheEntry {
  data: ScannedReceiptResponse;
  expiresAt: number;
}

const globalForCache = globalThis as unknown as {
  __billSplitterReceiptCache?: Map<string, CacheEntry>;
};

const cache =
  globalForCache.__billSplitterReceiptCache ?? new Map<string, CacheEntry>();
globalForCache.__billSplitterReceiptCache = cache;

export function hashImageBuffer(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function getCachedReceipt(hash: string): ScannedReceiptResponse | null {
  const entry = cache.get(hash);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    cache.delete(hash);
    return null;
  }

  // Refresh insertion order for lightweight LRU behavior
  cache.delete(hash);
  cache.set(hash, entry);
  return entry.data;
}

export function setCachedReceipt(
  hash: string,
  data: ScannedReceiptResponse
): void {
  const now = Date.now();
  if (cache.has(hash)) {
    cache.delete(hash);
  } else if (cache.size >= RECEIPT_CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }

  cache.set(hash, {
    data,
    expiresAt: now + RECEIPT_CACHE_TTL_MS,
  });
}

/**
 * Checks L1 in-memory cache first, then L2 Supabase `ocr_cache` (persisted across
 * serverless instances for 24h). Gracefully degrades to L1 if migration isn't applied yet.
 */
export async function getPersistentCachedReceipt(
  supabase: SupabaseClient,
  hash: string
): Promise<{ data: ScannedReceiptResponse; layer: "HIT-MEM" | "HIT-DB" } | null> {
  const memHit = getCachedReceipt(hash);
  if (memHit) {
    return { data: memHit, layer: "HIT-MEM" };
  }

  try {
    const { data, error } = await supabase.rpc("get_ocr_cache", {
      p_hash: hash,
    });
    if (!error && data && typeof data === "object" && "items" in data) {
      const receipt = data as ScannedReceiptResponse;
      setCachedReceipt(hash, receipt);
      return { data: receipt, layer: "HIT-DB" };
    }
  } catch {
    // Graceful fallback if ocr_cache migration isn't applied yet
  }

  return null;
}

/**
 * Writes parsed receipt JSON to both L1 in-memory cache and L2 Supabase `ocr_cache`.
 */
export async function setPersistentCachedReceipt(
  supabase: SupabaseClient,
  hash: string,
  data: ScannedReceiptResponse
): Promise<void> {
  setCachedReceipt(hash, data);
  try {
    const ttlHours = Math.max(1, Math.round(RECEIPT_CACHE_TTL_MS / 3_600_000));
    await supabase.rpc("set_ocr_cache", {
      p_hash: hash,
      p_payload: data,
      p_ttl_hours: ttlHours,
    });
  } catch {
    // Non-fatal: L1 cache still populated
  }
}
