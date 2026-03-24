# PLATE Server-Side Nesting Service

Server-side Python nesting engine for heavy geometry-aware plate nesting.

## What This Service Does

- Accepts async nesting jobs (`POST /nest/jobs`)
- Runs shape-aware polygon nesting off the browser thread
- Applies spacing via polygon offset footprints (not AABB spacing)
- Applies edge margins via reduced usable bin
- Uses multi-pass candidate placement + scoring
- Performs compaction and cavity fill retries
- Returns frontend-friendly sheet/placement results

## Stack

- FastAPI + Uvicorn
- Pydantic v2
- Shapely (polygon operations/collision checks)
- pyclipper (offset footprint generation)

## Run Locally

```bash
cd nesting-service
python -m venv .venv
. .venv/Scripts/activate   # Windows PowerShell: .\.venv\Scripts\Activate.ps1
pip install -e .
uvicorn app.main:app --reload --port 8010
```

## Endpoints

- `POST /nest/jobs` -> create async job, returns `jobId`
- `GET /nest/jobs/{jobId}` -> status (`pending|running|completed|failed`)
- `GET /nest/jobs/{jobId}/result` -> completed nesting result payload

## Payload Contract

See `app/schemas/nesting.py` and `samples/sample_job.json`.

## Frontend Integration (minimal changes)

1. Build a payload from existing batch/thickness/stock/part data
2. `POST` to this service instead of calling browser `runAutoNesting`
3. Poll job status every 1-2 seconds
4. Fetch `/result` when completed
5. Map response to existing result viewer route

No UI rebuilding is required.
