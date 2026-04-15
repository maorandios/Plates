import type { DxfPartGeometry } from "@/types";
import type { MaterialType } from "@/types/materials";
import type { QuotePartRow } from "../types/quickQuote";
import { defaultMaterialGradeForFamily, formatMaterialGradeAndFinish } from "./plateFields";
import { normalizeStoredReviewFinish } from "./materialSettingsOptions";

/** Default plate thickness (mm) when quoting from DXF area only (matches {@link DxfUploadStep}). */
export const DXF_QUOTE_DEFAULT_THICKNESS_MM = 2;

function roundN(n: number, decimals: number): number {
  const p = 10 ** decimals;
  return Math.round(n * p) / p;
}

/**
 * DXF-only quote method: map approved {@link DxfPartGeometry} rows to quote line items.
 * Skips entries without usable processed geometry (same gate as review “valid parts”).
 */
export function dxfGeometriesToQuoteParts(
  geometries: DxfPartGeometry[],
  materialType: MaterialType,
  defaultThicknessMm: number,
  densityKgPerM3: number
): QuotePartRow[] {
  const rho = densityKgPerM3;
  const fallbackTh = Math.max(0, defaultThicknessMm);
  const defaultGrade = defaultMaterialGradeForFamily(materialType);

  return geometries
    .filter((g) => g.processedGeometry?.isValid)
    .map((g, index) => {
      const geom = g.processedGeometry!;
      const th = Math.max(0, g.reviewThicknessMm ?? fallbackTh);
      const bbox = geom.boundingBox;
      const dim1 = bbox.width;
      const dim2 = bbox.height;
      const [lengthMm, widthMm] =
        dim1 >= dim2 ? [dim1, dim2] : [dim2, dim1];
      /** Quote line uses bounding-box footprint, not true cut outline area. */
      const areaM2 =
        dim1 > 0 && dim2 > 0 ? (dim1 * dim2) / 1_000_000 : 0;
      const tM = th / 1000;
      const weightKg = areaM2 * tM * rho;
      const pierceCount =
        geom.preparation?.manufacturing?.cutInner?.length ?? 0;
      const grade = (g.materialGrade || "").trim() || defaultGrade;
      const partName = (g.guessedPartName || "").trim() || `DXF part ${index + 1}`;
      const validationStatus =
        geom.status === "error"
          ? "error"
          : geom.status === "warning"
            ? "warning"
            : "valid";
      const qty = Math.max(1, Math.floor(g.reviewQuantity ?? 1) || 1);
      const finish = normalizeStoredReviewFinish(g.reviewFinish, materialType);

      return {
        id: g.id,
        partName,
        qty,
        material: formatMaterialGradeAndFinish(grade, finish),
        thicknessMm: th,
        lengthMm: roundN(lengthMm, 2),
        widthMm: roundN(widthMm, 2),
        areaM2: roundN(areaM2, 6),
        weightKg: roundN(weightKg, 4),
        cutLengthMm: Math.round(geom.perimeter),
        pierceCount,
        validationStatus,
        estimatedLineCost: 0,
        dxfFileName: `${partName}.dxf`,
        excelRowRef: partName,
        notes: "Source: DXF import",
      };
    });
}

export function dxfMethodHasQuotableParts(geometries: DxfPartGeometry[]): boolean {
  return geometries.some((g) => g.processedGeometry?.isValid);
}
