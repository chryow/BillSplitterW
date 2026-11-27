import { NextResponse } from "next/server";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_SCANS_PER_DAY,
  MAX_UPLOAD_BYTES,
} from "@/lib/config";
import { extractReceiptWithGemini } from "@/lib/server/gemini-ocr";
import {
  getPersistentCachedReceipt,
  hashImageBuffer,
  setPersistentCachedReceipt,
} from "@/lib/server/receipt-cache";
import {
  consumeScanQuotaForUser,
  getScanQuotaForUser,
} from "@/lib/server/scan-quota";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ScanApiError } from "@/lib/types";

export const runtime = "nodejs";

function errorResponse(body: ScanApiError, status: number, headers?: HeadersInit) {
  return NextResponse.json(body, { status, headers });
}

function hasValidImageMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  // JPEG: FF D8 FF
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  // WebP: RIFF....WEBP
  const isWebp =
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return isJpeg || isPng || isWebp;
}

export async function POST(request: Request) {
  // Require authenticated Supabase user so anonymous guests cannot abuse OCR quota
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return errorResponse(
      {
        code: "AUTH_REQUIRED",
        message:
          "Sign in with Google is required for receipt scanning. You can still use Manual Split or Try Sample Receipt anytime.",
      },
      401
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse(
      {
        code: "AUTH_REQUIRED",
        message:
          "Sign in with Google to use AI receipt scanning. Guests can still use Manual Split or Try Sample Receipt.",
      },
      401
    );
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return errorResponse(
      {
        code: "MISSING_API_KEY",
        message:
          "Receipt scanning isn't configured on this server yet. You can continue with Manual Entry or try the Sample Receipt.",
      },
      503
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(
      {
        code: "INVALID_FILE",
        message: "Invalid upload payload. Please select a receipt photo and try again.",
      },
      400
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return errorResponse(
      {
        code: "INVALID_FILE",
        message: "No receipt image found in upload.",
      },
      400
    );
  }

  if (
    !(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)
  ) {
    return errorResponse(
      {
        code: "INVALID_FILE",
        message: "Unsupported image format. Please upload a JPEG, PNG, or WebP photo.",
      },
      400
    );
  }

  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    return errorResponse(
      {
        code: "FILE_TOO_LARGE",
        message: "Receipt image must be under 2 MB. Try taking a closer photo.",
      },
      413
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MAX_UPLOAD_BYTES) {
    return errorResponse(
      {
        code: "FILE_TOO_LARGE",
        message: "Receipt image must be under 2 MB.",
      },
      413
    );
  }

  if (!hasValidImageMagicBytes(buffer)) {
    return errorResponse(
      {
        code: "INVALID_FILE",
        message: "This file does not look like a valid JPEG, PNG, or WebP image.",
      },
      400
    );
  }

  // Two-tier SHA-256 deduplication cache (memory + Supabase ocr_cache)
  const imageHash = hashImageBuffer(buffer);
  const cached = await getPersistentCachedReceipt(supabase, imageHash);
  if (cached) {
    const quota = await getScanQuotaForUser(supabase, user.id, MAX_SCANS_PER_DAY);
    return NextResponse.json(cached.data, {
      status: 200,
      headers: {
        "X-Receipt-Cache": cached.layer,
        "X-RateLimit-Remaining": String(quota.remaining),
        "X-RateLimit-Limit": String(quota.limit),
      },
    });
  }

  // DB-backed strict daily per-user quota (with automatic in-memory fallback)
  const quota = await consumeScanQuotaForUser(
    supabase,
    user.id,
    MAX_SCANS_PER_DAY
  );
  if (!quota.allowed) {
    return errorResponse(
      {
        code: "RATE_LIMITED",
        message: `You've used all ${quota.limit} scans for today. Your quota resets at midnight UTC—meanwhile you can still split manually!`,
        retryAfterSeconds: quota.retryAfterSeconds,
      },
      429,
      {
        "Retry-After": String(quota.retryAfterSeconds),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Limit": String(quota.limit),
      }
    );
  }

  try {
    const extracted = await extractReceiptWithGemini(buffer, file.type, apiKey);
    await setPersistentCachedReceipt(supabase, imageHash, extracted);

    return NextResponse.json(extracted, {
      status: 200,
      headers: {
        "X-Receipt-Cache": "MISS",
        "X-RateLimit-Remaining": String(quota.remaining),
        "X-RateLimit-Limit": String(quota.limit),
      },
    });
  } catch (err) {
    console.error("[scan-receipt] Gemini OCR failed:", err);
    return errorResponse(
      {
        code: "OCR_FAILED",
        message:
          "We couldn't read that receipt automatically. You can continue straight into Manual Entry.",
      },
      502,
      {
        "X-RateLimit-Remaining": String(quota.remaining),
        "X-RateLimit-Limit": String(quota.limit),
      }
    );
  }
}
