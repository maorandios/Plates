from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from app.schemas.nesting import JobStatus, NestingJobCreateRequest, NestingJobResultResponse


def utc_now() -> datetime:
    return datetime.now(tz=timezone.utc)


@dataclass(slots=True)
class NestingJob:
    id: str
    payload: NestingJobCreateRequest
    status: JobStatus = JobStatus.pending
    created_at: datetime = field(default_factory=utc_now)
    started_at: datetime | None = None
    finished_at: datetime | None = None
    error: str | None = None
    result: NestingJobResultResponse | None = None
    debug: dict[str, Any] = field(default_factory=dict)
