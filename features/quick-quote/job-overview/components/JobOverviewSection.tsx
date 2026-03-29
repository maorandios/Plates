"use client";

import { useMemo } from "react";
import type {
  JobSummaryMetrics,
  ManufacturingParameters,
  QuotePartRow,
  ThicknessStockInput,
} from "../../types/quickQuote";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import {
  buildJobOverview,
  formatAreaM2,
  formatCutLengthM,
  formatWeightKg,
} from "../jobOverview.utils";
import { JobOverviewCard } from "./JobOverviewCard";

interface JobOverviewSectionProps {
  jobSummary: JobSummaryMetrics;
  mfgParams: ManufacturingParameters;
  parts: QuotePartRow[];
  thicknessStock?: ThicknessStockInput[] | null;
}

export function JobOverviewSection({
  jobSummary,
  mfgParams,
  parts,
  thicknessStock,
}: JobOverviewSectionProps) {
  const model = useMemo(
    () =>
      buildJobOverview({ jobSummary, mfgParams, parts, thicknessStock }),
    [jobSummary, mfgParams, parts, thicknessStock]
  );

  const sheetSubtext =
    model.estimatedSheetCount === 1
      ? "Approx. 1 sheet (from stock + utilization estimate)"
      : `Approx. ${formatInteger(model.estimatedSheetCount)} sheets`;

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Job overview
        </h2>
        <p className="text-sm text-muted-foreground">
          Key job data extracted from the uploaded files.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <JobOverviewCard
          title="Total parts"
          value={formatInteger(model.totalParts)}
          subtext={`${formatInteger(model.totalPlates)} total plates`}
        />
        <JobOverviewCard
          title="Total weight"
          value={formatWeightKg(model.totalWeightKg)}
          subtext="Estimated from geometry and thickness (file data)"
          emphasized
        />
        <JobOverviewCard
          title="Net plate area"
          value={formatAreaM2(model.netPlateAreaM2)}
          subtext="Sum of all plate geometries × quantities"
        />
        <JobOverviewCard
          title="Material required"
          value={formatAreaM2(model.grossMaterialAreaM2)}
          subtext={sheetSubtext}
        />
        <JobOverviewCard
          title="Utilization"
          value={`${formatDecimal(model.utilizationPct, 1)}%`}
          subtext={model.utilizationBand}
        />
        <JobOverviewCard
          title="Cut length"
          value={formatCutLengthM(model.totalCutLengthMm)}
          subtext="Total outer + inner cutting paths (DXF)"
        />
        <JobOverviewCard
          title="Pierce count"
          value={formatInteger(model.totalPierceCount)}
          subtext="Holes and internal starts (geometry-derived)"
        />
        <JobOverviewCard
          title="Complexity"
          value={model.complexity}
          subtext={model.complexitySubtext}
        />
      </div>
    </section>
  );
}
