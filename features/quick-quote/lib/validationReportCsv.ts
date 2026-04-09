import type { ValidationRow } from "../types/quickQuote";

function escapeCsvField(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildValidationReportCsv(rows: ValidationRow[]): string {
  const headers = [
    "Part name",
    "Qty",
    "Thickness (mm)",
    "Status",
    "Excel L (mm)",
    "DXF L (mm)",
    "Excel W (mm)",
    "DXF W (mm)",
    "Excel area (m²)",
    "DXF area (m²)",
    "Excel weight (kg)",
    "DXF weight (kg)",
    "Excel material",
    "DXF material",
    "DXF file",
    "Mismatch fields",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        escapeCsvField(r.partName),
        r.qty,
        r.thicknessMm,
        r.status,
        r.excelLengthMm,
        r.dxfLengthMm,
        r.excelWidthMm,
        r.dxfWidthMm,
        r.excelAreaM2,
        r.dxfAreaM2,
        r.excelWeightKg,
        r.dxfWeightKg,
        escapeCsvField(r.excelMaterial),
        escapeCsvField(r.dxfMaterial),
        escapeCsvField(r.dxfFileName),
        escapeCsvField(r.mismatchFields.join("; ") || "—"),
      ].join(",")
    ),
  ];
  return lines.join("\r\n");
}

