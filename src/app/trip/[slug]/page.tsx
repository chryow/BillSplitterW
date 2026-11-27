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
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col items-center justify-center px-6 text-center">
        <div className="w-full rounded-[3px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
          <p className="micro-label text-[var(--text-muted)]">Shared Trip</p>
          <h1 className="font-editorial mt-1 text-xl font-semibold text-[var(--text-primary)]">
            Shared trip links are not configured yet
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
            Add your Supabase environment variables to enable public trip links.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex min-h-[40px] items-center rounded-[3px] border border-[var(--border-strong)] bg-[var(--accent)] px-4 font-mono text-xs font-semibold uppercase tracking-[0.06em] text-[#F7F5F0] transition-colors duration-150 ease-out hover:bg-[var(--accent-hover)]"
          >
            Open BillSplitterW
          </Link>
        </div>
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
