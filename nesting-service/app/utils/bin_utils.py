from __future__ import annotations

from shapely.geometry import box


def usable_bin(width_mm: float, height_mm: float, edge_margin_mm: float):
    w = width_mm - edge_margin_mm * 2
    h = height_mm - edge_margin_mm * 2
    if w <= 0 or h <= 0:
        return None
    return box(0, 0, w, h), w, h
