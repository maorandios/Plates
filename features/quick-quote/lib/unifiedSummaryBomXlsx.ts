import ExcelJS from "exceljs";
import { t } from "@/lib/i18n";
import type { QuotePartRow } from "../types/quickQuote";
import { UNIFIED_SOURCE_REF } from "./mergeAllQuoteMethods";
import { splitMaterialGradeAndFinish } from "./plateFields";
import { formatUnifiedSourceForRow } from "./unifiedSourceColumnLabel";

const PP = "quote.partsPhase" as const;

const FONT_NAME = "Arial";

const DEFAULT_FONT: Partial<ExcelJS.Font> = {
  name: FONT_NAME,
  color: { argb: "FF000000" },
};

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF3F4F6" },
};

const BOTTOM_RULE: ExcelJS.Border = {
  style: "thin",
  color: { argb: "FFD1D5DB" },
};

const rtlTextAlignWrap: Partial<ExcelJS.Alignment> = {
  horizontal: "right",
  vertical: "middle",
  readingOrder: "rtl",
  wrapText: true,
};

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

const MAIN_COL_WIDTH = 46;

function finishLabel(code: string): string {
  const key = `quote.finishLabels.${code}`;
  const label = t(key);
  return label === key ? code : label;
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

function buildColumnWidths(showRef: boolean, showCorrugated: boolean): number[] {
  const rest = [10, 12, 14, 14, 14, 14, 16, 14];
  const withCorrugated = showCorrugated ? [...rest, 12] : rest;
  if (showRef) {
    return [22, MAIN_COL_WIDTH, ...withCorrugated];
  }
  return [MAIN_COL_WIDTH, ...withCorrugated];
}

/**
 * Excel BOM for unified summary (טבלת סיכום): same RTL / styling approach as DXF↔Excel compare export.
 * Columns match {@link PartBreakdownTable} (without preview/delete).
 */
export async function buildUnifiedSummaryBomXlsxBuffer(parts: QuotePartRow[]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Plate";
  const sheetName = t(`${PP}.exportBomSheetName`).slice(0, 31);
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ rightToLeft: true, showGridLines: true }],
  });

  const showRef = parts.some((p) => Boolean(p.sourceRef?.trim()));
  const showCorrugated =
    parts.some((p) => p.bendTemplateId != null) ||
    parts.some((p) =>
      (p.sourceRef ?? "")
        .split("·")
        .map((s) => s.trim())
        .includes(UNIFIED_SOURCE_REF.dxf)
    );
  const headers: string[] = [];
  if (showRef) headers.push(t(`${PP}.colReference`));
  headers.push(
    t(`${PP}.colPartNumber`),
    t(`${PP}.colQuantity`),
    t(`${PP}.colThickness`),
    t(`${PP}.colLength`),
    t(`${PP}.colWidth`),
    t(`${PP}.colArea`),
    t(`${PP}.colWeight`),
    t(`${PP}.colMaterialGrade`),
    t(`${PP}.colFinish`)
  );
  if (showCorrugated) headers.push(t(`${PP}.colCorrugated`));

  const widths = buildColumnWidths(showRef, showCorrugated);
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  const headerRow = sheet.addRow(headers);
  headerRow.height = 54;
  headerRow.eachCell((cell, colNumber) => {
    if (colNumber >= 1 && colNumber <= headers.length) {
      styleHeaderCell(cell);
    }
  });

  for (const p of parts) {
    const lineKg = p.weightKg * p.qty;
    const { grade, finish } = splitMaterialGradeAndFinish(p.material);
    const thkFmt = p.thicknessMm % 1 === 0 ? "0" : "0.00";

    const values: (string | number)[] = [];
    if (showRef) values.push(formatUnifiedSourceForRow(p));
    values.push(
      p.partName,
      Math.max(0, Math.floor(p.qty)),
      p.thicknessMm,
      p.lengthMm,
      p.widthMm,
      p.areaM2,
      lineKg,
      grade,
      finishLabel(finish)
    );
    if (showCorrugated) {
      const isDxf = (p.sourceRef ?? "")
        .split("·")
        .map((s) => s.trim())
        .includes(UNIFIED_SOURCE_REF.dxf);
      const corLabel =
        p.bendTemplateId != null || isDxf
          ? p.corrugated === true
            ? t("common.yes")
            : t("common.no")
          : "";
      values.push(corLabel);
    }

    const excelRow = sheet.addRow(values);
    let i = 1;
    if (showRef) {
      styleBodyTextCell(excelRow.getCell(i));
      i++;
    }
    styleBodyTextCell(excelRow.getCell(i));
    i++;
    styleBodyNumberCell(excelRow.getCell(i), "0");
    i++;
    styleBodyNumberCell(excelRow.getCell(i), thkFmt);
    i++;
    styleBodyNumberCell(excelRow.getCell(i), "0.00");
    i++;
    styleBodyNumberCell(excelRow.getCell(i), "0.00");
    i++;
    styleBodyNumberCell(excelRow.getCell(i), "0.000");
    i++;
    styleBodyNumberCell(excelRow.getCell(i), "0.00");
    i++;
    styleBodyTextCell(excelRow.getCell(i));
    i++;
    styleBodyTextCell(excelRow.getCell(i));
    if (showCorrugated) {
      i++;
      styleBodyTextCell(excelRow.getCell(i));
    }
  }

  const buf = await workbook.xlsx.writeBuffer();
  if (buf instanceof ArrayBuffer) return buf;
  const u8 = new Uint8Array(buf);
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}
