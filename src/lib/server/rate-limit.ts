import { MAX_SCANS_PER_DAY, RATE_LIMIT_WINDOW_MS } from "../config";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
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

export function consumeScanRateLimit(
  ip: string,
  limit = MAX_SCANS_PER_DAY
): RateLimitResult {
  const now = Date.now();
  pruneExpiredBuckets(now);

  const existing = buckets.get(ip);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    buckets.set(ip, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      resetAt,
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSeconds: 0,
  };
}
