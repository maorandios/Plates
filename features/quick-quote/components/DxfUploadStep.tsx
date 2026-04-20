"use client";

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useLayoutEffect,
  forwardRef,
  useImperativeHandle,
  useRef,
  type ReactNode,
} from "react";
import type { LucideIcon } from "lucide-react";
import {
  Upload,
  FileIcon,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Check,
  Eye,
  Info,
  Hash,
  Tag,
  Layers,
  MoveHorizontal,
  MoveVertical,
  Weight,
  Square,
  Palette,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDecimal } from "@/lib/formatNumbers";
import { cn } from "@/lib/utils";
import { parseDxfFile } from "@/lib/parsers/dxfParser";
import { getMaterialConfig } from "@/lib/settings/materialConfig";
import { defaultMaterialGradeForFamily } from "../lib/plateFields";
import {
  normalizeFinishFromImport,
  normalizeStoredReviewFinish,
  phase2DefaultFinish,
  selectOptionsWithCurrent,
} from "../lib/materialSettingsOptions";
import { PlateGeometryCanvas } from "@/components/parts/PlateGeometryCanvas";
import type { DxfPartGeometry, ExcelRow } from "@/types";
import type { MaterialType } from "@/types/materials";
import type {
  DxfMethodExcelSnapshot,
  ValidationRow,
  ValidationSummary,
} from "../types/quickQuote";
import { buildValidationData } from "../lib/buildValidationData";
import { mergeExcelIntoDxfUploads } from "../lib/dxfUploadExcelMerge";
import { DXF_QUOTE_DEFAULT_THICKNESS_MM } from "../lib/dxfQuoteParts";
import { downloadExcelDxfCompareXlsx } from "../lib/validationReportXlsx";
import { ExcelColumnMappingModal } from "./ExcelColumnMappingModal";
import { DxfExcelCompareScreen } from "./DxfExcelCompareScreen";
import { DxfFileBadgeIcon } from "./icons/DxfFileBadgeIcon";
import { t } from "@/lib/i18n";

export type DxfUploadSubStep = 1 | 2 | 3;
type DxfSubStep = DxfUploadSubStep;

const SUB_STEPS = [
  { step: 1 as DxfSubStep, label: "Upload" },
  { step: 2 as DxfSubStep, label: "Parse" },
  { step: 3 as DxfSubStep, label: "Review" },
] as const;

/**
 * Quoted plate area/weight use the DXF axis-aligned bounding box (mm), not the true cut outline.
 */
function bboxFootprintAreaM2(
  geom: { boundingBox?: { width: number; height: number } } | null | undefined
): number {
  const bb = geom?.boundingBox;
  if (!bb) return 0;
  const w = bb.width;
  const h = bb.height;
  if (!(w > 0) || !(h > 0)) return 0;
  return (w * h) / 1_000_000;
}

/** Unit label to the left of the number (LTR) so suffix stays visually left of the value in RTL UI */
function StatValueUnitLeft({
  numericText,
  unitSuffix,
}: {
  numericText: string;
  unitSuffix: string;
}) {
  return (
    <span
      className="inline-flex flex-row items-baseline justify-center gap-1.5"
      dir="ltr"
    >
      <span className="text-sm text-muted-foreground">{unitSuffix.trim()}</span>
      <span className="text-base tabular-nums font-semibold text-foreground">{numericText}</span>
    </span>
  );
}

/** Part preview modal — one cell in the 4×2 grid (icon + label + value, centered) */
function DxfPreviewStatCell({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex aspect-square min-h-0 w-full min-w-0 flex-col items-center justify-center gap-1 overflow-hidden px-2 py-2.5 text-center",
        className
      )}
    >
      <Icon
        className="h-4 w-4 shrink-0 text-[#6A23F7]/70"
        strokeWidth={1.75}
        aria-hidden
      />
      <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </span>
      <span className="line-clamp-2 max-w-full break-words text-sm font-semibold leading-tight text-foreground sm:text-[15px]">
        {value}
      </span>
    </div>
  );
}

/** Column header with optional hint (e.g. defaults without Excel BOM). */
function ReviewTableHeadWithHint({
  label,
  hint,
}: {
  label: string;
  hint?: string | null;
}) {
  if (!hint) return <>{label}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex max-w-[10rem] items-center gap-1 cursor-help">
          {label}
          <Info
            className="h-3.5 w-3.5 shrink-0 origin-center scale-[0.8] text-orange-500 dark:text-orange-400"
            aria-hidden
          />
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-[min(100vw-2rem,22rem)] text-start text-xs leading-relaxed"
      >
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}

/** Crossing curved arrows (shuffle-style): lighter + primary strokes for DXF ↔ Excel sync. */
function QuickSyncCrossIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <g
        className="text-muted-foreground/55"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22" />
        <path d="m18 14 4 4-4 4" />
      </g>
      <g
        className="text-primary"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 6h1.972a4 4 0 0 1 3.6 2.2" />
        <path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45" />
        <path d="m18 2 4 4-4 4" />
      </g>
    </svg>
  );
}

function clampPositiveThicknessMm(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (Number.isFinite(n) && n > 0) return n;
  return DXF_QUOTE_DEFAULT_THICKNESS_MM;
}

interface DxfFileUpload {
  file: File;
  content: string;
  parsed: DxfPartGeometry | null;
  parseError: string | null;
  /** Review table: BOM quantity (initial 1). */
  quantity: number;
  /** Review table: plate thickness (mm); default 2; Excel BOM can prefill when matched. */
  thicknessMm: number;
  /** Review table: material grade (editable; seeded from DXF after parse). */
  materialGrade: string;
  /** Review table: גימור (settings labels). */
  finish: string;
}

/**
 * Rebuild upload rows from geometries already approved in the quote (same session).
 * Synthetic empty file + empty content — review UI works; re-parse requires re-uploading files.
 */
function restoredGeometriesToUploads(
  geometries: DxfPartGeometry[],
  materialType: MaterialType
): DxfFileUpload[] {
  return geometries.map((g) => {
    const base = (g.guessedPartName || "part").trim() || "part";
    const safeName = base.toLowerCase().endsWith(".dxf") ? base : `${base}.dxf`;
    const blob = new Blob([], { type: "application/dxf" });
    const file = new File([blob], safeName, {
      type: "application/dxf",
      lastModified: Date.now(),
    });
    const qty = Math.max(1, Math.floor(Number(g.reviewQuantity ?? 1)) || 1);
    const finish = normalizeStoredReviewFinish(g.reviewFinish, materialType);
    return {
      file,
      content: "",
      parsed: g,
      parseError: null,
      quantity: qty,
      thicknessMm: clampPositiveThicknessMm(g.reviewThicknessMm),
      materialGrade: g.materialGrade?.trim() || defaultMaterialGradeForFamily(materialType),
      finish,
    };
  });
}

function parseDxfUploadsInPlace(
  uploads: DxfFileUpload[],
  materialType: MaterialType
): DxfFileUpload[] {
  return uploads.map((upload) => {
    try {
      const result = parseDxfFile(
        upload.content,
        `dxf-${Date.now()}-${Math.random()}`,
        upload.file.name,
        "temp-client-id",
        "temp-batch-id"
      );

      const geomGrade = result.geometry.materialGrade?.trim() ?? "";
      const mergedGrade =
        upload.materialGrade.trim() ||
        geomGrade ||
        defaultMaterialGradeForFamily(materialType);

      return {
        ...upload,
        parsed: { id: `parsed-${Date.now()}-${Math.random()}`, ...result.geometry },
        parseError: result.warnings.length > 0 ? result.warnings.join("; ") : null,
        materialGrade: mergedGrade,
      };
    } catch (error) {
      return {
        ...upload,
        parsed: null,
        parseError: error instanceof Error ? error.message : "Failed to parse DXF",
      };
    }
  });
}

interface DxfMetrics {
  totalFiles: number;
  validParts: number;
  errorParts: number;
  /** Sum of BOM quantities for valid parts (min 1 each). */
  totalQuantity: number;
  totalArea: number;
  totalWeight: number;
  totalPerimeter: number;
}

