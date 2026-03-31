import { DEFAULT_PLATE_FINISH } from "../lib/plateFields";
import type { BendPlateFormState, BendPlateQuoteItem, BendTemplateId } from "./types";

function roundAngleDeg(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Legacy quotes stored path turn (°); convert to included angle between legs. */
function migrateLegacyBendAnglesToInternal(form: BendPlateFormState): BendPlateFormState {
  const toInternal = (turnDeg: number) => roundAngleDeg(180 - Math.abs(turnDeg));
  switch (form.template) {
    case "l":
      return { ...form, l: { ...form.l, angleDeg: toInternal(form.l.angleDeg) } };
    case "u":
      return {
        ...form,
        u: {
          ...form.u,
          angle1Deg: toInternal(form.u.angle1Deg),
          angle2Deg: toInternal(form.u.angle2Deg),
        },
      };
    case "z":
      return {
        ...form,
        z: {
          ...form.z,
          angle1Deg: toInternal(form.z.angle1Deg),
          angle2Deg: toInternal(form.z.angle2Deg),
        },
      };
    case "hat":
      return {
        ...form,
        hat: {
          ...form.hat,
          angle1Deg: toInternal(form.hat.angle1Deg),
          angle2Deg: toInternal(form.hat.angle2Deg),
          angle3Deg: toInternal(form.hat.angle3Deg),
          angle4Deg: toInternal(form.hat.angle4Deg),
        },
      };
    default:
      return form;
  }
}

export function createDefaultBendPlateFormState(): BendPlateFormState {
  return {
    template: "l",
    global: {
      material: "",
      finish: DEFAULT_PLATE_FINISH,
      thicknessMm: 3,
      plateWidthMm: 1000,
      insideRadiusMm: 1,
      quantity: 1,
    },
    l: { aMm: 100, bMm: 80, angleDeg: 90 },
    u: { aMm: 40, bMm: 50, cMm: 40, angle1Deg: 90, angle2Deg: 90 },
    z: { aMm: 60, bMm: 40, cMm: 60, angle1Deg: 90, angle2Deg: 90 },
    hat: {
      aMm: 25,
      bMm: 80,
      cMm: 25,
      dMm: 80,
      eMm: 25,
      angle1Deg: 90,
      angle2Deg: 90,
      angle3Deg: 90,
      angle4Deg: 90,
    },
    custom: { segmentCount: 2, segmentsMm: [100, 100, 0, 0, 0, 0], anglesDeg: [90, 0, 0, 0, 0] },
  };
}

/** Fresh defaults for a chosen template (used when starting a new plate from the hub). */
export function createFormStateForTemplate(template: BendTemplateId): BendPlateFormState {
  return { ...createDefaultBendPlateFormState(), template };
}

/** Rehydrate editor state from a saved quote line (edit). */
export function formStateFromQuoteItem(item: BendPlateQuoteItem): BendPlateFormState {
  const base: BendPlateFormState = {
    template: item.template,
    global: {
      ...item.global,
      finish: item.global.finish ?? DEFAULT_PLATE_FINISH,
    },
    l: { ...item.l },
    u: { ...item.u },
    z: { ...item.z },
    hat: { ...item.hat },
    custom: {
      segmentCount: item.custom.segmentCount,
      segmentsMm: [...item.custom.segmentsMm],
      anglesDeg: [...item.custom.anglesDeg],
    },
  };
  if (item.bendAngleSemantic === "internal") {
    return base;
  }
  return migrateLegacyBendAnglesToInternal(base);
}
