import * as XLSX from "xlsx";
import type { ColumnMapping, ExcelRow } from "@/types";
import { normalizeDxfFileHint } from "@/lib/matching/matcher";

// ─── Column name aliases (all lowercase, no diacritics) ──────────────────────

const PART_NAME_KEYS_BASE = [
  // English
  "part name", "partname", "part no", "part number", "part_name", "part",
  "description", "desc", "item name", "item", "name",
  "component", "reference", "ref", "code", "article",
  "pn", "p/n",
  // "POS" / "position" — very common in engineering BOMs (German/international style)
  "pos", "position", "pos.", "pos no", "pos nr",
  // Portuguese / Spanish
  "componente", "desenho", "peca", "referencia", "codigo",
  "artigo", "designacao", "numero",
  // German
  "bezeichnung", "benennung", "pos nr", "lfd nr",
];

const QUANTITY_KEYS_BASE = [
  // Standard
  "qty", "quantity", "count", "pcs", "pieces", "amount", "num", "number",
  // Typos / variants seen in the wild
  "qyt", "qyt.", "q.ty", "qty.", "no of pcs", "no. of pcs",
  // Portuguese / Spanish
  "quantidade", "qtd", "qtde",
  // German
  "anzahl", "menge",
  // Other
  "pieces required", "req qty", "total qty", "total pcs", "nos",
];

const THICKNESS_KEYS_BASE = [
  "thickness", "espessura", "thk", "th", "thick",
  "gauge", "esp", "wall", "wall thickness", "dicke", "spessore",
  "plate thk", "plate thickness",
];

const MATERIAL_KEYS_BASE = [
  "material", "mat", "matl", "grade", "type",
  "steel grade", "alloy", "metal", "material type",
  "specification", "spec", "material grade", "werkstoff", "materiale",
  "liga", "tipo",
];

const FINISH_KEYS_BASE = [
  "finish", "surface", "coating", "treatment", "surface treatment",
  "galvanized", "paint", "carbon", "finish type", "acabamento", "oberflache",
];

const WIDTH_KEYS_BASE = [
  "width", "largura", "breite", "width (mm)", "width(mm)",
  "w", "wd", "wid",
];

const LENGTH_KEYS_BASE = [
  "length", "comprimento", "länge", "length (mm)", "length(mm)",
  "length (m)", "length(m)", "len", "l",
];

const AREA_KEYS_BASE = [
  "area", "área", "area (m2)", "area(m2)", "area m2",
  "area t (m2)", "area t(m2)", "surface", "superficie",
  "flache", "fläche",
];

const WEIGHT_KEYS_BASE = [
  "weight", "peso", "gewicht", "weight (kg)", "weight(kg)",
  "wieght (kg)", "wieght(kg)", "unit weight", "kg",
  "mass", "massa",
];

const TOTAL_WEIGHT_KEYS_BASE = [
  "total weight", "total weight (kg)", "total weight(kg)",
  "peso total", "wieght t (kg)", "wieght t(kg)", "weight t",
  "total kg", "total mass", "gesamtgewicht",
];

/** Column headers that identify a DXF / drawing filename for row↔file linking */
const DXF_FILE_KEYS_BASE = [
  "dxf file", "dxf name", "dxf filename", "dxf", "cad file", "cad drawing",
  "drawing file", "drawing name", "drawing no", "drawing number", "dwg file",
  "filename", "file name", "nc file", "plate dxf", "ficheiro dxf", "arquivo dxf",
  "desenho", "zeichnung",
];

/** Hebrew (and mixed) column titles — matched after {@link normalizeHeader} */
const PART_NAME_KEYS_HE = [
  "שם חלק",
  "שם החלק",
  "שם פריט",
  "שם המוצר",
  "מספר חלק",
  "מספר פריט",
  "מספר מוצר",
  "תיאור פריט",
  "תיאור",
  "מזהה פריט",
  "מזהה",
  "מקט",
  "מספר שרטוט",
  "מספר תכנית",
  "פריט",
  "קוד פריט",
];

const QUANTITY_KEYS_HE = [
  "כמות",
  "כמות נדרשת",
  "כמות בפועל",
  "מספר יחידות",
  "יחידות",
];

const THICKNESS_KEYS_HE = [
  "עובי",
  "עובי ממ",
  "עובי (ממ)",
  "עובי בממ",
  "עובי פלטה",
];

