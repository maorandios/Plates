/**
 * Persisted list of Quick Quote sessions for the Quotes overview (localStorage).
 */

import { removeQuoteSnapshot } from "./quoteSnapshot";

export type QuoteListStatus = "in_progress" | "complete";

export interface QuoteListRecord {
  id: string;
  referenceNumber: string;
  customerName: string;
  status: QuoteListStatus;
  /** Wizard step 1–7 when last updated. */
  currentStep: number;
  /** 2 = 7-step wizard; omit/1 = legacy 8-step (migration in {@link migrateWizardStep}). */
  wizardSchema?: number;
  createdAt: string;
  updatedAt: string;
  /** Global client directory id when chosen on General step. */
  customerClientId?: string;
  /** Project name from General step. */
  projectName?: string;
  /** Last synced job totals from the quote wizard (for client project table). */
  totalWeightKg?: number;
  totalAreaM2?: number;
  totalItemQty?: number;
  /** Total price including VAT (from finalize draft when present, else computed from BOM). */
  totalInclVat?: number;
}

const STORAGE_KEY = "plate_quotes_list_v1";
const CHANGED_EVENT = "plate-quotes-list-changed";
const MAX_QUOTES_LIST_SIZE = 200;

function load(): QuoteListRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is QuoteListRecord =>
          x != null &&
          typeof x === "object" &&
          typeof (x as QuoteListRecord).id === "string" &&
          typeof (x as QuoteListRecord).referenceNumber === "string"
      )
      .map(normalizeRecord);
  } catch {
    return [];
  }
}

function numOrUndef(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Map legacy 8-step sessions (incl. removed calculation step) onto 7-step flow. */
function migrateWizardStep(raw: unknown, wizardSchema?: number): number {
  const s = typeof raw === "number" && Number.isFinite(raw) ? raw : 1;
  if (wizardSchema != null && wizardSchema >= 2) {
    if (s < 1) return 1;
    if (s > 7) return 7;
    return Math.floor(s);
  }
  if (s < 1) return 1;
  if (s <= 4) return s;
  if (s === 5) return 5;
  if (s === 6) return 5;
  if (s === 7) return 6;
  return 7;
}

function normalizeRecord(r: QuoteListRecord): QuoteListRecord {
  return {
    id: r.id,
    referenceNumber: r.referenceNumber,
    customerName: typeof r.customerName === "string" ? r.customerName : "",
    status: r.status === "complete" ? "complete" : "in_progress",
    currentStep: migrateWizardStep(r.currentStep, r.wizardSchema),
    createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : new Date().toISOString(),
    customerClientId:
      typeof r.customerClientId === "string" ? r.customerClientId : undefined,
    projectName: typeof r.projectName === "string" ? r.projectName : undefined,
    totalWeightKg: numOrUndef(r.totalWeightKg),
    totalAreaM2: numOrUndef(r.totalAreaM2),
    totalItemQty: numOrUndef(r.totalItemQty),
    totalInclVat: numOrUndef(r.totalInclVat),
    wizardSchema: r.wizardSchema === 2 ? 2 : undefined,
  };
}

function save(list: QuoteListRecord[]): void {
  if (typeof window === "undefined") return;
  const sorted = [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const capped =
    sorted.length > MAX_QUOTES_LIST_SIZE
      ? sorted.slice(0, MAX_QUOTES_LIST_SIZE)
      : sorted;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
    window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      const pruned = capped.filter((q) => q.status !== "complete").slice(0, 50);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
        window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
        return;
      } catch {
        /* still over quota — fall through */
      }
    }
    console.warn("[PLATE] Failed to save quotes list", e);
  }
}

export function getQuotesList(): QuoteListRecord[] {
  return load();
}

export function subscribeQuotesListChanged(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener(CHANGED_EVENT, handler);
  return () => window.removeEventListener(CHANGED_EVENT, handler);
}

