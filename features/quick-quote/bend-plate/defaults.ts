import type { MaterialType } from "@/types/materials";
import { internalAngleToTurnDeg } from "./geometry";
import { normalizeStoredReviewFinish } from "../lib/materialSettingsOptions";
import type {
  BendPlateFormState,
  BendPlateQuoteItem,
  BendTemplateId,
  PlateTemplateParams,
} from "./types";

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
    case "omega":
      return {
        ...form,
        omega: {
          ...form.omega,
          angle1Deg: toInternal(form.omega.angle1Deg),
          angle2Deg: toInternal(form.omega.angle2Deg),
          angle3Deg: toInternal(form.omega.angle3Deg),
          angle4Deg: toInternal(form.omega.angle4Deg),
        },
      };
    case "gutter":
      return {
        ...form,
        gutter: {
          ...form.gutter,
          angle1Deg: toInternal(form.gutter.angle1Deg),
          angle2Deg: toInternal(form.gutter.angle2Deg),
          angle3Deg: toInternal(form.gutter.angle3Deg),
          angle4Deg: toInternal(form.gutter.angle4Deg),
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
  _bendAngleSemantic: BendPlateQuoteItem["bendAngleSemantic"]
): BendPlateFormState {
  const base = createDefaultBendPlateFormState();
  const migrated: BendPlateFormState = {
    ...base,
    template: "custom",
    global: {
      ...base.global,
      ...global,
      finish: String(global.finish ?? ""),
    },
    custom: {
      segmentCount: 5,
      segmentsMm: [h.aMm, h.bMm, h.cMm, h.dMm, h.eMm, 0, 0],
      anglesDeg: [h.angle1Deg, h.angle2Deg, h.angle3Deg, h.angle4Deg, 0, 0],
    },
  };
  return {
    ...migrated,
    custom: migrateCustomIncludedAnglesToPathTurns(migrated.custom),
  };
}

function padCustomParams(c: BendPlateFormState["custom"]): BendPlateFormState["custom"] {
  const segmentsMm = [...c.segmentsMm];
  while (segmentsMm.length < 7) segmentsMm.push(0);
  const anglesDeg = [...c.anglesDeg];
  while (anglesDeg.length < 6) anglesDeg.push(0);
  return {
    ...c,
    segmentsMm: segmentsMm.slice(0, 7),
    anglesDeg: anglesDeg.slice(0, 6),
  };
}

/** Legacy custom lines stored included angles (0–180°, CCW-only); convert to signed path turns. */
function migrateCustomIncludedAnglesToPathTurns(
  custom: BendPlateFormState["custom"]
): BendPlateFormState["custom"] {
  const n = Math.min(7, Math.max(2, Math.floor(custom.segmentCount) || 2));
  const need = Math.max(0, n - 1);
  const anglesDeg = [...custom.anglesDeg];
  while (anglesDeg.length < 6) anglesDeg.push(0);
  for (let i = 0; i < need; i++) {
    const α = anglesDeg[i] ?? 180;
    const clamped = Math.max(0, Math.min(180, α));
    anglesDeg[i] = roundAngleDeg(internalAngleToTurnDeg(clamped, 1));
  }
  return { ...custom, anglesDeg };
}

/** Legacy `plate` rows: four sides / old fields → rectangle length × width. */
function migratePlateParams(
  raw: unknown,
  fallback: PlateTemplateParams
): PlateTemplateParams {
  const r = raw as
    | (Partial<PlateTemplateParams> & {
        side1Mm?: number;
        side2Mm?: number;
        side3Mm?: number;
        side4Mm?: number;
        innerLengthMm?: number;
        innerWidthMm?: number;
      })
    | null
    | undefined;
  if (r && typeof r.lengthMm === "number" && typeof r.widthMm === "number") {
    return {
      lengthMm: Math.max(0, r.lengthMm),
      widthMm: Math.max(0, r.widthMm),
    };
  }
  if (
    r &&
    typeof r.side1Mm === "number" &&
    typeof r.side2Mm === "number" &&
    typeof r.side3Mm === "number" &&
    typeof r.side4Mm === "number"
  ) {
    const s1 = Math.max(0, r.side1Mm);
    const s2 = Math.max(0, r.side2Mm);
    const s3 = Math.max(0, r.side3Mm);
    const s4 = Math.max(0, r.side4Mm);
    return {
      lengthMm: (s1 + s3) / 2,
      widthMm: (s2 + s4) / 2,
    };
  }
  if (r && typeof r.innerLengthMm === "number") {
    const il = Math.max(0, r.innerLengthMm);
    const iw = Math.max(0, Number(r.innerWidthMm) || 0);
    const S = il > 0 && iw > 0 ? (il + iw) / 2 : fallback.lengthMm;
    return { lengthMm: S, widthMm: S };
  }
  return { ...fallback };
}

export function createDefaultBendPlateFormState(): BendPlateFormState {
  return {
    template: "l",
    global: {
      material: "",
      finish: "",
      thicknessMm: 0,
      plateWidthMm: 0,
      quantity: 0,
    },
    l: { aMm: 100, bMm: 80, angleDeg: 90 },
    u: { aMm: 40, bMm: 50, cMm: 40, angle1Deg: 90, angle2Deg: 90 },
    z: { aMm: 60, bMm: 40, cMm: 60, angle1Deg: 90, angle2Deg: 90 },
    omega: {
      aMm: 80,
      bMm: 60,
      cMm: 100,
      dMm: 60,
      eMm: 80,
      angle1Deg: 90,
      angle2Deg: 90,
      angle3Deg: 90,
      angle4Deg: 90,
    },
    gutter: {
      aMm: 40,
      bMm: 80,
      cMm: 200,
      dMm: 60,
      eMm: 40,
      angle1Deg: 90,
      angle2Deg: 90,
      angle3Deg: 90,
      angle4Deg: 90,
    },
    plate: {
      lengthMm: 100,
      widthMm: 100,
    },
    custom: {
      segmentCount: 2,
      segmentsMm: [100, 100, 0, 0, 0, 0, 0],
      anglesDeg: [90, 0, 0, 0, 0, 0],
    },
  };
}

/** Fresh defaults for a chosen template (used when starting a new plate from the hub). */
export function createFormStateForTemplate(template: BendTemplateId): BendPlateFormState {
  return { ...createDefaultBendPlateFormState(), template };
}

/** Rehydrate editor state from a saved quote line (edit). */
export function formStateFromQuoteItem(
  item: BendPlateQuoteItem,
  materialType: MaterialType
): BendPlateFormState {
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
    const migrated = migrateLegacyHatQuoteToForm(legacy.global, legacy.hat, legacy.bendAngleSemantic);
    return {
      ...migrated,
      global: {
        ...migrated.global,
        finish: normalizeStoredReviewFinish(migrated.global.finish, materialType),
      },
    };
  }

  const def = createDefaultBendPlateFormState();
  const ext = item as BendPlateQuoteItem & {
    omega?: BendPlateFormState["omega"];
    gutter?: BendPlateFormState["gutter"];
    plate?: BendPlateFormState["plate"];
  };
  let customBlock = padCustomParams({ ...item.custom });
  if (item.template === "custom" && item.bendAngleSemantic !== "path_turn") {
    customBlock = migrateCustomIncludedAnglesToPathTurns(customBlock);
  }

  const base: BendPlateFormState = {
    template: item.template,
    global: {
      ...item.global,
      finish: normalizeStoredReviewFinish(item.global.finish, materialType),
    },
    l: { ...item.l },
    u: { ...item.u },
    z: { ...item.z },
    omega: { ...def.omega, ...ext.omega },
    gutter: { ...def.gutter, ...ext.gutter },
    plate: migratePlateParams(ext.plate, def.plate),
    custom: customBlock,
  };
  if (item.bendAngleSemantic === "internal" || item.template === "custom") {
    return base;
  }
  return migrateLegacyBendAnglesToInternal(base);
}
