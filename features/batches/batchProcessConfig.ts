/** Ordered workflow under `/batches/[id]`. Segment is empty for the first step. */
export const BATCH_PROCESS_STEPS = [
  { segment: "" as const, label: "Import data", shortLabel: "Import" },
  { segment: "parts" as const, label: "Validation", shortLabel: "Validation" },
  {
    segment: "stock" as const,
    label: "Stock configuration",
    shortLabel: "Stock",
  },
] as const;

export type BatchProcessStepIndex = 0 | 1 | 2;

export function batchStepHref(
  batchId: string,
  stepIndex: number
): string {
  const base = `/batches/${batchId}`;
  const seg = BATCH_PROCESS_STEPS[stepIndex]?.segment;
  if (!seg) return base;
  return `${base}/${seg}`;
}

export function pathnameToStepIndex(
  batchId: string,
  pathname: string
): BatchProcessStepIndex {
  const prefix = `/batches/${batchId}`;
  const norm = pathname.replace(/\/$/, "") || pathname;
  if (norm === `${prefix}/stock`) return 2;
  if (norm === `${prefix}/parts`) return 1;
  if (norm === prefix) return 0;
  return 0;
}
