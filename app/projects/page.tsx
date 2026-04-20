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
  deletePlateProjectFromList,
  getPlateProjectsList,
  setPlateProjectApprovalStatus,
  subscribePlateProjectsListChanged,
  type PlateProjectListRecord,
  type PlateProjectListStatus,
} from "@/lib/projects/plateProjectList";
import { t } from "@/lib/i18n";
import { formatDecimal } from "@/lib/formatNumbers";
import { cn } from "@/lib/utils";
import { MATERIAL_TYPE_LABELS } from "@/types/materials";
import {
  sameLocalDateAsYmd,
  statusMatches,
  textMatchesListQuery,
  type ListStatusFilter,
} from "@/lib/listScreenFilters";

/** Matches {@link QuotesPage}: fixed #; text columns; numeric pairs; material; status; icon columns. */
const GRID_COLS =
  "2.75rem minmax(140px, 1.15fr) minmax(120px, 1fr) minmax(110px, 1fr) minmax(150px, 1.1fr) minmax(96px, 0.9fr) minmax(92px, 0.85fr) minmax(92px, 0.85fr) minmax(128px, 1fr) 3.25rem 3.25rem" as const;

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

export default function ProjectsPage() {
  const [tick, setTick] = useState(0);
  const [projectPendingDelete, setProjectPendingDelete] =
    useState<PlateProjectListRecord | null>(null);
  const [search, setSearch] = useState("");
  const [dateYmd, setDateYmd] = useState("");
  const [statusFilter, setStatusFilter] = useState<ListStatusFilter>("all");

  useEffect(() => {
    return subscribePlateProjectsListChanged(() => setTick((n) => n + 1));
  }, []);

  const rows = useMemo(() => getPlateProjectsList(), [tick]);

  const filteredRows = useMemo(() => {
    return rows.filter((p) => {
      if (
        !textMatchesListQuery(
          [
            p.customerName,
            p.projectName,
            p.referenceNumber,
            MATERIAL_TYPE_LABELS[p.materialType],
          ],
          search
        )
      ) {
        return false;
      }
      if (!statusMatches(p.status, statusFilter)) return false;
      if (!sameLocalDateAsYmd(p.createdAt, dateYmd)) return false;
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

  const openDeleteDialog = useCallback((p: PlateProjectListRecord) => {
    setProjectPendingDelete(p);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!projectPendingDelete) return;
    deletePlateProjectFromList(projectPendingDelete.id);
    setProjectPendingDelete(null);
  }, [projectPendingDelete]);

  return (
    <PageContainer>
      <PageHeader
        title={t("projects.title")}
        description={t("projects.description")}
        actions={
          <Button asChild>
            <Link href="/plate-project" className="inline-flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              {t("projects.newProject")}
            </Link>
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={PlusCircle}
          title={t("projects.emptyTitle")}
          description={t("projects.emptyDescription")}
          action={
            <Button asChild>
              <Link href="/plate-project" className="inline-flex items-center gap-2">
                <PlusCircle className="h-4 w-4" />
                {t("projects.newProject")}
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
        <div className="overflow-x-auto rounded-xl border border-border" dir="rtl">
          <div className="min-w-[1140px] px-3 sm:px-5">
            <Table
              className="grid w-full border-collapse border-spacing-0 [&_thead]:contents [&_tbody]:contents [&_tr]:contents"
              style={{ gridTemplateColumns: GRID_COLS }}
            >
              <TableHeader className="contents">
                <TableRow className="contents border-0 hover:bg-transparent">
                  <TableHead className="flex h-full min-h-12 w-full items-center justify-center border-b border-border text-xs font-medium sm:text-sm">
                    {t("projects.colIndex")}
                  </TableHead>
                  <TableHead className="flex h-full min-h-12 w-full items-center justify-start border-b border-border text-right text-xs font-medium sm:text-sm">
                    {t("projects.colClient")}
                  </TableHead>
                  <TableHead className="flex h-full min-h-12 w-full items-center justify-start border-b border-border text-right text-xs font-medium sm:text-sm">
                    {t("projects.colProject")}
                  </TableHead>
                  <TableHead className="flex h-full min-h-12 w-full items-center justify-start border-b border-border text-right text-xs font-medium sm:text-sm">
                    {t("projects.colReference")}
                  </TableHead>
                  <TableHead className="flex h-full min-h-12 w-full items-center justify-start border-b border-border text-right text-xs font-medium sm:text-sm">
                    {t("projects.colCreated")}
                  </TableHead>
                  <TableHead className="flex h-full min-h-12 w-full items-center justify-start border-b border-border text-right text-xs font-medium tabular-nums sm:text-sm">
                    {t("projects.colMaterial")}
                  </TableHead>
                  <TableHead className="flex h-full min-h-12 w-full items-center justify-start border-b border-border text-right text-xs font-medium tabular-nums sm:text-sm">
                    {t("projects.colTotalWeight")}
                  </TableHead>
                  <TableHead className="flex h-full min-h-12 w-full items-center justify-start border-b border-border text-right text-xs font-medium tabular-nums sm:text-sm">
                    {t("projects.colTotalArea")}
                  </TableHead>
                  <TableHead className="flex h-full min-h-12 w-full items-center justify-center border-b border-border text-xs font-medium sm:text-sm">
                    {t("projects.colStatus")}
                  </TableHead>
                  <TableHead className="flex h-full min-h-12 w-full items-center justify-center border-b border-border text-xs font-medium sm:text-sm">
                    {t("projects.colView")}
                  </TableHead>
                  <TableHead className="flex h-full min-h-12 w-full items-center justify-center border-b border-border pe-1 text-xs font-medium sm:pe-2 sm:text-sm">
                    {t("projects.colDelete")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="contents">
                {filteredRows.map((p, index) => {
                  const w = p.totalWeightKg;
                  const a = p.totalAreaM2;
                  const mat = MATERIAL_TYPE_LABELS[p.materialType];
                  return (
                    <TableRow
                      key={p.id}
                      className="group/row contents border-0 hover:bg-white/[0.02]"
                    >
                      <TableCell className="border-b border-border text-center text-sm tabular-nums text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="min-w-0 border-b border-border text-right font-medium">
                        <span className="block truncate" title={p.customerName || undefined}>
                          {p.customerName?.trim() || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="min-w-0 border-b border-border text-right text-sm">
                        <span className="block truncate" title={p.projectName?.trim() || undefined}>
                          {p.projectName?.trim() || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="min-w-0 border-b border-border text-right">
                        <span className="block truncate font-mono text-sm" title={p.referenceNumber}>
                          {p.referenceNumber}
                        </span>
                      </TableCell>
                      <TableCell className="min-w-0 whitespace-nowrap border-b border-border text-right text-sm tabular-nums text-muted-foreground">
                        {formatCreated(p.createdAt)}
                      </TableCell>
                      <TableCell className="min-w-0 border-b border-border text-right text-sm">
                        <span className="block truncate" title={mat}>
                          {mat}
                        </span>
                      </TableCell>
                      <TableCell className="min-w-0 border-b border-border text-right text-sm tabular-nums">
                        {w != null && Number.isFinite(w) ? formatDecimal(w, 1) : "—"}
                      </TableCell>
                      <TableCell className="min-w-0 border-b border-border text-right text-sm tabular-nums">
                        {a != null && Number.isFinite(a) ? formatDecimal(a, 2) : "—"}
                      </TableCell>
                      <TableCell className="flex h-full min-h-12 w-full items-center justify-center border-b border-border px-1">
                        <Select
                          value={p.status}
                          onValueChange={(v) =>
                            setPlateProjectApprovalStatus(p.id, v as PlateProjectListStatus)
                          }
                        >
                          <SelectTrigger
                            className={cn(
                              "h-7 min-h-7 w-[9rem] min-w-[9rem] max-w-[9rem] shrink-0 gap-0.5 rounded-full border px-1.5 text-[11px] font-medium leading-none shadow-none focus-visible:ring-1 focus-visible:ring-offset-0 [&_svg]:h-3 [&_svg]:w-3 [&_svg]:shrink-0 [&_svg]:opacity-70",
                              p.status === "complete"
                                ? "!border-[#6A23F7] !bg-[#160822] !text-[#6A23F7] hover:!bg-[#160822] focus-visible:!ring-[#6A23F7]/45"
                                : "!border-[#ff9100] !bg-[#291600] !text-[#ff9100] hover:!bg-[#291600] focus-visible:!ring-[#ff9100]/45"
                            )}
                            aria-label={t("projects.statusSelectAria", {
                              ref: p.referenceNumber,
                            })}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="in_progress">
                              {t("projects.statusNotApproved")}
                            </SelectItem>
                            <SelectItem value="complete">
                              {t("projects.statusApproved")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="flex h-full min-h-12 w-full items-center justify-center border-b border-border px-2 py-2">
                        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" asChild>
                          <Link
                            href={`/projects/${encodeURIComponent(p.id)}/preview`}
                            title={t("projects.viewAria", { ref: p.referenceNumber })}
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                      <TableCell className="flex h-full min-h-12 w-full items-center justify-center border-b border-border py-2 pe-1 ps-2 sm:pe-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => openDeleteDialog(p)}
                          title={t("projects.removeAria", { ref: p.referenceNumber })}
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
        open={projectPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setProjectPendingDelete(null);
        }}
      >
        <DialogContent
          dir="rtl"
          showCloseButton={false}
          className="max-w-md border-border text-start sm:text-start"
        >
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>{t("projects.removeDialogTitle")}</DialogTitle>
            <DialogDescription className="text-start">
              {projectPendingDelete
                ? t("projects.removeDialogDescription", {
                    projectName:
                      projectPendingDelete.projectName?.trim() ||
                      t("projects.removeDialogProjectFallback"),
                  })
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex w-full flex-row flex-wrap items-center gap-2">
            <Button type="button" variant="destructive" onClick={confirmDelete}>
              {t("projects.removeDialogConfirm")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setProjectPendingDelete(null)}>
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
