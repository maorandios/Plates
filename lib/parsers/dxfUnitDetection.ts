import type { DxfDetectedDrawingUnit } from "@/types";

/**
 * DXF header values are typically `IPoint | number` from dxf-parser.
 */
export type DxfHeaderRecord = Record<string, { x?: number; y?: number; z?: number } | number>;

export interface DxfUnitDetectionResult {
  detectedUnit: DxfDetectedDrawingUnit;
  displayLabel: string;
  source: "header" | "inferred" | "unknown";
}

const UNKNOWN: DxfUnitDetectionResult = {
  detectedUnit: "unknown",
  displayLabel: "Unknown",
  source: "unknown",
};

function num(header: DxfHeaderRecord, key: string): number | undefined {
  const v = header[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}

/**
 * Find $INSUNITS numeric value — try common keys and fuzzy match (exporters vary).
 */
function findInsunitsInHeader(header: DxfHeaderRecord): number | undefined {
  const directKeys = ["$INSUNITS", "INSUNITS", "$insunits", "insunits"];
  for (const k of directKeys) {
    const n = num(header, k);
    if (n !== undefined) return Math.trunc(n);
  }
  for (const key of Object.keys(header)) {
    const bare = key.replace(/^\$/, "").trim();
    if (/^insunits$/i.test(bare)) {
      const v = header[key];
      if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
    }
  }
  return undefined;
}

/**
 * Scan raw ASCII DXF for `$INSUNITS` then the next group 70 value (some files omit
 * HEADER from parser expectations or use odd whitespace).
 */
export function extractInsunitsFromRawDxf(content: string): number | undefined {
  if (!content || content.length < 20) return undefined;
  const normalized = content.replace(/\r\n/g, "\n");
  const idx = normalized.search(/\$INSUNITS/i);
  if (idx < 0) return undefined;
  const slice = normalized.slice(idx, idx + 1200);
  const lines = slice.split("\n").map((l) => l.trim());
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i] === "70") {
      const v = Number.parseInt(lines[i + 1], 10);
      if (Number.isFinite(v)) return v;
    }
    const sameLine = lines[i].match(/^70\s+(-?\d+)\s*$/);
    if (sameLine) {
      const v = Number.parseInt(sameLine[1], 10);
      if (Number.isFinite(v)) return v;
    }
  }
  return undefined;
}

/**
 * AutoCAD $INSUNITS (header group 70). Official mapping (not all map to our mm/in/cm/m/ft union).
 * Ref: Autodesk DXF reference — 4 = mm, 5 = cm, 6 = m, 1 = in, 2 = ft.
 * Note: code 5 is centimeters in AutoCAD; micrometers are code 13 (microns).
 */
function resultFromInsunitsCode(code: number): DxfUnitDetectionResult {
  const c = Math.trunc(code);

  switch (c) {
    case 0:
      return {
        detectedUnit: "unitless",
        displayLabel: "Unitless",
        source: "header",
      };
    case 1:
      return { detectedUnit: "in", displayLabel: "Inches", source: "header" };
    case 2:
      return { detectedUnit: "ft", displayLabel: "Feet", source: "header" };
    case 4:
      return {
        detectedUnit: "mm",
        displayLabel: "Millimeters",
        source: "header",
      };
    case 5:
      return {
        detectedUnit: "cm",
        displayLabel: "Centimeters",
        source: "header",
      };
    case 6:
      return { detectedUnit: "m", displayLabel: "Meters", source: "header" };
    case 3:
      return { detectedUnit: "unknown", displayLabel: "Miles", source: "header" };
    case 7:
      return {
        detectedUnit: "unknown",
        displayLabel: "Kilometers",
        source: "header",
      };
    case 8:
      return {
        detectedUnit: "unknown",
        displayLabel: "Microinches",
        source: "header",
      };
    case 9:
      return { detectedUnit: "unknown", displayLabel: "Mils", source: "header" };
    case 10:
      return { detectedUnit: "unknown", displayLabel: "Yards", source: "header" };
    case 11:
      return {
        detectedUnit: "unknown",
        displayLabel: "Angstroms",
        source: "header",
      };
    case 12:
      return {
        detectedUnit: "unknown",
        displayLabel: "Nanometers",
        source: "header",
      };
    case 13:
      return {
        detectedUnit: "unknown",
        displayLabel: "Microns",
        source: "header",
      };
    case 14:
      return {
        detectedUnit: "unknown",
        displayLabel: "Decimeters",
        source: "header",
      };
    default:
      if (c >= 15 && c <= 20) {
        return {
          detectedUnit: "unknown",
          displayLabel: `INSUNITS (${c})`,
          source: "header",
        };
      }
      return UNKNOWN;
  }
}

function numMeasurement(header: DxfHeaderRecord): number | undefined {
  return (
    num(header, "$MEASUREMENT") ??
    num(header, "MEASUREMENT") ??
    num(header, "$measurement")
  );
}

/**
 * Read drawing units from parsed DXF `header`, with raw-file fallback.
 * Internal geometry normalization unchanged — display / confidence only.
 */
export function detectDxfDrawingUnits(
  header: DxfHeaderRecord | null | undefined,
  rawDxfContent?: string | null
): DxfUnitDetectionResult {
  if (header && typeof header === "object") {
    const ins = findInsunitsInHeader(header);
    if (ins !== undefined) {
      const r = resultFromInsunitsCode(ins);
      const isPureUnknown =
        r.detectedUnit === "unknown" && r.displayLabel === "Unknown";
      if (!isPureUnknown) return r;
    }

    const meas = numMeasurement(header);
    if (meas === 1) {
      return {
        detectedUnit: "mm",
        displayLabel: "Millimeters",
        source: "inferred",
      };
    }
    if (meas === 0) {
      return {
        detectedUnit: "in",
        displayLabel: "Inches",
        source: "inferred",
      };
    }
  }

  if (rawDxfContent) {
    const rawIns = extractInsunitsFromRawDxf(rawDxfContent);
    if (rawIns !== undefined) {
      const r = resultFromInsunitsCode(rawIns);
      const isPureUnknown =
        r.detectedUnit === "unknown" && r.displayLabel === "Unknown";
      if (!isPureUnknown) return r;
    }
  }

  return UNKNOWN;
}
