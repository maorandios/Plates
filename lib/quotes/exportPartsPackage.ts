/**
 * One-click export: ZIP containing one DXF per part + technical drawings + Excel plate list.
 *
 * Download: `{quoteId}.zip`
 *
 * ZIP contents:
 *   ├── קבצי DXF/
 *   │   ├── BP-001.dxf      ← exact polygon (DXF-sourced parts)
 *   │   ├── SH-PL01.dxf     ← flat blank + bend profile (bend-plate parts)
 *   │   └── MA-PL01.dxf     ← rectangle (manual / excel parts)
 *   ├── תוכניות ייצור/
 *   │   ├── BP-001.pdf      ← A4 technical drawing (profile + flat blank + title block)
 *   │   └── ...
 *   └── {quoteId} רשימת פלטות.xlsx   ← RTL sheet matching טבלת סיכום columns
 */

import type { DxfPartGeometry } from "@/types";
import type { MaterialType } from "@/types/materials";
import type { BendPlateQuoteItem } from "@/features/quick-quote/bend-plate/types";
import type { QuotePartRow } from "@/features/quick-quote/types/quickQuote";
import { buildUnifiedSummaryBomXlsxBuffer } from "@/features/quick-quote/lib/unifiedSummaryBomXlsx";
import { t } from "@/lib/i18n";
import { getFileById, getFileData } from "@/lib/store";
import { generatePartDxfString, safeFilenameBase } from "./generatePartDxf";
import {
  generatePlateDrawingPdf,
  type PlateDrawingExportMeta,
} from "./generatePlateDrawingPdf";

const EP = "quote.exportPackage" as const;

/** Zip entry name: allow Hebrew; block path characters only. */
function safeZipEntryName(name: string, maxLen = 180): string {
  const s = (name ?? "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return s.slice(0, maxLen) || "file";
}

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
 * @param referenceNumber     Quote reference (filenames + PDF סימוכין)
 * @param options             Optional `customerName` for PDF שם הלקוח
 */
export async function exportPartsPackage(
  parts: QuotePartRow[],
  dxfMethodGeometries: DxfPartGeometry[],
  bendPlateQuoteItems: BendPlateQuoteItem[],
  referenceNumber: string,
  materialType: MaterialType = "carbonSteel",
  options?: Pick<PlateDrawingExportMeta, "customerName">
): Promise<void> {
  if (parts.length === 0) return;

  // Dynamic import keeps jszip out of the initial bundle
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const dxfFolder = zip.folder(safeZipEntryName(t(`${EP}.folderDxf`)))!;
  const drawingsFolder = zip.folder(safeZipEntryName(t(`${EP}.folderDrawings`)))!;

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
      const rawText = getRawDxfText(geometry);
      if (rawText) {
        dxfFolder.file(`${baseName}.dxf`, rawText);
        // Still generate a drawing PDF for DXF-sourced parts (simple rectangle view)
        const pdfBytes = await generatePlateDrawingPdf(part, bendItem, materialType, {
          customerName: options?.customerName,
          quoteReference: referenceNumber,
        });
        if (pdfBytes) drawingsFolder.file(`${baseName}.pdf`, pdfBytes);
        continue;
      }
    }

    const dxfText = generatePartDxfString(part, geometry, bendItem, materialType);
    dxfFolder.file(`${baseName}.dxf`, dxfText);

    const pdfBytes = await generatePlateDrawingPdf(part, bendItem, materialType, {
      customerName: options?.customerName,
      quoteReference: referenceNumber,
    });
    if (pdfBytes) drawingsFolder.file(`${baseName}.pdf`, pdfBytes);
  }

  // Excel BOM (same columns & RTL styling as DXF↔Excel compare export pattern)
  const excelBuffer = await buildUnifiedSummaryBomXlsxBuffer(parts);
  const safeRef = safeFilenameBase(referenceNumber) || "quote";
  const plateListName = safeZipEntryName(
    t(`${EP}.plateListFileName`, { quoteId: safeRef })
  );
  zip.file(`${plateListName}.xlsx`, excelBuffer);

  // Generate and download
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  triggerDownload(blob, `${safeRef}.zip`);
}

/**
 * ZIP for one summary row: DXF + technical drawing PDF + single-row Excel (same BOM shape as full export).
 * Download: `{partName}.zip` (sanitized part name only).
 */
export async function exportSinglePartRowPackage(
  part: QuotePartRow,
  dxfMethodGeometries: DxfPartGeometry[],
  bendPlateQuoteItems: BendPlateQuoteItem[],
  referenceNumber: string,
  materialType: MaterialType = "carbonSteel",
  options?: Pick<PlateDrawingExportMeta, "customerName">
): Promise<void> {
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

  const geometry = geometryForPart(part);
  const bendItem = bendForPartRow(part);
  const baseName = uniqueFilename(safeFilenameBase(part.partName), usedFilenames);

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const dxfFolder = zip.folder(safeZipEntryName(t(`${EP}.folderDxf`)))!;
  const drawingsFolder = zip.folder(safeZipEntryName(t(`${EP}.folderDrawings`)))!;

  if (geometry) {
    const rawText = getRawDxfText(geometry);
    if (rawText) {
      dxfFolder.file(`${baseName}.dxf`, rawText);
      const pdfBytes = await generatePlateDrawingPdf(part, bendItem, materialType, {
        customerName: options?.customerName,
        quoteReference: referenceNumber,
      });
      if (pdfBytes) drawingsFolder.file(`${baseName}.pdf`, pdfBytes);
    } else {
      const dxfText = generatePartDxfString(part, geometry, bendItem, materialType);
      dxfFolder.file(`${baseName}.dxf`, dxfText);
      const pdfBytes = await generatePlateDrawingPdf(part, bendItem, materialType, {
        customerName: options?.customerName,
        quoteReference: referenceNumber,
      });
      if (pdfBytes) drawingsFolder.file(`${baseName}.pdf`, pdfBytes);
    }
  } else {
    const dxfText = generatePartDxfString(part, geometry, bendItem, materialType);
    dxfFolder.file(`${baseName}.dxf`, dxfText);
    const pdfBytes = await generatePlateDrawingPdf(part, bendItem, materialType, {
      customerName: options?.customerName,
      quoteReference: referenceNumber,
    });
    if (pdfBytes) drawingsFolder.file(`${baseName}.pdf`, pdfBytes);
  }

  const excelBuffer = await buildUnifiedSummaryBomXlsxBuffer([part]);
  const safeRef = safeFilenameBase(referenceNumber) || "quote";
  const plateListName = safeZipEntryName(
    t(`${EP}.plateListFileName`, { quoteId: safeRef })
  );
  zip.file(`${plateListName}.xlsx`, excelBuffer);

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const zipBase = safeFilenameBase(part.partName) || "part";
  triggerDownload(blob, `${zipBase}.zip`);
}
