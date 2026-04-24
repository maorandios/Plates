import { QUOTE_SNAPSHOTS_STORAGE_KEY } from "@/lib/quotes/quoteSnapshot";
import { PLATE_PROJECT_SNAPSHOTS_STORAGE_KEY } from "@/lib/projects/plateProjectSnapshot";
import {
  DXF_RAW_BUNDLE_KEY,
  FILE_DATA_BUNDLE_KEY,
} from "@/lib/supabase/storageBundles";

/** Data keys in public.org_domain_snapshots (aligns with localStorage keys). */
export const DOMAIN_SNAPSHOT_KEYS = {
  /** Full quick-quote sessions (wizard + parts + slim DXF) per quote id. */
  quoteSnapshots: QUOTE_SNAPSHOTS_STORAGE_KEY,
  /** Full plate-project wizard state per project id. */
  plateProjectSnapshots: PLATE_PROJECT_SNAPSHOTS_STORAGE_KEY,
  purchasedSheetCatalog: "plate_purchased_sheet_catalog",
  batches: "plate_batches",
  files: "plate_files",
  excelRows: "plate_excel_rows",
  dxfGeometries: "plate_dxf_geometries",
  parts: "plate_parts",
  stockSheets: "plate_stock_sheets",
  batchThicknessOverrides: "plate_batch_thickness_overrides",
  batchClientLinks: "plate_batch_client_links",
  nestingRuns: "plate_nesting_runs",
} as const;

const DOMAIN_EXCLUDED_FROM_ORG_TABLE_SYNC: ReadonlySet<string> = new Set<string>([
  QUOTE_SNAPSHOTS_STORAGE_KEY,
  PLATE_PROJECT_SNAPSHOTS_STORAGE_KEY,
]);

/**
 * One JSON blob per key, same string as `localStorage` (except file/dxf bundles — built in sync).
 * Relational `quotes` / `projects` list rows + `session_payload` hold wizard bodies; this list
 * omits the full quote/project snapshot keys to avoid duplicating them in `org_domain_snapshots`.
 */
export const ALL_DOMAIN_SNAPSHOT_KEYS: string[] = [
  ...Object.values(DOMAIN_SNAPSHOT_KEYS).filter(
    (k) => !DOMAIN_EXCLUDED_FROM_ORG_TABLE_SYNC.has(k)
  ),
];

/** Bundled prefix-scanned data (pushed/merged separately in SupabaseSyncProvider + hydrate). */
export const AUX_BUNDLE_SYNC_KEYS: readonly [typeof FILE_DATA_BUNDLE_KEY, typeof DXF_RAW_BUNDLE_KEY] = [
  FILE_DATA_BUNDLE_KEY,
  DXF_RAW_BUNDLE_KEY,
];

export { FILE_DATA_BUNDLE_KEY, DXF_RAW_BUNDLE_KEY };
