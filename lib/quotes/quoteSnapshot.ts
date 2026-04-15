/**
 * Full quote payload for read-only preview (`/quotes/[id]/preview`).
 * Persisted in localStorage — slim DXF blobs to avoid quota blowups.
 */

import type { BendPlateQuoteItem } from "@/features/quick-quote/bend-plate/types";
import type { QuotePdfFullPayload } from "@/features/quick-quote/lib/quotePdfPayload";
import type { QuotePartRow } from "@/features/quick-quote/types/quickQuote";
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

function saveMap(map: Record<string, QuoteSessionSnapshot>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn("[PLATE] Failed to save quote snapshots", e);
  }
}

export function getQuoteSnapshot(id: string): QuoteSessionSnapshot | null {
  const map = loadMap();
  const s = map[id];
  if (!s || s.version !== 1 || !s.draft) return null;
  return s;
}

export function saveQuoteSnapshot(
  id: string,
  payload: Omit<QuoteSessionSnapshot, "version" | "savedAt">
): void {
  if (typeof window === "undefined" || !id) return;
  const map = loadMap();
  const slimGeoms = payload.dxfMethodGeometries.map((g) =>
    slimDxfGeometryForQuoteSnapshot(g)
  );
  map[id] = {
    version: 1,
    savedAt: new Date().toISOString(),
    ...payload,
    dxfMethodGeometries: slimGeoms,
  };
  saveMap(map);
}

export function removeQuoteSnapshot(id: string): void {
  if (typeof window === "undefined" || !id) return;
  const map = loadMap();
  if (!(id in map)) return;
  delete map[id];
  saveMap(map);
}
