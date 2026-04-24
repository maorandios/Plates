/**
 * Full plate-project payload for restore when opening `/plate-project?id=…`.
 * Persisted in localStorage — slim DXF blobs to avoid quota blowups.
 */

import type { BendPlateQuoteItem } from "@/features/quick-quote/bend-plate/types";
import type {
  ManualQuotePartRow,
  QuickQuoteJobDetails,
} from "@/features/quick-quote/types/quickQuote";
import type { DxfPartGeometry } from "@/types";
import type { MaterialType } from "@/types/materials";
import { slimDxfGeometryForQuoteSnapshot } from "@/lib/store";
import type { PlateProjectStep } from "@/features/plate-project/types/plateProject";
import { PLATE_LOCAL_PERSISTED_EVENT } from "@/lib/plateEvents";

export const PLATE_PROJECT_SNAPSHOTS_STORAGE_KEY = "plate_project_snapshots_v1";

const STORAGE_KEY = PLATE_PROJECT_SNAPSHOTS_STORAGE_KEY;

export type PlateProjectPhase2Mode = "drawingPicker" | "bendWorkspace";

export interface PlateProjectSessionSnapshot {
  version: 1;
  savedAt: string;
  jobDetails: QuickQuoteJobDetails;
  materialType: MaterialType;
  manualQuoteRows: ManualQuotePartRow[];
  excelImportQuoteRows: ManualQuotePartRow[];
  dxfMethodGeometries: DxfPartGeometry[];
  bendPlateQuoteItems: BendPlateQuoteItem[];
  step: PlateProjectStep;
  highestStepReached: PlateProjectStep;
  phase2Mode: PlateProjectPhase2Mode;
}

function loadMap(): Record<string, PlateProjectSessionSnapshot> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed == null || typeof parsed !== "object") return {};
    return parsed as Record<string, PlateProjectSessionSnapshot>;
  } catch {
    return {};
  }
}

function saveMap(map: Record<string, PlateProjectSessionSnapshot>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(
      new CustomEvent(PLATE_LOCAL_PERSISTED_EVENT, { detail: { key: STORAGE_KEY } })
    );
  } catch (e) {
    console.warn("[PLATE] Failed to save plate project snapshots", e);
  }
}

export function getPlateProjectSnapshot(id: string): PlateProjectSessionSnapshot | null {
  const map = loadMap();
  const s = map[id];
  if (!s || s.version !== 1 || !s.jobDetails) return null;
  return s;
}

export function savePlateProjectSnapshot(
  id: string,
  payload: Omit<PlateProjectSessionSnapshot, "version" | "savedAt">
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

export function removePlateProjectSnapshot(id: string): void {
  if (typeof window === "undefined" || !id) return;
  const map = loadMap();
  if (!(id in map)) return;
  delete map[id];
  saveMap(map);
}