/** Register or update when the user leaves General (step 2+). */
export function upsertQuoteInProgress(
  patch: Pick<QuoteListRecord, "id" | "referenceNumber" | "customerName"> & {
    currentStep: number;
    projectName?: string;
    customerClientId?: string;
  }
): void {
  const list = load();
  const now = new Date().toISOString();
  const i = list.findIndex((q) => q.id === patch.id);
  if (i >= 0) {
    const prev = list[i];
    list[i] = {
      ...prev,
      referenceNumber: patch.referenceNumber,
      customerName: patch.customerName,
      currentStep: patch.currentStep,
      wizardSchema: 2,
      projectName: patch.projectName ?? prev.projectName,
      customerClientId: patch.customerClientId ?? prev.customerClientId,
      updatedAt: now,
      status: prev.status === "complete" ? "complete" : "in_progress",
    };
  } else {
    list.push({
      id: patch.id,
      referenceNumber: patch.referenceNumber,
      customerName: patch.customerName,
      status: "in_progress",
      currentStep: patch.currentStep,
      wizardSchema: 2,
      createdAt: now,
      updatedAt: now,
      projectName: patch.projectName,
      customerClientId: patch.customerClientId,
    });
  }
  save(list);
}

/** Update step / metadata without changing complete → in_progress. */
export function patchQuoteSession(
  id: string,
  partial: Partial<
    Pick<
      QuoteListRecord,
      | "currentStep"
      | "customerName"
      | "referenceNumber"
      | "customerClientId"
      | "projectName"
      | "totalWeightKg"
      | "totalAreaM2"
      | "totalItemQty"
      | "totalInclVat"
    >
  >
): void {
  const list = load();
  const i = list.findIndex((q) => q.id === id);
  if (i < 0) return;
  const now = new Date().toISOString();
  list[i] = {
    ...list[i],
    ...partial,
    wizardSchema: 2,
    updatedAt: now,
  };
  save(list);
}

/**
 * After “Save to list” in step 7: sync step and timestamps only.
 * Does **not** set approval — new quotes stay {@link QuoteListStatus} `in_progress` (לא אושרה) until
 * the user changes status in the list or preview ({@link setQuoteApprovalStatus}).
 */
/**
 * User opened a saved (even completed) quote for editing in the Quick Quote wizard.
 * Sets status to in_progress and updates current step.
 */
export function reopenQuoteForEditing(
  id: string,
  currentStep: number
): void {
  const list = load();
  const i = list.findIndex((q) => q.id === id);
  if (i < 0) return;
  const now = new Date().toISOString();
  const c = currentStep;
  const stepClamped = c < 1 ? 1 : c > 7 ? 7 : Math.floor(c);
  list[i] = {
    ...list[i],
    currentStep: stepClamped,
    status: "in_progress",
    wizardSchema: 2,
    updatedAt: now,
  };
  save(list);
}

export function markQuoteComplete(id: string): void {
  const list = load();
  const i = list.findIndex((q) => q.id === id);
  if (i < 0) return;
  const now = new Date().toISOString();
  list[i] = {
    ...list[i],
    currentStep: 7,
    wizardSchema: 2,
    updatedAt: now,
  };
  save(list);
}

/** Set approval status from quotes list / preview (אושרה / לא אושרה). */
export function setQuoteApprovalStatus(id: string, status: QuoteListStatus): void {
  const list = load();
  const i = list.findIndex((q) => q.id === id);
  if (i < 0) return;
  const now = new Date().toISOString();
  list[i] = {
    ...list[i],
    status,
    wizardSchema: 2,
    updatedAt: now,
  };
  save(list);
}

export function deleteQuoteFromList(id: string): void {
  const list = load().filter((q) => q.id !== id);
  save(list);
  removeQuoteSnapshot(id);
}

/** Quotes (projects) linked to a global client id. */
export function getQuotesForClient(clientId: string): QuoteListRecord[] {
  return load().filter((q) => q.customerClientId === clientId);
}
