import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "./config";

export async function createSupabaseServerClient(): Promise<SupabaseClient | null> {
  const cfg = getSupabasePublicConfig();
  if (!cfg) return null;

  const cookieStore = await cookies();

  return createServerClient(cfg.url, cfg.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component read-only cookie context; safe to ignore during SSR reads
        }
      },
    },
  });
}
