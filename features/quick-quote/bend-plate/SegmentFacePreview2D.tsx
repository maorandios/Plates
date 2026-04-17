"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

/** Match ProfilePreview2D. */
const PROFILE_STROKE = "hsl(142 70% 45%)";
const DIM_STROKE = "#94a3b8";
const DIM_STROKE_MUTED = "#64748b";
const PROFILE_PATH_STROKE_WIDTH = 1.15;

const ED = "quote.bendPlatePhase.editor";

function fmtMm(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? formatInteger(Math.round(r)) : formatDecimal(r, 1);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

/** Same scaling as ProfilePreview2D `annotationStylesForView`. */
function annotationStylesForView(
  viewPxW: number,
  viewPxH: number,
  vbW: number,
  vbH: number
) {
  const vw = Math.max(viewPxW, 1);
  const vh = Math.max(viewPxH, 1);
  const bw = Math.max(vbW, 1);
  const bh = Math.max(vbH, 1);
  const scale = Math.min(vw / bw, vh / bh);
  const geomLongPx = Math.max(bw, bh) * scale;

  const labelPx = clamp(geomLongPx * 0.0225, 10.5, 12.75);
  const labelFontUser = labelPx / scale;
  const segmentLabelFontUser = labelFontUser * 1.25 * 1.25;

  const dimStrokePx = clamp(geomLongPx * 0.002, 0.72, 1.12);
  const extStrokePx = dimStrokePx * 0.92;
  const dashLenPx = clamp(geomLongPx * 0.011, 3.2, 5.8);
  const dashGapPx = clamp(geomLongPx * 0.0085, 2.4, 4.5);
  const nodePx = clamp(geomLongPx * 0.0068, 2.1, 3.6);
  const nodeRadiusUser = nodePx / scale;

  return {
    meetScale: scale,
    segmentLabelFontUser,
    dimStrokePx,
    extStrokePx,
    dashArray: `${dashLenPx}px ${dashGapPx}px`,
    nodeRadiusUser,
  };
}

export interface SegmentFacePreview2DProps {
  lengthMm: number;
  widthMm: number;
  segmentLabel: string;
  className?: string;
  fill?: boolean;
}

type Pt = { x: number; y: number };

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
}: SegmentFacePreview2DProps) {
  const L = Math.max(0, lengthMm);
  const rawW = Math.max(0, widthMm);

  const wrapRef = useRef<HTMLDivElement>(null);
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

  const svg = useMemo(() => {
    if (L < 1e-6) {
      return {
        kind: "empty" as const,
        vb: "0 0 120 80",
        vbW: 120,
        vbH: 80,
      };
    }

    /** Plate-strip width for drawing (may be exaggerated when rawW is 0 or tiny). */
    const placeholderPlateW = Math.max(L * 0.42, 18);
    let plateWDraw: number;
    if (rawW <= 1e-6) {
      plateWDraw = placeholderPlateW;
    } else if (rawW < L * 0.06) {
      plateWDraw = L * 0.06;
    } else {
      plateWDraw = rawW;
    }

    const segLen = L;
    /** Horizontal = plate width (אורך פלטה); vertical = segment run — better use of wide canvas. */
    const rectW = plateWDraw;
    const rectH = segLen;
    const span0 = Math.max(rectW, rectH, 1);
    const offset = Math.max(span0 * 0.09, 5);
    const textGap = Math.max(span0 * 0.055, 3.5);

    const rx0 = 0;
    const ry0 = 0;
    const pTL: Pt = { x: rx0, y: ry0 };
    const pTR: Pt = { x: rx0 + rectW, y: ry0 };
    const pBL: Pt = { x: rx0, y: ry0 + rectH };
    const pBR: Pt = { x: rx0 + rectW, y: ry0 + rectH };

    const cx = (pTL.x + pTR.x + pBL.x + pBR.x) / 4;
    const cy = (pTL.y + pTR.y + pBL.y + pBR.y) / 4;

    const extenders: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const dimLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const labels: { x: number; y: number; text: string; angle: number }[] = [];

    // Bottom = plate strip width (אורך פלטה) — always horizontal
    {
      const p0 = pBL;
      const p1 = pBR;
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.hypot(dx, dy);
      if (len > 1e-6) {
        const ux = dx / len;
        const uy = dy / len;
        let nx = -uy;
        let ny = ux;
        const midX = (p0.x + p1.x) / 2;
        const midY = (p0.y + p1.y) / 2;
        if (nx * (midX - cx) + ny * (midY - cy) < 0) {
          nx = -nx;
          ny = -ny;
        }
        const p0o = { x: p0.x + nx * offset, y: p0.y + ny * offset };
        const p1o = { x: p1.x + nx * offset, y: p1.y + ny * offset };
        extenders.push(
          { x1: p0.x, y1: p0.y, x2: p0o.x, y2: p0o.y },
          { x1: p1.x, y1: p1.y, x2: p1o.x, y2: p1o.y }
        );
        dimLines.push({ x1: p0o.x, y1: p0o.y, x2: p1o.x, y2: p1o.y });
        const text = t(`${ED}.holesFaceDimWidth`, {
          mm: fmtMm(rawW),
        });
        const tx = midX + nx * (offset + textGap);
        const ty = midY + ny * (offset + textGap);
        let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (angleDeg > 90) angleDeg -= 180;
        if (angleDeg < -90) angleDeg += 180;
        labels.push({ x: tx, y: ty, text, angle: angleDeg });
      }
    }

    // Left = segment run length (A/B/C…)
    {
      const p0 = pTL;
      const p1 = pBL;
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.hypot(dx, dy);
      if (len > 1e-6) {
        const ux = dx / len;
        const uy = dy / len;
        let nx = -uy;
        let ny = ux;
        const midX = (p0.x + p1.x) / 2;
        const midY = (p0.y + p1.y) / 2;
        if (nx * (midX - cx) + ny * (midY - cy) < 0) {
          nx = -nx;
          ny = -ny;
        }
        const p0o = { x: p0.x + nx * offset, y: p0.y + ny * offset };
        const p1o = { x: p1.x + nx * offset, y: p1.y + ny * offset };
        extenders.push(
          { x1: p0.x, y1: p0.y, x2: p0o.x, y2: p0o.y },
          { x1: p1.x, y1: p1.y, x2: p1o.x, y2: p1o.y }
        );
        dimLines.push({ x1: p0o.x, y1: p0o.y, x2: p1o.x, y2: p1o.y });
        const text = t(`${ED}.holesFaceDimLen`, {
          label: segmentLabel,
          mm: fmtMm(L),
        });
        const tx = midX + nx * (offset + textGap);
        const ty = midY + ny * (offset + textGap);
        let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (angleDeg > 90) angleDeg -= 180;
        if (angleDeg < -90) angleDeg += 180;
        labels.push({ x: tx, y: ty, text, angle: angleDeg });
      }
    }

    const labelBoxUnit = Math.max(span0 * 0.04, 6);
    const segLabelBox = 1.25 * 1.25;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const expand = (x: number, y: number) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    };

    for (const p of [pTL, pTR, pBL, pBR]) expand(p.x, p.y);
    for (const e of extenders) {
      expand(e.x1, e.y1);
      expand(e.x2, e.y2);
    }
    for (const d of dimLines) {
      expand(d.x1, d.y1);
      expand(d.x2, d.y2);
    }
    for (const lb of labels) {
      const hw = lb.text.length * labelBoxUnit * 0.32 * segLabelBox;
      const hh = labelBoxUnit * 0.72 * segLabelBox;
      expand(lb.x - hw, lb.y - hh);
      expand(lb.x + hw, lb.y + hh);
    }

    const pad = Math.max(span0 * 0.04, 2);
    /**
     * Center the **plate rectangle** in the viewBox, not the annotation bbox.
     * Label bounds use rough character-width heuristics; for Hebrew / dynamic font
     * sizing that skews the bbox and shifts the shape toward one edge (see holes face).
     */
    const rcx = rx0 + rectW / 2;
    const rcy = ry0 + rectH / 2;
    const halfW = Math.max(rcx - minX, maxX - rcx, 1e-6);
    const halfH = Math.max(rcy - minY, maxY - rcy, 1e-6);
    const vbW = 2 * halfW + 2 * pad;
    const vbH = 2 * halfH + 2 * pad;
    const shiftX = vbW / 2 - rcx;
    const shiftY = vbH / 2 - rcy;

    const sh = (p: Pt) => ({ x: p.x + shiftX, y: p.y + shiftY });

    const corners = [pTL, pTR, pBR, pBL].map(sh);

    return {
      kind: "ok" as const,
      vb: `0 0 ${vbW.toFixed(2)} ${vbH.toFixed(2)}`,
      vbW,
      vbH,
      rect: {
        x: rx0 + shiftX,
        y: ry0 + shiftY,
        w: rectW,
        h: rectH,
      },
      widthPlaceholder: rawW <= 1e-6,
      extenders: extenders.map((e) => ({
        x1: e.x1 + shiftX,
        y1: e.y1 + shiftY,
        x2: e.x2 + shiftX,
        y2: e.y2 + shiftY,
      })),
      dimLines: dimLines.map((e) => ({
        x1: e.x1 + shiftX,
        y1: e.y1 + shiftY,
        x2: e.x2 + shiftX,
        y2: e.y2 + shiftY,
      })),
      labels: labels.map((lb) => ({
        x: lb.x + shiftX,
        y: lb.y + shiftY,
        text: lb.text,
        angle: lb.angle,
      })),
      corners,
    };
  }, [L, rawW, segmentLabel]);

  const ann =
    svg.kind === "ok"
      ? annotationStylesForView(viewPx.w, viewPx.h, svg.vbW, svg.vbH)
      : null;

  return (
    <div
      ref={wrapRef}
      className={cn(
        /* Same flex centering as ProfilePreview2D — not flex-col + flex-1 (that skews hole view). */
        "relative flex items-center justify-center overflow-hidden",
        fill
          ? "h-full min-h-0 w-full"
          : "aspect-[4/3] rounded-lg bg-[#0f1419]",
        className
      )}
    >
      <svg
        viewBox={svg.kind === "ok" ? svg.vb : svg.vb}
        className={
          fill
            ? "h-full w-full min-h-0 max-h-full max-w-full"
            : "max-h-[280px] w-full max-w-full"
        }
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
      {svg.kind === "ok" && svg.widthPlaceholder ? (
        <p className="pointer-events-none absolute bottom-2 left-2 right-2 z-10 text-center text-[11px] leading-snug text-muted-foreground">
          {t(`${ED}.holesFaceWidthUnset`)}
        </p>
      ) : null}
    </div>
  );
}
