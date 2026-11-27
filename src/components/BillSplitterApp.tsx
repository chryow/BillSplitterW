"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Compass, ReceiptText } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { ColophonFooter } from "@/components/layout/ColophonFooter";
import { StepIndicator } from "@/components/layout/StepIndicator";
import { AssignStep } from "@/components/steps/AssignStep";
import { ReviewStep } from "@/components/steps/ReviewStep";
import { StartStep } from "@/components/steps/StartStep";
import { SummaryStep } from "@/components/steps/SummaryStep";
import { PARTICIPANT_COLORS } from "@/lib/config";
import { normalizeCurrencyCode, roundForCurrency } from "@/lib/currency";
import {
  convertAmount,
  formatExchangeRateLabel,
  getFallbackExchangeRate,
} from "@/lib/fx";
import {
  createEmptyBillState,
  createSampleReceiptState,
} from "@/lib/sample-receipt";
import { createNewTrip, createSampleTrip } from "@/lib/sample-trip";
import { checkReceiptMath } from "@/lib/split-engine";
import {
  clearActiveSession,
  EMPTY_PAYMENT_INFO,
  loadActiveSession,
  loadLocalPaymentInfo,
  loadLocalTrips,
  loadTheme,
  saveActiveSession,
  saveLocalPaymentInfo,
  saveLocalTrips,
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
  updateBillSettlements,
  upsertUserPaymentInfo,
} from "@/lib/supabase/bills";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  deleteSavedTrip,
  fetchUserTrips,
  saveTripToAccount,
  updateTripPublicVisibility,
} from "@/lib/supabase/trips";
import type {
  AppMode,
  AppStep,
  BillState,
  CurrencyCode,
  PaymentInfo,
  SavedBillSummary,
  SavedFriend,
  ScannedReceiptResponse,
  ScanQuota,
  Trip,
  TripExpense,
  TripMember,
} from "@/lib/types";
import { hasPaymentInfo } from "@/lib/whatsapp-formatter";

// Lazy-load secondary sheets and Trips view so initial Single Bill mobile hydration stays ultra-fast
const CurrencySheet = dynamic(
  () => import("@/components/ui/CurrencySheet").then((m) => m.CurrencySheet),
  { ssr: false }
);
const AccountSheet = dynamic(
  () => import("@/components/ui/AccountSheet").then((m) => m.AccountSheet),
  { ssr: false }
);
const TripsView = dynamic(
  () => import("@/components/trips/TripsView").then((m) => m.TripsView),
  { ssr: false }
);

interface SignedInUser {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
}

interface ToastState {
  id: number;
  message: string;
  undoLabel?: string;
  onUndo?: () => void;
}

