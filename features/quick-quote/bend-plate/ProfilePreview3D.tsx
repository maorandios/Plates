"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import * as THREE from "three";
import {
  Brush,
  Evaluator,
  HOLLOW_SUBTRACTION,
  SUBTRACTION,
} from "three-bvh-csg";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {
  mergeGeometries,
  mergeVertices,
  toCreasedNormals,
} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { usePlateTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils";
import type { BendSegmentHole } from "./types";
import type { Point2 } from "./geometry";
import { boundsOfPolyline } from "./geometry";
import { plateSegmentHoleCenterOnRectangleBlank } from "./bendPlateHoleFlatBlank";
import { computeSegmentFaceSvgModel } from "./segmentFaceLayout";
import {
  resolvedOvalLengthMm,
  segmentFaceEffectiveWidthMm,
} from "./segmentFaceHolesBounds";

const I18N_ED = "quote.bendPlatePhase.editor";

/**
 * Orthographic-style views (ISO-style, matching the 2D editor):
 * - Profile / slab lies mainly in XY; strip width is along world ±Z.
 * - Top / Bottom: look along ∓Z → see the XY plan (same plane as the 2D canvas).
 * - Front / Back: look along ∓Y → see XZ elevations (חזית / אחורה).
 * - Left / Right: look along ∓X → see YZ.
 * Front/back must use an `up` vector not parallel to the view axis (see applyView).
 */
export type Preview3DViewId =
  | "top"
  | "bottom"
  | "right"
  | "left"
  | "front"
  | "back";

const PREVIEW_3D_VIEW_BUTTONS: { id: Preview3DViewId; labelKey: string }[] = [
  { id: "top", labelKey: `${I18N_ED}.preview3dViewTop` },
  { id: "right", labelKey: `${I18N_ED}.preview3dViewRight` },
  { id: "left", labelKey: `${I18N_ED}.preview3dViewLeft` },
  { id: "bottom", labelKey: `${I18N_ED}.preview3dViewBottom` },
  { id: "front", labelKey: `${I18N_ED}.preview3dViewFront` },
  { id: "back", labelKey: `${I18N_ED}.preview3dViewBack` },
];

export type ProfilePreview3DHandle = {
  applyView: (view: Preview3DViewId) => void;
};

/** Full-width row of orthographic view presets (pairs with `ProfilePreview3D` via ref). */
export function Preview3DViewToolbar({
  onSelect,
  className,
}: {
  onSelect: (id: Preview3DViewId) => void;
  className?: string;
}) {
  return (
    <div
      role="toolbar"
      aria-label={t(`${I18N_ED}.preview3dViewPanelAria`)}
      className={cn(
        "flex w-full shrink-0 flex-row gap-1 px-1.5 sm:gap-1.5 sm:px-2",
        className
      )}
    >
      {PREVIEW_3D_VIEW_BUTTONS.map(({ id, labelKey }) => (
        <Button
          key={id}
          type="button"
          size="sm"
          variant="outline"
          className="h-auto min-h-9 min-w-0 flex-1 justify-center whitespace-normal px-1 py-1.5 text-center text-[10px] leading-tight sm:text-xs sm:leading-snug"
          onClick={() => onSelect(id)}
        >
          {t(labelKey)}
        </Button>
      ))}
    </div>
  );
}

interface ProfilePreview3DProps {
  pts: Point2[];
  plateWidthMm: number;
  /** Metal thickness (mm); in-plane direction perpendicular to the centerline in the 2D profile. */
  thicknessMm?: number;
  /**
   * Inside bend radius (mm) for 3D preview fillets — matches product rule `r = t` when omitted.
   * Centerline arc uses neutral-axis radius `insideRadiusMm + thicknessMm / 2`.
   */
  insideRadiusMm?: number;
  /**
   * Flat פלטה: solid rectangular slab (bounds × thickness) instead of a strip along the outline
   * (which looks like a hollow frame for a closed rectangle).
   */
  flatPlate?: boolean;
  className?: string;
  /** Stretch to parent height (e.g. split-pane editor). */
  fill?: boolean;
  /** Per straight segment index: holes on that face (same order as profile edges). */
  segmentFaceHoles?: BendSegmentHole[][];
  /** When `flatPlate`, rectangle dimensions (mm) for mapping perimeter holes onto the slab top. */
  flatPlateBlankMm?: { lengthMm: number; widthMm: number } | null;
  /** When false, render only the canvas; use `Preview3DViewToolbar` + `ref.applyView` from the parent. */
  viewToolbar?: boolean;
}

const SCALE = 0.001;

/** Dark gray sheet metal — cool neutral with a hint of blue-steel (IBL still picks up highlights). */
const PREVIEW_PLATE_COLOR = new THREE.Color().setHSL(205 / 360, 0.035, 0.4);

/** Mild tone mapping — exposure tuned for RoomEnvironment IBL + directional key. */
function configurePreviewRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = false;
}

/**
 * Physical material: dark gray brushed metal — slightly higher env response so dark base still reads.
 */
function createPreviewPlateMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: PREVIEW_PLATE_COLOR,
    metalness: 0.88,
    roughness: 0.34,
    clearcoat: 0.1,
    clearcoatRoughness: 0.38,
    envMapIntensity: 1.22,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 0,
    flatShading: false,
  });
}

function createPreviewSlabMaterial(): THREE.MeshPhysicalMaterial {
  return createPreviewPlateMaterial();
}

function createPreviewStripMaterial(): THREE.MeshPhysicalMaterial {
  return createPreviewPlateMaterial();
}

/** Key + fill + hemisphere: stronger contrast on edges than flat ambient-only. */
function addPreviewLighting(scene: THREE.Scene): THREE.Light[] {
  const amb = new THREE.AmbientLight(0xffffff, 0.28);
  const hemi = new THREE.HemisphereLight(0xeef2ff, 0x9aa5b8, 0.42);
  hemi.position.set(0, 1, 0);
  const key = new THREE.DirectionalLight(0xffffff, 0.78);
  key.position.set(1.1, 1.35, 0.85);
  const fill = new THREE.DirectionalLight(0xe8ecff, 0.32);
  fill.position.set(-1.2, 0.45, -0.95);
  for (const L of [amb, hemi, key, fill]) scene.add(L);
  return [amb, hemi, key, fill];
}

function disposeLights(lights: THREE.Light[]): void {
  for (const L of lights) L.dispose();
}

/** Align hole rows with polyline edges `pts[i]→pts[i+1]` (pad / trim so index `s` is always segment `s`). */
function padSegmentFaceHolesToSegmentCount(
  rows: BendSegmentHole[][] | undefined,
  segCount: number
): BendSegmentHole[][] {
  const out = [...(rows ?? [])];
  while (out.length < segCount) out.push([]);
  return out.slice(0, segCount);
}

/**
 * Face-local (u, v, n) basis with a *canonical* outward normal `n = uHat × vHat`.
 * This guarantees a right-handed basis even when a segment's (u → world x, v → world y)
 * Jacobian has negative determinant (all flat-plate perimeter segments do). `setFromRotationMatrix`
 * requires a pure rotation — using `uHat × vHat` avoids the reflection that mangles quaternions.
 */
interface FaceBasis {
  uHat: THREE.Vector3;
  vHat: THREE.Vector3;
  nHat: THREE.Vector3;
}
function makeFaceBasis(uHat: THREE.Vector3, vHat: THREE.Vector3): FaceBasis {
  const nHat = new THREE.Vector3().crossVectors(uHat, vHat).normalize();
  return { uHat: uHat.clone().normalize(), vHat: vHat.clone().normalize(), nHat };
}

/**
 * Stadium outline (long axis = +X local, short axis = +Y local, centered on origin) for
 * extrusion along +Z. Long axis on +X matches `capsuleOutlineUvMm`: at rotationDeg=0 the slot
 * runs along +u (plate width). CCW winding gives positive area so `ExtrudeGeometry` normals
 * face outward.
 */
