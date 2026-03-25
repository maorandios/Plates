"use client";

import Link from "next/link";
import { SquareDashedBottom, Layers, ArrowRight } from "lucide-react";
import { PageContainer } from "@/components/shared/PageContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getBatches } from "@/lib/store";

export default function PlateBuilderHubPage() {
  const batches = getBatches().slice().sort((a, b) => {
    const ta = new Date(b.updatedAt).getTime();
    const tb = new Date(a.updatedAt).getTime();
    return ta - tb;
  });

  return (
    <PageContainer embedded>
      <div className="mb-8 max-w-xl">
        <div className="flex items-center gap-2 text-primary mb-2">
          <SquareDashedBottom className="h-6 w-6" />
          <span className="text-sm font-semibold uppercase tracking-wide">
            Quick Plate Builder
          </span>
        </div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">
          Build a plate without CAD
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Choose a batch to open the guided plate builder. Your DXF will be
          saved to that batch like any uploaded drawing.
        </p>
      </div>

      {batches.length === 0 ? (
        <Card className="max-w-lg border-dashed">
          <CardContent className="py-10 text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Create a batch first, then you can add plates built in the app.
            </p>
            <Button asChild>
              <Link href="/batches/new">New batch</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2 max-w-lg">
          {batches.map((batch) => (
            <li key={batch.id}>
              <Link
                href={`/batches/${batch.id}/plate-builder`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 hover:bg-muted/40 transition-colors group"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <Layers className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {batch.name}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {batch.status}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
