import type {
  DxfPartGeometry,
  ExcelRow,
  Part,
  MatchStatus,
  ProcessedGeometry,
  GeometryCleanupStatus,
} from "@/types";
import type { Client, UploadedFile } from "@/types";
import { nanoid } from "@/lib/utils/nanoid";

// ─── Name normalization ───────────────────────────────────────────────────────

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[_\-\s]+/g, " ")       // unify separators
    .replace(/[^a-z0-9 ]/g, "")      // remove special chars
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize an Excel cell or upload filename that refers to a DXF/drawing file
 * (basename, optional .dxf/.dwg) for comparison with {@link normalizeName}.
 */
export function normalizeDxfFileHint(value: string): string {
  const s = String(value ?? "").trim();
  if (!s) return "";
  const base = s.split(/[/\\]/).pop() ?? s;
  const noExt = base.replace(/\.(dxf|dwg)$/i, "");
  return normalizeName(noExt);
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  // Jaccard similarity on character bigrams
  const bigrams = (s: string): Set<string> => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };

  const setA = bigrams(a);
  const setB = bigrams(b);
  const intersection = new Set([...setA].filter((g) => setB.has(g)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

const MATCH_THRESHOLD = 0.7;
const REVIEW_THRESHOLD = 0.4;
/** Same name-similarity score for two rows → ambiguous pairing */
const SCORE_TIE_EPS = 0.001;
/** Extra weight when Excel DXF-filename column matches this upload (breaks ties, never stored as “score”) */
const DXF_HINT_BONUS = 0.22;

function computeMatchStatus(score: number): MatchStatus {
  if (score >= MATCH_THRESHOLD) return "matched";
  if (score >= REVIEW_THRESHOLD) return "needs_review";
  return "unmatched";
}

function cleanupStatusFallback(geo: ProcessedGeometry): GeometryCleanupStatus {
  const c = geo.preparation?.cleaned?.cleanupStatus;
  if (c) return c;
  if (geo.status === "valid") return "ready";
  if (geo.status === "warning") return "warning";
  return "error";
}

function partGeometryPrepFields(geo: ProcessedGeometry | null | undefined) {
  if (!geo) return {};
  const prep = geo.preparation?.cleaned;
  let geometryContourSummary: string | undefined;
  if (geo.outer.length > 0) {
    geometryContourSummary = `1 outer · ${geo.holes.length} hole${geo.holes.length === 1 ? "" : "s"}`;
  } else if (prep?.stats && prep.stats.closedLoopCount > 0) {
    geometryContourSummary = `${prep.stats.closedLoopCount} loop(s), no valid outer`;
  } else if (prep?.stats && prep.stats.rawContourCount > 0) {
    geometryContourSummary = "No closed profile";
  }

  const messages = [
    ...(prep?.warnings ?? []),
    ...(prep?.errors ?? []),
  ];
  if (geo.statusMessage) messages.push(geo.statusMessage);

  return {
    geometryCleanupStatus: cleanupStatusFallback(geo),
    geometryContourSummary,
    geometryPrepMessages: messages.length > 0 ? [...new Set(messages)] : undefined,
  };
}

// ─── Main matcher ─────────────────────────────────────────────────────────────

export interface MatcherInput {
  batchId: string;
  clients: Client[];
  files: UploadedFile[];
  excelRows: ExcelRow[];
  dxfGeometries: DxfPartGeometry[];
}

export function buildUnifiedParts({
  batchId,
  clients,
  files,
  excelRows,
  dxfGeometries,
}: MatcherInput): Part[] {
  const parts: Part[] = [];

  for (const client of clients) {
    const clientFiles = files.filter((f) => f.clientId === client.id);
    const clientDxfs = dxfGeometries.filter((g) => g.clientId === client.id);
    const clientExcelRows = excelRows.filter((r) => r.clientId === client.id);

    const usedExcelRowIds = new Set<string>();
    const usedDxfFileIds = new Set<string>();

    // ── Pass 1: Match DXF files to Excel rows ────────────────────────────────
    for (const dxf of clientDxfs) {
      const dxfNorm = normalizeName(dxf.guessedPartName);
      const dxfFile = clientFiles.find((f) => f.id === dxf.fileId);
      const dxfStemNorm = dxfFile
        ? normalizeDxfFileHint(dxfFile.name)
        : "";

      const availableRows = clientExcelRows.filter(
        (r) => !usedExcelRowIds.has(r.id)
      );

      let bestAug = -1;
      let secondAug = -1;
      let bestNameScore = 0;
      let secondNameScore = 0;
      let bestRow: ExcelRow | null = null;
      let secondRow: ExcelRow | null = null;

      for (const row of availableRows) {
        const rowNorm = normalizeName(row.partName);
        const nameScore = similarity(dxfNorm, rowNorm);
        const hintOk =
          dxfStemNorm.length > 0 &&
          row.dxfFileHintNormalized === dxfStemNorm;
        const aug = hintOk ? nameScore + DXF_HINT_BONUS : nameScore;

        if (aug > bestAug) {
          secondAug = bestAug;
          secondNameScore = bestNameScore;
          secondRow = bestRow;
          bestAug = aug;
          bestNameScore = nameScore;
          bestRow = row;
        } else if (aug > secondAug) {
          secondAug = aug;
          secondNameScore = nameScore;
          secondRow = row;
        }
      }

      let matchStatus = computeMatchStatus(bestNameScore);
      if (
        bestRow &&
        secondRow &&
        secondNameScore >= REVIEW_THRESHOLD &&
        Math.abs(bestNameScore - secondNameScore) < SCORE_TIE_EPS &&
        normalizeName(bestRow.partName) === normalizeName(secondRow.partName)
      ) {
        matchStatus = "needs_review";
      }

      // Extract geometry metrics from processed DXF
      const geo = dxf.processedGeometry;
      const geomFields = geo
        ? {
            dxfArea: geo.area > 0 ? geo.area : undefined,
            dxfPerimeter: geo.perimeter > 0 ? geo.perimeter : undefined,
            geometryStatus: geo.status,
            dxfWidthMm:
              geo.boundingBox.width > 0 ? geo.boundingBox.width : undefined,
            dxfLengthMm:
              geo.boundingBox.height > 0 ? geo.boundingBox.height : undefined,
            ...partGeometryPrepFields(geo),
          }
        : {};

      const partSource: "upload" | "built" =
        dxfFile?.sourceKind === "built" ? "built" : "upload";
      const builtPlateSpec =
        dxfFile?.sourceKind === "built" ? dxfFile.builtPlateSpec : undefined;

      if (bestRow && matchStatus !== "unmatched") {
        usedExcelRowIds.add(bestRow.id);
        usedDxfFileIds.add(dxf.fileId);

        parts.push({
          id: nanoid(),
          batchId,
          clientId: client.id,
          clientCode: client.shortCode,
          clientName: client.fullName,
          partName: bestRow.partName || dxf.guessedPartName,
          quantity: bestRow.quantity,
          thickness: bestRow.thickness,
          material:
            dxf.materialGrade?.trim() || bestRow.material?.trim() || undefined,
          width: bestRow.width,
          length: bestRow.length,
          area: bestRow.area,
          weight: bestRow.weight,
          totalWeight: bestRow.totalWeight,
          dxfFileId: dxf.fileId,
          dxfFileName: dxfFile?.name,
          dxfStatus: "present",
          excelRowId: bestRow.id,
          excelStatus: "present",
          matchStatus,
          partSource,
          builtPlateSpec,
          ...geomFields,
        });
      } else {
        // DXF with no Excel match
        usedDxfFileIds.add(dxf.fileId);
        parts.push({
          id: nanoid(),
          batchId,
          clientId: client.id,
          clientCode: client.shortCode,
          clientName: client.fullName,
          partName: dxf.guessedPartName,
          material: dxf.materialGrade?.trim() || undefined,
          dxfFileId: dxf.fileId,
          dxfFileName: dxfFile?.name,
          dxfStatus: "present",
          excelStatus: "missing",
          matchStatus: "unmatched",
          partSource,
          builtPlateSpec,
          ...geomFields,
        });
      }
    }

    // ── Pass 2: Remaining Excel rows with no DXF match ───────────────────────
    for (const row of clientExcelRows) {
      if (usedExcelRowIds.has(row.id)) continue;

      parts.push({
        id: nanoid(),
        batchId,
        clientId: client.id,
        clientCode: client.shortCode,
        clientName: client.fullName,
        partName: row.partName,
        quantity: row.quantity,
        thickness: row.thickness,
        material: row.material,
        width: row.width,
        length: row.length,
        area: row.area,
        weight: row.weight,
        totalWeight: row.totalWeight,
        excelRowId: row.id,
        dxfStatus: "missing",
        excelStatus: "present",
        matchStatus: "unmatched",
      });
    }
  }

  return parts;
}
