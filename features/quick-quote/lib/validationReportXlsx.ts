import ExcelJS from "exceljs";
import { t } from "@/lib/i18n";
import type { ValidationRow, ValidationRowStatus } from "../types/quickQuote";

const VT = "quote.dxfPhase.validationTable";

const FONT_NAME = "Arial";

const DEFAULT_FONT: Partial<ExcelJS.Font> = {
  name: FONT_NAME,
  color: { argb: "FF000000" },
};

/** Excel “Neutral” style — highlight DXF vs Excel differences. */
const MISMATCH_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFEB9C" },
};

const MISMATCH_FONT: Partial<ExcelJS.Font> = {
  name: FONT_NAME,
  color: { argb: "FF9C6500" },
};

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF3F4F6" },
};

/** Excel “Good” / “Neutral” / “Bad” data styles (fill + text). */
const STATUS_STYLES: Record<
  ValidationRowStatus,
  { fill: ExcelJS.Fill; font: Partial<ExcelJS.Font> }
> = {
  valid: {
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFC6EFCE" },
    },
    font: { name: FONT_NAME, color: { argb: "FF006100" } },
  },
  warning: {
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFEB9C" },
    },
    font: { name: FONT_NAME, color: { argb: "FF9C6500" } },
  },
  error: {
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFC7CE" },
    },
    font: { name: FONT_NAME, color: { argb: "FF9C0006" } },
  },
};

/** Light gray horizontal rule only (bottom edge of row). */
const BOTTOM_RULE: ExcelJS.Border = {
  style: "thin",
  color: { argb: "FFD1D5DB" },
};

/** First column (שם חלק) — wide for long part names; body cells wrap within this width. */
const MAIN_COL_WIDTH = 48;

/** Column widths tuned for Hebrew headers with units (headers also use wrap). */
const COL_WIDTHS: number[] = [
  MAIN_COL_WIDTH,
  10,
  12,
  20,
  20,
  20,
  20,
  18,
  18,
  18,
  18,
  24,
  24,
  14,
  58,
];

const NOTES_COL = 15;
const STATUS_COL = 14;

const rtlTextAlignWrap: Partial<ExcelJS.Alignment> = {
  horizontal: "right",
  vertical: "middle",
  readingOrder: "rtl",
  wrapText: true,
};

const rtlTextAlignNoWrap: Partial<ExcelJS.Alignment> = {
  horizontal: "right",
  vertical: "middle",
  readingOrder: "rtl",
  wrapText: false,
};

/** Header row — wrap so long labels like “אורך Excel (מ״מ)” are fully visible. */
const rtlHeaderAlign: Partial<ExcelJS.Alignment> = {
  horizontal: "right",
  vertical: "middle",
  readingOrder: "rtl",
  wrapText: true,
};

const rtlNumberAlign: Partial<ExcelJS.Alignment> = {
  horizontal: "right",
  vertical: "middle",
};

