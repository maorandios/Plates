/**
 * Browser-only SVGNest (polygon / NFP) runner. Input SVG uses **nestingOuter** per part
 * (typically spacing-offset geometry from `buildSvgnestPartInputs`); set `spacingMm: 0` in
 * options so SVGNest does not apply a second offset. Placements map back to **original**
 * `shape.outer` via `sheetPlacementFromEnginePlacement`.
 *
 * @see lib/nesting/SVGNEST_PIPELINE.md
 */

import { buildSvgnestInputSvg } from "./convertGeometryToSvgNest";
import type { SvgnestPartInput } from "./convertGeometryToSvgNest";
import { SvgNest } from "./loadSvgNest";
import type { EnginePlacement } from "./shelfNestEngine";

/** Early exit so SVGNest does not burn the full wall-clock budget every sheet. */
export interface SvgNestEarlyStopConfig {
  enabled: boolean;
  stopWhenAllPlaced: boolean;
  plateauMs: number;
  minUtilizationImprovement: number;
  /** Only evaluate utilization plateau after this much runtime (ms). */
  minRunMsBeforePlateauCheck: number;
}

export interface RunSvgNestOptions {
  /** Pre-built nesting polygons (offset outers / bbox fallback) + original shapes for metrics. */
  parts: SvgnestPartInput[];
  innerBinWidthMm: number;
  innerBinLengthMm: number;
  /**
   * Passed to SVGNest config. Use **0** when spacing is already baked into `parts[].nestingOuter`
   * (avoids double ½-spacing offset inside svgnest-mjs).
   */
  spacingMm: number;
  /** SvgNest setting: number of rotation steps over 360° (1 = 0° only, 4 = 90° steps). */
  rotations: number;
  timeBudgetMs: number;
  workerUrl: string;
  curveTolerance?: number;
  populationSize?: number;
  mutationRate?: number;
  earlyStop?: SvgNestEarlyStopConfig;
  /** Extra ms after `timeBudgetMs` before hard kill (worker cleanup). */
  waitGraceMs?: number;
}

export interface RunSvgNestResult {
  placed: EnginePlacement[];
  efficiency: number;
  numPlaced: number;
  numTotal: number;
  parseWarnings: string[];
  /** Wall time for this SVGNest session (ms). */
  actualRuntimeMs?: number;
  earlyStopReason?: "all_parts_placed" | "utilization_plateau" | "time_budget" | "hard_cap";
}

function parsePartGroupTransform(
  attr: string | null
): { x: number; y: number; rotation: number } | null {
  if (!attr) return null;
  const t = attr.trim();
  const tm = t.match(
    /translate\(\s*([-0-9.eE+]+)\s*(?:,\s*|\s+)\s*([-0-9.eE+]+)\s*\)/
  );
  if (!tm) return null;
  const x = parseFloat(tm[1]!);
  const y = parseFloat(tm[2]!);
  const rm = t.match(/rotate\(\s*([-0-9.eE+]+)\s*\)/);
  const rotation = rm ? parseFloat(rm[1]!) : 0;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(rotation)) {
    return null;
  }
  return { x, y, rotation };
}

function findInstanceId(group: Element): string | null {
  const tagged = group.querySelector("[data-instance-id]");
  return tagged?.getAttribute("data-instance-id")?.trim() || null;
}

/** Undo per-part X strip in `buildSvgnestInputSvg` (see svgnest-mjs getParts / toTree). */
function applySvgnestStripDxToPlacements(
  placed: EnginePlacement[],
  stripDxByInstanceId: Record<string, number>
): EnginePlacement[] {
  return placed.map((p) => {
    const dx = stripDxByInstanceId[p.id];
    if (dx === undefined || dx === 0) return p;
    const rad = (p.rotate * Math.PI) / 180;
    return {
      ...p,
      translate: {
        x: p.translate.x + dx * Math.cos(rad),
        y: p.translate.y + dx * Math.sin(rad),
      },
    };
  });
}

/**
 * Extracts placements from SVGNest `applyPlacement` output: one `<svg>` with a `g.bin` and
 * part groups `translate(x y) rotate(r)` + nested polygon carrying `data-instance-id`.
 */
export function parsePlacementsFromSvgnestSvg(svgRoot: SVGElement): EnginePlacement[] {
  const out: EnginePlacement[] = [];
  for (const node of svgRoot.children) {
    if (node.nodeName.toLowerCase() !== "g") continue;
    const g = node as SVGGElement;
    if (g.classList.contains("bin")) continue;
    const id = findInstanceId(g);
    if (!id) continue;
    const parsed = parsePartGroupTransform(g.getAttribute("transform"));
    if (!parsed) continue;
    out.push({
      id,
      translate: { x: parsed.x, y: parsed.y },
      rotate: parsed.rotation,
    });
  }
  return out;
}

const DEFAULT_WAIT_GRACE_MS = 2_500;

function clampBudgetMs(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 20_000;
  return Math.min(120_000, Math.max(800, ms));
}