const MATERIAL_KEYS_HE = [
  "חומר",
  "דרגה",
  "דרגת פלדה",
  "סיווג מתכת",
  "סוג חומר",
  "מתכת",
];

const FINISH_KEYS_HE = [
  "גימור",
  "טיפול שטח",
  "ציפוי",
];

const WIDTH_KEYS_HE = [
  "רוחב",
  "רוחב ממ",
  "רוחב (ממ)",
  "רוחב בממ",
];

const LENGTH_KEYS_HE = [
  "אורך",
  "אורך ממ",
  "אורך (ממ)",
  "אורך בממ",
];

const AREA_KEYS_HE = [
  "שטח",
  "שטח מר",
  "שטח במר",
];

const WEIGHT_KEYS_HE = [
  "משקל",
  "משקל קג",
  "משקל (קג)",
  "משקל ליחידה",
  "משקל יחידה",
];

const TOTAL_WEIGHT_KEYS_HE = [
  "משקל כולל",
  "סהכ משקל",
  "סה\"כ משקל",
  "משקל כללי",
];

const DXF_FILE_KEYS_HE = [
  "קובץ dxf",
  "שם קובץ",
  "קובץ שרטוט",
  "שרטוט",
  "שם שרטוט",
  "קובץ cad",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Lowercase + trim + collapse whitespace + strip diacritics + bidi marks (Excel RTL) */
function normalizeHeader(h: unknown): string {
  return String(h ?? "")
    .normalize("NFD")               // decompose accented chars → base + combining
    .replace(/[\u0300-\u036f]/g, "") // remove combining diacritical marks
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "") // strip bidi / isolate marks from Excel
    .toLowerCase()
    .trim()
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ");
}

const PART_NAME_KEYS = [...PART_NAME_KEYS_BASE, ...PART_NAME_KEYS_HE];
const QUANTITY_KEYS = [...QUANTITY_KEYS_BASE, ...QUANTITY_KEYS_HE];
const THICKNESS_KEYS = [...THICKNESS_KEYS_BASE, ...THICKNESS_KEYS_HE];
const MATERIAL_KEYS = [...MATERIAL_KEYS_BASE, ...MATERIAL_KEYS_HE];
const FINISH_KEYS = [...FINISH_KEYS_BASE, ...FINISH_KEYS_HE];
const WIDTH_KEYS = [...WIDTH_KEYS_BASE, ...WIDTH_KEYS_HE];
const LENGTH_KEYS = [...LENGTH_KEYS_BASE, ...LENGTH_KEYS_HE];
const AREA_KEYS = [...AREA_KEYS_BASE, ...AREA_KEYS_HE];
const WEIGHT_KEYS = [...WEIGHT_KEYS_BASE, ...WEIGHT_KEYS_HE];
const TOTAL_WEIGHT_KEYS = [...TOTAL_WEIGHT_KEYS_BASE, ...TOTAL_WEIGHT_KEYS_HE];
const DXF_FILE_KEYS = [...DXF_FILE_KEYS_BASE, ...DXF_FILE_KEYS_HE];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findColumn(headers: string[], aliases: string[]): number {
  // 1. Exact match
  for (let i = 0; i < headers.length; i++) {
    if (aliases.includes(headers[i])) return i;
  }
  // 2. Header starts with alias (e.g. "part number (mm)" starts with "part number")
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (h && aliases.some((a) => a.length >= 3 && h.startsWith(a))) return i;
  }
  // 3. Alias is contained in header as a whole word (aliases may include parens — escape for RegExp)
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (
      h &&
      aliases.some((a) => {
        if (a.length < 3) return false; // skip very short aliases for safety
        const re = new RegExp(`(^|\\s|_)${escapeRegExp(a)}(\\s|_|$)`);
        return re.test(h);
      })
    )
      return i;
  }
  return -1;
}

function countNonEmptyCells(row: unknown[]): number {
  return row.filter((c) => String(c ?? "").trim() !== "").length;
}

/**
 * Pick the sheet row that holds column titles: prefer rows that match known (EN/HE) headers;
 * if none match, use the row with the most non-empty cells (Hebrew-only sheets, title rows above table).
 */
