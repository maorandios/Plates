/**
 * Fired after the main store writes JSON arrays to localStorage
 * (clients, batches, quotes list keys, etc.). Supabase sync listens to push org_domain_snapshots.
 */
export const PLATE_LOCAL_PERSISTED_EVENT = "plate-local-persisted";
