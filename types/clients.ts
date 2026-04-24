import type { CuttingMethod } from "./production";

// ─── Global client directory (not batch-scoped) ───────────────────────────────

export type ClientStatus = "active" | "inactive";

/**
 * Global client record. Batches reference `id` via `batch.clientIds` and optional
 * `BatchClientLink` rows for `assignedAt`.
 */
export interface Client {
  id: string;
  fullName: string;
  /** Permanent unique 3-character uppercase code (global) */
  shortCode: string;
  /** ח.פ / עוסק מורשה */
  companyRegistrationNumber?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  city?: string;
  notes?: string;
  status: ClientStatus;
  /** Legacy field; file lists are derived from `UploadedFile` rows */
  uploadedFileIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ClientMetrics {
  clientId: string;
  totalBatches: number;
  totalParts: number;
  totalQuantity: number;
  /** Sum of weights (kg): batch part lines + quick quotes linked to this client */
  totalWeight: number;
  /** Sum of areas (m²): batch part lines + quick quotes linked to this client */
  totalAreaM2: number;
  lastBatchDate: string | null;
}

export interface BatchClientLink {
  id: string;
  batchId: string;
  clientId: string;
  assignedAt: string;
}

/** One row for the client details “batch history” table */
export interface ClientBatchHistoryRow {
  batchId: string;
  batchName: string;
  batchCreatedAt: string;
  cuttingMethod: CuttingMethod;
  partsCount: number;
  totalQuantity: number;
  totalWeight: number;
}
