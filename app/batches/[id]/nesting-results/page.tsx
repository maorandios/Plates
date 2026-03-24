import { Suspense } from "react";
import { PageContainer } from "@/components/shared/PageContainer";
import { NestingResultsPage } from "@/features/nesting/components/NestingResultsPage";

export default function NestingResultsRoutePage() {
  return (
    <Suspense
      fallback={
        <PageContainer embedded>
          <p className="text-sm text-muted-foreground p-6">Loading results…</p>
        </PageContainer>
      }
    >
      <NestingResultsPage />
    </Suspense>
  );
}
