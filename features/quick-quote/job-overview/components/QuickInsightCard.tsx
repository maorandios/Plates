"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface QuickInsightCardProps {
  lines: string[];
}

export function QuickInsightCard({ lines }: QuickInsightCardProps) {
  return (
    <Card className="border-border shadow-sm border-dashed bg-muted/10 h-full">
      <CardHeader className="pb-2 border-b border-border/80 bg-muted/15">
        <CardTitle className="text-sm font-semibold">Quick insight</CardTitle>
        <CardDescription className="text-xs">
          Automated read on file-derived signals — not a substitute for engineering review.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No extra signals for this run. Review parts and validation recap as needed.
          </p>
        ) : (
          <ul className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            {lines.map((line, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground/40" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
