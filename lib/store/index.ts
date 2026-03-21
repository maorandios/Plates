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
} from "@/types";

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

/** DXF entities are re-parsed from uploaded file text on rebuild — do not persist them. */
function stripDxfGeometryForStorage(g: DxfPartGeometry): DxfPartGeometry {
  return { ...g, entities: [] };
}

// ─── Batches ─────────────────────────────────────────────────────────────────

export function getBatches(): Batch[] {
  return loadFromStorage<Batch>(STORAGE_KEYS.batches);
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
  saveToStorage(
    STORAGE_KEYS.files,
    getFiles().filter((f) => f.id !== id)
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
  saveToStorage(STORAGE_KEYS.excelRows, [...withoutThisFile, ...rows]);
}

// ─── DXF Geometries ───────────────────────────────────────────────────────────

export function getDxfGeometries(): DxfPartGeometry[] {
  return loadFromStorage<DxfPartGeometry>(STORAGE_KEYS.dxfGeometries);
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
 * Always strips `entities` — they are large; re-parse from stored file via `reprocessDxfGeometry`.
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
