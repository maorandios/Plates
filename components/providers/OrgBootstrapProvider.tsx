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
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";

type OrgBootstrapContextValue = {
  loading: boolean;
  /** Result of the last bootstrap (or null before first run / when not applicable). */
  session: BootstrapSessionResult | null;
  /**
   * Re-fetches session from the server. Returns a Promise so callers can await
   * (e.g. after onboarding) before navigating — otherwise React state can lag
   * one frame and the route guard may still see incomplete onboarding.
   */
  refresh: () => Promise<BootstrapSessionResult>;
};

const OrgBootstrapContext = createContext<OrgBootstrapContextValue | null>(null);

export function OrgBootstrapProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(isSupabaseConfigured());
  const [session, setSession] = useState<BootstrapSessionResult | null>(null);

  const run = useCallback((): Promise<BootstrapSessionResult> => {
    if (!isSupabaseConfigured()) {
      const s: BootstrapSessionResult = { ok: false, reason: "supabase_misconfigured" };
      setLoading(false);
      setSession(s);
      return Promise.resolve(s);
    }
    setLoading(true);
    return bootstrapSession().then((s) => {
      setSession(s);
      setLoading(false);
      return s;
    });
  }, []);

  useEffect(() => {
    run();
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
