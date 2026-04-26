import type { NextRequest } from "next/server";

/**
 * True when the browser still sent Supabase auth cookie(s) (`sb-*-auth-token*`,
 * including chunked `*.0`, `*.1`…).
 *
 * @supabase/ssr documents that concurrent requests with the same (expired) session
 * can see `session: null` until the first response’s `Set-Cookie` is applied. If
 * we redirect those requests to `/login`, navigation (e.g. to `/settings/...`) feels
 * like a random logout. When cookies are still present, allow the RSC request
 * through; the client and the next middleware run recover the refreshed session.
 */
export function requestHasPlausibleSupabaseAuthCookies(
  request: NextRequest
): boolean {
  return request.cookies.getAll().some(
    (c) => c.name.startsWith("sb-") && c.name.includes("auth-token")
  );
}
