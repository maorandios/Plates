import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { BatchForm } from "@/features/batches/BatchForm";

export default function NewBatchPage() {
  return (
    <PageContainer>
      <PageHeader
        title="New quote job"
        description="Create a new quote job for organizing client files and parts"
      />
      <Card className="max-w-lg border border-border shadow-none">
        <CardContent className="p-6">
          <BatchForm />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
