/**
 * In-memory store with localStorage persistence.
 * Designed so a real backend/API layer can be swapped in later
 * by replacing the functions in this module.
 */

import type {
  Batch,
  Client,
  ClientStatus,
  BatchClientLink,
  UploadedFile,
  ExcelRow,
  DxfPartGeometry,
  Part,
  ProcessedGeometry,
  GeometryPreparation,
  StockSheetEntry,
  BatchThicknessOverride,
  NestingRun,
} from "@/types";
import { deriveClientCode, generateClientCode, isSafeClientCode } from "@/lib/codegen/clientCode";
import { slimNestingRunForStorage } from "@/lib/nesting/slimNestingRunForStorage";
import { nanoid } from "@/lib/utils/nanoid";
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
  stockSheets: "plate_stock_sheets",
  batchThicknessOverrides: "plate_batch_thickness_overrides",
  batchClientLinks: "plate_batch_client_links",
  nestingRuns: "plate_nesting_runs",
} as const;

function thicknessStorageKey(thicknessMm: number | null): string {
  if (thicknessMm == null || !Number.isFinite(thicknessMm)) return "__none__";
  return String(thicknessMm);
}

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

function slimGeometryPreparationForStorage(
  prep: GeometryPreparation | undefined
): GeometryPreparation | undefined {
  if (!prep) return undefined;
  return {
    cleaned: {
      ...prep.cleaned,
      outerContour: [],
      innerContours: [],
      removedFragments: [],
      invalidFragments: [],
      classificationDiscarded: [],
      reconstructedClosedLoops: [],
    },
    manufacturing: {
      ...prep.manufacturing,
      cutOuter: [],
      cutInner: [],
      marking: { ...prep.manufacturing.marking, paths: [] },
    },
  };
}

/**
 * Vertex arrays (outer + holes) dominate JSON size for plates with many holes.
 * Preparation vertex copies are also stripped; messages/stats stay for diagnostics.
 * Preview rebuilds via `reprocessDxfGeometry`.
 */
function slimProcessedGeometryForStorage(
  pg: ProcessedGeometry | null
): ProcessedGeometry | null {
  if (!pg) return null;
  return {
    ...pg,
    outer: [],
    holes: [],
    preparation: slimGeometryPreparationForStorage(pg.preparation),
  };
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
  saveToStorage(
    STORAGE_KEYS.batchClientLinks,
    loadFromStorage<BatchClientLink>(STORAGE_KEYS.batchClientLinks).filter(
      (l) => l.batchId !== id
    )
  );
  saveToStorage(
    STORAGE_KEYS.nestingRuns,
    loadFromStorage<NestingRun>(STORAGE_KEYS.nestingRuns).filter(
      (r) => r.batchId !== id
    )
  );
}

// ─── Clients (global directory) ───────────────────────────────────────────────

let clientsMigrationRan = false;

function loadClientsRaw(): unknown[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.clients);
    return raw ? (JSON.parse(raw) as unknown[]) : [];
  } catch {
    return [];
  }
}

function normalizeClientFromStorage(raw: unknown): Client {
  const r = raw as Record<string, unknown>;
  const createdAt = String(r.createdAt ?? new Date().toISOString());
  const updatedAt = String(r.updatedAt ?? createdAt);
  const status: ClientStatus =
    r.status === "inactive" ? "inactive" : "active";
  const fullName = String(r.fullName ?? "").trim() || "Unnamed client";
  const shortRaw =
    typeof r.shortCode === "string"
      ? r.shortCode
      : typeof r.code === "string"
        ? r.code
        : "";
  const shortCode = shortRaw.toUpperCase().slice(0, 3) || "TMP";
  const uploadedFileIds = Array.isArray(r.uploadedFileIds)
    ? (r.uploadedFileIds as string[])
    : [];
  return {
    id: String(r.id),
    fullName,
    shortCode,
    contactName:
      typeof r.contactName === "string" ? r.contactName : undefined,
    email: typeof r.email === "string" ? r.email : undefined,
    phone: typeof r.phone === "string" ? r.phone : undefined,
    notes: typeof r.notes === "string" ? r.notes : undefined,
    status,
    uploadedFileIds,
    createdAt,
    updatedAt,
  };
}

