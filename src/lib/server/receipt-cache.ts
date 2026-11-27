import crypto from "node:crypto";
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
