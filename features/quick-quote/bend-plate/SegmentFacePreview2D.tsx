"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import type { BendSegmentHole } from "./types";
import {
  computeSegmentFaceSvgModel,
  segmentFaceAnnotationStylesForView,
} from "./segmentFaceLayout";
import {
  SegmentFaceKonvaHolesOverlay,
  segmentFaceHoleCenterToStagePx,
  type SegmentFaceDimEdge,
} from "./SegmentFaceKonvaHolesOverlay";

/** Match ProfilePreview2D. */
const PROFILE_STROKE = "hsl(142 70% 45%)";
const DIM_STROKE = "#94a3b8";
const DIM_STROKE_MUTED = "#64748b";
const PROFILE_PATH_STROKE_WIDTH = 1.15;

const ED = "quote.bendPlatePhase.editor";

export interface SegmentFacePreview2DProps {
  lengthMm: number;
  widthMm: number;
  segmentLabel: string;
  className?: string;
  fill?: boolean;
  holes?: BendSegmentHole[];
  onHolePositionChange?: (holeId: string, uMm: number, vMm: number) => void;
  selectedHoleId?: string | null;
  onHoleSelect?: (holeId: string) => void;
  /** Click a dashed guide from hole center to an edge to type an exact distance (mm). */
  onDimensionGuideLineClick?: (
    holeId: string,
    edge: SegmentFaceDimEdge,
    clientX: number,
    clientY: number
  ) => void;
  /** Show dashed dimension guides only after the user tapped this hole id on the canvas. */
  dimensionGuidesActiveHoleId?: string | null;
  /** After adding a hole, show a hint above it until dismissed. */
  placementTooltipHoleId?: string | null;
  /** Clear placement hint (e.g. any pointer down in this preview). */
  onClearPlacementTooltip?: () => void;
}

/**
 * Flat face of one straight segment (length × plate strip width), with CAD-style
 * dimensions matching {@link ProfilePreview2D}. When plate width is 0 or very
 * small vs length, the drawn height is boosted for visibility; labels still show true mm.
 */
