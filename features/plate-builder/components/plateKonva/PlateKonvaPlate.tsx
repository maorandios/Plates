"use client";

import { useRef, useMemo } from "react";
import Konva from "konva";
import { Line, Circle, Group, Rect, Text } from "react-konva";
import { buildPlateGeometry } from "../../lib/buildPlateGeometry";
import {
  holeIsSlotted,
  type PlateBuilderHole,
  type PlateBuilderSlot,
  type PlateBuilderSpecV1,
} from "../../types";

export const KONVA_NAME_PLATE_HOLE_CIRCLE = "plate-hole-circle";
export const KONVA_NAME_PLATE_HOLE_CAPSULE = "plate-hole-capsule";
export const KONVA_NAME_PLATE_SLOT = "plate-slot-shape";

/** True if drag started on a hole/slot (not the plate chrome). */
export function isKonvaHoleOrSlotDragTarget(
  leaf: Konva.Node,
  plateGroup: Konva.Node
): boolean {
  let n: Konva.Node | null = leaf;
  while (n && n !== plateGroup) {
    const name = n.name();
    if (
      name === KONVA_NAME_PLATE_HOLE_CIRCLE ||
      name === KONVA_NAME_PLATE_HOLE_CAPSULE ||
      name === KONVA_NAME_PLATE_SLOT
    ) {
      return true;
    }
    n = n.getParent();
  }
  return false;
}
import {
  previewMarginMm,
  BATCH_VIEWPORT_SCALE_MIN,
  BATCH_VIEWPORT_SCALE_MAX,
} from "../../lib/plateViewConstants";
import {
  clampCapsuleHoleCenterToFit,
  clampHoleCenter,
  clampSlotCenterToFit,
  conservativeCenterBounds,
} from "../../lib/bounds";

const PAD_PX = 24;
const OUTLINE_STROKE_PX = 2;
const FEATURE_STROKE_PX = 1.5;
const HIT_WIDE = 22;

/** When batch uses one mm→px scale, floor hole radius so small holes stay clickable/visible. */
const BATCH_PREVIEW_MIN_HOLE_RADIUS_PX = 4;

const PLATE_CONTOUR_DIM_FONT = 18;
/** Pixels outside the plate bbox for overall W/H dimension lines. */
const PLATE_CONTOUR_GAP_PX = 26;
/** Space between dimension line and label so text does not sit on the line. */
const PLATE_CONTOUR_LABEL_GAP_PX = 8;
const PLATE_CONTOUR_STROKE = "#334155";

/** Hole/slot center dims from bottom-left (same geometry rules as plate contour). */
const FEATURE_CENTER_DIM_FONT = PLATE_CONTOUR_DIM_FONT;
const FEATURE_CENTER_DIM_STROKE = "#64748b";
/** Offset from center row/column to the solid dim line (px). */
const FEATURE_CENTER_DIM_LINE_GAP_PX = 18;
/** Extra space past the dim line so value text does not touch the stroke. */
const FEATURE_CENTER_DIM_LABEL_GAP_PX = 12;

/**
 * Dimension extension/solid lines: stroke in plate space = this × inv so on-screen
 * thickness stays ~constant (do not use Math.max(floor, inv) — that blows up when zoomed in).
 */
const DIM_LINE_STROKE_BASE_PX = 1;
/** Dash/gap lengths at viewport scale 1; multiplied by inv like stroke. */
const DIM_DASH_LEN_PX = 5;
const DIM_DASH_GAP_PX = 4;

/**
 * For plate outline & feature strokes only: divide plate-local px by viewport
 * scale so stroke weight stays ~constant on screen. Dimension text/lines use
 * dimStyleClampForViewport so on-screen size stays in a readable band.
 */
function dimZoomInv(worldZoomScale: number): number {
  if (!Number.isFinite(worldZoomScale) || worldZoomScale <= 0) return 1;
  const z = Math.max(
    BATCH_VIEWPORT_SCALE_MIN,
    Math.min(BATCH_VIEWPORT_SCALE_MAX, worldZoomScale)
  );
  return 1 / z;
}

