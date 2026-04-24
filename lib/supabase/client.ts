"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "@/lib/supabase/runtimePublicEnv";
import type { Database } from "@/types/supabase";

export function createClient() {
  const cfg = getPublicSupabaseConfig();
  if (!cfg) {
    throw new Error(
      "Missing Supabase URL/key. In Vercel, set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY and redeploy."
    );
  }
  return createBrowserClient<Database>(cfg.url, cfg.key);
}
