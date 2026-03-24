from __future__ import annotations

from shapely.prepared import prep

from app.services.placement_service import PlacementDecision
from app.services.validation_service import ValidationService
from app.utils.debug_metrics import EngineMetrics
from app.utils.polygon_utils import rotate_translate


class CompactionService:
    def __init__(self) -> None:
        self.validator = ValidationService()

    def compact(
        self,
        placements: list[PlacementDecision],
        bin_poly,
        metrics: EngineMetrics,
        passes: int = 2,
        step_mm: float = 1.0,
    ) -> None:
        if not placements:
            return
        bin_prepared = prep(bin_poly)
        for _ in range(passes):
            changed = False
            for i, pl in enumerate(placements):
                # push left
                while True:
                    nx = pl.x - step_mm
                    nworld = rotate_translate(
                        pl.part_instance.footprint_polygon_local, pl.rotation_deg, nx, pl.y
                    )
                    metrics.compaction_moves_attempted += 1
                    v = self.validator.validate_polygon(nworld)
                    if not v.ok:
                        metrics.compaction_moves_rejected += 1
                        break
                    if not bin_prepared.covers(nworld):
                        metrics.compaction_moves_rejected += 1
                        break
                    blocked = False
                    for j, other in enumerate(placements):
                        if i == j:
                            continue
                        ov = nworld.intersection(other.footprint_world).area
                        if ov > 1e-4:
                            blocked = True
                            break
                    if blocked:
                        metrics.compaction_moves_rejected += 1
                        break
                    pl.x = nx
                    pl.footprint_world = nworld
                    metrics.compaction_moves += 1
                    changed = True
                # push down
                while True:
                    ny = pl.y - step_mm
                    nworld = rotate_translate(
                        pl.part_instance.footprint_polygon_local, pl.rotation_deg, pl.x, ny
                    )
                    metrics.compaction_moves_attempted += 1
                    v = self.validator.validate_polygon(nworld)
                    if not v.ok:
                        metrics.compaction_moves_rejected += 1
                        break
                    if not bin_prepared.covers(nworld):
                        metrics.compaction_moves_rejected += 1
                        break
                    blocked = False
                    for j, other in enumerate(placements):
                        if i == j:
                            continue
                        ov = nworld.intersection(other.footprint_world).area
                        if ov > 1e-4:
                            blocked = True
                            break
                    if blocked:
                        metrics.compaction_moves_rejected += 1
                        break
                    pl.y = ny
                    pl.footprint_world = nworld
                    metrics.compaction_moves += 1
                    changed = True
            if not changed:
                break
