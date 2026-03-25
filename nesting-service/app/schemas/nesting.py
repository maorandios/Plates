from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class RotationMode(str, Enum):
    none = "none"
    ninety_only = "ninetyOnly"
    free = "free"


class JobStatus(str, Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class RunMode(str, Enum):
    quick = "quick"
    optimize = "optimize"


class NestingEngine(str, Enum):
    """Server placement pipeline (anchor/score heuristic)."""

    heuristic = "heuristic"


class ResolvedRules(BaseModel):
    spacing_mm: float = Field(alias="spacingMm", ge=0)
    edge_margin_mm: float = Field(alias="edgeMarginMm", ge=0)
    allow_rotation: bool = Field(alias="allowRotation")
    rotation_mode: RotationMode = Field(alias="rotationMode")
    # Minimum gap between *material* boundaries for two instances of the same part.
    # 0 = allow flush/touching edges (common-line style); spacingMm still applies between different parts.
    same_part_gap_mm: float = Field(default=0.0, alias="samePartGapMm", ge=0)

    model_config = ConfigDict(populate_by_name=True)


class StockSheetIn(BaseModel):
    id: str
    width_mm: float = Field(alias="widthMm", gt=0)
    height_mm: float = Field(alias="heightMm", gt=0)
    type: Literal["purchase", "leftover"]
    enabled: bool = True

    model_config = ConfigDict(populate_by_name=True)


class PartIn(BaseModel):
    part_id: str = Field(alias="partId")
    part_name: str = Field(alias="partName")
    client_id: str = Field(alias="clientId")
    client_code: str = Field(alias="clientCode")
    quantity: int = Field(ge=1)
    area_mm2: float = Field(alias="areaMm2", ge=0)
    outer_contour: list[list[float]] = Field(alias="outerContour", min_length=3)
    inner_contours: list[list[list[float]]] = Field(alias="innerContours", default_factory=list)
    marking_text: str = Field(alias="markingText", default="")
    geometry_status: Literal["ready", "warning", "error"] = Field(alias="geometryStatus")

    model_config = ConfigDict(populate_by_name=True)


class ThicknessGroupIn(BaseModel):
    thickness_mm: float | None = Field(alias="thicknessMm")
    resolved_rules: ResolvedRules = Field(alias="resolvedRules")
    stock_sheets: list[StockSheetIn] = Field(alias="stockSheets", default_factory=list)
    parts: list[PartIn] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)


class NestingJobCreateRequest(BaseModel):
    batch_id: str = Field(alias="batchId")
    cutting_method: str = Field(alias="cuttingMethod")
    run_mode: RunMode = Field(alias="runMode")
    nesting_engine: NestingEngine = Field(
        default=NestingEngine.heuristic,
        alias="nestingEngine",
        description="Anchor/score nesting engine (ignored if omitted).",
    )
    thickness_groups: list[ThicknessGroupIn] = Field(alias="thicknessGroups", default_factory=list)

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("nesting_engine", mode="before")
    @classmethod
    def _legacy_svgnest_to_heuristic(cls, v: object) -> object:
        """Removed server SVGnest pipeline; old clients may still send svgnest."""
        if v == "svgnest":
            return "heuristic"
        return v


class JobCreateResponse(BaseModel):
    job_id: str = Field(alias="jobId")
    status: JobStatus
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(populate_by_name=True)


class JobStatusResponse(BaseModel):
    job_id: str = Field(alias="jobId")
    status: JobStatus
    created_at: datetime = Field(alias="createdAt")
    started_at: datetime | None = Field(alias="startedAt", default=None)
    finished_at: datetime | None = Field(alias="finishedAt", default=None)
    error: str | None = None

    model_config = ConfigDict(populate_by_name=True)


class PlacementOut(BaseModel):
    part_instance_id: str = Field(alias="partInstanceId")
    part_id: str = Field(alias="partId")
    part_name: str = Field(alias="partName")
    client_id: str = Field(alias="clientId")
    client_code: str = Field(alias="clientCode")
    marking_text: str = Field(alias="markingText")
    x: float
    y: float
    rotation_deg: float = Field(alias="rotationDeg")
    outer_contour: list[list[float]] = Field(alias="outerContour")
    inner_contours: list[list[list[float]]] = Field(alias="innerContours")

    model_config = ConfigDict(populate_by_name=True)


class GeneratedSheetOut(BaseModel):
    sheet_id: str = Field(alias="sheetId")
    stock_sheet_id: str = Field(alias="stockSheetId")
    stock_type: Literal["purchase", "leftover"] = Field(alias="stockType")
    full_width_mm: float = Field(alias="fullWidthMm")
    full_height_mm: float = Field(alias="fullHeightMm")
    width_mm: float = Field(alias="widthMm")
    height_mm: float = Field(alias="heightMm")
    used_area: float = Field(alias="usedArea")
    waste_area: float = Field(alias="wasteArea")
    utilization: float
    placements: list[PlacementOut]

    model_config = ConfigDict(populate_by_name=True)