const INVALID_FILENAME_CHARS = /[\u0000-\u001f\\/:*?"<>|]/g;

function normalizeExportProjectTitle(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .replace(INVALID_FILENAME_CHARS, "")
    .replace(/\s+/g, " ")
    .replace(/^\.+|\.+$/g, "")
    .trim();
}

function hebrewCalendarDateForFilename(date: Date): string {
  return date.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function buildExcelDxfCompareDownloadBasename(projectName: string | undefined): string {
  const normalized = normalizeExportProjectTitle((projectName ?? "").trim());
  const title =
    normalized.length > 0 ? normalized : t(`${VT}.exportFilenameFallbackProject`);
  const dateLabel = hebrewCalendarDateForFilename(new Date());
  const sep = " - ";
  const maxLen = 180;
  let base = `${title}${sep}${dateLabel}`;
  if (base.length > maxLen) {
    const budget = Math.max(1, maxLen - dateLabel.length - sep.length);
    base = `${title.slice(0, budget).trim()}${sep}${dateLabel}`;
  }
  return base;
}

export type DownloadExcelDxfCompareOptions = {
  projectName?: string;
};

function mismatchFieldLabelHebrew(field: string): string {
  const map: Record<string, string> = {
    Length: `${VT}.mismatchLength`,
    Width: `${VT}.mismatchWidth`,
    Area: `${VT}.mismatchArea`,
    Weight: `${VT}.mismatchWeight`,
    Material: `${VT}.mismatchMaterial`,
    "DXF file not found": `${VT}.mismatchDxfNotFound`,
  };
  const key = map[field];
  return key ? t(key) : field;
}

function mismatchFieldsHebrew(row: ValidationRow): string {
  return row.mismatchFields.map(mismatchFieldLabelHebrew).join(" · ");
}

function tooltipReasonText(row: ValidationRow): string {
  if (row.mismatchFields.length === 0) return t(`${VT}.tooltipReasonMatch`);
  return t(`${VT}.tooltipReasonMismatch`, { fields: mismatchFieldsHebrew(row) });
}

function tooltipActionText(row: ValidationRow): string {
  if (row.status === "error") return t(`${VT}.tooltipActionError`);
  if (row.status === "warning") return t(`${VT}.tooltipActionWarning`);
  return t(`${VT}.tooltipActionOk`);
}

/** Single line — no newlines so row height stays uniform (wrap off). */
function rowNotesHebrewSingleLine(row: ValidationRow): string {
  const parts: string[] = [];
  if (row.mismatchFields.length > 0) {
    parts.push(`${t(`${VT}.tooltipMismatchTitle`)}: ${mismatchFieldsHebrew(row)}`);
  }
  parts.push(`${t(`${VT}.tooltipReasonTitle`)}: ${tooltipReasonText(row)}`);
  parts.push(`${t(`${VT}.tooltipActionTitle`)}: ${tooltipActionText(row)}`);
  return parts.join(" · ");
}

/** Excel status column: binary תקין / לא תקין (colors still reflect valid / warning / error). */
function statusExcelBinaryLabel(status: ValidationRowStatus): string {
  return status === "valid"
    ? t(`${VT}.exportStatusOk`)
    : t(`${VT}.exportStatusNotOk`);
}

function markDxfMismatchCell(
  excelRow: ExcelJS.Row,
  col: number,
  asNumber: boolean,
  numFmt?: string
) {
  const c = excelRow.getCell(col);
  c.fill = MISMATCH_FILL;
  c.font = { ...MISMATCH_FONT };
  setBottomRuleOnly(c);
  if (asNumber && numFmt) {
    c.numFmt = numFmt;
    c.alignment = rtlNumberAlign;
  } else {
    c.alignment = rtlTextAlignWrap;
  }
}

function applyDxfMismatchFills(
  excelRow: ExcelJS.Row,
  r: ValidationRow,
  colDxfLength: number,
  colDxfWidth: number,
  colDxfArea: number,
  colDxfWeight: number,
  colDxfMaterial: number
) {
  if (r.excelLengthMm !== r.dxfLengthMm) {
    markDxfMismatchCell(excelRow, colDxfLength, true, "0.0");
  }
  if (r.excelWidthMm !== r.dxfWidthMm) {
    markDxfMismatchCell(excelRow, colDxfWidth, true, "0.0");
  }
  if (Math.abs(r.excelAreaM2 - r.dxfAreaM2) > 0.001) {
    markDxfMismatchCell(excelRow, colDxfArea, true, "0.000");
  }
  if (Math.abs(r.excelWeightKg - r.dxfWeightKg) > 0.05) {
    markDxfMismatchCell(excelRow, colDxfWeight, true, "0.0");
  }
  if (r.excelMaterial !== r.dxfMaterial) {
    markDxfMismatchCell(excelRow, colDxfMaterial, false);
  }
}

function setBottomRuleOnly(cell: ExcelJS.Cell) {
  cell.border = { bottom: BOTTOM_RULE };
}

function styleHeaderCell(cell: ExcelJS.Cell) {
  cell.fill = HEADER_FILL;
  cell.font = { ...DEFAULT_FONT, bold: true };
  cell.alignment = rtlHeaderAlign;
  setBottomRuleOnly(cell);
}

function styleBodyTextCell(cell: ExcelJS.Cell) {
  cell.font = DEFAULT_FONT;
  cell.alignment = rtlTextAlignWrap;
  setBottomRuleOnly(cell);
}

function styleBodyNumberCell(cell: ExcelJS.Cell, numFmt: string) {
  cell.font = DEFAULT_FONT;
  cell.alignment = rtlNumberAlign;
  cell.numFmt = numFmt;
  setBottomRuleOnly(cell);
}

function styleNotesCell(cell: ExcelJS.Cell) {
  cell.font = DEFAULT_FONT;
  cell.alignment = rtlTextAlignNoWrap;
  setBottomRuleOnly(cell);
}

function styleStatusCell(cell: ExcelJS.Cell, status: ValidationRowStatus) {
  const s = STATUS_STYLES[status];
  cell.font = { ...s.font };
  cell.alignment = rtlTextAlignNoWrap;
  cell.fill = s.fill;
  setBottomRuleOnly(cell);
}

export async function downloadExcelDxfCompareXlsx(
  rows: ValidationRow[],
  options?: DownloadExcelDxfCompareOptions
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Plate";
  const sheetName = t("quote.dxfPhase.excelDxfCompare.exportXlsxSheetName");
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31), {
    views: [{ rightToLeft: true, showGridLines: true }],
  });

  const headers = [
    t(`${VT}.exportColPartName`),
    t(`${VT}.exportColQty`),
    t(`${VT}.exportColThickness`),
    t(`${VT}.exportColExcelLength`),
    t(`${VT}.exportColDxfLength`),
    t(`${VT}.exportColExcelWidth`),
    t(`${VT}.exportColDxfWidth`),
    t(`${VT}.exportColExcelArea`),
    t(`${VT}.exportColDxfArea`),
    t(`${VT}.exportColExcelWeight`),
    t(`${VT}.exportColDxfWeight`),
    t(`${VT}.exportColExcelMaterial`),
    t(`${VT}.exportColDxfMaterial`),
    t(`${VT}.colStatus`),
    t(`${VT}.colNotes`),
  ];

  COL_WIDTHS.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });
  sheet.getColumn(1).width = MAIN_COL_WIDTH;

  const headerRow = sheet.addRow(headers);
  headerRow.height = 54;
  headerRow.eachCell((cell, colNumber) => {
    if (colNumber >= 1 && colNumber <= headers.length) {
      styleHeaderCell(cell);
    }
  });

  const C = {
    dxfL: 5,
    dxfW: 7,
    dxfA: 9,
    dxfWt: 11,
    dxfMat: 13,
  } as const;

  const thkFmt = (r: ValidationRow) => (r.thicknessMm % 1 === 0 ? "0" : "0.00");

  for (const r of rows) {
    const excelRow = sheet.addRow([
      r.partName,
      Math.max(1, Math.floor(Number(r.qty)) || 1),
      r.thicknessMm,
      r.excelLengthMm,
      r.dxfLengthMm,
      r.excelWidthMm,
      r.dxfWidthMm,
      r.excelAreaM2,
      r.dxfAreaM2,
      r.excelWeightKg,
      r.dxfWeightKg,
      r.excelMaterial,
      r.dxfMaterial,
      statusExcelBinaryLabel(r.status),
      rowNotesHebrewSingleLine(r),
    ]);

    styleBodyTextCell(excelRow.getCell(1));
    styleBodyNumberCell(excelRow.getCell(2), "0");
    styleBodyNumberCell(excelRow.getCell(3), thkFmt(r));
    for (const col of [4, 5, 6, 7] as const) {
      styleBodyNumberCell(excelRow.getCell(col), "0.0");
    }
    styleBodyNumberCell(excelRow.getCell(8), "0.000");
    styleBodyNumberCell(excelRow.getCell(9), "0.000");
    styleBodyNumberCell(excelRow.getCell(10), "0.0");
    styleBodyNumberCell(excelRow.getCell(11), "0.0");
    styleBodyTextCell(excelRow.getCell(12));
    styleBodyTextCell(excelRow.getCell(13));
    styleStatusCell(excelRow.getCell(STATUS_COL), r.status);
    styleNotesCell(excelRow.getCell(NOTES_COL));

    applyDxfMismatchFills(excelRow, r, C.dxfL, C.dxfW, C.dxfA, C.dxfWt, C.dxfMat);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${buildExcelDxfCompareDownloadBasename(options?.projectName)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
