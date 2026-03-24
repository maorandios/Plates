"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GeneratedSheet, NestingRun, SheetPlacement } from "@/types";
import type { UnitSystem } from "@/types/settings";
import { formatLength } from "@/lib/settings/unitSystem";
import { SheetCanvas } from "./SheetCanvas";
import { PartInspector } from "./PartInspector";

interface SheetViewerProps {
  batchId: string;
  run: NestingRun;
  sheet: GeneratedSheet;
  unitSystem: UnitSystem;
}

const CANVAS_W = 880;
const CANVAS_H = 520;

export function SheetViewer({
  batchId,
  run,
  sheet,
  unitSystem,
}: SheetViewerProps) {
  const [selected, setSelected] = useState<SheetPlacement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const wheelRef = useRef<HTMLDivElement>(null);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const el = wheelRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.92 : 1.09;
      setZoom((z) => Math.min(3.2, Math.max(0.35, z * factor)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const typeLabel = sheet.stockType === "purchase" ? "Purchase" : "Leftover";

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link
            href={`/batches/${batchId}/nesting-results?run=${encodeURIComponent(run.id)}`}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Results
          </Link>
        </Button>
      </div>

      <header className="space-y-1 border-b border-border pb-4">
        <h1 className="text-xl font-semibold text-foreground tracking-tight">
          Sheet layout
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatLength(sheet.widthMm, unitSystem)} ×{" "}
          {formatLength(sheet.lengthMm, unitSystem)} · {typeLabel} ·{" "}
          {sheet.placements.length} part{sheet.placements.length === 1 ? "" : "s"}{" "}
          · {sheet.utilizationPercent.toFixed(1)}% utilization
        </p>
        <p className="text-xs text-muted-foreground font-mono">
          Run {run.id.slice(0, 10)}… · {sheet.id.slice(0, 10)}…
        </p>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex-1 min-w-0 space-y-3 w-full">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground mr-2">View</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setZoom((z) => Math.max(0.35, z / 1.12))}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setZoom((z) => Math.min(3.2, z * 1.12))}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetView}
              className="gap-1"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums ml-2">
              {(zoom * 100).toFixed(0)}% · scroll wheel to zoom
            </span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => setPan((p) => ({ x: p.x - 40, y: p.y }))}
            >
              ←
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => setPan((p) => ({ x: p.x + 40, y: p.y }))}
            >
              →
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => setPan((p) => ({ x: p.x, y: p.y - 40 }))}
            >
              ↑
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => setPan((p) => ({ x: p.x, y: p.y + 40 }))}
            >
              ↓
            </Button>
            <span className="text-muted-foreground self-center ml-1">
              Pan (nudge)
            </span>
          </div>

          <div ref={wheelRef} className="w-full overflow-hidden touch-none">
            <SheetCanvas
              sheet={sheet}
              selectedInstanceId={selected?.partInstanceId ?? null}
              onSelectPart={setSelected}
              width={CANVAS_W}
              height={CANVAS_H}
              zoom={zoom}
              pan={pan}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Green: outer · blue: holes · purple: marking · dashed: nestable inner
            area · grey border: full stock.
          </p>
        </div>

        <PartInspector
          placement={selected}
          sheet={sheet}
          unitSystem={unitSystem}
          onClear={() => setSelected(null)}
        />
      </div>
    </div>
  );
}
