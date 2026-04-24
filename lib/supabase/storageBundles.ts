import type { Json } from "@/types/supabase";

/** Matches `STORAGE_KEYS.fileData` in store + "_" (see `saveFileData`). */
export const FILE_DATA_LS_PREFIX = "plate_file_data_";
/** Quick-quote / export stores raw DXF text per geometry id. */
export const DXF_RAW_LS_PREFIX = "dxf_raw_";

/** `org_domain_snapshots.data_key` — map of `dataKey` → file text (not a real localStorage key). */
export const FILE_DATA_BUNDLE_KEY = "plate_file_data_bundle";
/** `org_domain_snapshots.data_key` — map of `geometryId` → raw dxf string. */
export const DXF_RAW_BUNDLE_KEY = "plate_dxf_raw_bundle";

function collectPrefixedStringMap(prefix: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof window === "undefined") return out;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k == null || !k.startsWith(prefix)) continue;
    const sub = k.slice(prefix.length);
    const v = localStorage.getItem(k);
    if (v != null) out[sub] = v;
  }
  return out;
}

export function collectFileDataBundleForSync(): Json {
  return collectPrefixedStringMap(FILE_DATA_LS_PREFIX) as unknown as Json;
}

export function collectDxfRawBundleForSync(): Json {
  return collectPrefixedStringMap(DXF_RAW_LS_PREFIX) as unknown as Json;
}

/**
 * After remote pull: replace all `plate_file_data_*` keys from the bundle payload.
 */
export function applyFileDataBundleFromRemote(payload: unknown): void {
  if (typeof window === "undefined" || !payload || typeof payload !== "object")
    return;
  const o = payload as Record<string, unknown>;
  const keys = Object.keys(localStorage);
  for (const k of keys) {
    if (k.startsWith(FILE_DATA_LS_PREFIX)) {
      try {
        localStorage.removeItem(k);
      } catch {
        // ignore
      }
    }
  }
  for (const [dataKey, val] of Object.entries(o)) {
    if (typeof val !== "string") continue;
    try {
      localStorage.setItem(`${FILE_DATA_LS_PREFIX}${dataKey}`, val);
    } catch (e) {
      console.warn("[PLATE] Failed to apply file data from cloud bundle for", dataKey, e);
    }
  }
}

/**
 * After remote pull: replace all `dxf_raw_*` keys from the bundle payload.
 */
export function applyDxfRawBundleFromRemote(payload: unknown): void {
  if (typeof window === "undefined" || !payload || typeof payload !== "object")
    return;
  const o = payload as Record<string, unknown>;
  const keys = Object.keys(localStorage);
  for (const k of keys) {
    if (k.startsWith(DXF_RAW_LS_PREFIX)) {
      try {
        localStorage.removeItem(k);
      } catch {
        // ignore
      }
    }
  }
  for (const [id, val] of Object.entries(o)) {
    if (typeof val !== "string") continue;
    try {
      localStorage.setItem(`${DXF_RAW_LS_PREFIX}${id}`, val);
    } catch (e) {
      console.warn("[PLATE] Failed to apply dxf raw from cloud bundle for", id, e);
    }
  }
}