function ensureClientsMigrated(): void {
  if (clientsMigrationRan || typeof window === "undefined") return;
  clientsMigrationRan = true;
  const raw = loadClientsRaw();
  if (raw.length === 0) return;

  let needsWrite = false;
  for (const row of raw) {
    const o = row as Record<string, unknown>;
    if ("batchId" in o && o.batchId != null) needsWrite = true;
    if (typeof o.shortCode !== "string" && typeof o.code !== "string") {
      needsWrite = true;
    }
    if (o.status !== "active" && o.status !== "inactive") needsWrite = true;
    if (typeof o.updatedAt !== "string") needsWrite = true;
  }

  const list = raw.map((row) => normalizeClientFromStorage(row));
  const taken = new Set<string>();
  const fixed: Client[] = [];
  for (const c of list) {
    let code = c.shortCode;
    if (!isSafeClientCode(code) || taken.has(code)) {
      code = generateClientCode([...taken]);
      needsWrite = true;
    }
    taken.add(code);
    if (code !== c.shortCode) {
      fixed.push({ ...c, shortCode: code });
    } else {
      fixed.push(c);
    }
  }

  if (needsWrite) {
    saveToStorage(STORAGE_KEYS.clients, fixed);
  }
}

let batchClientLinksMigrationRan = false;

function ensureBatchClientLinksMigrated(): void {
  if (batchClientLinksMigrationRan || typeof window === "undefined") return;
  batchClientLinksMigrationRan = true;
  const existing = loadFromStorage<BatchClientLink>(
    STORAGE_KEYS.batchClientLinks
  );
  if (existing.length > 0) return;
  const batches = loadFromStorage<Batch>(STORAGE_KEYS.batches).map(
    normalizeBatch
  );
  const built: BatchClientLink[] = [];
  for (const b of batches) {
    for (const clientId of b.clientIds ?? []) {
      built.push({
        id: nanoid(),
        batchId: b.id,
        clientId,
        assignedAt: b.createdAt,
      });
    }
  }
  if (built.length > 0) {
    saveToStorage(STORAGE_KEYS.batchClientLinks, built);
  }
}

function persistBatchClientLinks(links: BatchClientLink[]): void {
  saveToStorage(STORAGE_KEYS.batchClientLinks, links);
}

export function getBatchClientLinks(): BatchClientLink[] {
  ensureBatchClientLinksMigrated();
  return loadFromStorage<BatchClientLink>(STORAGE_KEYS.batchClientLinks);
}

export function getBatchClientLinksForBatch(
  batchId: string
): BatchClientLink[] {
  return getBatchClientLinks().filter((l) => l.batchId === batchId);
}

export function getClients(): Client[] {
  ensureClientsMigrated();
  return loadFromStorage<Client>(STORAGE_KEYS.clients);
}

/** @deprecated Use getMergedClientsForBatch — kept for call-site compatibility */
export function getClientsByBatch(batchId: string): Client[] {
  return getMergedClientsForBatch(batchId);
}

export function getMergedClientsForBatch(batchId: string): Client[] {
  const batch = getBatchById(batchId);
  if (!batch) return [];
  const map = new Map<string, Client>();
  for (const cid of batch.clientIds) {
    const c = getClientById(cid);
    if (c) map.set(cid, c);
  }
  return Array.from(map.values());
}

/**
 * Inputs for rebuilding the unified parts table: scoped to this batch so global
 * clients’ uploads in other jobs are excluded.
 */
