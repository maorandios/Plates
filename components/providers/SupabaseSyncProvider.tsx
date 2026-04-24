"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  loadRemoteOrgData,
  patchOrgSettings,
  upsertDomainSnapshot,
} from "@/app/actions/orgData";
import {
  syncAllEntityTablesForOrg,
  syncSteelTypesFromMaterialConfigs,
} from "@/lib/supabase/entityTableSyncBrowser";
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
  const orgId = session?.ok ? session.orgId : null;

  const pushToServer = useCallback(async (oid: string) => {
    try {
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
      const steel = await syncSteelTypesFromMaterialConfigs(getAllMaterialConfigs());
      if (!steel.ok) {
        console.warn("[PLATE] Supabase steel_types sync failed:", steel.error);
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

  useEffect(() => {
    if (loading || !session?.ok) return;
    const oid = session.orgId;
    let cancelled = false;
    void (async () => {
      const remote = await loadRemoteOrgData(oid);
      if (cancelled) return;
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
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, session]);

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

  /** When org session appears, push existing local data once (e.g. first login on this device). */
  useEffect(() => {
    if (!orgId) return;
    const t = setTimeout(() => schedulePush(), 800);
    return () => clearTimeout(t);
  }, [orgId, schedulePush]);

  useEffect(() => {
    if (typeof document === "undefined" || !orgId) return;
    const onVis = () => {
      if (document.visibilityState === "visible") {
        schedulePush();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [orgId, schedulePush]);

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
