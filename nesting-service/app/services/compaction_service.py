from __future__ import annotations

from shapely.prepared import prep

from app.services.placement_service import PlacementDecision
from app.services.validation_service import ValidationService
from app.utils.debug_metrics import EngineMetrics
from app.utils.polygon_utils import rotate_translate


def _aabb_overlap(
    a: tuple[float, float, float, float], b: tuple[float, float, float, float]
) -> bool:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    return not (ax2 < bx1 or bx2 < ax1 or ay2 < by1 or by2 < ay1)


class CompactionService:
    def __init__(self) -> None:
        self.validator = ValidationService()

    def _blocked(
        self,
        i: int,
        footprint_world,
        material_world,
        part_id: str,
        placements: list[PlacementDecision],
        same_part_gap_mm: float,
    ) -> bool:
        fb = footprint_world.bounds
        mb = material_world.bounds
        for j, other in enumerate(placements):
            if i == j:
                continue
            if other.part_instance.part_id == part_id:
                if not _aabb_overlap(mb, other.material_world.bounds):
                    continue
                if not self.validator.same_part_material_clear(
                    material_world, other.material_world, same_part_gap_mm
                ):
                    return True
            else:
                if not _aabb_overlap(fb, other.footprint_world.bounds):
                    continue
                if footprint_world.intersection(other.footprint_world).area > 1e-4:
                    return True
        return False

    def _pose_valid(
        self,
        pl: PlacementDecision,
        nx: float,
        ny: float,
        i: int,
        placements: list[PlacementDecision],
        bin_prepared,
        same_part_gap_mm: float,
    ) -> bool:
        nworld = rotate_translate(
            pl.part_instance.footprint_polygon_local, pl.rotation_deg, nx, ny
        )
        metrics_probe = self.validator.validate_polygon(nworld)
        if not metrics_probe.ok:
            return False
        if not bin_prepared.covers(nworld):
            return False
        nm = rotate_translate(
            pl.part_instance.original_polygon_local,
            pl.rotation_deg,
            nx,
            ny,
        )
        return not self._blocked(i, nworld, nm, pl.part_instance.part_id, placements, same_part_gap_mm)

    def _max_slide_left(
        self,
        pl: PlacementDecision,
        i: int,
        placements: list[PlacementDecision],
        bin_prepared,
        same_part_gap_mm: float,
        metrics: EngineMetrics,
        binary_steps: int = 20,
    ) -> float:
        """Maximum delta>=0 such that (pl.x - delta, pl.y) is valid (direct contact to left/boundary)."""
        hi = pl.x
        if hi <= 1e-9:
            return 0.0
        lo = 0.0
        for _ in range(binary_steps):
            metrics.compaction_moves_attempted += 1
            mid = (lo + hi) / 2.0
            nx = pl.x - mid
            if self._pose_valid(pl, nx, pl.y, i, placements, bin_prepared, same_part_gap_mm):
                lo = mid
            else:
                hi = mid
        return lo if lo > 1e-4 else 0.0

    def _max_slide_down(
        self,
        pl: PlacementDecision,
        i: int,
        placements: list[PlacementDecision],
        bin_prepared,
        same_part_gap_mm: float,
        metrics: EngineMetrics,
        binary_steps: int = 20,
    ) -> float:
        hi = pl.y
        if hi <= 1e-9:
            return 0.0
        lo = 0.0
        for _ in range(binary_steps):
            metrics.compaction_moves_attempted += 1
            mid = (lo + hi) / 2.0
            ny = pl.y - mid
            if self._pose_valid(pl, pl.x, ny, i, placements, bin_prepared, same_part_gap_mm):
                lo = mid
            else:
                hi = mid
        return lo if lo > 1e-4 else 0.0

    def _apply_pose(
        self,
        pl: PlacementDecision,
        nx: float,
        ny: float,
    ) -> None:
        pl.x = nx
        pl.y = ny
        pl.footprint_world = rotate_translate(
            pl.part_instance.footprint_polygon_local, pl.rotation_deg, nx, ny
        )
        pl.material_world = rotate_translate(
            pl.part_instance.original_polygon_local, pl.rotation_deg, nx, ny
        )

    def compact(
        self,
        placements: list[PlacementDecision],
        bin_poly,
        metrics: EngineMetrics,
        same_part_gap_mm: float = 0.0,
        passes: int = 2,
        step_mm: float = 1.0,
    ) -> None:
        """Direct-contact compaction: binary search for max left/down slide per part; repeat until stable."""
        if not placements:
            return
        bin_prepared = prep(bin_poly)
        _ = step_mm  # legacy param, unused
        for _ in range(passes):
            changed = False
            for i, pl in enumerate(placements):
                dl = self._max_slide_left(
                    pl, i, placements, bin_prepared, same_part_gap_mm, metrics
                )
                if dl > 1e-4:
                    self._apply_pose(pl, pl.x - dl, pl.y)
                    metrics.compaction_moves += 1
                    changed = True
                dd = self._max_slide_down(
                    pl, i, placements, bin_prepared, same_part_gap_mm, metrics
                )
                if dd > 1e-4:
                    self._apply_pose(pl, pl.x, pl.y - dd)
                    metrics.compaction_moves += 1
                    changed = True
            if not changed:
                break
