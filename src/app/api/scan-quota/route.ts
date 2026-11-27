import { NextResponse } from "next/server";
import { MAX_SCANS_PER_DAY } from "@/lib/config";
import { getScanQuotaForUser } from "@/lib/server/scan-quota";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      {
        signedIn: false,
        used: 0,
        remaining: 0,
        limit: MAX_SCANS_PER_DAY,
      },
      { status: 200 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        signedIn: false,
        used: 0,
        remaining: 0,
        limit: MAX_SCANS_PER_DAY,
      },
      { status: 200 }
    );
  }

  const quota = await getScanQuotaForUser(supabase, user.id, MAX_SCANS_PER_DAY);
  return NextResponse.json(
    {
      signedIn: true,
      used: quota.used,
      remaining: quota.remaining,
      limit: quota.limit,
      resetAt: quota.resetAt,
    },
    { status: 200 }
  );
}
