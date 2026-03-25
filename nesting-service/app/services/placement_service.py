from __future__ import annotations

from dataclasses import dataclass

from shapely.geometry import Polygon
from shapely.prepared import prep

from app.services.free_space_service import FreeSpaceService
from app.services.geometry_service import PartInstanceGeometry
from app.services.scoring_service import ScoringService, ScoreBreakdown
from app.services.validation_service import ValidationService
from app.utils.debug_metrics import EngineMetrics
from app.utils.polygon_utils import rotate_translate
from app.utils.transform_utils import rotate_polygon, transform_polygon


@dataclass(slots=True)
class PlacementDecision:
    part_instance: PartInstanceGeometry
    x: float
    y: float
    rotation_deg: float
    footprint_world: Polygon
    material_world: Polygon


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


@dataclass(slots=True)
class CandidateAnchor:
    x: float
    y: float
    source: str


class PlacementService:
    _DEBUG_LOG_CAP = 400

    def __init__(self, scoring: ScoringService) -> None:
        self.scoring = scoring
        self.validator = ValidationService()
        self.free_space = FreeSpaceService()

    @staticmethod
    def _tie_sort(parts: list[PartInstanceGeometry], key_fn, salt: int) -> list[PartInstanceGeometry]:
        """Primary key descending with deterministic pseudo-random tie-break for similar sizes."""

        def sort_key(p: PartInstanceGeometry) -> tuple[float, float]:
            base = key_fn(p)
            tie = (hash((p.part_id, salt)) % 1_000_000) / 1e9
            return (base, tie)

        return sorted(parts, key=sort_key, reverse=True)

    @classmethod
    def _orderings(
        cls,
        parts: list[PartInstanceGeometry],
        run_mode: str,
    ) -> list[tuple[str, list[PartInstanceGeometry]]]:
        def kw(p: PartInstanceGeometry) -> float:
            b = p.footprint_polygon_local.bounds
            return b[2] - b[0]

        def kh(p: PartInstanceGeometry) -> float:
            b = p.footprint_polygon_local.bounds
            return b[3] - b[1]

        def kmax(p: PartInstanceGeometry) -> float:
            b = p.footprint_polygon_local.bounds
            return max(b[2] - b[0], b[3] - b[1])

        by_area = cls._tie_sort(parts, lambda p: p.area_mm2, salt=11)
        by_width = cls._tie_sort(parts, kw, salt=17)
        by_height = cls._tie_sort(parts, kh, salt=23)
        by_max_dim = cls._tie_sort(parts, kmax, salt=29)

        return [
            ("area-desc", by_area),
            ("width-desc", by_width),
            ("height-desc", by_height),
            ("max-dim-desc", by_max_dim),
        ]

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

    def _append_debug(self, metrics: EngineMetrics, line: str) -> None:
        if len(metrics.candidate_debug_log) >= self._DEBUG_LOG_CAP:
            return
        metrics.candidate_debug_log.append(line[:500])

    def _candidate_anchors(
        self,
        placed_polys: list[Polygon],
        bin_poly: Polygon,
        run_mode: str,
        cap: int,
    ) -> list[CandidateAnchor]:
        """Rich anchors: walls, placed footprint corners/edges, ranked cavity corners (not full-sheet scan)."""
        bin_w = bin_poly.bounds[2]
        bin_h = bin_poly.bounds[3]
        anchors: list[CandidateAnchor] = []

        # Sheet boundary samples (left / bottom primary contact lines)
        xs = {0.0, bin_w}
        ys = {0.0, bin_h}
        for p in placed_polys:
            min_x, min_y, max_x, max_y = p.bounds
            xs.update([min_x, max_x])
            ys.update([min_y, max_y])

        sx = self._sample_sorted(list(xs), 9 if run_mode == "quick" else 16)
        sy = self._sample_sorted(list(ys), 9 if run_mode == "quick" else 16)

        for y in sy:
            anchors.append(CandidateAnchor(0.0, min(max(0.0, y), bin_h), "left_wall"))
        for x in sx:
            anchors.append(CandidateAnchor(min(max(0.0, x), bin_w), 0.0, "bottom_wall"))

        # Placed footprint corners + edge contacts (bbox of footprint in world)
        for p in placed_polys:
            min_x, min_y, max_x, max_y = p.bounds
            min_x = min(max(0.0, min_x), bin_w)
            min_y = min(max(0.0, min_y), bin_h)
            max_x = min(max(0.0, max_x), bin_w)
            max_y = min(max(0.0, max_y), bin_h)
            mx = (min_x + max_x) / 2.0
            my = (min_y + max_y) / 2.0
            anchors.extend(
                [
                    CandidateAnchor(min_x, min_y, "placed_bl"),
                    CandidateAnchor(min_x, max_y, "placed_tl"),
                    CandidateAnchor(max_x, min_y, "placed_br"),
                    CandidateAnchor(max_x, max_y, "placed_tr"),
                    CandidateAnchor(mx, min_y, "placed_bottom_edge"),
                    CandidateAnchor(min_x, my, "placed_left_edge"),
                    CandidateAnchor(max_x, my, "placed_right_edge"),
                    CandidateAnchor(mx, max_y, "placed_top_edge"),
                ]
            )

        # Ranked cavity corners / edges from true free space
        lim = 14 if run_mode == "quick" else 28
        for x, y, tag, rank in self.free_space.cavity_corner_and_edge_anchors(
            placed_polys, bin_poly, limit_regions=lim, per_region=9
        ):
            cx = min(max(0.0, x), bin_w)
            cy = min(max(0.0, y), bin_h)
            anchors.append(CandidateAnchor(cx, cy, f"{tag}:r{rank}"))

        # Light coarse grid on boundary strips only (not full sheet brute force)
        for x in sx[::2]:
            anchors.append(CandidateAnchor(min(max(0.0, x), bin_w), 0.0, "bottom_wall_sparse"))
        for y in sy[::2]:
            anchors.append(CandidateAnchor(0.0, min(max(0.0, y), bin_h), "left_wall_sparse"))

        # Bottom-left origin always
        anchors.append(CandidateAnchor(0.0, 0.0, "origin"))

        seen: set[tuple[float, float, str]] = set()
        out: list[CandidateAnchor] = []
        for a in anchors:
            cx = min(max(0.0, a.x), bin_w)
            cy = min(max(0.0, a.y), bin_h)
            k = (round(cx, 2), round(cy, 2), a.source)
            if k in seen:
                continue
            seen.add(k)
            out.append(CandidateAnchor(cx, cy, a.source))
        out.sort(key=lambda p: (p.y, p.x))
        return out[:cap]

    def _candidate_points(
        self,
        placed_polys: list[Polygon],
        bin_poly: Polygon,
        run_mode: str,
        cap: int,
    ) -> list[tuple[float, float]]:
        return [(a.x, a.y) for a in self._candidate_anchors(placed_polys, bin_poly, run_mode, cap)]

    def _is_valid_candidate(
        self,
        footprint_world: Polygon,
        material_world: Polygon,
        candidate_part_id: str,
        bin_prepared,
        placed: list[PlacementDecision],
        same_part_gap_mm: float,
        metrics: EngineMetrics,
    ) -> tuple[bool, str]:
        placed_footprints = [p.footprint_world for p in placed]
        placed_materials = [p.material_world for p in placed]
        placed_part_ids = [p.part_instance.part_id for p in placed]
        v = self.validator.validate_candidate_pairwise(
            footprint_world=footprint_world,
            material_world=material_world,
            candidate_part_id=candidate_part_id,
            bin_prepared=bin_prepared,
            placed_footprints=placed_footprints,
            placed_materials=placed_materials,
            placed_part_ids=placed_part_ids,
            same_part_gap_mm=same_part_gap_mm,
        )
        if v.ok:
            return True, "ok"
        metrics.rejected_placements += 1
        reason = v.reason or "reject"
        if v.reason == "outside_bin":
            metrics.rejected_outside_bin += 1
            reason = "outside_bin"
        elif v.reason == "overlap":
            metrics.rejected_overlap += 1
            reason = "overlap"
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
            reason = "invalid_polygon"
        else:
            metrics.rejected_invalid_transform += 1
            reason = "invalid_transform"
        return False, reason

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
        same_part_gap_mm: float,
        candidate_points: list[tuple[float, float]] | None = None,
        precomputed_anchors: list[CandidateAnchor] | None = None,
        candidate_point_source: str = "cavity_fill",
    ) -> PlacementDecision | None:
        placed_polys = [p.footprint_world for p in placed]
        bin_prepared = prep(bin_poly)
        variants = self._build_rotated_variants(part.footprint_polygon_local, rotations)
        if precomputed_anchors is not None:
            anchors = precomputed_anchors
        elif candidate_points is not None:
            anchors = [
                CandidateAnchor(x, y, candidate_point_source) for x, y in candidate_points
            ]
        else:
            anchors = self._candidate_anchors(placed_polys, bin_poly, run_mode, candidate_cap)

        best_score = float("inf")
        best_bd: ScoreBreakdown | None = None
        best: PlacementDecision | None = None
        used_area_before = sum(p.area for p in placed_polys)

        for anchor in anchors:
            ax, ay = anchor.x, anchor.y
            src = anchor.source
            # quick mode: prune anchors that jump far beyond the current bbox (keep some slack
            # so upper-sheet / second-row positions remain in the search set — goal = fill sheet).
            if run_mode == "quick" and placed_polys:
                cur_x, cur_y = self.free_space.envelope_size(placed_polys)
                bin_w, bin_h = bin_poly.bounds[2], bin_poly.bounds[3]
                if ay > cur_y + (bin_h * 0.55):
                    continue
                if ax > cur_x + (bin_w * 0.55):
                    continue
            for var in variants:
                tx = ax - var.min_x
                ty = ay - var.min_y
                world = transform_polygon(var.poly, 0, tx, ty)
                mat_world = rotate_translate(
                    part.original_polygon_local, var.rot, tx, ty
                )
                metrics.candidate_attempts += 1
                metrics.attempted_placements += 1
                ok, rej = self._is_valid_candidate(
                    world,
                    mat_world,
                    part.part_id,
                    bin_prepared,
                    placed,
                    same_part_gap_mm,
                    metrics,
                )
                if not ok:
                    self._append_debug(
                        metrics,
                        f"rej|{part.part_id}|{src}|{ax:.2f}|{ay:.2f}|r={var.rot:.0f}|{rej}",
                    )
                    continue
                f = self.scoring.features_for_candidate(
                    world,
                    placed_polys,
                    bin_poly,
                    used_area_before,
                    anchor_x=ax,
                    anchor_y=ay,
                )
                score, bd = self.scoring.score_candidate_with_breakdown(f, run_mode)
                if score < best_score:
                    best_score = score
                    best_bd = bd
                    best = PlacementDecision(
                        part_instance=part,
                        x=tx,
                        y=ty,
                        rotation_deg=var.rot,
                        footprint_world=world,
                        material_world=mat_world,
                    )
        if best is not None:
            if best_bd is not None:
                metrics.last_score_breakdown = (
                    f"pos={best_bd.position_yx:.1f} env={best_bd.envelope_growth:.1f} "
                    f"contact={best_bd.contact_score:.1f} cavity={best_bd.cavity_fit_score:.1f} "
                    f"chan={best_bd.channel_penalty:.1f} edgeW={best_bd.edge_waste_penalty:.1f} "
                    f"frag={best_bd.fragmentation_penalty:.1f} earlyH={best_bd.early_height_penalty:.1f} "
                    f"total={best_bd.total:.1f}"
                )
            if len(metrics.score_trace) < 80:
                metrics.score_trace.append(
                    f"{part.part_instance_id}: total={best_score:.3f} r={best.rotation_deg:.1f}"
                )
            bd = (metrics.last_score_breakdown or "")[:200]
            self._append_debug(
                metrics,
                f"ok|{part.part_id}|{best_score:.3f}|r={best.rotation_deg:.1f}|{bd}",
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
        same_part_gap_mm: float,
    ) -> PlacementDecision | None:
        """Dense edge-anchored first-fit fallback when scored search finds nothing."""
        placed_polys = [p.footprint_world for p in placed]
        bin_prepared = prep(bin_poly)
        anchors = self._candidate_anchors(
            placed_polys, bin_poly, run_mode, cap=100 if run_mode == "quick" else 140
        )
        variants = self._build_rotated_variants(part.footprint_polygon_local, rotations)
        for anchor in anchors:
            ax, ay = anchor.x, anchor.y
            for var in variants:
                tx = ax - var.min_x
                ty = ay - var.min_y
                world = transform_polygon(var.poly, 0, tx, ty)
                mat_world = rotate_translate(
                    part.original_polygon_local, var.rot, tx, ty
                )
                metrics.candidate_attempts += 1
                metrics.attempted_placements += 1
                ok, _rej = self._is_valid_candidate(
                    world,
                    mat_world,
                    part.part_id,
                    bin_prepared,
                    placed,
                    same_part_gap_mm,
                    metrics,
                )
                if not ok:
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
                    material_world=mat_world,
                )
        return None

    def run_multi_pass(
        self,
        parts: list[PartInstanceGeometry],
        rotations: list[float],
        bin_poly: Polygon,
        run_mode: str,
        metrics: EngineMetrics,
        same_part_gap_mm: float = 0.0,
        initial_placements: list[PlacementDecision] | None = None,
    ) -> PlacementRunResult:
        """
        If `initial_placements` is set, each strategy starts from that fixed layout and only
        tries to place `parts` (remaining instances). Used to saturate a sheet before opening
        another stock line.
        """
        init = list(initial_placements) if initial_placements else []
        if not parts:
            polys = [p.footprint_world for p in init]
            return PlacementRunResult(
                placements=init,
                unplaced=[],
                attempts=metrics.candidate_attempts,
                strategy_name="none",
                quality_score=self.scoring.layout_quality_score(polys, bin_poly, 0)
                if polys
                else -1e9,
                candidate_points_generated=0,
            )

        best_result = PlacementRunResult(
            placements=[],
            unplaced=parts[:],
            attempts=0,
            strategy_name="none",
            quality_score=-1e9,
            candidate_points_generated=0,
        )
        candidate_cap = 88 if run_mode == "quick" else 200
        no_improve = 0

        for strategy_name, ordering in self._orderings(parts, run_mode):
            placed: list[PlacementDecision] = list(init)
            unplaced: list[PartInstanceGeometry] = []
            candidate_points_generated = 0
            for part in ordering:
                pre = self._candidate_anchors(
                    [p.footprint_world for p in placed],
                    bin_poly,
                    run_mode,
                    candidate_cap,
                )
                candidate_points_generated += len(pre)
                cand = self._best_candidate_for_part(
                    part=part,
                    rotations=rotations,
                    placed=placed,
                    bin_poly=bin_poly,
                    metrics=metrics,
                    candidate_cap=candidate_cap,
                    run_mode=run_mode,
                    same_part_gap_mm=same_part_gap_mm,
                    precomputed_anchors=pre,
                )
                if cand is None:
                    fallback = self._fallback_first_fit(
                        part=part,
                        rotations=rotations,
                        placed=placed,
                        bin_poly=bin_poly,
                        metrics=metrics,
                        run_mode=run_mode,
                        same_part_gap_mm=same_part_gap_mm,
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
            improved = False
            if result.quality_score > best_result.quality_score + 1e-9:
                best_result = result
                improved = True
            elif (
                abs(result.quality_score - best_result.quality_score) < 1e-9
                and len(result.placements) > len(best_result.placements)
            ):
                best_result = result
                improved = True
            if improved:
                no_improve = 0
            elif run_mode == "quick":
                no_improve += 1
                if no_improve >= 2:
                    metrics.early_stop_reason = metrics.early_stop_reason or "multi_pass_no_improvement"
                    break
            else:
                no_improve += 1
                if no_improve >= 2:
                    metrics.early_stop_reason = metrics.early_stop_reason or "multi_pass_no_improvement"
                    break
        return best_result
