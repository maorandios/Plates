"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  RefreshCw,
  TableProperties,
  Bug,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shared/PageContainer";
import { EmptyState } from "@/components/shared/EmptyState";
import { PartsTable } from "@/features/parts/PartsTable";
import {
  getBatchById,
  getBatchMatchInputs,
  getPartsByBatch,
  deletePartUploadSources,
  saveParts,
} from "@/lib/store";
import { reprocessDxfGeometry } from "@/lib/geometry";
import { rebuildUnifiedPartsForBatch } from "@/lib/parts/rebuildBatchParts";
import { estimateDxfTotalWeightKg } from "@/lib/parts/excelDxfValidation";
import { plateTypeDedupeKey } from "@/lib/parts/plateTypeKey";
import { useAppPreferences } from "@/features/settings/useAppPreferences";
import {
  formatAreaValueOnly,
  formatLengthValueOnly,
  formatWeightValueOnly,
  summaryTotalAreaLabel,
  summaryTotalWeightLabel,
} from "@/lib/settings/unitSystem";
import type { Batch, Part, UploadedFile, ExcelRow } from "@/types";

interface GeomDiag {
  total: number;
  valid: number;
  warning: number;
  error: number;
  noGeometry: number;
  samples: Array<{ name: string; status: string; message?: string; area: number; perimeter: number }>;
}

interface DiagData {
  clients: number;
  excelFiles: UploadedFile[];
  dxfCount: number;
  excelRows: ExcelRow[];
  geom: GeomDiag;
}

function useBatchIdParam(): string {
  const params = useParams();
  const raw = params?.id;
  return typeof raw === "string" ? raw : Array.isArray(raw) ? (raw[0] ?? "") : "";
}

