import type { BendPlateFormState } from "./types";

function angleOk(deg: number): boolean {
  return Number.isFinite(deg) && deg > 0 && deg <= 180;
}

/** Stable keys for i18n under `quote.bendPlatePhase.issues`. */
export function getBendEditorValidationIssueCodes(form: BendPlateFormState): string[] {
  const issues: string[] = [];
  const g = form.global;

  if (!(Number(g.thicknessMm) > 0)) issues.push("thicknessMm");
  if (form.template !== "plate" && !(Number(g.plateWidthMm) > 0)) issues.push("plateWidthMm");
  if (!(Math.floor(g.quantity) >= 1)) issues.push("quantity");
  if (!(g.material ?? "").trim()) issues.push("material");

  switch (form.template) {
    case "l": {
      const { aMm, bMm, angleDeg } = form.l;
      if (!(aMm > 0)) issues.push("lLegA");
      if (!(bMm > 0)) issues.push("lLegB");
      if (!angleOk(angleDeg)) issues.push("lAngle");
      break;
    }
    case "u": {
      const u = form.u;
      if (!(u.aMm > 0)) issues.push("uLegA");
      if (!(u.bMm > 0)) issues.push("uLegB");
      if (!(u.cMm > 0)) issues.push("uLegC");
      if (!angleOk(u.angle1Deg)) issues.push("uAngle1");
      if (!angleOk(u.angle2Deg)) issues.push("uAngle2");
      break;
    }
    case "z": {
      const z = form.z;
      if (!(z.aMm > 0)) issues.push("zLegA");
      if (!(z.bMm > 0)) issues.push("zLegB");
      if (!(z.cMm > 0)) issues.push("zLegC");
      if (!angleOk(z.angle1Deg)) issues.push("zAngle1");
      if (!angleOk(z.angle2Deg)) issues.push("zAngle2");
      break;
    }
    case "omega": {
      const o = form.omega;
      if (!(o.aMm > 0)) issues.push("omegaSegA");
      if (!(o.bMm > 0)) issues.push("omegaSegB");
      if (!(o.cMm > 0)) issues.push("omegaSegC");
      if (!(o.dMm > 0)) issues.push("omegaSegD");
      if (!(o.eMm > 0)) issues.push("omegaSegE");
      if (!angleOk(o.angle1Deg)) issues.push("omegaAngle1");
      if (!angleOk(o.angle2Deg)) issues.push("omegaAngle2");
      if (!angleOk(o.angle3Deg)) issues.push("omegaAngle3");
      if (!angleOk(o.angle4Deg)) issues.push("omegaAngle4");
      break;
    }
    case "gutter": {
      const gt = form.gutter;
      if (!(gt.aMm > 0)) issues.push("gutterSegA");
      if (!(gt.bMm > 0)) issues.push("gutterSegB");
      if (!(gt.cMm > 0)) issues.push("gutterSegC");
      if (!(gt.dMm > 0)) issues.push("gutterSegD");
      if (!(gt.eMm > 0)) issues.push("gutterSegE");
      if (!angleOk(gt.angle1Deg)) issues.push("gutterAngle1");
      if (!angleOk(gt.angle2Deg)) issues.push("gutterAngle2");
      if (!angleOk(gt.angle3Deg)) issues.push("gutterAngle3");
      if (!angleOk(gt.angle4Deg)) issues.push("gutterAngle4");
      break;
    }
    case "plate": {
      const pl = form.plate;
      if (!(pl.lengthMm > 0)) issues.push("plateOutlineLengthMm");
      if (!(pl.widthMm > 0)) issues.push("plateOutlineWidthMm");
      break;
    }
    case "custom": {
      const c = form.custom;
      const n = Math.min(7, Math.max(2, Math.floor(c.segmentCount) || 2));
      for (let i = 0; i < n; i++) {
        const len = c.segmentsMm[i] ?? 0;
        if (!(len > 0)) issues.push(`customLen:${i}`);
      }
      for (let i = 0; i < n - 1; i++) {
        const a = c.anglesDeg[i] ?? 0;
        if (!Number.isFinite(a) || a < -360 || a > 360) {
          issues.push(`customTurn:${i}`);
        }
      }
      break;
    }
    default:
      break;
  }

  return issues;
}

/** Global fields shown in the «basic data» sidebar section (thickness, plate length, quantity, steel grade). */
export function getBendEditorBasicDataIssueCodes(form: BendPlateFormState): string[] {
  const issues: string[] = [];
  const g = form.global;
  if (!(Number(g.thicknessMm) > 0)) issues.push("thicknessMm");
  if (form.template !== "plate" && !(Number(g.plateWidthMm) > 0)) issues.push("plateWidthMm");
  if (!(Math.floor(g.quantity) >= 1)) issues.push("quantity");
  if (!(g.material ?? "").trim()) issues.push("material");
  return issues;
}

/** @deprecated Use getBendEditorValidationIssueCodes + locale mapping in UI */
export function getBendEditorValidationLines(form: BendPlateFormState): string[] | null {
  const codes = getBendEditorValidationIssueCodes(form);
  if (codes.length === 0) return null;
  return codes.map((c) => `[${c}]`);
}
