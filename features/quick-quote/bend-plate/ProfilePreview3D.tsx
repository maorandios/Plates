"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { cn } from "@/lib/utils";
import type { Point2 } from "./geometry";
import { boundsOfPolyline } from "./geometry";

interface ProfilePreview3DProps {
  pts: Point2[];
  plateWidthMm: number;
  /** Side-view thickness used to build a thin strip (not closed as a filled polygon). */
  thicknessMm?: number;
  className?: string;
  /** Stretch to parent height (e.g. split-pane editor). */
  fill?: boolean;
}

const SCALE = 0.001;

/** Left-of-walk direction for segment (dx, dy), normalized. */
function leftNormal(dx: number, dy: number): { x: number; y: number } {
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

/**
 * Closed 2D strip around an open polyline so ExtrudeGeometry caps follow the path
 * instead of triangulating a bogus fill (last→first edge).
 */
function stripShapeFromPolyline(pts: Point2[], halfWidthMm: number): THREE.Shape {
  const shape = new THREE.Shape();
  const n = pts.length;
  if (n < 2 || halfWidthMm <= 0) return shape;

  const hw = halfWidthMm * SCALE;
  const leftEdge: { x: number; y: number }[] = [];
  const rightEdge: { x: number; y: number }[] = [];

  for (let i = 0; i < n; i++) {
    let nx: number;
    let ny: number;
    if (i === 0) {
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      const ln = leftNormal(dx, dy);
      nx = ln.x;
      ny = ln.y;
    } else if (i === n - 1) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      const ln = leftNormal(dx, dy);
      nx = ln.x;
      ny = ln.y;
    } else {
      const dx1 = pts[i].x - pts[i - 1].x;
      const dy1 = pts[i].y - pts[i - 1].y;
      const dx2 = pts[i + 1].x - pts[i].x;
      const dy2 = pts[i + 1].y - pts[i].y;
      const n1 = leftNormal(dx1, dy1);
      const n2 = leftNormal(dx2, dy2);
      nx = n1.x + n2.x;
      ny = n1.y + n2.y;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
    }
    leftEdge.push({
      x: pts[i].x * SCALE + nx * hw,
      y: pts[i].y * SCALE + ny * hw,
    });
    rightEdge.push({
      x: pts[i].x * SCALE - nx * hw,
      y: pts[i].y * SCALE - ny * hw,
    });
  }

  shape.moveTo(leftEdge[0].x, leftEdge[0].y);
  for (let i = 1; i < n; i++) shape.lineTo(leftEdge[i].x, leftEdge[i].y);
  for (let i = n - 1; i >= 0; i--) shape.lineTo(rightEdge[i].x, rightEdge[i].y);
  shape.closePath();
  return shape;
}

export function ProfilePreview3D({
  pts,
  plateWidthMm,
  thicknessMm = 2,
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
    const depth = Math.max(plateWidthMm * SCALE, 0.001);
    const span =
      Math.max(b.maxX - b.minX, b.maxY - b.minY, plateWidthMm, 1) * SCALE * 1.8;
    const targetZ = depth / 2;
    camera.position.set(cx + span * 0.7, cy + span * 0.5, span * 1.2);
    camera.lookAt(cx, cy, targetZ);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.innerHTML = "";
    el.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(cx, cy, targetZ);
    controls.enableDamping = false;
    controls.update();

    const amb = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(2, 4, 3);
    scene.add(dir);

    const halfW = Math.max(thicknessMm / 2, 0.05);
    const shape = stripShapeFromPolyline(pts, halfW);

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: false,
      steps: 1,
    });
    geom.translate(0, 0, 0);

    const mat = new THREE.MeshStandardMaterial({
      color: 0x5a9e7a,
      metalness: 0.35,
      roughness: 0.55,
      flatShading: false,
    });
    const mesh = new THREE.Mesh(geom, mat);
    scene.add(mesh);

    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(geom, 18),
      new THREE.LineBasicMaterial({ color: 0x8ab89a })
    );
    scene.add(edge);

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
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
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [pts, plateWidthMm, thicknessMm]);

  return (
    <div
      ref={containerRef}
      className={cn(
        fill
          ? "h-full min-h-0 w-full rounded-lg border border-border bg-[#0f1419]"
          : "min-h-[220px] w-full rounded-lg border border-border bg-[#0f1419]",
        className
      )}
    />
  );
}
