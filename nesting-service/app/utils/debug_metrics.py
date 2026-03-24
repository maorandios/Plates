from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class EngineMetrics:
    runtime_ms: int = 0
    candidate_attempts: int = 0
    early_stop_reason: str | None = None
    polygon_parts_count: int = 0
    fallback_count: int = 0
    simplification_original_points: int = 0
    simplification_simplified_points: int = 0
    cavity_fill_attempts: int = 0
    cavity_fill_successes: int = 0
    compaction_moves: int = 0
    compaction_moves_attempted: int = 0
    compaction_moves_rejected: int = 0
    attempted_placements: int = 0
    accepted_placements: int = 0
    rejected_placements: int = 0
    rejected_outside_bin: int = 0
    rejected_overlap: int = 0
    rejected_invalid_polygon: int = 0
    rejected_invalid_transform: int = 0
    overlap_pairs: list[str] = field(default_factory=list)
    sheet_valid: bool = True
    ordering_strategy_used: str = ""
    candidate_points_generated: int = 0
    final_envelope_width_mm: float = 0.0
    final_envelope_height_mm: float = 0.0
    large_gap_penalty_score: float = 0.0
    final_selected_candidate_score: float = 0.0
    score_trace: list[str] = field(default_factory=list)

    @property
    def simplification_ratio(self) -> float:
        if self.simplification_original_points <= 0:
            return 1.0
        return self.simplification_simplified_points / self.simplification_original_points
