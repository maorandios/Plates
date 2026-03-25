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
    # Non-bbox signals
    horizontal_band: float
    vertical_band: float
    right_top_slack_penalty: float
    fragment_void_ratio: float
    early_height_penalty: float


@dataclass(slots=True)
class ScoreBreakdown:
    """Lower total is better for placement; all fields are comparable contributions."""
    position_yx: float
    envelope_growth: float
    contact_score: float
    cavity_fit_score: float
    channel_penalty: float
    edge_waste_penalty: float
    fragmentation_penalty: float
    early_height_penalty: float
    total: float


class ScoringService:
    def __init__(self) -> None:
        self.free_space = FreeSpaceService()

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
        cavity_bonus = max(0.0, 1.0 - (delta_w + delta_h) / max(1.0, max_x + max_y))
        channel_penalty = max(0.0, abs(delta_h - delta_w) / max(1.0, delta_h + delta_w))
        # Long horizontal strip of new void (row packing) vs vertical channel
        bin_w = bin_poly.bounds[2]
        bin_h = bin_poly.bounds[3]
        horizontal_band = max(0.0, delta_w - delta_h * 0.35) / max(1.0, bin_w)
        vertical_band = max(0.0, delta_h - delta_w * 0.35) / max(1.0, bin_h)
        # Penalize growing envelope toward top-right when slack remains on left/bottom
        right_slack = max(0.0, bin_w - max_x)
        top_slack = max(0.0, bin_h - max_y)
        right_top_slack_penalty = (right_slack / max(1.0, bin_w)) * 0.55 + (top_slack / max(1.0, bin_h)) * 0.45
        # Fragmentation: bbox void vs sum of "tight" estimate — high means patchy layout
        tight_void = max(0.0, void - 0.15 * envelope_area)
        fragment_void_ratio = tight_void / max(1.0, envelope_area)
        # Mild preference to extend the bottom row in X before stacking — keep loose so
        # filling the sheet (second row / pockets) is not blocked when width use is low.
        early_height_penalty = 0.0
        if placed and delta_h > 1e-6:
            cover_x = prev_x / max(1e-6, bin_w)
            if cover_x < 0.22 and delta_h >= delta_w * 0.55:
                early_height_penalty = delta_h / max(1e-6, bin_h)
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
            horizontal_band=horizontal_band,
            vertical_band=vertical_band,
            right_top_slack_penalty=right_top_slack_penalty,
            fragment_void_ratio=fragment_void_ratio,
            early_height_penalty=early_height_penalty,
        )

    def score_candidate_with_breakdown(
        self, f: CandidateFeatures, run_mode: str
    ) -> tuple[float, ScoreBreakdown]:
        """Lower total is better. Not first-fit — used only to compare enumerated candidates."""
        if run_mode == "quick":
            # Lower wy vs wx: allow upward placement to compete with endless bottom strip.
            wy, wx = 920.0, 220.0
            wg, hg = 100.0, 1120.0
            ck = 0.36
            cv = 102.0
            ch_base = 300.0
            hb, vb = 480.0, 480.0
            rtp = 200.0
            frag = 240.0
            eh = 260.0
        else:
            wy, wx = 1280.0, 280.0
            wg, hg = 115.0, 1320.0
            ck = 0.4
            cv = 120.0
            ch_base = 360.0
            hb, vb = 560.0, 560.0
            rtp = 240.0
            frag = 300.0
            eh = 380.0

        position_yx = f.anchor_y * wy + f.anchor_x * wx
        envelope_growth = f.delta_width * wg + f.delta_height * hg + f.void_area * 0.0045
        contact = -(f.wall_contact + f.part_contact) * ck
        cavity_fit = -f.cavity_bonus * cv
        channel = (
            f.channel_penalty * ch_base
            + f.horizontal_band * hb
            + f.vertical_band * vb
        )
        edge_waste = f.right_top_slack_penalty * rtp
        fragmentation = f.fragment_void_ratio * frag
        early_h = f.early_height_penalty * eh

        total = (
            position_yx
            + envelope_growth
            + contact
            + cavity_fit
            + channel
            + edge_waste
            + fragmentation
            + early_h
        )
        breakdown = ScoreBreakdown(
            position_yx=position_yx,
            envelope_growth=envelope_growth,
            contact_score=contact,
            cavity_fit_score=cavity_fit,
            channel_penalty=channel,
            edge_waste_penalty=edge_waste,
            fragmentation_penalty=fragmentation,
            early_height_penalty=early_h,
            total=total,
        )
        return total, breakdown

    def score_candidate(self, f: CandidateFeatures, run_mode: str) -> float:
        t, _ = self.score_candidate_with_breakdown(f, run_mode)
        return t

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
        """Higher is better — full-run score: util, waste, envelope, gaps, fragmentation, unplaced."""
        if not placed:
            return -1e9
        util = self.pack_fitness(placed, bin_poly)
        compact = self.compactness_score(placed)
        gap_penalty = self.free_space.large_gap_penalty(placed, bin_poly)
        waste_ratio = self.free_space.estimated_waste_ratio(placed, bin_poly)
        frag_penalty = self.free_space.fragmented_space_penalty(placed, bin_poly)
        env_w, env_h = self.free_space.envelope_size(placed)
        bin_w, bin_h = bin_poly.bounds[2], bin_poly.bounds[3]
        env_area_ratio = (env_w * env_h) / max(1e-9, bin_w * bin_h)
        return (
            util * 1100.0
            + compact * 280.0
            - gap_penalty * 200.0
            - waste_ratio * 350.0
            - frag_penalty * 140.0
            - env_area_ratio * 200.0
            - unplaced_count * 185.0
        )
