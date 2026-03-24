from __future__ import annotations

from app.services.free_space_service import FreeSpaceService
from app.services.placement_service import PlacementDecision, PlacementService
from app.utils.debug_metrics import EngineMetrics


class CavityFillService:
    def __init__(self, placement_service: PlacementService) -> None:
        self.placement_service = placement_service
        self.free_space = FreeSpaceService()

    def fill(
        self,
        placed: list[PlacementDecision],
        unplaced,
        rotations: list[float],
        bin_poly,
        metrics: EngineMetrics,
        run_mode: str,
    ) -> tuple[list[PlacementDecision], list]:
        if not unplaced:
            return placed, []
        # Try small parts first to fill pockets.
        remaining = sorted(unplaced, key=lambda p: p.area_mm2)
        out_placed = placed[:]
        still_unplaced = []
        for part in remaining:
            metrics.cavity_fill_attempts += 1
            cavity_points = self.free_space.cavity_anchor_points(
                [p.footprint_world for p in out_placed],
                bin_poly,
                limit=20 if run_mode == "quick" else 40,
            )
            cand = self.placement_service._best_candidate_for_part(  # intentional internal reuse
                part=part,
                rotations=rotations,
                placed=out_placed,
                bin_poly=bin_poly,
                metrics=metrics,
                candidate_cap=12 if run_mode == "quick" else 20,
                run_mode=run_mode,
                candidate_points=cavity_points,
            )
            if cand is None:
                still_unplaced.append(part)
                continue
            out_placed.append(cand)
            metrics.cavity_fill_successes += 1
        return out_placed, still_unplaced
