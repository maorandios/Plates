"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { cn } from "@/lib/utils";
import type { Point2 } from "./geometry";
import { boundsOfPolyline } from "./geometry";

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
 * Edge overlay: `thresholdDeg` — higher on rounded slab hides tessellation;
 * lower on sharp extruded strips draws bend / thickness edges clearly.
 */
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
}: ProfilePreview3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || pts.length < 2) return;

    const w = el.clientWidth || 320;
    const h = el.clientHeight || 220;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f1419);

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 100);
    const b = boundsOfPolyline(pts);
    const cx = ((b.minX + b.maxX) / 2) * SCALE;
    const cy = ((b.minY + b.maxY) / 2) * SCALE;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
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
      const pathPts = filletCenterlinePolyline(pts, ri, thicknessMm);
      geom = buildBentProfilePrismGeometry(pathPts, ht, hpw);
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
      camera.position.set(mtx + ext * 0.55, mty + ext * 0.42, mtz + ext * 0.92);
      controls.target.set(mtx, mty, mtz);
      camera.lookAt(mtx, mty, mtz);
    }
    controls.update();

    const mat = flatPlate ? createPreviewSlabMaterial() : createPreviewStripMaterial();
    const mesh = new THREE.Mesh(geom, mat);
    scene.add(mesh);

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
      edge.geometry.dispose();
      (edge.material as THREE.Material).dispose();
      disposeLights(lights);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [pts, plateWidthMm, thicknessMm, insideRadiusMmProp, flatPlate]);

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
