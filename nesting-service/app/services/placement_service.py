from __future__ import annotations

import random
from dataclasses import dataclass

from shapely.geometry import Polygon
from shapely.prepared import prep

from app.services.free_space_service import FreeSpaceService
from app.services.geometry_service import PartInstanceGeometry
from app.services.scoring_service import ScoringService
from app.services.validation_service import ValidationService
from app.utils.debug_metrics import EngineMetrics
from app.utils.transform_utils import rotate_polygon, transform_polygon


@dataclass(slots=True)
class PlacementDecision:
    part_instance: PartInstanceGeometry
    x: float
    y: float
    rotation_deg: float
    footprint_world: Polygon


@dataclass(slots=True)
class PlacementRunResult:
    placements: list[PlacementDecision]
    unplaced: list[PartInstanceGeometry]
    attempts: int
    strategy_name: str
    quality_score: float
    candidate_points_generated: int


@dataclass(slots=True)
class RotatedVariant:
    rot: float
    poly: Polygon
    min_x: float
    min_y: float


class PlacementService:
    def __init__(self, scoring: ScoringService) -> None:
        self.scoring = scoring
        self.validator = ValidationService()
        self.free_space = FreeSpaceService()

    @staticmethod
    def _orderings(
        parts: list[PartInstanceGeometry], run_mode: str
    ) -> list[tuple[str, list[PartInstanceGeometry]]]:
        by_area = sorted(parts, key=lambda p: p.area_mm2, reverse=True)
        by_width = sorted(
            parts,
            key=lambda p: p.footprint_polygon_local.bounds[2] - p.footprint_polygon_local.bounds[0],
            reverse=True,
        )
        by_height = sorted(
            parts,
            key=lambda p: p.footprint_polygon_local.bounds[3] - p.footprint_polygon_local.bounds[1],
            reverse=True,
        )
        by_max_dim = sorted(
            parts,
            key=lambda p: max(
                p.footprint_polygon_local.bounds[2] - p.footprint_polygon_local.bounds[0],
                p.footprint_polygon_local.bounds[3] - p.footprint_polygon_local.bounds[1],
            ),
            reverse=True,
        )
        orders: list[tuple[str, list[PartInstanceGeometry]]] = [
            ("area-desc", by_area),
            ("width-desc", by_width),
            ("height-desc", by_height),
            ("max-dim-desc", by_max_dim),
        ]
        if run_mode == "optimize":
            rnd1 = parts[:]
            rnd2 = parts[:]
            random.Random(42).shuffle(rnd1)
            random.Random(7).shuffle(rnd2)
            orders.append(("shuffle-42", rnd1))
            orders.append(("shuffle-7", rnd2))
        else:
            # Keep quick mode practical: first 3 strategies only.
            return orders[:3]
        return orders

    @staticmethod
    def _sample_sorted(values: list[float], cap: int) -> list[float]:
        vals = sorted(set(values))
        if len(vals) <= cap:
            return vals
        out: list[float] = []
        step = (len(vals) - 1) / max(1, cap - 1)
        for i in range(cap):
            out.append(vals[round(i * step)])
        return sorted(set(out))

    def _candidate_points(
        self,
        placed_polys: list[Polygon],
        bin_poly: Polygon,
        run_mode: str,
        cap: int,
    ) -> list[tuple[float, float]]:
        bin_w = bin_poly.bounds[2]
        bin_h = bin_poly.bounds[3]
        xs = {0.0, bin_w}
        ys = {0.0, bin_h}
        points = {(0.0, 0.0)}
        for p in placed_polys:
            min_x, min_y, max_x, max_y = p.bounds
            xs.update([min_x, max_x])
            ys.update([min_y, max_y])
            points.update(
                {
                    (max_x, min_y),
                    (min_x, max_y),
                    (max_x, max_y),
                    (min_x, min_y),
                }
            )
        for cx, cy in self.free_space.cavity_anchor_points(
            placed_polys, bin_poly, limit=16 if run_mode == "quick" else 32
        ):
            points.add((cx, cy))
            points.add((cx, 0.0))
            points.add((0.0, cy))

        sx = self._sample_sorted(list(xs), 9 if run_mode == "quick" else 14)
        sy = self._sample_sorted(list(ys), 9 if run_mode == "quick" else 14)
        for x in sx:
            points.add((x, 0.0))
        for y in sy:
            points.add((0.0, y))
        for x in sx:
            for y in sy:
                points.add((x, y))

        out: list[tuple[float, float]] = []
        seen = set()
        for x, y in points:
            cx = min(max(0.0, x), bin_w)
            cy = min(max(0.0, y), bin_h)
            k = (round(cx, 3), round(cy, 3))
            if k in seen:
                continue
            seen.add(k)
            out.append((cx, cy))
        out.sort(key=lambda p: (p[1], p[0]))
        return out[:cap]

    def _is_valid_candidate(
        self,
        poly_world: Polygon,
        bin_prepared,
        placed_polys: list[Polygon],
        placed_prepared: list,
        metrics: EngineMetrics,
    ) -> bool:
        v = self.validator.validate_candidate(
            poly_world,
            bin_prepared=bin_prepared,
            placed_polys=placed_polys,
            placed_prepared=placed_prepared,
        )
        if v.ok:
            return True
        metrics.rejected_placements += 1
        if v.reason == "outside_bin":
            metrics.rejected_outside_bin += 1
        elif v.reason == "overlap":
            metrics.rejected_overlap += 1
            if (
                v.overlap_with_index is not None
                and len(metrics.overlap_pairs) < 120
                and v.overlap_area_mm2 > 0
            ):
                metrics.overlap_pairs.append(
                    f"candidate_overlap:{v.overlap_with_index}:{v.overlap_area_mm2:.6f}"
                )
        elif v.reason and v.reason.startswith("invalid_polygon"):
            metrics.rejected_invalid_polygon += 1
        else:
            metrics.rejected_invalid_transform += 1
        return False

    @staticmethod
    def _build_rotated_variants(
        poly_local: Polygon, rotations: list[float]
    ) -> list[RotatedVariant]:
        out: list[RotatedVariant] = []
        for rot in rotations:
            rp = rotate_polygon(poly_local, rot)
            min_x, min_y, _, _ = rp.bounds
            out.append(RotatedVariant(rot=rot, poly=rp, min_x=min_x, min_y=min_y))
        return out

    def _best_candidate_for_part(
        self,
        part: PartInstanceGeometry,
        rotations: list[float],
        placed: list[PlacementDecision],
        bin_poly: Polygon,
        metrics: EngineMetrics,
        candidate_cap: int,
        run_mode: str,
        candidate_points: list[tuple[float, float]] | None = None,
    ) -> PlacementDecision | None:
        placed_polys = [p.footprint_world for p in placed]
        bin_prepared = prep(bin_poly)
        placed_prepared = [prep(p) for p in placed_polys]
        variants = self._build_rotated_variants(part.footprint_polygon_local, rotations)
        points = (
            candidate_points
            if candidate_points is not None
            else self._candidate_points(placed_polys, bin_poly, run_mode, candidate_cap)
        )

        best_score = float("inf")
        best: PlacementDecision | None = None
        used_area_before = sum(p.area for p in placed_polys)

        for ax, ay in points:
            # quick mode: prune points that clearly explode envelope
            if run_mode == "quick" and placed_polys:
                cur_x, cur_y = self.free_space.envelope_size(placed_polys)
                if ay > cur_y + (bin_poly.bounds[3] * 0.25):
                    continue
                if ax > cur_x + (bin_poly.bounds[2] * 0.35):
                    continue
            for var in variants:
                tx = ax - var.min_x
                ty = ay - var.min_y
                world = transform_polygon(var.poly, 0, tx, ty)
                metrics.candidate_attempts += 1
                metrics.attempted_placements += 1
                if not self._is_valid_candidate(
                    world, bin_prepared, placed_polys, placed_prepared, metrics
                ):
                    continue
                f = self.scoring.features_for_candidate(
                    world,
                    placed_polys,
                    bin_poly,
                    used_area_before,
                    anchor_x=ax,
                    anchor_y=ay,
                )
                score = self.scoring.score_candidate(f, run_mode)
                if score < best_score:
                    best_score = score
                    best = PlacementDecision(
                        part_instance=part,
                        x=tx,
                        y=ty,
                        rotation_deg=var.rot,
                        footprint_world=world,
                    )
        if best is not None and len(metrics.score_trace) < 80:
            metrics.score_trace.append(
                f"{part.part_instance_id}: score={best_score:.3f} r={best.rotation_deg:.1f}"
            )
        return best

    def _fallback_first_fit(
        self,
        part: PartInstanceGeometry,
        rotations: list[float],
        placed: list[PlacementDecision],
        bin_poly: Polygon,
        metrics: EngineMetrics,
        run_mode: str,
    ) -> PlacementDecision | None:
        """Dense edge-anchored first-fit fallback when scored search finds nothing."""
        placed_polys = [p.footprint_world for p in placed]
        bin_prepared = prep(bin_poly)
        placed_prepared = [prep(p) for p in placed_polys]
        points = self._candidate_points(
            placed_polys, bin_poly, run_mode, cap=80 if run_mode == "quick" else 160
        )
        variants = self._build_rotated_variants(part.footprint_polygon_local, rotations)
        # Strong bottom-left bias but still explores dense anchors.
        for ax, ay in points:
            for var in variants:
                tx = ax - var.min_x
                ty = ay - var.min_y
                world = transform_polygon(var.poly, 0, tx, ty)
                metrics.candidate_attempts += 1
                metrics.attempted_placements += 1
                if not self._is_valid_candidate(
                    world, bin_prepared, placed_polys, placed_prepared, metrics
                ):
                    continue
                if len(metrics.score_trace) < 80:
                    metrics.score_trace.append(
                        f"{part.part_instance_id}: fallback-fit r={var.rot:.1f}"
                    )
                return PlacementDecision(
                    part_instance=part,
                    x=tx,
                    y=ty,
                    rotation_deg=var.rot,
                    footprint_world=world,
                )
        return None

    def run_multi_pass(
        self,
        parts: list[PartInstanceGeometry],
        rotations: list[float],
        bin_poly: Polygon,
        run_mode: str,
        metrics: EngineMetrics,
    ) -> PlacementRunResult:
        best_result = PlacementRunResult(
            placements=[],
            unplaced=parts[:],
            attempts=0,
            strategy_name="none",
            quality_score=-1e9,
            candidate_points_generated=0,
        )
        candidate_cap = 90 if run_mode == "quick" else 220

        for strategy_name, ordering in self._orderings(parts, run_mode):
            placed: list[PlacementDecision] = []
            unplaced: list[PartInstanceGeometry] = []
            candidate_points_generated = 0
            for part in ordering:
                candidate_points = self._candidate_points(
                    [p.footprint_world for p in placed],
                    bin_poly,
                    run_mode,
                    candidate_cap,
                )
                candidate_points_generated += len(candidate_points)
                cand = self._best_candidate_for_part(
                    part=part,
                    rotations=rotations,
                    placed=placed,
                    bin_poly=bin_poly,
                    metrics=metrics,
                    candidate_cap=candidate_cap,
                    run_mode=run_mode,
                    candidate_points=candidate_points,
                )
                if cand is None:
                    fallback = self._fallback_first_fit(
                        part=part,
                        rotations=rotations,
                        placed=placed,
                        bin_poly=bin_poly,
                        metrics=metrics,
                        run_mode=run_mode,
                    )
                    if fallback is None:
                        unplaced.append(part)
                    else:
                        metrics.accepted_placements += 1
                        placed.append(fallback)
                    continue
                metrics.accepted_placements += 1
                placed.append(cand)
            placed_polys = [p.footprint_world for p in placed]
            quality = self.scoring.layout_quality_score(
                placed_polys, bin_poly, unplaced_count=len(unplaced)
            )
            result = PlacementRunResult(
                placements=placed,
                unplaced=unplaced,
                attempts=metrics.candidate_attempts,
                strategy_name=strategy_name,
                quality_score=quality,
                candidate_points_generated=candidate_points_generated,
            )
            if result.quality_score > best_result.quality_score:
                best_result = result
            elif result.quality_score == best_result.quality_score:
                if len(result.placements) > len(best_result.placements):
                    best_result = result
        return best_result
