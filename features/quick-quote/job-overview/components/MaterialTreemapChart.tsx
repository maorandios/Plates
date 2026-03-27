"use client";

import { useMemo } from "react";
import {
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  type TreemapNode,
} from "recharts";
import type { MaterialBreakdownRow } from "../jobOverview.types";
import {
  buildMaterialTreemapLeaves,
  formatAreaM2,
} from "../jobOverview.utils";

/** Monochrome industrial tile fills (dark rects, light labels). */
const TILE_COLORS = [
  "#3f3f46",
  "#52525b",
  "#57534e",
  "#64748b",
  "#71717a",
  "#5c5c5c",
  "#4b5563",
  "#525252",
] as const;

type LeafPayload = TreemapNode & {
  sharePct?: number;
  netAreaM2?: number;
  massKg?: number;
  stockSheetsCaption?: string | null;
};

function truncateLabel(s: string, max: number) {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function MaterialTreemapTile(props: LeafPayload) {
  const { x, y, width, height, name, index, tooltipIndex } = props;
  if (width <= 1 || height <= 1) return null;
  const idx = typeof index === "number" ? index : 0;
  const fill = TILE_COLORS[idx % TILE_COLORS.length];
  const sharePct = props.sharePct;

  return (
    <g>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke="hsl(var(--border))"
        strokeWidth={1}
        radius={3}
        data-recharts-item-index={tooltipIndex}
      />
      {width > 52 && height >= 20 && name && (
        <text
          x={x + 6}
          y={y + 15}
          fill="rgba(255,255,255,0.94)"
          fontSize={11}
          fontWeight={600}
          style={{ pointerEvents: "none" }}
        >
          {truncateLabel(String(name), 24)}
        </text>
      )}
      {width > 52 && height >= 34 && sharePct != null && (
        <text
          x={x + 6}
          y={y + 29}
          fill="rgba(255,255,255,0.78)"
          fontSize={10}
          fontWeight={500}
          style={{ pointerEvents: "none" }}
        >
          {sharePct.toFixed(0)}%
        </text>
      )}
    </g>
  );
}

interface MaterialTreemapChartProps {
  rows: MaterialBreakdownRow[];
  thicknessStockProvided: boolean;
  /** Shown in tooltip for share line (e.g. "job" vs "filtered selection"). */
  shareScopeLabel?: string;
}

export function MaterialTreemapChart({
  rows,
  thicknessStockProvided,
  shareScopeLabel = "job",
}: MaterialTreemapChartProps) {
  const data = useMemo(() => buildMaterialTreemapLeaves(rows), [rows]);

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-16 text-center border border-dashed border-border rounded-lg">
        No part rows available.
      </p>
    );
  }

  return (
    <div className="w-full h-[min(440px,56vh)] min-h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          type="flat"
          data={data}
          dataKey="value"
          nameKey="name"
          stroke="hsl(var(--border))"
          aspectRatio={4 / 3}
          content={(nodeProps: LeafPayload) => (
            <MaterialTreemapTile {...nodeProps} />
          )}
        >
          <Tooltip
            wrapperStyle={{ outline: "none" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const p = payload[0].payload as LeafPayload;
              const stock =
                p.stockSheetsCaption ??
                (!thicknessStockProvided
                  ? "Complete Stock & pricing to estimate sheets and sizes."
                  : "—");
              return (
                <div className="rounded-md border border-border bg-popover px-3 py-2.5 text-xs shadow-md max-w-xs space-y-1.5">
                  <p className="font-semibold text-foreground">{p.name}</p>
                  <p className="text-muted-foreground tabular-nums">
                    Share:{" "}
                    {p.sharePct != null ? `${p.sharePct.toFixed(1)}%` : "—"} of{" "}
                    {shareScopeLabel} (mass / area)
                  </p>
                  <p className="text-muted-foreground tabular-nums">
                    Net plate: {formatAreaM2(p.netAreaM2 ?? 0)}
                  </p>
                  {p.massKg != null && p.massKg > 0 && (
                    <p className="text-muted-foreground tabular-nums">
                      Est. weight:{" "}
                      {p.massKg.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}{" "}
                      kg
                    </p>
                  )}
                  <p className="text-foreground/90 font-mono text-[11px] leading-snug pt-1 border-t border-border">
                    {stock}
                  </p>
                </div>
              );
            }}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
