"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { StepIndicator } from "@/components/layout/StepIndicator";
import { AssignStep } from "@/components/steps/AssignStep";
import { ReviewStep } from "@/components/steps/ReviewStep";
import { StartStep } from "@/components/steps/StartStep";
import { SummaryStep } from "@/components/steps/SummaryStep";
import { AccountSheet } from "@/components/ui/AccountSheet";
import { CurrencySheet } from "@/components/ui/CurrencySheet";
import { PARTICIPANT_COLORS } from "@/lib/config";
import { normalizeCurrencyCode, roundForCurrency } from "@/lib/currency";
import {
  createEmptyBillState,
  createSampleReceiptState,
} from "@/lib/sample-receipt";
import { checkReceiptMath } from "@/lib/split-engine";
import {
  clearActiveSession,
  EMPTY_PAYMENT_INFO,
  loadActiveSession,
  loadLocalPaymentInfo,
  loadTheme,
  saveActiveSession,
  saveLocalPaymentInfo,
  saveTheme,
  type ThemeMode,
} from "@/lib/storage";
import {
  deleteSavedBill,
  deleteSavedFriend,
  fetchSavedFriends,
  fetchUserBills,
  fetchUserProfile,
  saveBillToAccount,
  saveFriend,
  updateBillPublicVisibility,
  upsertUserPaymentInfo,
} from "@/lib/supabase/bills";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  AppStep,
  BillState,
  CurrencyCode,
  PaymentInfo,
  SavedBillSummary,
  SavedFriend,
  ScannedReceiptResponse,
} from "@/lib/types";
import { hasPaymentInfo } from "@/lib/whatsapp-formatter";

interface SignedInUser {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
}

