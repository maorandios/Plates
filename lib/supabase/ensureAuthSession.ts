import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

/**
 * Resolves the current user for browser-side Supabase work.
 *
 * We intentionally do **not** call `auth.refreshSession()` here: the client already
 * has `autoRefreshToken: true`, and an extra manual refresh can race with the
 * background refresh, consume a single-use refresh token twice, and clear the
 * session (SIGNED_OUT) — a common source of "sudden logouts" on production.
 */
export async function ensureAuthUserForBrowserSync(): Promise<User | null> {
  const supabase = createClient();
  const first = await supabase.auth.getUser();
  if (first.data.user) {
    return first.data.user;
  }
  // Let auto-refresh or other tab finish; retry once (matches Supabase's own race guidance).
  await new Promise((r) => setTimeout(r, 200));
  const second = await supabase.auth.getUser();
  return second.data.user ?? null;
}
