"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
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
}

const SCALE = 0.001;

/** Shared renderer tuning — softer shading on all bend-plate 3D previews. */
function configurePreviewRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
}

/** Flat ריבוע slab only — slight clearcoat reads well on rounded box. */
function createPreviewSlabMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0x5a9e7a,
    metalness: 0.2,
    roughness: 0.58,
    clearcoat: 0.12,
    clearcoatRoughness: 0.48,
    flatShading: false,
  });
}

/**
 * Bent profiles (L/U/Z/Ω/gutter/custom): path-swept rectangular section — no clearcoat so edges stay crisp.
 * (Solid prism per straight run — planar faces; ring-sweeps gave non-planar quads and noisy edge lines.)
 */
function createPreviewStripMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x5a9e7a,
    metalness: 0.28,
    roughness: 0.52,
    flatShading: false,
  });
}

/** Hemisphere + key + fill — same for flat slab and extruded strip profiles. */
function addPreviewLighting(scene: THREE.Scene): THREE.Light[] {
  const amb = new THREE.AmbientLight(0xffffff, 0.42);
  const hemi = new THREE.HemisphereLight(0xc8d4e0, 0x1a2228, 0.35);
  hemi.position.set(0, 1, 0);
  const dir = new THREE.DirectionalLight(0xffffff, 0.72);
  dir.position.set(2, 4, 3);
  const fillLight = new THREE.DirectionalLight(0xa8c4b8, 0.28);
  fillLight.position.set(-3, -1, -2);
  for (const L of [amb, hemi, dir, fillLight]) scene.add(L);
  return [amb, hemi, dir, fillLight];
}

function disposeLights(lights: THREE.Light[]): void {
  for (const L of lights) L.dispose();
}

/**
 * Dark, slightly-emissive, double-sided material so holes read from any view angle
 * (including grazing angles on thin stock). polygonOffset is intentionally OFF — pushing
 * hole fragments backward behind the plate caused the earlier "disappearing" popping.
 */
const HOLE_MAT = new THREE.MeshStandardMaterial({
  color: 0x1a2420,
  emissive: 0x0c1210,
  emissiveIntensity: 0.22,
  metalness: 0.32,
  roughness: 0.52,
  side: THREE.DoubleSide,
});

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
const HOLE_OVERSHOOT_PER_SIDE_MM = 0.2;

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
    const r = Math.max((h.diameterMm * SCALE) / 2, 1e-5);
    geom = new THREE.CylinderGeometry(r, r, depth, 32);
    /** Cylinder axis is +Y by default; rotate so axis = +Z (plate normal). */
    geom.rotateX(Math.PI / 2);
    return geom;
  }

  if (h.kind === "oval") {
    const d = Math.max(h.diameterMm * SCALE, 1e-5);
    const slotL = Math.max(resolvedOvalLengthMm(h) * SCALE, d);
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

  const rw = Math.max((h.rectWidthMm ?? 0) * SCALE, 1e-5);
  const rl = Math.max((h.rectLengthMm ?? 0) * SCALE, 1e-5);
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

/** Place a single hole: canonical local geometry → (uHat, vHat, nHat) basis → world position. */
function spawnHoleMesh(
  scene: THREE.Scene,
  h: BendSegmentHole,
  thicknessMm: number,
  basis: FaceBasis,
  centerWorld: THREE.Vector3,
  meshes: THREE.Mesh[]
): void {
  const geom = buildHoleLocalGeometry(h, thicknessMm);
  const mesh = new THREE.Mesh(geom, HOLE_MAT);
  mesh.quaternion.setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(basis.uHat, basis.vHat, basis.nHat)
  );
  mesh.position.copy(centerWorld);
  scene.add(mesh);
  meshes.push(mesh);
}

