import type { ExcelRow } from "@/types";
import type { MaterialType } from "@/types/materials";
import { normalizeName } from "@/lib/matching/matcher";
import { defaultMaterialGradeForFamily } from "./plateFields";

/** Row shape used while parsing DXF in {@link DxfUploadStep} before merge. */
export type DxfUploadRowForMerge = {
  file: { name: string };
  parsed: { guessedPartName: string; materialGrade?: string } | null;
  materialGrade: string;
  quantity: number;
  /** Plate thickness (mm); default before merge; Excel can overwrite when mapped. */
  thicknessMm: number;
};

/**
 * After DXF parse: set quantity and material grade from Excel BOM when a row matches the DXF
 * part name; otherwise quantity 1 and material from DXF (or family default).
 */
export function mergeExcelIntoDxfUploads<T extends DxfUploadRowForMerge>(
  uploads: T[],
  excelRows: ExcelRow[] | null | undefined,
  materialType: MaterialType
): T[] {
  const defaultGrade = defaultMaterialGradeForFamily(materialType);

  return uploads.map((upload) => {
    const parsed = upload.parsed;
    if (!parsed) {
      const grade =
        upload.materialGrade.trim() || defaultGrade;
      return {
        ...upload,
        quantity: 1,
        materialGrade: grade,
        thicknessMm: upload.thicknessMm,
      } as T;
    }

    const dxfNorm = normalizeName(parsed.guessedPartName);
    let best: ExcelRow | null = null;
    let bestScore = 0;

    if (excelRows?.length) {
      for (const row of excelRows) {
        const en = normalizeName(row.partName);
        if (en === dxfNorm) {
          best = row;
          bestScore = 1;
          break;
        }
        if (dxfNorm.includes(en) || en.includes(dxfNorm)) {
          if (bestScore < 0.7) {
            bestScore = 0.7;
            best = row;
          }
        }
      }
    }

    const geomGrade = (parsed.materialGrade || "").trim();
    const fromDxf = geomGrade || defaultGrade;

    if (best) {
      const qty = Math.max(1, Math.floor(Number(best.quantity)) || 1);
      const mat = (best.material || "").trim() || fromDxf;
      const thickFromExcel =
        typeof best.thickness === "number" &&
        Number.isFinite(best.thickness) &&
        best.thickness > 0
          ? best.thickness
          : upload.thicknessMm;
      return {
        ...upload,
        quantity: qty,
        materialGrade: mat,
        thicknessMm: thickFromExcel,
      } as T;
    }

    return {
      ...upload,
      quantity: 1,
      materialGrade: upload.materialGrade.trim() || fromDxf,
      thicknessMm: upload.thicknessMm,
    } as T;
  });
}
