import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SharedBillView,
  type SharedBillData,
} from "@/components/SharedBillView";
import { normalizeCurrencyCode } from "@/lib/currency";
import { EMPTY_PAYMENT_INFO } from "@/lib/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function SharedBillPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">
          Shared links are not configured yet
        </h1>
        <p className="mt-2 text-xs text-[var(--text-secondary)]">
          Add your Supabase environment variables to enable public bill links.
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

  const { data, error } = await supabase.rpc("get_shared_bill", {
    p_slug: slug,
  });

  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) {
    notFound();
  }

  const rawPayment =
    row.payment_info && typeof row.payment_info === "object"
      ? (row.payment_info as Record<string, unknown>)
      : {};

  const rawSettled = Array.isArray(row.settled_participant_ids)
    ? (row.settled_participant_ids as unknown[]).filter(
        (v): v is string => typeof v === "string"
      )
    : [];

  const bill: SharedBillData = {
    share_slug: String(row.share_slug),
    merchant_name: String(row.merchant_name ?? ""),
    currency: normalizeCurrencyCode(row.currency, "IDR"),
    fee_split_mode: "proportional",
    tax: Number(row.tax ?? 0),
    service_charge: Number(row.service_charge ?? 0),
    discount: Number(row.discount ?? 0),
    items: Array.isArray(row.items) ? row.items : [],
    participants: Array.isArray(row.participants) ? row.participants : [],
    payment_info: {
      provider:
        typeof rawPayment.provider === "string"
          ? rawPayment.provider
          : EMPTY_PAYMENT_INFO.provider,
      accountNumber:
        typeof rawPayment.accountNumber === "string"
          ? rawPayment.accountNumber
          : EMPTY_PAYMENT_INFO.accountNumber,
      accountName:
        typeof rawPayment.accountName === "string"
          ? rawPayment.accountName
          : EMPTY_PAYMENT_INFO.accountName,
      note:
        typeof rawPayment.note === "string"
          ? rawPayment.note
          : EMPTY_PAYMENT_INFO.note,
    },
    paid_by_participant_id:
      typeof row.paid_by_participant_id === "string"
        ? row.paid_by_participant_id
        : null,
    settled_participant_ids: rawSettled,
    created_at: String(row.created_at),
  };

  return <SharedBillView bill={bill} />;
}