function addHoleMeshesBent(
  scene: THREE.Scene,
  /** Logical profile vertices (same as 2D editor) — NOT the filleted high-res polyline. */
  profilePts: Point2[],
  segmentFaceHoles: BendSegmentHole[][],
  plateWidthMm: number,
  thicknessMm: number
): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  const hpw = Math.max((plateWidthMm * SCALE) / 2, 0.00005);
  const nSeg = Math.max(0, profilePts.length - 1);

  for (let s = 0; s < nSeg; s++) {
    const row = segmentFaceHoles[s] ?? [];
    if (!row.length) continue;
    const Pa = new THREE.Vector3(
      profilePts[s]!.x * SCALE,
      profilePts[s]!.y * SCALE,
      0
    );
    const Pb = new THREE.Vector3(
      profilePts[s + 1]!.x * SCALE,
      profilePts[s + 1]!.y * SCALE,
      0
    );
    const basis = bentFaceBasis(Pa, Pb);
    if (!basis) continue;
    /** Segment length in world (meters) and mm — for hole placement along T. */
    const Llen = Pa.distanceTo(Pb);
    const Lmm = Llen / SCALE;
    const layout = computeSegmentFaceSvgModel(Lmm, plateWidthMm, `${s}`);
    if (layout.kind !== "ok") continue;
    const Wmm = segmentFaceEffectiveWidthMm(
      layout.plateWidthMm,
      layout.segmentLenMm,
      layout.plateWidthDrawMm
    );

    for (const h of row) {
      const vAlong = (h.vMm / Lmm) * Llen;
      const uAcross = (h.uMm / Wmm - 0.5) * (2 * hpw);
      const center = Pa.clone()
        .add(basis.vHat.clone().multiplyScalar(vAlong))
        .add(basis.uHat.clone().multiplyScalar(uAcross));
      spawnHoleMesh(scene, h, thicknessMm, basis, center, meshes);
    }
  }
  return meshes;
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

function addHoleMeshesFlatPlate(
  scene: THREE.Scene,
  segmentFaceHoles: BendSegmentHole[][],
  lengthMm: number,
  widthMm: number,
  bw: number,
  bh: number,
  cx: number,
  cy: number,
  td: number
): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  const L = Math.max(lengthMm, 1e-6);
  const W = Math.max(widthMm, 1e-6);
  const thicknessMm = td / SCALE;

  const row = segmentFaceHoles[0];
  if (!row?.length) return meshes;

  const basis = flatPlateTopSurfaceBasis();
  for (const h of row) {
    const p = plateSegmentHoleCenterOnRectangleBlank(0, h.uMm, h.vMm, L, W);
    const wx = cx + (p.x / L - 0.5) * bw;
    const wy = cy + (p.y / W - 0.5) * bh;
    /** Mid-plane of the slab in world Z so the centered extrusion punches through both faces. */
    const wz = td / 2;
    spawnHoleMesh(scene, h, thicknessMm, basis, new THREE.Vector3(wx, wy, wz), meshes);
  }
  return meshes;
}

function addPreviewEdgeOverlay(
  scene: THREE.Scene,
  geom: THREE.BufferGeometry,
  thresholdDeg: number
): THREE.LineSegments {
  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(geom, thresholdDeg),
    new THREE.LineBasicMaterial({
      color: 0x9ec4b0,
      transparent: true,
      opacity: 0.4,
    })
  );
  scene.add(edge);
  return edge;
}

const MM_EPS = 1e-4;

