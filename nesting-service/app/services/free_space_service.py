from __future__ import annotations

from dataclasses import dataclass

from shapely.geometry import Polygon
from shapely.ops import unary_union


@dataclass(slots=True)
class RankedCavity:
    """Free-space pocket on the sheet, ordered by usefulness for small-part insertion."""
    polygon: Polygon
    usefulness: float
    rank: int


class FreeSpaceService:
    @staticmethod
    def envelope_size(placed: list[Polygon]) -> tuple[float, float]:
        if not placed:
            return 0.0, 0.0
        max_x = max(p.bounds[2] for p in placed)
        max_y = max(p.bounds[3] for p in placed)
        return max_x, max_y

    def free_polygons(self, placed: list[Polygon], bin_poly: Polygon) -> list[Polygon]:
        if not placed:
            return [bin_poly]
        union = unary_union(placed)
        free = bin_poly.difference(union)
        geoms: list[Polygon] = []
        if free.geom_type == "Polygon":
            geoms = [free]
        elif free.geom_type == "MultiPolygon":
            geoms = list(free.geoms)
        return [g for g in geoms if not g.is_empty and g.area > 1e-6]

    def ranked_cavities(
        self,
        placed: list[Polygon],
        bin_poly: Polygon,
        limit: int = 32,
    ) -> list[RankedCavity]:
        """Rank pockets: prefer larger usable area and less elongated (channel-like) voids."""
        geoms = self.free_polygons(placed, bin_poly)
        scored: list[tuple[float, Polygon]] = []
        for g in geoms:
            min_x, min_y, max_x, max_y = g.bounds
            w = max(1e-6, max_x - min_x)
            h = max(1e-6, max_y - min_y)
            aspect = max(w / h, h / w)
            # Compact pockets score higher; huge aspect (channels) lower.
            compactness = 1.0 / (1.0 + max(0.0, aspect - 1.5))
            usefulness = g.area * (0.35 + 0.65 * compactness)
            scored.append((usefulness, g))
        scored.sort(key=lambda t: t[0], reverse=True)
        out: list[RankedCavity] = []
        for i, (u, poly) in enumerate(scored[:limit]):
            out.append(RankedCavity(polygon=poly, usefulness=u, rank=i))
        return out

    def cavity_corner_and_edge_anchors(
        self,
        placed: list[Polygon],
        bin_poly: Polygon,
        limit_regions: int = 24,
        per_region: int = 8,
    ) -> list[tuple[float, float, str, int]]:
        """
        Anchors inside/near free pockets: corners, edge midpoints, centroid.
        Returns (x, y, source_tag, cavity_rank).
        """
        ranked = self.ranked_cavities(placed, bin_poly, limit=limit_regions)
        out: list[tuple[float, float, str, int]] = []
        for rc in ranked:
            g = rc.polygon
            min_x, min_y, max_x, max_y = g.bounds
            cx = (min_x + max_x) / 2.0
            cy = (min_y + max_y) / 2.0
            mx_x = (min_x + max_x) / 2.0
            my_y = (min_y + max_y) / 2.0
            pts = [
                (min_x, min_y, "cavity_bl", rc.rank),
                (min_x, max_y, "cavity_tl", rc.rank),
                (max_x, min_y, "cavity_br", rc.rank),
                (max_x, max_y, "cavity_tr", rc.rank),
                (cx, min_y, "cavity_bc", rc.rank),
                (cx, max_y, "cavity_tc", rc.rank),
                (min_x, cy, "cavity_ml", rc.rank),
                (max_x, cy, "cavity_mr", rc.rank),
                (cx, cy, "cavity_cc", rc.rank),
            ]
            # Subsample if per_region is small
            for item in pts[:per_region]:
                out.append(item)
        return out

    def cavity_anchor_points(
        self,
        placed: list[Polygon],
        bin_poly: Polygon,
        limit: int = 24,
    ) -> list[tuple[float, float]]:
        """Legacy: flat list of (x,y) from ranked cavities (corners)."""
        detailed = self.cavity_corner_and_edge_anchors(
            placed, bin_poly, limit_regions=min(limit, 32), per_region=6
        )
        flat: list[tuple[float, float]] = []
        seen: set[tuple[float, float]] = set()
        for x, y, _, _ in detailed:
            k = (round(x, 3), round(y, 3))
            if k in seen:
                continue
            seen.add(k)
            flat.append((x, y))
        flat.sort(key=lambda p: (p[1], p[0]))
        return flat[: max(1, limit)]

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

    def estimated_waste_ratio(self, placed: list[Polygon], bin_poly: Polygon) -> float:
        if not placed:
            return 1.0
        used = sum(p.area for p in placed)
        return max(0.0, (bin_poly.area - used) / max(1e-9, bin_poly.area))

    def fragmented_space_penalty(self, placed: list[Polygon], bin_poly: Polygon) -> float:
        """Penalize many disjoint voids (patchy / row-like scrap). Higher = worse layout."""
        geoms = self.free_polygons(placed, bin_poly)
        if not geoms:
            return 0.0
        total = max(1e-9, bin_poly.area)
        n = len(geoms)
        frag_weight = 1.0 + min(2.5, (n - 1) * 0.15)
        return sum((g.area / total) * frag_weight for g in geoms)
