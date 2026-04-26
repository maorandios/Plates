import type { Client } from "@/types/clients";
import type { QuoteListRecord } from "@/lib/quotes/quoteList";
import type { PlateProjectListRecord } from "@/lib/projects/plateProjectList";

export function clientToRow(accountUserId: string, c: Client) {
  return {
    id: c.id,
    user_id: accountUserId,
    full_name: c.fullName,
    short_code: c.shortCode,
    company_registration_number: c.companyRegistrationNumber ?? null,
    contact_name: c.contactName ?? null,
    email: c.email ?? null,
    phone: c.phone ?? null,
    city: c.city ?? null,
    notes: c.notes ?? null,
    status: c.status,
    uploaded_file_ids: c.uploadedFileIds,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

/** Requires `public.quotes.total_net_before_vat` — see migration 20260426210000. */
export function quoteToRow(accountUserId: string, q: QuoteListRecord) {
  return {
    id: q.id,
    user_id: accountUserId,
    reference_number: q.referenceNumber,
    customer_name: q.customerName,
    status: q.status,
    current_step: q.currentStep,
    wizard_schema: q.wizardSchema ?? null,
    created_at: q.createdAt,
    updated_at: q.updatedAt,
    customer_client_id: q.customerClientId ?? null,
    project_name: q.projectName ?? null,
    total_weight_kg: q.totalWeightKg ?? null,
    total_area_m2: q.totalAreaM2 ?? null,
    total_item_qty: q.totalItemQty ?? null,
    total_incl_vat: q.totalInclVat ?? null,
    total_net_before_vat: q.totalNetBeforeVat ?? null,
  };
}

export function projectToRow(accountUserId: string, p: PlateProjectListRecord) {
  return {
    id: p.id,
    user_id: accountUserId,
    reference_number: p.referenceNumber,
    customer_name: p.customerName,
    project_name: p.projectName ?? null,
    status: p.status,
    current_step: p.currentStep,
    material_type: p.materialType,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
    total_item_qty: p.totalItemQty ?? null,
    total_weight_kg: p.totalWeightKg ?? null,
    total_area_m2: p.totalAreaM2 ?? null,
  };
}

export function rowToClient(r: {
  id: string;
  full_name: string;
  short_code: string;
  company_registration_number: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  notes: string | null;
  status: string;
  uploaded_file_ids: unknown;
  created_at: string;
  updated_at: string;
}): Client {
  const ids = Array.isArray(r.uploaded_file_ids)
    ? (r.uploaded_file_ids as string[]).filter((x) => typeof x === "string")
    : [];
  return {
    id: r.id,
    fullName: r.full_name,
    shortCode: r.short_code,
    companyRegistrationNumber: r.company_registration_number ?? undefined,
    contactName: r.contact_name ?? undefined,
    email: r.email ?? undefined,
    phone: r.phone ?? undefined,
    city: r.city ?? undefined,
    notes: r.notes ?? undefined,
    status: r.status === "inactive" ? "inactive" : "active",
    uploadedFileIds: ids,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function rowToQuote(r: {
  id: string;
  reference_number: string;
  customer_name: string;
  status: string;
  current_step: number;
  wizard_schema: number | null;
  created_at: string;
  updated_at: string;
  customer_client_id: string | null;
  project_name: string | null;
  total_weight_kg: number | null;
  total_area_m2: number | null;
  total_item_qty: number | null;
  total_incl_vat: number | null;
  total_net_before_vat: number | null;
}): QuoteListRecord {
  return {
    id: r.id,
    referenceNumber: r.reference_number,
    customerName: r.customer_name,
    status: r.status === "complete" ? "complete" : "in_progress",
    currentStep: r.current_step,
    wizardSchema: r.wizard_schema === 2 ? 2 : undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    customerClientId: r.customer_client_id ?? undefined,
    projectName: r.project_name ?? undefined,
    totalWeightKg: r.total_weight_kg ?? undefined,
    totalAreaM2: r.total_area_m2 ?? undefined,
    totalItemQty: r.total_item_qty ?? undefined,
    totalInclVat: r.total_incl_vat ?? undefined,
    totalNetBeforeVat: r.total_net_before_vat ?? undefined,
  };
}

export function rowToProject(r: {
  id: string;
  reference_number: string;
  customer_name: string;
  project_name: string | null;
  status: string;
  current_step: number;
  material_type: string;
  created_at: string;
  updated_at: string;
  total_item_qty: number | null;
  total_weight_kg: number | null;
  total_area_m2: number | null;
}): PlateProjectListRecord {
  const mt = r.material_type;
  const materialType =
    mt === "stainlessSteel" || mt === "aluminum" ? mt : "carbonSteel";
  return {
    id: r.id,
    referenceNumber: r.reference_number,
    customerName: r.customer_name,
    projectName: r.project_name ?? undefined,
    status: r.status === "complete" ? "complete" : "in_progress",
    currentStep: r.current_step,
    materialType,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    totalItemQty: r.total_item_qty ?? undefined,
    totalWeightKg: r.total_weight_kg ?? undefined,
    totalAreaM2: r.total_area_m2 ?? undefined,
  };
}

export type LoadedEntityTables = {
  clients: Client[];
  quotes: QuoteListRecord[];
  projects: PlateProjectListRecord[];
};
