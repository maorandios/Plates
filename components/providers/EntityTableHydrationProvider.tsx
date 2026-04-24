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
  const ranForSession = useRef<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured() || loading || !session?.ok) return;
    const key = session.orgId;
    if (ranForSession.current === key) return;
    ranForSession.current = key;
    let cancelled = false;
    void (async () => {
      const data = await loadEntityTablesForOrg();
      if (cancelled || "error" in data) return;
      const hasServerData =
        data.clients.length > 0 || data.quotes.length > 0 || data.projects.length > 0;
      if (!hasServerData) {
        return;
      }
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
      } catch (e) {
        console.warn("[PLATE] entity table hydration failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, session]);

  return <>{children}</>;
}
