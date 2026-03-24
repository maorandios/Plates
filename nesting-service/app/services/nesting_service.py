from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from time import perf_counter
from uuid import uuid4

from shapely.geometry import Polygon
from shapely.prepared import prep

from app.schemas.nesting import (
    DebugMetadataOut,
    GeneratedSheetOut,
    NestingJobCreateRequest,
    NestingJobResultResponse,
    PlacementOut,
    ThicknessResultOut,
    UnplacedPartOut,
)
from app.services.cavity_fill_service import CavityFillService
from app.services.compaction_service import CompactionService
from app.services.geometry_service import ExpandedGeometrySet, GeometryService
from app.services.placement_service import PlacementDecision, PlacementService
from app.services.scoring_service import ScoringService
from app.services.validation_service import ValidationService
from app.utils.bin_utils import usable_bin
from app.utils.debug_metrics import EngineMetrics
from app.utils.polygon_utils import safe_rotation_set


@dataclass(slots=True)
class ModeConfig:
    simplify_tolerance_mm: float
    max_runtime_s_per_thickness: float
    max_sheets_per_thickness: int


def mode_config(run_mode: str) -> ModeConfig:
    if run_mode == "optimize":
        return ModeConfig(
            simplify_tolerance_mm=0.12,
            max_runtime_s_per_thickness=120.0,
            max_sheets_per_thickness=300,
        )
    return ModeConfig(
        simplify_tolerance_mm=0.35,
        max_runtime_s_per_thickness=8.0,
        max_sheets_per_thickness=80,
    )


