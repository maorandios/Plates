import type { NestingRunMode } from "@/types";
import type { ServerNestingJobPayload } from "./buildServerNestingPayload";

export interface ServerNestingJobCreateResponse {
  jobId: string;
  status: "pending" | "running" | "completed" | "failed";
  createdAt: string;
}

export interface ServerNestingJobStatusResponse {
  jobId: string;
  status: "pending" | "running" | "completed" | "failed";
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

export interface ServerNestingPlacement {
  partInstanceId: string;
  partId: string;
  partName: string;
  clientId: string;
  clientCode: string;
  markingText: string;
  x: number;
  y: number;
  rotationDeg: number;
  outerContour: [number, number][];
  innerContours: [number, number][][];
}

export interface ServerGeneratedSheet {
  sheetId: string;
  stockSheetId: string;
  stockType: "purchase" | "leftover";
  fullWidthMm: number;
  fullHeightMm: number;
  widthMm: number;
  heightMm: number;
  usedArea: number;
  wasteArea: number;
  utilization: number;
  placements: ServerNestingPlacement[];
}

export interface ServerDebugMetadata {
  runtimeMs: number;
  candidateAttempts: number;
  earlyStopReason?: string;
  polygonPartsCount: number;
  fallbackCount: number;
  simplificationOriginalPoints: number;
  simplificationSimplifiedPoints: number;
  simplificationRatio: number;
  cavityFillAttempts: number;
  cavityFillSuccesses: number;
  compactionMoves: number;
  scoreTrace: string[];
}

export interface ServerUnplacedPart {
  partId: string;
  partName: string;
  clientId: string;
  clientCode: string;
  quantityUnplaced: number;
  reason: string;
}

export interface ServerThicknessResult {
  thicknessMm: number | null;
  sheetCount: number;
  utilization: number;
  wasteArea: number;
  generatedSheets: ServerGeneratedSheet[];
  unplacedParts: ServerUnplacedPart[];
  debugMetadata: ServerDebugMetadata;
}

export interface ServerNestingRunResult {
  jobId: string;
  batchId: string;
  runMode: NestingRunMode;
  totalSheets: number;
  totalUtilization: number;
  totalWasteArea: number;
  totalPlacedParts: number;
  totalUnplacedParts: number;
  thicknessResults: ServerThicknessResult[];
  debugMetadata: ServerDebugMetadata;
  warnings: string[];
  errors: string[];
}

export async function createServerNestingJob(
  serviceBaseUrl: string,
  payload: ServerNestingJobPayload
): Promise<ServerNestingJobCreateResponse> {
  const res = await fetch(`${serviceBaseUrl}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to create nesting job: ${res.status}`);
  }
  return (await res.json()) as ServerNestingJobCreateResponse;
}

export async function getServerNestingJobStatus(
  serviceBaseUrl: string,
  jobId: string
): Promise<ServerNestingJobStatusResponse> {
  const res = await fetch(`${serviceBaseUrl}/jobs/${encodeURIComponent(jobId)}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch job status: ${res.status}`);
  }
  return (await res.json()) as ServerNestingJobStatusResponse;
}

export async function getServerNestingJobResult(
  serviceBaseUrl: string,
  jobId: string
): Promise<ServerNestingRunResult> {
  const res = await fetch(
    `${serviceBaseUrl}/jobs/${encodeURIComponent(jobId)}/result`
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch job result: ${res.status}`);
  }
  return (await res.json()) as ServerNestingRunResult;
}
