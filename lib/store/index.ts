/**
 * In-memory store with localStorage persistence.
 * Designed so a real backend/API layer can be swapped in later
 * by replacing the functions in this module.
 */

import type {
  Batch,
  Client,
  UploadedFile,
  ExcelRow,
  DxfPartGeometry,
  Part,
  ProcessedGeometry,
} from "@/types";
function normalizeBatch(b: Batch): Batch {
  const cm = b.cuttingMethod;
  if (cm === "laser" || cm === "plasma" || cm === "oxy_fuel") {
    return { ...b, cuttingMethod: cm };
  }
  return { ...b, cuttingMethod: "laser" };
}

const STORAGE_KEYS = {
  batches: "plate_batches",
  clients: "plate_clients",
  files: "plate_files",
  excelRows: "plate_excel_rows",
  dxfGeometries: "plate_dxf_geometries",
  parts: "plate_parts",
  fileData: "plate_file_data",
} as const;

// ─── Generic helpers ──────────────────────────────────────────────────────────

function loadFromStorage<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage<T>(key: string, data: T[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    const isQuota =
      e instanceof DOMException && e.name === "QuotaExceededError";
    console.error(
      isQuota
        ? `[PLATE] Browser storage quota exceeded (key: ${key}). Entities are no longer persisted in full — clear site data or remove old batches if this persists.`
        : "[PLATE] Failed to save to localStorage",
      e
    );
  }
}

/**
 * Vertex arrays (outer + holes) dominate JSON size for plates with many holes.
 * Metrics stay for matching / table / diagnostics; preview rebuilds via `reprocessDxfGeometry`.
 */
function slimProcessedGeometryForStorage(
  pg: ProcessedGeometry | null
): ProcessedGeometry | null {
  if (!pg) return null;
  return { ...pg, outer: [], holes: [] };
}

/** DXF entities + mesh vertices are re-parsed from file text — do not persist them. */
function stripDxfGeometryForStorage(g: DxfPartGeometry): DxfPartGeometry {
  return {
    ...g,
    entities: [],
    processedGeometry: slimProcessedGeometryForStorage(g.processedGeometry),
  };
}

// ─── Batches ─────────────────────────────────────────────────────────────────

export function getBatches(): Batch[] {
  return loadFromStorage<Batch>(STORAGE_KEYS.batches).map(normalizeBatch);
}

export function getBatchById(id: string): Batch | undefined {
  return getBatches().find((b) => b.id === id);
}

export function saveBatch(batch: Batch): void {
  const batches = getBatches();
  const idx = batches.findIndex((b) => b.id === batch.id);
  if (idx >= 0) {
    batches[idx] = batch;
  } else {
    batches.push(batch);
  }
  saveToStorage(STORAGE_KEYS.batches, batches);
}

export function deleteBatch(id: string): void {
  saveToStorage(
    STORAGE_KEYS.batches,
    getBatches().filter((b) => b.id !== id)
  );
}

// ─── Clients ─────────────────────────────────────────────────────────────────

export function getClients(): Client[] {
  return loadFromStorage<Client>(STORAGE_KEYS.clients);
}

export function getClientsByBatch(batchId: string): Client[] {
  return getClients().filter((c) => c.batchId === batchId);
}

/**
 * Clients tied to a batch: `client.batchId` match, plus any IDs on `batch.clientIds`
 * (recovers rows missing from the first filter if `batchId` on the client is wrong/stale).
 */
export function getMergedClientsForBatch(batchId: string): Client[] {
  const fromBatchField = getClients().filter((c) => c.batchId === batchId);
  const batch = getBatchById(batchId);
  const map = new Map(fromBatchField.map((c) => [c.id, c] as const));
  for (const cid of batch?.clientIds ?? []) {
    if (map.has(cid)) continue;
    const c = getClientById(cid);
    if (c) map.set(cid, c);
  }
  return Array.from(map.values());
}

/**
 * Inputs for rebuilding the unified parts table: join files / Excel / DXF by `clientId`
 * for every merged client, so uploads are not dropped when `batchId` on a file/row/geo mismatches.
 */
export function getBatchMatchInputs(batchId: string): {
  clients: Client[];
  files: UploadedFile[];
  excelRows: ExcelRow[];
  dxfGeometries: DxfPartGeometry[];
} {
  const clients = getMergedClientsForBatch(batchId);
  const clientIds = new Set(clients.map((c) => c.id));
  const files = getFiles().filter((f) => clientIds.has(f.clientId));
  const excelRows = getExcelRows().filter((r) => clientIds.has(r.clientId));
  const dxfGeometries = getDxfGeometries().filter((g) => clientIds.has(g.clientId));
  return { clients, files, excelRows, dxfGeometries };
}

export function getClientById(id: string): Client | undefined {
  return getClients().find((c) => c.id === id);
}

export function saveClient(client: Client): void {
  const clients = getClients();
  const idx = clients.findIndex((c) => c.id === client.id);
  if (idx >= 0) {
    clients[idx] = client;
  } else {
    clients.push(client);
  }
  saveToStorage(STORAGE_KEYS.clients, clients);
}

export function deleteClient(id: string): void {
  saveToStorage(
    STORAGE_KEYS.clients,
    getClients().filter((c) => c.id !== id)
  );
}

// ─── Uploaded Files ───────────────────────────────────────────────────────────

export function getFiles(): UploadedFile[] {
  return loadFromStorage<UploadedFile>(STORAGE_KEYS.files);
}

export function getFilesByClient(clientId: string): UploadedFile[] {
  return getFiles().filter((f) => f.clientId === clientId);
}

