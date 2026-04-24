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
  refresh: () => void;
};

const OrgBootstrapContext = createContext<OrgBootstrapContextValue | null>(null);

export function OrgBootstrapProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(isSupabaseConfigured());
  const [session, setSession] = useState<BootstrapSessionResult | null>(null);

  const run = useCallback(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setSession({ ok: false, reason: "supabase_misconfigured" });
      return;
    }
    setLoading(true);
    void bootstrapSession().then((s) => {
      setSession(s);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    run();
  }, [run]);

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
