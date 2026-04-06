"use client";

import { useEffect, useMemo, useState } from "react";
import { X, AlertCircle, Ruler } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { CleanedGeometryResult, Part } from "@/types";
import { PlateGeometryCanvas } from "./PlateGeometryCanvas";
import { GeometryDebugPanel } from "./GeometryDebugPanel";
import { getBatchById, getDxfGeometryByFile } from "@/lib/store";
import { getMarkingText, reprocessDxfGeometry } from "@/lib/geometry";
import { getResolvedThicknessCuttingRule } from "@/lib/nesting/resolvedCuttingRules";
import { estimateHoleDiameterMm } from "@/lib/geometry/dimensions";
import { useAppPreferences } from "@/features/settings/useAppPreferences";
import { formatArea, formatHoleDiameter, formatLength } from "@/lib/settings/unitSystem";

interface PartPreviewModalProps {
  part: Part;
  open: boolean;
  onClose: () => void;
}

function hasDebugDrawable(c: CleanedGeometryResult): boolean {
  const pre = c.reconstructedClosedLoops ?? [];
  const inv = c.invalidFragments ?? [];
  const rem = c.removedFragments ?? [];
  const disc = c.classificationDiscarded ?? [];
  return (
    c.outerContour.length > 1 ||
    pre.some((r) => r.length > 1) ||
    inv.some((r) => r.length > 1) ||
    rem.some((r) => r.length > 1) ||
    disc.some((r) => r.length > 1)
  );
}