/**
 * Dimensions are in plate space then multiplied by workspace `Group` scale.
 * Clamp **on-screen** text size so zoom-in doesn’t make labels huge and zoom-out
 * doesn’t leave them oversized vs a tiny plate.
 */
function dimStyleClampForViewport(
  worldZoomScale: number,
  baseFontPx: number
): {
  font: number;
  strokeW: number;
  dashU: number;
  dashG: number;
  gapScale: number;
} {
  const z = Math.max(
    BATCH_VIEWPORT_SCALE_MIN,
    Math.min(
      BATCH_VIEWPORT_SCALE_MAX,
      Number.isFinite(worldZoomScale) && worldZoomScale > 0 ? worldZoomScale : 1
    )
  );
  const rawScreenPx = baseFontPx * z;
  const minScreen = 8;
  const maxScreen = 20;
  const screenClamped = Math.min(maxScreen, Math.max(minScreen, rawScreenPx));
  const font = screenClamped / z;
  const ratio = font / baseFontPx;
  return {
    font,
    strokeW: Math.max(0.35, DIM_LINE_STROKE_BASE_PX * ratio),
    dashU: Math.max(0.5, DIM_DASH_LEN_PX * ratio),
    dashG: Math.max(0.5, DIM_DASH_GAP_PX * ratio),
    gapScale: ratio,
  };
}

