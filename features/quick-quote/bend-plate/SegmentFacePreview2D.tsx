"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import type { BendSegmentHole } from "./types";
import {
  computeSegmentFaceSvgModel,
  segmentFaceAnnotationStylesForView,
} from "./segmentFaceLayout";
import { SegmentFaceKonvaHolesOverlay } from "./SegmentFaceKonvaHolesOverlay";

/** Match ProfilePreview2D — brand primary purple. */
const PROFILE_STROKE = "hsl(262 92% 55%)";
const DIM_STROKE = "#9ca3af";
const DIM_STROKE_MUTED = "#6b7280";
const PROFILE_PATH_STROKE_WIDTH = 1.15 / 1.25;

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
          : "aspect-[4/3] rounded-lg bg-[hsl(var(--viewer-canvas))]",
        className
      )}
    >
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
                      fontSize={ann.segmentDimLabelFontUser}
                      fontWeight={600}
                      letterSpacing="0.06em"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${lb.angle}, ${lb.x}, ${lb.y})`}
                    >
                      <tspan direction="ltr" unicodeBidi="embed">
                        {"\u200e"}
                        {lb.text}
                      </tspan>
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
              strokeDasharray={svg.widthPlaceholder ? "3 2" : undefined}
              opacity={svg.widthPlaceholder ? 0.88 : 1}
            />
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
