import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  isPublicPath,
  safeInternalNextPath,
  safeNextPathParam,
} from "@/lib/auth/publicPaths";

/** Carry refreshed `Set-Cookie` (and no-store headers) when redirecting or returning 401. */
function withMergedSessionCookies(
  from: NextResponse,
  to: NextResponse
): NextResponse {
  for (const c of from.cookies.getAll()) {
    to.cookies.set(c.name, c.value, c);
  }
  const cacheCtl = from.headers.get("Cache-Control");
  if (cacheCtl) {
    to.headers.set("Cache-Control", cacheCtl);
  }
  return to;
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return supabaseResponse;
  }

  // In `next dev`, do not send everyone to /login (local-first UX; no cloud user yet).
  // Set PLATE_REQUIRE_AUTH_IN_DEV=1 in .env.local to test the real auth wall locally.
  // `next start` / production: always enforce auth.
  const devBypass =
    process.env.NODE_ENV === "development" &&
    process.env.PLATE_REQUIRE_AUTH_IN_DEV !== "1";
  if (devBypass) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
        if (headers) {
          for (const [k, v] of Object.entries(headers)) {
            if (typeof v === "string") {
              supabaseResponse.headers.set(k, v);
            }
          }
        }
      },
    },
  });

  const pathname = request.nextUrl.pathname;

  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;
  let authGetUserError: Awaited<ReturnType<typeof supabase.auth.getUser>>["error"] =
    null;
  try {
    const u = await supabase.auth.getUser();
    user = u.data.user;
    authGetUserError = u.error;
  } catch {
    // Network / runtime failure: do not send the user to /login; cookies may still be valid.
    return supabaseResponse;
  }

  /**
   * If GoTrue is temporarily down or the request failed, do not treat as "logged out"
   * or the SPA will full-navigate to /login and look like a sudden logout.
   */
  if (!user && authGetUserError) {
    const st = authGetUserError.status ?? 0;
    const msg = (authGetUserError.message ?? "").toLowerCase();
    const looksTransient =
      st >= 500 ||
      st === 0 ||
      msg.includes("fetch") ||
      msg.includes("network") ||
      msg.includes("timeout") ||
      msg.includes("econn");
    if (looksTransient) {
      return supabaseResponse;
    }
  }

  if (user && (pathname === "/login" || pathname.startsWith("/login/"))) {
    const nextParam = safeNextPathParam(
      request.nextUrl.searchParams.get("next")
    );
    const toLogin = NextResponse.redirect(new URL(nextParam, request.url));
    return withMergedSessionCookies(supabaseResponse, toLogin);
  }

  if (!user) {
    if (pathname.startsWith("/api/")) {
      const json = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return withMergedSessionCookies(supabaseResponse, json);
    }
    if (!isPublicPath(pathname)) {
      const login = new URL("/login", request.url);
      const intended = pathname + (request.nextUrl.search || "");
      login.searchParams.set("next", safeInternalNextPath(intended));
      const toLogin = NextResponse.redirect(login);
      return withMergedSessionCookies(supabaseResponse, toLogin);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)",
  ],
};
