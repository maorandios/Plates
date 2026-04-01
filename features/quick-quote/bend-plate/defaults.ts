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
    case "custom":
      return {
        ...form,
        custom: {
          ...form.custom,
          anglesDeg: form.custom.anglesDeg.map((a) => toInternal(a)),
        },
      };
    default:
      return form;
  }
}

/** Legacy saved lines used `template: "hat"` — map to an equivalent 5-segment custom profile. */
function migrateLegacyHatQuoteToForm(
  global: BendPlateQuoteItem["global"],
  h: {
    aMm: number;
    bMm: number;
    cMm: number;
    dMm: number;
    eMm: number;
    angle1Deg: number;
    angle2Deg: number;
    angle3Deg: number;
    angle4Deg: number;
  },
  bendAngleSemantic: BendPlateQuoteItem["bendAngleSemantic"]
): BendPlateFormState {
  const base = createDefaultBendPlateFormState();
  let migrated: BendPlateFormState = {
    ...base,
    template: "custom",
    global: {
      ...base.global,
      ...global,
      finish: global.finish ?? DEFAULT_PLATE_FINISH,
    },
    custom: {
      segmentCount: 5,
      segmentsMm: [h.aMm, h.bMm, h.cMm, h.dMm, h.eMm, 0, 0],
      anglesDeg: [h.angle1Deg, h.angle2Deg, h.angle3Deg, h.angle4Deg, 180, 180],
    },
  };
  if (bendAngleSemantic === "internal") {
    return migrated;
  }
  return migrateLegacyBendAnglesToInternal(migrated);
}

function padCustomParams(c: BendPlateFormState["custom"]): BendPlateFormState["custom"] {
  const segmentsMm = [...c.segmentsMm];
  while (segmentsMm.length < 7) segmentsMm.push(0);
  const anglesDeg = [...c.anglesDeg];
  while (anglesDeg.length < 6) anglesDeg.push(180);
  return {
    ...c,
    segmentsMm: segmentsMm.slice(0, 7),
    anglesDeg: anglesDeg.slice(0, 6),
  };
}

export function createDefaultBendPlateFormState(): BendPlateFormState {
  return {
    template: "l",
    global: {
      material: "",
      finish: DEFAULT_PLATE_FINISH,
      thicknessMm: 0,
      plateWidthMm: 0,
      insideRadiusMm: 0,
      quantity: 0,
    },
    l: { aMm: 100, bMm: 80, angleDeg: 90 },
    u: { aMm: 40, bMm: 50, cMm: 40, angle1Deg: 90, angle2Deg: 90 },
    z: { aMm: 60, bMm: 40, cMm: 60, angle1Deg: 90, angle2Deg: 90 },
    custom: {
      segmentCount: 2,
      segmentsMm: [100, 100, 0, 0, 0, 0, 0],
      anglesDeg: [90, 180, 180, 180, 180, 180],
    },
  };
}

/** Fresh defaults for a chosen template (used when starting a new plate from the hub). */
export function createFormStateForTemplate(template: BendTemplateId): BendPlateFormState {
  return { ...createDefaultBendPlateFormState(), template };
}

/** Rehydrate editor state from a saved quote line (edit). */
export function formStateFromQuoteItem(item: BendPlateQuoteItem): BendPlateFormState {
  const legacy = item as unknown as {
    template?: string;
    hat?: {
      aMm: number;
      bMm: number;
      cMm: number;
      dMm: number;
      eMm: number;
      angle1Deg: number;
      angle2Deg: number;
      angle3Deg: number;
      angle4Deg: number;
    };
    global: BendPlateQuoteItem["global"];
    bendAngleSemantic?: BendPlateQuoteItem["bendAngleSemantic"];
  };
  if (legacy.template === "hat" && legacy.hat) {
    return migrateLegacyHatQuoteToForm(legacy.global, legacy.hat, legacy.bendAngleSemantic);
  }

  const base: BendPlateFormState = {
    template: item.template,
    global: {
      ...item.global,
      finish: item.global.finish ?? DEFAULT_PLATE_FINISH,
    },
    l: { ...item.l },
    u: { ...item.u },
    z: { ...item.z },
    custom: padCustomParams({ ...item.custom }),
  };
  if (item.bendAngleSemantic === "internal") {
    return base;
  }
  return migrateLegacyBendAnglesToInternal(base);
}
