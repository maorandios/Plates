import type { CuttingMethod } from "./production";
import type { GeometryPreparation, GeometryCleanupStatus } from "./geometry";

export type {
  GeometryCleanupStatus,
  CleanedGeometryResult,
  ManufacturingGeometry,
  GeometryPreparation,
  DiscardedSketchEntity,
  MarkingLayerGeometry,
  PartGeometryPrepStatus,
} from "./geometry";

// ─── Core Domain Types ──────────────────────────────────────────────────────

export type BatchStatus = "draft" | "active" | "completed" | "archived";

export interface Batch {
  id: string;
  name: string;
  notes?: string;
  status: BatchStatus;
  clientIds: string[];
  /** Required for production rules; legacy batches default to laser on load. */
  cuttingMethod: CuttingMethod;
  createdAt: string;
  updatedAt: string;
}

// ─── Client (global directory) ───────────────────────────────────────────────

export type {
  Client,
  ClientStatus,
  ClientMetrics,
  BatchClientLink,
  ClientBatchHistoryRow,
} from "./clients";

// ─── Uploaded File ───────────────────────────────────────────────────────────

export type FileType = "dxf" | "excel";

export type FileParseStatus = "pending" | "parsing" | "parsed" | "error";

/** DXF drawing unit hint from header (INSUNITS etc.) — internal geometry stays mm. */
export type DxfDetectedDrawingUnit =
  | "mm"
  | "in"
  | "cm"
  | "m"
  | "ft"
  | "unitless"
  | "unknown";

export interface UploadedFile {
  id: string;
  clientId: string;
  batchId: string;
  name: string;
  type: FileType;
  /** Defaults to upload when omitted — Quick Plate Builder sets `built`. */
  sourceKind?: "upload" | "built";
  /** JSON string of parametric plate spec for reopening built plates. */
  builtPlateSpec?: string;
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
  /** DXF only: from `dxfUnitDetection` */
  detectedUnit?: DxfDetectedDrawingUnit;
  detectedUnitLabel?: string;
  detectedUnitSource?: "header" | "inferred" | "unknown";
}

// ─── Excel Parsing ───────────────────────────────────────────────────────────

export interface ExcelRow {
  id: string;
  fileId: string;
  clientId: string;
  batchId: string;
  partName: string;
  /**
   * When the BOM maps a column to the DXF/drawing filename, we store the same
   * normalization used for matching (basename without .dxf/.dwg, then name rules).
   */
  dxfFileHintNormalized?: string;
  quantity: number;
  thickness?: number;
  material?: string;
  width?: number;    // mm
  length?: number;   // mm
  /** Surface finish label or value from BOM (e.g. Carbon, Galvanized). */
  finish?: string;
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
  /**
   * Cleanup, contour reconstruction, classification, and manufacturing groupings.
   * Vertex arrays inside may be cleared when persisting (see store slimming).
   */
  preparation?: GeometryPreparation;
}

export interface DxfPartGeometry {
  id: string;
  fileId: string;
  clientId: string;
  batchId: string;
  /** Filename without extension, used as guessed part name */
  guessedPartName: string;
  /** Steel grade parsed from TEXT/MTEXT/blocks/layers (e.g. S355, ST-52) */
  materialGrade?: string;
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
  /** Quick Quote DXF review step: BOM quantity (default 1 when omitted). */
  reviewQuantity?: number;
  /** Quick Quote DXF review step: plate finish (default carbon when omitted). */
  reviewFinish?: "carbon" | "galvanized" | "paint";
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
  /** Pre-CAM preparation rollup (ready / warning / error) */
  geometryCleanupStatus?: GeometryCleanupStatus;
  /** Short summary, e.g. "1 outer · 3 holes" */
  geometryContourSummary?: string;
  /** Combined cleanup / validation messages for tooltips */
  geometryPrepMessages?: string[];
  /** DXF from Quick Plate Builder vs file upload */
  partSource?: "upload" | "built";
  /** Serialized plate builder spec JSON (Quick Plate Builder). */
  builtPlateSpec?: string;
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
  /** Index of the finish column (surface treatment) — null means omit */
  finishCol: number | null;
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
  /**
   * Optional: column with DXF/drawing filename (or stem) — disambiguates duplicate part names across files.
   */
  dxfFileCol: number | null;
  /** Which row the headers were found on (0-based) */
  headerRowIdx: number;
}

// ─── Zod Schemas (for forms) — re-exported via features ─────────────────────

export type CreateBatchInput = {
  name: string;
  notes?: string;
  cuttingMethod: CuttingMethod;
};

// Re-exports for feature modules
export type { AppPreferences, PurchasedSheetSize, UnitSystem } from "./settings";
export { DEFAULT_APP_PREFERENCES } from "./settings";
export type {
  CuttingMethodProductionDefaults,
  CuttingProfileRange,
  ProfileRotationMode,
} from "./production";
export {
  CUTTING_METHOD_DEFAULTS,
  CUTTING_METHOD_LABELS,
  CUTTING_METHOD_OPTIONS,
  DEFAULT_CUTTING_PROFILE_RANGES,
  PROFILE_ROTATION_MODE_LABELS,
} from "./production";
export type { CuttingMethod } from "./production";

export type AddClientInput = {
  fullName: string;
};

export type {
  BatchThicknessOverride,
  StockSheetEntry,
  StockSheetType,
} from "./nesting";

export type {
  GeneratedSheet,
  NestingEngineDebugMeta,
  NestingPlacementModeUsed,
  NestingRun,
  NestingRunMode,
  NestingThicknessResult,
  SheetPlacement,
  UnplacedPart,
} from "./nestingResults";
