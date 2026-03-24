from __future__ import annotations

import math
from dataclasses import dataclass

import pyclipper
from shapely import affinity
from shapely.geometry import Polygon
from shapely.validation import make_valid
from app.utils.transform_utils import transform_polygon


@dataclass(slots=True)
class SimplifyStats:
    original_points: int
    simplified_points: int

    @property
    def ratio(self) -> float:
        if self.original_points <= 0:
            return 1.0
        return self.simplified_points / self.original_points


def _close_ring(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    if not points:
        return points
    if points[0] == points[-1]:
        return points
    return [*points, points[0]]


def to_polygon(
    outer: list[list[float]], holes: list[list[list[float]]] | None = None
) -> Polygon | None:
    holes = holes or []
    outer_ring = _close_ring([(float(x), float(y)) for x, y in outer])
    hole_rings = [_close_ring([(float(x), float(y)) for x, y in h]) for h in holes if len(h) >= 3]
    if len(outer_ring) < 4:
        return None
    p = Polygon(outer_ring, hole_rings)
    if p.is_empty:
        return None
    if not p.is_valid:
        p = make_valid(p)
        if p.is_empty:
            return None
        if p.geom_type == "MultiPolygon":
            p = max(p.geoms, key=lambda g: g.area)
        elif p.geom_type != "Polygon":
            return None
    if p.area <= 1e-6:
        return None
    return p


def normalize_to_origin(poly: Polygon) -> tuple[Polygon, float, float]:
    min_x, min_y, _, _ = poly.bounds
    shifted = affinity.translate(poly, xoff=-min_x, yoff=-min_y)
    return shifted, min_x, min_y


def simplify_polygon(poly: Polygon, tolerance_mm: float) -> tuple[Polygon, SimplifyStats]:
    orig = len(poly.exterior.coords) - 1
    if tolerance_mm <= 0:
        return poly, SimplifyStats(original_points=orig, simplified_points=orig)
    simp = poly.simplify(tolerance_mm, preserve_topology=True)
    if simp.is_empty:
        simp = poly
    if simp.geom_type == "MultiPolygon":
        simp = max(simp.geoms, key=lambda g: g.area)
    if simp.geom_type != "Polygon":
        simp = poly
    if not simp.is_valid:
        simp = make_valid(simp)
        if simp.geom_type == "MultiPolygon":
            simp = max(simp.geoms, key=lambda g: g.area)
        if simp.geom_type != "Polygon":
            simp = poly
    simp_pts = max(0, len(simp.exterior.coords) - 1)
    return simp, SimplifyStats(original_points=orig, simplified_points=simp_pts)


_PC_SCALE = 1000.0


def offset_polygon(poly: Polygon, outward_mm: float) -> Polygon | None:
    if outward_mm <= 0:
        return poly
    ext = [(int(round(x * _PC_SCALE)), int(round(y * _PC_SCALE))) for x, y in poly.exterior.coords[:-1]]
    pco = pyclipper.PyclipperOffset(miter_limit=2.0, arc_tolerance=0.1 * _PC_SCALE)
    pco.AddPath(ext, pyclipper.JT_MITER, pyclipper.ET_CLOSEDPOLYGON)
    result = pco.Execute(outward_mm * _PC_SCALE)
    if not result:
        return None
    rings = [[(x / _PC_SCALE, y / _PC_SCALE) for x, y in ring] for ring in result]
    polys = [Polygon(_close_ring(r)) for r in rings if len(r) >= 3]
    polys = [p for p in polys if p.is_valid and not p.is_empty and p.area > 0]
    if not polys:
        return None
    return max(polys, key=lambda p: p.area)


def rotate_translate(poly: Polygon, rotation_deg: float, tx: float, ty: float) -> Polygon:
    return transform_polygon(poly, rotation_deg, tx, ty)


def polygon_to_points(poly: Polygon) -> list[list[float]]:
    pts = list(poly.exterior.coords)[:-1]
    return [[round(x, 4), round(y, 4)] for x, y in pts]


def holes_to_points(poly: Polygon) -> list[list[list[float]]]:
    out: list[list[list[float]]] = []
    for r in poly.interiors:
        pts = list(r.coords)[:-1]
        out.append([[round(x, 4), round(y, 4)] for x, y in pts])
    return out


def safe_rotation_set(allow_rotation: bool, mode: str, run_mode: str) -> list[int]:
    if not allow_rotation or mode == "none":
        return [0]
    if mode == "ninetyOnly":
        return [0, 90, 180, 270]
    if run_mode == "quick":
        return [0, 90]
    # Free mode in optimize: bounded 15-degree search, still finite.
    return [i * 15 for i in range(24)]


def bounds_area(poly: Polygon) -> float:
    min_x, min_y, max_x, max_y = poly.bounds
    return max(0.0, (max_x - min_x) * (max_y - min_y))


def contact_length(a: Polygon, b: Polygon) -> float:
    inter = a.boundary.intersection(b.boundary)
    if inter.is_empty:
        return 0.0
    return inter.length


def is_nearly_zero(v: float, eps: float = 1e-6) -> bool:
    return math.isclose(v, 0.0, abs_tol=eps)
