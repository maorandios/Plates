/**
 * One-click export: ZIP containing one DXF per part + one Excel BOM.
 *
 * ZIP structure:
 *   {ref}-package.zip
 *   ├── dxf/
 *   │   ├── BP-001.dxf      ← exact polygon (DXF-sourced parts)
 *   │   ├── SH-PL01.dxf     ← flat blank + bend profile (bend-plate parts)
 *   │   └── MA-PL01.dxf     ← rectangle (manual / excel parts)
 *   └── {ref}-BOM.xlsx
 */

import * as XLSX from "xlsx";
import type { DxfPartGeometry } from "@/types";
import type { BendPlateQuoteItem } from "@/features/quick-quote/bend-plate/types";
import type { QuotePartRow } from "@/features/quick-quote/types/quickQuote";
import { getFileById, getFileData } from "@/lib/store";
import { generatePartDxfString, safeFilenameBase } from "./generatePartDxf";

// ---------------------------------------------------------------------------
// Excel BOM builder
// ---------------------------------------------------------------------------

function buildExcelBom(parts: QuotePartRow[], bendMap: Map<string, BendPlateQuoteItem>): ArrayBuffer {
  type BomRow = Record<string, string | number>;

  const rows: BomRow[] = parts.map((p) => {
    const bend = bendMap.get(p.id);
    const base: BomRow = {
      "Part Name":        p.partName,
      "Source":           p.sourceRef ?? "—",
      "Qty":              p.qty,
      "Material":         p.material,
      "Thickness (mm)":   p.thicknessMm,
      "Length (mm)":      Math.round(p.lengthMm),
      "Width (mm)":       Math.round(p.widthMm),
      "Area (m²)":        +p.areaM2.toFixed(4),
      "Weight/pc (kg)":   +p.weightKg.toFixed(3),
      "Total Weight (kg)":+(p.weightKg * p.qty).toFixed(3),
      "Cut Length (mm)":  Math.round(p.cutLengthMm),
      "Pierce Count":     p.pierceCount,
      "DXF File":         p.dxfFileName || "—",
      "Notes":            p.notes || "",
    };

    // Extra bend-plate columns
    if (bend) {
      base["Template"]            = bend.template.toUpperCase();
      base["Bend Count"]          = bend.calc.bendCount;
      base["Inside Radius (mm)"]  = bend.global.insideRadiusMm;
      base["Plate Width (mm)"]    = bend.global.plateWidthMm;
      base["Developed Length (mm)"] = +bend.calc.developedLengthMm.toFixed(2);
    }

    return base;
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths (approximate character widths)
  ws["!cols"] = [
    { wch: 20 }, // Part Name
    { wch: 10 }, // Source
    { wch: 6  }, // Qty
    { wch: 18 }, // Material
    { wch: 14 }, // Thickness
    { wch: 12 }, // Length
    { wch: 12 }, // Width
    { wch: 10 }, // Area
    { wch: 14 }, // Weight/pc
    { wch: 16 }, // Total Weight
    { wch: 14 }, // Cut Length
    { wch: 13 }, // Pierce Count
    { wch: 24 }, // DXF File
    { wch: 28 }, // Notes
    { wch: 12 }, // Template
    { wch: 12 }, // Bend Count
    { wch: 18 }, // Inside Radius
    { wch: 16 }, // Plate Width
    { wch: 20 }, // Developed Length
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Parts BOM");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
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
  const bendMap = new Map<string, BendPlateQuoteItem>(
    bendPlateQuoteItems.map((b) => [b.id, b])
  );

  const usedFilenames = new Set<string>();

  for (const part of parts) {
    const geometry = geoMap.get(part.id) ?? null;
    const bendItem = bendMap.get(part.id) ?? null;
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

  // Excel BOM
  const excelBuffer = buildExcelBom(parts, bendMap);
  const safeRef = safeFilenameBase(referenceNumber) || "quote";
  zip.file(`${safeRef}-BOM.xlsx`, excelBuffer);

  // Generate and download
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  triggerDownload(blob, `${safeRef}-package.zip`);
}
