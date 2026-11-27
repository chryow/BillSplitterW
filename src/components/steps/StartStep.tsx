"use client";

import { useRef, useState } from "react";
import {
  ArrowRight,
  Camera,
  Image as ImageIcon,
  Loader2,
  Lock,
  PenLine,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { BottomSheet } from "@/components/layout/BottomSheet";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { MAX_SCANS_PER_DAY } from "@/lib/config";
import { formatCurrency } from "@/lib/currency";
import { preprocessReceiptImage } from "@/lib/image-preprocess";
import type {
  CurrencyCode,
  ScanApiError,
  ScannedReceiptResponse,
  ScanQuota,
} from "@/lib/types";

interface StartStepProps {
  currency: CurrencyCode;
  isSignedIn: boolean;
  supabaseEnabled: boolean;
  authLoading: boolean;
  scanQuota: ScanQuota | null;
  hasActiveBill: boolean;
  activeMerchant: string;
  activeTotal: number;
  onSignInGoogle: () => void;
  onQuotaUpdate: (next: ScanQuota) => void;
  onScanSuccess: (data: ScannedReceiptResponse) => void;
  onStartManual: () => void;
  onTrySample: () => void;
  onResumeBill: () => void;
}

export function StartStep({
  currency,
  isSignedIn,
  supabaseEnabled,
  authLoading,
  scanQuota,
  hasActiveBill,
  activeMerchant,
  activeTotal,
  onSignInGoogle,
  onQuotaUpdate,
  onScanSuccess,
  onStartManual,
  onTrySample,
  onResumeBill,
}: StartStepProps) {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const [scanSheetOpen, setScanSheetOpen] = useState(false);
  const [scanStage, setScanStage] = useState<"idle" | "compressing" | "scanning">(
    "idle"
  );
  const [scanError, setScanError] = useState<{
    title: string;
    message: string;
    requiresAuth?: boolean;
  } | null>(null);

  const isBusy = scanStage !== "idle";
  const dailyLimit = scanQuota?.limit ?? MAX_SCANS_PER_DAY;
  const remainingScans = scanQuota?.remaining ?? null;
  const quotaExhausted =
    isSignedIn && remainingScans !== null && remainingScans <= 0;

  const syncQuotaFromHeaders = (response: Response) => {
    const remHeader = response.headers.get("X-RateLimit-Remaining");
    const limHeader = response.headers.get("X-RateLimit-Limit");
    if (remHeader !== null) {
      const remaining = Math.max(0, Number.parseInt(remHeader, 10));
      const limit =
        limHeader !== null
          ? Math.max(1, Number.parseInt(limHeader, 10))
          : dailyLimit;
      if (Number.isFinite(remaining) && Number.isFinite(limit)) {
        onQuotaUpdate({
          used: Math.max(0, limit - remaining),
          remaining,
          limit,
        });
      }
    }
  };

  const handleFileSelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    // Reset input immediately so the same file can be re-selected if needed
    event.target.value = "";
    if (!file) return;

    setScanSheetOpen(false);
    setScanError(null);
    setScanStage("compressing");

    let processedBlob: Blob | null = null;

    try {
      const processed = await preprocessReceiptImage(file);
      processedBlob = processed.blob;

      setScanStage("scanning");
      const formData = new FormData();
      formData.append(
        "file",
        new File([processedBlob], "receipt.jpg", { type: processed.mimeType })
      );
      formData.append("targetCurrency", currency);

      const response = await fetch("/api/scan-receipt", {
        method: "POST",
        body: formData,
      });

      syncQuotaFromHeaders(response);

      const payload = (await response.json().catch(() => null)) as
        | ScannedReceiptResponse
        | ScanApiError
        | null;

      if (!response.ok) {
        const apiErr = payload as ScanApiError | null;
        const requiresAuth =
          apiErr?.code === "AUTH_REQUIRED" || response.status === 401;
        const title = requiresAuth
          ? "Sign in required for receipt scanning"
          : apiErr?.code === "RATE_LIMITED"
            ? "Daily scan limit reached"
            : apiErr?.code === "MISSING_API_KEY"
              ? "Auto-scan unavailable right now"
              : "Couldn't read receipt automatically";
        setScanError({
          title,
          message:
            apiErr?.message ||
            "No worries—you can enter items manually without losing your session.",
          requiresAuth,
        });
        return;
      }

      if (!payload || !("items" in payload)) {
        setScanError({
          title: "Couldn't read receipt automatically",
          message:
            "The receipt format was unclear. You can continue straight into Manual Entry.",
        });
        return;
      }

      onScanSuccess(payload);
    } catch (err) {
      setScanError({
        title: "Couldn't process receipt image",
        message:
          err instanceof Error
            ? err.message
            : "Something went wrong while scanning. You can continue manually below.",
      });
    } finally {
      // Discard raw/compressed image reference immediately after extraction
      processedBlob = null;
      setScanStage("idle");
    }
  };

  return (
    <section className="space-y-5 pt-5 pb-10">
      <div className="space-y-2 border-b border-[var(--border-subtle)] pb-4">
        <p className="micro-label flex items-center gap-2 text-[var(--text-muted)]">
          <span
            aria-hidden="true"
            className="inline-block h-[5px] w-[5px] bg-[var(--accent)]"
          />
          <span>Receipt &amp; Split Ledger</span>
        </p>
        <h1 className="font-editorial text-[28px] leading-[1.15] font-semibold tracking-tight text-[var(--text-primary)]">
          Split any bill in seconds.
        </h1>
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          Start manually in Guest Mode or sign in with Google to scan receipts
          with AI and archive your split ledger.
        </p>
      </div>

      {hasActiveBill && (
        <button
          type="button"
          onClick={onResumeBill}
          className="card-letterpress flex min-h-[54px] w-full items-center justify-between gap-3 rounded-[3px] border bg-[var(--bg-surface-2)] px-4 py-3 text-left transition-colors duration-150 ease-out hover:bg-[var(--bg-hover)]"
        >
          <div className="min-w-0">
            <p className="micro-label font-semibold text-[var(--accent-text)]">
              Resume active sheet
            </p>
            <p className="mt-0.5 truncate text-sm font-medium text-[var(--text-primary)]">
              {activeMerchant || "Untitled Bill"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="font-mono text-sm font-semibold text-[var(--text-primary)] tabular-nums">
              {formatCurrency(activeTotal, currency)}
            </span>
            <ArrowRight className="h-4 w-4 text-[var(--text-primary)]" />
          </div>
        </button>
      )}

      {scanError && (
        <StatusBanner
          variant="warning"
          title={scanError.title}
          message={scanError.message}
          actionLabel={
            scanError.requiresAuth && supabaseEnabled
              ? "Sign in with Google"
              : "Continue with Manual Entry"
          }
          onAction={
            scanError.requiresAuth && supabaseEnabled
              ? onSignInGoogle
              : onStartManual
          }
          onDismiss={() => setScanError(null)}
        />
      )}

      {/* Hidden inputs for direct mobile camera & gallery triggers */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={handleFileSelected}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelected}
        className="hidden"
      />

      {/* Primary Two Actions */}
      <div className="space-y-3">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => setScanSheetOpen(true)}
          className="group relative flex min-h-[88px] w-full items-center gap-4 rounded-[3px] border border-[var(--border-strong)] bg-[var(--accent)] px-4 py-4 text-left text-[#F7F5F0] transition-colors duration-150 ease-out hover:bg-[var(--accent-hover)] disabled:opacity-75"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[2px] border border-[#F7F5F0]/35 bg-[#1A1A18]/15">
            {isBusy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Camera className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-editorial text-lg font-semibold tracking-tight">
                {scanStage === "compressing"
                  ? "Optimizing photo..."
                  : scanStage === "scanning"
                    ? "Reading receipt items..."
                    : "Scan Receipt"}
              </p>
              {!isSignedIn && !isBusy && (
                <span className="inline-flex items-center gap-1 rounded-[2px] border border-[#F7F5F0]/40 bg-[#1A1A18]/20 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-[#F7F5F0]">
                  <Lock className="h-2.5 w-2.5" />
                  Sign in
                </span>
              )}
              {isSignedIn && !isBusy && remainingScans !== null && (
                <span className="inline-flex items-center rounded-[2px] border border-[#F7F5F0]/40 bg-[#1A1A18]/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-[#F7F5F0]">
                  {remainingScans}/{dailyLimit} LEFT
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-[#F7F5F0]/90">
              {isBusy
                ? "Auto-extracting items, tax, delivery & promos"
                : !isSignedIn
                  ? `Sign in with Google to scan (${dailyLimit} free scans/day)`
                  : quotaExhausted
                    ? "Daily limit reached · resets at midnight UTC"
                    : "Camera or gallery · auto-compressed & discarded"}
            </p>
          </div>
          {!isBusy && (
            <ArrowRight className="h-5 w-5 shrink-0 transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
          )}
        </button>

        <button
          type="button"
          disabled={isBusy}
          onClick={onStartManual}
          className="group flex min-h-[82px] w-full items-center gap-4 rounded-[3px] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-4 text-left transition-colors duration-150 ease-out hover:bg-[var(--bg-surface-2)] disabled:opacity-60"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[2px] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] text-[var(--text-primary)]">
            <PenLine className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-editorial text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Manual Split
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Enter items, tax, service, delivery fee, and promos — no login
              needed
            </p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-[var(--text-secondary)] transition-transform duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-[var(--text-primary)]" />
        </button>
      </div>

      {/* Instant Sample Receipt CTA */}
      <div className="pt-1">
        <button
          type="button"
          disabled={isBusy}
          onClick={onTrySample}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[3px] border border-dashed border-[var(--border-subtle)] bg-transparent px-4 font-mono text-xs font-medium uppercase tracking-[0.06em] text-[var(--text-secondary)] transition-colors duration-150 ease-out hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5 text-[var(--accent-text)]" />
          <span>Load Sample Receipt</span>
        </button>
        <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-muted)]">
          Indonesian restaurant receipt &middot; PB1 tax &middot; Service &middot;
          Promo
        </p>
      </div>

      {/* Scan source bottom sheet (or sign-in / quota gate) */}
      <BottomSheet
        open={scanSheetOpen}
        onClose={() => setScanSheetOpen(false)}
        title={
          !isSignedIn
            ? "Sign in to Scan Receipts"
            : quotaExhausted
              ? "Daily Scan Limit Reached"
              : "Scan Receipt"
        }
        subtitle={
          !isSignedIn
            ? "AI receipt scanning is reserved for signed-in accounts to prevent spam"
            : quotaExhausted
              ? `You've used all ${dailyLimit} scans today · resets at midnight UTC`
              : remainingScans !== null
                ? `${remainingScans} of ${dailyLimit} scans remaining today · photos are never stored`
                : "Image is compressed on your device and deleted right after extraction"
        }
      >
        {!isSignedIn ? (
          <div className="space-y-3">
            <div className="rounded-[3px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 text-xs leading-relaxed text-[var(--text-secondary)]">
              Sign in with Google for{" "}
              <strong className="text-[var(--text-primary)]">
                {dailyLimit} free AI receipt scans per day
              </strong>
              , saved bill history, frequent friends, and synced payment info.
              Receipt photos are still never stored.
            </div>

            {supabaseEnabled ? (
              <button
                type="button"
                disabled={authLoading}
                onClick={onSignInGoogle}
                className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[3px] border border-[var(--border-strong)] bg-[var(--accent)] px-4 font-mono text-xs font-semibold uppercase tracking-[0.06em] text-[#F7F5F0] transition-colors duration-150 ease-out hover:bg-[var(--accent-hover)] disabled:opacity-60"
              >
                <UserCheck className="h-4 w-4" />
                <span>
                  {authLoading
                    ? "Redirecting to Google..."
                    : "Continue with Google"}
                </span>
              </button>
            ) : (
              <p className="text-center text-xs text-[var(--text-muted)]">
                Configure Supabase Auth environment variables to enable Google
                Sign-In.
              </p>
            )}

            <button
              type="button"
              onClick={() => {
                setScanSheetOpen(false);
                onStartManual();
              }}
              className="min-h-[42px] w-full rounded-[3px] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-primary)] transition-colors duration-150 ease-out hover:bg-[var(--bg-surface-2)]"
            >
              Continue with Manual Split instead
            </button>
          </div>
        ) : quotaExhausted ? (
          <div className="space-y-3">
            <div className="rounded-[3px] border border-[var(--warning-border)] bg-[var(--warning-bg)] p-3.5 text-xs leading-relaxed text-[var(--warning-text)]">
              You&apos;ve reached your {dailyLimit} scans/day allowance. Re-scanning
              a receipt you already scanned today still works from cache, or you
              can enter items manually right away.
            </div>
            <button
              type="button"
              onClick={() => {
                setScanSheetOpen(false);
                onStartManual();
              }}
              className="min-h-[44px] w-full rounded-[3px] border border-[var(--border-strong)] bg-[var(--ink-solid)] px-4 font-mono text-xs font-semibold uppercase tracking-[0.06em] text-[var(--ink-on-solid)] transition-colors duration-150 ease-out hover:bg-[var(--ink-solid-hover)]"
            >
              Continue with Manual Split
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="card-letterpress flex min-h-[56px] w-full items-center gap-3.5 rounded-[3px] border bg-[var(--bg-surface)] px-4 text-left transition-colors duration-150 ease-out hover:bg-[var(--bg-surface-2)]"
            >
              <Camera className="h-5 w-5 shrink-0 text-[var(--accent-text)]" />
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Take Photo with Camera
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Best in bright light, keeping the full receipt flat
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="flex min-h-[56px] w-full items-center gap-3.5 rounded-[3px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 text-left transition-colors duration-150 ease-out hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-2)]"
            >
              <ImageIcon className="h-5 w-5 shrink-0 text-[var(--text-secondary)]" />
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Upload from Gallery
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  JPEG, PNG, or WebP · resized automatically under 2 MB
                </p>
              </div>
            </button>
          </div>
        )}
      </BottomSheet>
    </section>
  );
}
