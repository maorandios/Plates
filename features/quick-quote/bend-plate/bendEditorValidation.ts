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
    case "custom": {
      const c = form.custom;
      const n = Math.min(7, Math.max(2, Math.floor(c.segmentCount) || 2));
      for (let i = 0; i < n; i++) {
        const len = c.segmentsMm[i] ?? 0;
        if (!(len > 0)) issues.push(`segment ${i + 1} length (mm)`);
      }
      for (let i = 0; i < n - 1; i++) {
        const a = c.anglesDeg[i] ?? 180;
        if (!Number.isFinite(a) || a < 0 || a > 180) {
          issues.push(`angle after segment ${i + 1} (°)`);
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