export function BillSplitterApp() {
  const supabaseEnabled = isSupabaseConfigured();

  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<AppMode>("bill");
  const [step, setStep] = useState<AppStep>(1);
  const [bill, setBill] = useState<BillState>(() => createEmptyBillState("IDR"));
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({
    ...EMPTY_PAYMENT_INFO,
  });
  const [theme, setTheme] = useState<ThemeMode>("light");

  // Trips state (works in both Guest Mode localStorage and Supabase Login Mode)
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [savingTrip, setSavingTrip] = useState(false);

  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  // Auth, scan quota & cloud sync state
  const [user, setUser] = useState<SignedInUser | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [scanQuota, setScanQuota] = useState<ScanQuota | null>(null);
  const [savedBills, setSavedBills] = useState<SavedBillSummary[]>([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [savedFriends, setSavedFriends] = useState<SavedFriend[]>([]);
  const [savingBill, setSavingBill] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const paymentSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tripSyncTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {}
  );
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (message: string, options?: { undoLabel?: string; onUndo?: () => void }) => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      const id = Date.now();
      setToast({
        id,
        message,
        undoLabel: options?.undoLabel,
        onUndo: options?.onUndo,
      });
      const duration = options?.onUndo ? 4500 : 2400;
      toastTimerRef.current = setTimeout(() => {
        setToast((prev) => (prev?.id === id ? null : prev));
      }, duration);
    },
    []
  );

  // Hydrate persisted bill, trips, payment info, and theme from localStorage after mount
  useEffect(() => {
    let active = true;
    const savedTheme = loadTheme();
    document.documentElement.setAttribute("data-theme", savedTheme);

    queueMicrotask(() => {
      if (!active) return;
      setTheme(savedTheme);
      setPaymentInfo(loadLocalPaymentInfo());
      setTrips(loadLocalTrips());

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

  // Auto-save trips to localStorage whenever trips change
  useEffect(() => {
    if (!hydrated) return;
    saveLocalTrips(trips);
  }, [hydrated, trips]);

  const fetchScanQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/scan-quota", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        signedIn?: boolean;
        used?: number;
        remaining?: number;
        limit?: number;
        resetAt?: string;
      };
      if (
        data.signedIn &&
        typeof data.remaining === "number" &&
        typeof data.limit === "number"
      ) {
        setScanQuota({
          used:
            typeof data.used === "number"
              ? data.used
              : Math.max(0, data.limit - data.remaining),
          remaining: data.remaining,
          limit: data.limit,
          resetAt: data.resetAt,
        });
      }
    } catch {
      // Non-fatal: UI still functions without pre-fetched quota pill
    }
  }, []);

  // Load Supabase user session & cloud profile/history/friends/trips/quota
  const hydrateCloudAccount = useCallback(
    async (userId: string) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;

      setBillsLoading(true);
      try {
        const [profile, friends, bills, cloudTrips] = await Promise.all([
          fetchUserProfile(supabase, userId),
          fetchSavedFriends(supabase, userId),
          fetchUserBills(supabase, userId),
          fetchUserTrips(supabase, userId),
        ]);

        setSavedFriends(friends);
        setSavedBills(bills);
        void fetchScanQuota();

        // Merge cloud trips with any unsaved local guest trips
        if (cloudTrips.length > 0) {
          setTrips((local) => {
            const cloudIds = new Set(cloudTrips.map((t) => t.savedTripId));
            const unsavedLocals = local.filter(
              (t) => !t.savedTripId || !cloudIds.has(t.savedTripId)
            );
            return [...cloudTrips, ...unsavedLocals];
          });
        }

        if (profile && hasPaymentInfo(profile.payment_info)) {
          setPaymentInfo(profile.payment_info);
          saveLocalPaymentInfo(profile.payment_info);
        } else {
          const localInfo = loadLocalPaymentInfo();
          if (hasPaymentInfo(localInfo)) {
            await upsertUserPaymentInfo(supabase, userId, localInfo);
          }
        }
      } finally {
        setBillsLoading(false);
      }
    },
    [fetchScanQuota]
  );

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
        setScanQuota(null);
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

  const activeTrip = useMemo(
    () => trips.find((t) => t.id === activeTripId) ?? null,
    [trips, activeTripId]
  );

  const scheduleCloudTripSync = useCallback(
    (nextTrip: Trip) => {
      if (!user || !nextTrip.savedTripId) return;
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;

      const existing = tripSyncTimersRef.current[nextTrip.id];
      if (existing) clearTimeout(existing);

      tripSyncTimersRef.current[nextTrip.id] = setTimeout(() => {
        void saveTripToAccount(supabase, user.id, nextTrip);
      }, 700);
    },
    [user]
  );

  const handleToggleTheme = () => {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    saveTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const fetchClientExchangeRate = useCallback(
    async (
      from: CurrencyCode,
      to: CurrencyCode
    ): Promise<{ rate: number; source: "live" | "fallback" }> => {
      if (from === to) return { rate: 1, source: "live" };
      try {
        const res = await fetch(`/api/fx-rates?base=${from}`);
        if (res.ok) {
          const data = (await res.json()) as {
            rates?: Record<string, number>;
            source?: "live" | "fallback";
          };
          const rate = data.rates?.[to];
          if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) {
            return { rate, source: data.source ?? "live" };
          }
        }
      } catch {
        // Fallback below
      }
      return {
        rate: getFallbackExchangeRate(from, to),
        source: "fallback",
      };
    },
    []
  );

  const handleCurrencyChange = async (nextCurrency: CurrencyCode) => {
    if (mode === "trips" && activeTripId) {
      const currentTrip = trips.find((t) => t.id === activeTripId);
      if (!currentTrip || currentTrip.currency === nextCurrency) return;

      const prevCurrency = currentTrip.currency;
      const hasAmounts = currentTrip.expenses.some((e) => e.amount > 0);
      if (!hasAmounts) {
        handleUpdateTrip(activeTripId, (prev) => ({
          ...prev,
          currency: nextCurrency,
          updatedAt: new Date().toISOString(),
        }));
        return;
      }

      const { rate } = await fetchClientExchangeRate(prevCurrency, nextCurrency);
      const rawSnapshot = currentTrip;

      handleUpdateTrip(activeTripId, (prev) => ({
        ...prev,
        currency: nextCurrency,
        expenses: prev.expenses.map((exp) => ({
          ...exp,
          amount: convertAmount(exp.amount, rate, nextCurrency),
          tax:
            exp.tax !== undefined
              ? convertAmount(exp.tax, rate, nextCurrency)
              : undefined,
          serviceCharge:
            exp.serviceCharge !== undefined
              ? convertAmount(exp.serviceCharge, rate, nextCurrency)
              : undefined,
          deliveryFee:
            exp.deliveryFee !== undefined
              ? convertAmount(exp.deliveryFee, rate, nextCurrency)
              : undefined,
          discount:
            exp.discount !== undefined
              ? convertAmount(exp.discount, rate, nextCurrency)
              : undefined,
          items: exp.items?.map((item) => {
            const total = convertAmount(item.totalPrice, rate, nextCurrency);
            return {
              ...item,
              totalPrice: total,
              unitPrice: roundForCurrency(
                total / Math.max(1, item.qty),
                nextCurrency
              ),
            };
          }),
        })),
        updatedAt: new Date().toISOString(),
      }));

      showToast(
        `Converted ${prevCurrency} → ${nextCurrency} (${formatExchangeRateLabel(prevCurrency, nextCurrency, rate)})`,
        {
          undoLabel: "Keep numbers",
          onUndo: () => {
            handleUpdateTrip(activeTripId, () => ({
              ...rawSnapshot,
              currency: nextCurrency,
              updatedAt: new Date().toISOString(),
            }));
            setToast(null);
          },
        }
      );
      return;
    }

    if (bill.currency === nextCurrency) return;
    const prevCurrency = bill.currency;
    const hasAmounts =
      bill.items.some((i) => i.totalPrice > 0) ||
      bill.tax > 0 ||
      bill.serviceCharge > 0 ||
      bill.deliveryFee > 0 ||
      bill.discount > 0;

    if (!hasAmounts) {
      setBill((prev) => ({
        ...prev,
        currency: nextCurrency,
        conversion: null,
      }));
      return;
    }

    const { rate, source } = await fetchClientExchangeRate(
      prevCurrency,
      nextCurrency
    );
    const snapshot = bill;

    setBill((prev) => ({
      ...prev,
      currency: nextCurrency,
      items: prev.items.map((item) => {
        const total = convertAmount(item.totalPrice, rate, nextCurrency);
        return {
          ...item,
          totalPrice: total,
          unitPrice: roundForCurrency(
            total / Math.max(1, item.qty),
            nextCurrency
          ),
        };
      }),
      tax: convertAmount(prev.tax, rate, nextCurrency),
      serviceCharge: convertAmount(prev.serviceCharge, rate, nextCurrency),
      deliveryFee: convertAmount(prev.deliveryFee, rate, nextCurrency),
      discount: convertAmount(prev.discount, rate, nextCurrency),
      scannedGrandTotal:
        prev.scannedGrandTotal !== null
          ? convertAmount(prev.scannedGrandTotal, rate, nextCurrency)
          : null,
      conversion: {
        fromCurrency: prevCurrency,
        toCurrency: nextCurrency,
        rate,
        source,
        originalGrandTotal: prev.scannedGrandTotal,
      },
    }));

    showToast(
      `Converted ${prevCurrency} → ${nextCurrency} (${formatExchangeRateLabel(prevCurrency, nextCurrency, rate)})`,
      {
        undoLabel: "Keep numbers",
        onUndo: () => {
          setBill({
            ...snapshot,
            currency: nextCurrency,
            conversion: null,
          });
          setToast(null);
        },
      }
    );
  };

  const handleRevertConversion = () => {
    const conv = bill.conversion;
    if (!conv || conv.rate <= 0) return;
    const inverseRate = 1 / conv.rate;
    const origCur = conv.fromCurrency;

    setBill((prev) => ({
      ...prev,
      currency: origCur,
      items: prev.items.map((item) => {
        const total = convertAmount(item.totalPrice, inverseRate, origCur);
        return {
          ...item,
          totalPrice: total,
          unitPrice: roundForCurrency(total / Math.max(1, item.qty), origCur),
        };
      }),
      tax: convertAmount(prev.tax, inverseRate, origCur),
      serviceCharge: convertAmount(prev.serviceCharge, inverseRate, origCur),
      deliveryFee: convertAmount(prev.deliveryFee, inverseRate, origCur),
      discount: convertAmount(prev.discount, inverseRate, origCur),
      scannedGrandTotal:
        conv.originalGrandTotal !== null
          ? conv.originalGrandTotal
          : prev.scannedGrandTotal !== null
            ? convertAmount(prev.scannedGrandTotal, inverseRate, origCur)
            : null,
      conversion: null,
    }));
    showToast(`Switched back to original ${origCur}`);
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

  const handleDeleteItemWithUndo = (itemId: string) => {
    const idx = bill.items.findIndex((i) => i.id === itemId);
    if (idx === -1) return;
    const removedItem = bill.items[idx];

    setBill((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
    }));

    showToast(`Removed ${removedItem.name.trim() || "item"}`, {
      undoLabel: "Undo",
      onUndo: () => {
        setBill((prev) => {
          if (prev.items.some((i) => i.id === removedItem.id)) return prev;
          const nextItems = [...prev.items];
          nextItems.splice(Math.min(idx, nextItems.length), 0, removedItem);
          return { ...prev, items: nextItems };
        });
        setToast(null);
      },
    });
  };

  const syncSettlementsToCloud = useCallback(
    (
      billId: string | null,
      paidByParticipantId: string | null,
      settledParticipantIds: string[]
    ) => {
      if (!billId || !user) return;
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;

      setSavedBills((prev) =>
        prev.map((b) =>
          b.id === billId
            ? {
                ...b,
                paid_by_participant_id: paidByParticipantId,
                settled_participant_ids: settledParticipantIds,
              }
            : b
        )
      );
      void updateBillSettlements(
        supabase,
        billId,
        paidByParticipantId,
        settledParticipantIds
      );
    },
    [user]
  );

  const handleChangePaidBy = (participantId: string) => {
    let nextSettled: string[] = [];
    let billIdToSync: string | null = null;

    setBill((prev) => {
      nextSettled = prev.settledParticipantIds.filter(
        (id) => id !== participantId
      );
      billIdToSync = prev.savedBillId;
      return {
        ...prev,
        paidByParticipantId: participantId,
        settledParticipantIds: nextSettled,
      };
    });

    queueMicrotask(() => {
      syncSettlementsToCloud(billIdToSync, participantId, nextSettled);
    });
  };

  const handleToggleSettled = (participantId: string) => {
    let nextSettled: string[] = [];
    let paidBy: string | null = null;
    let billIdToSync: string | null = null;

    setBill((prev) => {
      const exists = prev.settledParticipantIds.includes(participantId);
      nextSettled = exists
        ? prev.settledParticipantIds.filter((id) => id !== participantId)
        : [...prev.settledParticipantIds, participantId];
      paidBy = prev.paidByParticipantId;
      billIdToSync = prev.savedBillId;
      return {
        ...prev,
        settledParticipantIds: nextSettled,
      };
    });

    queueMicrotask(() => {
      syncSettlementsToCloud(billIdToSync, paidBy, nextSettled);
    });
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

    setBill((prev) => {
      const participants =
        prev.participants.length > 0
          ? prev.participants
          : [
              {
                id: `p-${Date.now()}-1`,
                name: defaultSelfName,
                color: PARTICIPANT_COLORS[0],
              },
            ];
      return {
        savedBillId: null,
        shareSlug: null,
        isPublic: true,
        merchantName: data.merchant_name ?? "",
        currency: detectedCurrency,
        items,
        tax: roundForCurrency(data.tax ?? 0, detectedCurrency),
        serviceCharge: roundForCurrency(
          data.service_charge ?? 0,
          detectedCurrency
        ),
        deliveryFee: roundForCurrency(data.delivery_fee ?? 0, detectedCurrency),
        discount: roundForCurrency(data.discount ?? 0, detectedCurrency),
        scannedGrandTotal:
          data.grand_total !== null
            ? roundForCurrency(data.grand_total, detectedCurrency)
            : null,
        warnings: data.warnings ?? [],
        conversion: data.conversion ?? null,
        participants,
        feeSplitMode: "proportional",
        paidByParticipantId:
          prev.paidByParticipantId ?? participants[0]?.id ?? null,
        settledParticipantIds: [],
      };
    });
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
    const previousBill = bill;
    const previousStep = step;

    clearActiveSession();
    setBill(createEmptyBillState(bill.currency, defaultSelfName));
    setStep(1);

    showToast("Started a fresh bill", {
      undoLabel: "Undo",
      onUndo: () => {
        setBill(previousBill);
        setStep(previousStep);
        setToast(null);
      },
    });
  };

  // --- Trips handlers ---
  const handleCreateTrip = (
    name: string,
    currency: CurrencyCode,
    members: TripMember[]
  ) => {
    const created = createNewTrip(name, currency, members);
    setTrips((prev) => [created, ...prev]);
    setActiveTripId(created.id);
    showToast(`Created trip "${created.name}"`);
  };

  const handleTrySampleTrip = () => {
    const sample = createSampleTrip(defaultSelfName, paymentInfo);
    setTrips((prev) => [sample, ...prev]);
    setActiveTripId(sample.id);
    showToast("Loaded sample trip: Bali Weekend");
  };

  const handleUpdateTrip = (tripId: string, updater: (prev: Trip) => Trip) => {
    let updatedRef: Trip | null = null;
    setTrips((prev) =>
      prev.map((t) => {
        if (t.id !== tripId) return t;
        updatedRef = updater(t);
        return updatedRef;
      })
    );
    queueMicrotask(() => {
      if (updatedRef) {
        scheduleCloudTripSync(updatedRef);
      }
    });
  };

  const handleDeleteExpenseWithUndo = (tripId: string, expenseId: string) => {
    const targetTrip = trips.find((t) => t.id === tripId);
    if (!targetTrip) return;
    const idx = targetTrip.expenses.findIndex((e) => e.id === expenseId);
    if (idx === -1) return;
    const removed = targetTrip.expenses[idx];

    handleUpdateTrip(tripId, (prev) => ({
      ...prev,
      expenses: prev.expenses.filter((e) => e.id !== expenseId),
      updatedAt: new Date().toISOString(),
    }));

    showToast(`Removed "${removed.title}"`, {
      undoLabel: "Undo",
      onUndo: () => {
        handleUpdateTrip(tripId, (prev) => {
          if (prev.expenses.some((e) => e.id === removed.id)) return prev;
          const next = [...prev.expenses];
          next.splice(Math.min(idx, next.length), 0, removed);
          return { ...prev, expenses: next, updatedAt: new Date().toISOString() };
        });
        setToast(null);
      },
    });
  };

  const handleDeleteTrip = async (tripId: string) => {
    const target = trips.find((t) => t.id === tripId);
    if (!target) return;

    setTrips((prev) => prev.filter((t) => t.id !== tripId));
    if (activeTripId === tripId) setActiveTripId(null);

    if (target.savedTripId && user) {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        await deleteSavedTrip(supabase, target.savedTripId);
      }
    }
    showToast(`Deleted "${target.name}"`);
  };

  const handleSaveTripToCloud = async (tripId: string) => {
    if (!user) {
      setAccountOpen(true);
      return;
    }
    const target = trips.find((t) => t.id === tripId);
    if (!target) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setSavingTrip(true);
    try {
      const saved = await saveTripToAccount(supabase, user.id, target);
      if (!saved) {
        showToast("Could not save trip. Make sure the trips SQL migration is applied.");
        return;
      }

      setTrips((prev) =>
        prev.map((t) =>
          t.id === tripId
            ? {
                ...t,
                id: saved.id,
                savedTripId: saved.id,
                shareSlug: saved.shareSlug,
                isPublic: saved.isPublic,
              }
            : t
        )
      );
      setActiveTripId(saved.id);
      showToast("Trip saved & share link ready");
    } finally {
      setSavingTrip(false);
    }
  };

  const handleToggleTripPublic = async (tripId: string, nextPublic: boolean) => {
    const target = trips.find((t) => t.id === tripId);
    if (!target?.savedTripId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const ok = await updateTripPublicVisibility(
      supabase,
      target.savedTripId,
      nextPublic
    );
    if (ok) {
      setTrips((prev) =>
        prev.map((t) => (t.id === tripId ? { ...t, isPublic: nextPublic } : t))
      );
      showToast(
        nextPublic ? "Public trip link enabled" : "Trip set to private"
      );
    }
  };

  /**
   * Sends the active Single Bill from Step 4 into an existing Trip as an itemized
   * TripExpense, mapping matching participant names cleanly and adding any missing crew.
   */
  const handleAddSingleBillToTrip = async (tripId: string) => {
    const targetTrip = trips.find((t) => t.id === tripId);
    if (!targetTrip) return;

    const targetCur = targetTrip.currency;
    const { rate } =
      bill.currency !== targetCur
        ? await fetchClientExchangeRate(bill.currency, targetCur)
        : { rate: 1 };

    const nextMembers: TripMember[] = [...targetTrip.members];
    const participantIdToMemberId = new Map<string, string>();

    for (const p of bill.participants) {
      const match = nextMembers.find(
        (m) => m.name.trim().toLowerCase() === p.name.trim().toLowerCase()
      );
      if (match) {
        participantIdToMemberId.set(p.id, match.id);
      } else {
        const newMember: TripMember = {
          id: `tm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: p.name,
          color: p.color,
        };
        nextMembers.push(newMember);
        participantIdToMemberId.set(p.id, newMember.id);
      }
    }

    const mappedItems = bill.items.map((item) => {
      const mappedAssignees = item.assigneeIds
        .map((id) => participantIdToMemberId.get(id))
        .filter((id): id is string => Boolean(id));
      const mappedShares: Record<string, number> | undefined = item.assigneeShares
        ? Object.fromEntries(
            Object.entries(item.assigneeShares)
              .map(([pid, w]) => [participantIdToMemberId.get(pid), w] as const)
              .filter(
                (entry): entry is [string, number] => Boolean(entry[0])
              )
          )
        : undefined;
      const convertedTotal = convertAmount(item.totalPrice, rate, targetCur);
      return {
        ...item,
        totalPrice: convertedTotal,
        unitPrice: roundForCurrency(
          convertedTotal / Math.max(1, item.qty),
          targetCur
        ),
        assigneeIds: mappedAssignees,
        ...(mappedShares ? { assigneeShares: mappedShares } : {}),
      };
    });

    const convertedTax = convertAmount(bill.tax, rate, targetCur);
    const convertedService = convertAmount(bill.serviceCharge, rate, targetCur);
    const convertedDeliveryFee = convertAmount(
      bill.deliveryFee,
      rate,
      targetCur
    );
    const convertedDiscount = convertAmount(bill.discount, rate, targetCur);

    const mappedPayerId =
      (bill.paidByParticipantId
        ? participantIdToMemberId.get(bill.paidByParticipantId)
        : null) ?? nextMembers[0]?.id ?? "";

    const total = checkReceiptMath(
      mappedItems,
      convertedTax,
      convertedService,
      convertedDiscount,
      null,
      targetCur,
      convertedDeliveryFee
    ).computedGrandTotal;

    const newExpense: TripExpense = {
      id: `exp-${Date.now()}`,
      title: bill.merchantName.trim() || "Restaurant Bill",
      date: new Date().toISOString().slice(0, 10),
      category: "food",
      paidByMemberId: mappedPayerId,
      mode: "itemized",
      amount: total,
      assigneeIds: nextMembers.map((m) => m.id),
      items: mappedItems,
      tax: convertedTax,
      serviceCharge: convertedService,
      deliveryFee: convertedDeliveryFee,
      discount: convertedDiscount,
    };

    handleUpdateTrip(tripId, (prev) => ({
      ...prev,
      members: nextMembers,
      expenses: [newExpense, ...prev.expenses],
      updatedAt: new Date().toISOString(),
    }));

    setMode("trips");
    setActiveTripId(tripId);
    showToast(
      bill.currency !== targetCur
        ? `Converted (${bill.currency} → ${targetCur}) & added to ${targetTrip.name}`
        : `Added "${newExpense.title}" to ${targetTrip.name}`
    );
  };

  // --- Auth & Account handlers ---
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
    setScanQuota(null);
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
    setMode("bill");
    setBill({
      savedBillId: saved.id,
      shareSlug: saved.share_slug,
      isPublic: saved.is_public,
      merchantName: saved.merchant_name,
      currency: saved.currency,
      items: saved.items,
      tax: saved.tax,
      serviceCharge: saved.service_charge,
      deliveryFee: saved.delivery_fee,
      discount: saved.discount,
      scannedGrandTotal: saved.grand_total,
      warnings: [],
      participants: saved.participants,
      feeSplitMode: "proportional",
      paidByParticipantId:
        saved.paid_by_participant_id ?? saved.participants[0]?.id ?? null,
      settledParticipantIds: saved.settled_participant_ids ?? [],
    });
    setStep(4);
  };

  const handleDuplicateSavedBill = (saved: SavedBillSummary) => {
    setMode("bill");
    const participants =
      saved.participants.length > 0
        ? saved.participants.map((p, idx) => ({
            ...p,
            id: `dup-p-${Date.now()}-${idx}`,
          }))
        : [
            {
              id: `dup-p-${Date.now()}-0`,
              name: defaultSelfName,
              color: PARTICIPANT_COLORS[0],
            },
          ];

    setBill({
      savedBillId: null,
      shareSlug: null,
      isPublic: true,
      merchantName: saved.merchant_name,
      currency: saved.currency,
      items: [
        {
          id: `dup-item-${Date.now()}-0`,
          name: "",
          qty: 1,
          unitPrice: 0,
          totalPrice: 0,
          assigneeIds: [],
        },
      ],
      tax: 0,
      serviceCharge: 0,
      deliveryFee: 0,
      discount: 0,
      scannedGrandTotal: null,
      warnings: [],
      participants,
      feeSplitMode: "proportional",
      paidByParticipantId: participants[0]?.id ?? null,
      settledParticipantIds: [],
    });
    setStep(2);
    showToast(`Reused group from ${saved.merchant_name || "past bill"}`);
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

  const activeTotal = useMemo(
    () =>
      checkReceiptMath(
        bill.items,
        bill.tax,
        bill.serviceCharge,
        bill.discount,
        null,
        bill.currency,
        bill.deliveryFee
      ).computedGrandTotal,
    [
      bill.items,
      bill.tax,
      bill.serviceCharge,
      bill.deliveryFee,
      bill.discount,
      bill.currency,
    ]
  );

  const headerCurrency =
    mode === "trips" && activeTrip ? activeTrip.currency : bill.currency;

  const availableTripsSummary = useMemo(
    () => trips.map((t) => ({ id: t.id, name: t.name })),
    [trips]
  );

  const hasStickyBottomBar =
    (mode === "bill" && step !== 1) ||
    (mode === "trips" && Boolean(activeTrip));

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--bg-app)]">
      <AppHeader
        currency={headerCurrency}
        theme={theme}
        user={user}
        savedCount={savedBills.length}
        onLogoClick={() => {
          setMode("bill");
          setStep(1);
        }}
        onOpenCurrency={() => setCurrencyOpen(true)}
        onToggleTheme={handleToggleTheme}
        onOpenAccount={() => setAccountOpen(true)}
      />

      {/* Compact Single Bill / Trips Mode Switcher */}
      <div className="mx-auto w-full max-w-lg px-4 pt-3">
        <div
          className="grid grid-cols-2 gap-1 rounded-[3px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1"
          role="tablist"
          aria-label="App mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "bill"}
            onClick={() => setMode("bill")}
            className={`flex min-h-[32px] items-center justify-center gap-1.5 rounded-[2px] font-mono text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors duration-150 ease-out ${
              mode === "bill"
                ? "bg-[var(--ink-solid)] text-[var(--ink-on-solid)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)]"
            }`}
          >
            <ReceiptText className="h-3.5 w-3.5" />
            <span>Single Bill</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "trips"}
            onClick={() => setMode("trips")}
            className={`flex min-h-[32px] items-center justify-center gap-1.5 rounded-[2px] font-mono text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors duration-150 ease-out ${
              mode === "trips"
                ? "bg-[var(--ink-solid)] text-[var(--ink-on-solid)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Compass className="h-3.5 w-3.5" />
            <span>
              Trips{trips.length > 0 ? ` (${trips.length})` : ""}
            </span>
          </button>
        </div>
      </div>

      {mode === "bill" && (
        <StepIndicator
          currentStep={step}
          canNavigateTo={canNavigateTo}
          onSelectStep={setStep}
        />
      )}

      <main className="mx-auto w-full max-w-lg flex-1 px-4">
        {mode === "trips" ? (
          <TripsView
            trips={trips}
            activeTripId={activeTripId}
            defaultSelfName={defaultSelfName}
            defaultPaymentInfo={paymentInfo}
            savedFriends={savedFriends}
            isSignedIn={Boolean(user)}
            supabaseEnabled={supabaseEnabled}
            savingTrip={savingTrip}
            onSelectTrip={setActiveTripId}
            onCreateTrip={handleCreateTrip}
            onTrySampleTrip={handleTrySampleTrip}
            onUpdateTrip={handleUpdateTrip}
            onDeleteTrip={handleDeleteTrip}
            onDeleteExpenseWithUndo={handleDeleteExpenseWithUndo}
            onSaveTripToCloud={handleSaveTripToCloud}
            onToggleTripPublic={handleToggleTripPublic}
            onOpenAccount={() => setAccountOpen(true)}
            onQuotaUpdate={setScanQuota}
          />
        ) : (
          <>
            {step === 1 && (
              <StartStep
                currency={bill.currency}
                isSignedIn={Boolean(user)}
                supabaseEnabled={supabaseEnabled}
                authLoading={authLoading}
                scanQuota={scanQuota}
                hasActiveBill={hasValidItems}
                activeMerchant={bill.merchantName}
                activeTotal={activeTotal}
                onSignInGoogle={handleSignInGoogle}
                onQuotaUpdate={setScanQuota}
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
                onDeleteItemWithUndo={handleDeleteItemWithUndo}
                onRevertConversion={handleRevertConversion}
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
                availableTrips={availableTripsSummary}
                onAddBillToTrip={handleAddSingleBillToTrip}
                onPaymentInfoChange={handlePaymentInfoChange}
                onChangePaidBy={handleChangePaidBy}
                onToggleSettled={handleToggleSettled}
                onSaveBillToCloud={handleSaveBillToCloud}
                onOpenAccount={() => setAccountOpen(true)}
                onBackToAssign={() => setStep(3)}
                onNewSplit={handleNewSplit}
              />
            )}
          </>
        )}
      </main>

      <ColophonFooter withBottomBarOffset={hasStickyBottomBar} />

      {/* Lazy-loaded Modals / Sheets */}
      {currencyOpen && (
        <CurrencySheet
          open={currencyOpen}
          onClose={() => setCurrencyOpen(false)}
          selected={headerCurrency}
          onSelect={handleCurrencyChange}
        />
      )}

      {accountOpen && (
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
          onDuplicateBill={handleDuplicateSavedBill}
          onDeleteBill={handleDeleteSavedBill}
          onTogglePublic={handleToggleBillPublic}
        />
      )}

      {/* Lightweight Editorial Toast with Optional Undo Action */}
      {toast && (
        <div
          role="status"
          className="fixed top-16 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-[3px] border border-[var(--border-strong)] bg-[var(--ink-solid)] px-3.5 py-2 font-mono text-[11px] font-medium text-[var(--ink-on-solid)] animate-fade-in"
        >
          <span className="truncate">{toast.message}</span>
          {toast.onUndo && (
            <button
              type="button"
              onClick={toast.onUndo}
              className="shrink-0 rounded-[2px] bg-[var(--accent)] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[#F7F5F0] transition-colors duration-150 ease-out hover:bg-[var(--accent-hover)]"
            >
              {toast.undoLabel ?? "Undo"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
