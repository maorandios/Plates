"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { bootstrapSession, type BootstrapSessionResult } from "@/app/actions/organization";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";

type BootstrapOptions = { /** When false, session is updated without the global app loading gate (avoids unmounting the tree e.g. quick-quote wizard). */ showLoading?: boolean };

type OrgBootstrapContextValue = {
  loading: boolean;
  /** Result of the last bootstrap (or null before first run / when not applicable). */
  session: BootstrapSessionResult | null;
  /**
   * Re-fetches session from the server. Returns a Promise so callers can await
   * (e.g. after onboarding) before navigating — otherwise React state can lag
   * one frame and the route guard may still see incomplete onboarding.
   */
  refresh: (options?: BootstrapOptions) => Promise<BootstrapSessionResult>;
};

const OrgBootstrapContext = createContext<OrgBootstrapContextValue | null>(null);

export function OrgBootstrapProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(isSupabaseConfigured());
  const [session, setSession] = useState<BootstrapSessionResult | null>(null);

  const run = useCallback(
    (options?: BootstrapOptions): Promise<BootstrapSessionResult> => {
      if (!isSupabaseConfigured()) {
        const s: BootstrapSessionResult = { ok: false, reason: "supabase_misconfigured" };
        setLoading(false);
        setSession(s);
        return Promise.resolve(s);
      }
      const showLoading = options?.showLoading !== false;
      if (showLoading) {
        setLoading(true);
      }
      return bootstrapSession().then((s) => {
        setSession(s);
        if (showLoading) {
          setLoading(false);
        }
        return s;
      });
    },
    []
  );

  useEffect(() => {
    void run();
  }, [run]);

  /**
   * Re-sync server `public.users` when auth changes, without flipping `loading` — otherwise
   * {@link OnboardingRouteGuard} unmounts the full tree (spinner) and in-progress UIs
   * (e.g. quick quote steps) remount and reset to phase 1.
   */
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        if (typeof window !== "undefined") {
          delete window.__PLATE_ORG_ID__;
        }
        setSession({ ok: false, reason: "no_session" });
        setLoading(false);
        return;
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        void run({ showLoading: false });
      }
    });
    return () => subscription.unsubscribe();
  }, [run]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (session?.ok) {
      // Legacy name: value is the signed-in user id (single-tenant account scope).
      window.__PLATE_ORG_ID__ = session.accountUserId;
    } else {
      delete window.__PLATE_ORG_ID__;
    }
  }, [session]);

  const value = useMemo(
    () => ({
      loading,
      session,
      refresh: run,
    }),
    [loading, session, run]
  );

  return (
    <OrgBootstrapContext.Provider value={value}>{children}</OrgBootstrapContext.Provider>
  );
}

export function useOrgBootstrap(): OrgBootstrapContextValue {
  const ctx = useContext(OrgBootstrapContext);
  if (!ctx) {
    throw new Error("useOrgBootstrap must be used within OrgBootstrapProvider");
  }
  return ctx;
}
