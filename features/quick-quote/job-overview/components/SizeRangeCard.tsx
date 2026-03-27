"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SizeRangeInfo } from "../jobOverview.types";
import { formatDimensionsMm } from "../jobOverview.utils";

interface SizeRangeCardProps {
  sizeRange: SizeRangeInfo | null;
}

export function SizeRangeCard({ sizeRange }: SizeRangeCardProps) {
  return (
    <Card className="border-border shadow-sm h-full">
      <CardHeader className="pb-2 border-b border-border bg-muted/15">
        <CardTitle className="text-sm font-semibold">Size range</CardTitle>
        <CardDescription className="text-xs">
          Smallest and largest plate footprints from DXF / Excel dimensions.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-4 text-sm">
        {!sizeRange ? (
          <p className="text-muted-foreground">No part geometry available.</p>
        ) : (
          <>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Largest
              </p>
              <p className="mt-1 font-mono tabular-nums text-foreground">
                {formatDimensionsMm(
                  sizeRange.largest.lengthMm,
                  sizeRange.largest.widthMm
                )}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Smallest
              </p>
              <p className="mt-1 font-mono tabular-nums text-foreground">
                {formatDimensionsMm(
                  sizeRange.smallest.lengthMm,
                  sizeRange.smallest.widthMm
                )}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
