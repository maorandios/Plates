import type { StockSheetType } from "./nesting";
import type { ProfileRotationMode } from "./production";

/** How part footprints were represented during placement (for debugging). */
export type NestingPlacementModeUsed =
  | "polygon-aware"
  | "svgnest-polygon"
  | "bounding-box";

/** Dev / trace metadata for one thickness group within a nesting run. */
export interface NestingEngineDebugMeta {
  /** Primary engine used for this thickness (shelf only if SVGNest failed). */
  primaryAlgorithm: "svgnest-polygon" | "shelf-fallback";
  /** True when polygon / NFP nesting (SVGNest) produced the placements. */
  fullPolygonNesting: boolean;
  /** Sum of candidate runs across all single-sheet packs in this thickness. */
  totalCandidateRuns: number;
  /** Label of the winning ordering for the last single-sheet pack. */
  lastWinningCandidateLabel?: string;
  /** Utilization % (0–100) of the inner bin for the last winning candidate sheet. */
  lastWinningUtilizationPercent?: number;
  /** Score summary strings per candidate from the last pack (for debugging). */
  lastCandidateSummaries?: string[];
  spacingMmApplied: number;
  edgeMarginMmApplied: number;
  rotationModeApplied: ProfileRotationMode | "locked";
  /** SvgNest `rotations` count (1 = 0° only, 4 = 90° steps, etc.). */
  rotationsSetting?: number;
  allowRotationApplied: boolean;
  /** How many physical sheets in this thickness used shelf fallback. */
  shelfFallbackCount: number;
  shelfFallbackReasons: string[];

  /** Polygon-aware shelf / footprint trace (optional on older persisted runs). */
  placementModeUsed?: NestingPlacementModeUsed;
  /** Parts nested with a true offset outer contour (per busiest shelf adapt pass). */
  polygonPartsCount?: number;
  /** Parts that used axis-aligned bbox footprint only (conversion/offset failure). */
  bboxFallbackPartsCount?: number;
  fallbackPartIds?: string[];
  /** Same as `spacingMmApplied` — duplicated for footprint-debug clarity. */
  spacingAppliedMm?: number;
  /** Same as `edgeMarginMmApplied` — duplicated for footprint-debug clarity. */
  edgeMarginAppliedMm?: number;
  /** Same as `rotationModeApplied` — duplicated for footprint-debug clarity. */
  rotationModeUsed?: ProfileRotationMode | "locked";

  /** SVGNest input: parts sent as offset polygon geometry (not raw bbox). */
  svgnestSpacingInConfigMm?: number;
  svgnestInputPolygonCount?: number;
  svgnestInputBboxFallbackCount?: number;
  svgnestBboxFallbackInstanceIds?: string[];
}

/** Degrees counter-clockwise in bin coordinates (any-nest / SVGNest-style). */
export type NestingRotationDeg = number;

export interface SheetPlacement {
  partInstanceId: string;
  partId: string;
  partName: string;
  clientId: string;
  clientCode: string;
  /** Placement translation in mm (bin inner coordinates, origin at inner lower-left). */
  x: number;
  y: number;
  rotation: NestingRotationDeg;
  /** Normalized part geometry in mm (same frame as nesting input: bbox min at origin). */
  outerContour: [number, number][];
  innerContours: [number, number][][];
  markingText: string;
  /** Net part area mm² (outer − holes) for metrics */
  partNetAreaMm2: number;
}

export interface GeneratedSheet {
  id: string;
  thicknessMm: number | null;
  stockSheetId: string;
  stockType: StockSheetType;
  widthMm: number;
  lengthMm: number;
  /** Inner bin used for nesting (after edge margin), mm */
  innerWidthMm: number;
  innerLengthMm: number;
  placements: SheetPlacement[];
  usedAreaMm2: number;
  wasteAreaMm2: number;
  utilizationPercent: number;
}

export interface UnplacedPart {
  partId: string;
  partName: string;
  clientId: string;
  /** Present on new runs; older persisted runs may omit. */
  clientCode?: string;
  quantityUnplaced: number;
  reason: string;
}

export interface NestingThicknessResult {
  thicknessMm: number | null;
  stockSheetsUsed: number;
  generatedSheets: GeneratedSheet[];
  unplacedParts: UnplacedPart[];
  utilizationPercent: number;
  /** Sum of waste areas on generated sheets (mm²) */
  wasteAreaMm2: number;
  usedAreaMm2: number;
  warnings: string[];
  errors: string[];
  /** Optional engine trace (SVGNest vs shelf, candidates, rules). */
  engineDebug?: NestingEngineDebugMeta;
}

export interface NestingRun {
  id: string;
  batchId: string;
  createdAt: string;
  totalSheets: number;
  totalUtilizationPercent: number;
  /** Aggregate waste area mm² */
  totalWasteAreaMm2: number;
  usedAreaMm2: number;
  placedPartCount: number;
  unplacedPartCount: number;
  thicknessResults: NestingThicknessResult[];
  warnings: string[];
  errors: string[];
}
