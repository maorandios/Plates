import type { GeneratedSheet, NestingRun } from "@/types";
import { getNestingRunById, getNestingRunsByBatch } from "@/lib/store";

/** Inner nest frame origin → full sheet coordinates (symmetric margin assumption). */
export function innerOriginOnSheet(sheet: GeneratedSheet): { ox: number; oy: number } {
  const ox = (sheet.widthMm - sheet.innerWidthMm) / 2;
  const oy = (sheet.lengthMm - sheet.innerLengthMm) / 2;
  return { ox, oy };
}

export function offsetContourToSheetSpace(
  ring: [number, number][],
  sheet: GeneratedSheet
): [number, number][] {
  const { ox, oy } = innerOriginOnSheet(sheet);
  return ring.map(([x, y]) => [x + ox, y + oy] as [number, number]);
}

export function resolveNestingRunForBatch(
  batchId: string,
  runId: string | null | undefined
): NestingRun | null {
  if (runId) {
    const r = getNestingRunById(runId);
    if (r && r.batchId === batchId) return r;
  }
  const list = getNestingRunsByBatch(batchId);
  if (list.length === 0) return null;
  return [...list].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0]!;
}

export function findSheetInRun(
  run: NestingRun,
  sheetId: string
): GeneratedSheet | null {
  for (const tr of run.thicknessResults) {
    const s = tr.generatedSheets.find((x) => x.id === sheetId);
    if (s) return s;
  }
  return null;
}

/** Locate a sheet across all runs for this batch (when `run` query is missing). */
export function findSheetInBatchRuns(
  batchId: string,
  sheetId: string
): { run: NestingRun; sheet: GeneratedSheet } | null {
  const runs = getNestingRunsByBatch(batchId);
  const sorted = [...runs].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  for (const run of sorted) {
    const sheet = findSheetInRun(run, sheetId);
    if (sheet) return { run, sheet };
  }
  return null;
}

export function polygonCentroidMm(ring: [number, number][]): [number, number] {
  if (ring.length === 0) return [0, 0];
  let sx = 0;
  let sy = 0;
  for (const [x, y] of ring) {
    sx += x;
    sy += y;
  }
  const n = ring.length;
  return [sx / n, sy / n];
}

export function ringBBoxMm(ring: [number, number][]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
