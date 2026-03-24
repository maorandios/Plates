# Server-Side Nesting Architecture

## 1) API Structure

- `POST /nest/jobs`  
  Accepts a nesting job payload and returns `jobId` immediately (`202 Accepted`).
- `GET /nest/jobs/{jobId}`  
  Returns async job status: `pending | running | completed | failed`.
- `GET /nest/jobs/{jobId}/result`  
  Returns final nesting result only when job is `completed`.

## 2) Job Schema

Defined in `app/schemas/nesting.py`:

- Request: `NestingJobCreateRequest`
  - `batchId`, `cuttingMethod`, `runMode`
  - `thicknessGroups[]`
    - `thicknessMm`
    - `resolvedRules { spacingMm, edgeMarginMm, allowRotation, rotationMode }`
    - `stockSheets[]`
    - `parts[]` with original geometry and metadata
- Response:
  - `JobCreateResponse`
  - `JobStatusResponse`
  - `NestingJobResultResponse`

## 3) Service Architecture

- `app/services/job_service.py`  
  In-memory async job manager and background execution.
- `app/services/nesting_service.py`  
  Orchestrates thickness-group runs, stock usage, summary metrics.
- `app/services/geometry_service.py`  
  Validates, normalizes, simplifies, offsets, expands quantity into instances.
- `app/services/placement_service.py`  
  Multi-pass candidate search + scoring-based best placement selection.
- `app/services/compaction_service.py`  
  Iterative left/down compaction passes.
- `app/services/cavity_fill_service.py`  
  Fits smaller leftovers into new gaps after compaction.
- `app/services/scoring_service.py`  
  Candidate scoring and quality heuristics.

## 4) Geometry Preprocessing

For each part:

1. Validate polygon from `outerContour` + `innerContours`
2. Repair invalid polygons where possible
3. Normalize to origin for stable transforms
4. Preserve original local geometry for rendering outputs
5. Create separate nesting footprint (simplify + offset)

`geometryStatus = error` is skipped and reported; run continues.

## 5) Spacing and Edge Margins

- Spacing:
  - Applied as outward polygon offset (`spacing / 2`) on the nesting footprint.
  - Collision checks use this offset footprint.
- Edge margin:
  - Converted into reduced usable bin rectangle:
    - `usableWidth = width - 2 * edgeMargin`
    - `usableHeight = height - 2 * edgeMargin`

## 6) Candidate Placement / Scoring

Candidate generation:

- anchor x/y from walls and placed-shape bounds
- evaluate multiple rotations per rules/mode
- perform geometric validity checks against bin and placed polygons

Scoring (lower is better):

- lower envelope Y first, then X
- penalize void/envelope growth
- reward wall and part boundary contact

The engine chooses the best valid candidate; it does not stop at first fit.

## 7) Compaction and Cavity Fill

- Compaction:
  - Iteratively push each placed part left, then down, while valid.
  - Repeat for bounded passes until stable.
- Cavity fill:
  - Re-attempt remaining parts in area-ascending order into newly created pockets.
  - Compact again after cavity pass.

## 8) Quick vs Optimize Modes

`quick`:

- larger simplification tolerance
- fewer candidate axes and fewer deep retries
- lower per-thickness runtime cap

`optimize`:

- tighter simplification tolerance
- additional ordering pass(es)
- broader candidate exploration
- higher bounded runtime per thickness

## 9) Frontend Result Compatibility

Result objects include:

- run summary: sheet/utilization/waste/placed/unplaced
- per-thickness grouped sheets
- per-sheet placements containing original geometry (`outerContour` + `innerContours`)
- `debugMetadata` for runtime tuning and diagnostics

TypeScript client adapters:

- `lib/nesting/serverNestingClient.ts`
- `lib/nesting/mapServerResultToRun.ts`

## 10) Frontend Integration Needed

Minimal UI workflow change:

1. Build server payload from existing batch/stock/rules/part data.
2. Call `POST /nest/jobs`.
3. Poll `GET /nest/jobs/{jobId}` while status is `pending/running`.
4. When `completed`, fetch `GET /nest/jobs/{jobId}/result`.
5. Map result into existing `NestingRun` flow and route to results page.

No Python-side UI logic is introduced.
