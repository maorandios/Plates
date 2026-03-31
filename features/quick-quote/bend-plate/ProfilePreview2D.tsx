"use client";

import { useMemo } from "react";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import { cn } from "@/lib/utils";
import type { Point2 } from "./geometry";
import { boundsOfPolyline } from "./geometry";

function formatDimMm(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? formatInteger(Math.round(r)) : formatDecimal(r, 1);
}

function formatAngleDeg(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? `${formatInteger(Math.round(r))}°` : `${formatDecimal(r, 1)}°`;
}

/** Circular arc from p + r*u1 to p + r*u2 along the shorter great-circle path (internal angle). */
function arcPathBetweenRays(
  p: Point2,
  u1: Point2,
  u2: Point2,
  r: number
): string | null {
  const dot = Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y));
  const theta = Math.acos(dot);
  if (theta < 1e-5) return null;
  const sinT = Math.sin(theta);
  if (sinT < 1e-6) {
    const sx = p.x + u1.x * r;
    const sy = p.y + u1.y * r;
    const ex = p.x + u2.x * r;
    const ey = p.y + u2.y * r;
    return `M ${sx} ${sy} L ${ex} ${ey}`;
  }
  const nSeg = Math.max(10, Math.ceil((theta / (2 * Math.PI)) * 48));
  const parts: string[] = [];
  for (let i = 0; i <= nSeg; i++) {
    const t = i / nSeg;
    const wx =
      (Math.sin((1 - t) * theta) / sinT) * u1.x + (Math.sin(t * theta) / sinT) * u2.x;
    const wy =
      (Math.sin((1 - t) * theta) / sinT) * u1.y + (Math.sin(t * theta) / sinT) * u2.y;
    const px = p.x + r * wx;
    const py = p.y + r * wy;
    parts.push(`${i === 0 ? "M" : "L"} ${px.toFixed(3)} ${py.toFixed(3)}`);
  }
  return parts.join(" ");
}

/** Slate dimension strokes — same family as plate builder feature dims (`#64748b`). */
const DIM_STROKE = "#94a3b8";
const DIM_STROKE_MUTED = "#64748b";
/** Bend angle arc / label — slightly warmer so it reads as angle vs length. */
const ANGLE_STROKE = "#b4a892";

export interface BendProfileSegmentDim {
  label: string;
  lengthMm: number;
}

interface ProfilePreview2DProps {
  pts: Point2[];
  /** Per straight edge: parameter name (A, B, …) and length — same order as polyline segments. */
  segments?: BendProfileSegmentDim[];
  /** Signed path turn (°) after each segment — same order as interior bend vertices (CCW +). */
  bendAnglesDeg?: number[];
  className?: string;
  /** Stretch to parent height (e.g. split-pane editor). */
  fill?: boolean;
}

