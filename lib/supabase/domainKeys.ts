/** Data keys in public.org_domain_snapshots (aligns with localStorage keys). */
export const DOMAIN_SNAPSHOT_KEYS = {
  /** Clients, quotes, projects are stored in relational tables; not snapshotted here. */
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

export const ALL_DOMAIN_SNAPSHOT_KEYS: string[] = [
  ...Object.values(DOMAIN_SNAPSHOT_KEYS),
];
