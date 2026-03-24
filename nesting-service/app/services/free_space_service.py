from __future__ import annotations

from shapely.geometry import Polygon
from shapely.ops import unary_union


class FreeSpaceService:
    @staticmethod
    def envelope_size(placed: list[Polygon]) -> tuple[float, float]:
        if not placed:
            return 0.0, 0.0
        max_x = max(p.bounds[2] for p in placed)
        max_y = max(p.bounds[3] for p in placed)
        return max_x, max_y

    def cavity_anchor_points(
        self,
        placed: list[Polygon],
        bin_poly: Polygon,
        limit: int = 24,
    ) -> list[tuple[float, float]]:
        if not placed:
            return [(0.0, 0.0)]
        union = unary_union(placed)
        free = bin_poly.difference(union)
        geoms = []
        if free.geom_type == "Polygon":
            geoms = [free]
        elif free.geom_type == "MultiPolygon":
            geoms = list(free.geoms)
        geoms = [g for g in geoms if not g.is_empty and g.area > 1e-6]
        geoms.sort(key=lambda g: g.area, reverse=True)
        anchors: list[tuple[float, float]] = []
        for g in geoms[:limit]:
            min_x, min_y, max_x, max_y = g.bounds
            cx = (min_x + max_x) / 2.0
            cy = (min_y + max_y) / 2.0
            anchors.extend(
                [
                    (min_x, min_y),
                    (min_x, cy),
                    (cx, min_y),
                    (max_x, min_y),
                    (min_x, max_y),
                ]
            )
        out: list[tuple[float, float]] = []
        seen = set()
        for x, y in anchors:
            k = (round(x, 3), round(y, 3))
            if k in seen:
                continue
            seen.add(k)
            out.append((x, y))
        out.sort(key=lambda p: (p[1], p[0]))
        return out[: max(1, limit)]

    def large_gap_penalty(self, placed: list[Polygon], bin_poly: Polygon) -> float:
        if not placed:
            return 0.0
        union = unary_union(placed)
        free = bin_poly.difference(union)
        geoms = []
        if free.geom_type == "Polygon":
            geoms = [free]
        elif free.geom_type == "MultiPolygon":
            geoms = list(free.geoms)
        geoms = [g for g in geoms if not g.is_empty and g.area > 1e-6]
        if not geoms:
            return 0.0
        total = max(1e-9, bin_poly.area)
        penalty = 0.0
        for g in geoms:
            min_x, min_y, max_x, max_y = g.bounds
            w = max(1e-6, max_x - min_x)
            h = max(1e-6, max_y - min_y)
            aspect = max(w / h, h / w)
            # Penalize long channel-like free areas stronger than compact pockets.
            channel_term = max(0.0, aspect - 2.0)
            penalty += (g.area / total) * (1.0 + channel_term)
        return penalty
