import type { ExcelRow, DxfPartGeometry } from "@/types";
import type { MaterialType } from "@/types/materials";
import { getMaterialConfig } from "@/lib/settings/materialConfig";
import { normalizeName } from "@/lib/matching/matcher";
import { nanoid } from "@/lib/utils/nanoid";
import type { ValidationRow, ValidationSummary } from "../types/quickQuote";

const DIMENSION_TOLERANCE = 0.05;
const WEIGHT_TOLERANCE = 0.1;

export function buildValidationData(
  excelRows: ExcelRow[],
  dxfGeometries: DxfPartGeometry[],
  materialType: MaterialType
): { rows: ValidationRow[]; summary: ValidationSummary } {
  const materialConfig = getMaterialConfig(materialType);
  const densityKgPerM3 = materialConfig.densityKgPerM3;

  const rows: ValidationRow[] = [];
  let matched = 0;
  let warnings = 0;
  let critical = 0;

  for (const excelRow of excelRows) {
    const excelNorm = normalizeName(excelRow.partName);

    let bestDxf: DxfPartGeometry | null = null;
    let bestScore = 0;

    for (const dxf of dxfGeometries) {
      const dxfNorm = normalizeName(dxf.guessedPartName);

      if (dxfNorm === excelNorm) {
        bestScore = 1;
        bestDxf = dxf;
        break;
      }

      if (dxfNorm.includes(excelNorm) || excelNorm.includes(dxfNorm)) {
        const score = 0.7;
        if (score > bestScore) {
          bestScore = score;
          bestDxf = dxf;
        }
      }
    }

    const geom = bestDxf?.processedGeometry;
    const bbox = geom?.boundingBox;

    const dxfDim1 = bbox?.width || 0;
    const dxfDim2 = bbox?.height || 0;

    const excelLengthMm = excelRow.length || 0;
    const excelWidthMm = excelRow.width || 0;

    const excelDimensions = [excelLengthMm, excelWidthMm].sort((a, b) => b - a);
    const dxfDimensions = [dxfDim1, dxfDim2].sort((a, b) => b - a);

    const dxfLengthMm = dxfDimensions[0];
    const dxfWidthMm = dxfDimensions[1];

    const dxfAreaM2 = geom ? geom.area / 1000000 : 0;
    const dxfWeightKg = geom
      ? (geom.area / 1000000) * ((excelRow.thickness || 10) / 1000) * densityKgPerM3
      : 0;

    const excelAreaM2 = excelRow.area || 0;
    const excelWeightKg = excelRow.weight || 0;

    const mismatchFields: string[] = [];
    let status: "valid" | "warning" | "error" = "valid";

    if (!bestDxf) {
      mismatchFields.push("DXF file not found");
      status = "error";
    } else {
      if (excelDimensions[0] > 0 && dxfDimensions[0] > 0) {
        const lengthDiff =
          Math.abs(excelDimensions[0] - dxfDimensions[0]) / excelDimensions[0];
        if (lengthDiff > DIMENSION_TOLERANCE) {
          mismatchFields.push("Length");
          if (status === "valid") status = "warning";
        }
      }

      if (excelDimensions[1] > 0 && dxfDimensions[1] > 0) {
        const widthDiff =
          Math.abs(excelDimensions[1] - dxfDimensions[1]) / excelDimensions[1];
        if (widthDiff > DIMENSION_TOLERANCE) {
          mismatchFields.push("Width");
          if (status === "valid") status = "warning";
        }
      }

      if (excelAreaM2 > 0 && dxfAreaM2 > 0) {
        const areaDiff = Math.abs(excelAreaM2 - dxfAreaM2) / excelAreaM2;
        if (areaDiff > DIMENSION_TOLERANCE) {
          mismatchFields.push("Area");
          if (status === "valid") status = "warning";
        }
      }

      if (excelWeightKg > 0 && dxfWeightKg > 0) {
        const weightDiff = Math.abs(excelWeightKg - dxfWeightKg) / excelWeightKg;
        if (weightDiff > WEIGHT_TOLERANCE) {
          mismatchFields.push("Weight");
          if (status === "valid") status = "warning";
        }
      }

      if (excelRow.material && bestDxf.materialGrade) {
        const excelMat = normalizeName(excelRow.material);
        const dxfMat = normalizeName(bestDxf.materialGrade);
        if (excelMat !== dxfMat) {
          mismatchFields.push("Material");
          status = "error";
        }
      }
    }

    if (status === "valid") {
      matched++;
    } else if (status === "warning") {
      warnings++;
    } else if (status === "error") {
      critical++;
    }

    const thicknessMm = excelRow.thickness ?? 10;
    const dxfPerimeterMm = geom?.perimeter ?? 0;
    const dxfPiercingCount =
      geom?.preparation?.manufacturing?.cutInner?.length ?? 0;

    rows.push({
      id: nanoid(),
      partName: excelRow.partName,
      qty: excelRow.quantity,
      thicknessMm,
      excelLengthMm,
      dxfLengthMm,
      excelWidthMm,
      dxfWidthMm,
      excelAreaM2,
      dxfAreaM2,
      excelWeightKg,
      dxfWeightKg,
      dxfPerimeterMm,
      dxfPiercingCount,
      excelMaterial: excelRow.material || "-",
      dxfMaterial: bestDxf?.materialGrade || "-",
      status,
      dxfFileName: bestDxf?.guessedPartName || "Not found",
      mismatchFields,
      suggestedReason:
        mismatchFields.length > 0
          ? `Discrepancy detected in: ${mismatchFields.join(", ")}`
          : "All fields match within tolerance",
      actionRecommendation:
        status === "error"
          ? "Review and correct the data before proceeding"
          : status === "warning"
            ? "Minor differences detected - verify if acceptable"
            : "No action required",
    });
  }

  return {
    rows,
    summary: {
      totalRows: rows.length,
      matched,
      warnings,
      critical,
    },
  };
}
