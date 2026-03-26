"use client";

import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { PlateBatchWorkspace } from "@/features/plate-builder/components/PlateBatchWorkspace";

export default function PlateBuilderPage() {
  return (
    <PageContainer className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden">
      <PageHeader
        title="Quick Plate Builder"
        description="Create a batch, add plates on the canvas, then edit shape, holes, and slots. Save DXF to the batch or download."
      />
      <PlateBatchWorkspace />
    </PageContainer>
  );
}
