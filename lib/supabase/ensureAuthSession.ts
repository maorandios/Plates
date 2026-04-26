import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

/**
 * Returns the current user for browser-side Supabase calls. If `getUser()` is empty
 * (e.g. access token just expired), attempts one `refreshSession()` then re-checks.
 * Reduces prod-only 401 / RLS noise when debounced sync runs right after tab focus or
 * a long idle period.
 */
export async function ensureAuthUserForBrowserSync(): Promise<User | null> {
  const supabase = createClient();
  let {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    return user;
  }
  const { data: refreshed, error } = await supabase.auth.refreshSession();
  if (error || !refreshed.session) {
    return null;
  }
  ({
    data: { user },
  } = await supabase.auth.getUser());
  return user ?? null;
}