export function getBatchMatchInputs(batchId: string): {
  clients: Client[];
  files: UploadedFile[];
  excelRows: ExcelRow[];
  dxfGeometries: DxfPartGeometry[];
} {
  const clients = getMergedClientsForBatch(batchId);
  const clientIds = new Set(clients.map((c) => c.id));
  const files = getFiles().filter(
    (f) => f.batchId === batchId && clientIds.has(f.clientId)
  );
  const excelRows = getExcelRows().filter(
    (r) => r.batchId === batchId && clientIds.has(r.clientId)
  );
  const dxfGeometries = getDxfGeometries().filter(
    (g) => g.batchId === batchId && clientIds.has(g.clientId)
  );
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

export function linkClientToBatch(batchId: string, clientId: string): void {
  const batch = getBatchById(batchId);
  if (!batch) return;
  const now = new Date().toISOString();
  if (!batch.clientIds.includes(clientId)) {
    saveBatch({
      ...batch,
      clientIds: [...batch.clientIds, clientId],
      status: batch.status === "draft" ? "active" : batch.status,
      updatedAt: now,
    });
  }
  const links = getBatchClientLinks();
  if (links.some((l) => l.batchId === batchId && l.clientId === clientId)) {
    return;
  }
  persistBatchClientLinks([
    ...links,
    { id: nanoid(), batchId, clientId, assignedAt: now },
  ]);
}

export function linkClientsToBatch(batchId: string, clientIds: string[]): void {
  for (const id of clientIds) linkClientToBatch(batchId, id);
}

export function unlinkClientFromBatch(batchId: string, clientId: string): void {
  const batch = getBatchById(batchId);
  if (batch) {
    saveBatch({
      ...batch,
      clientIds: batch.clientIds.filter((id) => id !== clientId),
      updatedAt: new Date().toISOString(),
    });
  }
  persistBatchClientLinks(
    getBatchClientLinks().filter(
      (l) => !(l.batchId === batchId && l.clientId === clientId)
    )
  );
}

export type CreateGlobalClientInput = {
  fullName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  notes?: string;
  status?: ClientStatus;
};

export function createGlobalClient(input: CreateGlobalClientInput): Client {
  const clients = getClients();
  const codes = clients.map((c) => c.shortCode);
  const shortCode = deriveClientCode(input.fullName.trim(), codes);
  const now = new Date().toISOString();
  const client: Client = {
    id: nanoid(),
    fullName: input.fullName.trim(),
    shortCode,
    contactName: input.contactName?.trim() || undefined,
    email: input.email?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    status: input.status === "inactive" ? "inactive" : "active",
    uploadedFileIds: [],
    createdAt: now,
    updatedAt: now,
  };
  saveClient(client);
  return client;
}

/** Removes the client everywhere (files, parts links, batch assignments). */
export function deleteGlobalClient(clientId: string): void {
  for (const f of getFiles().filter((x) => x.clientId === clientId)) {
    deleteFile(f.id);
  }
  for (const b of getBatches()) {
    if (!b.clientIds.includes(clientId)) continue;
    saveBatch({
      ...b,
      clientIds: b.clientIds.filter((id) => id !== clientId),
      updatedAt: new Date().toISOString(),
    });
  }
  persistBatchClientLinks(
    getBatchClientLinks().filter((l) => l.clientId !== clientId)
  );
  saveToStorage(
    STORAGE_KEYS.parts,
    getParts().filter((p) => p.clientId !== clientId)
  );
  saveToStorage(
    STORAGE_KEYS.clients,
    getClients().filter((c) => c.id !== clientId)
  );
}

/** @deprecated Prefer deleteGlobalClient or unlinkClientFromBatch */
export function deleteClient(id: string): void {
  deleteGlobalClient(id);
}

// ─── Uploaded Files ───────────────────────────────────────────────────────────

export function getFiles(): UploadedFile[] {
  return loadFromStorage<UploadedFile>(STORAGE_KEYS.files);
}

export function getFilesByClient(clientId: string): UploadedFile[] {
  return getFiles().filter((f) => f.clientId === clientId);
}

export function getFilesByClientAndBatch(
  clientId: string,
  batchId: string
): UploadedFile[] {
  return getFiles().filter(
    (f) => f.clientId === clientId && f.batchId === batchId
  );
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

// ─── Stock sheets (per batch, per thickness) ─────────────────────────────────

export function getStockSheets(): StockSheetEntry[] {
  return loadFromStorage<StockSheetEntry>(STORAGE_KEYS.stockSheets);
}

export function getStockSheetsByBatch(batchId: string): StockSheetEntry[] {
  return getStockSheets().filter((s) => s.batchId === batchId);
}

/** Replace all persisted rows for this batch with `entries` (full list for the batch). */
export function saveStockSheetsForBatch(
  batchId: string,
  entries: StockSheetEntry[]
): void {
  const others = getStockSheets().filter((s) => s.batchId !== batchId);
  saveToStorage(STORAGE_KEYS.stockSheets, [...others, ...entries]);
}

export function deleteStockSheet(id: string): void {
  saveToStorage(
    STORAGE_KEYS.stockSheets,
    getStockSheets().filter((s) => s.id !== id)
  );
}

// ─── Batch thickness cutting overrides (per batch, per thickness band) ───────

export function getBatchThicknessOverrideRecords(): BatchThicknessOverride[] {
  return loadFromStorage<BatchThicknessOverride>(
    STORAGE_KEYS.batchThicknessOverrides
  );
}

export function getBatchThicknessOverrideRecordsForBatch(
  batchId: string
): BatchThicknessOverride[] {
  return getBatchThicknessOverrideRecords().filter((o) => o.batchId === batchId);
}

export function upsertBatchThicknessOverrideRecord(
  entry: BatchThicknessOverride
): void {
  const all = getBatchThicknessOverrideRecords().filter(
    (o) =>
      !(
        o.batchId === entry.batchId &&
        thicknessStorageKey(o.thicknessMm) ===
          thicknessStorageKey(entry.thicknessMm)
      )
  );
  saveToStorage(STORAGE_KEYS.batchThicknessOverrides, [...all, entry]);
}

export function removeBatchThicknessOverrideRecord(
  batchId: string,
  thicknessMm: number | null
): void {
  const key = thicknessStorageKey(thicknessMm);
  saveToStorage(
    STORAGE_KEYS.batchThicknessOverrides,
    getBatchThicknessOverrideRecords().filter(
      (o) =>
        !(o.batchId === batchId && thicknessStorageKey(o.thicknessMm) === key)
    )
  );
}

// ─── Nesting runs (auto nesting MVP) ───────────────────────────────────────

export function getNestingRuns(): NestingRun[] {
  return loadFromStorage<NestingRun>(STORAGE_KEYS.nestingRuns);
}

export function getNestingRunsByBatch(batchId: string): NestingRun[] {
  return getNestingRuns().filter((r) => r.batchId === batchId);
}

export function getNestingRunById(id: string): NestingRun | undefined {
  return getNestingRuns().find((r) => r.id === id);
}

/** Most recent first */
export function getLatestNestingRunForBatch(
  batchId: string
): NestingRun | undefined {
  const list = getNestingRunsByBatch(batchId);
  if (list.length === 0) return undefined;
  return [...list].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];
}

/** Dispatched on successful save so the nesting results view can re-read storage (same tab). */
export const PLATE_NESTING_RUN_SAVED_EVENT = "plate-nesting-run-saved";

/**
 * Persists a nesting run (slimmed for localStorage size). Returns false if storage failed.
 */
export function saveNestingRun(run: NestingRun): boolean {
  if (typeof window === "undefined") return false;
  const slim = slimNestingRunForStorage(run);
  const all = getNestingRuns().filter((r) => r.id !== slim.id);
  const next = [...all, slim];
  try {
    localStorage.setItem(STORAGE_KEYS.nestingRuns, JSON.stringify(next));
    window.dispatchEvent(
      new CustomEvent(PLATE_NESTING_RUN_SAVED_EVENT, {
        detail: { batchId: slim.batchId, runId: slim.id },
      })
    );
    return true;
  } catch (e) {
    const isQuota =
      e instanceof DOMException && e.name === "QuotaExceededError";
    console.error(
      isQuota
        ? "[PLATE] Nesting run too large for browser storage (quota). Try fewer parts per run or clear site data."
        : "[PLATE] Failed to save nesting run",
      e
    );
    return false;
  }
}
