from __future__ import annotations

from dataclasses import dataclass

from shapely.geometry import Polygon

from app.services.free_space_service import FreeSpaceService
from app.utils.polygon_utils import contact_length


@dataclass(slots=True)
class CandidateFeatures:
    anchor_y: float
    anchor_x: float
    envelope_max_y: float
    envelope_max_x: float
    envelope_area: float
    used_area: float
    wall_contact: float
    part_contact: float
    void_area: float
    delta_height: float
    delta_width: float
    cavity_bonus: float
    channel_penalty: float


class ScoringService:
    def __init__(self) -> None:
        self.free_space = FreeSpaceService()

    def score_candidate(self, f: CandidateFeatures, run_mode: str) -> float:
        # Lower is better.
        if run_mode == "quick":
            return (
                f.anchor_y * 1300.0
                + f.anchor_x * 120.0
                + f.delta_height * 900.0
                + f.delta_width * 110.0
                + f.channel_penalty * 240.0
                + f.void_area * 0.006
                - (f.wall_contact + f.part_contact) * 0.24
                - f.cavity_bonus * 80.0
            )
        return (
            f.anchor_y * 1600.0
            + f.anchor_x * 160.0
            + f.delta_height * 1200.0
            + f.delta_width * 140.0
            + f.channel_penalty * 360.0
            + f.void_area * 0.009
            - (f.wall_contact + f.part_contact) * 0.30
            - f.cavity_bonus * 110.0
        )

    def features_for_candidate(
        self,
        candidate_poly: Polygon,
        placed: list[Polygon],
        bin_poly: Polygon,
        used_area_before: float,
        anchor_x: float,
        anchor_y: float,
    ) -> CandidateFeatures:
        geoms = [*placed, candidate_poly]
        max_x = max(g.bounds[2] for g in geoms) if geoms else 0.0
        max_y = max(g.bounds[3] for g in geoms) if geoms else 0.0
        prev_x = max((g.bounds[2] for g in placed), default=0.0)
        prev_y = max((g.bounds[3] for g in placed), default=0.0)
        delta_w = max(0.0, max_x - prev_x)
        delta_h = max(0.0, max_y - prev_y)
        envelope_area = max_x * max_y
        used = used_area_before + candidate_poly.area
        void = max(0.0, envelope_area - used)
        wall_contact = contact_length(candidate_poly, bin_poly)
        part_contact = 0.0
        for g in placed:
            part_contact += contact_length(candidate_poly, g)
        # "Cavity bonus": if candidate does not increase envelope much, it likely fills pockets.
        cavity_bonus = max(0.0, 1.0 - (delta_w + delta_h) / max(1.0, max_x + max_y))
        # Penalize long channel growth when one axis expands much more than the other.
        channel_penalty = max(0.0, abs(delta_h - delta_w) / max(1.0, delta_h + delta_w))
        return CandidateFeatures(
            anchor_y=anchor_y,
            anchor_x=anchor_x,
            envelope_max_y=max_y,
            envelope_max_x=max_x,
            envelope_area=envelope_area,
            used_area=used,
            wall_contact=wall_contact,
            part_contact=part_contact,
            void_area=void,
            delta_height=delta_h,
            delta_width=delta_w,
            cavity_bonus=cavity_bonus,
            channel_penalty=channel_penalty,
        )

    @staticmethod
    def pack_fitness(placed: list[Polygon], bin_poly: Polygon) -> float:
        if not placed:
            return 0.0
        used = sum(p.area for p in placed)
        return max(0.0, min(1.0, used / bin_poly.area))

    @staticmethod
    def compactness_score(placed: list[Polygon]) -> float:
        if not placed:
            return 0.0
        max_x = max(p.bounds[2] for p in placed)
        max_y = max(p.bounds[3] for p in placed)
        envelope = max_x * max_y
        if envelope <= 1e-9:
            return 0.0
        return min(1.0, sum(p.area for p in placed) / envelope)

    def layout_quality_score(
        self, placed: list[Polygon], bin_poly: Polygon, unplaced_count: int
    ) -> float:
        if not placed:
            return -1e9
        util = self.pack_fitness(placed, bin_poly)
        compact = self.compactness_score(placed)
        gap_penalty = self.free_space.large_gap_penalty(placed, bin_poly)
        # Higher is better.
        return (
            util * 1000.0
            + compact * 260.0
            - gap_penalty * 180.0
            - unplaced_count * 45.0
        )
