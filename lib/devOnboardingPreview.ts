/**
 * When enabled (see `.env.example`), you can open `/onboarding` on localhost
 * even if your org already completed onboarding—useful to design the flow
 * without creating a new Supabase user or editing the DB.
 *
 * Gated: requires `NEXT_PUBLIC_DEV_ONBOARDING_PREVIEW=1` and a local hostname
 * or `next dev` so it does not turn on in production.
 */
export function isDevOnboardingPreviewEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_DEV_ONBOARDING_PREVIEW !== "1") {
    return false;
  }
  if (process.env.NODE_ENV === "development") {
    return true;
  }
  if (typeof window === "undefined") {
    return false;
  }
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}
