"""Process-wide serial queue for memory intensive AI work."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, asdict
import threading
import uuid
from typing import Callable


@dataclass
class Job:
    id: str
    state: str = "queued"
    progress: float = 0.0
    provider: str | None = None
    message: str = "Waiting for an AI worker"
    cancel_requested: bool = False


class Scheduler:
    def __init__(self):
        self._pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="lumetta-ai")
        self._jobs: dict[str, Job] = {}
        self._lock = threading.RLock()

    def submit(self, job: Callable[[Job], None]) -> str:
        record = Job(uuid.uuid4().hex)
        with self._lock:
            self._jobs[record.id] = record
        self._pool.submit(self._run, record, job)
        return record.id

    def _run(self, record: Job, fn: Callable[[Job], None]):
        with self._lock:
            if record.cancel_requested:
                record.state, record.message = "cancelled", "Cancelled"
                return
            record.state, record.message = "running", "AI task running"
        try:
            fn(record)
            with self._lock:
                if record.cancel_requested:
                    record.state, record.message = "cancelled", "Cancelled"
                else:
                    record.state, record.progress, record.message = "done", 1.0, "Complete"
        except Exception as exc:
            with self._lock:
                record.state, record.message = "error", str(exc)

    def status(self, job_id: str | None = None):
        with self._lock:
            if job_id:
                job = self._jobs.get(job_id)
                return asdict(job) if job else None
            return [asdict(j) for j in self._jobs.values()]

    def cancel(self, job_id: str) -> bool:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job or job.state not in ("queued", "running"):
                return False
            job.cancel_requested = True
            job.message = "Cancellation requested"
            return True


scheduler = Scheduler()
