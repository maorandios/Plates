"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatQuickQuoteCurrency } from "../lib/quickQuoteCurrencies";
import type { QuotePartRow, ValidationRowStatus } from "../types/quickQuote";

function statusBadge(status: ValidationRowStatus) {
  if (status === "valid")
    return (
      <Badge variant="outline" className="border-emerald-600/35 bg-emerald-600/10 text-xs">
        Valid
      </Badge>
    );
  if (status === "warning")
    return (
      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-xs">
        Warn
      </Badge>
    );
  return (
    <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-xs">
      Error
    </Badge>
  );
}

interface PartBreakdownTableProps {
  parts: QuotePartRow[];
  currency: string;
}

export function PartBreakdownTable({ parts, currency }: PartBreakdownTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fmtMoney = (n: number) => formatQuickQuoteCurrency(n, currency);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-2 border-b border-border bg-muted/30 flex justify-between items-center">
        <p className="text-sm font-medium">Part breakdown</p>
        {selected.size > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {selected.size} selected
          </span>
        )}
      </div>
      <ScrollArea className="w-full max-h-[min(520px,65vh)]">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10" />
              <TableHead className="w-10" />
              <TableHead>Part</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Material</TableHead>
              <TableHead className="text-right">Thk</TableHead>
              <TableHead className="text-right">L</TableHead>
              <TableHead className="text-right">W</TableHead>
              <TableHead className="text-right">Area</TableHead>
              <TableHead className="text-right">Wt</TableHead>
              <TableHead className="text-right">Cut</TableHead>
              <TableHead className="text-right">Pierce</TableHead>
              <TableHead>Val.</TableHead>
              <TableHead className="text-right">Line est.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parts.map((p) => {
              const open = expandedId === p.id;
              return (
                <Fragment key={p.id}>
                  <TableRow
                    className={cn(
                      selected.has(p.id) && "bg-primary/5",
                      "cursor-pointer"
                    )}
                    onClick={() => toggleSelect(p.id)}
                  >
                    <TableCell className="p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedId(open ? null : p.id);
                        }}
                      >
                        {open ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="w-10">
                      <span
                        className={cn(
                          "block h-3.5 w-3.5 rounded-sm border mx-auto",
                          selected.has(p.id)
                            ? "bg-primary border-primary"
                            : "border-muted-foreground/40"
                        )}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{p.partName}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.qty}</TableCell>
                    <TableCell className="text-xs">{p.material}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.thicknessMm}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.lengthMm}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.widthMm}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {p.areaM2.toFixed(3)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {p.weightKg.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {(p.cutLengthMm / 1000).toFixed(2)}m
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.pierceCount}</TableCell>
                    <TableCell>{statusBadge(p.validationStatus)}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs font-medium">
                      {fmtMoney(p.estimatedLineCost)}
                    </TableCell>
                  </TableRow>
                  {open && (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={14} className="p-4">
                        <div className="grid gap-4 sm:grid-cols-[1fr_160px] text-sm max-w-4xl">
                          <div className="space-y-2">
                            <p>
                              <span className="text-muted-foreground">DXF: </span>
                              <span className="font-mono text-xs">{p.dxfFileName}</span>
                            </p>
                            <p>
                              <span className="text-muted-foreground">Excel ref: </span>
                              <span className="font-mono text-xs">{p.excelRowRef}</span>
                            </p>
                            <p className="text-muted-foreground">{p.notes || "—"}</p>
                          </div>
                          <div className="rounded-md border border-dashed border-border bg-background aspect-[4/3] flex items-center justify-center text-xs text-muted-foreground">
                            Geometry preview
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
