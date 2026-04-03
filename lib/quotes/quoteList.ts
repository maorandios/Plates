/**
 * Persisted list of Quick Quote sessions for the Quotes overview (localStorage).
 */

export type QuoteListStatus = "in_progress" | "complete";

export interface QuoteListRecord {
  id: string;
  referenceNumber: string;
  customerName: string;
  status: QuoteListStatus;
  /** Wizard step 1–7 when last updated. */
  currentStep: number;
  createdAt: string;
  updatedAt: string;
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

function normalizeRecord(r: QuoteListRecord): QuoteListRecord {
  return {
    id: r.id,
    referenceNumber: r.referenceNumber,
    customerName: typeof r.customerName === "string" ? r.customerName : "",
    status: r.status === "complete" ? "complete" : "in_progress",
    currentStep:
      typeof r.currentStep === "number" && r.currentStep >= 1 && r.currentStep <= 7
        ? r.currentStep
        : 1,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : new Date().toISOString(),
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
    });
  }
  save(list);
}

/** Update step / metadata without changing complete → in_progress. */
export function patchQuoteSession(
  id: string,
  partial: Partial<Pick<QuoteListRecord, "currentStep" | "customerName" | "referenceNumber">>
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
    currentStep: 7,
    updatedAt: now,
  };
  save(list);
}

export function deleteQuoteFromList(id: string): void {
  const list = load().filter((q) => q.id !== id);
  save(list);
}
