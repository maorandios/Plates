const COMPLETE = "plate.onboarding.v1";
const PENDING = "plate.pendingOnboarding";

export function setOnboardingPending(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PENDING, "1");
  } catch {
    // ignore
  }
}

export function clearOnboardingPending(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PENDING);
  } catch {
    // ignore
  }
}

export function markOnboardingComplete(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COMPLETE, "1");
    localStorage.removeItem(PENDING);
  } catch {
    // ignore
  }
}

export function isOnboardingComplete(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(COMPLETE) === "1";
  } catch {
    return false;
  }
}

export function hasOnboardingPending(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(PENDING) === "1";
  } catch {
    return false;
  }
}

/**
 * All main app paths except full-view auth / onboarding are gated when
 * `pending` is set (after signup) until onboarding is complete.
 */
export function onboardingGateShouldRedirect(
  pathname: string,
  hasPending: boolean,
  isComplete: boolean
): boolean {
  if (isComplete) return false;
  if (!hasPending) return false;
  if (pathname === "/login" || pathname.startsWith("/login/")) return false;
  if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) {
    return false;
  }
  return true;
}