function numPlateMm(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Slots snap to 1 mm (integer positions). */
function snapSlotPositionMm(cx: number, cy: number): [number, number] {
  return [Math.round(cx), Math.round(cy)];
}

/** Holes snap to a 5 mm grid (positions only). */
function snapHolePositionMm(cx: number, cy: number): [number, number] {
  return [Math.round(cx / 5) * 5, Math.round(cy / 5) * 5];
}

function finalizeHolePosition(
  sx: number,
  sy: number,
  cw: number,
  ch: number,
  bw: number,
  bh: number,
  scale: number,
  hole: PlateBuilderHole,
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
): [number, number] {
  let [x, y] = screenToPlateMm(sx, sy, cw, ch, bw, bh, scale);
  const hLen = hole.length ?? 0;
  const hRot = hole.rotationDeg ?? 0;
  const d = hole.diameter;
  const Leff = Math.max(hLen, d);
  if (holeIsSlotted(hole)) {
    [x, y] = clampCapsuleHoleCenterToFit(x, y, Leff, d, hRot, bounds);
  } else {
    [x, y] = clampHoleCenter(x, y, d / 2, bounds);
  }
  [x, y] = snapHolePositionMm(x, y);
  if (holeIsSlotted(hole)) {
    return clampCapsuleHoleCenterToFit(x, y, Leff, d, hRot, bounds);
  }
  return clampHoleCenter(x, y, d / 2, bounds);
}

function formatPlateContourCoord(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(Math.round(r)) : r.toFixed(1);
}

/** Overall width and height of the plate bbox, drawn outside the outline (no X/Y prefixes). */
function PlateContourDimensions({
  widthMm,
  heightMm,
  tx,
  ty,
  worldZoomScale,
}: {
  widthMm: number;
  heightMm: number;
  tx: (x: number) => number;
  ty: (y: number) => number;
  worldZoomScale: number;
}) {
  const st = dimStyleClampForViewport(worldZoomScale, PLATE_CONTOUR_DIM_FONT);
  const gap = PLATE_CONTOUR_GAP_PX * st.gapScale;
  const g = PLATE_CONTOUR_LABEL_GAP_PX * st.gapScale;
  const font = st.font;
  const strokeW = st.strokeW;
  const dashU = st.dashU;
  const dashG = st.dashG;

  const wText = `${formatPlateContourCoord(widthMm)} mm`;
  const hText = `${formatPlateContourCoord(heightMm)} mm`;

  const xL = tx(0);
  const xR = tx(widthMm);
  const yBot = ty(0);
  const yTop = ty(heightMm);

  const yWidthLine = yBot + gap;
  const xHeightLine = xL - gap;
  const midY = (yBot + yTop) / 2;
  const midX = (xL + xR) / 2;
  const estTextW = (s: string, fs: number) => s.length * fs * 0.55;
  const estTextH = font * 1.15;
  const wOffX = estTextW(wText, font) / 2;
  const wOffY = estTextH / 2;
  const hOffX = estTextW(hText, font) / 2;
  const hOffY = estTextH / 2;

  return (
    <>
      <Line
        points={[xL, yBot, xL, yWidthLine]}
        stroke={PLATE_CONTOUR_STROKE}
        strokeWidth={strokeW}
        dash={[dashU, dashG]}
        opacity={0.9}
        listening={false}
      />
      <Line
        points={[xR, yBot, xR, yWidthLine]}
        stroke={PLATE_CONTOUR_STROKE}
        strokeWidth={strokeW}
        dash={[dashU, dashG]}
        opacity={0.9}
        listening={false}
      />
      <Line
        points={[xL, yWidthLine, xR, yWidthLine]}
        stroke={PLATE_CONTOUR_STROKE}
        strokeWidth={strokeW}
        listening={false}
      />
      <Text
        text={wText}
        x={midX}
        y={yWidthLine + g + wOffY}
        fontSize={font}
        fill={PLATE_CONTOUR_STROKE}
        offsetX={wOffX}
        offsetY={wOffY}
        listening={false}
      />

      <Line
        points={[xL, yBot, xHeightLine, yBot]}
        stroke={PLATE_CONTOUR_STROKE}
        strokeWidth={strokeW}
        dash={[dashU, dashG]}
        opacity={0.9}
        listening={false}
      />
      <Line
        points={[xL, yTop, xHeightLine, yTop]}
        stroke={PLATE_CONTOUR_STROKE}
        strokeWidth={strokeW}
        dash={[dashU, dashG]}
        opacity={0.9}
        listening={false}
      />
      <Line
        points={[xHeightLine, yBot, xHeightLine, yTop]}
        stroke={PLATE_CONTOUR_STROKE}
        strokeWidth={strokeW}
        listening={false}
      />
      <Text
        text={hText}
        x={xHeightLine - g - hOffY}
        y={midY}
        fontSize={font}
        fill={PLATE_CONTOUR_STROKE}
        offsetX={hOffX}
        offsetY={hOffY}
        rotation={-90}
        listening={false}
      />
    </>
  );
}

function formatHoleCenterDimMm(n: number): string {
  const s = Math.round(n / 5) * 5;
  return String(s);
}

function formatSlotCenterDimMm(n: number): string {
  return String(Math.round(n));
}

function estDimLabelSize(text: string, fontSize: number): { w: number; h: number } {
  return {
    w: text.length * fontSize * 0.55,
    h: fontSize * 1.15,
  };
}

/**
 * Distances from each plate edge to feature center. One dashed cross through
 * (px, py): horizontal plate edge→edge through center Y, vertical through center X.
 */
function FeatureCenterOriginDimensions({
  plateW,
  plateH,
  cxMm,
  cyMm,
  tx,
  ty,
  formatCoord,
  featureLabel,
  staggerPx,
  worldZoomScale,
}: {
  plateW: number;
  plateH: number;
  cxMm: number;
  cyMm: number;
  tx: (x: number) => number;
  ty: (y: number) => number;
  formatCoord: (n: number) => string;
  featureLabel: string;
  staggerPx: number;
  worldZoomScale: number;
}) {
  const st = dimStyleClampForViewport(worldZoomScale, FEATURE_CENTER_DIM_FONT);
  const g = FEATURE_CENTER_DIM_LABEL_GAP_PX * st.gapScale;
  const stroke = FEATURE_CENTER_DIM_STROKE;
  /** Nudge labels so multiple features don’t stack (lines are unchanged). */
  const labelStagger = staggerPx * 0.35 * st.gapScale;
  const font = st.font;
  const labelFont = (11 / FEATURE_CENTER_DIM_FONT) * st.font;
  const tagPad = 6 * st.gapScale;
  const tagLift = 14 * st.gapScale;
  const strokeW = st.strokeW;
  const dashU = st.dashU;
  const dashG = st.dashG;
  const dash: [number, number] = [dashU, dashG];

  const x0 = tx(0);
  const xR = tx(plateW);
  const y0 = ty(0);
  const yT = ty(plateH);
  const px = tx(cxMm);
  const py = ty(cyMm);

  const leftMm = cxMm;
  const rightMm = plateW - cxMm;
  const bottomMm = cyMm;
  const topMm = plateH - cyMm;

  const leftText = `${formatCoord(leftMm)} mm`;
  const rightText = `${formatCoord(rightMm)} mm`;
  const bottomText = `${formatCoord(bottomMm)} mm`;
  const topText = `${formatCoord(topMm)} mm`;

  const showLeft = leftMm > 1e-6;
  const showRight = rightMm > 1e-6;
  const showBottom = bottomMm > 1e-6;
  const showTop = topMm > 1e-6;

  const hx1 = showLeft ? x0 : px;
  const hx2 = showRight ? xR : px;
  const drawH = showLeft || showRight;

  const vy1 = showBottom ? y0 : py;
  const vy2 = showTop ? yT : py;
  const drawV = showBottom || showTop;

  const midLeftX = (x0 + px) / 2;
  const midRightX = (px + xR) / 2;
  const midBottomY = (y0 + py) / 2;
  const midTopY = (py + yT) / 2;

  const { w: lw, h: lh } = estDimLabelSize(leftText, font);
  const lOffX = lw / 2;
  const lOffY = lh / 2;
  const { w: rw, h: rh } = estDimLabelSize(rightText, font);
  const rOffX = rw / 2;
  const rOffY = rh / 2;
  const { w: botLW, h: botLH } = estDimLabelSize(bottomText, font);
  const bOffX = botLW / 2;
  const bOffY = botLH / 2;
  const { w: tw, h: th } = estDimLabelSize(topText, font);
  const tOffX = tw / 2;
  const tOffY = th / 2;

  return (
    <>
      {drawH && hx1 !== hx2 && (
        <Line
          points={[hx1, py, hx2, py]}
          stroke={stroke}
          strokeWidth={strokeW}
          dash={dash}
          opacity={0.9}
          lineCap="round"
          listening={false}
        />
      )}
      {drawV && vy1 !== vy2 && (
        <Line
          points={[px, vy1, px, vy2]}
          stroke={stroke}
          strokeWidth={strokeW}
          dash={dash}
          opacity={0.9}
          lineCap="round"
          listening={false}
        />
      )}
      {showLeft && (
        <Text
          text={leftText}
          x={midLeftX}
          y={py + g + lOffY + labelStagger}
          fontSize={font}
          fill={stroke}
          offsetX={lOffX}
          offsetY={lOffY}
          listening={false}
        />
      )}
      {showRight && (
        <Text
          text={rightText}
          x={midRightX}
          y={py - g - rOffY - labelStagger}
          fontSize={font}
          fill={stroke}
          offsetX={rOffX}
          offsetY={rOffY}
          listening={false}
        />
      )}
      {showBottom && (
        <Text
          text={bottomText}
          x={px - g - bOffY - labelStagger}
          y={midBottomY}
          fontSize={font}
          fill={stroke}
          offsetX={bOffX}
          offsetY={bOffY}
          rotation={-90}
          listening={false}
        />
      )}
      {showTop && (
        <Text
          text={topText}
          x={px + g + tOffY + labelStagger}
          y={midTopY}
          fontSize={font}
          fill={stroke}
          offsetX={tOffX}
          offsetY={tOffY}
          rotation={-90}
          listening={false}
        />
      )}
      <Text
        text={featureLabel}
        x={px + tagPad}
        y={py - tagLift}
        fontSize={labelFont}
        fill={stroke}
        fontStyle="600"
        listening={false}
      />
    </>
  );
}

function finalizeSlotPosition(
  sx: number,
  sy: number,
  cw: number,
  ch: number,
  bw: number,
  bh: number,
  scale: number,
  slot: PlateBuilderSlot,
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
): [number, number] {
  let [x, y] = screenToPlateMm(sx, sy, cw, ch, bw, bh, scale);
  [x, y] = clampSlotCenterToFit(
    x,
    y,
    slot.length,
    slot.width,
    slot.rotationDeg,
    bounds
  );
  [x, y] = snapSlotPositionMm(x, y);
  return clampSlotCenterToFit(
    x,
    y,
    slot.length,
    slot.width,
    slot.rotationDeg,
    bounds
  );
}

function screenToPlateMm(
  sx: number,
  sy: number,
  cw: number,
  ch: number,
  bw: number,
  bh: number,
  scale: number
): [number, number] {
  const xMm = (sx - cw / 2) / scale + bw / 2;
  const yMm = bh / 2 - (sy - ch / 2) / scale;
  return [xMm, yMm];
}

/** Pointer in plate-root local space (works when plate is nested under pan/zoom). */
function pointerToPlateLocal(
  stage: Konva.Stage | null,
  plateRoot: Konva.Group | null
): { x: number; y: number } | null {
  if (!stage || !plateRoot) return null;
  const pos = stage.getPointerPosition();
  if (!pos) return null;
  const t = plateRoot.getAbsoluteTransform().copy();
  t.invert();
  return t.point(pos);
}

function slotLinePointsRelative(
  ring: [number, number][],
  cx: number,
  cy: number,
  scale: number
): number[] {
  return ring.flatMap(([x, y]) => [(x - cx) * scale, (cy - y) * scale]);
}

export function buildPlateFitTransform(
  cw: number,
  ch: number,
  plateW: number,
  plateH: number,
  marginMm: number
) {
  const xMin = -marginMm;
  const xMax = plateW + marginMm;
  const yMin = -marginMm;
  const yMax = plateH + marginMm;
  const viewW = xMax - xMin;
  const viewH = yMax - yMin;

  const scale = Math.min(
    (cw - 2 * PAD_PX) / viewW,
    (ch - 2 * PAD_PX) / viewH
  );

  const tx = (xMm: number) => cw / 2 + (xMm - plateW / 2) * scale;
  const ty = (yMm: number) => ch / 2 + (plateH / 2 - yMm) * scale;

  return { scale, tx, ty };
}

/** Canvas size (px) for a plate when all batch plates share `mmScale` (px per mm). */
export function plateCanvasSizeForMmScale(
  plateW: number,
  plateH: number,
  marginMm: number,
  mmScale: number
): { cw: number; ch: number } {
  const viewW = plateW + 2 * marginMm;
  const viewH = plateH + 2 * marginMm;
  return {
    cw: viewW * mmScale + 2 * PAD_PX,
    ch: viewH * mmScale + 2 * PAD_PX,
  };
}

/** Same mapping as fit transform would yield if `cw`/`ch` matched `mmScale`. */
export function buildPlateTransformFromMmScale(
  plateW: number,
  plateH: number,
  marginMm: number,
  mmScale: number
) {
  const { cw, ch } = plateCanvasSizeForMmScale(
    plateW,
    plateH,
    marginMm,
    mmScale
  );
  const scale = mmScale;
  const tx = (xMm: number) => cw / 2 + (xMm - plateW / 2) * scale;
  const ty = (yMm: number) => ch / 2 + (plateH / 2 - yMm) * scale;
  return { cw, ch, scale, tx, ty };
}

export interface PlateKonvaPlateProps {
  spec: PlateBuilderSpecV1;
  /** Local pixel viewport for this plate (fit-to-plate transform). */
  cw: number;
  ch: number;
  onHoleCenterChange?: (index: number, cx: number, cy: number) => void;
  onSlotCenterChange?: (index: number, cx: number, cy: number) => void;
  featureDimGuide?: { kind: "hole" | "slot"; index: number } | null;
  onHoleDragGuide?: (index: number | null) => void;
  onSlotDragGuide?: (index: number | null) => void;
  selected?: boolean;
  onPlateSelect?: () => void;
  /**
   * When the plate is drawn inside a scaled workspace `Group`, pass the same
   * scale so outline / hole / slot **strokes** keep ~constant screen thickness.
   * Dimension text and extension lines use fixed plate-local px (zoom with plate).
   */
  worldZoomScale?: number;
  /**
   * Batch canvas: one mm→px scale for every plate so real sizes compare correctly.
   * When set, `cw` / `ch` props are ignored (computed from spec + scale).
   */
  batchMmScale?: number;
}

export function PlateKonvaPlate({
  spec,
  cw,
  ch,
  onHoleCenterChange,
  onSlotCenterChange,
  featureDimGuide = null,
  onHoleDragGuide,
  onSlotDragGuide,
  selected = false,
  onPlateSelect,
  worldZoomScale = 1,
  batchMmScale,
}: PlateKonvaPlateProps) {
  const plateRootRef = useRef<Konva.Group>(null);

  const dragLocalXY = (e: Konva.KonvaEventObject<DragEvent>) => {
    const lp = pointerToPlateLocal(
      e.target.getStage() ?? null,
      plateRootRef.current
    );
    if (lp) return lp;
    return { x: e.target.x(), y: e.target.y() };
  };

  const bw = spec.width;
  const bh = spec.height;
  const invalidDims =
    !Number.isFinite(bw) ||
    !Number.isFinite(bh) ||
    bw <= 0 ||
    bh <= 0;

  let geo: ReturnType<typeof buildPlateGeometry> | null = null;
  if (!invalidDims) {
    try {
      geo = buildPlateGeometry(spec);
    } catch {
      geo = null;
    }
  }

  const showPlate = !invalidDims && geo != null;

  const marginMm = showPlate ? previewMarginMm(bw, bh) : 0;

  const useBatchScale =
    showPlate &&
    batchMmScale != null &&
    Number.isFinite(batchMmScale) &&
    batchMmScale > 0;

  const { cw: cwEff, ch: chEff, scale, tx, ty } = useMemo(() => {
    if (!showPlate) {
      return {
        cw: cw,
        ch: ch,
        scale: 1,
        tx: (_x: number) => 0,
        ty: (_y: number) => 0,
      };
    }
    if (useBatchScale) {
      return buildPlateTransformFromMmScale(bw, bh, marginMm, batchMmScale!);
    }
    const t = buildPlateFitTransform(cw, ch, bw, bh, marginMm);
    return { cw, ch, scale: t.scale, tx: t.tx, ty: t.ty };
  }, [showPlate, batchMmScale, bw, bh, marginMm, cw, ch]);

  const centerBounds = useMemo(
    () =>
      conservativeCenterBounds(
        spec.shapeType,
        bw,
        bh,
        spec.cornerRadius,
        spec.chamferSize
      ),
    [spec.shapeType, bw, bh, spec.cornerRadius, spec.chamferSize]
  );

  let outerPts: number[] = [];
  if (showPlate && geo) {
    outerPts = geo.outer.flatMap(([x, y]) => [tx(x), ty(y)]);
  }

  const dragHoles = Boolean(onHoleCenterChange);
  const dragSlots = Boolean(onSlotCenterChange);
  const holeGuide = onHoleDragGuide;
  const slotGuide = onSlotDragGuide;

  if (!showPlate) {
    return null;
  }

  const outlineStroke = selected ? "#2563eb" : "#1d4ed8";
  const outlineWidth = selected ? OUTLINE_STROKE_PX + 1 : OUTLINE_STROKE_PX;
  /** Plate-local stroke/hit widths so appearance stays ~constant after workspace zoom. */
  const zi = dimZoomInv(worldZoomScale);
  const outlineW = outlineWidth * zi;
  const plateHitW = onPlateSelect ? HIT_WIDE * zi : 0;
  const featStrokeW = FEATURE_STROKE_PX * zi;
  const featHitW = HIT_WIDE * zi;

  const selectPlateTap = onPlateSelect
    ? (e: Konva.KonvaEventObject<TouchEvent | MouseEvent>) => {
        e.cancelBubble = true;
        onPlateSelect();
      }
    : undefined;

  return (
    <Group ref={plateRootRef} name="plate-root">
      <Rect
        name="plate-drag-surface"
        x={0}
        y={0}
        width={cwEff}
        height={chEff}
        fill="rgba(37,99,235,0.04)"
        listening={Boolean(onPlateSelect)}
        onTap={selectPlateTap}
      />
      {outerPts.length >= 6 && onPlateSelect && (
        <Line
          name="plate-face-hit"
          points={outerPts}
          closed
          fill="rgba(37,99,235,0.07)"
          strokeEnabled={false}
          listening
          onTap={selectPlateTap}
        />
      )}
      <Group listening={false}>
        <PlateContourDimensions
          widthMm={bw}
          heightMm={bh}
          tx={tx}
          ty={ty}
          worldZoomScale={worldZoomScale}
        />
        {featureDimGuide &&
          geo &&
          featureDimGuide.kind === "hole" &&
          (() => {
            const i = featureDimGuide.index;
            const item = geo.holeItems[i];
            const h = spec.holes[i];
            if (!item || !h) return null;
            return (
              <FeatureCenterOriginDimensions
                key={`dim-h-${h.id}`}
                plateW={bw}
                plateH={bh}
                cxMm={numPlateMm(item.cx)}
                cyMm={numPlateMm(item.cy)}
                tx={tx}
                ty={ty}
                formatCoord={formatHoleCenterDimMm}
                featureLabel={`Hole ${i + 1}`}
                staggerPx={i * 6}
                worldZoomScale={worldZoomScale}
              />
            );
          })()}
        {featureDimGuide &&
          featureDimGuide.kind === "slot" &&
          (() => {
            const i = featureDimGuide.index;
            const s = spec.slots[i];
            if (!s) return null;
            return (
              <FeatureCenterOriginDimensions
                key={`dim-s-${s.id}`}
                plateW={bw}
                plateH={bh}
                cxMm={numPlateMm(s.cx)}
                cyMm={numPlateMm(s.cy)}
                tx={tx}
                ty={ty}
                formatCoord={formatSlotCenterDimMm}
                featureLabel={`Slot ${i + 1}`}
                staggerPx={(spec.holes.length + i) * 6}
                worldZoomScale={worldZoomScale}
              />
            );
          })()}
      </Group>
      <Line
        points={outerPts}
        closed
        fillEnabled={false}
        stroke={outlineStroke}
        strokeWidth={outlineW}
        lineJoin="round"
        listening={Boolean(onPlateSelect)}
        hitStrokeWidth={plateHitW}
        onTap={selectPlateTap}
      />
      {geo && (
        <Group>
              {geo.holeItems.map((item, i) => {
                const hole = spec.holes[i];
                if (!hole) return null;
                if (item.kind === "circle") {
                  return (
                    <Circle
                      key={`h-${hole.id}`}
                      name={KONVA_NAME_PLATE_HOLE_CIRCLE}
                      x={tx(item.cx)}
                      y={ty(item.cy)}
                      radius={Math.max(
                        1.25 * zi,
                        item.radius * scale,
                        useBatchScale ? BATCH_PREVIEW_MIN_HOLE_RADIUS_PX * zi : 0
                      )}
                      stroke="#dc2626"
                      strokeWidth={featStrokeW}
                      fill="rgba(220,38,38,0.08)"
                      draggable={dragHoles}
                      onDragStart={
                        dragHoles && holeGuide
                          ? () => holeGuide(i)
                          : undefined
                      }
                      onDragMove={
                        dragHoles
                          ? (e) => {
                              if (!onHoleCenterChange) return;
                              const { x: lx, y: ly } = dragLocalXY(e);
                              const [cx, cy] = finalizeHolePosition(
                                lx,
                                ly,
                                cwEff,
                                chEff,
                                bw,
                                bh,
                                scale,
                                hole,
                                centerBounds
                              );
                              e.target.position({ x: tx(cx), y: ty(cy) });
                              onHoleCenterChange(i, cx, cy);
                            }
                          : undefined
                      }
                      onDragEnd={
                        dragHoles
                          ? (e) => {
                              if (onHoleCenterChange) {
                                const { x: lx, y: ly } = dragLocalXY(e);
                                const [cx, cy] = finalizeHolePosition(
                                  lx,
                                  ly,
                                  cwEff,
                                  chEff,
                                  bw,
                                  bh,
                                  scale,
                                  hole,
                                  centerBounds
                                );
                                e.target.position({ x: tx(cx), y: ty(cy) });
                                onHoleCenterChange(i, cx, cy);
                              }
                              holeGuide?.(null);
                            }
                          : undefined
                      }
                      hitStrokeWidth={featHitW}
                      cursor={dragHoles ? "grab" : "default"}
                      onTap={selectPlateTap}
                    />
                  );
                }
                const rel = slotLinePointsRelative(
                  item.outline,
                  item.cx,
                  item.cy,
                  scale
                );
                return (
                  <Group
                    key={`h-${hole.id}`}
                    name={KONVA_NAME_PLATE_HOLE_CAPSULE}
                    x={tx(item.cx)}
                    y={ty(item.cy)}
                    draggable={dragHoles}
                    onDragStart={
                      dragHoles && holeGuide
                        ? () => holeGuide(i)
                        : undefined
                    }
                    onDragMove={
                      dragHoles
                        ? (e) => {
                            if (!onHoleCenterChange) return;
                            const { x: lx, y: ly } = dragLocalXY(e);
                            const [cx, cy] = finalizeHolePosition(
                              lx,
                              ly,
                              cwEff,
                              chEff,
                              bw,
                              bh,
                              scale,
                              hole,
                              centerBounds
                            );
                            e.target.position({ x: tx(cx), y: ty(cy) });
                            onHoleCenterChange(i, cx, cy);
                          }
                        : undefined
                    }
                    onDragEnd={
                      dragHoles
                        ? (e) => {
                            if (onHoleCenterChange) {
                              const { x: lx, y: ly } = dragLocalXY(e);
                              const [cx, cy] = finalizeHolePosition(
                                lx,
                                ly,
                                cwEff,
                                chEff,
                                bw,
                                bh,
                                scale,
                                hole,
                                centerBounds
                              );
                              e.target.position({ x: tx(cx), y: ty(cy) });
                              onHoleCenterChange(i, cx, cy);
                            }
                            holeGuide?.(null);
                          }
                        : undefined
                    }
                    cursor={dragHoles ? "grab" : "default"}
                    onTap={selectPlateTap}
                  >
                    <Line
                      points={rel}
                      closed
                      stroke="#dc2626"
                      strokeWidth={featStrokeW}
                      lineJoin="round"
                      fill="rgba(220,38,38,0.06)"
                      hitStrokeWidth={featHitW}
                    />
                  </Group>
                );
              })}
              {geo.slotOutlines.map((ring, i) => {
                const slot = spec.slots[i];
                if (!slot) return null;
                const scx = numPlateMm(slot.cx);
                const scy = numPlateMm(slot.cy);
                const rel = slotLinePointsRelative(ring, scx, scy, scale);
                return (
                  <Group
                    key={`s-${slot.id}`}
                    name={KONVA_NAME_PLATE_SLOT}
                    x={tx(scx)}
                    y={ty(scy)}
                    draggable={dragSlots}
                    onDragStart={
                      dragSlots && slotGuide
                        ? () => slotGuide(i)
                        : undefined
                    }
                    onDragMove={
                      dragSlots
                        ? (e) => {
                            if (!onSlotCenterChange) return;
                            const { x: lx, y: ly } = dragLocalXY(e);
                            const [cx, cy] = finalizeSlotPosition(
                              lx,
                              ly,
                              cwEff,
                              chEff,
                              bw,
                              bh,
                              scale,
                              slot,
                              centerBounds
                            );
                            e.target.position({ x: tx(cx), y: ty(cy) });
                            onSlotCenterChange(i, cx, cy);
                          }
                        : undefined
                    }
                    onDragEnd={
                      dragSlots
                        ? (e) => {
                            if (onSlotCenterChange) {
                              const { x: lx, y: ly } = dragLocalXY(e);
                              const [cx, cy] = finalizeSlotPosition(
                                lx,
                                ly,
                                cwEff,
                                chEff,
                                bw,
                                bh,
                                scale,
                                slot,
                                centerBounds
                              );
                              e.target.position({ x: tx(cx), y: ty(cy) });
                              onSlotCenterChange(i, cx, cy);
                            }
                            slotGuide?.(null);
                          }
                        : undefined
                    }
                    cursor={dragSlots ? "grab" : "default"}
                    onTap={selectPlateTap}
                  >
                    <Line
                      points={rel}
                      closed
                      stroke="#ea580c"
                      strokeWidth={featStrokeW}
                      lineJoin="miter"
                      fill="rgba(234,88,12,0.06)"
                      hitStrokeWidth={featHitW}
                    />
                  </Group>
                );
              })}
        </Group>
      )}
    </Group>
  );
}