function distSq2D(a: Point2, b: Point2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * Replaces sharp polyline corners with tangent arcs (centerline = neutral axis: Ri + t/2).
 * Short legs clamp the arc so the preview never inverts.
 */
function filletCenterlinePolyline(
  pts: Point2[],
  insideRadiusMm: number,
  thicknessMm: number
): Point2[] {
  if (pts.length < 3) return pts.map((p) => ({ ...p }));

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

  for (let i = 1; i <= pts.length - 2; i++) {
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

    const arcDeg = (Math.abs(sweep) * 180) / Math.PI;
    const nSteps = Math.max(10, Math.ceil(arcDeg / 5));
    for (let s = 1; s < nSteps; s++) {
      const u = s / nSteps;
      const ang = a1 + sweep * u;
      pushDistinct({
        x: O.x + rEff * Math.cos(ang),
        y: O.y + rEff * Math.sin(ang),
      });
    }
    pushDistinct(P2);
  }

  pushDistinct(pts[pts.length - 1]);
  return out;
}

/**
 * One rectangular prism per straight segment: local X = in-plane thickness, Y = plate width (Z
 * world), Z = along path. Keeps every face truly planar (no twisted quads between bent rings —
 * those split into triangles with different normals and show diagonal “polylines” in EdgesGeometry).
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

    const box = new THREE.BoxGeometry(hx * 2, hy * 2, L);
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
  merged.computeVertexNormals();
  return merged;
}

export function ProfilePreview3D({
  pts,
  plateWidthMm,
  thicknessMm = 2,
  insideRadiusMm: insideRadiusMmProp,
  flatPlate = false,
  className,
  fill,
  segmentFaceHoles,
  flatPlateBlankMm = null,
}: ProfilePreview3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  /** Deep signature so the WebGL effect re-runs even if callers mutate nested hole arrays in place. */
  const segmentFaceHolesKey = JSON.stringify(segmentFaceHoles ?? []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || pts.length < 2) return;

    const w = el.clientWidth || 320;
    const h = el.clientHeight || 220;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f1419);

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

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.update();

    const lights = addPreviewLighting(scene);

    let pathPtsForHoles: Point2[] = pts;
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
      pathPtsForHoles = filletCenterlinePolyline(pts, ri, thicknessMm);
      geom = buildBentProfilePrismGeometry(pathPtsForHoles, ht, hpw);
    }

    geom.computeBoundingBox();
    const bb = geom.boundingBox;
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
      /** Tight near/far around the part improves depth resolution for very thin thickness. */
      camera.near = Math.max(ext * 1e-4, 1e-6);
      camera.far = Math.max(ext * 80, 1);
      camera.updateProjectionMatrix();
      camera.position.set(mtx + ext * 0.55, mty + ext * 0.42, mtz + ext * 0.92);
      controls.target.set(mtx, mty, mtz);
      camera.lookAt(mtx, mty, mtz);
    }
    controls.update();

    const mat = flatPlate ? createPreviewSlabMaterial() : createPreviewStripMaterial();
    const mesh = new THREE.Mesh(geom, mat);
    scene.add(mesh);

    const holeMeshes: THREE.Mesh[] = [];
    const rowsRaw = segmentFaceHoles ?? [];
    const hasAnyHole = rowsRaw.some((row) => row && row.length > 0);
    if (hasAnyHole) {
      if (flatPlate && flatPlateBlankMm) {
        const bw = Math.max((b.maxX - b.minX) * SCALE, 0.001);
        const bh = Math.max((b.maxY - b.minY) * SCALE, 0.001);
        const td = Math.max(thicknessMm * SCALE, 0.001);
        holeMeshes.push(
          ...addHoleMeshesFlatPlate(
            scene,
            rowsRaw,
            flatPlateBlankMm.lengthMm,
            flatPlateBlankMm.widthMm,
            bw,
            bh,
            cx,
            cy,
            td
          )
        );
      } else if (!flatPlate) {
        const segBent = Math.max(0, pts.length - 1);
        const paddedBent = padSegmentFaceHolesToSegmentCount(rowsRaw, segBent);
        holeMeshes.push(
          ...addHoleMeshesBent(
            scene,
            pts,
            paddedBent,
            plateWidthMm,
            thicknessMm
          )
        );
      }
    }

    const edge = addPreviewEdgeOverlay(scene, geom, flatPlate ? 30 : 22);

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
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      geom.dispose();
      mat.dispose();
      for (const hm of holeMeshes) {
        hm.geometry.dispose();
        scene.remove(hm);
      }
      edge.geometry.dispose();
      (edge.material as THREE.Material).dispose();
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
  ]);

  return (
    <div
      ref={containerRef}
      className={cn(
        fill
          ? "h-full min-h-0 w-full rounded-lg bg-[#0f1419]"
          : "min-h-[220px] w-full rounded-lg bg-[#0f1419]",
        className
      )}
    />
  );
}
