import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_SCANS_PER_DAY } from "../config";
import { consumeScanRateLimit, peekScanRateLimit } from "./rate-limit";

export interface ScanQuotaStatus {
  used: number;
  remaining: number;
  limit: number;
  resetAt: string;
  source: "db" | "memory";
}

export interface ConsumeQuotaResult extends ScanQuotaStatus {
  allowed: boolean;
  retryAfterSeconds: number;
}

function secondsUntilIso(iso: string): number {
  const target = Date.parse(iso);
  if (!Number.isFinite(target)) return 3600;
  return Math.max(1, Math.ceil((target - Date.now()) / 1000));
}

/**
 * Reads today's OCR scan quota for an authenticated user from Supabase `scan_usage`
 * via the `get_scan_quota` RPC, with graceful fallback to in-memory state if the
 * migration hasn't been applied yet.
 */
export async function getScanQuotaForUser(
  supabase: SupabaseClient,
  userId: string,
  limit = MAX_SCANS_PER_DAY
): Promise<ScanQuotaStatus> {
  try {
    const { data, error } = await supabase.rpc("get_scan_quota", {
      p_limit: limit,
    });
    const row = Array.isArray(data) ? data[0] : data;

    if (!error && row && typeof row === "object") {
      const rec = row as Record<string, unknown>;
      const used = Math.max(0, Number(rec.used ?? 0));
      const dailyLimit = Math.max(1, Number(rec.daily_limit ?? limit));
      const remaining = Math.max(0, Number(rec.remaining ?? dailyLimit - used));
      const resetAt =
        typeof rec.reset_at === "string"
          ? rec.reset_at
          : new Date(Date.now() + 86_400_000).toISOString();

      return {
        used,
        remaining,
        limit: dailyLimit,
        resetAt,
        source: "db",
      };
    }
  } catch {
    // Fall through to in-memory fallback
  }

  const mem = peekScanRateLimit(`user:${userId}`, limit);
  return {
    used: mem.used,
    remaining: mem.remaining,
    limit,
    resetAt: new Date(mem.resetAt).toISOString(),
    source: "memory",
  };
}

/**
 * Atomically consumes 1 scan from the authenticated user's daily quota in Supabase
 * (`consume_scan_quota` RPC), falling back cleanly to the in-memory limiter if the
 * DB table/RPC is not yet present.
 */
export async function consumeScanQuotaForUser(
  supabase: SupabaseClient,
  userId: string,
  limit = MAX_SCANS_PER_DAY
): Promise<ConsumeQuotaResult> {
  try {
    const { data, error } = await supabase.rpc("consume_scan_quota", {
      p_limit: limit,
    });
    const row = Array.isArray(data) ? data[0] : data;

    if (!error && row && typeof row === "object") {
      const rec = row as Record<string, unknown>;
      const allowed = Boolean(rec.allowed);
      const used = Math.max(0, Number(rec.used ?? 0));
      const dailyLimit = Math.max(1, Number(rec.daily_limit ?? limit));
      const remaining = Math.max(0, Number(rec.remaining ?? dailyLimit - used));
      const resetAt =
        typeof rec.reset_at === "string"
          ? rec.reset_at
          : new Date(Date.now() + 86_400_000).toISOString();

      return {
        allowed,
        used,
        remaining,
        limit: dailyLimit,
        resetAt,
        retryAfterSeconds: allowed ? 0 : secondsUntilIso(resetAt),
        source: "db",
      };
    }
  } catch {
    // Fall through to in-memory fallback
  }

  const mem = consumeScanRateLimit(`user:${userId}`, limit);
  return {
    allowed: mem.allowed,
    used: mem.used,
    remaining: mem.remaining,
    limit,
    resetAt: new Date(mem.resetAt).toISOString(),
    retryAfterSeconds: mem.retryAfterSeconds,
    source: "memory",
  };
}
