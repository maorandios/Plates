import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  isPublicPath,
  safeInternalNextPath,
  safeNextPathParam,
} from "@/lib/auth/publicPaths";

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
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
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
    return NextResponse.redirect(new URL(nextParam, request.url));
  }

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isPublicPath(pathname)) {
      const login = new URL("/login", request.url);
      const intended = pathname + (request.nextUrl.search || "");
      login.searchParams.set("next", safeInternalNextPath(intended));
      return NextResponse.redirect(login);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)",
  ],
};
