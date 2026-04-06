"use client";

import Link from "next/link";
import { Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import type { Client, ClientMetrics } from "@/types";
import { deleteGlobalClient } from "@/lib/store";
import { t } from "@/lib/i18n";

export interface ClientsTableProps {
  clients: Client[];
  metricsById: Record<string, ClientMetrics>;
  onChanged?: () => void;
}

export function ClientsTable({
  clients,
  metricsById,
  onChanged,
}: ClientsTableProps) {
  function handleDelete(c: Client) {
    if (
      !confirm(
        t("pages.clients.deleteConfirm", {
          name: c.fullName,
        })
      )
    ) {
      return;
    }
    deleteGlobalClient(c.id);
    onChanged?.();
  }

  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.08]" dir="rtl">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-white/[0.08]">
            <TableHead className="w-10 text-center font-medium">
              {t("pages.clients.table.colIndex")}
            </TableHead>
            <TableHead className="min-w-[140px] font-medium">
              {t("pages.clients.table.colName")}
            </TableHead>
            <TableHead className="min-w-[120px] font-medium">
              {t("pages.clients.table.colCompanyReg")}
            </TableHead>
            <TableHead className="w-[100px] font-medium">
              {t("pages.clients.table.colClientId")}
            </TableHead>
            <TableHead className="text-end tabular-nums font-medium">
              {t("pages.clients.table.colWeight")}
            </TableHead>
            <TableHead className="text-end tabular-nums font-medium">
              {t("pages.clients.table.colArea")}
            </TableHead>
            <TableHead className="text-end tabular-nums font-medium">
              {t("pages.clients.table.colPartQty")}
            </TableHead>
            <TableHead className="w-[72px] text-center font-medium">
              {t("pages.clients.table.colView")}
            </TableHead>
            <TableHead className="w-[72px] text-center font-medium">
              {t("pages.clients.table.colDelete")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((c, index) => {
            const m = metricsById[c.id];
            const reg = c.companyRegistrationNumber?.trim();
            return (
              <TableRow key={c.id} className="border-white/[0.06]">
                <TableCell className="text-center tabular-nums text-muted-foreground">
                  {index + 1}
                </TableCell>
                <TableCell className="font-medium max-w-[220px] truncate">
                  {c.fullName}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground tabular-nums">
                  {reg || "—"}
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs font-bold tracking-wider">
                    {c.shortCode}
                  </span>
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  {formatDecimal(m?.totalWeight ?? 0, 1)}
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  {formatDecimal(m?.totalAreaM2 ?? 0, 2)}
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  {formatInteger(m?.totalQuantity ?? 0)}
                </TableCell>
                <TableCell className="text-center p-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    asChild
                  >
                    <Link
                      href={`/clients/${c.id}`}
                      title={t("pages.clients.table.viewAria")}
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                </TableCell>
                <TableCell className="text-center p-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                    type="button"
                    title={t("pages.clients.table.deleteAria")}
                    onClick={() => handleDelete(c)}
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
  );
}
