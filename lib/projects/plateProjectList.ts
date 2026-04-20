/**
 * Persisted list of Plate Project sessions for the Projects overview (localStorage).
 */

import { removePlateProjectSnapshot } from "./plateProjectSnapshot";

export type PlateProjectListStatus = "in_progress" | "complete";

export interface PlateProjectListRecord {
  id: string;
  referenceNumber: string;
  customerName: string;
  projectName?: string;
  status: PlateProjectListStatus;
  /** Wizard step 1–3 when last updated. */
  currentStep: number;
  createdAt: string;
  updatedAt: string;
  /** Material family from General step. */
  materialType: "carbonSteel" | "stainlessSteel" | "aluminum";
  /** Sum of part quantities (כמות פלטות) when synced from the wizard. */
  totalItemQty?: number;
  totalWeightKg?: number;
  totalAreaM2?: number;
}

const STORAGE_KEY = "plate_projects_list_v1";
const CHANGED_EVENT = "plate-projects-list-changed";
const MAX_LIST_SIZE = 200;

function load(): PlateProjectListRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is PlateProjectListRecord =>
          x != null &&
          typeof x === "object" &&
          typeof (x as PlateProjectListRecord).id === "string" &&
          typeof (x as PlateProjectListRecord).referenceNumber === "string"
      )
      .map(normalizeRecord);
  } catch {
    return [];
  }
}

function normalizeRecord(r: PlateProjectListRecord): PlateProjectListRecord {
  const mt = r.materialType;
  const materialType =
    mt === "stainlessSteel" || mt === "aluminum" || mt === "carbonSteel"
      ? mt
      : "carbonSteel";
  return {
    id: r.id,
    referenceNumber: r.referenceNumber,
    customerName: typeof r.customerName === "string" ? r.customerName : "",
    projectName: typeof r.projectName === "string" ? r.projectName : undefined,
    status: r.status === "complete" ? "complete" : "in_progress",
    currentStep:
      typeof r.currentStep === "number" && Number.isFinite(r.currentStep)
        ? Math.min(3, Math.max(1, Math.floor(r.currentStep)))
        : 1,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : new Date().toISOString(),
    materialType,
    totalItemQty: numOrUndef(r.totalItemQty),
    totalWeightKg: numOrUndef(r.totalWeightKg),
    totalAreaM2: numOrUndef(r.totalAreaM2),
  };
}

function numOrUndef(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function save(list: PlateProjectListRecord[]): void {
  if (typeof window === "undefined") return;
  const sorted = [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const capped = sorted.length > MAX_LIST_SIZE ? sorted.slice(0, MAX_LIST_SIZE) : sorted;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
    window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
  } catch (e) {
    console.warn("[PLATE] Failed to save projects list", e);
  }
}

export function getPlateProjectsList(): PlateProjectListRecord[] {
  return load();
}

export function subscribePlateProjectsListChanged(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener(CHANGED_EVENT, handler);
  return () => window.removeEventListener(CHANGED_EVENT, handler);
}

/** Register or update after the user completes General (step 2+). */
export function upsertPlateProjectInProgress(
  patch: Pick<
    PlateProjectListRecord,
    | "id"
    | "referenceNumber"
    | "customerName"
    | "projectName"
    | "materialType"
    | "totalItemQty"
    | "totalWeightKg"
    | "totalAreaM2"
  > & { currentStep: number }
): void {
  const list = load();
  const now = new Date().toISOString();
  const i = list.findIndex((p) => p.id === patch.id);
  if (i >= 0) {
    const prev = list[i];
    list[i] = {
      ...prev,
      referenceNumber: patch.referenceNumber,
      customerName: patch.customerName,
      projectName: patch.projectName ?? prev.projectName,
      materialType: patch.materialType,
      currentStep: patch.currentStep,
      totalItemQty: patch.totalItemQty ?? prev.totalItemQty,
      totalWeightKg: patch.totalWeightKg ?? prev.totalWeightKg,
      totalAreaM2: patch.totalAreaM2 ?? prev.totalAreaM2,
      updatedAt: now,
      status: prev.status === "complete" ? "complete" : "in_progress",
    };
  } else {
    list.push({
      id: patch.id,
      referenceNumber: patch.referenceNumber,
      customerName: patch.customerName,
      projectName: patch.projectName,
      materialType: patch.materialType,
      status: "in_progress",
      currentStep: patch.currentStep,
      createdAt: now,
      updatedAt: now,
      totalItemQty: patch.totalItemQty,
      totalWeightKg: patch.totalWeightKg,
      totalAreaM2: patch.totalAreaM2,
    });
  }
  save(list);
}

export function patchPlateProjectListRecord(
  id: string,
  partial: Partial<
    Pick<
      PlateProjectListRecord,
      | "currentStep"
      | "customerName"
      | "referenceNumber"
      | "projectName"
      | "materialType"
      | "totalItemQty"
      | "totalWeightKg"
      | "totalAreaM2"
    >
  >
): void {
  const list = load();
  const i = list.findIndex((p) => p.id === id);
  if (i < 0) return;
  const now = new Date().toISOString();
  list[i] = {
    ...list[i],
    ...partial,
    updatedAt: now,
  };
  save(list);
}

export function setPlateProjectApprovalStatus(
  id: string,
  status: PlateProjectListStatus
): void {
  const list = load();
  const i = list.findIndex((p) => p.id === id);
  if (i < 0) return;
  const now = new Date().toISOString();
  list[i] = {
    ...list[i],
    status,
    updatedAt: now,
  };
  save(list);
}

export function deletePlateProjectFromList(id: string): void {
  const list = load().filter((p) => p.id !== id);
  save(list);
  removePlateProjectSnapshot(id);
}