export default function PartsReviewPage() {
  const batchId = useBatchIdParam();
  const router = useRouter();
  const { preferences } = useAppPreferences();
  const unitSystem = preferences.unitSystem;

  const [batch, setBatch] = useState<Batch | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [diag, setDiag] = useState<DiagData | null>(null);
  const [showDiag, setShowDiag] = useState(false);

  const loadBatch = useCallback(() => {
    if (!batchId) return;
    const b = getBatchById(batchId);
    if (!b) {
      router.push("/batches");
      return;
    }
    setBatch(b);
  }, [batchId, router]);

  const buildParts = useCallback(() => {
    if (!batchId) return;
    setIsBuilding(true);
    try {
      const built = rebuildUnifiedPartsForBatch(batchId);
      setParts(built);

      const { clients, files, excelRows, dxfGeometries: rawDxfGeometries } =
        getBatchMatchInputs(batchId);
      const dxfGeometries = rawDxfGeometries.map((geo) =>
        reprocessDxfGeometry(geo)
      );

      const geomDiag: GeomDiag = {
        total: dxfGeometries.length,
        valid: 0,
        warning: 0,
        error: 0,
        noGeometry: 0,
        samples: [],
      };

      for (const geo of dxfGeometries) {
        const g = geo.processedGeometry;
        if (!g) {
          geomDiag.noGeometry++;
        } else if (g.status === "valid") {
          geomDiag.valid++;
        } else if (g.status === "warning") {
          geomDiag.warning++;
        } else {
          geomDiag.error++;
        }
        if (geomDiag.samples.length < 5) {
          geomDiag.samples.push({
            name: geo.guessedPartName,
            status: g?.status ?? "none",
            message: g?.statusMessage,
            area: g?.area ?? 0,
            perimeter: g?.perimeter ?? 0,
          });
        }
      }

      setDiag({
        clients: clients.length,
        excelFiles: files.filter((f) => f.type === "excel"),
        dxfCount: dxfGeometries.length,
        excelRows,
        geom: geomDiag,
      });
    } catch (e) {
      console.error("[PartsReview] Rebuild failed:", e);
    } finally {
      setIsBuilding(false);
    }
  }, [batchId]);

  const handleRemoveParts = useCallback(
    (toRemove: Part[]) => {
      if (toRemove.length === 0) return;
      const removeIds = new Set(toRemove.map((p) => p.id));
      for (const p of toRemove) {
        deletePartUploadSources(p);
      }
      setParts((prev) => {
        const next = prev.filter((x) => !removeIds.has(x.id));
        saveParts(batchId, next);
        return next;
      });
    },
    [batchId]
  );

  useEffect(() => {
    if (!batchId) return;
    loadBatch();
    const cached = getPartsByBatch(batchId);
    if (cached.length > 0) {
      setParts(cached);
      // Load diag from cached data — geometry will refresh on next Rebuild
      const { clients, files, excelRows, dxfGeometries } = getBatchMatchInputs(batchId);
      const geomCounts = dxfGeometries.reduce(
        (acc, g) => {
          const s = g.processedGeometry?.status;
          if (!s) acc.noGeometry++;
          else if (s === "valid") acc.valid++;
          else if (s === "warning") acc.warning++;
          else acc.error++;
          return acc;
        },
        { valid: 0, warning: 0, error: 0, noGeometry: 0 }
      );
      setDiag({
        clients: clients.length,
        excelFiles: files.filter((f) => f.type === "excel"),
        dxfCount: dxfGeometries.length,
        excelRows,
        geom: { total: dxfGeometries.length, samples: [], ...geomCounts },
      });
    } else {
      buildParts();
    }
  }, [batchId, loadBatch, buildParts]);

  /** Aggregates from the current parts list (DXF area × qty; DXF-estimated weight). */
  const plateSummary = useMemo(() => {
    const plateTypes = new Set(parts.map(plateTypeDedupeKey)).size;
    const platesQuantity = parts.reduce((s, p) => s + (p.quantity ?? 1), 0);
    let platesAreaM2 = 0;
    let totalWeightKg = 0;
    const thicknessSet = new Set<number>();
    for (const p of parts) {
      if (p.thickness != null && p.thickness > 0) thicknessSet.add(p.thickness);
      const q = p.quantity ?? 1;
      if (p.dxfArea != null && p.dxfArea > 0) {
        platesAreaM2 += (p.dxfArea / 1_000_000) * q;
      }
      const w = estimateDxfTotalWeightKg(p);
      if (w != null) totalWeightKg += w;
    }
    return {
      plateTypes,
      platesQuantity,
      platesAreaM2,
      thicknessTypes: thicknessSet.size,
      totalWeightKg,
    };
  }, [parts]);

  const hasExcelProblem =
    diag &&
    diag.excelFiles.length > 0 &&
    diag.excelRows.length === 0;

  return (
    <PageContainer embedded>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-foreground tracking-tight">
            Review parts
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {batch
              ? `Review and edit parts for ${batch.name}. Fix quantities, materials, or thicknesses as needed.`
              : "Review and edit parts for this quote."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDiag((v) => !v)}
            className="text-muted-foreground"
          >
            <Bug className="h-4 w-4 mr-1" />
            Diagnostics
            {showDiag ? (
              <ChevronUp className="h-3 w-3 ml-1" />
            ) : (
              <ChevronDown className="h-3 w-3 ml-1" />
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={buildParts}
            disabled={isBuilding}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isBuilding ? "animate-spin" : ""}`}
            />
            Rebuild Table
          </Button>
        </div>
      </div>

      {/* ── Diagnostics panel ─────────────────────────────────────────────── */}
      {showDiag && diag && (
        <div className="mb-6 rounded-xl bg-muted/30 p-4 text-sm space-y-3">
          <p className="font-semibold text-foreground">Store Diagnostics</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <DiagCell label="Clients" value={diag.clients} />
            <DiagCell label="DXF Geometries" value={diag.dxfCount} />
            <DiagCell label="Excel Files" value={diag.excelFiles.length} />
            <DiagCell
              label="Excel Rows in Store"
              value={diag.excelRows.length}
              highlight={diag.excelFiles.length > 0 && diag.excelRows.length === 0}
            />
          </div>

          {/* Geometry status breakdown */}
          {diag.geom.total > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Geometry Processing Results
                <span className="ml-2 font-normal normal-case text-muted-foreground">
                  (refreshed on every Rebuild)
                </span>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                <DiagCell label="Valid" value={diag.geom.valid} />
                <DiagCell label="Warning" value={diag.geom.warning} />
                <DiagCell
                  label="Error"
                  value={diag.geom.error}
                  highlight={diag.geom.error > 0}
                />
                <DiagCell
                  label="No Geometry"
                  value={diag.geom.noGeometry}
                  highlight={diag.geom.noGeometry > 0}
                />
              </div>
              {diag.geom.samples.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Sample parts (first 5):</p>
                  {diag.geom.samples.map((s, i) => (
                    <div
                      key={i}
                      className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-1.5 rounded-lg bg-background text-xs font-mono"
                    >
                      <span className="font-semibold text-foreground">{s.name}</span>
                      <span
                        className={
                          s.status === "valid"
                            ? "text-primary"
                            : s.status === "warning"
                            ? "text-amber-600"
                            : s.status === "error"
                            ? "text-red-600"
                            : "text-muted-foreground"
                        }
                      >
                        {s.status}
                      </span>
                      {s.area > 0 && (
                        <span className="text-muted-foreground">
                          {unitSystem === "metric" ? "area (m²)" : "area (ft²)"}:{" "}
                          {formatAreaValueOnly(s.area / 1_000_000, unitSystem)}
                        </span>
                      )}
                      {s.perimeter > 0 && (
                        <span className="text-muted-foreground">
                          {unitSystem === "metric" ? "perim (mm)" : "perim (in)"}:{" "}
                          {formatLengthValueOnly(s.perimeter, unitSystem)}
                        </span>
                      )}
                      {s.message && (
                        <span className="text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 w-full mt-0.5">
                          ⚠ {s.message}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Excel files detail */}
          {diag.excelFiles.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Excel Files
              </p>
              <div className="space-y-1">
                {diag.excelFiles.map((f) => (
                  <div
                    key={f.id}
                    className="flex flex-wrap items-start gap-x-3 gap-y-0.5 px-3 py-1.5 rounded-lg bg-background text-xs"
                  >
                    <span className="font-medium text-foreground">{f.name}</span>
                    <span
                      className={
                        f.parseStatus === "error"
                          ? "text-red-600"
                          : f.parsedRowCount === 0
                          ? "text-amber-600 font-semibold"
                          : "text-primary"
                      }
                    >
                      status: {f.parseStatus}
                      {f.parsedRowCount !== undefined && ` · ${f.parsedRowCount} rows`}
                    </span>
                    {f.parseWarnings && f.parseWarnings.length > 0 && (
                      <ul className="w-full mt-0.5 space-y-0.5">
                        {f.parseWarnings.map((w, i) => (
                          <li key={i} className="text-amber-700 bg-amber-50 rounded px-2 py-0.5">
                            ⚠ {w}
                          </li>
                        ))}
                      </ul>
                    )}
                    {f.parseError && (
                      <span className="w-full text-red-600 bg-red-50 rounded px-2 py-0.5 mt-0.5">
                        ✕ {f.parseError}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* First 3 Excel rows preview */}
          {diag.excelRows.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Sample Excel Rows (first 3)
              </p>
              <div className="space-y-1">
                {diag.excelRows.slice(0, 3).map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap gap-3 px-3 py-1.5 rounded-lg bg-background text-xs font-mono"
                  >
                    <span>
                      <span className="text-muted-foreground">part: </span>
                      <span className="text-foreground font-semibold">{r.partName}</span>
                    </span>
                    <span>
                      <span className="text-muted-foreground">qty: </span>{r.quantity}
                    </span>
                    {r.thickness != null && (
                      <span>
                        <span className="text-muted-foreground">thk: </span>{r.thickness}
                      </span>
                    )}
                    {r.material && (
                      <span>
                        <span className="text-muted-foreground">mat: </span>{r.material}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasExcelProblem && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-amber-800 text-xs">
              <strong>Excel files uploaded but 0 rows in store.</strong> Check the warnings above for the exact reason.
              Try re-uploading the Excel file — the warning message will tell you what column headers were found.
            </div>
          )}
        </div>
      )}

      {/* ── Summary chips ──────────────────────────────────────────────────── */}
      {parts.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-6">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-sm"
            title="Distinct plates: same part name can count multiple times when DXF, thickness, material, or stock W×L×area differ."
          >
            <span className="font-semibold text-foreground">{plateSummary.plateTypes}</span>
            <span className="text-muted-foreground">plate types</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-sm">
            <span className="font-semibold text-foreground">{plateSummary.platesQuantity}</span>
            <span className="text-muted-foreground">plates quantity</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-sm">
            <span className="font-semibold text-foreground tabular-nums">
              {formatAreaValueOnly(plateSummary.platesAreaM2, unitSystem)}
            </span>
            <span className="text-muted-foreground">{summaryTotalAreaLabel(unitSystem)}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-sm">
            <span className="font-semibold text-foreground">{plateSummary.thicknessTypes}</span>
            <span className="text-muted-foreground">thickness types</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-sm">
            <span className="font-semibold text-foreground tabular-nums">
              {formatWeightValueOnly(plateSummary.totalWeightKg, unitSystem)}
            </span>
            <span className="text-muted-foreground">{summaryTotalWeightLabel(unitSystem)}</span>
          </div>
        </div>
      )}

      {parts.length === 0 ? (
        <EmptyState
          icon={TableProperties}
          title="No parts found"
          description="Add clients and upload DXF or Excel files in Import data (step 1) to populate this table."
          action={
            <Button asChild>
              <Link href={`/batches/${batchId}`}>Go to Import data</Link>
            </Button>
          }
        />
      ) : (
        <PartsTable parts={parts} onRemoveParts={handleRemoveParts} />
      )}
    </PageContainer>
  );
}

function DiagCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        highlight
          ? "border-amber-300 bg-amber-50"
          : "border-border bg-background"
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-xl font-bold mt-0.5 ${
          highlight ? "text-amber-700" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