export function ProfilePreview2D({
  pts,
  segments,
  bendAnglesDeg,
  className,
  fill,
}: ProfilePreview2DProps) {
  const svg = useMemo(() => {
    if (pts.length < 2) {
      return {
        pathD: "",
        vb: "0 0 100 100",
        strokeW: 0.8,
        nodeR: 2,
        ptsLocal: [] as Point2[],
        dimLayers: null as null | {
          extenders: { x1: number; y1: number; x2: number; y2: number }[];
          dimLines: { x1: number; y1: number; x2: number; y2: number }[];
          labels: { x: number; y: number; text: string; angle: number }[];
          dimStrokeW: number;
          dash: string;
          fontSize: number;
        },
        angleMarkup: null as null | {
          arcs: string[];
          labels: { x: number; y: number; text: string }[];
          arcStrokeW: number;
          fontSize: number;
        },
      };
    }

    const b = boundsOfPolyline(pts);
    const w0 = Math.max(b.maxX - b.minX, 1);
    const h0 = Math.max(b.maxY - b.minY, 1);
    const span0 = Math.max(w0, h0, 1);

    /** Local SVG coords: x right, y down (world Y flipped). */
    const ptsLocal = pts.map((p) => ({
      x: p.x - b.minX,
      y: b.maxY - p.y,
    }));

    let cx = 0;
    let cy = 0;
    for (const p of ptsLocal) {
      cx += p.x;
      cy += p.y;
    }
    cx /= ptsLocal.length;
    cy /= ptsLocal.length;

    const nSeg = ptsLocal.length - 1;
    const showDims =
      segments &&
      segments.length === nSeg &&
      nSeg > 0;

    const showAngleDims =
      bendAnglesDeg &&
      pts.length >= 3 &&
      bendAnglesDeg.length === pts.length - 2;

    const rArc = Math.max(span0 * 0.045, 4);
    const angleTextGap = Math.max(span0 * 0.055, 4);
    const fsAngle = Math.max(span0 * 0.032, 2.4);

    const arcData: { p: Point2; u1: Point2; u2: Point2; r: number }[] = [];
    const angleLabelsRaw: { x: number; y: number; text: string }[] = [];

    const extenders: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const dimLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const labels: { x: number; y: number; text: string; angle: number }[] = [];

    const offset = Math.max(span0 * 0.09, 5);
    const textGap = Math.max(span0 * 0.055, 3.5);
    const dimStrokeW = Math.max(span0 * 0.0018, 0.35);
    const dashLen = Math.max(span0 * 0.014, 0.9);
    const dashGap = Math.max(span0 * 0.01, 0.7);
    const dash = `${dashLen} ${dashGap}`;

    if (showDims) {
      for (let i = 0; i < nSeg; i++) {
        const p0 = ptsLocal[i];
        const p1 = ptsLocal[i + 1];
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const len = Math.hypot(dx, dy);
        if (len < 1e-6) continue;
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
        dimLines.push({
          x1: p0o.x,
          y1: p0o.y,
          x2: p1o.x,
          y2: p1o.y,
        });

        const seg = segments![i];
        const text = `${seg.label} · ${formatDimMm(seg.lengthMm)} mm`;
        const tx = midX + nx * (offset + textGap);
        const ty = midY + ny * (offset + textGap);
        let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (angleDeg > 90) angleDeg -= 180;
        if (angleDeg < -90) angleDeg += 180;
        labels.push({ x: tx, y: ty, text, angle: angleDeg });
      }
    }

    if (showAngleDims) {
      for (let k = 0; k < bendAnglesDeg!.length; k++) {
        const i = k + 1;
        const pIn = ptsLocal[i - 1];
        const p = ptsLocal[i];
        const pOut = ptsLocal[i + 1];
        const vin = { x: p.x - pIn.x, y: p.y - pIn.y };
        const vout = { x: pOut.x - p.x, y: pOut.y - p.y };
        const lenIn = Math.hypot(vin.x, vin.y);
        const lenOut = Math.hypot(vout.x, vout.y);
        if (lenIn < 1e-9 || lenOut < 1e-9) continue;

        const u1: Point2 = { x: -vin.x / lenIn, y: -vin.y / lenIn };
        const u2: Point2 = { x: vout.x / lenOut, y: vout.y / lenOut };

        const dot = Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y));
        const thetaGeom = Math.acos(dot);
        if (thetaGeom < 1e-4) continue;

        let bx = u1.x + u2.x;
        let by = u1.y + u2.y;
        const bl = Math.hypot(bx, by);
        if (bl < 1e-9) continue;
        bx /= bl;
        by /= bl;

        arcData.push({ p, u1, u2, r: rArc });
        const tx = p.x + bx * (rArc + angleTextGap);
        const ty = p.y + by * (rArc + angleTextGap);
        angleLabelsRaw.push({
          x: tx,
          y: ty,
          text: `∠ ${formatAngleDeg(bendAnglesDeg![k])}`,
        });
      }
    }

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
    for (const p of ptsLocal) {
      expand(p.x, p.y);
    }
    for (const e of extenders) {
      expand(e.x1, e.y1);
      expand(e.x2, e.y2);
    }
    for (const d of dimLines) {
      expand(d.x1, d.y1);
      expand(d.x2, d.y2);
    }
    const fs = Math.max(span0 * 0.038, 2.8);
    for (const lb of labels) {
      const hw = lb.text.length * fs * 0.32;
      const hh = fs * 0.65;
      expand(lb.x - hw, lb.y - hh);
      expand(lb.x + hw, lb.y + hh);
    }

    for (const d of arcData) {
      expand(d.p.x + d.u1.x * d.r, d.p.y + d.u1.y * d.r);
      expand(d.p.x + d.u2.x * d.r, d.p.y + d.u2.y * d.r);
      const midU = { x: d.u1.x + d.u2.x, y: d.u1.y + d.u2.y };
      const ml = Math.hypot(midU.x, midU.y);
      if (ml > 1e-9) {
        const mx = midU.x / ml;
        const my = midU.y / ml;
        expand(d.p.x + mx * d.r * 0.55, d.p.y + my * d.r * 0.55);
      }
    }
    for (const lb of angleLabelsRaw) {
      const hw = lb.text.length * fsAngle * 0.3;
      const hh = fsAngle * 0.65;
      expand(lb.x - hw, lb.y - hh);
      expand(lb.x + hw, lb.y + hh);
    }

    const pad = Math.max(span0 * 0.04, 2);
    minX -= pad;
    minY -= pad;
    maxX += pad;
    maxY += pad;

    const shiftX = -minX;
    const shiftY = -minY;
    const vbW = Math.max(maxX - minX, 1);
    const vbH = Math.max(maxY - minY, 1);

    const shift = (p: Point2) => ({ x: p.x + shiftX, y: p.y + shiftY });

    const pathD = ptsLocal
      .map((p, i) => {
        const q = shift(p);
        return `${i === 0 ? "M" : "L"} ${q.x.toFixed(2)} ${q.y.toFixed(2)}`;
      })
      .join(" ");

    const shiftedPts = ptsLocal.map((p) => shift(p));
    const strokeW = Math.max(vbW * 0.004, 0.8);
    const nodeR = Math.max(vbW * 0.012, 1.2);

    const dimLayers =
      showDims && extenders.length > 0
        ? {
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
            dimStrokeW,
            dash,
            fontSize: fs,
          }
        : null;

    const angleMarkup =
      arcData.length > 0
        ? {
            arcs: arcData
              .map((d) => arcPathBetweenRays(shift(d.p), d.u1, d.u2, d.r))
              .filter((x): x is string => !!x),
            labels: angleLabelsRaw.map((lb) => ({
              x: lb.x + shiftX,
              y: lb.y + shiftY,
              text: lb.text,
            })),
            arcStrokeW: Math.max(dimStrokeW * 1.15, 0.42),
            fontSize: fsAngle,
          }
        : null;

    return {
      pathD,
      vb: `0 0 ${vbW.toFixed(2)} ${vbH.toFixed(2)}`,
      strokeW,
      nodeR,
      ptsLocal: shiftedPts,
      dimLayers,
      angleMarkup,
    };
  }, [pts, segments, bendAnglesDeg]);

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden",
        fill
          ? "h-full min-h-0 w-full rounded-lg border border-border bg-[#0f1419]"
          : "rounded-lg border border-border bg-[#0f1419] aspect-[4/3]",
        className
      )}
    >
      <svg
        viewBox={svg.vb}
        className={
          fill
            ? "h-full w-full min-h-0 max-h-full max-w-full"
            : "max-h-[280px] w-full max-w-full"
        }
        preserveAspectRatio="xMidYMid meet"
        aria-label="Side profile preview"
      >
        {svg.dimLayers ? (
          <g aria-hidden>
            {(() => {
              const dl = svg.dimLayers;
              return (
                <>
                  {dl.extenders.map((e, i) => (
                    <line
                      key={`ext-${i}`}
                      x1={e.x1}
                      y1={e.y1}
                      x2={e.x2}
                      y2={e.y2}
                      stroke={DIM_STROKE_MUTED}
                      strokeWidth={dl.dimStrokeW}
                      strokeDasharray={dl.dash}
                      opacity={0.85}
                    />
                  ))}
                  {dl.dimLines.map((e, i) => (
                    <line
                      key={`dim-${i}`}
                      x1={e.x1}
                      y1={e.y1}
                      x2={e.x2}
                      y2={e.y2}
                      stroke={DIM_STROKE}
                      strokeWidth={dl.dimStrokeW}
                      strokeDasharray={dl.dash}
                      opacity={0.95}
                    />
                  ))}
                  {dl.labels.map((lb, i) => (
                    <text
                      key={`lbl-${i}`}
                      x={lb.x}
                      y={lb.y}
                      fill={DIM_STROKE}
                      fontSize={dl.fontSize}
                      fontWeight={600}
                      fontFamily="ui-sans-serif, system-ui, sans-serif"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${lb.angle}, ${lb.x}, ${lb.y})`}
                    >
                      {lb.text}
                    </text>
                  ))}
                </>
              );
            })()}
          </g>
        ) : null}
        {svg.pathD ? (
          <path
            d={svg.pathD}
            fill="none"
            stroke="hsl(142 70% 45%)"
            strokeWidth={svg.strokeW}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {svg.angleMarkup ? (
          <g aria-hidden>
            {svg.angleMarkup.arcs.map((d, i) => (
              <path
                key={`ang-arc-${i}`}
                d={d}
                fill="none"
                stroke={ANGLE_STROKE}
                strokeWidth={svg.angleMarkup!.arcStrokeW}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.95}
              />
            ))}
          </g>
        ) : null}
        {svg.ptsLocal.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={svg.nodeR}
            fill="hsl(210 15% 85%)"
            stroke="hsl(142 70% 45%)"
            strokeWidth={svg.nodeR * 0.15}
          />
        ))}
        {svg.angleMarkup ? (
          <g aria-hidden>
            {svg.angleMarkup.labels.map((lb, i) => (
              <text
                key={`ang-lbl-${i}`}
                x={lb.x}
                y={lb.y}
                fill={ANGLE_STROKE}
                fontSize={svg.angleMarkup!.fontSize}
                fontWeight={600}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {lb.text}
              </text>
            ))}
          </g>
        ) : null}
      </svg>
    </div>
  );
}