class NestingService:
    def __init__(self) -> None:
        scoring = ScoringService()
        self.geometry = GeometryService()
        self.placement = PlacementService(scoring)
        self.compaction = CompactionService()
        self.cavity_fill = CavityFillService(self.placement)
        self.validation = ValidationService()

    def run(self, payload: NestingJobCreateRequest, job_id: str) -> NestingJobResultResponse:
        run_cfg = mode_config(payload.run_mode.value)
        run_start = perf_counter()
        all_thickness_results: list[ThicknessResultOut] = []
        all_warnings: list[str] = []
        all_errors: list[str] = []
        global_metrics = EngineMetrics()

        for tg in payload.thickness_groups:
            t_start = perf_counter()
            t_metrics = EngineMetrics()
            resolved = tg.resolved_rules
            expanded = self.geometry.expand_nestable_instances(
                parts=tg.parts,
                spacing_mm=resolved.spacing_mm,
                simplify_tolerance_mm=run_cfg.simplify_tolerance_mm,
            )
            t_metrics.simplification_original_points = expanded.simplify_original_points
            t_metrics.simplification_simplified_points = expanded.simplify_simplified_points
            t_metrics.polygon_parts_count = len(expanded.instances)
            for issue in expanded.issues:
                all_warnings.append(f"[{tg.thickness_mm}] {issue.part_id}: {issue.reason}")

            thickness_result = self._run_thickness_group(
                expanded=expanded,
                thickness_mm=tg.thickness_mm,
                stock_sheets=tg.stock_sheets,
                spacing_mm=resolved.spacing_mm,
                edge_margin_mm=resolved.edge_margin_mm,
                allow_rotation=resolved.allow_rotation,
                rotation_mode=resolved.rotation_mode.value,
                run_mode=payload.run_mode.value,
                run_cfg=run_cfg,
                metrics=t_metrics,
            )
            all_thickness_results.append(thickness_result)
            global_metrics.candidate_attempts += t_metrics.candidate_attempts
            global_metrics.cavity_fill_attempts += t_metrics.cavity_fill_attempts
            global_metrics.cavity_fill_successes += t_metrics.cavity_fill_successes
            global_metrics.compaction_moves += t_metrics.compaction_moves
            global_metrics.compaction_moves_attempted += t_metrics.compaction_moves_attempted
            global_metrics.compaction_moves_rejected += t_metrics.compaction_moves_rejected
            global_metrics.attempted_placements += t_metrics.attempted_placements
            global_metrics.accepted_placements += t_metrics.accepted_placements
            global_metrics.rejected_placements += t_metrics.rejected_placements
            global_metrics.rejected_outside_bin += t_metrics.rejected_outside_bin
            global_metrics.rejected_overlap += t_metrics.rejected_overlap
            global_metrics.rejected_invalid_polygon += t_metrics.rejected_invalid_polygon
            global_metrics.rejected_invalid_transform += t_metrics.rejected_invalid_transform
            global_metrics.candidate_points_generated += t_metrics.candidate_points_generated
            global_metrics.final_envelope_width_mm = max(
                global_metrics.final_envelope_width_mm, t_metrics.final_envelope_width_mm
            )
            global_metrics.final_envelope_height_mm = max(
                global_metrics.final_envelope_height_mm, t_metrics.final_envelope_height_mm
            )
            global_metrics.large_gap_penalty_score += t_metrics.large_gap_penalty_score
            global_metrics.final_selected_candidate_score = max(
                global_metrics.final_selected_candidate_score,
                t_metrics.final_selected_candidate_score,
            )
            global_metrics.fallback_count += t_metrics.fallback_count
            global_metrics.polygon_parts_count += t_metrics.polygon_parts_count
            global_metrics.simplification_original_points += (
                t_metrics.simplification_original_points
            )
            global_metrics.simplification_simplified_points += (
                t_metrics.simplification_simplified_points
            )
            global_metrics.score_trace.extend(t_metrics.score_trace[:20])
            global_metrics.overlap_pairs.extend(t_metrics.overlap_pairs[:20])
            global_metrics.sheet_valid = global_metrics.sheet_valid and t_metrics.sheet_valid
            if t_metrics.ordering_strategy_used:
                if global_metrics.ordering_strategy_used:
                    global_metrics.ordering_strategy_used += ","
                global_metrics.ordering_strategy_used += t_metrics.ordering_strategy_used
            t_metrics.runtime_ms = int((perf_counter() - t_start) * 1000)

        total_sheets = sum(r.sheet_count for r in all_thickness_results)
        total_used = sum(s.used_area for r in all_thickness_results for s in r.generated_sheets)
        total_waste = sum(r.waste_area for r in all_thickness_results)
        total_bin_area = sum(
            (s.width_mm * s.height_mm) for r in all_thickness_results for s in r.generated_sheets
        )
        total_util = (total_used / total_bin_area) if total_bin_area > 0 else 0.0
        total_placed_parts = sum(len(s.placements) for r in all_thickness_results for s in r.generated_sheets)
        total_unplaced_parts = sum(
            u.quantity_unplaced for r in all_thickness_results for u in r.unplaced_parts
        )

        global_metrics.runtime_ms = int((perf_counter() - run_start) * 1000)
        if payload.thickness_groups:
            global_metrics.large_gap_penalty_score = (
                global_metrics.large_gap_penalty_score / len(payload.thickness_groups)
            )
        result = NestingJobResultResponse(
            jobId=job_id,
            batchId=payload.batch_id,
            runMode=payload.run_mode,
            totalSheets=total_sheets,
            totalUtilization=round(total_util * 100, 3),
            totalWasteArea=round(total_waste, 3),
            totalPlacedParts=total_placed_parts,
            totalUnplacedParts=total_unplaced_parts,
            thicknessResults=all_thickness_results,
            debugMetadata=self._metrics_to_debug(global_metrics),
            warnings=all_warnings,
            errors=all_errors,
        )
        return result

    def _run_thickness_group(
        self,
        expanded: ExpandedGeometrySet,
        thickness_mm: float | None,
        stock_sheets,
        spacing_mm: float,
        edge_margin_mm: float,
        allow_rotation: bool,
        rotation_mode: str,
        run_mode: str,
        run_cfg: ModeConfig,
        metrics: EngineMetrics,
    ) -> ThicknessResultOut:
        by_sheet = [s for s in stock_sheets if s.enabled]
        remaining = expanded.instances[:]
        generated: list[GeneratedSheetOut] = []
        start = perf_counter()
        rotations = safe_rotation_set(allow_rotation, rotation_mode, run_mode)
        strategies_used: set[str] = set()
        gap_scores: list[float] = []
        if not by_sheet:
            return ThicknessResultOut(
                thicknessMm=thickness_mm,
                sheetCount=0,
                utilization=0.0,
                wasteArea=0.0,
                generatedSheets=[],
                unplacedParts=self._unplaced_summary(remaining, "No enabled stock sheets"),
                debugMetadata=self._metrics_to_debug(metrics),
            )

        stock_iter = 0
        while remaining and stock_iter < len(by_sheet) and len(generated) < run_cfg.max_sheets_per_thickness:
            if (perf_counter() - start) > run_cfg.max_runtime_s_per_thickness:
                metrics.early_stop_reason = "thickness_runtime_cap"
                break
            stock = by_sheet[stock_iter]
            stock_iter += 1
            bin_result = usable_bin(stock.width_mm, stock.height_mm, edge_margin_mm)
            if bin_result is None:
                metrics.fallback_count += 1
                continue
            bin_poly, inner_w, inner_h = bin_result
            run = self.placement.run_multi_pass(
                parts=remaining,
                rotations=rotations,
                bin_poly=bin_poly,
                run_mode=run_mode,
                metrics=metrics,
            )
            strategies_used.add(run.strategy_name)
            metrics.candidate_points_generated += run.candidate_points_generated
            metrics.final_selected_candidate_score = max(
                metrics.final_selected_candidate_score, run.quality_score
            )
            if len(metrics.score_trace) < 120:
                metrics.score_trace.append(
                    f"selected_strategy={run.strategy_name} score={run.quality_score:.3f}"
                )
            placements = run.placements
            unplaced = run.unplaced
            if not placements:
                # Could not place anything on this stock. Move on to next sheet.
                continue
            self.compaction.compact(
                placements, bin_poly, metrics, passes=1 if run_mode == "quick" else 3
            )
            if run_mode != "quick" or len(unplaced) <= 16:
                placements, unplaced = self.cavity_fill.fill(
                    placements,
                    unplaced,
                    rotations=rotations,
                    bin_poly=bin_poly,
                    metrics=metrics,
                    run_mode=run_mode,
                )
            self.compaction.compact(
                placements, bin_poly, metrics, passes=1 if run_mode == "quick" else 2
            )
            placements = self._sanitize_and_validate_sheet(placements, bin_poly, metrics)
            placed_polys = [p.footprint_world for p in placements]
            env_w, env_h = self.placement.free_space.envelope_size(placed_polys)
            metrics.final_envelope_width_mm = max(metrics.final_envelope_width_mm, env_w)
            metrics.final_envelope_height_mm = max(metrics.final_envelope_height_mm, env_h)
            gap_scores.append(self.placement.free_space.large_gap_penalty(placed_polys, bin_poly))
            remaining = unplaced
            generated.append(
                self._sheet_result(
                    stock_sheet_id=stock.id,
                    stock_type=stock.type,
                    full_width_mm=stock.width_mm,
                    full_height_mm=stock.height_mm,
                    width_mm=inner_w,
                    height_mm=inner_h,
                    placements=placements,
                )
            )

        # If still remaining and out of sheets, mark as unplaced.
        unplaced_reason = (
            "Quick-mode runtime budget reached before all parts were nested."
            if metrics.early_stop_reason == "thickness_runtime_cap"
            else "No valid collision-free placement remained on the configured stock."
        )
        unplaced_summary = self._unplaced_summary(remaining, unplaced_reason)
        used_area = sum(s.used_area for s in generated)
        waste_area = sum(s.waste_area for s in generated)
        bin_area = sum(s.width_mm * s.height_mm for s in generated)
        util = (used_area / bin_area) * 100 if bin_area > 0 else 0.0
        metrics.runtime_ms = int((perf_counter() - start) * 1000)
        metrics.ordering_strategy_used = ",".join(sorted(strategies_used))
        metrics.large_gap_penalty_score = (
            sum(gap_scores) / len(gap_scores) if gap_scores else 0.0
        )
        return ThicknessResultOut(
            thicknessMm=thickness_mm,
            sheetCount=len(generated),
            utilization=round(util, 3),
            wasteArea=round(waste_area, 3),
            generatedSheets=generated,
            unplacedParts=unplaced_summary,
            debugMetadata=self._metrics_to_debug(metrics),
        )

    @staticmethod
    def _sheet_result(
        stock_sheet_id: str,
        stock_type: str,
        full_width_mm: float,
        full_height_mm: float,
        width_mm: float,
        height_mm: float,
        placements: list[PlacementDecision],
    ) -> GeneratedSheetOut:
        out_placements: list[PlacementOut] = []
        used = 0.0
        for pl in placements:
            inst = pl.part_instance
            used += max(0.0, inst.area_mm2)
            out_placements.append(
                PlacementOut(
                    partInstanceId=inst.part_instance_id,
                    partId=inst.part_id,
                    partName=inst.part_name,
                    clientId=inst.client_id,
                    clientCode=inst.client_code,
                    markingText=inst.marking_text,
                    x=round(pl.x, 4),
                    y=round(pl.y, 4),
                    rotationDeg=round(pl.rotation_deg, 3),
                    outerContour=inst.original_outer_local,
                    innerContours=inst.original_holes_local,
                )
            )
        bin_area = width_mm * height_mm
        waste = max(0.0, bin_area - used)
        util = (used / bin_area) * 100 if bin_area > 0 else 0.0
        return GeneratedSheetOut(
            sheetId=str(uuid4()),
            stockSheetId=stock_sheet_id,
            stockType=stock_type,
            fullWidthMm=round(full_width_mm, 4),
            fullHeightMm=round(full_height_mm, 4),
            widthMm=round(width_mm, 4),
            heightMm=round(height_mm, 4),
            usedArea=round(used, 3),
            wasteArea=round(waste, 3),
            utilization=round(util, 3),
            placements=out_placements,
        )

    def _sanitize_and_validate_sheet(
        self,
        placements: list[PlacementDecision],
        bin_poly: Polygon,
        metrics: EngineMetrics,
    ) -> list[PlacementDecision]:
        if not placements:
            metrics.sheet_valid = True
            return placements
        polys = [p.footprint_world for p in placements]
        final_v = self.validation.validate_final_sheet(polys, bin_poly)
        if final_v.ok:
            metrics.sheet_valid = True
            return placements

        metrics.sheet_valid = False
        for i, j, a in final_v.overlap_pairs[:40]:
            metrics.overlap_pairs.append(f"final_overlap:{i}:{j}:{a:.6f}")

        # Enforce correctness: keep only sequentially valid placements.
        kept: list[PlacementDecision] = []
        bin_prepared = prep(bin_poly)
        for pl in placements:
            placed_polys = [k.footprint_world for k in kept]
            placed_prepared = [prep(p) for p in placed_polys]
            v = self.validation.validate_candidate(
                pl.footprint_world, bin_prepared, placed_polys, placed_prepared
            )
            if not v.ok:
                metrics.rejected_placements += 1
                if v.reason == "outside_bin":
                    metrics.rejected_outside_bin += 1
                elif v.reason == "overlap":
                    metrics.rejected_overlap += 1
                else:
                    metrics.rejected_invalid_transform += 1
                continue
            kept.append(pl)
        return kept

    @staticmethod
    def _unplaced_summary(instances, reason: str) -> list[UnplacedPartOut]:
        if not instances:
            return []
        c = Counter((i.part_id, i.part_name, i.client_id, i.client_code) for i in instances)
        out: list[UnplacedPartOut] = []
        for (part_id, part_name, client_id, client_code), n in c.items():
            out.append(
                UnplacedPartOut(
                    partId=part_id,
                    partName=part_name,
                    clientId=client_id,
                    clientCode=client_code,
                    quantityUnplaced=n,
                    reason=reason,
                )
            )
        return out

    @staticmethod
    def _metrics_to_debug(metrics: EngineMetrics) -> DebugMetadataOut:
        return DebugMetadataOut(
            runtimeMs=metrics.runtime_ms,
            candidateAttempts=metrics.candidate_attempts,
            earlyStopReason=metrics.early_stop_reason,
            polygonPartsCount=metrics.polygon_parts_count,
            fallbackCount=metrics.fallback_count,
            simplificationOriginalPoints=metrics.simplification_original_points,
            simplificationSimplifiedPoints=metrics.simplification_simplified_points,
            simplificationRatio=round(metrics.simplification_ratio, 4),
            cavityFillAttempts=metrics.cavity_fill_attempts,
            cavityFillSuccesses=metrics.cavity_fill_successes,
            compactionMoves=metrics.compaction_moves,
            compactionMovesAttempted=metrics.compaction_moves_attempted,
            compactionMovesRejected=metrics.compaction_moves_rejected,
            attemptedPlacements=metrics.attempted_placements,
            acceptedPlacements=metrics.accepted_placements,
            rejectedPlacements=metrics.rejected_placements,
            rejectedOutsideBin=metrics.rejected_outside_bin,
            rejectedOverlap=metrics.rejected_overlap,
            rejectedInvalidPolygon=metrics.rejected_invalid_polygon,
            rejectedInvalidTransform=metrics.rejected_invalid_transform,
            overlapPairs=metrics.overlap_pairs[:120],
            sheetValid=metrics.sheet_valid,
            orderingStrategyUsed=metrics.ordering_strategy_used,
            candidatePointsGenerated=metrics.candidate_points_generated,
            finalEnvelopeWidthMm=round(metrics.final_envelope_width_mm, 3),
            finalEnvelopeHeightMm=round(metrics.final_envelope_height_mm, 3),
            largeGapPenaltyScore=round(metrics.large_gap_penalty_score, 6),
            finalSelectedCandidateScore=round(metrics.final_selected_candidate_score, 6),
            scoreTrace=metrics.score_trace[:120],
        )