function pickHeaderRowIndex(raw: unknown[][]): number {
  let headerRowIdx = 0;
  let bestScore = 0;
  const limit = Math.min(15, raw.length);
  for (let i = 0; i < limit; i++) {
    const norm = (raw[i] as unknown[]).map(normalizeHeader);
    let score = 0;
    if (findColumn(norm, PART_NAME_KEYS) >= 0) score += 3;
    if (findColumn(norm, QUANTITY_KEYS) >= 0) score += 2;
    if (findColumn(norm, THICKNESS_KEYS) >= 0) score += 1;
    if (findColumn(norm, MATERIAL_KEYS) >= 0) score += 1;
    if (score > bestScore) {
      bestScore = score;
      headerRowIdx = i;
    }
  }
  if (bestScore === 0 && raw.length > 0) {
    let bestNonEmpty = -1;
    let bestIdx = 0;
    for (let i = 0; i < limit; i++) {
      const n = countNonEmptyCells(raw[i] as unknown[]);
      if (n > bestNonEmpty) {
        bestNonEmpty = n;
        bestIdx = i;
      }
    }
    if (bestNonEmpty > 0) headerRowIdx = bestIdx;
  }
  return headerRowIdx;
}

/** Part names that indicate a summary / total / header bleed row — skip them */
const SKIP_PART_NAMES = new Set([
  "total", "totals", "subtotal", "grand total", "sum", "total geral",
  "totaal", "gesamt", "summe", "sous-total", "pos", "position",
  "part name", "partname", "description", "item", "name", "component",
  "qty", "quantity", "pcs", "pieces",
]);

function shouldSkipRow(partName: string): boolean {
  const lower = partName.toLowerCase().trim();
  if (SKIP_PART_NAMES.has(lower)) return true;
  // Pure numbers are likely row/index numbers, not part names
  if (/^\d+$/.test(lower)) return true;
  // Very short (1 char) non-alphanumeric
  if (lower.length <= 1) return true;
  return false;
}

