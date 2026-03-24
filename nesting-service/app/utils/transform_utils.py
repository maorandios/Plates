from __future__ import annotations

from shapely import affinity
from shapely.geometry import Polygon


def rotate_polygon(poly: Polygon, rotation_deg: float) -> Polygon:
    return affinity.rotate(poly, rotation_deg, origin=(0, 0), use_radians=False)


def translate_polygon(poly: Polygon, x: float, y: float) -> Polygon:
    return affinity.translate(poly, xoff=x, yoff=y)


def transform_polygon(poly: Polygon, rotation_deg: float, x: float, y: float) -> Polygon:
    return translate_polygon(rotate_polygon(poly, rotation_deg), x, y)


def polygon_bounds(poly: Polygon) -> tuple[float, float, float, float]:
    min_x, min_y, max_x, max_y = poly.bounds
    return min_x, min_y, max_x, max_y


def overlap_area(a: Polygon, b: Polygon) -> float:
    inter = a.intersection(b)
    if inter.is_empty:
        return 0.0
    return float(inter.area)
