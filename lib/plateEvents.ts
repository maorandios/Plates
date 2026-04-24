/**
 * Fired after the main store (or quote/project snapshots, file data, dxf raw) writes to
 * localStorage. SupabaseSyncProvider listens to push `org_domain_snapshots` + file/dxf bundles.
 */
export const PLATE_LOCAL_PERSISTED_EVENT = "plate-local-persisted";
