/**
 * Full quote payload for read-only preview (`/quotes/[id]/preview`).
 * Persisted in localStorage — slim DXF blobs to avoid quota blowups.
 */

import type { BendPlateQuoteItem } from "@/features/quick-quote/bend-plate/types";
import type { QuotePdfFullPayload } from "@/features/quick-quote/lib/quotePdfPayload";
import type {
  ManualQuotePartRow,
  QuotePartRow,
} from "@/features/quick-quote/types/quickQuote";
import type { MaterialType } from "@/types/materials";
import type { DxfPartGeometry } from "@/types";
import { slimDxfGeometryForQuoteSnapshot } from "@/lib/store";

const STORAGE_KEY = "plate_quote_snapshots_v1";

export interface QuoteSessionSnapshot {
  version: 1;
  savedAt: string;
  draft: QuotePdfFullPayload;
  materialType: MaterialType;
  materialPricePerKgByRow: Record<string, string>;
  mergedParts: QuotePartRow[];
  dxfMethodGeometries: DxfPartGeometry[];
  bendPlateQuoteItems: BendPlateQuoteItem[];
  /** Re-open wizard / edit: manual + Excel BOM rows (optional on older saves). */
  manualQuoteRows?: ManualQuotePartRow[];
  excelImportQuoteRows?: ManualQuotePartRow[];
  /** General step notes (free text). */
  generalNotes: string;
}

function loadMap(): Record<string, QuoteSessionSnapshot> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed == null || typeof parsed !== "object") return {};
    return parsed as Record<string, QuoteSessionSnapshot>;
  } catch {
    return {};
  }
}

function saveMap(map: Record<string, QuoteSessionSnapshot>): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    return true;
  } catch (e) {
    console.warn("[PLATE] Failed to save quote snapshots", e);
    return false;
  }
}

/** Last-resort: drop processed contours so rows/BOM from mergedParts + draft still work. */
function ultraSlimDxfForQuoteSnapshot(g: DxfPartGeometry): DxfPartGeometry {
  return {
    ...g,
    entities: [],
    processedGeometry: null,
  };
}

function sortOtherIdsBySavedAtAsc(
  map: Record<string, QuoteSessionSnapshot>,
  id: string
): string[] {
  return Object.keys(map)
    .filter((k) => k !== id)
    .sort(
      (a, b) =>
        (map[a]?.savedAt ?? "").localeCompare(map[b]?.savedAt ?? "", "en")
    );
}

function buildSnapshotEntry(
  payload: Omit<QuoteSessionSnapshot, "version" | "savedAt">,
  dxfMethodGeometries: DxfPartGeometry[]
): QuoteSessionSnapshot {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    ...payload,
    dxfMethodGeometries,
  };
}

/**
 * Write map[id] and persist. If setItem fails (quota), drop oldest other snapshots, then
 * retry with an ultra-slim DXF payload so a row on the list still gets a preview.
 */
function persistWithPruning(
  id: string,
  entry: QuoteSessionSnapshot
): boolean {
  const trySave = (map: Record<string, QuoteSessionSnapshot>) => saveMap(map);

  let map = loadMap();
  map[id] = entry;
  if (trySave(map)) return true;

  for (const victim of sortOtherIdsBySavedAtAsc(map, id)) {
    map = loadMap();
    delete map[victim];
    map[id] = entry;
    if (trySave(map)) return true;
  }
  return false;
}

export function getQuoteSnapshot(id: string): QuoteSessionSnapshot | null {
  const map = loadMap();
  const s = map[id];
  if (!s || s.version !== 1 || !s.draft) return null;
  return s;
}

/**
 * @returns true if the snapshot is persisted and readable (same key as quotes list `id`).
 */
export function saveQuoteSnapshot(
  id: string,
  payload: Omit<QuoteSessionSnapshot, "version" | "savedAt">
): boolean {
  if (typeof window === "undefined" || !id) return false;
  const slimGeoms = payload.dxfMethodGeometries.map((g) =>
    slimDxfGeometryForQuoteSnapshot(g)
  );
  const entrySlim = buildSnapshotEntry(payload, slimGeoms);
  if (persistWithPruning(id, entrySlim)) return true;

  const ultraGeoms = payload.dxfMethodGeometries.map(ultraSlimDxfForQuoteSnapshot);
  const entryUltra = buildSnapshotEntry(payload, ultraGeoms);
  if (persistWithPruning(id, entryUltra)) {
    console.warn(
      "[PLATE] Quote snapshot stored with minimal DXF data (storage quota). Part geometry previews may be empty."
    );
    return true;
  }
  return false;
}

export function removeQuoteSnapshot(id: string): void {
  if (typeof window === "undefined" || !id) return;
  const map = loadMap();
  if (!(id in map)) return;
  delete map[id];
  saveMap(map);
}