export function PartPreviewModal({ part, open, onClose }: PartPreviewModalProps) {
  const { preferences } = useAppPreferences();
  const unitSystem = preferences.unitSystem;

  const [measureMode, setMeasureMode] = useState(false);
  const [clearMeasurementKey, setClearMeasurementKey] = useState(0);
  const [debugGeometry, setDebugGeometry] = useState(false);

  /** Stored geometry omits vertices; rebuild from DXF file text when preview opens. */
  const geometry = useMemo(() => {
    if (!open || !part.dxfFileId) return null;
    const stored = getDxfGeometryByFile(part.dxfFileId);
    if (!stored) return null;
    return reprocessDxfGeometry(stored).processedGeometry;
  }, [open, part.dxfFileId]);

  const cleaned = geometry?.preparation?.cleaned;
  const canDebug = Boolean(cleaned);
  const debugDrawable = cleaned ? hasDebugDrawable(cleaned) : false;

  const hasRenderableContours = Boolean(geometry && geometry.outer.length > 0);
  const showCanvas =
    geometry &&
    (hasRenderableContours || (debugGeometry && canDebug && debugDrawable));

  const prep = cleaned;
  const cleanupStatus =
    prep?.cleanupStatus ??
    (geometry?.status === "valid"
      ? "ready"
      : geometry?.status === "warning"
        ? "warning"
        : "error");
  const prepMessages = [
    ...(prep?.warnings ?? []),
    ...(prep?.errors ?? []),
  ];
  if (geometry?.statusMessage) prepMessages.push(geometry.statusMessage);

  useEffect(() => {
    if (!open) {
      setMeasureMode(false);
      setClearMeasurementKey((k) => k + 1);
      setDebugGeometry(false);
    }
  }, [open]);

  const markingPaths = geometry?.preparation?.manufacturing?.marking?.paths ?? [];

  const plateMarkingText = useMemo(() => {
    const batch = getBatchById(part.batchId);
    if (!batch) {
      return getMarkingText(part, {
        markPartName: true,
        includeClientCode: false,
      });
    }
    const resolved = getResolvedThicknessCuttingRule(
      batch,
      part.thickness ?? null,
      unitSystem
    );
    return getMarkingText(part, {
      markPartName: resolved.defaultMarkPartName,
      includeClientCode: resolved.defaultIncludeClientCode,
    });
  }, [
    part.batchId,
    part.thickness,
    part.partName,
    part.clientCode,
    unitSystem,
  ]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogDescription className="sr-only">
            Plate geometry preview with optional debug layers and distance measurement
          </DialogDescription>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-xl font-semibold text-foreground">
                {part.partName}
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="secondary" className="font-mono font-bold">
                  {part.clientCode}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {part.clientName}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Part metadata grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-4 border-y border-border">
          {part.quantity != null && (
            <MetaItem label="Quantity" value={part.quantity.toString()} />
          )}
          {part.thickness != null && (
            <MetaItem label="Thickness" value={formatLength(part.thickness, unitSystem)} />
          )}
          {part.material && <MetaItem label="Material" value={part.material} />}
          {part.dxfArea != null && (
            <MetaItem
              label="DXF Area"
              value={formatArea(part.dxfArea / 1_000_000, unitSystem)}
            />
          )}
          {part.dxfPerimeter != null && (
            <MetaItem
              label="Perimeter"
              value={formatLength(part.dxfPerimeter, unitSystem)}
            />
          )}
          {part.geometryStatus && (
            <MetaItem
              label="Geometry"
              value={part.geometryStatus}
              highlight={part.geometryStatus !== "valid"}
            />
          )}
          {part.dxfFileId && geometry && (
            <MetaItem
              label="Prep status"
              value={cleanupStatus}
              highlight={cleanupStatus !== "ready"}
            />
          )}
          {part.geometryContourSummary && (
            <MetaItem label="Contours" value={part.geometryContourSummary} />
          )}
        </div>

        {/* Geometry preview */}
        <div className="py-4 flex flex-col items-stretch">
          {!part.dxfFileId ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">No DXF file</p>
              <p className="text-xs text-muted-foreground mt-1">
                This part has no associated DXF geometry.
              </p>
            </div>
          ) : !geometry ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">
                Geometry not processed
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Try clicking &quot;Rebuild Table&quot; to re-process geometry.
              </p>
            </div>
          ) : !showCanvas ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="h-12 w-12 text-red-400 mb-3" />
              <p className="text-sm font-medium text-foreground">
                Geometry error
              </p>
              {geometry.statusMessage && (
                <p className="text-xs text-muted-foreground mt-1 max-w-md">
                  {geometry.statusMessage}
                </p>
              )}
              {prepMessages.length > 0 && (
                <ul className="text-xs text-left text-muted-foreground mt-3 max-w-md list-disc pl-4 space-y-1">
                  {prepMessages.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              )}
              {canDebug && (
                <p className="text-xs text-muted-foreground mt-4 max-w-sm">
                  Turn on <strong>Debug geometry</strong> below if closed loops or open chains
                  were captured for inspection.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4 w-full">
              {!hasRenderableContours && debugGeometry && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  No classified outer contour — showing debug layers only (e.g. open chains or
                  pre-classify loops).
                </div>
              )}

              {(cleanupStatus === "warning" || prepMessages.length > 0) && !debugGeometry && (
                <div
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    cleanupStatus === "warning"
                      ? "border-amber-200 bg-amber-50 text-amber-950"
                      : "border-border bg-muted/40 text-foreground"
                  }`}
                >
                  <p className="font-medium mb-1">
                    {cleanupStatus === "warning"
                      ? "Geometry usable with warnings"
                      : "Preparation notes"}
                  </p>
                  {prepMessages.length > 0 ? (
                    <ul className="text-xs space-y-1 list-disc pl-4 opacity-90">
                      {[...new Set(prepMessages)].map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs opacity-80">
                      Outer and inner contours were reconstructed; review dimensions in the table
                      if inch scaling was applied.
                    </p>
                  )}
                </div>
              )}

              {debugGeometry && cleaned && (
                <GeometryDebugPanel
                  geometryStatus={geometry.status}
                  cleanupStatus={cleanupStatus}
                  cleaned={cleaned}
                />
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-4">
                  {canDebug && (
                    <div className="flex items-center gap-2">
                      <Switch
                        id="plate-debug-geometry"
                        checked={debugGeometry}
                        onCheckedChange={setDebugGeometry}
                      />
                      <Label
                        htmlFor="plate-debug-geometry"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Debug geometry
                      </Label>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant={measureMode ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMeasureMode((m) => !m)}
                    >
                      <Ruler className="h-4 w-4 mr-2" />
                      {measureMode ? "Stop measuring" : "Measure distance"}
                    </Button>
                    {measureMode && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setClearMeasurementKey((k) => k + 1)}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
                {measureMode && (
                  <p className="text-xs text-muted-foreground max-w-md">
                    Vertices snap automatically. Click two points. Third click starts a new
                    measurement. Esc clears.
                  </p>
                )}
              </div>

              {geometry && (
                <PlateGeometryCanvas
                  geometry={geometry}
                  width={700}
                  height={500}
                  measureMode={measureMode}
                  clearMeasurementKey={clearMeasurementKey}
                  unitSystem={unitSystem}
                  debugMode={debugGeometry}
                  debugCleaned={cleaned ?? null}
                  markingDebugPaths={markingPaths}
                  plateMarkingText={plateMarkingText}
                />
              )}

              {geometry.preparation?.manufacturing && (
                <p className="text-[11px] text-muted-foreground text-center max-w-xl mx-auto">
                  Manufacturing groups: CUT_OUTER (
                  {geometry.preparation.manufacturing.cutOuter.length} pts), CUT_INNER (
                  {geometry.preparation.manufacturing.cutInner.length} loop
                  {geometry.preparation.manufacturing.cutInner.length === 1 ? "" : "s"}).{" "}
                  {plateMarkingText ? (
                    <>
                      Marking preview (purple, centered on outer):{" "}
                      <span className="font-mono text-foreground/90">{plateMarkingText}</span>.
                    </>
                  ) : (
                    <>
                      Part-name marking is off for this thickness band (cutting profile or batch
                      override).
                    </>
                  )}{" "}
                  {geometry.preparation.manufacturing.marking.note ?? ""}
                </p>
              )}

              {geometry.holes.length > 0 && (
                <div className="rounded-lg bg-muted/30 px-4 py-3">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-2">
                    Holes ({geometry.holes.length})
                  </p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {geometry.holes.map((hole, i) => {
                      const d = estimateHoleDiameterMm(hole);
                      return (
                        <li
                          key={`hole-size-${i}`}
                          className="flex items-center justify-between gap-2 text-sm rounded-md bg-background px-3 py-2"
                        >
                          <span className="text-muted-foreground">Hole {i + 1}</span>
                          <span className="font-mono font-medium text-foreground tabular-nums">
                            {formatHoleDiameter(d, unitSystem)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Diameter from DXF geometry (2-point holes = line length; polygon holes ≈ bbox).
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Allow enabling debug from error state when drawable data exists */}
        {geometry && !showCanvas && canDebug && debugDrawable && (
          <div className="flex items-center gap-2 pb-2 border-t border-border pt-4">
            <Switch
              id="plate-debug-geometry-error"
              checked={debugGeometry}
              onCheckedChange={setDebugGeometry}
            />
            <Label htmlFor="plate-debug-geometry-error" className="text-sm cursor-pointer">
              Debug geometry (inspect loops &amp; discarded chains)
            </Label>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MetaItem({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
        {label}
      </p>
      <p
        className={`text-sm font-medium ${
          highlight ? "text-amber-600" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