export async function runSvgNest(
  options: RunSvgNestOptions
): Promise<RunSvgNestResult> {
  const parseWarnings: string[] = [];
  const wallStart = typeof performance !== "undefined" ? performance.now() : Date.now();

  if (typeof window === "undefined") {
    return {
      placed: [],
      efficiency: 0,
      numPlaced: 0,
      numTotal: options.parts?.length ?? 0,
      parseWarnings: ["SVGNest requires a browser environment (skip on server)."],
    };
  }

  const {
    parts: svgnestParts,
    innerBinWidthMm,
    innerBinLengthMm,
    spacingMm,
    rotations,
    timeBudgetMs: rawBudget,
    workerUrl,
    curveTolerance = 0.05,
    populationSize = 10,
    mutationRate = 10,
    earlyStop,
    waitGraceMs = DEFAULT_WAIT_GRACE_MS,
  } = options;
  const timeBudgetMs = clampBudgetMs(rawBudget);

  if (svgnestParts.length === 0) {
    return {
      placed: [],
      efficiency: 0,
      numPlaced: 0,
      numTotal: 0,
      parseWarnings: [],
      actualRuntimeMs: 0,
    };
  }

  const { svg: svgStr, stripDxByInstanceId } = buildSvgnestInputSvg({
    innerBinWidthMm,
    innerBinLengthMm,
    parts: svgnestParts,
  });

  let best: {
    placed: EnginePlacement[];
    efficiency: number;
    numPlaced: number;
    numTotal: number;
  } = {
    placed: [],
    efficiency: 0,
    numPlaced: 0,
    numTotal: svgnestParts.length,
  };

  let earlyStopReason: RunSvgNestResult["earlyStopReason"];
  const track = {
    bestUtil: 0,
    lastImproveMs: Date.now(),
  };

  try {
    const nest = new SvgNest();
    const svgRoot = nest.parseSvg(svgStr);
    const bin = svgRoot.querySelector("#svgnest-bin");
    if (!bin || !(bin instanceof SVGElement)) {
      parseWarnings.push("SVGNest input missing #svgnest-bin polygon.");
      return {
        placed: [],
        efficiency: 0,
        numPlaced: 0,
        numTotal: svgnestParts.length,
        parseWarnings,
        actualRuntimeMs: Math.round(
          (typeof performance !== "undefined" ? performance.now() : Date.now()) -
            wallStart
        ),
      };
    }

    nest.setBin(bin);
    nest.config({
      spacing: spacingMm,
      rotations,
      workerUrl,
      useHoles: false,
      exploreConcave: false,
      curveTolerance,
      populationSize,
      mutationRate,
    });

    const started = nest.start(
      () => {},
      (
        svgList: SVGElement[] | null,
        efficiency?: number,
        numPlaced?: number,
        numTotal?: number
      ) => {
        if (!svgList?.[0]) return;
        const placed = parsePlacementsFromSvgnestSvg(svgList[0]);
        if (placed.length === 0) return;
        const eff = efficiency ?? 0;
        const nu = numPlaced ?? placed.length;
        const nt = numTotal ?? svgnestParts.length;
        best = {
          placed,
          efficiency: eff,
          numPlaced: nu,
          numTotal: nt,
        };
        const minImp = earlyStop?.minUtilizationImprovement ?? 0.004;
        if (eff > track.bestUtil + minImp) {
          track.bestUtil = eff;
          track.lastImproveMs = Date.now();
        }
      }
    );

    if (!started) {
      nest.stop();
      parseWarnings.push("SVGNest start() returned false (invalid bin or empty parts).");
      return {
        placed: [],
        efficiency: 0,
        numPlaced: 0,
        numTotal: svgnestParts.length,
        parseWarnings,
        actualRuntimeMs: Math.round(
          (typeof performance !== "undefined" ? performance.now() : Date.now()) -
            wallStart
        ),
      };
    }

    const hardCapMs = timeBudgetMs + waitGraceMs;
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };

      let tickId: number | undefined;
      let capId: number | undefined;
      let stopped = false;

      const stopNest = (reason: RunSvgNestResult["earlyStopReason"], warnHardCap: boolean) => {
        if (stopped) return;
        stopped = true;
        if (earlyStopReason === undefined) earlyStopReason = reason;
        if (tickId !== undefined) window.clearInterval(tickId);
        if (capId !== undefined) window.clearTimeout(capId);
        try {
          nest.stop();
        } catch {
          /* ignore */
        }
        if (warnHardCap) {
          parseWarnings.push(
            "SVGNest hard time cap — stopped early so nesting can finish."
          );
        }
        window.setTimeout(finish, 120);
      };

      capId = window.setTimeout(() => {
        stopNest("hard_cap", true);
      }, hardCapMs) as unknown as number;

      const t0 = Date.now();
      tickId = window.setInterval(() => {
        const elapsed = Date.now() - t0;
        const es = earlyStop;

        if (es?.enabled && es.stopWhenAllPlaced) {
          const nt = best.numTotal || svgnestParts.length;
          if (nt > 0 && best.numPlaced >= nt && best.placed.length > 0) {
            stopNest("all_parts_placed", false);
            return;
          }
        }

        if (
          es?.enabled &&
          elapsed >= (es.minRunMsBeforePlateauCheck ?? 2800) &&
          track.bestUtil >= 0.03 &&
          Date.now() - track.lastImproveMs >= es.plateauMs
        ) {
          stopNest("utilization_plateau", false);
          return;
        }

        if (elapsed >= timeBudgetMs) {
          stopNest("time_budget", false);
          return;
        }
      }, 90) as unknown as number;
    });
  } catch (e) {
    parseWarnings.push(
      e instanceof Error ? e.message : "SVGNest threw an unexpected error."
    );
  }

  const placedCorrected = applySvgnestStripDxToPlacements(
    best.placed,
    stripDxByInstanceId
  );

  const ids = new Set(placedCorrected.map((p) => p.id));
  if (ids.size !== placedCorrected.length) {
    parseWarnings.push("Duplicate part instance ids in SVGNest SVG output.");
  }

  const actualRuntimeMs = Math.round(
    (typeof performance !== "undefined" ? performance.now() : Date.now()) - wallStart
  );

  return {
    placed: placedCorrected,
    efficiency: best.efficiency,
    numPlaced: best.numPlaced,
    numTotal: best.numTotal,
    parseWarnings,
    actualRuntimeMs,
    earlyStopReason,
  };
}
