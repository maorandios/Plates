import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { BatchForm } from "@/features/batches/BatchForm";

export default function NewBatchPage() {
  return (
    <PageContainer>
      <PageHeader
        title="New Batch"
        description="Create a new plate cutting production batch"
      />
      <Card className="max-w-lg border border-border shadow-none">
        <CardContent className="p-6">
          <BatchForm />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
