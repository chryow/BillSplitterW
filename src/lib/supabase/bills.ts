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

function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
}

function mapBillRow(row: Record<string, unknown>): SavedBillSummary {
  const participants = Array.isArray(row.participants) ? row.participants : [];
  return {
    id: String(row.id),
    share_slug: String(row.share_slug),
    is_public: Boolean(row.is_public),
    merchant_name: String(row.merchant_name ?? ""),
    currency: normalizeCurrencyCode(
      typeof row.currency === "string" ? row.currency : null,
      "IDR"
    ),
    fee_split_mode: "proportional",
    subtotal: Number(row.subtotal ?? 0),
    tax: Number(row.tax ?? 0),
    service_charge: Number(row.service_charge ?? 0),
    discount: Number(row.discount ?? 0),
    grand_total: Number(row.grand_total ?? 0),
    items: Array.isArray(row.items) ? row.items : [],
    participants,
    payment_info: normalizePaymentInfo(row.payment_info),
    paid_by_participant_id:
      typeof row.paid_by_participant_id === "string"
        ? row.paid_by_participant_id
        : null,
    settled_participant_ids: normalizeStringArray(row.settled_participant_ids),
    created_at: String(row.created_at),
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

const BILLS_BASE_COLUMNS =
  "id, share_slug, is_public, merchant_name, currency, fee_split_mode, subtotal, tax, service_charge, discount, grand_total, items, participants, payment_info, created_at";
const BILLS_EXTENDED_COLUMNS = `${BILLS_BASE_COLUMNS}, paid_by_participant_id, settled_participant_ids`;

export async function fetchUserBills(
  supabase: SupabaseClient,
  userId: string
): Promise<SavedBillSummary[]> {
  const extended = await supabase
    .from("bills")
    .select(BILLS_EXTENDED_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!extended.error && extended.data) {
    return extended.data.map((row) =>
      mapBillRow(row as unknown as Record<string, unknown>)
    );
  }

  // Graceful fallback if the settlement columns migration hasn't been applied yet
  const legacy = await supabase
    .from("bills")
    .select(BILLS_BASE_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (legacy.error || !legacy.data) return [];
  return legacy.data.map((row) =>
    mapBillRow(row as unknown as Record<string, unknown>)
  );
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
    feeSplitMode: "proportional",
  });

  const basePayload = {
    user_id: userId,
    is_public: bill.isPublic,
    merchant_name: bill.merchantName.trim() || "Split Bill",
    currency: bill.currency,
    fee_split_mode: "proportional" as const,
    subtotal: split.itemsSubtotal,
    tax: split.tax,
    service_charge: split.serviceCharge,
    discount: split.discount,
    grand_total: split.grandTotal,
    items: bill.items,
    participants: bill.participants,
    payment_info: paymentInfo,
  };

  const extendedPayload = {
    ...basePayload,
    paid_by_participant_id: bill.paidByParticipantId,
    settled_participant_ids: bill.settledParticipantIds,
  };

  if (bill.savedBillId) {
    const attempt = await supabase
      .from("bills")
      .update(extendedPayload)
      .eq("id", bill.savedBillId)
      .eq("user_id", userId)
      .select("id, share_slug, is_public")
      .single();

    if (!attempt.error && attempt.data) {
      return {
        id: String(attempt.data.id),
        shareSlug: String(attempt.data.share_slug),
        isPublic: Boolean(attempt.data.is_public),
      };
    }

    const legacyAttempt = await supabase
      .from("bills")
      .update(basePayload)
      .eq("id", bill.savedBillId)
      .eq("user_id", userId)
      .select("id, share_slug, is_public")
      .single();

    if (!legacyAttempt.error && legacyAttempt.data) {
      return {
        id: String(legacyAttempt.data.id),
        shareSlug: String(legacyAttempt.data.share_slug),
        isPublic: Boolean(legacyAttempt.data.is_public),
      };
    }
  }

  const shareSlug = bill.shareSlug || generateShareSlug();
  const insertExtended = await supabase
    .from("bills")
    .insert({ ...extendedPayload, share_slug: shareSlug })
    .select("id, share_slug, is_public")
    .single();

  if (!insertExtended.error && insertExtended.data) {
    return {
      id: String(insertExtended.data.id),
      shareSlug: String(insertExtended.data.share_slug),
      isPublic: Boolean(insertExtended.data.is_public),
    };
  }

  const insertLegacy = await supabase
    .from("bills")
    .insert({ ...basePayload, share_slug: shareSlug })
    .select("id, share_slug, is_public")
    .single();

  if (insertLegacy.error || !insertLegacy.data) return null;

  return {
    id: String(insertLegacy.data.id),
    shareSlug: String(insertLegacy.data.share_slug),
    isPublic: Boolean(insertLegacy.data.is_public),
  };
}

export async function updateBillSettlements(
  supabase: SupabaseClient,
  billId: string,
  paidByParticipantId: string | null,
  settledParticipantIds: string[]
): Promise<boolean> {
  const { error } = await supabase
    .from("bills")
    .update({
      paid_by_participant_id: paidByParticipantId,
      settled_participant_ids: settledParticipantIds,
    })
    .eq("id", billId);
  return !error;
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
