/**
 * Persisted list of Quick Quote sessions for the Quotes overview (localStorage).
 */

export type QuoteListStatus = "in_progress" | "complete";

export interface QuoteListRecord {
  id: string;
  referenceNumber: string;
  customerName: string;
  status: QuoteListStatus;
  /** Wizard step 1–8 when last updated. */
  currentStep: number;
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
}

const STORAGE_KEY = "plate_quotes_list_v1";
const CHANGED_EVENT = "plate-quotes-list-changed";

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

function normalizeRecord(r: QuoteListRecord): QuoteListRecord {
  return {
    id: r.id,
    referenceNumber: r.referenceNumber,
    customerName: typeof r.customerName === "string" ? r.customerName : "",
    status: r.status === "complete" ? "complete" : "in_progress",
    currentStep:
      typeof r.currentStep === "number" && r.currentStep >= 1 && r.currentStep <= 8
        ? r.currentStep
        : 1,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : new Date().toISOString(),
    customerClientId:
      typeof r.customerClientId === "string" ? r.customerClientId : undefined,
    projectName: typeof r.projectName === "string" ? r.projectName : undefined,
    totalWeightKg: numOrUndef(r.totalWeightKg),
    totalAreaM2: numOrUndef(r.totalAreaM2),
    totalItemQty: numOrUndef(r.totalItemQty),
  };
}

function save(list: QuoteListRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    const sorted = [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
    window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
  } catch (e) {
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
    >
  >
): void {
  const list = load();
  const i = list.findIndex((q) => q.id === id);
  if (i < 0) return;
  const now = new Date().toISOString();
  list[i] = { ...list[i], ...partial, updatedAt: now };
  save(list);
}

export function markQuoteComplete(id: string): void {
  const list = load();
  const i = list.findIndex((q) => q.id === id);
  if (i < 0) return;
  const now = new Date().toISOString();
  list[i] = {
    ...list[i],
    status: "complete",
    currentStep: 8,
    updatedAt: now,
  };
  save(list);
}

export function deleteQuoteFromList(id: string): void {
  const list = load().filter((q) => q.id !== id);
  save(list);
}

/** Quotes (projects) linked to a global client id. */
export function getQuotesForClient(clientId: string): QuoteListRecord[] {
  return load().filter((q) => q.customerClientId === clientId);
}
