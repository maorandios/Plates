"use client";

import type { CleanedGeometryResult, GeometryStatus } from "@/types";

interface GeometryDebugPanelProps {
  geometryStatus?: GeometryStatus;
  cleanupStatus: string;
  cleaned: CleanedGeometryResult;
}

export function GeometryDebugPanel({
  geometryStatus,
  cleanupStatus,
  cleaned,
}: GeometryDebugPanelProps) {
  const s = cleaned.stats;
  const removedFr = cleaned.removedFragments ?? [];
  const invalidFr = cleaned.invalidFragments ?? [];
  const classDisc = cleaned.classificationDiscarded ?? [];
  const preClosed = cleaned.reconstructedClosedLoops ?? [];

  const outerCount = cleaned.outerContour.length > 0 ? 1 : 0;
  const innerCount = cleaned.innerContours.length;
  const removedCount = removedFr.length;
  const invalidCount = invalidFr.length;
  const discardedClassCount = classDisc.length;
  const preClassCount = preClosed.length;

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/80 px-4 py-3 text-sm space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-900">
        Debug summary
      </p>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Geometry status</dt>
          <dd className="font-mono font-medium text-foreground">
            {geometryStatus ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Cleanup status</dt>
          <dd className="font-mono font-medium text-foreground">{cleanupStatus}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Outer contours</dt>
          <dd className="font-mono font-medium tabular-nums">{outerCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Inner / holes</dt>
          <dd className="font-mono font-medium tabular-nums">{innerCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Removed fragments</dt>
          <dd className="font-mono font-medium tabular-nums">{removedCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Invalid / open</dt>
          <dd className="font-mono font-medium tabular-nums">{invalidCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Outside outer (scrap)</dt>
          <dd className="font-mono font-medium tabular-nums">{discardedClassCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Closed loops (pre-class)</dt>
          <dd className="font-mono font-medium tabular-nums">{preClassCount}</dd>
        </div>
        {s && (
          <div className="col-span-2 sm:col-span-3 text-[11px] text-muted-foreground border-t border-violet-200/80 pt-2 mt-1">
            Raw {s.rawContourCount} · normalized {s.normalizedContourCount} · closed{" "}
            {s.closedLoopCount}
          </div>
        )}
      </dl>

      {(cleaned.errors.length > 0 || cleaned.warnings.length > 0) && (
        <div className="space-y-2 text-xs border-t border-violet-200/80 pt-2">
          {cleaned.errors.length > 0 && (
            <div>
              <p className="font-medium text-destructive mb-1">Errors</p>
              <ul className="list-disc pl-4 space-y-0.5 text-destructive/90">
                {cleaned.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {cleaned.warnings.length > 0 && (
            <div>
              <p className="font-medium text-amber-800 mb-1">Warnings</p>
              <ul className="list-disc pl-4 space-y-0.5 text-amber-950/90">
                {cleaned.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {cleaned.discardedEntities.length > 0 && (
        <div className="text-xs border-t border-violet-200/80 pt-2">
          <p className="font-medium text-foreground mb-1">Discarded / open chain detail</p>
          <ul className="space-y-1 max-h-36 overflow-y-auto pr-1">
            {cleaned.discardedEntities.map((d, i) => (
              <li
                key={i}
                className="rounded bg-white/70 border border-violet-100 px-2 py-1 leading-snug"
              >
                <span className="font-mono text-[10px] text-violet-700">{d.reason}</span>
                <span className="text-muted-foreground"> — {d.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-[10px] text-muted-foreground border-t border-violet-200/60 pt-2 leading-relaxed">
        <span className="text-primary/85 font-medium">Green</span> outer ·{" "}
        <span className="text-blue-700 font-medium">Blue</span> holes ·{" "}
        <span className="text-red-700 font-medium">Red dashed</span> removed ·{" "}
        <span className="text-orange-700 font-medium">Orange dashed</span> open/invalid ·{" "}
        <span className="text-slate-600 font-medium">Slate dashed</span> pre-classify closed ·{" "}
        <span className="text-fuchsia-800 font-medium">Fuchsia dashed</span> outside outer ·{" "}
        <span className="text-purple-700 font-medium">Purple</span> DXF marking paths (if any)
      </div>
    </div>
  );
}
