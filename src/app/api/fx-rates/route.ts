import { NextResponse } from "next/server";
import { normalizeCurrencyCode } from "@/lib/currency";
import { getLiveRateTable } from "@/lib/server/fx-rates";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const base = normalizeCurrencyCode(searchParams.get("base"), "IDR");

  const table = await getLiveRateTable(base);
  return NextResponse.json(table, {
    status: 200,
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600",
    },
  });
}
