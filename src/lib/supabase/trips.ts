import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeCurrencyCode } from "../currency";
import { calculateTrip } from "../trip-engine";
import type { Trip } from "../types";
import { generateShareSlug } from "./bills";

function mapTripRow(row: Record<string, unknown>): Trip {
  return {
    id: String(row.id),
    savedTripId: String(row.id),
    shareSlug: typeof row.share_slug === "string" ? row.share_slug : null,
    isPublic: Boolean(row.is_public),
    name: String(row.name ?? "Trip"),
    currency: normalizeCurrencyCode(
      typeof row.currency === "string" ? row.currency : null,
      "IDR"
    ),
    members: Array.isArray(row.members) ? row.members : [],
    expenses: Array.isArray(row.expenses) ? row.expenses : [],
    settledTransferKeys: Array.isArray(row.settled_transfer_keys)
      ? (row.settled_transfer_keys as unknown[]).filter(
          (v): v is string => typeof v === "string"
        )
      : [],
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

export async function fetchUserTrips(
  supabase: SupabaseClient,
  userId: string
): Promise<Trip[]> {
  const { data, error } = await supabase
    .from("trips")
    .select(
      "id, share_slug, is_public, name, currency, members, expenses, settled_transfer_keys, total_spend, created_at, updated_at"
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];
  return data.map((row) => mapTripRow(row as unknown as Record<string, unknown>));
}

export async function saveTripToAccount(
  supabase: SupabaseClient,
  userId: string,
  trip: Trip
): Promise<{ id: string; shareSlug: string; isPublic: boolean } | null> {
  const calc = calculateTrip({
    currency: trip.currency,
    members: trip.members,
    expenses: trip.expenses,
  });

  const payload = {
    user_id: userId,
    is_public: trip.isPublic,
    name: trip.name.trim() || "Trip",
    currency: trip.currency,
    members: trip.members,
    expenses: trip.expenses,
    settled_transfer_keys: trip.settledTransferKeys,
    total_spend: calc.totalSpend,
  };

  if (trip.savedTripId) {
    const { data, error } = await supabase
      .from("trips")
      .update(payload)
      .eq("id", trip.savedTripId)
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

  const shareSlug = trip.shareSlug || generateShareSlug();
  const { data, error } = await supabase
    .from("trips")
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

export async function updateTripPublicVisibility(
  supabase: SupabaseClient,
  tripId: string,
  isPublic: boolean
): Promise<boolean> {
  const { error } = await supabase
    .from("trips")
    .update({ is_public: isPublic })
    .eq("id", tripId);
  return !error;
}

export async function deleteSavedTrip(
  supabase: SupabaseClient,
  tripId: string
): Promise<boolean> {
  const { error } = await supabase.from("trips").delete().eq("id", tripId);
  return !error;
}
