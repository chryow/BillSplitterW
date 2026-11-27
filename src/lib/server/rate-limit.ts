import { MAX_SCANS_PER_DAY, RATE_LIMIT_WINDOW_MS } from "../config";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  used: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

// Keep map on globalThis so Next.js dev hot-reloads preserve counts cleanly
const globalForRateLimit = globalThis as unknown as {
  __billSplitterRateLimit?: Map<string, RateLimitBucket>;
};

const buckets =
  globalForRateLimit.__billSplitterRateLimit ?? new Map<string, RateLimitBucket>();
globalForRateLimit.__billSplitterRateLimit = buckets;

function pruneExpiredBuckets(now: number): void {
  if (buckets.size < 500) return;
  for (const [ip, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(ip);
    }
  }
}

export function extractClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown-ip";
}

export function peekScanRateLimit(
  key: string,
  limit = MAX_SCANS_PER_DAY
): { used: number; remaining: number; resetAt: number } {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    return {
      used: 0,
      remaining: limit,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    };
  }
  return {
    used: existing.count,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}

export function consumeScanRateLimit(
  key: string,
  limit = MAX_SCANS_PER_DAY
): RateLimitResult {
  const now = Date.now();
  pruneExpiredBuckets(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    buckets.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      used: 1,
      remaining: Math.max(0, limit - 1),
      resetAt,
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      used: existing.count,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    used: existing.count,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSeconds: 0,
  };
}
