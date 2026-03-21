// ─── Core Domain Types ──────────────────────────────────────────────────────

export type BatchStatus = "draft" | "active" | "completed" | "archived";

export interface Batch {
  id: string;
  name: string;
  notes?: string;
  status: BatchStatus;
  clientIds: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Client ─────────────────────────────────────────────────────────────────

export interface Client {
  id: string;
  batchId: string;
  fullName: string;
  /** Auto-generated unique 3-char uppercase code within this batch */
  code: string;
  uploadedFileIds: string[];
  createdAt: string;
}

// ─── Uploaded File ───────────────────────────────────────────────────────────

export type FileType = "dxf" | "excel";

export type FileParseStatus = "pending" | "parsing" | "parsed" | "error";

export interface UploadedFile {
  id: string;
  clientId: string;
  batchId: string;
  name: string;
  type: FileType;
  sizeBytes: number;
  parseStatus: FileParseStatus;
  parseError?: string;
  /** How many rows/entities were successfully extracted */
  parsedRowCount?: number;
  /** Non-fatal warnings from parsing (e.g. unrecognized columns) */
  parseWarnings?: string[];
  uploadedAt: string;
  /** Raw file content as base64 or ArrayBuffer reference — stored separately */
  dataKey: string;
}

// ─── Excel Parsing ───────────────────────────────────────────────────────────

export interface ExcelRow {
  id: string;
  fileId: string;
  clientId: string;
  batchId: string;
  partName: string;
  quantity: number;
  thickness?: number;
  material?: string;
  width?: number;    // mm
  length?: number;   // mm
  area?: number;     // m²
  weight?: number;   // kg (unit weight)
  totalWeight?: number; // kg (weight × qty)
  rawRow: Record<string, unknown>;
}

// ─── DXF Parsing ─────────────────────────────────────────────────────────────

export interface DxfEntity {
  type: string;
  layer?: string;
  [key: string]: unknown;
}

// ─── Phase 2A: Processed Geometry ────────────────────────────────────────────

export type GeometryStatus = "valid" | "warning" | "error";

export interface ProcessedGeometry {
  /** Outer boundary vertices [x, y] in mm */
  outer: [number, number][];
  /** Inner cut-out holes — each is an array of [x, y] points in mm */
  holes: [number, number][][];
  /** Net area (outer − holes) in mm² */
  area: number;
  /** Outer boundary perimeter (cut length) in mm */
  perimeter: number;
  /** Axis-aligned bounding box in mm */
  boundingBox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
  /** True when geometry is usable for nesting */
  isValid: boolean;
  /** Quality status */
  status: GeometryStatus;
  /** Human-readable detail for warning / error */
  statusMessage?: string;
}

export interface DxfPartGeometry {
  id: string;
  fileId: string;
  clientId: string;
  batchId: string;
  /** Filename without extension, used as guessed part name */
  guessedPartName: string;
  entityCount: number;
  layers: string[];
  /**
   * Parsed DXF entities. Omitted from localStorage (empty array) to save space;
   * re-built from uploaded file text when running `reprocessDxfGeometry`.
   */
  entities: DxfEntity[];
  /** Raw bounding box from Phase 1 entity scan */
  boundingBox?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  /** Phase 2A: fully processed geometry — null if processing failed or not yet run */
  processedGeometry: ProcessedGeometry | null;
}

// ─── Match Status ─────────────────────────────────────────────────────────────

export type MatchStatus = "matched" | "unmatched" | "needs_review";

// ─── Unified Part ─────────────────────────────────────────────────────────────

export interface Part {
  id: string;
  batchId: string;
  clientId: string;
  clientCode: string;
  clientName: string;
  partName: string;
  quantity?: number;
  thickness?: number;
  material?: string;
  width?: number;
  length?: number;
  area?: number;
  weight?: number;
  totalWeight?: number;
  /** ID of matched DXF file, if any */
  dxfFileId?: string;
  dxfFileName?: string;
  dxfStatus: "present" | "missing";
  /** ID of matched Excel row, if any */
  excelRowId?: string;
  excelStatus: "present" | "missing";
  matchStatus: MatchStatus;
  // ── Phase 2A: DXF geometry fields ──────────────────────────────────────
  /** Net area from DXF geometry in mm² */
  dxfArea?: number;
  /** Outer perimeter (cut length) from DXF geometry in mm */
  dxfPerimeter?: number;
  /** Axis-aligned bounding width from DXF geometry (mm) */
  dxfWidthMm?: number;
  /** Axis-aligned bounding height from DXF geometry (mm) */
  dxfLengthMm?: number;
  /** Geometry processing status */
  geometryStatus?: GeometryStatus;
}

// ─── Excel Column Mapping ─────────────────────────────────────────────────────

export interface ColumnMapping {
  /** Index of the column to use as part name (required) */
  partNameCol: number;
  /** Index of the quantity column — null means default to 1 */
  qtyCol: number | null;
  /** Index of the thickness column — null means omit */
  thkCol: number | null;
  /** Index of the material column — null means omit */
  matCol: number | null;
  /** Index of the width column (mm) */
  widthCol: number | null;
  /** Index of the length column (mm) */
  lengthCol: number | null;
  /** Index of the area column (m²) */
  areaCol: number | null;
  /** Index of the unit weight column (kg) */
  weightCol: number | null;
  /** Index of the total weight column (kg) */
  totalWeightCol: number | null;
  /** Which row the headers were found on (0-based) */
  headerRowIdx: number;
}

// ─── Zod Schemas (for forms) — re-exported via features ─────────────────────

export type CreateBatchInput = {
  name: string;
  notes?: string;
};

export type AddClientInput = {
  fullName: string;
};