class UnplacedPartOut(BaseModel):
    part_id: str = Field(alias="partId")
    part_name: str = Field(alias="partName")
    client_id: str = Field(alias="clientId")
    client_code: str = Field(alias="clientCode")
    quantity_unplaced: int = Field(alias="quantityUnplaced")
    reason: str

    model_config = ConfigDict(populate_by_name=True)


class DebugMetadataOut(BaseModel):
    runtime_ms: int = Field(alias="runtimeMs")
    candidate_attempts: int = Field(alias="candidateAttempts")
    early_stop_reason: str | None = Field(alias="earlyStopReason", default=None)
    polygon_parts_count: int = Field(alias="polygonPartsCount")
    fallback_count: int = Field(alias="fallbackCount")
    simplification_original_points: int = Field(alias="simplificationOriginalPoints")
    simplification_simplified_points: int = Field(alias="simplificationSimplifiedPoints")
    simplification_ratio: float = Field(alias="simplificationRatio")
    cavity_fill_attempts: int = Field(alias="cavityFillAttempts")
    cavity_fill_successes: int = Field(alias="cavityFillSuccesses")
    compaction_moves: int = Field(alias="compactionMoves")
    compaction_moves_attempted: int = Field(alias="compactionMovesAttempted", default=0)
    compaction_moves_rejected: int = Field(alias="compactionMovesRejected", default=0)
    attempted_placements: int = Field(alias="attemptedPlacements", default=0)
    accepted_placements: int = Field(alias="acceptedPlacements", default=0)
    rejected_placements: int = Field(alias="rejectedPlacements", default=0)
    rejected_outside_bin: int = Field(alias="rejectedOutsideBin", default=0)
    rejected_overlap: int = Field(alias="rejectedOverlap", default=0)
    rejected_invalid_polygon: int = Field(alias="rejectedInvalidPolygon", default=0)
    rejected_invalid_transform: int = Field(alias="rejectedInvalidTransform", default=0)
    overlap_pairs: list[str] = Field(alias="overlapPairs", default_factory=list)
    sheet_valid: bool = Field(alias="sheetValid", default=True)
    ordering_strategy_used: str = Field(alias="orderingStrategyUsed", default="")
    candidate_points_generated: int = Field(alias="candidatePointsGenerated", default=0)
    final_envelope_width_mm: float = Field(alias="finalEnvelopeWidthMm", default=0.0)
    final_envelope_height_mm: float = Field(alias="finalEnvelopeHeightMm", default=0.0)
    large_gap_penalty_score: float = Field(alias="largeGapPenaltyScore", default=0.0)
    final_selected_candidate_score: float = Field(alias="finalSelectedCandidateScore", default=0.0)
    score_trace: list[str] = Field(alias="scoreTrace", default_factory=list)
    candidate_debug_log: list[str] = Field(alias="candidateDebugLog", default_factory=list)
    last_score_breakdown: str = Field(alias="lastScoreBreakdown", default="")
    final_layout_quality_score: float = Field(alias="finalLayoutQualityScore", default=0.0)
    thickness_runtime_ms: int = Field(alias="thicknessRuntimeMs", default=0)
    rejected_reasons_summary: str = Field(alias="rejectedReasonsSummary", default="")

    model_config = ConfigDict(populate_by_name=True)


class ThicknessResultOut(BaseModel):
    thickness_mm: float | None = Field(alias="thicknessMm")
    sheet_count: int = Field(alias="sheetCount")
    utilization: float
    waste_area: float = Field(alias="wasteArea")
    generated_sheets: list[GeneratedSheetOut] = Field(alias="generatedSheets")
    unplaced_parts: list[UnplacedPartOut] = Field(alias="unplacedParts")
    debug_metadata: DebugMetadataOut = Field(alias="debugMetadata")

    model_config = ConfigDict(populate_by_name=True)


class NestingJobResultResponse(BaseModel):
    job_id: str = Field(alias="jobId")
    batch_id: str = Field(alias="batchId")
    run_mode: RunMode = Field(alias="runMode")
    nesting_engine: NestingEngine = Field(default=NestingEngine.heuristic, alias="nestingEngine")
    total_sheets: int = Field(alias="totalSheets")
    total_utilization: float = Field(alias="totalUtilization")
    total_waste_area: float = Field(alias="totalWasteArea")
    total_placed_parts: int = Field(alias="totalPlacedParts")
    total_unplaced_parts: int = Field(alias="totalUnplacedParts")
    thickness_results: list[ThicknessResultOut] = Field(alias="thicknessResults")
    debug_metadata: DebugMetadataOut = Field(alias="debugMetadata")
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)
