from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha1

from shapely.geometry import Polygon

from app.schemas.nesting import PartIn
from app.utils.polygon_utils import (
    SimplifyStats,
    holes_to_points,
    normalize_to_origin,
    offset_polygon,
    polygon_to_points,
    simplify_polygon,
    to_polygon,
)


@dataclass(slots=True)
class GeometryPrepIssue:
    part_id: str
    reason: str


@dataclass(slots=True)
class PartInstanceGeometry:
    part_instance_id: str
    part_id: str
    part_name: str
    client_id: str
    client_code: str
    marking_text: str
    original_polygon_local: Polygon
    original_outer_local: list[list[float]]
    original_holes_local: list[list[list[float]]]
    footprint_polygon_local: Polygon
    source_polygon_kind: str
    area_mm2: float


@dataclass(slots=True)
class ExpandedGeometrySet:
    instances: list[PartInstanceGeometry]
    issues: list[GeometryPrepIssue]
    simplify_original_points: int
    simplify_simplified_points: int


class GeometryService:
    def __init__(self) -> None:
        self._footprint_cache: dict[str, tuple[Polygon, SimplifyStats]] = {}

    @staticmethod
    def _part_cache_key(part: PartIn, spacing_mm: float, simplify_tolerance_mm: float) -> str:
        raw = f"{part.part_id}|{part.outer_contour}|{part.inner_contours}|{spacing_mm}|{simplify_tolerance_mm}"
        return sha1(raw.encode("utf-8")).hexdigest()

    def _prepare_single_part(
        self, part: PartIn, spacing_mm: float, simplify_tolerance_mm: float
    ) -> tuple[Polygon | None, Polygon | None, SimplifyStats | None, str]:
        original = to_polygon(part.outer_contour, part.inner_contours)
        if original is None:
            return None, None, None, "invalid_polygon"
        normalized, _, _ = normalize_to_origin(original)
        key = self._part_cache_key(part, spacing_mm, simplify_tolerance_mm)
        cached = self._footprint_cache.get(key)
        if cached is not None:
            fp, stats = cached
            return normalized, fp, stats, "polygon"
        simplified, stats = simplify_polygon(normalized, simplify_tolerance_mm)
        outward = max(0.0, spacing_mm) / 2.0
        fp = offset_polygon(simplified, outward)
        if fp is None:
            return normalized, None, stats, "offset_failed"
        self._footprint_cache[key] = (fp, stats)
        return normalized, fp, stats, "polygon"

    def expand_nestable_instances(
        self, parts: list[PartIn], spacing_mm: float, simplify_tolerance_mm: float
    ) -> ExpandedGeometrySet:
        instances: list[PartInstanceGeometry] = []
        issues: list[GeometryPrepIssue] = []
        simplify_orig = 0
        simplify_simp = 0
        for part in parts:
            if part.geometry_status == "error":
                issues.append(
                    GeometryPrepIssue(
                        part_id=part.part_id, reason="Skipped: geometryStatus=error"
                    )
                )
                continue
            original_poly, footprint_poly, stats, mode = self._prepare_single_part(
                part, spacing_mm, simplify_tolerance_mm
            )
            if original_poly is None:
                issues.append(
                    GeometryPrepIssue(part_id=part.part_id, reason="Invalid outer/holes polygon")
                )
                continue
            if stats is not None:
                simplify_orig += stats.original_points
                simplify_simp += stats.simplified_points
            if footprint_poly is None:
                issues.append(
                    GeometryPrepIssue(
                        part_id=part.part_id, reason="Could not build spacing offset footprint"
                    )
                )
                continue
            for i in range(part.quantity):
                iid = f"{part.part_id}__{i + 1}"
                instances.append(
                    PartInstanceGeometry(
                        part_instance_id=iid,
                        part_id=part.part_id,
                        part_name=part.part_name,
                        client_id=part.client_id,
                        client_code=part.client_code,
                        marking_text=part.marking_text,
                        original_polygon_local=original_poly,
                        original_outer_local=polygon_to_points(original_poly),
                        original_holes_local=holes_to_points(original_poly),
                        footprint_polygon_local=footprint_poly,
                        source_polygon_kind=mode,
                        area_mm2=float(original_poly.area),
                    )
                )
        return ExpandedGeometrySet(
            instances=instances,
            issues=issues,
            simplify_original_points=simplify_orig,
            simplify_simplified_points=simplify_simp,
        )
