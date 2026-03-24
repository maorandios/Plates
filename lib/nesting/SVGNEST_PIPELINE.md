# SVGNest nesting pipeline (polygon-first)

This document describes how plate geometry flows from batch instances into SVGNest and back into `SheetPlacement` rows. The batch → thickness → stock → quantity expansion pipeline is unchanged; only the **per-sheet nesting stage** is described here.

## 1. Instances and normalization

- **Quantity** is expanded earlier (`prepareNestingInputs` / `expandPartInstances`): each physical copy is a `NestablePartInstance` with its own `partInstanceId`.
- **`normalizeShapeForNest(instance)`** (`convertGeometryToSvgNest.ts`) shifts part + holes so the outer ring’s axis-aligned minimum is at `(0,0)` in **inner nesting coordinates**. Output: `NormalizedNestShape` with `outer` (cleaned plate outer) and `holes` (for display/metrics only; not sent as SVGNest holes).

## 2. Spacing footprint (pre-offset), not SVGNest `spacing`

- **`buildSvgnestPartInputs`** (`buildSvgnestPartInputs.ts`) calls **`adaptNormalizedShapesForPolygonPlacement`** (`runPolygonAwarePlacement.ts`), which:
  - Validates/closed-ring **`preparePolygonFootprint`** on `outer`.
  - Builds **`createSpacingFootprint`** = Clipper **outward** offset by **`spacingMm / 2`** (half-gap rule between parts).
  - On failure for **one** instance only: **`nestingFootprintLocal`** becomes an axis-aligned rectangle from the outer AABB (`bbox_fallback`); other parts stay polygon.
- Result: **`SvgnestPartInput`**: `{ shape, nestingOuter, geometrySource }` where `shape.outer`/`holes` are **original** display geometry and `nestingOuter` is what SVGNest nests.

## 3. SVG input

- **`buildSvgnestInputSvg`** (`convertGeometryToSvgNest.ts`) writes:
  - Bin: rectangle **`0,0` → `(innerWidthMm, innerLengthMm)`** where inner dimensions come from **`innerBinDimensionsMm(stockWidth, stockLength, edgeMarginMm)`** (`resolveBinGeometry.ts`).
  - Each part: `<polygon data-instance-id="…" data-geometry-source="polygon|bbox_fallback" points="…">` using **`nestingOuter`** only (SVG-compatible `points` attribute).

## 4. SVGNest execution

- **`runSvgNest`** (`runSvgNest.ts`) parses that SVG via `svgnest-mjs`, sets **`config.spacing: 0`** because spacing is **already** in `nestingOuter`. (Non-zero `spacing` would apply an additional ½·spacing offset inside the library.)
- **`runNestingCandidates`** (`runNestingCandidates.ts`) runs several **part orderings** (area, max side, perimeter, shuffle, …), each with a time slice, and keeps the best layout by placed count / utilization.

## 5. Placement mapping → viewer

- SVGNest output is parsed to **`EnginePlacement`**: `{ id: partInstanceId, translate: {x,y}, rotate }` relative to the **same local frame** as the normalized outer (origin at bbox min).
- **`generatedSheetFromBin`** (`runAutoNesting.ts`) uses **`shapeById`** keyed by `partInstanceId` on **`NormalizedNestShape`** (original `outer` / `holes`).
- **`sheetPlacementFromEnginePlacement`** (`mapPlacementResults.ts`) applies **`applyPlacementToRing(shape.outer, rot, tx, ty)`** and the same for holes — i.e. **original** geometry, not `nestingOuter`. Optional clamp keeps contours inside the inner bin for rendering.

## 6. Debug metadata

`NestingEngineDebugMeta` (`types/nestingResults.ts`) includes:

- **`svgnestSpacingInConfigMm`**: `0` when using pre-offset polygons.
- **`svgnestInputPolygonCount` / `svgnestInputBboxFallbackCount`**: how many instances used true offset polygons vs bbox in the **SVGNest SVG**.
- **`svgnestBboxFallbackInstanceIds`**: instance ids that used bbox fallback for SVG input only.

Shelf fallback uses separate shelf footprint stats (`polygonPartsCount`, `fallbackPartIds`, etc.) when SVGNest does not place parts.