export function SegmentFacePreview2D({
  lengthMm,
  widthMm,
  segmentLabel,
  className,
  fill,
  holes = [],
  onHolePositionChange,
  selectedHoleId = null,
  onHoleSelect,
  onDimensionGuideLineClick,
  dimensionGuidesActiveHoleId = null,
  placementTooltipHoleId = null,
  onClearPlacementTooltip,
}: SegmentFacePreview2DProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [viewPx, setViewPx] = useState({ w: 320, h: 240 });

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = (entry?: ResizeObserverEntry) => {
      const cr = entry?.contentRect ?? el.getBoundingClientRect();
      setViewPx({ w: cr.width, h: cr.height });
    };
    apply();
    const ro = new ResizeObserver((entries) => apply(entries[0]));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const svg = useMemo(
    () => computeSegmentFaceSvgModel(lengthMm, widthMm, segmentLabel),
    [lengthMm, widthMm, segmentLabel]
  );

  const ann =
    svg.kind === "ok"
      ? segmentFaceAnnotationStylesForView(viewPx.w, viewPx.h, svg.vbW, svg.vbH)
      : null;

  const holesInteractive =
    Boolean(onHolePositionChange) && holes.length > 0 && svg.kind === "ok";

  return (
    <div
      ref={wrapRef}
      className={cn(
        "relative flex items-center justify-center overflow-hidden",
        fill
          ? "h-full min-h-0 w-full"
          : "aspect-[4/3] rounded-lg bg-[#0f1419]",
        className
      )}
      onPointerDownCapture={
        placementTooltipHoleId && onClearPlacementTooltip
          ? () => {
              /** Defer so Konva can handle the same gesture (hole click / guides) first. */
              window.setTimeout(() => onClearPlacementTooltip(), 0);
            }
          : undefined
      }
    >
      {holesInteractive &&
      placementTooltipHoleId &&
      svg.kind === "ok" ? (() => {
        const th = holes.find((h) => h.id === placementTooltipHoleId);
        if (!th) return null;
        const p = segmentFaceHoleCenterToStagePx(
          svg,
          viewPx.w,
          viewPx.h,
          th.uMm,
          th.vMm
        );
        return (
          <div
            className="pointer-events-none absolute z-[45] max-w-[min(92%,240px)] rounded-md border border-white/15 bg-card/95 px-2.5 py-2 text-center text-[11px] leading-snug text-foreground shadow-lg backdrop-blur-sm"
            style={{
              left: p.x,
              top: p.y,
              transform: "translate(-50%, calc(-100% - 14px))",
            }}
            dir="rtl"
            role="tooltip"
          >
            {t(`${ED}.holesPlacementTooltip`)}
          </div>
        );
      })() : null}
      <svg
        ref={svgRef}
        viewBox={svg.kind === "ok" ? svg.vb : svg.vb}
        className={cn(
          fill
            ? "h-full w-full min-h-0 max-h-full max-w-full"
            : "max-h-[280px] w-full max-w-full",
          holesInteractive && "pointer-events-none"
        )}
        style={{
          fontFamily:
            'var(--font-noto-sans-hebrew), "Noto Sans Hebrew", sans-serif',
          letterSpacing: 0,
        }}
        preserveAspectRatio="xMidYMid meet"
        aria-label={`מבט פנים — סגמנט ${segmentLabel}`}
      >
        {svg.kind === "empty" ? (
          <text
            x="60"
            y="42"
            textAnchor="middle"
            fill="#64748b"
            fontSize={10}
            fontWeight={500}
          >
            —
          </text>
        ) : (
          <>
            <g aria-hidden>
              {ann
                ? svg.extenders.map((e, i) => (
                    <line
                      key={`ext-${i}`}
                      x1={e.x1}
                      y1={e.y1}
                      x2={e.x2}
                      y2={e.y2}
                      stroke={DIM_STROKE_MUTED}
                      strokeWidth={`${ann.extStrokePx}px`}
                      strokeDasharray={ann.dashArray}
                      vectorEffect="non-scaling-stroke"
                      opacity={0.92}
                    />
                  ))
                : null}
              {ann
                ? svg.dimLines.map((e, i) => (
                    <line
                      key={`dim-${i}`}
                      x1={e.x1}
                      y1={e.y1}
                      x2={e.x2}
                      y2={e.y2}
                      stroke={DIM_STROKE}
                      strokeWidth={`${ann.dimStrokePx}px`}
                      strokeDasharray={ann.dashArray}
                      vectorEffect="non-scaling-stroke"
                      opacity={0.98}
                    />
                  ))
                : null}
              {ann
                ? svg.labels.map((lb, i) => (
                    <text
                      key={`lbl-${i}`}
                      x={lb.x}
                      y={lb.y}
                      fill={DIM_STROKE}
                      fontSize={ann.segmentLabelFontUser}
                      fontWeight={600}
                      letterSpacing="0.06em"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${lb.angle}, ${lb.x}, ${lb.y})`}
                    >
                      {lb.text}
                    </text>
                  ))
                : null}
            </g>
            <rect
              x={svg.rect.x}
              y={svg.rect.y}
              width={svg.rect.w}
              height={svg.rect.h}
              fill="none"
              stroke={PROFILE_STROKE}
              strokeWidth={PROFILE_PATH_STROKE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              strokeDasharray={svg.widthPlaceholder ? "6 4" : undefined}
              opacity={svg.widthPlaceholder ? 0.88 : 1}
            />
            {ann
              ? svg.corners.map((p, i) => (
                  <circle
                    key={`n-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r={ann.nodeRadiusUser}
                    fill={PROFILE_STROKE}
                  />
                ))
              : null}
          </>
        )}
      </svg>
      {holesInteractive && onHolePositionChange ? (
        <SegmentFaceKonvaHolesOverlay
          layout={svg}
          viewW={viewPx.w}
          viewH={viewPx.h}
          holes={holes}
          onHolePositionChange={onHolePositionChange}
          selectedHoleId={selectedHoleId}
          onHoleSelect={onHoleSelect}
          onDimensionGuideLineClick={onDimensionGuideLineClick}
          dimensionGuidesActiveHoleId={dimensionGuidesActiveHoleId}
        />
      ) : null}
      {svg.kind === "ok" && svg.widthPlaceholder ? (
        <p className="pointer-events-none absolute bottom-2 left-2 right-2 z-10 text-center text-[11px] leading-snug text-muted-foreground">
          {t(`${ED}.holesFaceWidthUnset`)}
        </p>
      ) : null}
    </div>
  );
}
