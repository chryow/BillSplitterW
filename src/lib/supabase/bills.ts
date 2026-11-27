import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeCurrencyCode } from "../currency";
import { calculateSplit } from "../split-engine";
import { EMPTY_PAYMENT_INFO } from "../storage";
import type {
  BillState,
  PaymentInfo,
  SavedBillSummary,
  SavedFriend,
  UserProfile,
} from "../types";

export function generateShareSlug(length = 10): string {
  const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function normalizePaymentInfo(raw: unknown): PaymentInfo {
  if (!raw || typeof raw !== "object") return { ...EMPTY_PAYMENT_INFO };
  const obj = raw as Record<string, unknown>;
  return {
    provider: typeof obj.provider === "string" ? obj.provider : "",
    accountNumber: typeof obj.accountNumber === "string" ? obj.accountNumber : "",
    accountName: typeof obj.accountName === "string" ? obj.accountName : "",
    note: typeof obj.note === "string" ? obj.note : "",
  };
}

export async function fetchUserProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, default_currency, payment_info")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    display_name: data.display_name ?? null,
    avatar_url: data.avatar_url ?? null,
    default_currency: normalizeCurrencyCode(data.default_currency, "IDR"),
    payment_info: normalizePaymentInfo(data.payment_info),
  };
}

export async function upsertUserPaymentInfo(
  supabase: SupabaseClient,
  userId: string,
  paymentInfo: PaymentInfo,
  defaultCurrency?: string
): Promise<void> {
  const payload: Record<string, unknown> = {
    id: userId,
    payment_info: paymentInfo,
  };
  if (defaultCurrency) {
    payload.default_currency = defaultCurrency;
  }

  await supabase.from("profiles").upsert(payload, { onConflict: "id" });
}

export async function fetchSavedFriends(
  supabase: SupabaseClient,
  userId: string
): Promise<SavedFriend[]> {
  const { data, error } = await supabase
    .from("saved_friends")
    .select("id, name, color")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    color: String(row.color),
  }));
}

export async function saveFriend(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  color: string
): Promise<SavedFriend | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from("saved_friends")
    .insert({ user_id: userId, name: trimmed, color })
    .select("id, name, color")
    .single();

  if (error || !data) return null;
  return {
    id: String(data.id),
    name: String(data.name),
    color: String(data.color),
  };
}

export async function deleteSavedFriend(
  supabase: SupabaseClient,
  friendId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("saved_friends")
    .delete()
    .eq("id", friendId);
  return !error;
}

export async function fetchUserBills(
  supabase: SupabaseClient,
  userId: string
): Promise<SavedBillSummary[]> {
  const { data, error } = await supabase
    .from("bills")
    .select(
      "id, share_slug, is_public, merchant_name, currency, fee_split_mode, subtotal, tax, service_charge, discount, grand_total, items, participants, payment_info, created_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return data.map((row) => ({
    id: String(row.id),
    share_slug: String(row.share_slug),
    is_public: Boolean(row.is_public),
    merchant_name: String(row.merchant_name ?? ""),
    currency: normalizeCurrencyCode(row.currency, "IDR"),
    fee_split_mode: row.fee_split_mode === "equal" ? "equal" : "proportional",
    subtotal: Number(row.subtotal ?? 0),
    tax: Number(row.tax ?? 0),
    service_charge: Number(row.service_charge ?? 0),
    discount: Number(row.discount ?? 0),
    grand_total: Number(row.grand_total ?? 0),
    items: Array.isArray(row.items) ? row.items : [],
    participants: Array.isArray(row.participants) ? row.participants : [],
    payment_info: normalizePaymentInfo(row.payment_info),
    created_at: String(row.created_at),
  }));
}

export async function saveBillToAccount(
  supabase: SupabaseClient,
  userId: string,
  bill: BillState,
  paymentInfo: PaymentInfo
): Promise<{ id: string; shareSlug: string; isPublic: boolean } | null> {
  const split = calculateSplit({
    currency: bill.currency,
    items: bill.items,
    tax: bill.tax,
    serviceCharge: bill.serviceCharge,
    discount: bill.discount,
    participants: bill.participants,
    feeSplitMode: bill.feeSplitMode,
  });

  const payload = {
    user_id: userId,
    is_public: bill.isPublic,
    merchant_name: bill.merchantName.trim() || "Split Bill",
    currency: bill.currency,
    fee_split_mode: bill.feeSplitMode,
    subtotal: split.itemsSubtotal,
    tax: split.tax,
    service_charge: split.serviceCharge,
    discount: split.discount,
    grand_total: split.grandTotal,
    items: bill.items,
    participants: bill.participants,
    payment_info: paymentInfo,
  };

  if (bill.savedBillId) {
    const { data, error } = await supabase
      .from("bills")
      .update(payload)
      .eq("id", bill.savedBillId)
      .eq("user_id", userId)
      .select("id, share_slug, is_public")
      .single();

    if (!error && data) {
      return {
        id: String(data.id),
        shareSlug: String(data.share_slug),
        isPublic: Boolean(data.is_public),
      };
    }
  }

  const shareSlug = bill.shareSlug || generateShareSlug();
  const { data, error } = await supabase
    .from("bills")
    .insert({ ...payload, share_slug: shareSlug })
    .select("id, share_slug, is_public")
    .single();

  if (error || !data) return null;

  return {
    id: String(data.id),
    shareSlug: String(data.share_slug),
    isPublic: Boolean(data.is_public),
  };
}

export async function updateBillPublicVisibility(
  supabase: SupabaseClient,
  billId: string,
  isPublic: boolean
): Promise<boolean> {
  const { error } = await supabase
    .from("bills")
    .update({ is_public: isPublic })
    .eq("id", billId);
  return !error;
}

export async function deleteSavedBill(
  supabase: SupabaseClient,
  billId: string
): Promise<boolean> {
  const { error } = await supabase.from("bills").delete().eq("id", billId);
  return !error;
}
