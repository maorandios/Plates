"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  loadRemoteOrgData,
  patchOrgSettings,
  upsertDomainSnapshot,
} from "@/app/actions/orgData";
import { ensureAuthUserForBrowserSync } from "@/lib/supabase/ensureAuthSession";
import { syncAllEntityTablesForOrg } from "@/lib/supabase/entityTableSyncBrowser";
import { applyRemoteDataToLocalStorage } from "@/lib/supabase/hydrateClient";
import {
  ALL_DOMAIN_SNAPSHOT_KEYS,
  DXF_RAW_BUNDLE_KEY,
  FILE_DATA_BUNDLE_KEY,
} from "@/lib/supabase/domainKeys";
import {
  collectDxfRawBundleForSync,
  collectFileDataBundleForSync,
} from "@/lib/supabase/storageBundles";
import { QUOTES_LIST_STORAGE_KEY } from "@/lib/quotes/quoteList";
import { PLATE_PROJECTS_LIST_STORAGE_KEY } from "@/lib/projects/plateProjectList";
import { getAppPreferences } from "@/lib/settings/appPreferences";
import { getAllMaterialConfigs } from "@/lib/settings/materialConfig";
import { getAllCuttingProfileRanges } from "@/lib/settings/cuttingProfiles";
import type { Json } from "@/types/supabase";
import type { MaterialType } from "@/types/materials";
import { useOrgBootstrap } from "@/components/providers/OrgBootstrapProvider";
import { PLATE_LOCAL_PERSISTED_EVENT } from "@/lib/plateEvents";

const SYNC_DEBOUNCE_MS = 400;
const SNAPSHOT_NOTIFY: Record<string, string> = {
  [QUOTES_LIST_STORAGE_KEY]: "plate-quotes-list-changed",
  [PLATE_PROJECTS_LIST_STORAGE_KEY]: "plate-projects-list-changed",
};

function dispatchSnapshotNotify(dataKey: string): void {
  const ev = SNAPSHOT_NOTIFY[dataKey];
  if (ev && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ev));
  }
}

function notifyAfterSnapshotWrite(keys: string[]): void {
  for (const k of keys) {
    dispatchSnapshotNotify(k);
  }
}

function materialConfigsToJson(): Json {
  const configs = getAllMaterialConfigs();
  const byType: Partial<Record<MaterialType, unknown>> = {};
  for (const c of configs) {
    byType[c.materialType] = c;
  }
  return byType as Json;
}

function cuttingToJson(): Json {
  return {
    version: 2,
    ranges: getAllCuttingProfileRanges(),
  } as unknown as Json;
}

/**
 * Pulls public.users + domain snapshots after login, pushes changes on a debounce when local settings/lists change.
 */
