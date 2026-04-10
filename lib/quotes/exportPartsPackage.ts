/**
 * One-click export: ZIP containing one DXF per part + one Excel plate list.
 *
 * Download: `{quoteId}.zip`
 *
 * ZIP contents:
 *   ├── dxf/
 *   │   ├── BP-001.dxf      ← exact polygon (DXF-sourced parts)
 *   │   ├── SH-PL01.dxf     ← flat blank + bend profile (bend-plate parts)
 *   │   └── MA-PL01.dxf     ← rectangle (manual / excel parts)
 *   └── {quoteId}-plate-list.xlsx   ← RTL sheet matching טבלת סיכום columns
 */

import type { DxfPartGeometry } from "@/types";
import type { BendPlateQuoteItem } from "@/features/quick-quote/bend-plate/types";
import type { QuotePartRow } from "@/features/quick-quote/types/quickQuote";
import { buildUnifiedSummaryBomXlsxBuffer } from "@/features/quick-quote/lib/unifiedSummaryBomXlsx";
import { getFileById, getFileData } from "@/lib/store";
import { generatePartDxfString, safeFilenameBase } from "./generatePartDxf";

// ---------------------------------------------------------------------------
// Browser download helper
// ---------------------------------------------------------------------------

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Unique filename collision guard
// ---------------------------------------------------------------------------

function uniqueFilename(base: string, used: Set<string>): string {
  let name = base;
  let n = 2;
  while (used.has(name)) {
    name = `${base}_${n++}`;
  }
  used.add(name);
  return name;
}

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

/**
 * Try to retrieve the original raw DXF text for a geometry record.
 *
 * Primary:  `dxf_raw_<id>` — written by DxfUploadStep when the user approves
 *           geometries (keyed by geometry ID, set in the same browser session).
 * Fallback: legacy file-store approach via getFileById / getFileData.
 * Returns null if the content is no longer in storage.
 */
function getRawDxfText(geo: DxfPartGeometry): string | null {
  // Primary: saved by DxfUploadStep on approve
  try {
    const direct = localStorage.getItem(`dxf_raw_${geo.id}`);
    if (direct) return direct;
  } catch {
    // localStorage unavailable (SSR guard)
  }

  // Fallback: legacy file-store
  const file = getFileById(geo.fileId);
  if (!file?.dataKey) return null;
  return getFileData(file.dataKey);
}

/**
 * Build and download a ZIP package containing:
 *  - One DXF per part:
 *      · DXF-sourced parts → original uploaded file passed through unchanged
 *      · Bend-plate parts  → flat blank + bend lines (generated)
 *      · Manual / Excel    → rectangle (generated)
 *  - One Excel BOM covering all parts
 *
 * @param parts               Unified merged parts list (Parts step)
 * @param dxfMethodGeometries DxfPartGeometry[] from QuickQuotePage state
 * @param bendPlateQuoteItems BendPlateQuoteItem[] from QuickQuotePage state
 * @param referenceNumber     Quote reference (used in filenames)
 */
export async function exportPartsPackage(
  parts: QuotePartRow[],
  dxfMethodGeometries: DxfPartGeometry[],
  bendPlateQuoteItems: BendPlateQuoteItem[],
  referenceNumber: string
): Promise<void> {
  if (parts.length === 0) return;

  // Dynamic import keeps jszip out of the initial bundle
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const dxfFolder = zip.folder("dxf")!;

  // Build lookup maps: partId → source data
  const geoMap = new Map<string, DxfPartGeometry>(
    dxfMethodGeometries.map((g) => [g.id, g])
  );
  const bendById = new Map(bendPlateQuoteItems.map((b) => [b.id, b]));
  const usedFilenames = new Set<string>();

  function bendForPartRow(p: QuotePartRow): BendPlateQuoteItem | null {
    let b = bendById.get(p.id) ?? null;
    if (b) return b;
    if (p.lineSourceIds?.length) {
      for (const id of p.lineSourceIds) {
        b = bendById.get(id) ?? null;
        if (b) return b;
      }
    }
    return null;
  }

  function geometryForPart(p: QuotePartRow): DxfPartGeometry | null {
    let g = geoMap.get(p.id) ?? null;
    if (g) return g;
    if (p.lineSourceIds?.length) {
      for (const id of p.lineSourceIds) {
        g = geoMap.get(id) ?? null;
        if (g) return g;
      }
    }
    return null;
  }

  for (const part of parts) {
    const geometry = geometryForPart(part);
    const bendItem = bendForPartRow(part);
    const baseName = uniqueFilename(safeFilenameBase(part.partName), usedFilenames);

    if (geometry) {
      // DXF-sourced part: use the original uploaded file exactly as-is
      const rawText = getRawDxfText(geometry);
      if (rawText) {
        dxfFolder.file(`${baseName}.dxf`, rawText);
        continue;
      }
      // Original file no longer in storage — fall through to generated fallback
    }

    // Bend-plate or manual/excel → generate DXF
    const dxfText = generatePartDxfString(part, geometry, bendItem);
    dxfFolder.file(`${baseName}.dxf`, dxfText);
  }

  // Excel BOM (same columns & RTL styling as DXF↔Excel compare export pattern)
  const excelBuffer = await buildUnifiedSummaryBomXlsxBuffer(parts);
  const safeRef = safeFilenameBase(referenceNumber) || "quote";
  zip.file(`${safeRef}-plate-list.xlsx`, excelBuffer);

  // Generate and download
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  triggerDownload(blob, `${safeRef}.zip`);
}