/** Live metrics for quote-method sidebar (DXF phase). */
export type DxfPhaseMetricsPayload = {
  totalQuantity: number;
  totalAreaM2: number;
  totalWeightKg: number;
  dxfFileCount: number;
};

export type DxfUploadStepHandle = {
  /** Same as “Continue to Next Phase” on Review when data is valid; returns false if nothing to approve. */
  attemptComplete: () => boolean;
  /** Advance upload → parse → review (steps 1–2); no-op on step 3. */
  attemptNext: () => boolean;
  /**
   * Review → parse/upload, parse → upload, or close Excel mapping modal.
   * Returns false on step 1 (parent should exit the DXF phase to quote methods).
   */
  attemptBackWithinPhase: () => boolean;
  /** Clear all DXF/Excel session data and return to step 1; notifies parent via onSessionReset. */
  resetSession: () => void;
  /** True when there is no upload / Excel / progress to warn about before leaving the phase. */
  canLeaveWithoutConfirm: () => boolean;
  /** Download Excel vs DXF validation spreadsheet when review data exists. */
  exportExcelDxfCompareXlsx: () => void;
};

const NO_EXCEL_DEFAULTS_BANNER_STORAGE_KEY =
  "dxf-review-no-excel-defaults-banner-dismissed";

function readNoExcelDefaultsBannerDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return sessionStorage.getItem(NO_EXCEL_DEFAULTS_BANNER_STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

export type DxfUploadNavState = {
  subStep: DxfUploadSubStep;
  /** Step 2 label: Parse vs Match (Excel BOM mapped). */
  step2Mode: "parse" | "match";
  canGoNext: boolean;
  isReviewStep: boolean;
  /** Step 3: at least one valid part — enables Complete. */
  canCompleteReview: boolean;
  /** False when session is empty (nothing to reset). */
  canReset: boolean;
  /** Excel vs DXF validation rows exist — enables CSV export in phase header. */
  canExportExcelDxfCompare: boolean;
  /** True when the full-screen Excel–DXF comparison table is open (quote method). */
  isExcelCompareScreenOpen: boolean;
};

interface DxfUploadStepProps {
  materialType: MaterialType;
  onDataApproved: (data: DxfPartGeometry[]) => void;
  /** Optional BOM after upload + column mapping in the modal. */
  onOptionalExcelChange?: (
    payload: { file: File; buffer: ArrayBuffer; rows: ExcelRow[] } | null
  ) => void;
  /** Fired when parsed-file metrics change (quote method DXF sidebar). */
  onPhaseMetricsChange?: (payload: DxfPhaseMetricsPayload) => void;
  /**
   * When set (non-empty), hydrate upload + review from parent-approved geometries so returning
   * to the DXF method after Complete keeps the session (same idea as manual rows in parent state).
   */
  restoredGeometries?: DxfPartGeometry[] | null;
  /** Parent-persisted optional Excel BOM — restored together with approved DXF geometries. */
  restoredExcelBundle?: DxfMethodExcelSnapshot | null;
  /** Quote method only: persist optional Excel file + rows in parent for session restore. */
  onExcelSessionPersist?: (payload: DxfMethodExcelSnapshot | null) => void;
  /** Hide bottom Continue / Back to parse buttons (quote method uses header Next / Complete / Reset). */
  hideBottomNavigation?: boolean;
  /** Hide the internal Upload/Parse/Review sub-stepper (parent renders it in the top stripe). */
  hideSubStepper?: boolean;
  /** Quick Quote → DXF method only: {@link DxfQuotePhase} — RTL, Hebrew copy, two-column upload + sidebar nav. */
  dxfQuotePhaseLayout?: boolean;
  /** Fired when sub-step or next-button availability changes (for header controls). */
  onDxfNavStateChange?: (state: DxfUploadNavState) => void;
  /** After internal reset: clear parent `dxfMethodGeometries` + Excel snapshot. */
  onSessionReset?: () => void;
  /** General step project name — Excel השוואה filename (with Hebrew date). */
  excelExportProjectName?: string;
}

export const DxfUploadStep = forwardRef<DxfUploadStepHandle, DxfUploadStepProps>(
  function DxfUploadStep(
    {
      materialType,
      onDataApproved,
      onOptionalExcelChange,
      onPhaseMetricsChange,
      restoredGeometries,
      restoredExcelBundle,
      onExcelSessionPersist,
      hideBottomNavigation = false,
      hideSubStepper = false,
      dxfQuotePhaseLayout = false,
      onDxfNavStateChange,
      onSessionReset,
      excelExportProjectName,
    },
    ref
  ) {
  const [subStep, setSubStep] = useState<DxfSubStep>(() =>
    restoredGeometries && restoredGeometries.length > 0 ? 3 : 1
  );
  const [uploadedFiles, setUploadedFiles] = useState<DxfFileUpload[]>(() =>
    restoredGeometries && restoredGeometries.length > 0
      ? restoredGeometriesToUploads(restoredGeometries, materialType)
      : []
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingExcel, setIsDraggingExcel] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [excelUploadError, setExcelUploadError] = useState<string | null>(null);
  const [excelMappingModalOpen, setExcelMappingModalOpen] = useState(false);
  const [excelModalFile, setExcelModalFile] = useState<File | null>(null);
  const [excelModalBuffer, setExcelModalBuffer] = useState<ArrayBuffer | null>(null);
  const [optionalExcelFile, setOptionalExcelFile] = useState<File | null>(null);
  const [mappedExcelRows, setMappedExcelRows] = useState<ExcelRow[] | null>(null);
  const [validationRows, setValidationRows] = useState<ValidationRow[] | null>(null);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(
    null
  );
  const [excelCompareScreenOpen, setExcelCompareScreenOpen] = useState(false);
  const [previewUploadIndex, setPreviewUploadIndex] = useState<number | null>(null);
  const previewCanvasResizeObserverRef = useRef<ResizeObserver | null>(null);
  /** Measured host box; Konva size must match host (never force a min larger than the visible area). */
  const [previewCanvasSize, setPreviewCanvasSize] = useState({ w: 0, h: 0 });

  const setPreviewCanvasHostRef = useCallback((el: HTMLDivElement | null) => {
    previewCanvasResizeObserverRef.current?.disconnect();
    previewCanvasResizeObserverRef.current = null;

    if (!el) {
      setPreviewCanvasSize({ w: 0, h: 0 });
      return;
    }

    const measure = () => {
      const r = el.getBoundingClientRect();
      setPreviewCanvasSize({
        w: Math.max(1, Math.floor(r.width)),
        h: Math.max(1, Math.floor(r.height)),
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    previewCanvasResizeObserverRef.current = ro;
  }, []);
  const [noExcelDefaultsBannerDismissed, setNoExcelDefaultsBannerDismissed] =
    useState(true);

  const excelRestoreAppliedRef = useRef(false);

  useLayoutEffect(() => {
    document.getElementById("quick-quote-method-scroll")?.scrollTo(0, 0);
  }, [subStep]);

  useEffect(() => {
    if (excelRestoreAppliedRef.current) return;
    if (!restoredExcelBundle?.rows?.length) return;
    excelRestoreAppliedRef.current = true;
    const { fileName, buffer, rows } = restoredExcelBundle;
    const file = new File([buffer], fileName, { lastModified: Date.now() });
    setOptionalExcelFile(file);
    setMappedExcelRows(rows);
    if (restoredGeometries?.length) {
      const { rows: vr, summary } = buildValidationData(
        rows,
        restoredGeometries,
        materialType
      );
      setValidationRows(vr);
      setValidationSummary(summary);
    }
  }, [restoredExcelBundle, restoredGeometries, materialType]);

  useEffect(() => {
    if (subStep !== 3) return;
    if (mappedExcelRows?.length) return;
    setNoExcelDefaultsBannerDismissed(readNoExcelDefaultsBannerDismissed());
  }, [subStep, mappedExcelRows?.length]);

  /** After removing the last review row, return to upload so the UI is not stuck on an empty step 3. */
  useEffect(() => {
    if (subStep !== 3) return;
    if (uploadedFiles.length > 0) return;
    setSubStep(1);
    setExcelCompareScreenOpen(false);
    if (mappedExcelRows?.length) {
      setValidationRows(null);
      setValidationSummary(null);
    }
  }, [subStep, uploadedFiles.length, mappedExcelRows?.length]);

  const dismissNoExcelDefaultsBanner = useCallback(() => {
    try {
      sessionStorage.setItem(NO_EXCEL_DEFAULTS_BANNER_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setNoExcelDefaultsBannerDismissed(true);
  }, []);

  const materialConfig = useMemo(() => getMaterialConfig(materialType), [materialType]);

  const previewPartStats = useMemo(() => {
    if (previewUploadIndex === null) return null;
    const upload = uploadedFiles[previewUploadIndex];
    const geom = upload?.parsed?.processedGeometry;
    if (!geom || !upload) return null;
    const bbox = geom.boundingBox;
    const densityKgPerM3 = materialConfig.densityKgPerM3;
    const thMm = clampPositiveThicknessMm(upload.thicknessMm);
    const unitAreaM2 = bboxFootprintAreaM2(geom);
    const unitWeightKg =
      unitAreaM2 > 0 ? unitAreaM2 * (thMm / 1000) * densityKgPerM3 : 0;
    const qty = Math.max(1, Math.floor(Number(upload.quantity)) || 1);
    const totalWeightKg = unitWeightKg * qty;
    const totalAreaM2 = unitAreaM2 * qty;
    const dim1 = bbox.width;
    const dim2 = bbox.height;
    const widthMm = dim1 > 0 && dim2 > 0 ? Math.min(dim1, dim2) : dim1 || dim2;
    const lengthMm = dim1 > 0 && dim2 > 0 ? Math.max(dim1, dim2) : 0;
    const partLabel =
      upload.parsed?.guessedPartName ||
      upload.file.name.replace(/\.dxf$/i, "");
    return {
      geom,
      partLabel,
      qty,
      thMm,
      widthMm,
      lengthMm,
      totalWeightKg,
      totalAreaM2,
      finish: upload.finish,
    };
  }, [previewUploadIndex, uploadedFiles, materialConfig]);

  useEffect(() => {
    if (previewUploadIndex === null) return;
    const u = uploadedFiles[previewUploadIndex];
    if (!u?.parsed?.processedGeometry) {
      setPreviewUploadIndex(null);
    }
  }, [previewUploadIndex, uploadedFiles]);

  const step2Label = mappedExcelRows?.length ? "Match" : "Parse";

  const resetSession = useCallback(() => {
    setUploadedFiles([]);
    setSubStep(1);
    setIsDragging(false);
    setIsDraggingExcel(false);
    setUploadError(null);
    setExcelUploadError(null);
    setExcelMappingModalOpen(false);
    setExcelModalFile(null);
    setExcelModalBuffer(null);
    setOptionalExcelFile(null);
    setMappedExcelRows(null);
    setValidationRows(null);
    setValidationSummary(null);
    setExcelCompareScreenOpen(false);
    setPreviewUploadIndex(null);
    excelRestoreAppliedRef.current = false;
    onOptionalExcelChange?.(null);
    onExcelSessionPersist?.(null);
    onSessionReset?.();
  }, [onOptionalExcelChange, onExcelSessionPersist, onSessionReset]);

  const handleFilesSelect = useCallback(async (files: FileList | File[]) => {
    setUploadError(null);
    
    const fileArray = Array.from(files).filter(f => 
      f.name.toLowerCase().endsWith('.dxf')
    );

    if (fileArray.length === 0) {
      setUploadError("Please select at least one DXF file");
      return;
    }

    try {
      const uploads: DxfFileUpload[] = await Promise.all(
        fileArray.map(async (file) => {
          const content = await file.text();
          return {
            file,
            content,
            parsed: null,
            parseError: null,
            quantity: 1,
            thicknessMm: DXF_QUOTE_DEFAULT_THICKNESS_MM,
            materialGrade: "",
            finish: phase2DefaultFinish(materialType),
          };
        })
      );

      setUploadedFiles((prev) => [...prev, ...uploads]);
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Failed to read DXF files"
      );
    }
  }, [materialType]);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFilesSelect(e.target.files);
      }
    },
    [handleFilesSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFilesSelect(e.dataTransfer.files);
      }
    },
    [handleFilesSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleOptionalExcelSelect = useCallback(
    async (file: File) => {
      setExcelUploadError(null);
      setOptionalExcelFile(null);
      setMappedExcelRows(null);
      setValidationRows(null);
      setValidationSummary(null);
      onOptionalExcelChange?.(null);
      onExcelSessionPersist?.(null);
      try {
        const buffer = await file.arrayBuffer();
        setExcelModalFile(file);
        setExcelModalBuffer(buffer);
        setExcelMappingModalOpen(true);
      } catch (error) {
        setExcelUploadError(
          error instanceof Error ? error.message : "Failed to read file"
        );
        setExcelModalFile(null);
        setExcelModalBuffer(null);
      }
    },
    [onOptionalExcelChange, onExcelSessionPersist]
  );

  const handleExcelMappingComplete = useCallback(
    (rows: ExcelRow[]) => {
      if (!excelModalFile || !excelModalBuffer) return;
      const file = excelModalFile;
      const buffer = excelModalBuffer;
      setOptionalExcelFile(file);
      setMappedExcelRows(rows);
      setExcelModalFile(null);
      setExcelModalBuffer(null);
      setExcelMappingModalOpen(false);
      onOptionalExcelChange?.({ file, buffer, rows });
      onExcelSessionPersist?.({
        fileName: file.name,
        buffer: buffer.slice(0),
        rows,
      });
    },
    [excelModalFile, excelModalBuffer, onOptionalExcelChange, onExcelSessionPersist]
  );

  const handleExcelMappingDiscard = useCallback(() => {
    setExcelModalFile(null);
    setExcelModalBuffer(null);
    setExcelMappingModalOpen(false);
    onOptionalExcelChange?.(null);
  }, [onOptionalExcelChange]);

  const handleExcelMappingRemoved = useCallback(() => {
    setExcelModalFile(null);
    setExcelModalBuffer(null);
    setOptionalExcelFile(null);
    setMappedExcelRows(null);
    setValidationRows(null);
    setValidationSummary(null);
    setExcelCompareScreenOpen(false);
    setExcelMappingModalOpen(false);
    onOptionalExcelChange?.(null);
    onExcelSessionPersist?.(null);
  }, [onOptionalExcelChange, onExcelSessionPersist]);

  const handleExcelFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) void handleOptionalExcelSelect(f);
    },
    [handleOptionalExcelSelect]
  );

  const handleExcelDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingExcel(false);
      const f = e.dataTransfer.files[0];
      if (f) void handleOptionalExcelSelect(f);
    },
    [handleOptionalExcelSelect]
  );

  const handleExcelDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingExcel(true);
  }, []);

  const handleExcelDragLeave = useCallback(() => {
    setIsDraggingExcel(false);
  }, []);

  const handleRemoveOptionalExcel = useCallback(() => {
    setExcelUploadError(null);
    handleExcelMappingRemoved();
  }, [handleExcelMappingRemoved]);

  const excelMappedComplete = Boolean(
    optionalExcelFile && mappedExcelRows && mappedExcelRows.length > 0
  );

  const handleContinueToParse = useCallback(() => {
    if (uploadedFiles.length === 0) return;

    if (mappedExcelRows?.length) {
      const parsed = parseDxfUploadsInPlace(uploadedFiles, materialType);
      const merged = mergeExcelIntoDxfUploads(parsed, mappedExcelRows, materialType);
      setUploadedFiles(merged);
      const geoms = merged
        .map((u) => u.parsed)
        .filter((p): p is DxfPartGeometry => p !== null);
      const { rows, summary } = buildValidationData(
        mappedExcelRows,
        geoms,
        materialType
      );
      setValidationRows(rows);
      setValidationSummary(summary);
      setSubStep(3);
      return;
    }

    // No Excel: parse in place and go straight to review (skip intermediate parse step)
    const parsed = parseDxfUploadsInPlace(uploadedFiles, materialType);
    const merged = mergeExcelIntoDxfUploads(parsed, null, materialType);
    setUploadedFiles(merged);
    setSubStep(3);
  }, [uploadedFiles, mappedExcelRows, materialType]);

  const handleRemoveFile = useCallback((index: number) => {
    setUploadedFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) {
        setSubStep(1);
        setValidationRows(null);
        setValidationSummary(null);
        setExcelCompareScreenOpen(false);
      }
      return next;
    });
  }, []);

  /** DXF quote phase: clear all uploaded DXF and return to empty drop zone (does not clear optional Excel). */
  const handleClearDxfFiles = useCallback(() => {
    setUploadedFiles([]);
    setUploadError(null);
    setSubStep(1);
    setValidationRows(null);
    setValidationSummary(null);
    setExcelCompareScreenOpen(false);
  }, []);

  const handleParseFiles = useCallback(() => {
    const parsed = parseDxfUploadsInPlace(uploadedFiles, materialType);
    const merged = mergeExcelIntoDxfUploads(parsed, null, materialType);
    setUploadedFiles(merged);
    setSubStep(3);
  }, [uploadedFiles, materialType]);

  const handleBackToUpload = useCallback(() => {
    setExcelCompareScreenOpen(false);
    setValidationRows(null);
    setValidationSummary(null);
    setSubStep(1);
  }, []);

  /** Back from review (step 3) — always return to upload (step 1). Parse step is skipped when no Excel. */
  const handleBackToParse = useCallback(() => {
    setExcelCompareScreenOpen(false);
    if (mappedExcelRows?.length) {
      setValidationRows(null);
      setValidationSummary(null);
    }
    setSubStep(1);
  }, [mappedExcelRows?.length]);

  const updateUploadRow = useCallback(
    (
      index: number,
      patch: Partial<
        Pick<DxfFileUpload, "quantity" | "thicknessMm" | "materialGrade" | "finish">
      >
    ) => {
      setUploadedFiles((prev) =>
        prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
      );
    },
    []
  );

  const removeUploadAtIndex = useCallback((index: number) => {
    setPreviewUploadIndex((prev) => {
      if (prev === null) return null;
      if (prev === index) return null;
      if (prev > index) return prev - 1;
      return prev;
    });
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleContinueToNextPhase = useCallback(() => {
    const validUploads = uploadedFiles.filter((u) => u.parsed !== null);
    const validGeometries = validUploads.map((u) => {
      const p = u.parsed!;
      const qty = Math.max(1, Math.floor(Number(u.quantity)) || 1);
      return {
        ...p,
        materialGrade: u.materialGrade.trim() || p.materialGrade,
        reviewQuantity: qty,
        reviewFinish: u.finish,
        reviewThicknessMm: clampPositiveThicknessMm(u.thicknessMm),
      };
    });

    if (validGeometries.length > 0) {
      // Persist raw DXF text keyed by geometry ID so the export package can
      // include the original file as-is (preserving holes and all entities).
      validUploads.forEach((u) => {
        if (u.parsed?.id && u.content) {
          try {
            localStorage.setItem(`dxf_raw_${u.parsed.id}`, u.content);
          } catch {
            // localStorage full — export will fall back to generated DXF
          }
        }
      });
      onDataApproved(validGeometries);
    }
  }, [uploadedFiles, onDataApproved]);

  const metrics = useMemo((): DxfMetrics => {
    const validParts = uploadedFiles.filter(u => u.parsed?.processedGeometry?.isValid);
    
    // Get density from material configuration
    const materialConfig = getMaterialConfig(materialType);
    const densityKgPerM3 = materialConfig.densityKgPerM3;
    
    let totalArea = 0;
    let totalWeight = 0;
    let totalPerimeter = 0;
    let totalQuantity = 0;

    validParts.forEach((u) => {
      const qty = Math.max(1, Math.floor(Number(u.quantity)) || 1);
      totalQuantity += qty;
      const geom = u.parsed?.processedGeometry;
      if (geom) {
        const areaM2 = bboxFootprintAreaM2(geom);
        totalArea += areaM2 * qty;
        totalPerimeter += geom.perimeter * qty;
        const thicknessMm = clampPositiveThicknessMm(u.thicknessMm);
        const volumeM3 = areaM2 * (thicknessMm / 1000);
        totalWeight += volumeM3 * densityKgPerM3 * qty;
      }
    });

    return {
      totalFiles: uploadedFiles.length,
      validParts: validParts.length,
      errorParts: uploadedFiles.length - validParts.length,
      totalQuantity,
      totalArea,
      totalWeight,
      totalPerimeter,
    };
  }, [uploadedFiles, materialType]);

  useEffect(() => {
    onPhaseMetricsChange?.({
      totalQuantity: metrics.totalQuantity,
      totalAreaM2: metrics.totalArea,
      totalWeightKg: metrics.totalWeight,
      dxfFileCount: metrics.totalFiles,
    });
  }, [metrics, onPhaseMetricsChange]);

  const handleExportCompareXlsx = useCallback(() => {
    if (!validationRows || validationRows.length === 0) return;
    void downloadExcelDxfCompareXlsx(validationRows, {
      projectName: excelExportProjectName,
    }).catch((err) => {
      console.error(err);
    });
  }, [validationRows, excelExportProjectName]);

  useEffect(() => {
    if (!onDxfNavStateChange) return;
    const canGoNext =
      !excelMappingModalOpen &&
      (subStep === 1
        ? uploadedFiles.length > 0
        : subStep === 2
          ? uploadedFiles.length > 0
          : false);
    const canLeaveEmpty =
      uploadedFiles.length === 0 &&
      !(mappedExcelRows && mappedExcelRows.length > 0) &&
      !optionalExcelFile &&
      subStep === 1 &&
      !excelMappingModalOpen;
    onDxfNavStateChange({
      subStep,
      step2Mode: mappedExcelRows?.length ? "match" : "parse",
      canGoNext,
      isReviewStep: subStep === 3,
      canCompleteReview: subStep === 3 && metrics.validParts > 0,
      canReset: !canLeaveEmpty,
      canExportExcelDxfCompare:
        subStep === 3 && validationRows != null && validationRows.length > 0,
      isExcelCompareScreenOpen: excelCompareScreenOpen,
    });
  }, [
    subStep,
    uploadedFiles.length,
    excelMappingModalOpen,
    mappedExcelRows,
    optionalExcelFile,
    metrics.validParts,
    onDxfNavStateChange,
    validationRows,
    excelCompareScreenOpen,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      attemptComplete: () => {
        if (metrics.validParts === 0) return false;
        handleContinueToNextPhase();
        return true;
      },
      attemptNext: () => {
        if (excelMappingModalOpen) return false;
        if (subStep === 3) return false;
        if (subStep === 1) {
          if (uploadedFiles.length === 0) return false;
          handleContinueToParse();
          return true;
        }
        if (subStep === 2) {
          handleParseFiles();
          return true;
        }
        return false;
      },
      attemptBackWithinPhase: () => {
        if (excelCompareScreenOpen) {
          setExcelCompareScreenOpen(false);
          return true;
        }
        if (excelMappingModalOpen) {
          handleExcelMappingDiscard();
          return true;
        }
        if (subStep === 3) {
          handleBackToParse();
          return true;
        }
        if (subStep === 2) {
          handleBackToUpload();
          return true;
        }
        return false;
      },
      resetSession,
      canLeaveWithoutConfirm: () =>
        uploadedFiles.length === 0 &&
        !(mappedExcelRows && mappedExcelRows.length > 0) &&
        !optionalExcelFile &&
        subStep === 1 &&
        !excelMappingModalOpen,
      exportExcelDxfCompareXlsx: handleExportCompareXlsx,
    }),
    [
      metrics.validParts,
      handleContinueToNextPhase,
      handleContinueToParse,
      handleParseFiles,
      handleBackToParse,
      handleBackToUpload,
      handleExcelMappingDiscard,
      resetSession,
      uploadedFiles.length,
      mappedExcelRows,
      optionalExcelFile,
      subStep,
      excelMappingModalOpen,
      excelCompareScreenOpen,
      handleExportCompareXlsx,
    ]
  );

  return (
    <div
      className={cn(
        "space-y-6",
        dxfQuotePhaseLayout && "flex h-full min-h-0 flex-1 flex-col",
        dxfQuotePhaseLayout && "pt-4 sm:pt-5",
        dxfQuotePhaseLayout &&
          subStep === 3 &&
          excelCompareScreenOpen &&
          "min-h-0 space-y-0 gap-0 !pt-0"
      )}
      dir={dxfQuotePhaseLayout ? "rtl" : undefined}
    >
      {/* Sub-Stepper — hidden when parent renders it in the quote-method top stripe */}
      {!hideSubStepper && (
        <Card className="border-0">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2">
              {SUB_STEPS.map(({ step, label }, index) => {
                const isComplete = step < subStep;
                const isCurrent = step === subStep;
                const displayLabel = index === 1 ? step2Label : label;

                return (
                  <div key={step} className="flex items-center flex-1 last:flex-none">
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                          isComplete && "border-primary bg-primary text-white",
                          isCurrent && !isComplete && "border-primary bg-primary text-primary-foreground",
                          !isCurrent && !isComplete && "border-muted-foreground/30 bg-muted/50 text-muted-foreground"
                        )}
                      >
                        {isComplete ? <Check className="h-4 w-4" /> : step}
                      </div>
                      <span
                        className={cn(
                          "text-sm font-medium whitespace-nowrap",
                          isCurrent && "text-foreground",
                          !isCurrent && isComplete && "text-primary",
                          !isCurrent && !isComplete && "text-muted-foreground"
                        )}
                      >
                        {displayLabel}
                      </span>
                    </div>
                    {index < SUB_STEPS.length - 1 && (
                      <div
                        className={cn(
                          "h-0.5 flex-1 mx-3",
                          step < subStep ? "bg-primary" : "bg-border"
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: DXF + optional Excel (two cards) */}
      {subStep === 1 && (
        <div
          className={cn(
            "space-y-4",
            dxfQuotePhaseLayout && "flex h-full min-h-0 flex-1 flex-col"
          )}
        >
          <div
            className={cn(
              "grid gap-4",
              dxfQuotePhaseLayout
                ? "h-full min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)_minmax(0,1fr)] md:gap-8 [grid-auto-rows:minmax(0,1fr)]"
                : "md:grid-cols-2 md:items-stretch"
            )}
          >
            <Card
              className={cn(
                "flex flex-col min-h-0",
                dxfQuotePhaseLayout && "h-full min-h-[14rem] border-white/[0.08]"
              )}
            >
              <CardHeader>
                <CardTitle>
                  {dxfQuotePhaseLayout
                    ? t("quote.dxfPhase.dxfCardTitle")
                    : "DXF files"}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {dxfQuotePhaseLayout
                    ? t("quote.dxfPhase.dxfCardSubtitle")
                    : "Upload part geometry — required before continuing (multiple files supported)."}
                </p>
              </CardHeader>
              <CardContent
                className={cn(
                  "flex min-h-0 flex-1 flex-col",
                  dxfQuotePhaseLayout &&
                    uploadedFiles.length > 0 &&
                    "justify-center items-center"
                )}
              >
                {dxfQuotePhaseLayout && uploadedFiles.length > 0 ? (
                  <div className="w-full max-w-4xl mx-auto flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <DxfFileBadgeIcon
                        className="h-6 w-6 shrink-0 text-primary"
                        aria-hidden
                      />
                      <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-[10px] font-medium leading-tight text-muted-foreground">
                            {t("quote.dxfPhase.dxfUploadedTypeLabel")}
                          </p>
                          <p className="text-sm font-medium text-foreground">
                            {t("quote.dxfPhase.dxfUploadedTypeValue")}
                          </p>
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-[10px] font-medium leading-tight text-muted-foreground">
                            {t("quote.dxfPhase.dxfUploadedFilesSizeLabel")}
                          </p>
                          <p className="text-sm font-medium tabular-nums text-foreground">
                            {formatDecimal(
                              uploadedFiles.reduce((s, u) => s + u.file.size, 0) /
                                1024,
                              1
                            )}{" "}
                            KB
                          </p>
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-[10px] font-medium leading-tight text-muted-foreground">
                            {t("quote.dxfPhase.dxfUploadedFilesCountLabel")}
                          </p>
                          <p className="text-sm font-medium tabular-nums text-primary/90 dark:text-primary/80">
                            {t("quote.dxfPhase.dxfUploadedFilesCountValue", {
                              n: uploadedFiles.length,
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearDxfFiles}
                      className="shrink-0 self-center"
                      aria-label={t("quote.dxfPhase.dxfClearUploadAria")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      className={cn(
                        "border-2 border-dashed rounded-lg p-6 text-center transition-colors sm:p-8",
                        dxfQuotePhaseLayout
                          ? "grid min-h-[200px] flex-1 place-content-center place-items-center"
                          : "flex min-h-[200px] flex-1 flex-col items-center justify-center",
                        isDragging
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center gap-4">
                        <div className="h-14 w-14 shrink-0 rounded-full bg-muted flex items-center justify-center">
                          <Upload className="h-7 w-7 text-muted-foreground" />
                        </div>
                        <div className="w-full text-balance">
                          <p className="text-center text-sm font-medium leading-snug">
                            {dxfQuotePhaseLayout
                              ? t("quote.dxfPhase.dxfDropPrimary")
                              : "Drag and drop DXF files here"}
                          </p>
                          <p className="mt-1.5 text-center text-xs leading-relaxed text-muted-foreground">
                            {dxfQuotePhaseLayout
                              ? t("quote.dxfPhase.dxfDropSecondary")
                              : "or browse — multiple files allowed"}
                          </p>
                        </div>
                        <input
                          type="file"
                          accept=".dxf"
                          multiple
                          onChange={handleFileInputChange}
                          className="hidden"
                          id="dxf-upload"
                        />
                        <div className="flex w-full justify-center">
                          <Button asChild variant="outline" size="sm">
                            <label
                              htmlFor="dxf-upload"
                              className="cursor-pointer inline-flex items-center justify-center gap-2 text-center"
                            >
                              <FileIcon className="h-4 w-4 shrink-0" aria-hidden />
                              {dxfQuotePhaseLayout
                                ? t("quote.dxfPhase.dxfChooseFiles")
                                : "Choose DXF files"}
                            </label>
                          </Button>
                        </div>
                      </div>
                    </div>

                    {uploadedFiles.length > 0 && !dxfQuotePhaseLayout && (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm font-medium">
                          {`${uploadedFiles.length} file${uploadedFiles.length !== 1 ? "s" : ""} ready`}
                        </p>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                          {uploadedFiles.map((upload, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-muted/30"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="text-sm truncate">{upload.file.name}</span>
                                <Badge variant="secondary" className="text-xs shrink-0">
                                  {formatDecimal(upload.file.size / 1024, 1)} KB
                                </Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveFile(index)}
                                className="shrink-0"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {uploadError && (
                  <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <p className="text-sm text-destructive">{uploadError}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {dxfQuotePhaseLayout && (
              <div className="flex min-h-0 flex-col items-center justify-center gap-5 px-6 py-10 md:self-stretch md:px-8 md:py-6 lg:px-12 lg:py-8">
                <p className="max-w-[12rem] text-center text-xs font-semibold uppercase leading-snug tracking-[0.1em] text-muted-foreground sm:text-[13px]">
                  {t("quote.dxfPhase.quickSync")}
                </p>
                <div className="relative flex shrink-0 items-center justify-center" aria-hidden>
                  <QuickSyncCrossIcon className="h-[4.5rem] w-[4.5rem] sm:h-[5.25rem] sm:w-[5.25rem]" />
                </div>
              </div>
            )}

            <Card
              className={cn(
                "flex flex-col min-h-0",
                dxfQuotePhaseLayout
                  ? "h-full min-h-[14rem] border border-white/[0.08]"
                  : "border-0"
              )}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      {dxfQuotePhaseLayout
                        ? t("quote.dxfPhase.excelCardTitle")
                        : "Excel / CSV"}
                      <Badge variant="outline" className="font-normal text-muted-foreground">
                        {dxfQuotePhaseLayout
                          ? t("quote.dxfPhase.excelOptionalBadge")
                          : "Optional"}
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {dxfQuotePhaseLayout
                        ? t("quote.dxfPhase.excelCardSubtitle")
                        : "BOM or part list for matching. After you choose a file, a dialog opens to map columns (same as the main Excel upload step). Skip if you only have DXF."}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent
                className={cn(
                  "flex min-h-0 flex-1 flex-col",
                  excelMappedComplete && "justify-center items-center",
                  excelMappedComplete &&
                    !dxfQuotePhaseLayout &&
                    "min-h-[220px]"
                )}
              >
                {!excelMappedComplete && (
                  <div
                    onDrop={handleExcelDrop}
                    onDragOver={handleExcelDragOver}
                    onDragLeave={handleExcelDragLeave}
                    className={cn(
                      "border-2 border-dashed rounded-lg p-6 text-center transition-colors sm:p-8",
                      dxfQuotePhaseLayout
                        ? "grid min-h-[200px] flex-1 place-content-center place-items-center"
                        : "flex min-h-[200px] flex-1 flex-col items-center justify-center",
                      isDraggingExcel
                        ? "border-primary bg-primary/5"
                        : "border-border/80 hover:border-muted-foreground/40"
                    )}
                  >
                    <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center gap-4">
                      <div className="h-14 w-14 shrink-0 rounded-full bg-muted flex items-center justify-center">
                        <FileSpreadsheet className="h-7 w-7 text-muted-foreground" />
                      </div>
                      <div className="w-full text-balance">
                        <p className="text-center text-sm font-medium leading-snug">
                          {dxfQuotePhaseLayout
                            ? t("quote.dxfPhase.excelDropPrimary")
                            : "Drop Excel or CSV here"}
                        </p>
                        <p className="mt-1.5 text-center text-xs leading-relaxed text-muted-foreground">
                          {dxfQuotePhaseLayout
                            ? t("quote.dxfPhase.excelDropSecondary")
                            : "One file — mapping opens in a dialog"}
                        </p>
                      </div>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleExcelFileInputChange}
                        className="hidden"
                        id="dxf-step-excel-upload"
                        key={optionalExcelFile?.name ?? "no-excel"}
                      />
                      <div className="flex w-full justify-center">
                        <Button asChild variant="outline" size="sm">
                          <label
                            htmlFor="dxf-step-excel-upload"
                            className="cursor-pointer inline-flex items-center justify-center gap-2 text-center"
                          >
                            <FileSpreadsheet className="h-4 w-4 shrink-0" aria-hidden />
                            {dxfQuotePhaseLayout
                              ? t("quote.dxfPhase.excelChooseFile")
                              : "Choose spreadsheet"}
                          </label>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {excelMappedComplete && optionalExcelFile && mappedExcelRows && (
                  <div className="w-full max-w-4xl mx-auto flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <FileSpreadsheet
                        className="h-5 w-5 shrink-0 text-primary"
                        aria-hidden
                      />
                      <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-[10px] font-medium leading-tight text-muted-foreground">
                            {dxfQuotePhaseLayout
                              ? t("quote.dxfPhase.excelUploadedFileName")
                              : "File name"}
                          </p>
                          <p
                            className="truncate text-sm font-medium text-foreground"
                            title={optionalExcelFile.name}
                          >
                            {optionalExcelFile.name}
                          </p>
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-[10px] font-medium leading-tight text-muted-foreground">
                            {dxfQuotePhaseLayout
                              ? t("quote.dxfPhase.excelUploadedFileSize")
                              : "File size"}
                          </p>
                          <p className="text-sm font-medium tabular-nums text-foreground">
                            {formatDecimal(optionalExcelFile.size / 1024, 1)} KB
                          </p>
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-[10px] font-medium leading-tight text-muted-foreground">
                            {dxfQuotePhaseLayout
                              ? t("quote.dxfPhase.excelUploadedRowCount")
                              : "Rows detected"}
                          </p>
                          <p className="text-sm font-medium tabular-nums text-primary/90 dark:text-primary/80">
                            {dxfQuotePhaseLayout
                              ? t("quote.dxfPhase.excelUploadedRowsDetectedValue", {
                                  n: mappedExcelRows.length,
                                })
                              : `${mappedExcelRows.length} rows`}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveOptionalExcel}
                      className="shrink-0 self-center"
                      aria-label={
                        dxfQuotePhaseLayout
                          ? t("quote.dxfPhase.excelRemoveFileAria")
                          : "Remove spreadsheet"
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {excelUploadError && (
                  <div
                    className={cn(
                      "p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2",
                      excelMappedComplete ? "mt-4 w-full max-w-4xl mx-auto" : "mt-4"
                    )}
                  >
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <p className="text-sm text-destructive">{excelUploadError}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {!hideBottomNavigation && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 pt-1">
              <Button
                size="lg"
                className="gap-2 w-full sm:w-auto"
                disabled={uploadedFiles.length === 0}
                onClick={handleContinueToParse}
              >
                {dxfQuotePhaseLayout
                  ? t("quote.dxfPhase.continueToReview")
                  : "Continue to review"}
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Parse only (Excel+BOM goes straight to review + comparison modal) */}
      {subStep === 2 && !mappedExcelRows?.length && (
        <Card>
          <CardHeader>
            <CardTitle>Parse DXF Files</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Extract geometry and part data from uploaded files
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 border">
                <p className="text-sm font-medium mb-2">
                  {uploadedFiles.length} file{uploadedFiles.length !== 1 ? "s" : ""} ready to parse
                </p>
                <p className="text-xs text-muted-foreground">
                  Click the button below to extract geometry, dimensions, and material information from
                  your DXF files.
                </p>
              </div>

              {!hideBottomNavigation && (
                <div className="flex items-center justify-between">
                  <Button variant="outline" onClick={handleBackToUpload}>
                    Back to Upload
                  </Button>
                  <Button onClick={handleParseFiles} size="lg">
                    Parse All Files
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review Parts */}
      {subStep === 3 && uploadedFiles.length > 0 && (
        <>
          {excelCompareScreenOpen &&
          validationSummary &&
          validationRows &&
          validationRows.length > 0 ? (
            <DxfExcelCompareScreen
              summary={validationSummary}
              rows={validationRows}
              onExportXlsx={handleExportCompareXlsx}
              exportXlsxDisabled={!validationRows?.length}
            />
          ) : (
            <>
              {mappedExcelRows?.length &&
                validationSummary &&
                validationRows &&
                validationRows.length > 0 && (
                  <div className="flex w-full justify-start">
                    <button
                      type="button"
                      onClick={() => setExcelCompareScreenOpen(true)}
                      className={cn(
                        "inline-flex w-fit max-w-full items-center gap-3 rounded-lg border p-4 text-start transition-colors focus-visible:outline-none",
                        validationSummary.warnings > 0 || validationSummary.critical > 0
                          ? "excel-dxf-mismatch-banner"
                          : "border-primary/40 bg-primary/[0.05] text-foreground hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      )}
                    >
                      {validationSummary.warnings > 0 || validationSummary.critical > 0 ? (
                        <AlertTriangle className="h-5 w-5 shrink-0 text-current" aria-hidden />
                      ) : (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                      )}
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-medium">
                          {validationSummary.warnings > 0 || validationSummary.critical > 0
                            ? t("quote.dxfPhase.excelDxfValidationBanner.titleMismatch")
                            : t("quote.dxfPhase.excelDxfValidationBanner.titleMatch")}
                        </p>
                        <p
                          className={cn(
                            "text-xs",
                            validationSummary.warnings > 0 || validationSummary.critical > 0
                              ? "text-current"
                              : "text-muted-foreground"
                          )}
                        >
                          {validationSummary.warnings > 0 || validationSummary.critical > 0
                            ? t("quote.dxfPhase.excelDxfValidationBanner.bodyMismatch")
                            : t("quote.dxfPhase.excelDxfValidationBanner.bodyMatch")}
                        </p>
                      </div>
                    </button>
                  </div>
                )}

              {/* Parts Table */}
              <Card>
                <CardHeader>
                  <CardTitle>{t("quote.dxfPhase.dxfReviewTable.title")}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    {t("quote.dxfPhase.dxfReviewTable.subtitle")}
                  </p>
                </CardHeader>
                <CardContent>
              {!mappedExcelRows?.length && !noExcelDefaultsBannerDismissed && (
                <div
                  role="status"
                  className={cn(
                    "mb-4 flex gap-3 rounded-lg border-2 !border-[#FF8C00] bg-[#1A120B] p-3 text-start shadow-sm",
                    "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-300"
                  )}
                >
                  <Info
                    className="h-5 w-5 shrink-0 text-[#FF8C00]"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-semibold text-[#FF8C00]">
                      {t("quote.dxfPhase.dxfReviewTable.firstVisitNoExcelBannerTitle")}
                    </p>
                    <p className="text-xs leading-relaxed text-[#FF8C00]/85">
                      {t("quote.dxfPhase.dxfReviewTable.firstVisitNoExcelBannerBody")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 self-start border-2 !border-[#FF8C00] bg-transparent text-[#FF8C00] hover:!border-[#FF8C00] hover:bg-[#FF8C00]/15 hover:text-[#FF8C00] focus-visible:!border-[#FF8C00] focus-visible:ring-[#FF8C00]/40"
                    onClick={dismissNoExcelDefaultsBanner}
                  >
                    {t("quote.dxfPhase.dxfReviewTable.firstVisitNoExcelBannerDismiss")}
                  </Button>
                </div>
              )}
              <TooltipProvider delayDuration={250}>
                <div className="rounded-md border border-white/[0.08]">
                  <Table
                    className="border-separate border-spacing-0"
                    containerClassName="overflow-visible"
                  >
                    <TableHeader className="sticky top-0 z-30 isolate border-b border-border bg-card shadow-[0_1px_0_0_hsl(var(--border))] [&_th]:bg-card [&_th:first-child]:rounded-ss-md [&_th:last-child]:rounded-se-md [&_tr]:border-b-0">
                      <TableRow className="border-b-0 hover:bg-transparent">
                        <TableHead className="min-w-[120px]">
                          {t("quote.dxfPhase.dxfReviewTable.colPartNumber")}
                        </TableHead>
                        <TableHead className="min-w-[88px]">
                          <ReviewTableHeadWithHint
                            label={t("quote.dxfPhase.dxfReviewTable.colQuantity")}
                            hint={
                              !mappedExcelRows?.length
                                ? t("quote.dxfPhase.dxfReviewTable.qtyColumnNoExcelHint")
                                : null
                            }
                          />
                        </TableHead>
                        <TableHead className="min-w-[88px]">
                          <ReviewTableHeadWithHint
                            label={t("quote.dxfPhase.dxfReviewTable.colThickness")}
                            hint={
                              !mappedExcelRows?.length
                                ? t("quote.dxfPhase.dxfReviewTable.thkColumnNoExcelHint")
                                : null
                            }
                          />
                        </TableHead>
                        <TableHead className="min-w-[88px]">
                          {t("quote.dxfPhase.dxfReviewTable.colWidth")}
                        </TableHead>
                        <TableHead className="min-w-[88px]">
                          {t("quote.dxfPhase.dxfReviewTable.colLength")}
                        </TableHead>
                        <TableHead className="min-w-[88px]">
                          {t("quote.dxfPhase.dxfReviewTable.colWeight")}
                        </TableHead>
                        <TableHead className="min-w-[88px]">
                          {t("quote.dxfPhase.dxfReviewTable.colArea")}
                        </TableHead>
                        <TableHead className="min-w-[80px]">
                          {t("quote.dxfPhase.dxfReviewTable.colPiercing")}
                        </TableHead>
                        <TableHead className="min-w-[120px]">
                          {t("quote.dxfPhase.dxfReviewTable.colMaterialGrade")}
                        </TableHead>
                        <TableHead className="min-w-[140px]">
                          {t("quote.dxfPhase.dxfReviewTable.colFinish")}
                        </TableHead>
                        <TableHead className="w-[72px]">
                          {t("quote.dxfPhase.dxfReviewTable.colPreview")}
                        </TableHead>
                        <TableHead className="min-w-[4.5rem] py-2 text-center text-xs font-medium">
                          {t("quote.dxfPhase.dxfReviewTable.deleteColumnHeader")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uploadedFiles.map((upload, index) => {
                      const geom = upload.parsed?.processedGeometry;
                      const bbox = geom?.boundingBox;

                      const densityKgPerM3 = materialConfig.densityKgPerM3;
                      const thMm = clampPositiveThicknessMm(upload.thicknessMm);
                      const unitAreaM2 = geom ? bboxFootprintAreaM2(geom) : 0;
                      const unitWeightKg =
                        unitAreaM2 > 0
                          ? unitAreaM2 * (thMm / 1000) * densityKgPerM3
                          : 0;
                      const qty = Math.max(1, Math.floor(Number(upload.quantity)) || 1);
                      const totalWeightKg = unitWeightKg * qty;
                      const totalAreaM2 = unitAreaM2 * qty;

                      const dim1 = bbox?.width ?? 0;
                      const dim2 = bbox?.height ?? 0;
                      const widthMm = dim1 > 0 && dim2 > 0 ? Math.min(dim1, dim2) : dim1 || dim2;
                      const lengthMm = dim1 > 0 && dim2 > 0 ? Math.max(dim1, dim2) : 0;

                      const partLabel =
                        upload.parsed?.guessedPartName ||
                        upload.file.name.replace(/\.dxf$/i, "");

                        return (
                          <TableRow
                            key={
                              upload.parsed?.id ??
                              `${upload.file.name}-${upload.file.size}-${upload.file.lastModified}`
                            }
                          >
                            <TableCell className="font-medium">{partLabel}</TableCell>
                            <TableCell>
                              <Input
                                type="text"
                                inputMode="numeric"
                                autoComplete="off"
                                spellCheck={false}
                                className="h-8 w-20"
                                value={String(upload.quantity)}
                                onChange={(e) => {
                                  const digits = e.target.value.replace(/\D/g, "");
                                  if (digits === "") {
                                    updateUploadRow(index, { quantity: 1 });
                                    return;
                                  }
                                  const v = parseInt(digits, 10);
                                  updateUploadRow(index, {
                                    quantity: Number.isFinite(v) ? Math.max(1, v) : 1,
                                  });
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="text"
                                inputMode="decimal"
                                autoComplete="off"
                                spellCheck={false}
                                className="h-8 w-[4.5rem] tabular-nums"
                                value={
                                  Number.isFinite(upload.thicknessMm)
                                    ? String(upload.thicknessMm)
                                    : ""
                                }
                                onChange={(e) => {
                                  const raw = e.target.value.replace(",", ".").trim();
                                  if (raw === "") {
                                    updateUploadRow(index, {
                                      thicknessMm: DXF_QUOTE_DEFAULT_THICKNESS_MM,
                                    });
                                    return;
                                  }
                                  const v = Number(raw);
                                  updateUploadRow(
                                    index,
                                    Number.isFinite(v) && v > 0
                                      ? { thicknessMm: v }
                                      : {
                                          thicknessMm: DXF_QUOTE_DEFAULT_THICKNESS_MM,
                                        }
                                  );
                                }}
                              />
                            </TableCell>
                          <TableCell>
                            {bbox ? formatDecimal(widthMm, 1) : "-"}
                          </TableCell>
                          <TableCell>
                            {bbox ? formatDecimal(lengthMm, 1) : "-"}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {totalWeightKg > 0
                              ? formatDecimal(totalWeightKg, 2)
                              : "-"}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {unitAreaM2 > 0
                              ? formatDecimal(totalAreaM2, 4)
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {geom?.preparation?.manufacturing?.cutInner?.length ?? 0}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={
                                upload.materialGrade.trim() ||
                                defaultMaterialGradeForFamily(materialType)
                              }
                              onValueChange={(v) =>
                                updateUploadRow(index, { materialGrade: v })
                              }
                            >
                              <SelectTrigger className="h-8 min-w-[7rem] max-w-[200px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {selectOptionsWithCurrent(
                                  materialConfig.enabledGrades,
                                  upload.materialGrade.trim() ||
                                    defaultMaterialGradeForFamily(materialType)
                                ).map((g) => (
                                  <SelectItem key={g} value={g}>
                                    {g}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={normalizeFinishFromImport(
                                materialType,
                                upload.finish,
                                materialConfig
                              )}
                              onValueChange={(v) =>
                                updateUploadRow(index, { finish: v })
                              }
                            >
                              <SelectTrigger className="h-8 w-[160px] max-w-[220px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {selectOptionsWithCurrent(
                                  materialConfig.enabledFinishes,
                                  normalizeFinishFromImport(
                                    materialType,
                                    upload.finish,
                                    materialConfig
                                  )
                                ).map((f) => (
                                  <SelectItem key={f} value={f}>
                                    {f}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              aria-label={t("quote.dxfPhase.dxfReviewTable.colPreview")}
                              onClick={() =>
                                upload.parsed?.processedGeometry &&
                                setPreviewUploadIndex(index)
                              }
                              disabled={!upload.parsed}
                              className={cn(
                                "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md p-0",
                                "text-[#6A23F7] hover:bg-white/5",
                                "disabled:pointer-events-none disabled:opacity-50",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                              )}
                            >
                              <Eye
                                className="h-4 w-4"
                                stroke="#6A23F7"
                                strokeWidth={2}
                                aria-hidden
                              />
                            </button>
                          </TableCell>
                          <TableCell className="py-2 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => removeUploadAtIndex(index)}
                              aria-label={t(
                                "quote.dxfPhase.dxfReviewTable.deleteRowAria"
                              )}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    </TableBody>
                  </Table>
                </div>
              </TooltipProvider>
                </CardContent>
              </Card>

              {!hideBottomNavigation && (
                <div className="flex items-center justify-between">
                  <Button variant="outline" onClick={handleBackToParse}>
                    Back to Parse
                  </Button>
                  <Button
                    onClick={handleContinueToNextPhase}
                    size="lg"
                    className="gap-2"
                    disabled={metrics.validParts === 0}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Continue to Next Phase
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}

      <ExcelColumnMappingModal
        open={excelMappingModalOpen}
        file={excelModalFile}
        arrayBuffer={excelModalBuffer}
        onComplete={handleExcelMappingComplete}
        onDiscard={handleExcelMappingDiscard}
      />

      {/* Part preview — compact modal: preview strip + edge-to-edge stat grid */}
      <Dialog
        open={previewUploadIndex !== null}
        onOpenChange={(open) => !open && setPreviewUploadIndex(null)}
      >
        <DialogContent
          showCloseButton={false}
          className={cn(
            "flex h-auto min-h-[min(88vh,760px)] max-h-[min(96vh,980px)] w-[calc(100vw-1.5rem)] max-w-[27.5rem] flex-col gap-0 overflow-hidden border-white/10 bg-card p-0 sm:max-w-[30rem] sm:rounded-xl"
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden" dir="rtl">
            <DialogTitle className="sr-only">
              {t("quote.dxfPhase.partPreviewModal.a11yTitle")}
            </DialogTitle>

            {/* Top: plate preview — bottom: stats (two stacked bands, no side padding on stats grid) */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div
                className="flex min-h-[min(45vh,475px)] flex-1 shrink-0 items-center justify-center px-5 py-6"
                dir="ltr"
              >
                <div
                  ref={setPreviewCanvasHostRef}
                  className="relative flex h-[min(425px,52vh)] w-full min-w-0 max-w-full items-center justify-center overflow-hidden bg-transparent"
                >
                  {previewPartStats &&
                    previewCanvasSize.w > 0 &&
                    previewCanvasSize.h > 0 && (
                      <PlateGeometryCanvas
                        geometry={previewPartStats.geom}
                        unitSystem="metric"
                        width={previewCanvasSize.w}
                        height={previewCanvasSize.h}
                        debugMode={false}
                        appearance="previewModal"
                      />
                    )}
                </div>
              </div>

              <div className="w-full shrink-0 border-t border-white/10">
                {previewPartStats ? (
                  <div dir="ltr" className="w-full overflow-hidden">
                    <div className="grid w-full grid-cols-4 grid-rows-2">
                      {(
                        [
                          {
                            key: "finish",
                            icon: Palette,
                            label: t("quote.dxfPhase.partPreviewModal.finish"),
                            value: previewPartStats.finish,
                          },
                          {
                            key: "thickness",
                            icon: Layers,
                            label: t("quote.dxfPhase.partPreviewModal.thickness"),
                            value: (
                              <StatValueUnitLeft
                                numericText={formatDecimal(previewPartStats.thMm, 1)}
                                unitSuffix={t("quote.dxfPhase.partPreviewModal.mmSuffix")}
                              />
                            ),
                          },
                          {
                            key: "quantity",
                            icon: Hash,
                            label: t("quote.dxfPhase.partPreviewModal.quantity"),
                            value: previewPartStats.qty,
                          },
                          {
                            key: "plateName",
                            icon: Tag,
                            label: t("quote.dxfPhase.partPreviewModal.plateName"),
                            value: previewPartStats.partLabel,
                          },
                          {
                            key: "weight",
                            icon: Weight,
                            label: t("quote.dxfPhase.partPreviewModal.weight"),
                            value:
                              previewPartStats.totalWeightKg > 0 ? (
                                <StatValueUnitLeft
                                  numericText={formatDecimal(previewPartStats.totalWeightKg, 2)}
                                  unitSuffix={t("quote.dxfPhase.partPreviewModal.kgSuffix")}
                                />
                              ) : (
                                "-"
                              ),
                          },
                          {
                            key: "area",
                            icon: Square,
                            label: t("quote.dxfPhase.partPreviewModal.area"),
                            value:
                              previewPartStats.totalAreaM2 > 0 ? (
                                <StatValueUnitLeft
                                  numericText={formatDecimal(previewPartStats.totalAreaM2, 4)}
                                  unitSuffix={t("quote.dxfPhase.partPreviewModal.m2Suffix")}
                                />
                              ) : (
                                "-"
                              ),
                          },
                          {
                            key: "length",
                            icon: MoveHorizontal,
                            label: t("quote.dxfPhase.partPreviewModal.length"),
                            value: (
                              <StatValueUnitLeft
                                numericText={formatDecimal(previewPartStats.lengthMm, 1)}
                                unitSuffix={t("quote.dxfPhase.partPreviewModal.mmSuffix")}
                              />
                            ),
                          },
                          {
                            key: "width",
                            icon: MoveVertical,
                            label: t("quote.dxfPhase.partPreviewModal.width"),
                            value: (
                              <StatValueUnitLeft
                                numericText={formatDecimal(previewPartStats.widthMm, 1)}
                                unitSuffix={t("quote.dxfPhase.partPreviewModal.mmSuffix")}
                              />
                            ),
                          },
                        ] as const
                      ).map((cell, i) => (
                        <DxfPreviewStatCell
                          key={cell.key}
                          icon={cell.icon}
                          label={cell.label}
                          value={cell.value}
                          className={cn(
                            "border-b border-solid border-[#6A23F7]/20",
                            i % 4 === 0 && "border-s",
                            i % 4 !== 3 && "border-e"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    {t("quote.dxfPhase.partPreviewModal.noGeometry")}
                  </p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

DxfUploadStep.displayName = "DxfUploadStep";

