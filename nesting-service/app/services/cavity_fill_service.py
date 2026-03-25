from __future__ import annotations

from app.services.free_space_service import FreeSpaceService
from app.services.placement_service import CandidateAnchor, PlacementDecision, PlacementService
from app.utils.debug_metrics import EngineMetrics


class CavityFillService:
    def __init__(self, placement_service: PlacementService) -> None:
        self.placement_service = placement_service
        self.free_space = FreeSpaceService()

    @staticmethod
    def _dedupe_anchors(anchors: list[CandidateAnchor]) -> list[CandidateAnchor]:
        seen: set[tuple[float, float, str]] = set()
        out: list[CandidateAnchor] = []
        for a in anchors:
            k = (round(a.x, 2), round(a.y, 2), a.source)
            if k in seen:
                continue
            seen.add(k)
            out.append(a)
        out.sort(key=lambda p: (p.y, p.x))
        return out

    def _cavity_priority_anchors(
        self,
        placed_polys: list,
        bin_poly,
        run_mode: str,
    ) -> list[CandidateAnchor]:
        """Anchors from ranked free pockets first (corners/edges of void polygons)."""
        lim_r = 12 if run_mode == "quick" else 16
        detailed = self.free_space.cavity_corner_and_edge_anchors(
            placed_polys, bin_poly, limit_regions=lim_r, per_region=9
        )
        return [
            CandidateAnchor(x, y, f"cavity:{tag}")
            for x, y, tag, rank in detailed
            if rank < (8 if run_mode == "quick" else 14)
        ]

    def fill(
        self,
        placed: list[PlacementDecision],
        unplaced,
        rotations: list[float],
        bin_poly,
        metrics: EngineMetrics,
        run_mode: str,
        same_part_gap_mm: float = 0.0,
    ) -> tuple[list[PlacementDecision], list]:
        """
        Second-phase nest: ranked cavity anchors merged with global anchors; smallest parts first.
        Each part tries cavity-heavy anchor list first (implicit via merged ordering).
        """
        if not unplaced:
            return placed, []
        cap = 100 if run_mode == "quick" else 220
        # Smaller parts first — fit into pockets before burning envelope.
        remaining = sorted(unplaced, key=lambda p: p.area_mm2)
        # Cap how many unplaced instances we try (each try is expensive); remainder stay unplaced.
        max_try = 100 if run_mode == "quick" else 120
        remaining = remaining[:max_try]
        out_placed = placed[:]
        still_unplaced: list = []

        for part in remaining:
            metrics.cavity_fill_attempts += 1
            placed_polys = [p.footprint_world for p in out_placed]

            cav = self._cavity_priority_anchors(placed_polys, bin_poly, run_mode)
            full = self.placement_service._candidate_anchors(
                placed_polys, bin_poly, run_mode, cap
            )
            merged = self._dedupe_anchors(cav + full)[:cap]

            cand = self.placement_service._best_candidate_for_part(
                part=part,
                rotations=rotations,
                placed=out_placed,
                bin_poly=bin_poly,
                metrics=metrics,
                candidate_cap=cap,
                run_mode=run_mode,
                same_part_gap_mm=same_part_gap_mm,
                precomputed_anchors=merged,
            )
            if cand is None:
                still_unplaced.append(part)
                continue
            out_placed.append(cand)
            metrics.cavity_fill_successes += 1

        return out_placed, still_unplaced
