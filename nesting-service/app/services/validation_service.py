from __future__ import annotations

from dataclasses import dataclass

from shapely.geometry import Polygon
from shapely.prepared import prep

from app.utils.transform_utils import overlap_area

OVERLAP_EPS_MM2 = 1e-4


@dataclass(slots=True)
class ValidationResult:
    ok: bool
    reason: str | None = None
    overlap_with_index: int | None = None
    overlap_area_mm2: float = 0.0


@dataclass(slots=True)
class FinalSheetValidation:
    ok: bool
    overlap_pairs: list[tuple[int, int, float]]
    outside_indices: list[int]
    invalid_indices: list[int]


class ValidationService:
    @staticmethod
    def validate_polygon(poly: Polygon) -> ValidationResult:
        if poly.is_empty:
            return ValidationResult(ok=False, reason="invalid_polygon_empty")
        if not poly.is_valid:
            return ValidationResult(ok=False, reason="invalid_polygon")
        if poly.area <= OVERLAP_EPS_MM2:
            return ValidationResult(ok=False, reason="invalid_polygon_area")
        return ValidationResult(ok=True)

    @staticmethod
    def validate_inside_bin(poly: Polygon, bin_prepared) -> ValidationResult:
        if not bin_prepared.covers(poly):
            return ValidationResult(ok=False, reason="outside_bin")
        return ValidationResult(ok=True)

    @staticmethod
    def validate_no_overlap_with_placed(
        poly: Polygon, placed_polys: list[Polygon], placed_prepared: list
    ) -> ValidationResult:
        for i, (base, pprep) in enumerate(zip(placed_polys, placed_prepared)):
            if not pprep.intersects(poly):
                continue
            oa = overlap_area(base, poly)
            if oa > OVERLAP_EPS_MM2:
                return ValidationResult(
                    ok=False,
                    reason="overlap",
                    overlap_with_index=i,
                    overlap_area_mm2=oa,
                )
        return ValidationResult(ok=True)

    def validate_candidate(
        self,
        poly: Polygon,
        bin_prepared,
        placed_polys: list[Polygon],
        placed_prepared: list,
    ) -> ValidationResult:
        v = self.validate_polygon(poly)
        if not v.ok:
            return v
        v = self.validate_inside_bin(poly, bin_prepared)
        if not v.ok:
            return v
        return self.validate_no_overlap_with_placed(poly, placed_polys, placed_prepared)

    def validate_final_sheet(self, placed_polys: list[Polygon], bin_poly: Polygon) -> FinalSheetValidation:
        invalid: list[int] = []
        outside: list[int] = []
        overlaps: list[tuple[int, int, float]] = []
        bin_prepared = prep(bin_poly)
        for i, p in enumerate(placed_polys):
            pv = self.validate_polygon(p)
            if not pv.ok:
                invalid.append(i)
                continue
            if not self.validate_inside_bin(p, bin_prepared).ok:
                outside.append(i)
        for i in range(len(placed_polys)):
            for j in range(i + 1, len(placed_polys)):
                oa = overlap_area(placed_polys[i], placed_polys[j])
                if oa > OVERLAP_EPS_MM2:
                    overlaps.append((i, j, oa))
        return FinalSheetValidation(
            ok=(len(invalid) == 0 and len(outside) == 0 and len(overlaps) == 0),
            overlap_pairs=overlaps,
            outside_indices=outside,
            invalid_indices=invalid,
        )
