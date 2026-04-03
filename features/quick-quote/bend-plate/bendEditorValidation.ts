import type { BendPlateFormState } from "./types";

function angleOk(deg: number): boolean {
  return Number.isFinite(deg) && deg > 0 && deg <= 180;
}

/** Per-field issues for the bent plate shape editor — empty means ready to save. */
export function getBendEditorValidationIssues(form: BendPlateFormState): string[] {
  const issues: string[] = [];
  const g = form.global;

  if (!(Number(g.thicknessMm) > 0)) issues.push("thickness (mm)");
  if (!(Number(g.plateWidthMm) > 0)) issues.push("plate width (mm)");
  if (!(Number(g.insideRadiusMm) > 0)) issues.push("inside bend radius (mm)");
  if (!(Math.floor(g.quantity) >= 1)) issues.push("quantity");
  if (!(g.material ?? "").trim()) issues.push("material grade");

  switch (form.template) {
    case "l": {
      const { aMm, bMm, angleDeg } = form.l;
      if (!(aMm > 0)) issues.push("leg A (mm)");
      if (!(bMm > 0)) issues.push("leg B (mm)");
      if (!angleOk(angleDeg)) issues.push("included angle (°)");
      break;
    }
    case "u": {
      const u = form.u;
      if (!(u.aMm > 0)) issues.push("leg A (mm)");
      if (!(u.bMm > 0)) issues.push("leg B (mm)");
      if (!(u.cMm > 0)) issues.push("leg C (mm)");
      if (!angleOk(u.angle1Deg)) issues.push("included angle 1 (°)");
      if (!angleOk(u.angle2Deg)) issues.push("included angle 2 (°)");
      break;
    }
    case "z": {
      const z = form.z;
      if (!(z.aMm > 0)) issues.push("leg A (mm)");
      if (!(z.bMm > 0)) issues.push("leg B (mm)");
      if (!(z.cMm > 0)) issues.push("leg C (mm)");
      if (!angleOk(z.angle1Deg)) issues.push("included angle 1 (°)");
      if (!angleOk(z.angle2Deg)) issues.push("included angle 2 (°)");
      break;
    }
    case "omega": {
      const o = form.omega;
      if (!(o.aMm > 0)) issues.push("segment A (mm)");
      if (!(o.bMm > 0)) issues.push("segment B (mm)");
      if (!(o.cMm > 0)) issues.push("segment C (mm)");
      if (!(o.dMm > 0)) issues.push("segment D (mm)");
      if (!(o.eMm > 0)) issues.push("segment E (mm)");
      if (!angleOk(o.angle1Deg)) issues.push("included angle 1 (°)");
      if (!angleOk(o.angle2Deg)) issues.push("included angle 2 (°)");
      if (!angleOk(o.angle3Deg)) issues.push("included angle 3 (°)");
      if (!angleOk(o.angle4Deg)) issues.push("included angle 4 (°)");
      break;
    }
    case "gutter": {
      const g = form.gutter;
      if (!(g.aMm > 0)) issues.push("segment A (mm)");
      if (!(g.bMm > 0)) issues.push("segment B (mm)");
      if (!(g.cMm > 0)) issues.push("segment C (mm)");
      if (!(g.dMm > 0)) issues.push("segment D (mm)");
      if (!(g.eMm > 0)) issues.push("segment E (mm)");
      if (!angleOk(g.angle1Deg)) issues.push("included angle 1 (°)");
      if (!angleOk(g.angle2Deg)) issues.push("included angle 2 (°)");
      if (!angleOk(g.angle3Deg)) issues.push("included angle 3 (°)");
      if (!angleOk(g.angle4Deg)) issues.push("included angle 4 (°)");
      break;
    }
    case "custom": {
      const c = form.custom;
      const n = Math.min(7, Math.max(2, Math.floor(c.segmentCount) || 2));
      for (let i = 0; i < n; i++) {
        const len = c.segmentsMm[i] ?? 0;
        if (!(len > 0)) issues.push(`segment ${i + 1} length (mm)`);
      }
      for (let i = 0; i < n - 1; i++) {
        const a = c.anglesDeg[i] ?? 0;
        if (!Number.isFinite(a) || a < -360 || a > 360) {
          issues.push(`turn after segment ${i + 1} (°)`);
        }
      }
      break;
    }
    default:
      break;
  }

  return issues;
}

/** Human-readable lines for dialogs; null if the form is complete enough to save. */
export function getBendEditorValidationLines(form: BendPlateFormState): string[] | null {
  const issues = getBendEditorValidationIssues(form);
  if (issues.length === 0) return null;
  return issues.map((i) => `Add ${i}.`);
}