export function SupabaseSyncProvider({ children }: { children: React.ReactNode }) {
  const { loading, session } = useOrgBootstrap();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Avoid overlapping pushes (refresh-token / long JSON) that can 401 on production. */
  const pushInFlightRef = useRef(false);
  const pushPendingRef = useRef(false);
  const orgId = session?.ok ? session.accountUserId : null;

  /** Fetches public.users (material_config, etc.) + snapshots and applies to localStorage. */
  const pullRemoteAndApply = useCallback(async (oid: string) => {
    const remote = await loadRemoteOrgData(oid);
    if (remote === "forbidden" || remote === "no_session") return;
    const { settings, snapshots } = remote;
    const notifyKeys: string[] = [];
    for (const s of snapshots) {
      if (SNAPSHOT_NOTIFY[s.data_key]) {
        notifyKeys.push(s.data_key);
      }
    }
    applyRemoteDataToLocalStorage(settings, snapshots);
    notifyAfterSnapshotWrite(notifyKeys);
  }, []);

  const pushToServer = useCallback(async (oid: string) => {
    if (pushInFlightRef.current) {
      pushPendingRef.current = true;
      return;
    }
    pushInFlightRef.current = true;
    try {
      const authUser = await ensureAuthUserForBrowserSync();
      if (!authUser || authUser.id !== oid) {
        return;
      }
      const prefs = getAppPreferences() as unknown as Json;
      const mat = materialConfigsToJson();
      const cut = cuttingToJson();
      const patch = await patchOrgSettings(oid, {
        app_preferences: prefs,
        material_config: mat,
        cutting_profiles: cut,
      });
      if (!patch.ok) {
        console.warn("[PLATE] Supabase users row sync failed:", patch.error);
      }
      for (const dataKey of ALL_DOMAIN_SNAPSHOT_KEYS) {
        try {
          const raw = localStorage.getItem(dataKey);
          if (!raw) continue;
          const payload = JSON.parse(raw) as Json;
          const up = await upsertDomainSnapshot(oid, dataKey, payload);
          if (!up.ok) {
            console.warn(
              `[PLATE] Supabase snapshot sync failed (${dataKey}):`,
              up.error
            );
          }
        } catch (e) {
          console.warn("[PLATE] snapshot skip/parse error:", dataKey, e);
        }
      }
      for (const [bundleKey, collect] of [
        [FILE_DATA_BUNDLE_KEY, collectFileDataBundleForSync] as const,
        [DXF_RAW_BUNDLE_KEY, collectDxfRawBundleForSync] as const,
      ]) {
        try {
          const payload = collect() as Json;
          const up = await upsertDomainSnapshot(oid, bundleKey, payload);
          if (!up.ok) {
            console.warn(
              `[PLATE] Supabase bundle sync failed (${bundleKey}):`,
              up.error
            );
          }
        } catch (e) {
          console.warn("[PLATE] bundle sync error:", bundleKey, e);
        }
      }
      const entity = await syncAllEntityTablesForOrg(oid);
      if (!entity.ok) {
        console.warn("[PLATE] Supabase entity tables sync failed:", entity.error);
      }
    } catch (e) {
      console.warn("[PLATE] Supabase pushToServer error", e);
    } finally {
      pushInFlightRef.current = false;
      if (pushPendingRef.current) {
        pushPendingRef.current = false;
        void pushToServer(oid);
      }
    }
  }, []);

  const schedulePush = useCallback(() => {
    if (!orgId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void pushToServer(orgId);
    }, SYNC_DEBOUNCE_MS);
  }, [orgId, pushToServer]);

  const lastVisPullAtRef = useRef(0);
  const VIS_PULL_THROTTLE_MS = 45_000;

  /** After session is ready, pull from DB (material_config source of truth) then push so local+server stay aligned. */
  useEffect(() => {
    if (loading || !orgId) return;
    const oid = orgId;
    let cancelled = false;
    void (async () => {
      await pullRemoteAndApply(oid);
      if (cancelled) return;
      lastVisPullAtRef.current = Date.now();
      // Never push before hydration (replaces the old 800ms timer that could race and overwrite
      // the server with stale local data before `material_config` was applied).
      schedulePush();
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, orgId, pullRemoteAndApply, schedulePush]);

  useEffect(() => {
    if (!orgId) return;
    const onPrefs = () => schedulePush();
    const onMaterial = () => schedulePush();
    const onCut = () => schedulePush();
    const onLocalPersist = () => schedulePush();
    window.addEventListener("plate-app-preferences-changed", onPrefs);
    window.addEventListener("plate-material-config-changed", onMaterial);
    window.addEventListener("plate-cutting-profiles-changed", onCut);
    window.addEventListener("plate-quotes-list-changed", onPrefs);
    window.addEventListener("plate-projects-list-changed", onPrefs);
    window.addEventListener(PLATE_LOCAL_PERSISTED_EVENT, onLocalPersist);
    return () => {
      window.removeEventListener("plate-app-preferences-changed", onPrefs);
      window.removeEventListener("plate-material-config-changed", onMaterial);
      window.removeEventListener("plate-cutting-profiles-changed", onCut);
      window.removeEventListener("plate-quotes-list-changed", onPrefs);
      window.removeEventListener("plate-projects-list-changed", onPrefs);
      window.removeEventListener(PLATE_LOCAL_PERSISTED_EVENT, onLocalPersist);
    };
  }, [orgId, schedulePush]);

  useEffect(() => {
    if (typeof document === "undefined" || !orgId) return;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastVisPullAtRef.current >= VIS_PULL_THROTTLE_MS) {
        lastVisPullAtRef.current = now;
        void (async () => {
          try {
            await pullRemoteAndApply(orgId);
          } catch (e) {
            console.warn("[PLATE] visibility pull failed", e);
          }
        })();
      }
      schedulePush();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [orgId, schedulePush, pullRemoteAndApply]);

  useEffect(() => {
    if (!orgId) return;
    const t = setInterval(
      () => {
        if (typeof document === "undefined" || document.visibilityState !== "visible") {
          return;
        }
        schedulePush();
      },
      2 * 60 * 1000
    );
    return () => clearInterval(t);
  }, [orgId, schedulePush]);

  return <>{children}</>;
}
