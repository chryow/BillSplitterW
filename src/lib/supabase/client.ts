import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./config";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const cfg = getSupabasePublicConfig();
  if (!cfg) return null;

  if (!browserClient) {
    browserClient = createBrowserClient(cfg.url, cfg.anonKey);
  }
  return browserClient;
}
