"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Building2, ClipboardList, Weight, Square, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { getClientById } from "@/lib/store";
import {
  deleteQuoteFromList,
  getQuotesForClient,
  subscribeQuotesListChanged,
  type QuoteListRecord,
  type QuoteListStatus,
} from "@/lib/quotes/quoteList";
import { t } from "@/lib/i18n";
import type { LucideIcon } from "lucide-react";

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [listTick, setListTick] = useState(0);

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

  const handleDeleteQuote = useCallback((q: QuoteListRecord) => {
    if (!confirm(t("clientDetail.projectsDeleteConfirm", { ref: q.referenceNumber }))) return;
    deleteQuoteFromList(q.id);
  }, []);

  if (!clientId || !client) return null;

  function formatCreated(iso: string): string {
    try {
      return new Date(iso).toLocaleString("he-IL", {
        dateStyle: "medium",
        timeStyle: "short",
      });
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
        actions={
          <div className="flex gap-2">
            <Button asChild>
              <Link href={`/clients/${clientId}/edit`}>{t("clientDetail.edit")}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link
                href="/clients"
                className="inline-flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                {t("clientDetail.back")}
              </Link>
            </Button>
          </div>
        }
      />

      <div
        className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-5"
        dir="rtl"
      >
        <aside className="w-full shrink-0 lg:max-w-md xl:max-w-lg">
          <div className="relative overflow-hidden rounded-2xl border border-teal-500/35 bg-gradient-to-b from-teal-950/50 via-[#0c1419] to-card/90 shadow-[0_0_0_1px_rgba(20,184,166,0.12),inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div
              className="h-1 w-full bg-gradient-to-l from-teal-500/90 via-teal-400/70 to-teal-600/60"
              aria-hidden
            />
            <div className="p-5 sm:p-6">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-tight text-teal-100/95">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/15 text-teal-400 ring-1 ring-teal-500/20">
                  <Building2 className="h-4 w-4" strokeWidth={1.75} />
                </span>
                {t("clientDetail.infoTitle")}
              </h2>
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
                  label="נוצר"
                  value={new Date(client.createdAt).toLocaleString()}
                />
              </div>
              {client.notes && (
                <div className="mt-4 border-t border-teal-500/20 pt-4">
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-teal-200/60">
                    {t("clientDetail.notesLabel")}
                  </p>
                  <p className="text-sm leading-relaxed text-foreground/95 whitespace-pre-wrap">
                    {client.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
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
          <p className="text-sm text-muted-foreground py-8 border border-dashed border-white/15 rounded-xl text-center px-4">
            {t("clientDetail.projectsEmpty")}
          </p>
        ) : (
          <div
            className="rounded-xl overflow-hidden border border-white/[0.08]"
            dir="rtl"
          >
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/[0.08]">
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
                  <TableRow key={q.id} className="border-white/[0.06]">
                    <TableCell className="text-center tabular-nums text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell className="text-right font-medium max-w-[200px] truncate">
                      {q.projectName?.trim() || "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {q.referenceNumber}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground whitespace-nowrap">
                      {formatCreated(q.createdAt)}
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
                    <TableCell className="text-center p-2">
                      <QuoteStatusBadge status={q.status} />
                    </TableCell>
                    <TableCell className="p-1 text-center">
                      <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                        <Link
                          href="/quick-quote"
                          title={t("clientDetail.table.viewAria")}
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
                        onClick={() => handleDeleteQuote(q)}
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
    </PageContainer>
  );
}

function QuoteStatusBadge({ status }: { status: QuoteListStatus }) {
  if (status === "complete") {
    return (
      <Badge
        variant="secondary"
        className="border font-normal bg-emerald-600/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30"
      >
        {t("clientDetail.table.statusApproved")}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="font-normal bg-[#2F1F0F] text-[#FF7700]"
      style={{
        border: "1px solid #FF9500",
      }}
    >
      {t("clientDetail.table.statusPending")}
    </Badge>
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
    <Card className="flex h-full min-h-[11rem] flex-col border border-white/[0.08] shadow-none">
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
    <div className="rounded-lg bg-black/20 px-0.5 py-0.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/90">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium leading-snug text-foreground">
        {value?.trim() ? value : "—"}
      </p>
    </div>
  );
}
