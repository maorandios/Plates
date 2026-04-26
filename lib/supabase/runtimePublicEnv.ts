/**
 * Reads Supabase public URL + anon key from the **runtime** script in `layout`
 * (Vercel injects `process.env` on the server per request) or falls back to
 * `process.env` from the client bundle. Fixes empty `NEXT_PUBLIC_*` when the
 * bundle was built without those vars but Vercel has them at runtime.
 */
type PlatePublicSupabase = { url: string; key: string };

declare global {
  interface Window {
    __PLATE_PUBLIC_SUPABASE__?: PlatePublicSupabase;
    /** Account scope id (signed-in user id); legacy name from org-based schema. */
    __PLATE_ORG_ID__?: string;
  }
}

export function getPublicSupabaseConfig(): PlatePublicSupabase | null {
  if (typeof window !== "undefined") {
    const w = window.__PLATE_PUBLIC_SUPABASE__;
    if (w?.url && w?.key) {
      return w;
    }
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    return { url, key };
  }
  return null;
}

export function getOrgIdFromWindow(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const id = window.__PLATE_ORG_ID__;
  return typeof id === "string" && id.length > 0 ? id : null;
}
