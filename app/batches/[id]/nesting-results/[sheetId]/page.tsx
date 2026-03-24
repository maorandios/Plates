import { Suspense } from "react";
import { PageContainer } from "@/components/shared/PageContainer";
import { SheetViewerPageInner } from "@/features/nesting/components/SheetViewerPageInner";

export default function NestingSheetViewerRoutePage() {
  return (
    <Suspense
      fallback={
        <PageContainer embedded>
          <p className="text-sm text-muted-foreground p-6">Loading sheet…</p>
        </PageContainer>
      }
    >
      <SheetViewerPageInner />
    </Suspense>
  );
}
