"use client";

import Link from "next/link";
import { Eye, Pencil, UserX, UserCheck } from "lucide-react";
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
import type { Client, ClientMetrics } from "@/types";
import { saveClient } from "@/lib/store";

export interface ClientsTableProps {
  clients: Client[];
  metricsById: Record<string, ClientMetrics>;
  onStatusToggled?: () => void;
}

export function ClientsTable({
  clients,
  metricsById,
  onStatusToggled,
}: ClientsTableProps) {
  function toggleStatus(c: Client) {
    const next = c.status === "active" ? "inactive" : "active";
    saveClient({
      ...c,
      status: next,
      updatedAt: new Date().toISOString(),
    });
    onStatusToggled?.();
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Client</TableHead>
            <TableHead className="w-[72px]">Code</TableHead>
            <TableHead className="text-right tabular-nums">Batches</TableHead>
            <TableHead className="text-right tabular-nums">Parts</TableHead>
            <TableHead className="text-right tabular-nums">Qty</TableHead>
            <TableHead className="text-right tabular-nums">Weight (kg)</TableHead>
            <TableHead>Last batch</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[140px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((c) => {
            const m = metricsById[c.id];
            return (
              <TableRow key={c.id}>
                <TableCell className="font-medium max-w-[200px] truncate">
                  {c.fullName}
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs font-bold tracking-wider">
                    {c.shortCode}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {m?.totalBatches ?? 0}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {m?.totalParts ?? 0}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {m?.totalQuantity ?? 0}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {(m?.totalWeight ?? 0).toFixed(1)}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {m?.lastBatchDate
                    ? new Date(m.lastBatchDate).toLocaleDateString()
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={c.status === "active" ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {c.status === "active" ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <Link href={`/clients/${c.id}`} title="View">
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <Link href={`/clients/${c.id}/edit`} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title={c.status === "active" ? "Deactivate" : "Activate"}
                      onClick={() => toggleStatus(c)}
                    >
                      {c.status === "active" ? (
                        <UserX className="h-4 w-4" />
                      ) : (
                        <UserCheck className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
