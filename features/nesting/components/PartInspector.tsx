"use client";

import type { GeneratedSheet, SheetPlacement } from "@/types";
import { formatLength } from "@/lib/settings/unitSystem";
import type { UnitSystem } from "@/types/settings";
import {
  innerOriginOnSheet,
  offsetContourToSheetSpace,
  ringBBoxMm,
} from "@/lib/nesting/nestingResultsUtils";

interface PartInspectorProps {
  placement: SheetPlacement | null;
  sheet: GeneratedSheet;
  unitSystem: UnitSystem;
  onClear: () => void;
}

export function PartInspector({
  placement,
  sheet,
  unitSystem,
  onClear,
}: PartInspectorProps) {
  if (!placement) {
    return (
      <aside className="w-full lg:w-72 shrink-0 rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Part details</p>
        <p className="text-xs leading-relaxed">
          Click a part on the sheet to see name, rotation, dimensions, and area.
        </p>
      </aside>
    );
  }

  const outerOnSheet = offsetContourToSheetSpace(placement.outerContour, sheet);
  const bbox = ringBBoxMm(outerOnSheet);
  const { ox, oy } = innerOriginOnSheet(sheet);

  return (
    <aside className="w-full lg:w-72 shrink-0 rounded-xl border border-border bg-card p-4 text-sm space-y-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-foreground">Part details</p>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          Clear
        </button>
      </div>
      <dl className="space-y-2 text-xs">
        <div>
          <dt className="text-muted-foreground uppercase tracking-wide">Name</dt>
          <dd className="font-medium text-foreground mt-0.5">{placement.partName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground uppercase tracking-wide">Client code</dt>
          <dd className="font-mono font-medium mt-0.5">{placement.clientCode || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground uppercase tracking-wide">Instance</dt>
          <dd className="font-mono text-[11px] mt-0.5 break-all">
            {placement.partInstanceId}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground uppercase tracking-wide">Thickness</dt>
          <dd className="mt-0.5">
            {sheet.thicknessMm != null
              ? formatLength(sheet.thicknessMm, unitSystem)
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground uppercase tracking-wide">Rotation</dt>
          <dd className="mt-0.5 tabular-nums">{placement.rotation.toFixed(1)}°</dd>
        </div>
        <div>
          <dt className="text-muted-foreground uppercase tracking-wide">
            Placement (inner frame)
          </dt>
          <dd className="mt-0.5 font-mono text-[11px] tabular-nums">
            x={placement.x.toFixed(2)} mm, y={placement.y.toFixed(2)} mm
            <span className="text-muted-foreground block mt-0.5">
              Inner origin on sheet: +({ox.toFixed(2)}, {oy.toFixed(2)}) mm
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground uppercase tracking-wide">BBox (on sheet)</dt>
          <dd className="mt-0.5 tabular-nums">
            {formatLength(bbox.width, unitSystem)} ×{" "}
            {formatLength(bbox.height, unitSystem)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground uppercase tracking-wide">Net area</dt>
          <dd className="mt-0.5">
            {(placement.partNetAreaMm2 / 1_000_000).toFixed(4)} m²
          </dd>
        </div>
        {placement.markingText ? (
          <div>
            <dt className="text-muted-foreground uppercase tracking-wide">Marking</dt>
            <dd className="mt-0.5 font-mono text-[11px]">{placement.markingText}</dd>
          </div>
        ) : null}
      </dl>
    </aside>
  );
}