export function getFilesByBatch(batchId: string): UploadedFile[] {
  return getFiles().filter((f) => f.batchId === batchId);
}

export function getFileById(id: string): UploadedFile | undefined {
  return getFiles().find((f) => f.id === id);
}

export function saveFile(file: UploadedFile): void {
  const files = getFiles();
  const idx = files.findIndex((f) => f.id === file.id);
  if (idx >= 0) {
    files[idx] = file;
  } else {
    files.push(file);
  }
  saveToStorage(STORAGE_KEYS.files, files);
}

export function deleteFile(id: string): void {
  const file = getFileById(id);
  if (file?.dataKey && typeof window !== "undefined") {
    try {
      localStorage.removeItem(`${STORAGE_KEYS.fileData}_${file.dataKey}`);
    } catch {
      /* ignore */
    }
  }
  saveToStorage(
    STORAGE_KEYS.files,
    getFiles().filter((f) => f.id !== id)
  );
  saveToStorage(
    STORAGE_KEYS.dxfGeometries,
    getDxfGeometries().filter((g) => g.fileId !== id)
  );
  saveToStorage(
    STORAGE_KEYS.excelRows,
    getExcelRows().filter((r) => r.fileId !== id)
  );
}

// ─── File data (raw content stored separately) ────────────────────────────────

export function saveFileData(dataKey: string, content: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_KEYS.fileData}_${dataKey}`, content);
  } catch {
    // Storage quota exceeded — log but don't crash
    console.warn("File data storage failed (quota exceeded?)");
  }
}

export function getFileData(dataKey: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`${STORAGE_KEYS.fileData}_${dataKey}`);
}

// ─── Excel Rows ───────────────────────────────────────────────────────────────

export function getExcelRows(): ExcelRow[] {
  return loadFromStorage<ExcelRow>(STORAGE_KEYS.excelRows);
}

export function getExcelRowsByFile(fileId: string): ExcelRow[] {
  return getExcelRows().filter((r) => r.fileId === fileId);
}

export function getExcelRowsByBatch(batchId: string): ExcelRow[] {
  return getExcelRows().filter((r) => r.batchId === batchId);
}

export function saveExcelRows(rows: ExcelRow[]): void {
  const existing = getExcelRows();
  const fileId = rows[0]?.fileId;
  const withoutThisFile = fileId
    ? existing.filter((r) => r.fileId !== fileId)
    : existing;
  const slim = rows.map((r) => ({ ...r, rawRow: {} as ExcelRow["rawRow"] }));
  saveToStorage(STORAGE_KEYS.excelRows, [...withoutThisFile, ...slim]);
}

export function deleteExcelRowById(rowId: string): void {
  saveToStorage(
    STORAGE_KEYS.excelRows,
    getExcelRows().filter((r) => r.id !== rowId)
  );
}

/**
 * Deletes stored uploads behind a unified part: DXF file (and geometry + blob) and/or one Excel row.
 * Safe when only one side exists (DXF-only or Excel-only).
 */
export function deletePartUploadSources(part: Part): void {
  if (part.dxfFileId) {
    deleteFile(part.dxfFileId);
  }
  if (part.excelRowId) {
    deleteExcelRowById(part.excelRowId);
  }
}

// ─── DXF Geometries ───────────────────────────────────────────────────────────

let dxfVertexStripMigrationDone = false;

export function getDxfGeometries(): DxfPartGeometry[] {
  const list = loadFromStorage<DxfPartGeometry>(STORAGE_KEYS.dxfGeometries);
  if (typeof window === "undefined" || dxfVertexStripMigrationDone) {
    return list;
  }
  dxfVertexStripMigrationDone = true;
  const bulky = list.some(
    (g) =>
      (g.processedGeometry?.outer?.length ?? 0) > 0 ||
      (g.processedGeometry?.holes?.some((h) => h.length > 0) ?? false)
  );
  if (!bulky) return list;
  const slim = list.map(stripDxfGeometryForStorage);
  saveToStorage(STORAGE_KEYS.dxfGeometries, slim);
  return slim;
}

export function getDxfGeometryByFile(fileId: string): DxfPartGeometry | undefined {
  return getDxfGeometries().find((g) => g.fileId === fileId);
}

export function getDxfGeometriesByBatch(batchId: string): DxfPartGeometry[] {
  return getDxfGeometries().filter((g) => g.batchId === batchId);
}

export function saveDxfGeometry(geometry: DxfPartGeometry): void {
  saveDxfGeometriesBatch([geometry]);
}

/**
 * Update several DXF geometry records in one localStorage write (faster rebuilds).
 * Strips `entities` and vertex arrays from `processedGeometry`; re-parse from file when needed.
 */
export function saveDxfGeometriesBatch(updated: DxfPartGeometry[]): void {
  if (updated.length === 0) return;
  const all = getDxfGeometries();
  const byId = new Map(all.map((g) => [g.id, g]));
  for (const g of updated) {
    byId.set(g.id, stripDxfGeometryForStorage(g));
  }
  saveToStorage(STORAGE_KEYS.dxfGeometries, Array.from(byId.values()));
}

// ─── Parts ────────────────────────────────────────────────────────────────────

export function getParts(): Part[] {
  return loadFromStorage<Part>(STORAGE_KEYS.parts);
}

export function getPartsByBatch(batchId: string): Part[] {
  return getParts().filter((p) => p.batchId === batchId);
}

export function saveParts(batchId: string, parts: Part[]): void {
  const existing = getParts().filter((p) => p.batchId !== batchId);
  saveToStorage(STORAGE_KEYS.parts, [...existing, ...parts]);
}
