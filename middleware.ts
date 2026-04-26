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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

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
