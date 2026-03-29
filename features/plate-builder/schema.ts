import { formatDecimal } from "@/lib/formatNumbers";
import { z } from "zod";
import {
  circleFitsOuterRing,
  polygonOutlineFitsOuterRing,
} from "./lib/bounds";
import { outerContourForShape } from "./lib/outerContours";
import { slotCorners, slottedHoleCapsuleOutline } from "./lib/slotPolygon";

const holeRowSchema = z.object({
  id: z.string(),
  cx: z.coerce.number(),
  cy: z.coerce.number(),
  diameter: z.coerce.number().min(0),
  length: z.coerce.number().min(0),
  rotationDeg: z.coerce.number(),
});

const slotRowSchema = z.object({
  id: z.string(),
  cx: z.coerce.number(),
  cy: z.coerce.number(),
  length: z.coerce.number().positive(),
  width: z.coerce.number().positive(),
  rotationDeg: z.coerce.number(),
});

export const plateBuilderFormSchema = z
  .object({
    shapeType: z.enum([
      "rectangle",
      "rectangleRounded",
      "rectangleChamfered",
    ]),
    width: z.coerce.number().positive(),
    height: z.coerce.number().positive(),
    cornerRadius: z.coerce.number().min(0),
    chamferSize: z.coerce.number().min(0),
    holes: z.array(holeRowSchema),
    slots: z.array(slotRowSchema),
    partName: z.string().trim().min(1, "Part name is required"),
    quantity: z.coerce.number().int().min(1),
    material: z.string().trim().min(1, "Material is required"),
    thickness: z.coerce.number().positive(),
    clientId: z.string().min(1, "Choose a client"),
  })
  .superRefine((data, ctx) => {
    const w = data.width;
    const h = data.height;

    if (data.shapeType === "rectangleRounded") {
      if (data.cornerRadius <= 0) {
        ctx.addIssue({
          code: "custom",
          message: "Corner radius must be greater than 0",
          path: ["cornerRadius"],
        });
      }
      const maxR = Math.min(w, h) / 2;
      if (data.cornerRadius > maxR + 1e-6) {
        ctx.addIssue({
          code: "custom",
          message: `Radius must be ≤ ${formatDecimal(maxR, 3)} mm`,
          path: ["cornerRadius"],
        });
      }
    }

    if (data.shapeType === "rectangleChamfered") {
      if (data.chamferSize <= 0) {
        ctx.addIssue({
          code: "custom",
          message: "Chamfer size must be greater than 0",
          path: ["chamferSize"],
        });
      }
      if (2 * data.chamferSize >= Math.min(w, h) - 1e-6) {
        ctx.addIssue({
          code: "custom",
          message: "Chamfer is too large for this width and height",
          path: ["chamferSize"],
        });
      }
    }

    const outer = outerContourForShape(
      data.shapeType,
      w,
      h,
      data.cornerRadius,
      data.chamferSize
    );

    data.holes.forEach((hole, i) => {
      const L = hole.length ?? 0;
      if (L > 0) {
        if (hole.diameter <= 0) {
          ctx.addIssue({
            code: "custom",
            message: "Diameter must be > 0 for a slotted hole",
            path: ["holes", i, "diameter"],
          });
        }
        if (L < hole.diameter - 1e-6) {
          ctx.addIssue({
            code: "custom",
            message: "Slotted length must be ≥ diameter (slot width)",
            path: ["holes", i, "length"],
          });
        }
        const outline = slottedHoleCapsuleOutline(
          hole.cx,
          hole.cy,
          L,
          hole.diameter,
          hole.rotationDeg
        );
        if (!polygonOutlineFitsOuterRing(outer, outline)) {
          ctx.addIssue({
            code: "custom",
            message: "Hole must lie fully inside the plate",
            path: ["holes", i, "length"],
          });
        }
      } else {
        if (hole.diameter <= 0) {
          ctx.addIssue({
            code: "custom",
            message: "Set diameter for a round hole, or length > 0 for a slotted hole",
            path: ["holes", i, "diameter"],
          });
        }
        const r = hole.diameter / 2;
        if (!circleFitsOuterRing(outer, hole.cx, hole.cy, r)) {
          ctx.addIssue({
            code: "custom",
            message: "Hole must lie fully inside the plate",
            path: ["holes", i, "diameter"],
          });
        }
      }
    });

    data.slots.forEach((slot, i) => {
      const corners = slotCorners(
        slot.cx,
        slot.cy,
        slot.length,
        slot.width,
        slot.rotationDeg
      );
      if (!polygonOutlineFitsOuterRing(outer, corners)) {
        ctx.addIssue({
          code: "custom",
          message: "Slot must lie fully inside the plate",
          path: ["slots", i, "length"],
        });
      }
    });
  });

export type PlateBuilderFormValues = z.infer<typeof plateBuilderFormSchema>;
