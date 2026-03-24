from __future__ import annotations

import asyncio
from datetime import datetime
from uuid import uuid4

from app.models.job_models import NestingJob, utc_now
from app.schemas.nesting import (
    JobCreateResponse,
    JobStatus,
    JobStatusResponse,
    NestingJobCreateRequest,
    NestingJobResultResponse,
)
from app.services.nesting_service import NestingService


class JobService:
    def __init__(self) -> None:
        self._jobs: dict[str, NestingJob] = {}
        self._lock = asyncio.Lock()
        self._nesting = NestingService()

    async def create_job(self, payload: NestingJobCreateRequest) -> JobCreateResponse:
        job_id = str(uuid4())
        job = NestingJob(id=job_id, payload=payload)
        async with self._lock:
            self._jobs[job_id] = job
        asyncio.create_task(self._run_job(job_id))
        return JobCreateResponse(jobId=job_id, status=job.status, createdAt=job.created_at)

    async def get_job(self, job_id: str) -> NestingJob | None:
        async with self._lock:
            return self._jobs.get(job_id)

    async def get_status(self, job_id: str) -> JobStatusResponse | None:
        job = await self.get_job(job_id)
        if job is None:
            return None
        return JobStatusResponse(
            jobId=job.id,
            status=job.status,
            createdAt=job.created_at,
            startedAt=job.started_at,
            finishedAt=job.finished_at,
            error=job.error,
        )

    async def get_result(self, job_id: str) -> NestingJobResultResponse | None:
        job = await self.get_job(job_id)
        if job is None:
            return None
        return job.result

    async def _run_job(self, job_id: str) -> None:
        async with self._lock:
            job = self._jobs[job_id]
            job.status = JobStatus.running
            job.started_at = utc_now()
        try:
            result = await asyncio.to_thread(self._nesting.run, job.payload, job.id)
            async with self._lock:
                job.result = result
                job.status = JobStatus.completed
                job.finished_at = utc_now()
        except Exception as exc:  # noqa: BLE001
            async with self._lock:
                job.status = JobStatus.failed
                job.error = str(exc)
                job.finished_at = utc_now()


job_service = JobService()
