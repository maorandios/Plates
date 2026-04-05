"use client";

import { cn } from "@/lib/utils";
import { PlateGeometryCanvas } from "@/components/parts/PlateGeometryCanvas";
import type { DxfPartGeometry } from "@/types";
import { findDxfGeometryForQuotePart } from "../lib/quotePartGeometryLookup";
import type { QuotePartRow } from "../types/quickQuote";

function RectangularPlateSvg({
  widthMm,
  lengthMm,
  className,
}: {
  widthMm: number;
  lengthMm: number;
  className?: string;
}) {
  const w = Math.max(1, widthMm);
  const l = Math.max(1, lengthMm);
  const pad = 0.08;
  const vw = w * (1 + 2 * pad);
  const vl = l * (1 + 2 * pad);
  const stroke = Math.max(w, l) * 0.004;

  return (
    <div
      className={cn(
        "w-full min-h-[240px] rounded-xl border border-white/[0.06] bg-card/80 flex items-center justify-center p-4",
        className
      )}
    >
      <svg
        viewBox={`${-w * pad} ${-l * pad} ${vw} ${vl}`}
        className="max-h-[280px] w-full max-w-full"
        preserveAspectRatio="xMidYMid meet"
        aria-label="Plate outline from width and length"
      >
        <rect
          x={0}
          y={0}
          width={w}
          height={l}
          fill="hsl(var(--muted) / 0.35)"
          stroke="hsl(var(--primary))"
          strokeWidth={stroke}
          rx={stroke}
        />
      </svg>
    </div>
  );
}

interface QuotePartGeometryPreviewProps {
  part: QuotePartRow;
  dxfGeometries?: DxfPartGeometry[] | null;
  className?: string;
}

/**
 * DXF lines: {@link PlateGeometryCanvas} when processed geometry exists; otherwise a rectangle from
 * nominal width × length (manual / Excel / bend).
 */
export function QuotePartGeometryPreview({
  part,
  dxfGeometries,
  className,
}: QuotePartGeometryPreviewProps) {
  const dxf = findDxfGeometryForQuotePart(part, dxfGeometries ?? undefined);
  const pg = dxf?.processedGeometry;

  if (pg?.isValid && pg.outer.length > 0) {
    return (
      <div
        className={cn(
          "w-full min-h-[240px] rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden flex items-center justify-center",
          className
        )}
      >
        <PlateGeometryCanvas
          geometry={pg}
          unitSystem="metric"
          width={440}
          height={280}
          debugMode={false}
        />
      </div>
    );
  }

  return (
    <RectangularPlateSvg
      widthMm={part.widthMm}
      lengthMm={part.lengthMm}
      className={className}
    />
  );
}
