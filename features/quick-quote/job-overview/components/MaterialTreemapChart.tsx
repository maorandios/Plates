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

/**
 * Exactly `count` distinct neutral grays (no rounding collisions).
 * Flat treemap leaves use sibling `index` 0…count-1 to pick one fill each.
 */
function tileGrayFills(count: number): string[] {
  if (count <= 0) return [];
  if (count === 1) return ["hsl(0 0% 10%)"];
  const minL = 6;
  const maxL = 40;
  const span = maxL - minL;
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : i / (count - 1);
    const L = minL + t * span;
    return `hsl(0 0% ${L.toFixed(2)}%)`;
  });
}

function isTreemapLeaf(node: TreemapNode): boolean {
  return !node.children || node.children.length === 0;
}

const labelFont =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const textStyle = {
  fontFamily: labelFont,
  pointerEvents: "none" as const,
  WebkitFontSmoothing: "antialiased" as const,
  MozOsxFontSmoothing: "grayscale" as const,
};

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

function MaterialTreemapTile(
  props: LeafPayload & { grayFills: string[] }
) {
  const { x, y, width, height, name, tooltipIndex, grayFills } = props;
  if (width <= 1 || height <= 1) return null;

  if (!isTreemapLeaf(props)) {
    return null;
  }

  const sharePct = props.sharePct;
  const leafIndex =
    typeof props.index === "number" && Number.isFinite(props.index)
      ? Math.min(
          Math.max(0, Math.floor(props.index)),
          Math.max(0, grayFills.length - 1)
        )
      : 0;
  const fill =
    grayFills.length > 0
      ? grayFills[leafIndex] ?? grayFills[grayFills.length - 1]
      : "hsl(0 0% 18%)";

  const padX = 10;
  const padY = 12;
  const nameSize = 13;
  const pctSize = 12;
  const lineGap = 5;
  const showName = width >= 64 && height >= 28 && name;
  const showPct =
    showName && sharePct != null && width >= 72 && height >= 48;

  const maxChars = Math.max(8, Math.min(28, Math.floor((width - padX * 2) / 7)));

  const tx = Math.round(x + padX);
  const ty = Math.round(y + padY);
  const ty2 = Math.round(ty + nameSize + lineGap);

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
      {showName && (
        <text
          x={tx}
          y={ty}
          fill="#ffffff"
          fillOpacity={0.96}
          fontSize={nameSize}
          fontWeight={500}
          dominantBaseline="hanging"
          stroke="none"
          style={textStyle}
        >
          {truncateLabel(String(name), maxChars)}
        </text>
      )}
      {showPct && (
        <text
          x={tx}
          y={ty2}
          fill="#ffffff"
          fillOpacity={0.82}
          fontSize={pctSize}
          fontWeight={400}
          dominantBaseline="hanging"
          stroke="none"
          style={textStyle}
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
  const { data, grayFills } = useMemo(() => {
    const leaves = buildMaterialTreemapLeaves(rows);
    return {
      data: leaves,
      grayFills: tileGrayFills(leaves.length),
    };
  }, [rows]);

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
            <MaterialTreemapTile {...nodeProps} grayFills={grayFills} />
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
