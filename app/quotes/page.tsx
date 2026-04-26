"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, FileText, Plus, PlusCircle, Trash2 } from "lucide-react";
import { ListScreenFilterBar } from "@/components/shared/ListScreenFilterBar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn } from "@/lib/utils";
import {
  deleteQuoteFromList,
  getQuotesList,
  setQuoteApprovalStatus,
  subscribeQuotesListChanged,
  type QuoteListRecord,
  type QuoteListStatus,
} from "@/lib/quotes/quoteList";
import { t } from "@/lib/i18n";
import {
  sameLocalDateAsYmd,
  statusMatches,
  textMatchesListQuery,
  type ListStatusFilter,
} from "@/lib/listScreenFilters";
import { formatDecimal } from "@/lib/formatNumbers";
import { listRowApprovalSelectClassName } from "@/lib/listScreenApprovalSelectStyles";

/** DD/MM/YYYY only (no time), local calendar date. */
function formatCreated(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return iso;
  }
}

function createdAtSortKey(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Matches quick-quote default VAT (18%) when estimating from incl.-only legacy rows. */
const LEGACY_VAT_RATE = 0.18;

function formatNetBeforeVatCell(q: QuoteListRecord): string {
  if (q.totalNetBeforeVat != null && Number.isFinite(q.totalNetBeforeVat)) {
    return formatDecimal(q.totalNetBeforeVat, 2);
  }
  if (q.totalInclVat != null && Number.isFinite(q.totalInclVat)) {
    return formatDecimal(q.totalInclVat / (1 + LEGACY_VAT_RATE), 2);
  }
  return "—";
}

/** Matches {@link ClientsTable}: fixed #; text columns; numeric pairs; VAT; status; icon columns. */
const GRID_COLS =
  "2.75rem minmax(140px, 1.15fr) minmax(120px, 1fr) minmax(110px, 1fr) minmax(150px, 1.1fr) minmax(92px, 0.85fr) minmax(92px, 0.85fr) minmax(108px, 1fr) minmax(7.25rem, 0.7fr) 3.25rem 3.25rem" as const;

export default function QuotesPage() {
  const [tick, setTick] = useState(0);
  const [quotePendingDelete, setQuotePendingDelete] = useState<QuoteListRecord | null>(
    null
  );
  const [search, setSearch] = useState("");
  const [dateYmd, setDateYmd] = useState("");
  const [statusFilter, setStatusFilter] = useState<ListStatusFilter>("all");

  useEffect(() => {
    return subscribeQuotesListChanged(() => setTick((n) => n + 1));
  }, []);

  const rows = useMemo(() => getQuotesList(), [tick]);

  const filteredRows = useMemo(() => {
    const filtered = rows.filter((q) => {
      if (
        !textMatchesListQuery(
          [q.customerName, q.projectName, q.referenceNumber],
          search
        )
      ) {
        return false;
      }
      if (!statusMatches(q.status, statusFilter)) return false;
      if (!sameLocalDateAsYmd(q.createdAt, dateYmd)) return false;
      return true;
    });
    // Newest first (תאריך יצירה — אחרון למעלה)
    return filtered.sort(
      (a, b) => createdAtSortKey(b.createdAt) - createdAtSortKey(a.createdAt)
    );
  }, [rows, search, dateYmd, statusFilter]);

  const hasActiveFilters = useMemo(
    () => Boolean(search.trim()) || Boolean(dateYmd) || statusFilter !== "all",
    [search, dateYmd, statusFilter]
  );

  const resetFilters = useCallback(() => {
    setSearch("");
    setDateYmd("");
    setStatusFilter("all");
  }, []);

  const openDeleteDialog = useCallback((q: QuoteListRecord) => {
    setQuotePendingDelete(q);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!quotePendingDelete) return;
    deleteQuoteFromList(quotePendingDelete.id);
    setQuotePendingDelete(null);
  }, [quotePendingDelete]);

  return (
    <PageContainer>
      <PageHeader
        titleIcon={FileText}
        title={t("quotes.title")}
        description={t("quotes.description")}
        actions={
          rows.length > 0 ? (
            <Button asChild>
              <Link href="/quick-quote" className="inline-flex items-center gap-2">
                <PlusCircle className="h-4 w-4" />
                {t("quotes.newQuote")}
              </Link>
            </Button>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <div
          className="flex min-h-[min(50vh,28rem)] flex-1 flex-col items-center justify-center px-2 py-6 sm:px-4"
          dir="rtl"
        >
          <Link
            href="/quick-quote"
            aria-label={t("quotes.newQuote")}
            className={cn(
              "group flex min-h-[min(20rem,55vh)] w-full max-w-md flex-col items-center justify-center gap-0 rounded-2xl border-2 border-dashed border-border bg-muted/25 p-8 text-center shadow-sm transition-all",
              "hover:border-primary/45 hover:bg-primary/[0.05]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )}
          >
            <div
              className="mb-5 flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary/[0.16]"
              aria-hidden
            >
              <Plus className="h-8 w-8" strokeWidth={2.25} />
            </div>
            <h2 className="w-full text-balance text-center text-lg font-semibold text-foreground sm:text-xl">
              {t("quotes.emptyTitle")}
            </h2>
            <p className="mt-2 w-full text-pretty text-center text-sm text-muted-foreground sm:text-base">
              {t("quotes.emptyDescription")}
            </p>
            <div className="mt-6 flex w-full items-center justify-center">
              <span className="pointer-events-none inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm">
                <PlusCircle className="h-4 w-4 shrink-0" aria-hidden />
                {t("quotes.newQuote")}
              </span>
            </div>
          </Link>
        </div>
      ) : (
        <>
          <ListScreenFilterBar
            search={search}
            onSearchChange={setSearch}
            dateYmd={dateYmd}
            onDateYmdChange={setDateYmd}
            status={statusFilter}
            onStatusChange={setStatusFilter}
            onReset={resetFilters}
            hasActiveFilters={hasActiveFilters}
          />
          {filteredRows.length === 0 ? (
            <div
              className="rounded-xl border border-border px-4 py-12 text-center text-sm text-muted-foreground"
              dir="rtl"
            >
              {t("listScreen.noMatch")}
            </div>
          ) : (
        <div className="rounded-xl border border-border overflow-x-auto" dir="rtl">
          <div className="min-w-[1100px] px-3 sm:px-5">
          <Table
            className="grid w-full border-collapse border-spacing-0 [&_thead]:contents [&_tbody]:contents [&_tr]:contents"
            style={{ gridTemplateColumns: GRID_COLS }}
          >
            <TableHeader className="contents">
              <TableRow className="contents border-0 hover:bg-transparent">
                <TableHead className="flex h-full min-h-12 w-full items-center justify-center border-b border-border font-medium text-xs sm:text-sm">
                  {t("quotes.colIndex")}
                </TableHead>
                <TableHead className="flex h-full min-h-12 w-full items-center justify-start border-b border-border text-right font-medium text-xs sm:text-sm">
                  {t("quotes.colClient")}
                </TableHead>
                <TableHead className="flex h-full min-h-12 w-full items-center justify-start border-b border-border text-right font-medium text-xs sm:text-sm">
                  {t("quotes.colProject")}
                </TableHead>
                <TableHead className="flex h-full min-h-12 w-full items-center justify-start border-b border-border text-right font-medium text-xs sm:text-sm">
                  {t("quotes.colReference")}
                </TableHead>
                <TableHead className="flex h-full min-h-12 w-full items-center justify-start border-b border-border text-right font-medium text-xs sm:text-sm">
                  {t("quotes.colCreated")}
                </TableHead>
                <TableHead className="flex h-full min-h-12 w-full items-center justify-start border-b border-border text-right tabular-nums font-medium text-xs sm:text-sm">
                  {t("quotes.colTotalWeight")}
                </TableHead>
                <TableHead className="flex h-full min-h-12 w-full items-center justify-start border-b border-border text-right tabular-nums font-medium text-xs sm:text-sm">
                  {t("quotes.colTotalArea")}
                </TableHead>
                <TableHead className="flex h-full min-h-12 w-full items-center justify-start border-b border-border text-right tabular-nums font-medium text-xs sm:text-sm">
                  {t("quotes.colTotalNetBeforeVat")}
                </TableHead>
                <TableHead className="flex h-full min-h-12 w-full items-center justify-center border-b border-border font-medium text-xs sm:text-sm">
                  {t("quotes.colStatus")}
                </TableHead>
                <TableHead className="flex h-full min-h-12 w-full items-center justify-center border-b border-border font-medium text-xs sm:text-sm">
                  {t("quotes.colView")}
                </TableHead>
                <TableHead className="flex h-full min-h-12 w-full items-center justify-center border-b border-border font-medium text-xs sm:text-sm pe-1 sm:pe-2">
                  {t("quotes.colDelete")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="contents">
              {filteredRows.map((q, index) => {
                const w = q.totalWeightKg;
                const a = q.totalAreaM2;
                return (
                  <TableRow key={q.id} className="contents border-0 group/row hover:bg-white/[0.02]">
                    <TableCell className="text-center tabular-nums text-muted-foreground border-b border-border text-sm">
                      {index + 1}
                    </TableCell>
                    <TableCell className="min-w-0 text-right font-medium border-b border-border">
                      <span className="block truncate" title={q.customerName || undefined}>
                        {q.customerName?.trim() || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-0 text-right text-sm border-b border-border">
                      <span className="block truncate" title={q.projectName?.trim() || undefined}>
                        {q.projectName?.trim() || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-0 border-b border-border text-right">
                      <span className="font-mono text-sm block truncate" title={q.referenceNumber}>
                        {q.referenceNumber}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-0 text-right text-muted-foreground text-sm tabular-nums whitespace-nowrap border-b border-border">
                      {formatCreated(q.createdAt)}
                    </TableCell>
                    <TableCell className="min-w-0 text-right tabular-nums text-sm border-b border-border">
                      {w != null && Number.isFinite(w) ? formatDecimal(w, 1) : "—"}
                    </TableCell>
                    <TableCell className="min-w-0 text-right tabular-nums text-sm border-b border-border">
                      {a != null && Number.isFinite(a) ? formatDecimal(a, 2) : "—"}
                    </TableCell>
                    <TableCell className="min-w-0 text-right tabular-nums text-sm border-b border-border">
                      {formatNetBeforeVatCell(q)}
                    </TableCell>
                    <TableCell className="flex h-full min-h-12 w-full items-center justify-center border-b border-border px-1">
                      <Select
                        value={q.status}
                        onValueChange={(v) =>
                          setQuoteApprovalStatus(q.id, v as QuoteListStatus)
                        }
                      >
                        <SelectTrigger
                          className={listRowApprovalSelectClassName(q.status)}
                          aria-label={t("quotes.statusSelectAria", {
                            ref: q.referenceNumber,
                          })}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in_progress">
                            {t("quotes.statusNotApproved")}
                          </SelectItem>
                          <SelectItem value="complete">
                            {t("quotes.statusApproved")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="flex h-full min-h-12 w-full items-center justify-center border-b border-border px-2 py-2">
                      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" asChild>
                        <Link
                          href={`/quotes/${q.id}/preview`}
                          title={t("quotes.viewAria", { ref: q.referenceNumber })}
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                    <TableCell className="flex h-full min-h-12 w-full items-center justify-center border-b border-border ps-2 py-2 pe-1 sm:pe-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => openDeleteDialog(q)}
                        title={t("quotes.removeAria", { ref: q.referenceNumber })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </div>
          )}
        </>
      )}

      <Dialog
        open={quotePendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setQuotePendingDelete(null);
        }}
      >
        <DialogContent
          dir="rtl"
          showCloseButton={false}
          className="max-w-md border-border text-start sm:text-start"
        >
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>{t("quotes.removeDialogTitle")}</DialogTitle>
            <DialogDescription className="text-start">
              {quotePendingDelete
                ? t("quotes.removeDialogDescription", {
                    projectName:
                      quotePendingDelete.projectName?.trim() ||
                      t("quotes.removeDialogProjectFallback"),
                  })
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex w-full flex-row flex-wrap items-center gap-2">
            <Button type="button" variant="destructive" onClick={confirmDelete}>
              {t("quotes.removeDialogConfirm")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setQuotePendingDelete(null)}
            >
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
