from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.schemas.nesting import (
    JobCreateResponse,
    JobStatusResponse,
    NestingJobCreateRequest,
    NestingJobResultResponse,
)
from app.services.job_service import job_service

router = APIRouter()


@router.post("/jobs", response_model=JobCreateResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_nesting_job(payload: NestingJobCreateRequest) -> JobCreateResponse:
    return await job_service.create_job(payload)


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_nesting_job(job_id: str) -> JobStatusResponse:
    item = await job_service.get_status(job_id)
    if item is None:
        raise HTTPException(status_code=404, detail="job_not_found")
    return item


@router.get("/jobs/{job_id}/result", response_model=NestingJobResultResponse)
async def get_nesting_job_result(job_id: str) -> NestingJobResultResponse:
    status_item = await job_service.get_status(job_id)
    if status_item is None:
        raise HTTPException(status_code=404, detail="job_not_found")
    if status_item.status.value in {"pending", "running"}:
        raise HTTPException(status_code=409, detail="job_not_completed")
    if status_item.status.value == "failed":
        raise HTTPException(status_code=500, detail=status_item.error or "job_failed")
    result = await job_service.get_result(job_id)
    if result is None:
        raise HTTPException(status_code=404, detail="result_not_found")
    return result
