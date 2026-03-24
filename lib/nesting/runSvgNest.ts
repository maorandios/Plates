/**
 * Browser-only SVGNest (polygon / NFP) runner. Uses `svgnest-mjs` with a public worker URL
 * (`/nesting/nestWorker.js`). Spacing is applied inside SVGNest (Clipper offset); do not
 * pad bounding boxes for spacing.
 */

import { buildSvgnestInputSvg } from "./convertGeometryToSvgNest";
import type { NormalizedNestShape } from "./convertGeometryToSvgNest";
import type { EnginePlacement } from "./shelfNestEngine";

export interface RunSvgNestOptions {
  normalizedParts: NormalizedNestShape[];
  innerBinWidthMm: number;
  innerBinLengthMm: number;
  spacingMm: number;
  /** SvgNest setting: number of rotation steps over 360° (1 = 0° only, 4 = 90° steps). */
  rotations: number;
  timeBudgetMs: number;
  workerUrl: string;
  curveTolerance?: number;
}

export interface RunSvgNestResult {
  placed: EnginePlacement[];
  efficiency: number;
  numPlaced: number;
  numTotal: number;
  parseWarnings: string[];
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

const IMPORT_TIMEOUT_MS = 15_000;
const WAIT_GRACE_MS = 5_000;

function clampBudgetMs(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 20_000;
  return Math.min(120_000, Math.max(1_000, ms));
}

export async function runSvgNest(
  options: RunSvgNestOptions
): Promise<RunSvgNestResult> {
  const parseWarnings: string[] = [];

  if (typeof window === "undefined") {
    return {
      placed: [],
      efficiency: 0,
      numPlaced: 0,
      numTotal: options.normalizedParts.length,
      parseWarnings: ["SVGNest requires a browser environment (skip on server)."],
    };
  }

  const {
    normalizedParts,
    innerBinWidthMm,
    innerBinLengthMm,
    spacingMm,
    rotations,
    timeBudgetMs: rawBudget,
    workerUrl,
    curveTolerance = 0.05,
  } = options;
  const timeBudgetMs = clampBudgetMs(rawBudget);

  if (normalizedParts.length === 0) {
    return {
      placed: [],
      efficiency: 0,
      numPlaced: 0,
      numTotal: 0,
      parseWarnings: [],
    };
  }

  const svgStr = buildSvgnestInputSvg({
    innerBinWidthMm,
    innerBinLengthMm,
    partsInOrder: normalizedParts,
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
    numTotal: normalizedParts.length,
  };

  try {
    const SvgNestCtor = await Promise.race([
      import("svgnest-mjs").then((m) => m.default),
      new Promise<undefined>((resolve) =>
        window.setTimeout(() => resolve(undefined), IMPORT_TIMEOUT_MS)
      ),
    ]);
    if (SvgNestCtor === undefined) {
      parseWarnings.push(
        `svgnest-mjs failed to load within ${IMPORT_TIMEOUT_MS / 1000}s (bundler/network).`
      );
      return {
        placed: [],
        efficiency: 0,
        numPlaced: 0,
        numTotal: normalizedParts.length,
        parseWarnings,
      };
    }
    const nest = new SvgNestCtor();
    const svgRoot = nest.parseSvg(svgStr);
    const bin = svgRoot.querySelector("#svgnest-bin");
    if (!bin || !(bin instanceof SVGElement)) {
      parseWarnings.push("SVGNest input missing #svgnest-bin polygon.");
      return {
        placed: [],
        efficiency: 0,
        numPlaced: 0,
        numTotal: normalizedParts.length,
        parseWarnings,
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
      populationSize: 10,
      mutationRate: 10,
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
        best = {
          placed,
          efficiency: efficiency ?? 0,
          numPlaced: numPlaced ?? placed.length,
          numTotal: numTotal ?? normalizedParts.length,
        };
      }
    );

    if (!started) {
      nest.stop();
      parseWarnings.push("SVGNest start() returned false (invalid bin or empty parts).");
      return {
        placed: [],
        efficiency: 0,
        numPlaced: 0,
        numTotal: normalizedParts.length,
        parseWarnings,
      };
    }

    const hardCapMs = timeBudgetMs + WAIT_GRACE_MS;
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };

      let tickId = 0;
      const capId = window.setTimeout(() => {
        window.clearInterval(tickId);
        try {
          nest.stop();
        } catch {
          /* ignore */
        }
        parseWarnings.push(
          "SVGNest hard time cap — stopped early so nesting can finish."
        );
        finish();
      }, hardCapMs);

      const t0 = Date.now();
      tickId = window.setInterval(() => {
        if (Date.now() - t0 >= timeBudgetMs) {
          window.clearInterval(tickId);
          window.clearTimeout(capId);
          try {
            nest.stop();
          } catch {
            /* ignore */
          }
          window.setTimeout(finish, 280);
        }
      }, 100);
    });
  } catch (e) {
    parseWarnings.push(
      e instanceof Error ? e.message : "SVGNest threw an unexpected error."
    );
  }

  const ids = new Set(best.placed.map((p) => p.id));
  if (ids.size !== best.placed.length) {
    parseWarnings.push("Duplicate part instance ids in SVGNest SVG output.");
  }

  return {
    placed: best.placed,
    efficiency: best.efficiency,
    numPlaced: best.numPlaced,
    numTotal: best.numTotal,
    parseWarnings,
  };
}
