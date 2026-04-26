/**
 * Paths that do not require a Supabase session (middleware).
 * Email magic links land on /auth/callback; login UI is /login.
 */
export function isPublicPath(pathname: string): boolean {
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return true;
  }
  if (pathname === "/logout" || pathname.startsWith("/logout/")) {
    return true;
  }
  if (pathname.startsWith("/auth/callback")) {
    return true;
  }
  return false;
}

/**
 * While org bootstrap is loading, we avoid flashing the main app. Still allow
 * auth and onboarding routes to render.
 */
export function isExemptFromOnboardingBootstrapLoading(pathname: string): boolean {
  if (isPublicPath(pathname)) return true;
  if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) {
    return true;
  }
  return false;
}

/** Safe internal path for ?next= (path only, no open redirects). */
export function safeNextPathParam(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/";
  }
  if (raw.includes("://")) {
    return "/";
  }
  return raw.split("?")[0] ?? "/";
}

/**
 * Path + search for post-login redirect (e.g. `/clients/1?x=1`). Must stay same-origin.
 */
export function safeInternalNextPath(pathWithSearch: string): string {
  if (!pathWithSearch.startsWith("/") || pathWithSearch.startsWith("//")) {
    return "/";
  }
  if (pathWithSearch.includes("://")) {
    return "/";
  }
  return pathWithSearch;
}
