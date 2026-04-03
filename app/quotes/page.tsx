"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, PlusCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  deleteQuoteFromList,
  getQuotesList,
  subscribeQuotesListChanged,
  type QuoteListRecord,
  type QuoteListStatus,
} from "@/lib/quotes/quoteList";

const STEP_LABEL: Record<number, string> = {
  1: "General",
  2: "Quote method",
  3: "Parts",
  4: "Stock & pricing",
  5: "Calculation",
  6: "Quote",
  7: "Finalize",
};

function statusBadge(status: QuoteListStatus) {
  if (status === "complete") {
    return (
      <Badge variant="secondary" className="bg-emerald-600/15 text-emerald-800 dark:text-emerald-200">
        Complete
      </Badge>
    );
  }
  return <Badge variant="outline">In progress</Badge>;
}

function formatUpdated(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function QuotesPage() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    return subscribeQuotesListChanged(() => setTick((t) => t + 1));
  }, []);

  const rows = useMemo(() => getQuotesList(), [tick]);

  const handleDelete = useCallback((q: QuoteListRecord) => {
    if (!confirm(`Remove “${q.referenceNumber}” from this list?`)) return;
    deleteQuoteFromList(q.id);
  }, []);

  return (
    <PageContainer>
      <PageHeader
        title="Quotes"
        description="All quick quotes you have started or finished. A quote appears here after you complete General and continue to quote methods."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild>
              <Link href="/quick-quote">
                <PlusCircle className="h-4 w-4 mr-2" />
                New quote
              </Link>
            </Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted shrink-0">
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No quotes yet"
          description="Start a new quote and continue past the General step — it will show up here as in progress."
          action={
            <Button asChild>
              <Link href="/quick-quote">
                <PlusCircle className="h-4 w-4 mr-2" />
                New quote
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-md border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-mono text-sm">{q.referenceNumber}</TableCell>
                  <TableCell className="font-medium max-w-[220px] truncate">
                    {q.customerName || "—"}
                  </TableCell>
                  <TableCell>{statusBadge(q.status)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {STEP_LABEL[q.currentStep] ?? `Step ${q.currentStep}`}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {formatUpdated(q.updatedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/quick-quote">Open builder</Link>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(q)}
                        aria-label={`Remove ${q.referenceNumber}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PageContainer>
  );
}
