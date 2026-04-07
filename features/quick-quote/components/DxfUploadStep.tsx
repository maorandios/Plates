"use client";

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
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
  ChevronRight,
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
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
import {
  DEFAULT_PLATE_FINISH,
  defaultMaterialGradeForFamily,
  type PlateFinish,
} from "../lib/plateFields";
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
import { ExcelColumnMappingModal } from "./ExcelColumnMappingModal";
import { DxfExcelCompareModal } from "./DxfExcelCompareModal";
import { t } from "@/lib/i18n";

export type DxfUploadSubStep = 1 | 2 | 3;
type DxfSubStep = DxfUploadSubStep;

const SUB_STEPS = [
  { step: 1 as DxfSubStep, label: "Upload" },
  { step: 2 as DxfSubStep, label: "Parse" },
  { step: 3 as DxfSubStep, label: "Review" },
] as const;

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
  /** Review table: finish (editable; default carbon = “Carbon steel”). */
  finish: PlateFinish;
}

const DXF_FINISH_OPTIONS: { value: PlateFinish; label: string }[] = [
  { value: "carbon", label: "Carbon steel" },
  { value: "galvanized", label: "Galvanized" },
  { value: "paint", label: "Paint" },
];

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
    const finish = (g.reviewFinish as PlateFinish) ?? DEFAULT_PLATE_FINISH;
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
};

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
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [previewGeometry, setPreviewGeometry] = useState<DxfPartGeometry | null>(null);

  const excelRestoreAppliedRef = useRef(false);
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
    setCompareModalOpen(false);
    setPreviewGeometry(null);
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
            finish: "carbon" satisfies PlateFinish,
          };
        })
      );

      setUploadedFiles((prev) => [...prev, ...uploads]);
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Failed to read DXF files"
      );
    }
  }, []);

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
    setCompareModalOpen(false);
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

    setSubStep(2);
  }, [uploadedFiles, mappedExcelRows, materialType]);

  const handleRemoveFile = useCallback((index: number) => {
    setUploadedFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) {
        setSubStep(1);
        setValidationRows(null);
        setValidationSummary(null);
        setCompareModalOpen(false);
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
    setCompareModalOpen(false);
  }, []);

  const handleParseFiles = useCallback(() => {
    const parsed = parseDxfUploadsInPlace(uploadedFiles, materialType);
    const merged = mergeExcelIntoDxfUploads(parsed, null, materialType);
    setUploadedFiles(merged);
    setSubStep(3);
  }, [uploadedFiles, materialType]);

  const handleBackToUpload = useCallback(() => {
    setCompareModalOpen(false);
    setValidationRows(null);
    setValidationSummary(null);
    setSubStep(1);
  }, []);

  const handleBackToParse = useCallback(() => {
    setCompareModalOpen(false);
    if (mappedExcelRows?.length) {
      setValidationRows(null);
      setValidationSummary(null);
      setSubStep(1);
      return;
    }
    setSubStep(2);
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
        totalArea += (geom.area / 1000000) * qty; // m² × pieces
        totalPerimeter += geom.perimeter * qty;
        const areaM2 = geom.area / 1000000;
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
    });
  }, [
    subStep,
    uploadedFiles.length,
    excelMappingModalOpen,
    mappedExcelRows,
    optionalExcelFile,
    metrics.validParts,
    onDxfNavStateChange,
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
    ]
  );

  const getStatusColor = (geometry: DxfPartGeometry | null): "success" | "error" | "warning" => {
    if (!geometry || !geometry.processedGeometry) return "error";
    if (geometry.processedGeometry.status === "valid") return "success";
    if (geometry.processedGeometry.status === "warning") return "warning";
    return "error";
  };

  return (
    <div
      className={cn(
        "space-y-6",
        dxfQuotePhaseLayout && "flex h-full min-h-0 flex-1 flex-col"
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
                          isComplete && "border-emerald-600 bg-emerald-600 text-white",
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
                          !isCurrent && isComplete && "text-emerald-600",
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
                          step < subStep ? "bg-emerald-600" : "bg-border"
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
              <CardContent className="flex min-h-0 flex-1 flex-col">
                {dxfQuotePhaseLayout && uploadedFiles.length > 0 ? (
                  <div
                    className={cn(
                      "grid min-h-[200px] flex-1 place-content-center place-items-center rounded-lg border-2 border-dashed border-emerald-500/25 bg-emerald-500/[0.04] p-6 text-center transition-colors sm:p-8"
                    )}
                  >
                    <div className="flex w-full max-w-md flex-col items-center gap-4">
                      {/* Inline colors: globals/base can override Tailwind arbitrary classes on nested text */}
                      <div
                        className="inline-flex max-w-full items-center gap-4 rounded-full border-2 px-5 py-2.5 text-sm font-medium leading-snug shadow-[inset_0_1px_0_rgba(0,255,159,0.08)]"
                        style={{
                          backgroundColor: "#0D281D",
                          borderColor: "#00FF9F",
                          color: "#00FFB7",
                        }}
                      >
                        <svg
                          width={12}
                          height={12}
                          viewBox="0 0 12 12"
                          className="block shrink-0 animate-dxf-status-dot overflow-visible"
                          aria-hidden
                        >
                          <circle cx="6" cy="6" r="5" fill="#00FF9F" />
                        </svg>
                        <span className="text-center" style={{ color: "#00FFB7" }}>
                          {uploadedFiles.length === 1
                            ? t("quote.dxfPhase.dxfFilesCapturedSummaryOne")
                            : t("quote.dxfPhase.dxfFilesCapturedSummaryMany", {
                                n: uploadedFiles.length,
                              })}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-white/15 text-muted-foreground hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                        onClick={handleClearDxfFiles}
                        aria-label={t("quote.dxfPhase.dxfClearUploadAria")}
                      >
                        {t("quote.dxfPhase.dxfCancelUpload")}
                      </Button>
                    </div>
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
              <CardContent className="flex min-h-0 flex-1 flex-col">
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

                {optionalExcelFile && mappedExcelRows && mappedExcelRows.length > 0 && (
                  <div className="mt-4 flex items-center justify-between gap-2 p-3 rounded-lg border bg-emerald-500/5 border-emerald-500/20">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="text-sm truncate">{optionalExcelFile.name}</span>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {formatDecimal(optionalExcelFile.size / 1024, 1)} KB
                      </Badge>
                      <Badge className="text-xs shrink-0 bg-emerald-600/15 text-emerald-800 dark:text-emerald-200">
                        {dxfQuotePhaseLayout
                          ? t("quote.dxfPhase.excelRowsMapped", {
                              n: mappedExcelRows.length,
                            })
                          : `${mappedExcelRows.length} rows mapped`}
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveOptionalExcel}
                      className="shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {excelUploadError && (
                  <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
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
                {mappedExcelRows?.length ? "Continue to review" : "Continue to parse"}
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
          {mappedExcelRows?.length &&
            validationSummary &&
            validationRows &&
            validationRows.length > 0 && (
              <button
                type="button"
                onClick={() => setCompareModalOpen(true)}
                className={cn(
                  "w-full text-left rounded-lg border p-4 flex items-start gap-3 transition-colors",
                  "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  validationSummary.warnings > 0 || validationSummary.critical > 0
                    ? "border-amber-500/50 bg-amber-500/[0.06]"
                    : "border-emerald-500/40 bg-emerald-500/[0.05]"
                )}
              >
                {validationSummary.warnings > 0 || validationSummary.critical > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {validationSummary.warnings > 0 || validationSummary.critical > 0
                      ? "We found differences between your Excel BOM and DXF geometry"
                      : "Excel BOM and DXF geometry match within tolerance"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {validationSummary.warnings > 0 || validationSummary.critical > 0
                      ? "Open the full comparison table to review dimensions, area, weight, and material. You can export a CSV report."
                      : "Open the comparison table to inspect details or export a CSV report."}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </button>
            )}

          {validationSummary && validationRows && validationRows.length > 0 && (
            <DxfExcelCompareModal
              open={compareModalOpen}
              onOpenChange={setCompareModalOpen}
              summary={validationSummary}
              rows={validationRows}
            />
          )}

          {/* Parts Table */}
          <Card>
            <CardHeader>
              <CardTitle>DXF Parts Data</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Parsed geometry and part information
                {mappedExcelRows?.length
                  ? " — quantity, material grade, and thickness (when mapped) are taken from the Excel list where part names match; otherwise quantity is 1, thickness defaults to 2 mm, and grade follows the DXF. All values stay editable."
                  : ""}
              </p>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px]">Part Number</TableHead>
                      <TableHead className="min-w-[88px]">Quantity</TableHead>
                      <TableHead className="min-w-[88px]">Thickness (mm)</TableHead>
                      <TableHead className="min-w-[88px]">Width (mm)</TableHead>
                      <TableHead className="min-w-[88px]">Length (mm)</TableHead>
                      <TableHead className="min-w-[88px]">Weight (kg)</TableHead>
                      <TableHead className="min-w-[88px]">Area (m²)</TableHead>
                      <TableHead className="min-w-[100px]">Perimeter (mm)</TableHead>
                      <TableHead className="min-w-[80px]">Piercing</TableHead>
                      <TableHead className="min-w-[120px]">Material Grade</TableHead>
                      <TableHead className="min-w-[140px]">Finish</TableHead>
                      <TableHead className="w-[72px]">Preview</TableHead>
                      <TableHead className="w-[72px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploadedFiles.map((upload, index) => {
                      const geom = upload.parsed?.processedGeometry;
                      const bbox = geom?.boundingBox;
                      const status = getStatusColor(upload.parsed);
                      const hasError = upload.parseError !== null;

                      const materialConfig = getMaterialConfig(materialType);
                      const densityKgPerM3 = materialConfig.densityKgPerM3;
                      const thMm = clampPositiveThicknessMm(upload.thicknessMm);
                      const unitWeightKg =
                        geom && geom.area > 0
                          ? (geom.area / 1_000_000) * (thMm / 1000) * densityKgPerM3
                          : 0;

                      const dim1 = bbox?.width ?? 0;
                      const dim2 = bbox?.height ?? 0;
                      const widthMm = dim1 > 0 && dim2 > 0 ? Math.min(dim1, dim2) : dim1 || dim2;
                      const lengthMm = dim1 > 0 && dim2 > 0 ? Math.max(dim1, dim2) : 0;

                      const partLabel =
                        upload.parsed?.guessedPartName ||
                        upload.file.name.replace(/\.dxf$/i, "");

                      return (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{partLabel}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              className="h-8 w-20"
                              value={upload.quantity}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                updateUploadRow(
                                  index,
                                  Number.isFinite(v) && v >= 1
                                    ? { quantity: Math.floor(v) }
                                    : { quantity: 1 }
                                );
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0.1}
                              step={0.1}
                              className="h-8 w-[4.5rem] tabular-nums"
                              value={Number.isFinite(upload.thicknessMm) ? upload.thicknessMm : ""}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                updateUploadRow(
                                  index,
                                  Number.isFinite(v) && v > 0
                                    ? { thicknessMm: v }
                                    : { thicknessMm: DXF_QUOTE_DEFAULT_THICKNESS_MM }
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
                          <TableCell>
                            {unitWeightKg > 0
                              ? formatDecimal(unitWeightKg, 2)
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {geom ? formatDecimal(geom.area / 1_000_000, 4) : "-"}
                          </TableCell>
                          <TableCell>
                            {geom ? formatDecimal(geom.perimeter, 1) : "-"}
                          </TableCell>
                          <TableCell>
                            {geom?.preparation?.manufacturing?.cutInner?.length ?? 0}
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 min-w-[7rem]"
                              value={upload.materialGrade}
                              onChange={(e) =>
                                updateUploadRow(index, {
                                  materialGrade: e.target.value,
                                })
                              }
                              placeholder="Grade"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={upload.finish}
                              onValueChange={(v) =>
                                updateUploadRow(index, {
                                  finish: v as PlateFinish,
                                })
                              }
                            >
                              <SelectTrigger className="h-8 w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DXF_FINISH_OPTIONS.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPreviewGeometry(upload.parsed)}
                              className="h-7 w-7 p-0"
                              disabled={!upload.parsed}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                          <TableCell>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={cn(
                                      "h-2.5 w-2.5 rounded-full cursor-pointer",
                                      status === "success" && "bg-emerald-600",
                                      status === "warning" && "bg-amber-500",
                                      status === "error" && "bg-destructive"
                                    )}
                                  />
                                </TooltipTrigger>
                                {(status === "error" || status === "warning") &&
                                  hasError && (
                                    <TooltipContent side="left" className="max-w-xs">
                                      <p className="text-xs">{upload.parseError}</p>
                                    </TooltipContent>
                                  )}
                                {status === "success" && (
                                  <TooltipContent side="left">
                                    <p className="text-xs">Valid geometry</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
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

      <ExcelColumnMappingModal
        open={excelMappingModalOpen}
        file={excelModalFile}
        arrayBuffer={excelModalBuffer}
        onComplete={handleExcelMappingComplete}
        onDiscard={handleExcelMappingDiscard}
      />

      {/* Preview Modal */}
      <Dialog open={previewGeometry !== null} onOpenChange={(open) => !open && setPreviewGeometry(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Part Preview</DialogTitle>
            <DialogDescription>
              {previewGeometry?.guessedPartName || "DXF Part"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto max-h-[calc(90vh-200px)]">
            {previewGeometry?.processedGeometry && (
              <>
                {/* Geometry Canvas */}
                <div className="rounded-lg border bg-muted/10 p-4">
                  <PlateGeometryCanvas
                    geometry={previewGeometry.processedGeometry}
                    unitSystem="metric"
                    width={800}
                    height={500}
                    debugMode={false}
                  />
                </div>

                {/* Parameters */}
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm font-semibold mb-3">Part Parameters</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Width:</span>
                      <span className="ml-2 font-medium">
                        {formatDecimal(previewGeometry.processedGeometry.boundingBox.width, 2)} mm
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Height:</span>
                      <span className="ml-2 font-medium">
                        {formatDecimal(previewGeometry.processedGeometry.boundingBox.height, 2)} mm
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Area:</span>
                      <span className="ml-2 font-medium">
                        {formatDecimal(previewGeometry.processedGeometry.area / 1000000, 4)} m²
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Perimeter:</span>
                      <span className="ml-2 font-medium">
                        {formatDecimal(previewGeometry.processedGeometry.perimeter, 2)} mm
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Holes:</span>
                      <span className="ml-2 font-medium">
                        {previewGeometry.processedGeometry.holes?.length || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Entities:</span>
                      <span className="ml-2 font-medium">
                        {previewGeometry.entityCount}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
            {!previewGeometry?.processedGeometry && (
              <div className="p-8 rounded-lg bg-muted/30 text-center">
                <p className="text-sm text-muted-foreground">
                  No geometry data available
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setPreviewGeometry(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

DxfUploadStep.displayName = "DxfUploadStep";

