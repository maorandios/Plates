"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, PlusCircle, Trash2 } from "lucide-react";
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
import { EmptyState } from "@/components/shared/EmptyState";
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
import { cn } from "@/lib/utils";

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

/** Matches {@link ClientsTable}: fixed #; text columns; numeric pairs; VAT; status; icon columns. */
const GRID_COLS =
  "2.75rem minmax(140px, 1.15fr) minmax(120px, 1fr) minmax(110px, 1fr) minmax(150px, 1.1fr) minmax(92px, 0.85fr) minmax(92px, 0.85fr) minmax(108px, 1fr) minmax(128px, 1fr) 3.25rem 3.25rem" as const;

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
    return rows.filter((q) => {
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
        title={t("quotes.title")}
        description={t("quotes.description")}
        actions={
          <Button asChild>
            <Link href="/quick-quote" className="gap-2 inline-flex items-center">
              <PlusCircle className="h-4 w-4" />
              {t("quotes.newQuote")}
            </Link>
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={PlusCircle}
          title={t("quotes.emptyTitle")}
          description={t("quotes.emptyDescription")}
          action={
            <Button asChild>
              <Link href="/quick-quote" className="gap-2 inline-flex items-center">
                <PlusCircle className="h-4 w-4" />
                {t("quotes.newQuote")}
              </Link>
            </Button>
          }
        />
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
          <div className="min-w-[1140px] px-3 sm:px-5">
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
                  {t("quotes.colTotalInclVat")}
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
                const vat = q.totalInclVat;
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
                      {vat != null && Number.isFinite(vat) ? formatDecimal(vat, 2) : "—"}
                    </TableCell>
                    <TableCell className="flex h-full min-h-12 w-full items-center justify-center border-b border-border px-1">
                      <Select
                        value={q.status}
                        onValueChange={(v) =>
                          setQuoteApprovalStatus(q.id, v as QuoteListStatus)
                        }
                      >
                        <SelectTrigger
                          className={cn(
                            "h-7 min-h-7 w-[9rem] min-w-[9rem] max-w-[9rem] shrink-0 gap-0.5 rounded-full border px-1.5 text-[11px] font-medium leading-none shadow-none focus-visible:ring-1 focus-visible:ring-offset-0 [&_svg]:h-3 [&_svg]:w-3 [&_svg]:shrink-0 [&_svg]:opacity-70",
                            /* אושרה — border/text #6A23F7, bg #160822 */
                            q.status === "complete"
                              ? "!border-[#6A23F7] !bg-[#160822] !text-[#6A23F7] hover:!bg-[#160822] focus-visible:!ring-[#6A23F7]/45"
                              : /* לא אושרה — border/text #ff9100, bg #291600 */
                                "!border-[#ff9100] !bg-[#291600] !text-[#ff9100] hover:!bg-[#291600] focus-visible:!ring-[#ff9100]/45"
                          )}
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