export function BillSplitterApp() {
  const supabaseEnabled = isSupabaseConfigured();

  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState<AppStep>(1);
  const [bill, setBill] = useState<BillState>(() => createEmptyBillState("IDR"));
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({
    ...EMPTY_PAYMENT_INFO,
  });
  const [theme, setTheme] = useState<ThemeMode>("dark");

  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  // Auth & cloud sync state
  const [user, setUser] = useState<SignedInUser | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [savedBills, setSavedBills] = useState<SavedBillSummary[]>([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [savedFriends, setSavedFriends] = useState<SavedFriend[]>([]);
  const [savingBill, setSavingBill] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const paymentSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => {
      setToast((prev) => (prev === message ? null : prev));
    }, 2400);
  }, []);

  // Hydrate persisted bill, payment info, and theme from localStorage after mount
  useEffect(() => {
    let active = true;
    const savedTheme = loadTheme();
    document.documentElement.setAttribute("data-theme", savedTheme);

    queueMicrotask(() => {
      if (!active) return;
      setTheme(savedTheme);
      setPaymentInfo(loadLocalPaymentInfo());

      const stored = loadActiveSession();
      if (stored) {
        setBill(stored.bill);
        setStep(stored.step);
      }

      setHydrated(true);
    });

    return () => {
      active = false;
    };
  }, []);

  // Auto-save active bill session to localStorage whenever state changes
  useEffect(() => {
    if (!hydrated) return;
    saveActiveSession({ step, bill });
  }, [hydrated, step, bill]);

  // Load Supabase user session & cloud profile/history/friends
  const hydrateCloudAccount = useCallback(async (userId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setBillsLoading(true);
    try {
      const [profile, friends, bills] = await Promise.all([
        fetchUserProfile(supabase, userId),
        fetchSavedFriends(supabase, userId),
        fetchUserBills(supabase, userId),
      ]);

      setSavedFriends(friends);
      setSavedBills(bills);

      if (profile && hasPaymentInfo(profile.payment_info)) {
        setPaymentInfo(profile.payment_info);
        saveLocalPaymentInfo(profile.payment_info);
      } else {
        // If user already had local payment info before signing in, sync it up
        const localInfo = loadLocalPaymentInfo();
        if (hasPaymentInfo(localInfo)) {
          await upsertUserPaymentInfo(supabase, userId, localInfo);
        }
      }
    } finally {
      setBillsLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let mounted = true;

    const applySessionUser = (
      authUser: {
        id: string;
        email?: string | null;
        user_metadata?: Record<string, unknown>;
      } | null
    ) => {
      if (!mounted) return;
      if (!authUser) {
        setUser(null);
        setSavedBills([]);
        setSavedFriends([]);
        return;
      }
      const meta = authUser.user_metadata ?? {};
      const displayName =
        (typeof meta.full_name === "string" && meta.full_name) ||
        (typeof meta.name === "string" && meta.name) ||
        authUser.email?.split("@")[0] ||
        "You";
      const avatarUrl =
        (typeof meta.avatar_url === "string" && meta.avatar_url) ||
        (typeof meta.picture === "string" && meta.picture) ||
        null;

      setUser({
        id: authUser.id,
        email: authUser.email ?? null,
        displayName,
        avatarUrl,
      });
      void hydrateCloudAccount(authUser.id);
    };

    void supabase.auth.getUser().then(({ data }) => {
      applySessionUser(data.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySessionUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [hydrateCloudAccount]);

  const defaultSelfName = useMemo(() => {
    if (!user?.displayName) return "You";
    return user.displayName.split(" ")[0] || "You";
  }, [user]);

  const handleToggleTheme = () => {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    saveTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const handleCurrencyChange = (nextCurrency: CurrencyCode) => {
    setBill((prev) => ({
      ...prev,
      currency: nextCurrency,
      items: prev.items.map((item) => ({
        ...item,
        unitPrice: roundForCurrency(item.unitPrice, nextCurrency),
        totalPrice: roundForCurrency(item.totalPrice, nextCurrency),
      })),
      tax: roundForCurrency(prev.tax, nextCurrency),
      serviceCharge: roundForCurrency(prev.serviceCharge, nextCurrency),
      discount: roundForCurrency(prev.discount, nextCurrency),
      scannedGrandTotal:
        prev.scannedGrandTotal !== null
          ? roundForCurrency(prev.scannedGrandTotal, nextCurrency)
          : null,
    }));
  };

  const handlePaymentInfoChange = (next: PaymentInfo) => {
    setPaymentInfo(next);
    saveLocalPaymentInfo(next);

    if (user) {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        if (paymentSyncTimerRef.current) {
          clearTimeout(paymentSyncTimerRef.current);
        }
        paymentSyncTimerRef.current = setTimeout(() => {
          void upsertUserPaymentInfo(supabase, user.id, next, bill.currency);
        }, 600);
      }
    }
  };

  const handleScanSuccess = (data: ScannedReceiptResponse) => {
    const detectedCurrency = normalizeCurrencyCode(data.currency, bill.currency);
    const items =
      data.items.length > 0
        ? data.items.map((item, idx) => ({
            id: `scan-${Date.now()}-${idx}`,
            name: item.name,
            qty: Math.max(1, Math.round(item.qty || 1)),
            unitPrice: roundForCurrency(item.unit_price, detectedCurrency),
            totalPrice: roundForCurrency(item.total_price, detectedCurrency),
            assigneeIds: [],
          }))
        : [
            {
              id: `scan-${Date.now()}-0`,
              name: "",
              qty: 1,
              unitPrice: 0,
              totalPrice: 0,
              assigneeIds: [],
            },
          ];

    setBill((prev) => ({
      savedBillId: null,
      shareSlug: null,
      isPublic: true,
      merchantName: data.merchant_name ?? "",
      currency: detectedCurrency,
      items,
      tax: roundForCurrency(data.tax ?? 0, detectedCurrency),
      serviceCharge: roundForCurrency(data.service_charge ?? 0, detectedCurrency),
      discount: roundForCurrency(data.discount ?? 0, detectedCurrency),
      scannedGrandTotal:
        data.grand_total !== null
          ? roundForCurrency(data.grand_total, detectedCurrency)
          : null,
      warnings: data.warnings ?? [],
      participants:
        prev.participants.length > 0
          ? prev.participants
          : [
              {
                id: `p-${Date.now()}-1`,
                name: defaultSelfName,
                color: PARTICIPANT_COLORS[0],
              },
            ],
      feeSplitMode: "proportional",
    }));
    setStep(2);
  };

  const handleStartManual = () => {
    setBill((prev) => {
      const hasExistingItems = prev.items.some(
        (i) => i.name.trim().length > 0 || i.totalPrice > 0
      );
      if (hasExistingItems) {
        return prev;
      }
      return createEmptyBillState(prev.currency, defaultSelfName);
    });
    setStep(2);
  };

  const handleTrySample = () => {
    const sample = createSampleReceiptState(defaultSelfName);
    setBill(sample);
    setStep(2);
    showToast("Sample receipt loaded");
  };

  const handleNewSplit = () => {
    clearActiveSession();
    setBill(createEmptyBillState(bill.currency, defaultSelfName));
    setStep(1);
  };

  const handleSignInGoogle = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setAuthLoading(true);
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) {
        showToast("Google sign-in failed. Please try again.");
        setAuthLoading(false);
      }
    } catch {
      showToast("Google sign-in failed. Please try again.");
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setSavedBills([]);
    setSavedFriends([]);
    setAccountOpen(false);
    showToast("Switched to Guest Mode");
  };

  const handleSaveBillToCloud = async () => {
    if (!user) {
      setAccountOpen(true);
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setSavingBill(true);
    try {
      const saved = await saveBillToAccount(supabase, user.id, bill, paymentInfo);
      if (!saved) {
        showToast("Could not save bill. Please try again.");
        return;
      }

      setBill((prev) => ({
        ...prev,
        savedBillId: saved.id,
        shareSlug: saved.shareSlug,
        isPublic: saved.isPublic,
      }));
      const refreshed = await fetchUserBills(supabase, user.id);
      setSavedBills(refreshed);
      showToast("Saved to history & share link ready");
    } finally {
      setSavingBill(false);
    }
  };

  const handleOpenSavedBill = (saved: SavedBillSummary) => {
    setBill({
      savedBillId: saved.id,
      shareSlug: saved.share_slug,
      isPublic: saved.is_public,
      merchantName: saved.merchant_name,
      currency: saved.currency,
      items: saved.items,
      tax: saved.tax,
      serviceCharge: saved.service_charge,
      discount: saved.discount,
      scannedGrandTotal: saved.grand_total,
      warnings: [],
      participants: saved.participants,
      feeSplitMode: "proportional",
    });
    setStep(4);
  };

  const handleDeleteSavedBill = async (billId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const ok = await deleteSavedBill(supabase, billId);
    if (ok) {
      setSavedBills((prev) => prev.filter((b) => b.id !== billId));
      setBill((prev) =>
        prev.savedBillId === billId
          ? { ...prev, savedBillId: null, shareSlug: null }
          : prev
      );
      showToast("Deleted from history");
    }
  };

  const handleToggleBillPublic = async (billId: string, nextPublic: boolean) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const ok = await updateBillPublicVisibility(supabase, billId, nextPublic);
    if (ok) {
      setSavedBills((prev) =>
        prev.map((b) => (b.id === billId ? { ...b, is_public: nextPublic } : b))
      );
      setBill((prev) =>
        prev.savedBillId === billId ? { ...prev, isPublic: nextPublic } : prev
      );
      showToast(nextPublic ? "Public share link enabled" : "Bill set to private");
    }
  };

  const handleSaveFriend = async (name: string, color: string) => {
    if (!user) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const created = await saveFriend(supabase, user.id, name, color);
    if (created) {
      setSavedFriends((prev) => [...prev, created]);
      showToast(`Saved ${name} to quick-pick friends`);
    }
  };

  const handleDeleteSavedFriend = async (friendId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const ok = await deleteSavedFriend(supabase, friendId);
    if (ok) {
      setSavedFriends((prev) => prev.filter((f) => f.id !== friendId));
    }
  };

  const hasValidItems = bill.items.some(
    (i) => i.name.trim().length > 0 || i.totalPrice > 0
  );

  const canNavigateTo = (target: AppStep): boolean => {
    if (target === 1 || target === 2) return true;
    if (target === 3 || target === 4) return hasValidItems;
    return false;
  };

  const activeTotal = checkReceiptMath(
    bill.items,
    bill.tax,
    bill.serviceCharge,
    bill.discount,
    null,
    bill.currency
  ).computedGrandTotal;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--bg-app)]">
      <AppHeader
        currency={bill.currency}
        theme={theme}
        user={user}
        savedCount={savedBills.length}
        onLogoClick={() => setStep(1)}
        onOpenCurrency={() => setCurrencyOpen(true)}
        onToggleTheme={handleToggleTheme}
        onOpenAccount={() => setAccountOpen(true)}
      />

      <StepIndicator
        currentStep={step}
        canNavigateTo={canNavigateTo}
        onSelectStep={setStep}
      />

      <main className="mx-auto w-full max-w-md flex-1 px-4">
        {step === 1 && (
          <StartStep
            currency={bill.currency}
            isSignedIn={Boolean(user)}
            supabaseEnabled={supabaseEnabled}
            authLoading={authLoading}
            hasActiveBill={hasValidItems}
            activeMerchant={bill.merchantName}
            activeTotal={activeTotal}
            onSignInGoogle={handleSignInGoogle}
            onScanSuccess={handleScanSuccess}
            onStartManual={handleStartManual}
            onTrySample={handleTrySample}
            onResumeBill={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <ReviewStep
            bill={bill}
            onUpdateBill={setBill}
            onOpenCurrency={() => setCurrencyOpen(true)}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <AssignStep
            bill={bill}
            savedFriends={savedFriends}
            isSignedIn={Boolean(user)}
            onUpdateBill={setBill}
            onSaveFriend={handleSaveFriend}
            onDeleteSavedFriend={handleDeleteSavedFriend}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}

        {step === 4 && (
          <SummaryStep
            bill={bill}
            paymentInfo={paymentInfo}
            isSignedIn={Boolean(user)}
            supabaseEnabled={supabaseEnabled}
            savingBill={savingBill}
            onPaymentInfoChange={handlePaymentInfoChange}
            onSaveBillToCloud={handleSaveBillToCloud}
            onOpenAccount={() => setAccountOpen(true)}
            onBackToAssign={() => setStep(3)}
            onNewSplit={handleNewSplit}
          />
        )}
      </main>

      {/* Modals / Sheets */}
      <CurrencySheet
        open={currencyOpen}
        onClose={() => setCurrencyOpen(false)}
        selected={bill.currency}
        onSelect={handleCurrencyChange}
      />

      <AccountSheet
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        supabaseEnabled={supabaseEnabled}
        user={user}
        authLoading={authLoading}
        bills={savedBills}
        billsLoading={billsLoading}
        onSignInGoogle={handleSignInGoogle}
        onSignOut={handleSignOut}
        onOpenBill={handleOpenSavedBill}
        onDeleteBill={handleDeleteSavedBill}
        onTogglePublic={handleToggleBillPublic}
      />

      {/* Lightweight Toast */}
      {toast && (
        <div
          role="status"
          className="fixed top-16 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-medium text-[var(--text-primary)] shadow-lg animate-fade-in"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