function buildOvalSlotShape(slotLenWorld: number, diameterWorld: number): THREE.Shape {
  const d = Math.max(diameterWorld, 1e-6);
  const L = Math.max(slotLenWorld, d);
  const r = d / 2;
  const halfMinusR = Math.max(L / 2 - r, 0);
  const shape = new THREE.Shape();
  if (halfMinusR < 1e-9) {
    /** Degenerate slot ≈ circle: one full CCW sweep avoids zero-length edges breaking ExtrudeGeometry. */
    shape.moveTo(r, 0);
    shape.absarc(0, 0, r, 0, 2 * Math.PI, false);
    return shape;
  }
  /** Bottom edge right→left? No: CCW traversal starts bottom-left and goes right. */
  shape.moveTo(-halfMinusR, -r);
  shape.lineTo(halfMinusR, -r);
  shape.absarc(halfMinusR, 0, r, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(-halfMinusR, r);
  shape.absarc(-halfMinusR, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false);
  return shape;
}

/**
 * Small *absolute* overshoot (per side, mm) so the hole pokes through the plate by the same
 * visible amount whether the stock is 2 mm or 20 mm. Relative multipliers look fine on thin
 * stock but make the hole stick out like a post on thick stock — this stays flush on thick
 * plates while still preventing z-fighting on thin ones.
 */
/**
 * Extra depth so the cutter fully clears curved strips. CSG often leaves sliver faces inside
 * the opening if the cutter barely reaches the far surface — a bit more depth removes them.
 */
const HOLE_OVERSHOOT_PER_SIDE_MM = 2.75;

/**
 * Preview-only: expand the cutter slightly vs. nominal hole size so boolean subtraction eats
 * numerical tolerance on merged prism meshes (stops “floors” / blocking planes inside holes).
 * Does not change 2D / DXF hole definitions — 3D preview only.
 */
const HOLE_CSG_PLANAR_INFLATE = 1.014;

/** Radial segments for round hole cylinders — higher reduces jagged CSG cuts on bends. */
const HOLE_ROUND_RADIAL_SEGMENTS = 64;

/** Height segments along the hole axis — helps the cutter intersect curved plate triangles cleanly. */
const HOLE_ROUND_HEIGHT_SEGMENTS = 8;

/**
 * Build the hole as a solid in a canonical local frame:
 *   +X = along +u (plate width), +Y = along +v (segment length), +Z = outward plate normal.
 * Extrusion is centered on Z=0 and spans `thickness + 2 · HOLE_OVERSHOOT_PER_SIDE_MM`, so the
 * hole always just barely punches through both plate surfaces — visible on thin stock, barely
 * protruding on thick stock.
 *
 * Rotation sign: matches Konva `Rect`’s rotation matrix (du, dv) = (lx·cos − ly·sin,
 * lx·sin + ly·cos). In the right-handed local frame that matrix is a standard CCW rotation
 * about +Z by `+θ`, so we use `rotateZ(+θ)` for both oval and rect.
 */
function buildHoleLocalGeometry(
  h: BendSegmentHole,
  thicknessMm: number
): THREE.BufferGeometry {
  const depthMm = Math.max(thicknessMm, 0.1) + 2 * HOLE_OVERSHOOT_PER_SIDE_MM;
  const depth = Math.max(depthMm * SCALE, 1e-4);
  const θ = ((h.rotationDeg ?? 0) * Math.PI) / 180;

  let geom: THREE.BufferGeometry;
  if (h.kind === "round") {
    const r =
      Math.max((h.diameterMm * SCALE) / 2, 1e-5) * HOLE_CSG_PLANAR_INFLATE;
    geom = new THREE.CylinderGeometry(
      r,
      r,
      depth,
      HOLE_ROUND_RADIAL_SEGMENTS,
      HOLE_ROUND_HEIGHT_SEGMENTS,
      false
    );
    /** Cylinder axis is +Y by default; rotate so axis = +Z (plate normal). */
    geom.rotateX(Math.PI / 2);
    geom.computeVertexNormals();
    return geom;
  }

  if (h.kind === "oval") {
    const d =
      Math.max(h.diameterMm * SCALE, 1e-5) * HOLE_CSG_PLANAR_INFLATE;
    const slotL = Math.max(
      resolvedOvalLengthMm(h) * SCALE * HOLE_CSG_PLANAR_INFLATE,
      d
    );
    const shape = buildOvalSlotShape(slotL, d);
    geom = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: false,
      curveSegments: 16,
      steps: 1,
    });
    /** ExtrudeGeometry extrudes from z=0 to z=+depth. Center on Z=0. */
    geom.translate(0, 0, -depth / 2);
    if (θ !== 0) geom.rotateZ(θ);
    return geom;
  }

  const rw =
    Math.max((h.rectWidthMm ?? 0) * SCALE, 1e-5) * HOLE_CSG_PLANAR_INFLATE;
  const rl =
    Math.max((h.rectLengthMm ?? 0) * SCALE, 1e-5) * HOLE_CSG_PLANAR_INFLATE;
  /** BoxGeometry local axes: X=rectLength (+u at 0°), Y=rectWidth (+v at 0°), Z=depth (normal). */
  geom = new THREE.BoxGeometry(rl, rw, depth);
  if (θ !== 0) geom.rotateZ(θ);
  return geom;
}

/** Face basis along a straight profile edge Pa→Pb (bent profiles). */
function bentFaceBasis(Pa: THREE.Vector3, Pb: THREE.Vector3): FaceBasis | null {
  const dir = new THREE.Vector3().subVectors(Pb, Pa);
  const Llen = dir.length();
  if (Llen < 1e-12) return null;
  const T = dir.clone().divideScalar(Llen);
  /** Plate width (vertical, +Z world) is +u; segment direction T is +v; outward normal is N. */
  const B = new THREE.Vector3(0, 0, 1);
  return makeFaceBasis(B, T);
}

/** CSG brush for one hole in world space (same placement as former overlay meshes). */
function spawnHoleBrush(
  h: BendSegmentHole,
  thicknessMm: number,
  basis: FaceBasis,
  centerWorld: THREE.Vector3
): Brush {
  const g = buildHoleLocalGeometry(h, thicknessMm);
  const brush = new Brush(g);
  brush.quaternion.setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(basis.uHat, basis.vHat, basis.nHat)
  );
  brush.position.copy(centerWorld);
  brush.updateMatrixWorld();
  return brush;
}

