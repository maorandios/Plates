"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Building2,
  ClipboardList,
  Eye,
  Pencil,
  Square,
  Trash2,
  Weight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogFooterActionsStartClassName,
} from "@/components/ui/dialog";
import { getClientById } from "@/lib/store";
import {
  deleteQuoteFromList,
  getQuotesForClient,
  setQuoteApprovalStatus,
  subscribeQuotesListChanged,
  type QuoteListRecord,
  type QuoteListStatus,
} from "@/lib/quotes/quoteList";
import { listRowApprovalSelectClassName } from "@/lib/listScreenApprovalSelectStyles";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import type { LucideIcon } from "lucide-react";

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [listTick, setListTick] = useState(0);
  const [quotePendingDelete, setQuotePendingDelete] =
    useState<QuoteListRecord | null>(null);

  const clientId =
    typeof params?.clientId === "string"
      ? params.clientId
      : Array.isArray(params?.clientId)
        ? params?.clientId[0] ?? ""
        : "";

  const client = useMemo(() => {
    if (!clientId) return undefined;
    return getClientById(clientId);
  }, [clientId]);

  useEffect(() => {
    if (clientId && !getClientById(clientId)) {
      router.replace("/clients");
    }
  }, [clientId, router]);

  useEffect(() => subscribeQuotesListChanged(() => setListTick((n) => n + 1)), []);

  const projects = useMemo(
    () => (clientId ? getQuotesForClient(clientId) : []),
    [clientId, listTick]
  );

  const totals = useMemo(() => {
    const weight = projects.reduce((s, q) => s + (q.totalWeightKg ?? 0), 0);
    const area = projects.reduce((s, q) => s + (q.totalAreaM2 ?? 0), 0);
    return {
      quoteCount: projects.length,
      totalWeightKg: weight,
      totalAreaM2: area,
    };
  }, [projects]);

  const confirmDeleteQuote = useCallback(() => {
    if (!quotePendingDelete) return;
    deleteQuoteFromList(quotePendingDelete.id);
    setQuotePendingDelete(null);
  }, [quotePendingDelete]);

  if (!clientId || !client) return null;

  function formatDateDdMmYyyy(iso: string): string {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    } catch {
      return iso;
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title={
          <>
            <span>{client.fullName}</span>
            <span className="text-muted-foreground font-normal" aria-hidden>
              ·
            </span>
            <span className="font-mono text-lg font-medium text-muted-foreground tracking-wider">
              {client.shortCode}
            </span>
          </>
        }
      />

      <div
        className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-5"
        dir="rtl"
      >
        <aside className="w-full shrink-0 lg:max-w-md xl:max-w-lg">
          <Card className="overflow-hidden border border-border bg-card shadow-none">
            <CardContent className="p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Building2 className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  {t("clientDetail.infoTitle")}
                </h2>
                <Button variant="ghost" size="icon" className="shrink-0" asChild>
                  <Link
                    href={`/clients/${clientId}/edit`}
                    aria-label={t("clientDetail.editInfoAria")}
                  >
                    <Pencil className="h-4 w-4" strokeWidth={1.75} />
                  </Link>
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
                <InfoRow
                  label="ח.פ / עוסק מורשה"
                  value={client.companyRegistrationNumber}
                />
                <InfoRow label="איש קשר" value={client.contactName} />
                <InfoRow label="אימייל" value={client.email} />
                <InfoRow label="טלפון" value={client.phone} />
                <InfoRow label="עיר" value={client.city} />
                <InfoRow
                  label={t("clientDetail.foundationDateLabel")}
                  value={formatDateDdMmYyyy(client.createdAt)}
                />
              </div>
              {client.notes && (
                <div className="mt-4 border-t border-border pt-4">
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t("clientDetail.notesLabel")}
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {client.notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>

        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-3">
          <SummaryCard
            title={t("clientDetail.cardTotalQuotes")}
            value={formatInteger(totals.quoteCount)}
            icon={ClipboardList}
          />
          <SummaryCard
            title={t("clientDetail.cardTotalWeight")}
            value={formatDecimal(totals.totalWeightKg, 1)}
            icon={Weight}
          />
          <SummaryCard
            title={t("clientDetail.cardTotalArea")}
            value={formatDecimal(totals.totalAreaM2, 2)}
            icon={Square}
          />
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          {t("clientDetail.projectsTitle")}
        </h2>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 border border-dashed border-border rounded-xl text-center px-4">
            {t("clientDetail.projectsEmpty")}
          </p>
        ) : (
          <div
            className="rounded-xl overflow-hidden border border-border"
            dir="rtl"
          >
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="w-10 text-center font-medium">
                    {t("clientDetail.table.colIndex")}
                  </TableHead>
                  <TableHead className="text-right font-medium">
                    {t("clientDetail.table.colProjectName")}
                  </TableHead>
                  <TableHead className="text-right font-medium">
                    {t("clientDetail.table.colProjectId")}
                  </TableHead>
                  <TableHead className="text-right font-medium">
                    {t("clientDetail.table.colCreated")}
                  </TableHead>
                  <TableHead className="text-end tabular-nums font-medium">
                    {t("clientDetail.table.colWeight")}
                  </TableHead>
                  <TableHead className="text-end tabular-nums font-medium">
                    {t("clientDetail.table.colArea")}
                  </TableHead>
                  <TableHead className="text-end tabular-nums font-medium">
                    {t("clientDetail.table.colQty")}
                  </TableHead>
                  <TableHead className="text-center font-medium min-w-[88px]">
                    {t("clientDetail.table.colStatus")}
                  </TableHead>
                  <TableHead className="text-center w-[72px] font-medium">
                    {t("clientDetail.table.colView")}
                  </TableHead>
                  <TableHead className="text-center w-[72px] font-medium">
                    {t("clientDetail.table.colDelete")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((q, index) => (
                  <TableRow key={q.id} className="border-border">
                    <TableCell className="text-center tabular-nums text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell className="text-right font-medium max-w-[200px] truncate">
                      {q.projectName?.trim() || "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {q.referenceNumber}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground tabular-nums whitespace-nowrap">
                      {formatDateDdMmYyyy(q.createdAt)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatDecimal(q.totalWeightKg ?? 0, 1)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatDecimal(q.totalAreaM2 ?? 0, 2)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatInteger(Math.round(q.totalItemQty ?? 0))}
                    </TableCell>
                    <TableCell className="flex items-center justify-center p-2">
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
                    <TableCell className="p-1 text-center">
                      <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                        <Link
                          href={`/quotes/${q.id}/preview`}
                          title={t("quotes.viewAria", { ref: q.referenceNumber })}
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                    <TableCell className="p-1 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title={t("clientDetail.table.deleteAria")}
                        onClick={() => setQuotePendingDelete(q)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

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
            <DialogDescription className="text-start text-sm leading-relaxed">
              {quotePendingDelete
                ? t("quotes.removeDialogDescription", {
                    projectName:
                      quotePendingDelete.projectName?.trim() ||
                      t("quotes.removeDialogProjectFallback"),
                  })
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className={cn(dialogFooterActionsStartClassName)}>
            <Button type="button" variant="destructive" onClick={confirmDeleteQuote}>
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

function SummaryCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="flex h-full min-h-[11rem] flex-col border border-border shadow-none">
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-8 text-center sm:gap-3.5 sm:px-5 sm:py-9">
        <Icon
          className="h-7 w-7 shrink-0 text-muted-foreground/55 sm:h-8 sm:w-8"
          strokeWidth={1.75}
          aria-hidden
        />
        <p className="text-4xl font-bold tabular-nums leading-none tracking-tight text-foreground sm:text-5xl">
          {value}
        </p>
        <p className="max-w-[14rem] text-[10px] font-semibold uppercase leading-snug tracking-wide text-muted-foreground sm:text-[11px]">
          {title}
        </p>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="min-w-0 py-0.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium leading-snug text-foreground">
        {value?.trim() ? value : "—"}
      </p>
    </div>
  );
}
