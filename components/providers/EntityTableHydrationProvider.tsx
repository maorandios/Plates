"use client";

import { useEffect, useRef } from "react";
import { loadEntityTablesForOrg } from "@/lib/supabase/entityTableSyncBrowser";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useOrgBootstrap } from "@/components/providers/OrgBootstrapProvider";
import { QUOTES_LIST_STORAGE_KEY } from "@/lib/quotes/quoteList";
import { PLATE_PROJECTS_LIST_STORAGE_KEY } from "@/lib/projects/plateProjectList";
import { PLATE_LOCAL_PERSISTED_EVENT } from "@/lib/plateEvents";

const CLIENTS_KEY = "plate_clients";

/**
 * After login, load clients / quotes / projects from Supabase tables into localStorage
 * so the existing store modules keep working.
 */
export function EntityTableHydrationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, session } = useOrgBootstrap();
  /** User id for which we successfully wrote server data to localStorage. */
  const hydratedUserIdRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    if (loading || !session?.ok) {
      if (!session?.ok) {
        hydratedUserIdRef.current = null;
      }
      return;
    }

    const key = session.accountUserId;
    if (hydratedUserIdRef.current === key) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const data = await loadEntityTablesForOrg(key);
        if (cancelled) return;
        if ("error" in data) {
          console.warn("[PLATE] entity table load failed — lists may stay empty until refresh:", data.error);
          return;
        }
        // Always mirror the server into localStorage, including when tables are
        // empty — otherwise a cleared Supabase project still shows stale
        // browser data from a previous session.
        try {
          localStorage.setItem(CLIENTS_KEY, JSON.stringify(data.clients));
          localStorage.setItem(QUOTES_LIST_STORAGE_KEY, JSON.stringify(data.quotes));
          localStorage.setItem(
            PLATE_PROJECTS_LIST_STORAGE_KEY,
            JSON.stringify(data.projects)
          );
          window.dispatchEvent(
            new CustomEvent(PLATE_LOCAL_PERSISTED_EVENT, { detail: { key: CLIENTS_KEY } })
          );
          window.dispatchEvent(new CustomEvent("plate-quotes-list-changed"));
          window.dispatchEvent(new CustomEvent("plate-projects-list-changed"));
          hydratedUserIdRef.current = key;
        } catch (e) {
          console.warn("[PLATE] entity table hydration failed", e);
        }
      } finally {
        inFlightRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
      // Allow React Strict Mode (or a fast re-login) to run hydration again.
      inFlightRef.current = false;
    };
  }, [loading, session]);

  return <>{children}</>;
}
