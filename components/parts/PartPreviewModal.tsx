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
import type { Part } from "@/types";
import { PlateGeometryCanvas } from "./PlateGeometryCanvas";
import { getDxfGeometryByFile } from "@/lib/store";
import { reprocessDxfGeometry } from "@/lib/geometry";
import { estimateHoleDiameterMm } from "@/lib/geometry/dimensions";
import { useAppPreferences } from "@/features/settings/useAppPreferences";
import { formatArea, formatHoleDiameter, formatLength } from "@/lib/settings/unitSystem";

interface PartPreviewModalProps {
  part: Part;
  open: boolean;
  onClose: () => void;
}

export function PartPreviewModal({ part, open, onClose }: PartPreviewModalProps) {
  const { preferences } = useAppPreferences();
  const unitSystem = preferences.unitSystem;

  const [measureMode, setMeasureMode] = useState(false);
  const [clearMeasurementKey, setClearMeasurementKey] = useState(0);

  /** Stored geometry omits vertices; rebuild from DXF file text when preview opens. */
  const geometry = useMemo(() => {
    if (!open || !part.dxfFileId) return null;
    const stored = getDxfGeometryByFile(part.dxfFileId);
    if (!stored) return null;
    return reprocessDxfGeometry(stored).processedGeometry;
  }, [open, part.dxfFileId]);

  const hasValidGeometry = geometry && geometry.isValid && geometry.outer.length > 0;

  useEffect(() => {
    if (!open) {
      setMeasureMode(false);
      setClearMeasurementKey((k) => k + 1);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogDescription className="sr-only">
            Plate geometry preview with optional manual distance measurement and hole sizes
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
        </div>

        {/* Geometry preview */}
        <div className="py-4 flex items-center justify-center">
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
                Try clicking "Rebuild Table" to re-process geometry.
              </p>
            </div>
          ) : !hasValidGeometry ? (
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
            </div>
          ) : (
            <div className="space-y-4 w-full">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
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
                {measureMode && (
                  <p className="text-xs text-muted-foreground max-w-md">
                    Vertices snap automatically. Click two points. Third click starts a new
                    measurement. Esc clears.
                  </p>
                )}
              </div>
              <PlateGeometryCanvas
                geometry={geometry}
                width={700}
                height={500}
                measureMode={measureMode}
                clearMeasurementKey={clearMeasurementKey}
                unitSystem={unitSystem}
              />
              {geometry.holes.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-2">
                    Holes ({geometry.holes.length})
                  </p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {geometry.holes.map((hole, i) => {
                      const d = estimateHoleDiameterMm(hole);
                      return (
                        <li
                          key={`hole-size-${i}`}
                          className="flex items-center justify-between gap-2 text-sm rounded-md bg-background border border-border px-3 py-2"
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
