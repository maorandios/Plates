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

/**
 * Call immediately before a batch of **browser** PostgREST calls (and after
 * `patchOrgSettings` / other Server Actions) so the client reloads the session
 * from `document.cookie` and applies a single in-lock refresh when the access
 * token is inside GoTrue’s expiry margin.
 *
 * Parallel `from().upsert` calls on an almost-expired token can all attach the
 * same stale JWT while `getSession` would have refreshed first — that yields
 * **401** and RLS errors (`auth.uid()` empty).
 */
export async function prepareBrowserSessionForPostgrest(
  expectedUserId: string
): Promise<boolean> {
  if (!expectedUserId.trim()) return false;
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    return false;
  }
  const s = data.session;
  if (!s?.user || s.user.id !== expectedUserId) {
    return false;
  }
  return true;
}
