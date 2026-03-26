import type { PlateBuilderSpecV1 } from "../types";
import { generatePlateDxf } from "./generatePlateDxf";

function safeFileBase(name: string): string {
  const t = name.trim().replace(/[^a-zA-Z0-9._\s-]+/g, "_").replace(/\s+/g, "_");
  return t.slice(0, 80) || "plate";
}

/** Stored on `PlateBuilderSpecV1.clientId` when not saving to a batch. */
export const PLATE_BUILDER_STANDALONE_CLIENT_ID = "__plate_builder_standalone__";

/** Client-only: triggers a browser download of the built plate DXF. */
export function downloadPlateDxf(spec: PlateBuilderSpecV1): void {
  const dxfText = generatePlateDxf(spec);
  const base = safeFileBase(spec.partName);
  const blob = new Blob([dxfText], {
    type: "application/dxf;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${base}.dxf`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
