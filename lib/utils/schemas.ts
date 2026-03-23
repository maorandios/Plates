import { z } from "zod";

const cuttingMethodEnum = z.enum(["laser", "plasma", "oxy_fuel"], {
  message: "Cutting method is required",
});

export const createBatchSchema = z.object({
  name: z
    .string()
    .min(1, "Batch name is required")
    .max(100, "Batch name is too long"),
  notes: z.string().max(500, "Notes are too long").optional(),
  cuttingMethod: cuttingMethodEnum,
});

export type CreateBatchFormValues = z.infer<typeof createBatchSchema>;

export const addClientSchema = z.object({
  fullName: z
    .string()
    .min(2, "Client name must be at least 2 characters")
    .max(100, "Client name is too long"),
});

export type AddClientFormValues = z.infer<typeof addClientSchema>;

export const clientFormSchema = z.object({
  fullName: z
    .string()
    .min(2, "Client name must be at least 2 characters")
    .max(100, "Client name is too long"),
  contactName: z.string().max(120).optional(),
  email: z
    .string()
    .max(120)
    .optional()
    .refine(
      (s) => !s?.trim() || z.string().email().safeParse(s.trim()).success,
      "Invalid email"
    ),
  phone: z.string().max(40).optional(),
  notes: z.string().max(2000).optional(),
  status: z.enum(["active", "inactive"]),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;
