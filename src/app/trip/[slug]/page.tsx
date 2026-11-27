import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedTripView } from "@/components/SharedTripView";
import { normalizeCurrencyCode } from "@/lib/currency";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Trip } from "@/lib/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function SharedTripPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">
          Shared trip links are not configured yet
        </h1>
        <p className="mt-2 text-xs text-[var(--text-secondary)]">
          Add your Supabase environment variables to enable public trip links.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex min-h-[44px] items-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white"
        >
          Open BillSplitterW
        </Link>
      </main>
    );
  }

  const { data, error } = await supabase.rpc("get_shared_trip", {
    p_slug: slug,
  });

  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) {
    notFound();
  }

  const trip: Trip = {
    id: String(row.share_slug),
    savedTripId: null,
    shareSlug: String(row.share_slug),
    isPublic: true,
    name: String(row.name ?? "Trip"),
    currency: normalizeCurrencyCode(row.currency, "IDR"),
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

  return <SharedTripView trip={trip} />;
}
