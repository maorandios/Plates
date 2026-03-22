import type { Part } from "@/types";

function numKey(n: number | undefined, decimals: number): string {
  if (n == null || Number.isNaN(n)) return "";
  const m = 10 ** decimals;
  return String(Math.round(n * m) / m);
}

function strKey(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Key for counting distinct "plate types" in batch summaries.
 * Same `partName` can appear multiple times when thickness, material, stock
 * dimensions, or linked DXF (shape) differ.
 */
export function plateTypeDedupeKey(
  part: Pick<
    Part,
    | "id"
    | "partName"
    | "dxfFileId"
    | "thickness"
    | "material"
    | "width"
    | "length"
    | "area"
    | "dxfArea"
    | "dxfWidthMm"
    | "dxfLengthMm"
    | "dxfPerimeter"
  >
): string {
  const name = (part.partName ?? "").trim() || part.id;
  const dxfId = part.dxfFileId ?? "";
  const t = numKey(part.thickness, 4);
  const mat = strKey(part.material);
  const w = numKey(part.width, 2);
  const l = numKey(part.length, 2);
  const a = numKey(part.area, 6);
  const dA = numKey(part.dxfArea, 0);
  const dw = numKey(part.dxfWidthMm, 2);
  const dl = numKey(part.dxfLengthMm, 2);
  const dp = numKey(part.dxfPerimeter, 0);
  return [name, dxfId, t, mat, w, l, a, dA, dw, dl, dp].join("\u001f");
}
