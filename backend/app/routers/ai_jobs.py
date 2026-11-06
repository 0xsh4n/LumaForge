"""Inspection and cancellation endpoints for long running local AI work."""
from fastapi import APIRouter, HTTPException

from ..imaging.scheduler import scheduler

router = APIRouter(prefix="/api/ai/jobs", tags=["ai"])


@router.get("")
def list_jobs():
    return {"jobs": scheduler.status()}


@router.get("/{job_id}")
def get_job(job_id: str):
    job = scheduler.status(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="AI job not found")
    return job


@router.post("/{job_id}/cancel")
def cancel_job(job_id: str):
    if not scheduler.cancel(job_id):
        raise HTTPException(status_code=409, detail="AI job is not active")
    return scheduler.status(job_id)