/** Arc length of `filleted[iFrom] → … → filleted[iTo]` along edges (inclusive endpoints). */
function polylineLength2D(
  filleted: Point2[],
  iFrom: number,
  iTo: number
): number {
  let len = 0;
  for (let i = iFrom; i < iTo; i++) {
    const a = filleted[i];
    const b = filleted[i + 1];
    if (!a || !b) break;
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

/**
 * Point at distance `dist` along the sub-polyline from `iFrom` to `iTo` (inclusive),
 * plus the micro-edge Pa→Pb that contains that point (for `bentFaceBasis` matching the prism mesh).
 */
function pointAtDistanceAlongPolyline(
  filleted: Point2[],
  iFrom: number,
  iTo: number,
  dist: number
): { point: THREE.Vector3; pa: THREE.Vector3; pb: THREE.Vector3 } | null {
  const dt = Math.max(0, dist);
  let acc = 0;
  for (let i = iFrom; i < iTo; i++) {
    const a = filleted[i];
    const b = filleted[i + 1];
    if (!a || !b) break;
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (segLen < 1e-18) continue;
    if (acc + segLen >= dt - 1e-12) {
      const t = Math.max(0, Math.min(1, (dt - acc) / segLen));
      const px = a.x + (b.x - a.x) * t;
      const py = a.y + (b.y - a.y) * t;
      return {
        point: new THREE.Vector3(px * SCALE, py * SCALE, 0),
        pa: new THREE.Vector3(a.x * SCALE, a.y * SCALE, 0),
        pb: new THREE.Vector3(b.x * SCALE, b.y * SCALE, 0),
      };
    }
    acc += segLen;
  }
  const last = filleted[iTo];
  if (!last) return null;
  const z = new THREE.Vector3(last.x * SCALE, last.y * SCALE, 0);
  return { point: z.clone(), pa: z.clone(), pb: z.clone() };
}

function collectHoleBrushesBent(
  /** High-res filleted centerline — same polyline as `buildBentProfilePrismGeometry`. */
  filletedPts: Point2[],
  /** Logical profile vertices (same as 2D editor) — chord length & hole row index. */
  originalPts: Point2[],
  /** Inclusive vertex index per logical segment on `filletedPts` (from fillet). */
  segmentStartIdx: number[],
  segmentEndIdx: number[],
  segmentFaceHoles: BendSegmentHole[][],
  plateWidthMm: number,
  thicknessMm: number
): Brush[] {
  const brushes: Brush[] = [];
  const hpw = Math.max((plateWidthMm * SCALE) / 2, 0.00005);
  const nSeg = Math.max(0, originalPts.length - 1);

  for (let s = 0; s < nSeg; s++) {
    const row = segmentFaceHoles[s] ?? [];
    if (!row.length) continue;
    const iFrom = segmentStartIdx[s] ?? 0;
    /**
     * Include the bend arc through the next vertex so holes can sit on / through the radius
     * (same strip as the mesh), not only the straight run ending at P1 before the fillet.
     * Last segment has no following arc — end at the profile tip.
     */
    const iTo =
      s < nSeg - 1
        ? (segmentStartIdx[s + 1] ?? segmentEndIdx[s] ?? 0)
        : (segmentEndIdx[s] ?? 0);
    if (iTo < iFrom || iFrom < 0 || iTo >= filletedPts.length) continue;

    const oa = originalPts[s];
    const ob = originalPts[s + 1];
    if (!oa || !ob) continue;
    const Lmm = Math.hypot(ob.x - oa.x, ob.y - oa.y);
    if (Lmm < 1e-12) continue;

    const pathLen = polylineLength2D(filletedPts, iFrom, iTo);
    if (pathLen < 1e-12) continue;

    const layout = computeSegmentFaceSvgModel(Lmm, plateWidthMm, `${s}`);
    if (layout.kind !== "ok") continue;
    const Wmm = segmentFaceEffectiveWidthMm(
      layout.plateWidthMm,
      layout.segmentLenMm,
      layout.plateWidthDrawMm
    );

    for (const h of row) {
      const dist = Math.max(
        0,
        Math.min(pathLen, (h.vMm / Lmm) * pathLen)
      );
      const hit = pointAtDistanceAlongPolyline(filletedPts, iFrom, iTo, dist);
      if (!hit) continue;
      const basis = bentFaceBasis(hit.pa, hit.pb);
      if (!basis) continue;
      const uAcross = (h.uMm / Wmm - 0.5) * (2 * hpw);
      const center = hit.point
        .clone()
        .add(basis.uHat.clone().multiplyScalar(uAcross));
      brushes.push(spawnHoleBrush(h, thicknessMm, basis, center));
    }
  }
  return brushes;
}

/**
 * Flat plate: holes are stored on the top surface only (row 0), same UV as 2D editor / DXF
 * (`plateSegmentHoleCenterOnRectangleBlank` with segIdx 0). Basis: +X × +Y = +Z (outward top face).
 */
function flatPlateTopSurfaceBasis(): FaceBasis {
  return makeFaceBasis(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0)
  );
}

function collectHoleBrushesFlatPlate(
  segmentFaceHoles: BendSegmentHole[][],
  lengthMm: number,
  widthMm: number,
  bw: number,
  bh: number,
  cx: number,
  cy: number,
  td: number
): Brush[] {
  const brushes: Brush[] = [];
  const L = Math.max(lengthMm, 1e-6);
  const W = Math.max(widthMm, 1e-6);
  const thicknessMm = td / SCALE;

  const row = segmentFaceHoles[0];
  if (!row?.length) return brushes;

  const basis = flatPlateTopSurfaceBasis();
  for (const h of row) {
    const p = plateSegmentHoleCenterOnRectangleBlank(0, h.uMm, h.vMm, L, W);
    const wx = cx + (p.x / L - 0.5) * bw;
    const wy = cy + (p.y / W - 0.5) * bh;
    const wz = td / 2;
    brushes.push(
      spawnHoleBrush(h, thicknessMm, basis, new THREE.Vector3(wx, wy, wz))
    );
  }
  return brushes;
}

/**
 * Subtract hole volumes from plate mesh so openings show the viewer background.
 * Solid SUBTRACTION usually gives cleaner through-holes than HOLLOW_SUBTRACTION on merged
 * strips; we try several splitter / operation combinations before giving up.
 */
function subtractHolesFromPlateGeometry(
  plateGeom: THREE.BufferGeometry,
  holeBrushes: Brush[]
): THREE.BufferGeometry | null {
  if (holeBrushes.length === 0) return plateGeom;

  const evaluateChain = (
    operation: typeof HOLLOW_SUBTRACTION | typeof SUBTRACTION,
    useCDT: boolean
  ) => {
    const evaluator = new Evaluator() as Evaluator & { useCDTClipping: boolean };
    evaluator.useCDTClipping = useCDT;
    evaluator.useGroups = false;
    let plateBrush: Brush = new Brush(plateGeom.clone());
    plateBrush.updateMatrixWorld();
    for (const hb of holeBrushes) {
      plateBrush = evaluator.evaluate(plateBrush, hb, operation);
    }
    const g = plateBrush.geometry;
    g.computeVertexNormals();
    return g;
  };

  const attempts: Array<
    [typeof SUBTRACTION | typeof HOLLOW_SUBTRACTION, boolean]
  > = [
    [SUBTRACTION, true],
    [SUBTRACTION, false],
    [HOLLOW_SUBTRACTION, true],
    [HOLLOW_SUBTRACTION, false],
  ];

  for (const [op, useCDT] of attempts) {
    try {
      return evaluateChain(op, useCDT);
    } catch {
      /* try next */
    }
  }
  return null;
}

function disposeHoleBrushes(brushes: Brush[]): void {
  for (const b of brushes) {
    b.geometry.dispose();
  }
}

/**
 * Smooth vertex normals so bend prism facets shade as one surface. `toCreasedNormals` keeps
 * edges sharper than `creaseAngle` — ~81° keeps hole rims crisp while merging small facet angles
 * along the fillet (see three.js BufferGeometryUtils.toCreasedNormals).
 */
function applyBentPreviewSmoothing(
  g: THREE.BufferGeometry,
  hasThroughHoles: boolean
): THREE.BufferGeometry {
  g.computeVertexNormals();
  const creaseAngle = hasThroughHoles ? Math.PI * 0.45 : Math.PI * 0.48;
  const out = toCreasedNormals(g, creaseAngle);
  if (out !== g) {
    g.dispose();
  }
  return out;
}

const MM_EPS = 1e-4;

function distSq2D(a: Point2, b: Point2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

interface FilletCenterlineResult {
  points: Point2[];
  /** Inclusive index in `points` where logical segment `s` (edge originalPts[s]→originalPts[s+1]) starts. */
  segmentStartIdx: number[];
  /** Inclusive index in `points` where logical segment `s` ends. */
  segmentEndIdx: number[];
}

/**
 * Replaces sharp polyline corners with tangent arcs (centerline = neutral axis: Ri + t/2).
 * Short legs clamp the arc so the preview never inverts.
 * Also records per logical segment vertex ranges on the filleted path (straight runs only, not bend arcs).
 */
function filletCenterlinePolyline(
  pts: Point2[],
  insideRadiusMm: number,
  thicknessMm: number
): FilletCenterlineResult {
  const n = pts.length;
  const nSeg = Math.max(0, n - 1);
  const segmentStartIdx = new Array<number>(nSeg);
  const segmentEndIdx = new Array<number>(nSeg);

  if (n < 2) {
    return { points: [], segmentStartIdx: [], segmentEndIdx: [] };
  }
  if (n < 3) {
    const points = pts.map((p) => ({ ...p }));
    if (nSeg === 1) {
      segmentStartIdx[0] = 0;
      segmentEndIdx[0] = Math.max(0, points.length - 1);
    }
    return { points, segmentStartIdx, segmentEndIdx };
  }

  const tMm = Math.max(thicknessMm, 0.01);
  const ri = Math.max(insideRadiusMm, 0.01);
  /** Neutral-axis radius (mm) — between inner Ri and outer Ri+t. */
  const R = ri + tMm / 2;

  const out: Point2[] = [];
  const pushDistinct = (p: Point2) => {
    const last = out[out.length - 1];
    if (!last || distSq2D(last, p) > MM_EPS * MM_EPS) out.push({ ...p });
  };

  pushDistinct(pts[0]);
  segmentStartIdx[0] = 0;

  const recordCornerDegenerate = (segmentEnd: number, segmentStart: number) => {
    segmentEndIdx[segmentEnd] = out.length - 1;
    segmentStartIdx[segmentStart] = out.length - 1;
  };

  for (let i = 1; i <= n - 2; i++) {
    const A = pts[i - 1];
    const B = pts[i];
    const C = pts[i + 1];

    const vABx = B.x - A.x;
    const vABy = B.y - A.y;
    const vBCx = C.x - B.x;
    const vBCy = C.y - B.y;
    const lenAB = Math.hypot(vABx, vABy);
    const lenBC = Math.hypot(vBCx, vBCy);
    if (lenAB < 1e-9 || lenBC < 1e-9) {
      pushDistinct(B);
      recordCornerDegenerate(i - 1, i);
      continue;
    }

    const tInx = vABx / lenAB;
    const tIny = vABy / lenAB;
    const tOutx = vBCx / lenBC;
    const tOuty = vBCy / lenBC;

    const uinx = -tInx;
    const uiny = -tIny;
    const dot = uinx * tOutx + uiny * tOuty;
    const delta = Math.acos(Math.max(-1, Math.min(1, dot)));
    if (delta < 1e-4 || delta > Math.PI - 1e-4) {
      pushDistinct(B);
      recordCornerDegenerate(i - 1, i);
      continue;
    }

    const cross = tInx * tOuty - tIny * tOutx;
    const sign = cross >= 0 ? 1 : -1;

    let d = R / Math.tan(delta / 2);
    const maxD = Math.min(lenAB, lenBC) * 0.49;
    let rEff = R;
    if (d > maxD) {
      d = maxD;
      rEff = d * Math.tan(delta / 2);
    }
    if (rEff < 0.02) {
      pushDistinct(B);
      recordCornerDegenerate(i - 1, i);
      continue;
    }

    const P1 = { x: B.x - tInx * d, y: B.y - tIny * d };
    const P2 = { x: B.x + tOutx * d, y: B.y + tOuty * d };

    const nlx = -tIny * sign;
    const nly = tInx * sign;
    const O = { x: P1.x + nlx * rEff, y: P1.y + nly * rEff };

    const a1 = Math.atan2(P1.y - O.y, P1.x - O.x);
    const a2 = Math.atan2(P2.y - O.y, P2.x - O.x);
    let sweep = a2 - a1;
    if (cross > 0) {
      while (sweep <= 0) sweep += 2 * Math.PI;
    } else {
      while (sweep >= 0) sweep -= 2 * Math.PI;
    }

    pushDistinct(P1);
    segmentEndIdx[i - 1] = out.length - 1;

    const arcDeg = (Math.abs(sweep) * 180) / Math.PI;
    /** Dense arc tessellation (~≤1° per step) so bend reads as one smooth piece in 3D. */
    const nSteps = Math.max(48, Math.ceil(arcDeg / 1.05));
    for (let step = 1; step < nSteps; step++) {
      const u = step / nSteps;
      const ang = a1 + sweep * u;
      pushDistinct({
        x: O.x + rEff * Math.cos(ang),
        y: O.y + rEff * Math.sin(ang),
      });
    }
    pushDistinct(P2);
    segmentStartIdx[i] = out.length - 1;
  }

  pushDistinct(pts[n - 1]);
  segmentEndIdx[nSeg - 1] = out.length - 1;
  return { points: out, segmentStartIdx, segmentEndIdx };
}

/**
 * One rectangular prism per straight segment: local X = in-plane thickness, Y = plate width (Z
 * world), Z = along path.
 *
 * Adjacent boxes meet at a bend angle; their end faces are not coplanar, so exact-length prisms
 * leave hairline cracks (background showing through). Extend each segment along the path by a
 * small overlap so consecutive solids intersect — reads as one continuous bent plate in preview.
 */
function buildBentProfilePrismGeometry(
  pts: Point2[],
  halfThickness: number,
  halfPlateWidth: number
): THREE.BufferGeometry {
  const hx = Math.max(halfThickness, 1e-9);
  const hy = Math.max(halfPlateWidth, 1e-9);
  const B = new THREE.Vector3(0, 0, 1);

  const parts: THREE.BufferGeometry[] = [];
  const quat = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);

  for (let s = 0; s < pts.length - 1; s++) {
    const Pa = new THREE.Vector3(pts[s].x * SCALE, pts[s].y * SCALE, 0);
    const Pb = new THREE.Vector3(pts[s + 1].x * SCALE, pts[s + 1].y * SCALE, 0);
    const dir = new THREE.Vector3().subVectors(Pb, Pa);
    const L = dir.length();
    if (L < 1e-12) continue;
    const T = dir.clone().divideScalar(L);
    const N = new THREE.Vector3(-T.y, T.x, 0);
    if (N.lengthSq() < 1e-18) continue;
    N.normalize();

    const mid = new THREE.Vector3().addVectors(Pa, Pb).multiplyScalar(0.5);
    const rot = new THREE.Matrix4().makeBasis(N, B, T);
    quat.setFromRotationMatrix(rot);

    /** Per-end extension along T so joints seal (world units ≈ metres). */
    const overlapLen = Math.max(L * 0.008, hx * 0.32, 5e-8);
    const Lext = L + 2 * overlapLen;

    const box = new THREE.BoxGeometry(hx * 2, hy * 2, Lext);
    const mtx = new THREE.Matrix4().compose(mid, quat, scale);
    box.applyMatrix4(mtx);
    parts.push(box);
  }

  if (parts.length === 0) {
    return new THREE.BoxGeometry(hx * 2, hy * 2, Math.max(hx * 2, 1e-4));
  }

  const merged = mergeGeometries(parts);
  for (const p of parts) {
    p.dispose();
  }
  if (!merged) {
    return new THREE.BoxGeometry(hx * 2, hy * 2, Math.max(hx * 2, 1e-4));
  }
  /**
   * Weld only truly coincident vertices (keep normals/UVs so half-edge / CSG stay valid).
   * Smooth shading is applied after hole subtraction via `applyBentPreviewSmoothing`.
   */
  const welded = mergeVertices(merged, 1e-5);
  merged.dispose();
  welded.computeVertexNormals();
  return welded;
}

export const ProfilePreview3D = forwardRef<
  ProfilePreview3DHandle,
  ProfilePreview3DProps
>(function ProfilePreview3D(
  {
    pts,
    plateWidthMm,
    thicknessMm = 2,
    insideRadiusMm: insideRadiusMmProp,
    flatPlate = false,
    className,
    fill,
    segmentFaceHoles,
    flatPlateBlankMm = null,
    viewToolbar = true,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<{
    applyView: (view: Preview3DViewId) => void;
  } | null>(null);
  const { theme } = usePlateTheme();

  useImperativeHandle(
    ref,
    () => ({
      applyView: (view: Preview3DViewId) => {
        viewerRef.current?.applyView(view);
      },
    }),
    []
  );
  /** Deep signature so the WebGL effect re-runs even if callers mutate nested hole arrays in place. */
  const segmentFaceHolesKey = JSON.stringify(segmentFaceHoles ?? []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || pts.length < 2) return;

    const w = el.clientWidth || 320;
    const h = el.clientHeight || 220;

    const scene = new THREE.Scene();
    const viewerBg =
      theme === "light" ? 0xf4f4f5 /* matches --viewer-canvas light */ : 0x0f1419;
    scene.background = new THREE.Color(viewerBg);

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.001, 500);
    const b = boundsOfPolyline(pts);
    const cx = ((b.minX + b.maxX) / 2) * SCALE;
    const cy = ((b.minY + b.maxY) / 2) * SCALE;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      logarithmicDepthBuffer: true,
    });
    configurePreviewRenderer(renderer);
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.innerHTML = "";
    el.appendChild(renderer.domElement);

    /** IBL for realistic metal/paint response (reflections define edges without wireframe). */
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.update();

    const lights = addPreviewLighting(scene);

    let pathPtsForHoles: Point2[] = pts;
    let bendSegmentStartIdx: number[] = [];
    let bendSegmentEndIdx: number[] = [];
    let geom: THREE.BufferGeometry;
    if (flatPlate) {
      const bw = Math.max((b.maxX - b.minX) * SCALE, 0.001);
      const bh = Math.max((b.maxY - b.minY) * SCALE, 0.001);
      const td = Math.max(thicknessMm * SCALE, 0.001);
      const minDim = Math.min(bw, bh, td);
      /** Corner / edge round radius — capped so thin sheets stay valid. */
      const cornerRadius = Math.max(
        Math.min(minDim * 0.07, minDim * 0.42),
        minDim * 0.02
      );
      const roundSegments = 5;
      geom = new RoundedBoxGeometry(bw, bh, td, roundSegments, cornerRadius);
      geom.translate(cx, cy, td / 2);
    } else {
      const ht = Math.max((thicknessMm * SCALE) / 2, 0.00005);
      const hpw = Math.max((plateWidthMm * SCALE) / 2, 0.00005);
      const ri = insideRadiusMmProp ?? thicknessMm;
      const filletRes = filletCenterlinePolyline(pts, ri, thicknessMm);
      pathPtsForHoles = filletRes.points;
      bendSegmentStartIdx = filletRes.segmentStartIdx;
      bendSegmentEndIdx = filletRes.segmentEndIdx;
      geom = buildBentProfilePrismGeometry(pathPtsForHoles, ht, hpw);
    }

    geom.computeBoundingBox();
    const bb = geom.boundingBox;
    let meshCx = cx;
    let meshCy = cy;
    let meshCz = 0;
    let meshExtent = 0.1;
    if (bb) {
      const mtx = (bb.min.x + bb.max.x) / 2;
      const mty = (bb.min.y + bb.max.y) / 2;
      const mtz = (bb.min.z + bb.max.z) / 2;
      const ext = Math.max(
        bb.max.x - bb.min.x,
        bb.max.y - bb.min.y,
        bb.max.z - bb.min.z,
        0.001
      );
      meshCx = mtx;
      meshCy = mty;
      meshCz = mtz;
      meshExtent = ext;
      /** Tight near/far around the part improves depth resolution for very thin thickness. */
      camera.near = Math.max(ext * 1e-4, 1e-6);
      camera.far = Math.max(ext * 80, 1);
      camera.updateProjectionMatrix();
      camera.position.set(mtx + ext * 0.55, mty + ext * 0.42, mtz + ext * 0.92);
      controls.target.set(mtx, mty, mtz);
      camera.lookAt(mtx, mty, mtz);
    } else {
      camera.position.set(cx + 0.01, cy + 0.01, 0.05);
      controls.target.set(cx, cy, 0);
      camera.lookAt(cx, cy, 0);
    }
    controls.update();

    function applyView(view: Preview3DViewId) {
      const d = Math.max(meshExtent * 1.2, 0.01);
      const tx = meshCx;
      const ty = meshCy;
      const tz = meshCz;
      /** World +Y must not be used as camera.up when the eye lies on ±Y (parallel to view dir). */
      switch (view) {
        case "top":
          /** TOP VIEW: look along −Z onto XY (plan view, same as 2D). */
          camera.position.set(tx, ty, tz + d);
          camera.up.set(0, 1, 0);
          break;
        case "bottom":
          /** BOTTOM VIEW: look along +Z onto XY. */
          camera.position.set(tx, ty, tz - d);
          camera.up.set(0, 1, 0);
          break;
        case "right":
          camera.position.set(tx + d, ty, tz);
          camera.up.set(0, 1, 0);
          break;
        case "left":
          camera.position.set(tx - d, ty, tz);
          camera.up.set(0, 1, 0);
          break;
        case "front":
          /** FRONT VIEW: look along −Y onto XZ (חזית). */
          camera.position.set(tx, ty + d, tz);
          camera.up.set(0, 0, 1);
          break;
        case "back":
          /** BACK VIEW: look along +Y onto XZ (אחורה). */
          camera.position.set(tx, ty - d, tz);
          camera.up.set(0, 0, 1);
          break;
      }
      controls.target.set(tx, ty, tz);
      camera.lookAt(tx, ty, tz);
      controls.update();
    }
    viewerRef.current = { applyView };

    const mat = flatPlate ? createPreviewSlabMaterial() : createPreviewStripMaterial();

    const rowsRaw = segmentFaceHoles ?? [];
    const hasAnyHole = rowsRaw.some((row) => row && row.length > 0);
    let holeBrushes: Brush[] = [];
    if (hasAnyHole) {
      if (flatPlate && flatPlateBlankMm) {
        const bw = Math.max((b.maxX - b.minX) * SCALE, 0.001);
        const bh = Math.max((b.maxY - b.minY) * SCALE, 0.001);
        const td = Math.max(thicknessMm * SCALE, 0.001);
        holeBrushes = collectHoleBrushesFlatPlate(
          rowsRaw,
          flatPlateBlankMm.lengthMm,
          flatPlateBlankMm.widthMm,
          bw,
          bh,
          cx,
          cy,
          td
        );
      } else if (!flatPlate) {
        const segBent = Math.max(0, pts.length - 1);
        const paddedBent = padSegmentFaceHolesToSegmentCount(rowsRaw, segBent);
        holeBrushes = collectHoleBrushesBent(
          pathPtsForHoles,
          pts,
          bendSegmentStartIdx,
          bendSegmentEndIdx,
          paddedBent,
          plateWidthMm,
          thicknessMm
        );
      }
    }

    let geomForRender = geom;
    if (holeBrushes.length > 0) {
      geom.clearGroups();
      const carved = subtractHolesFromPlateGeometry(geom, holeBrushes);
      disposeHoleBrushes(holeBrushes);
      if (carved) {
        geom.dispose();
        geomForRender = carved;
      } else if (process.env.NODE_ENV === "development") {
        console.warn(
          "[ProfilePreview3D] CSG hole subtraction failed; showing solid plate."
        );
      }
    }

    if (!flatPlate) {
      geomForRender = applyBentPreviewSmoothing(
        geomForRender,
        holeBrushes.length > 0
      );
    }

    const mesh = new THREE.Mesh(geomForRender, mat);
    scene.add(mesh);

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(animate);

    const ro = new ResizeObserver(() => {
      if (!containerRef.current) return;
      const nw = containerRef.current.clientWidth;
      const nh = containerRef.current.clientHeight;
      if (nw < 10 || nh < 10) return;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    });
    ro.observe(el);

    return () => {
      viewerRef.current = null;
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      scene.remove(mesh);
      geomForRender.dispose();
      mat.dispose();
      scene.environment = null;
      envTexture.dispose();
      pmremGenerator.dispose();
      disposeLights(lights);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [
    pts,
    plateWidthMm,
    thicknessMm,
    insideRadiusMmProp,
    flatPlate,
    segmentFaceHolesKey,
    flatPlateBlankMm,
    theme,
  ]);

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-col overflow-hidden rounded-lg",
        fill ? "h-full min-h-0 w-full" : "min-h-[220px] w-full",
        className
      )}
    >
      <div
        ref={containerRef}
        className={cn(
          "min-h-0 w-full flex-1 bg-[hsl(var(--viewer-canvas))]",
          fill ? "h-full" : "min-h-[220px]"
        )}
      />
      {viewToolbar ? (
        <div className="shrink-0 border-t border-border bg-background">
          <Preview3DViewToolbar
            className="py-2"
            onSelect={(id) => viewerRef.current?.applyView(id)}
          />
        </div>
      ) : null}
    </div>
  );
});