function parseNumber(val: unknown): number | undefined {
  if (val === null || val === undefined || val === "") return undefined;
  if (typeof val === "number") return isNaN(val) ? undefined : val;
  // Handle strings like "3,5" or "3.5" or " 3 "
  const n = parseFloat(
    String(val).trim().replace(/[^\d.,-]/g, "").replace(",", ".")
  );
  return isNaN(n) ? undefined : n;
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export interface ExcelParseResult {
  rows: Omit<ExcelRow, "id">[];
  warnings: string[];
  sheetName: string;
  totalRawRows: number;
  rawHeaders: string[];        // actual header strings from the file
  detectedColumns: {
    partName: string | null;
    quantity: string | null;
    thickness: string | null;
    material: string | null;
  };
}

export async function parseExcelFile(
  arrayBuffer: ArrayBuffer,
  fileId: string,
  clientId: string,
  batchId: string
): Promise<ExcelParseResult> {
  const warnings: string[] = [];

  let workbook: XLSX.WorkBook;
  try {
    // Must pass Uint8Array — raw ArrayBuffer is not accepted by xlsx 0.18.x
    const uint8 = new Uint8Array(arrayBuffer);
    workbook = XLSX.read(uint8, { type: "array" });
  } catch (err) {
    throw new Error(
      `Failed to open file: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      rows: [], warnings: ["No sheets found"], sheetName: "",
      totalRawRows: 0, rawHeaders: [], detectedColumns: { partName: null, quantity: null, thickness: null, material: null },
    };
  }

  const sheet = workbook.Sheets[sheetName];

  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: true,
  });

  if (raw.length < 1) {
    return {
      rows: [], warnings: ["Sheet is empty"], sheetName,
      totalRawRows: 0, rawHeaders: [], detectedColumns: { partName: null, quantity: null, thickness: null, material: null },
    };
  }

  const headerRowIdx = pickHeaderRowIndex(raw);

  const rawHeaderCells = raw[headerRowIdx] as unknown[];
  const headerRowNorm = rawHeaderCells.map(normalizeHeader);
  const rawHeaders = rawHeaderCells.map((h) => String(h ?? "").trim());

  const partColIdx  = findColumn(headerRowNorm, PART_NAME_KEYS);
  const qtyColIdx   = findColumn(headerRowNorm, QUANTITY_KEYS);
  const thkColIdx   = findColumn(headerRowNorm, THICKNESS_KEYS);
  const matColIdx   = findColumn(headerRowNorm, MATERIAL_KEYS);

  const detectedColumns = {
    partName:  partColIdx  >= 0 ? rawHeaders[partColIdx]  : null,
    quantity:  qtyColIdx   >= 0 ? rawHeaders[qtyColIdx]   : null,
    thickness: thkColIdx   >= 0 ? rawHeaders[thkColIdx]   : null,
    material:  matColIdx   >= 0 ? rawHeaders[matColIdx]   : null,
  };

  const nothingDetected = partColIdx < 0 && qtyColIdx < 0;
  const effectivePartCol = partColIdx >= 0 ? partColIdx : 0;
  const effectiveQtyCol  = qtyColIdx  >= 0 ? qtyColIdx  : 1;

  if (nothingDetected) {
    const shownHeaders = rawHeaders.filter(Boolean).join(", ");
    warnings.push(
      `No recognised column headers found (after diacritic removal). ` +
      `Detected headers in row ${headerRowIdx + 1}: [${shownHeaders || "none"}]. ` +
      `Falling back: col 0 = part name, col 1 = quantity.`
    );
  } else {
    if (partColIdx < 0)
      warnings.push(`Part name column not found. Found: [${rawHeaders.filter(Boolean).join(", ")}]`);
    if (qtyColIdx < 0)
      warnings.push("Quantity column not found — defaulting to 1");
  }

  // ── Extract data rows ─────────────────────────────────────────────────────
  // Always skip the header row itself (even in fallback mode — header row was found by scoring)
  const dataStartIdx = headerRowIdx + 1;
  const dataRows = raw.slice(dataStartIdx) as unknown[][];
  const rows: Omit<ExcelRow, "id">[] = [];

  for (const rawRow of dataRows) {
    const cells = rawRow as unknown[];
    if (cells.every((c) => c === "" || c === null || c === undefined)) continue;

    const partName = String(cells[effectivePartCol] ?? "").trim();
    if (!partName) continue;
    if (shouldSkipRow(partName)) continue;

    const quantity  = parseNumber(cells[effectiveQtyCol]);
    const thickness = thkColIdx >= 0 ? parseNumber(cells[thkColIdx]) : undefined;
    const material  = matColIdx >= 0
      ? String(cells[matColIdx] ?? "").trim() || undefined
      : undefined;

    const rawRecord: Record<string, unknown> = {};
    rawHeaders.forEach((h, i) => { if (h) rawRecord[h] = cells[i]; });

    rows.push({
      fileId, clientId, batchId,
      partName,
      quantity: quantity ?? 1,
      thickness,
      material,
      rawRow: rawRecord,
    });
  }

  if (rows.length === 0) {
    warnings.push(
      `0 rows extracted. Header row: ${headerRowIdx + 1}. ` +
      `Data rows scanned: ${dataRows.length}. ` +
      `Part col: ${partColIdx} (${detectedColumns.partName ?? "not found"}). ` +
      `Headers: [${rawHeaders.filter(Boolean).join(", ")}]`
    );
  }

  return { rows, warnings, sheetName, totalRawRows: dataRows.length, rawHeaders, detectedColumns };
}

/**
 * Rows that {@link parseExcelFileWithMapping} would emit: non-empty row, non-empty part name,
 * and not filtered by {@link shouldSkipRow}. Uses the same `headerRowIdx` and `partNameCol` as `mapping`.
 */
function countEligibleRowsFromRaw(raw: unknown[][], mapping: ColumnMapping): number {
  const hdr = mapping.headerRowIdx;
  if (hdr < 0 || hdr >= raw.length) return 0;
  const dataRows = raw.slice(hdr + 1) as unknown[][];
  let n = 0;
  for (const rawRow of dataRows) {
    const cells = rawRow as unknown[];
    if (cells.every((c) => c === "" || c === null || c === undefined)) continue;

    const partName = String(cells[mapping.partNameCol] ?? "").trim();
    if (!partName) continue;
    if (shouldSkipRow(partName)) continue;
    n++;
  }
  return n;
}

/** Same row counting rules as parsing — for badges / UX before full parse. */
export function countEligibleExcelDataRows(
  arrayBuffer: ArrayBuffer,
  mapping: ColumnMapping
): number {
  const uint8 = new Uint8Array(arrayBuffer);
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(uint8, { type: "array" });
  } catch {
    return 0;
  }
  const sheetName = workbook.SheetNames[0] ?? "";
  if (!sheetName) return 0;
  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: true,
  });
  return countEligibleRowsFromRaw(raw, mapping);
}

// ─── readExcelHeaders ─────────────────────────────────────────────────────────
// Lightweight: open workbook, find header row, return structure + preview rows.
// Does NOT extract data rows — used to populate the mapping dialog.

export interface ExcelHeadersResult {
  rawHeaders: string[];
  headerRowIdx: number;
  sheetName: string;
  /** First 5 data rows (raw cell values) for the preview table */
  previewRows: unknown[][];
  /** Rows in sheet below detected header (before filtering); for UI summaries */
  dataRowCount: number;
  /** Rows that would parse with {@link autoDetected} (non-empty + valid part name) */
  eligibleDataRowCount: number;
  /** Best auto-detected mapping using the alias lists */
  autoDetected: ColumnMapping;
}

export function readExcelHeaders(arrayBuffer: ArrayBuffer): ExcelHeadersResult {
  const uint8 = new Uint8Array(arrayBuffer);
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(uint8, { type: "array" });
  } catch (err) {
    throw new Error(
      `Failed to open file: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const sheetName = workbook.SheetNames[0] ?? "";
  if (!sheetName) {
    return {
      rawHeaders: [],
      headerRowIdx: 0,
      sheetName: "",
      previewRows: [],
      dataRowCount: 0,
      eligibleDataRowCount: 0,
      autoDetected: {
        partNameCol: 0, qtyCol: null, thkCol: null, matCol: null, finishCol: null,
        widthCol: null, lengthCol: null, areaCol: null, weightCol: null,
        totalWeightCol: null, dxfFileCol: null, headerRowIdx: 0,
      },
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1, defval: "", blankrows: false, raw: true,
  });

  const headerRowIdx = pickHeaderRowIndex(raw);

  const rawHeaderCells = (raw[headerRowIdx] as unknown[]) ?? [];
  const rawHeaders = rawHeaderCells.map((h) => String(h ?? "").trim());
  const norm = rawHeaders.map(normalizeHeader);

  const partColIdx        = findColumn(norm, PART_NAME_KEYS);
  const qtyColIdx         = findColumn(norm, QUANTITY_KEYS);
  const thkColIdx         = findColumn(norm, THICKNESS_KEYS);
  const matColIdx         = findColumn(norm, MATERIAL_KEYS);
  const finishColIdx      = findColumn(norm, FINISH_KEYS);
  const widthColIdx       = findColumn(norm, WIDTH_KEYS);
  const lengthColIdx      = findColumn(norm, LENGTH_KEYS);
  const areaColIdx        = findColumn(norm, AREA_KEYS);
  const weightColIdx      = findColumn(norm, WEIGHT_KEYS);
  const totalWeightColIdx = findColumn(norm, TOTAL_WEIGHT_KEYS);
  const dxfFileColIdx     = findColumn(norm, DXF_FILE_KEYS);

  const autoDetected: ColumnMapping = {
    partNameCol:    partColIdx        >= 0 ? partColIdx        : 0,
    qtyCol:         qtyColIdx         >= 0 ? qtyColIdx         : null,
    thkCol:         thkColIdx         >= 0 ? thkColIdx         : null,
    matCol:         matColIdx         >= 0 ? matColIdx         : null,
    finishCol:      finishColIdx      >= 0 ? finishColIdx      : null,
    widthCol:       widthColIdx       >= 0 ? widthColIdx       : null,
    lengthCol:      lengthColIdx      >= 0 ? lengthColIdx      : null,
    areaCol:        areaColIdx        >= 0 ? areaColIdx        : null,
    weightCol:      weightColIdx      >= 0 ? weightColIdx      : null,
    totalWeightCol: totalWeightColIdx >= 0 ? totalWeightColIdx : null,
    dxfFileCol:     dxfFileColIdx     >= 0 ? dxfFileColIdx     : null,
    headerRowIdx,
  };

  const previewRows = (raw.slice(headerRowIdx + 1, headerRowIdx + 6) as unknown[][]);
  const dataRowCount = Math.max(0, raw.length - headerRowIdx - 1);
  const eligibleDataRowCount = countEligibleRowsFromRaw(raw, autoDetected);

  return {
    rawHeaders,
    headerRowIdx,
    sheetName,
    previewRows,
    dataRowCount,
    eligibleDataRowCount,
    autoDetected,
  };
}

// ─── parseExcelFileWithMapping ────────────────────────────────────────────────
// Uses exact column indices supplied by the user — no alias guessing.

export async function parseExcelFileWithMapping(
  arrayBuffer: ArrayBuffer,
  mapping: ColumnMapping,
  fileId: string,
  clientId: string,
  batchId: string
): Promise<ExcelParseResult> {
  const uint8 = new Uint8Array(arrayBuffer);
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(uint8, { type: "array" });
  } catch (err) {
    throw new Error(
      `Failed to open file: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const sheetName = workbook.SheetNames[0] ?? "";
  if (!sheetName) {
    return {
      rows: [], warnings: ["No sheets found"], sheetName: "",
      totalRawRows: 0, rawHeaders: [],
      detectedColumns: { partName: null, quantity: null, thickness: null, material: null },
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1, defval: "", blankrows: false, raw: true,
  });

  const rawHeaderCells = (raw[mapping.headerRowIdx] as unknown[]) ?? [];
  const rawHeaders = rawHeaderCells.map((h) => String(h ?? "").trim());

  const detectedColumns = {
    partName:  rawHeaders[mapping.partNameCol] ?? null,
    quantity:  mapping.qtyCol         != null ? rawHeaders[mapping.qtyCol]         ?? null : null,
    thickness: mapping.thkCol         != null ? rawHeaders[mapping.thkCol]         ?? null : null,
    material:  mapping.matCol         != null ? rawHeaders[mapping.matCol]         ?? null : null,
  };

  const dataRows = (raw.slice(mapping.headerRowIdx + 1) as unknown[][]);
  const rows: Omit<ExcelRow, "id">[] = [];
  const warnings: string[] = [];

  for (const rawRow of dataRows) {
    const cells = rawRow as unknown[];
    if (cells.every((c) => c === "" || c === null || c === undefined)) continue;

    const partName = String(cells[mapping.partNameCol] ?? "").trim();
    if (!partName) continue;
    if (shouldSkipRow(partName)) continue;

    const quantity    = mapping.qtyCol         != null ? parseNumber(cells[mapping.qtyCol])         : undefined;
    const thickness   = mapping.thkCol         != null ? parseNumber(cells[mapping.thkCol])         : undefined;
    const material    = mapping.matCol         != null ? String(cells[mapping.matCol] ?? "").trim() || undefined : undefined;
    const finish      = mapping.finishCol      != null ? String(cells[mapping.finishCol] ?? "").trim() || undefined : undefined;
    const width       = mapping.widthCol       != null ? parseNumber(cells[mapping.widthCol])       : undefined;
    const length      = mapping.lengthCol      != null ? parseNumber(cells[mapping.lengthCol])      : undefined;
    const area        = mapping.areaCol        != null ? parseNumber(cells[mapping.areaCol])        : undefined;
    const weight      = mapping.weightCol      != null ? parseNumber(cells[mapping.weightCol])      : undefined;
    const totalWeight = mapping.totalWeightCol != null ? parseNumber(cells[mapping.totalWeightCol]) : undefined;

    let dxfFileHintNormalized: string | undefined;
    if (mapping.dxfFileCol != null) {
      const rawHint = cells[mapping.dxfFileCol];
      const hintNorm = normalizeDxfFileHint(
        rawHint === null || rawHint === undefined ? "" : String(rawHint)
      );
      if (hintNorm) dxfFileHintNormalized = hintNorm;
    }

    const rawRecord: Record<string, unknown> = {};
    rawHeaders.forEach((h, i) => { if (h) rawRecord[h] = cells[i]; });

    rows.push({
      fileId, clientId, batchId,
      partName,
      ...(dxfFileHintNormalized ? { dxfFileHintNormalized } : {}),
      quantity: quantity ?? 1,
      thickness,
      material,
      ...(finish ? { finish } : {}),
      width,
      length,
      area,
      weight,
      totalWeight,
      corrugated: false,
      rawRow: rawRecord,
    });
  }

  if (rows.length === 0) {
    warnings.push(
      `0 rows extracted with current mapping. ` +
      `Part name col: "${detectedColumns.partName}". ` +
      `Data rows scanned: ${dataRows.length}.`
    );
  }

  return { rows, warnings, sheetName, totalRawRows: dataRows.length, rawHeaders, detectedColumns };
}
