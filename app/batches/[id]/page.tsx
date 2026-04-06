"use client";

import { useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Users,
  FileText,
  ChevronDown,
  ChevronUp,
  Trash2,
  UserPlus,
  LayoutGrid,
  Package,
  ScanSearch,
  Weight,
  Upload,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/shared/PageContainer";
import { ClientPicker } from "@/features/clients/components/ClientPicker";
import { FileList } from "@/features/uploads/FileList";
import { ClientImportWizardModal } from "@/features/uploads/ClientImportWizardModal";
import { ClientDxfTable } from "@/features/uploads/ClientDxfTable";
import {
  getBatchById,
  getClientsByBatch,
  getFilesByClientAndBatch,
  getPartsByBatch,
  unlinkClientFromBatch,
  saveBatch,
} from "@/lib/store";
import { plateTypeDedupeKey } from "@/lib/parts/plateTypeKey";
import { estimateDxfTotalWeightKg } from "@/lib/parts/excelDxfValidation";
import type { Batch, Client, UploadedFile } from "@/types";
import {
  CUTTING_METHOD_LABELS,
  CUTTING_METHOD_OPTIONS,
} from "@/types/production";
import type { CuttingMethod } from "@/types/production";

function useBatchIdParam(): string {
  const params = useParams();
  const raw = params?.id;
  return typeof raw === "string" ? raw : Array.isArray(raw) ? (raw[0] ?? "") : "";
}

export default function BatchDetailsPage() {
  const batchId = useBatchIdParam();
  const router = useRouter();

  const [batch, setBatch] = useState<Batch | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [fileRefreshKey, setFileRefreshKey] = useState(0);
  const [addClientOpen, setAddClientOpen] = useState(false);

  const reload = useCallback(() => {
    if (!batchId) return;
    const b = getBatchById(batchId);
    if (!b) {
      router.push("/batches");
      return;
    }
    setBatch(b);
    setClients(getClientsByBatch(batchId));
  }, [batchId, router]);

  useEffect(() => {
    reload();
  }, [reload]);

  function handleRemoveClientFromBatch(clientId: string) {
    unlinkClientFromBatch(batchId, clientId);
    reload();
  }

  function handleFilesUploaded() {
    setFileRefreshKey((k) => k + 1);
    reload();
  }

  function handleToggleExpand(clientId: string) {
    setExpandedClientId((prev) => (prev === clientId ? null : clientId));
  }

  function handleCuttingMethodChange(method: CuttingMethod) {
    if (!batch) return;
    const next = {
      ...batch,
      cuttingMethod: method,
      updatedAt: new Date().toISOString(),
    };
    saveBatch(next);
    setBatch(next);
  }

  const batchStats = useMemo(() => {
    const parts = getPartsByBatch(batchId);
    const plateTypes = new Set(parts.map(plateTypeDedupeKey)).size;
    const platesQuantity = parts.reduce((s, p) => s + (p.quantity ?? 1), 0);
    let platesAreaM2 = 0;
    let totalWeightKg = 0;
    for (const p of parts) {
      const q = p.quantity ?? 1;
      if (p.dxfArea != null && p.dxfArea > 0) {
        platesAreaM2 += (p.dxfArea / 1_000_000) * q;
      }
      const w = estimateDxfTotalWeightKg(p);
      if (w != null) totalWeightKg += w;
    }
    return {
      plateTypes,
      platesQuantity,
      platesAreaM2,
      totalWeightT: totalWeightKg / 1000,
    };
  }, [batchId, fileRefreshKey, clients.length]);

  if (!batch) return null;

  const totalFiles = clients.reduce(
    (sum, c) => sum + getFilesByClientAndBatch(c.id, batchId).length,
    0
  );

  return (
    <PageContainer embedded>
      <ClientPicker
        open={addClientOpen}
        onOpenChange={setAddClientOpen}
        batchId={batchId}
        linkedClientIds={batch.clientIds}
        onLinked={reload}
      />

      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground tracking-tight">
          Import data
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Link clients, upload DXF and Excel files for this quote job, then continue to review parts.
        </p>
      </div>

      {/* Batch totals — from last saved Parts Review table */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        <BatchStatCard
          title="Clients"
          value={formatInteger(clients.length)}
          icon={Users}
        />
        <BatchStatCard
          title="Plate types"
          value={formatInteger(batchStats.plateTypes)}
          icon={LayoutGrid}
        />
        <BatchStatCard
          title="Plates quantity"
          value={formatInteger(batchStats.platesQuantity)}
          icon={Package}
        />
        <BatchStatCard
          title="Total area (m²)"
          value={formatDecimal(batchStats.platesAreaM2, 2)}
          icon={ScanSearch}
        />
        <BatchStatCard
          title="Total weight (t)"
          value={formatDecimal(batchStats.totalWeightT, 3)}
          icon={Weight}
          className="col-span-2 sm:col-span-1 lg:col-span-1"
        />
      </div>
      <p className="text-[11px] text-muted-foreground mb-6">
        Part totals use the saved parts table. Go to{" "}
        <Link href={`/batches/${batchId}/parts`} className="underline hover:text-foreground">
          Review parts
        </Link>{" "}
        (step 2) and click Rebuild Table to refresh after new uploads, or use{" "}
        <span className="font-medium text-foreground">Continue</span> above.
      </p>

      {/* Summary chips */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>
            {clients.length} client{clients.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span>
            {totalFiles} file{totalFiles !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="shrink-0">Cutting</span>
          <Select
            value={batch.cuttingMethod}
            onValueChange={(v) => handleCuttingMethodChange(v as CuttingMethod)}
          >
            <SelectTrigger className="h-8 w-[132px] text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CUTTING_METHOD_OPTIONS.map((m) => (
                <SelectItem key={m} value={m}>
                  {CUTTING_METHOD_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="text-xs text-muted-foreground">
          Created {new Date(batch.createdAt).toLocaleDateString()}
        </div>
      </div>

      <div className="space-y-6">
        {/* Clients */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Clients ({clients.length})
            </h2>
            <Button type="button" size="sm" onClick={() => setAddClientOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add clients
            </Button>
          </div>

          <div className="space-y-2">
            {clients.map((client) => (
              <ClientExpandable
                key={client.id}
                client={client}
                batchId={batchId}
                isExpanded={expandedClientId === client.id}
                onToggle={() => handleToggleExpand(client.id)}
                onRemoveFromBatch={handleRemoveClientFromBatch}
                onFilesUploaded={handleFilesUploaded}
                fileRefreshKey={fileRefreshKey}
              />
            ))}

            {clients.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-10 text-center">
                <Users className="h-8 w-8 text-muted-foreground mb-2" strokeWidth={1.5} />
                <p className="text-sm font-medium text-foreground mb-0.5">
                  No clients yet
                </p>
                <p className="text-xs text-muted-foreground">
                  Add clients from your directory or create one with quick create, then upload files
                  for this batch.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function BatchStatCard({
  title,
  value,
  icon: Icon,
  className,
}: {
  title: string;
  value: ReactNode;
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <Card className={`shadow-none ${className ?? ""}`}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              {title}
            </p>
            <p className="text-2xl font-bold tabular-nums text-foreground mt-1 leading-none">
              {value}
            </p>
          </div>
          <Icon className="h-5 w-5 text-muted-foreground/50 shrink-0 mt-0.5" strokeWidth={1.75} />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Expandable client row ────────────────────────────────────────────────────

interface ClientExpandableProps {
  client: Client;
  batchId: string;
  isExpanded: boolean;
  onToggle: () => void;
  onRemoveFromBatch: (id: string) => void;
  onFilesUploaded: () => void;
  fileRefreshKey: number;
}

function ClientExpandable({
  client,
  batchId,
  isExpanded,
  onToggle,
  onRemoveFromBatch,
  onFilesUploaded,
  fileRefreshKey,
}: ClientExpandableProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [importWizardOpen, setImportWizardOpen] = useState(false);

  useEffect(() => {
    setFiles(getFilesByClientAndBatch(client.id, batchId));
  }, [client.id, batchId, fileRefreshKey]);

  const dxfCount = files.filter((f) => f.type === "dxf").length;
  const excelCount = files.filter((f) => f.type === "excel").length;
  const excelFiles = files.filter((f) => f.type === "excel");

  function refreshClientFiles() {
    setFiles(getFilesByClientAndBatch(client.id, batchId));
    onFilesUploaded();
  }

  return (
    <div className="rounded-xl bg-card overflow-hidden">
      <ClientImportWizardModal
        open={importWizardOpen}
        onOpenChange={setImportWizardOpen}
        clientId={client.id}
        batchId={batchId}
        onFinished={onFilesUploaded}
      />

      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-muted/30 transition-colors select-none"
        onClick={onToggle}
      >
        <span className="inline-flex items-center justify-center h-8 w-12 rounded-md bg-primary text-primary-foreground text-xs font-bold font-mono tracking-wider shrink-0">
          {client.shortCode}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {client.fullName}
          </p>
          <div
            className="flex flex-wrap items-center gap-2 mt-1.5"
            role="group"
            aria-label="File counts by type"
          >
            <div className="inline-flex items-center gap-1.5 rounded-md bg-muted/35 px-2 py-0.5 text-[11px]">
              <span className="text-muted-foreground font-medium">DXF</span>
              <span className="tabular-nums font-semibold text-foreground">
                {dxfCount}
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-md bg-muted/35 px-2 py-0.5 text-[11px]">
              <span className="text-muted-foreground font-medium">Excel</span>
              <span className="tabular-nums font-semibold text-foreground">
                {excelCount}
              </span>
            </div>
            {files.length > 0 && (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {files.length} file{files.length !== 1 ? "s" : ""} total
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            title="Remove from this batch"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveFromBatch(client.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border bg-muted/20 space-y-4">
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Import
            </h4>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  setImportWizardOpen(true);
                }}
              >
                <Upload className="h-4 w-4" />
                Import files
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
              Multi-step import: DXF parse, optional Excel with column mapping, then review parts in the table below.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              DXF plates
            </h4>
            <ClientDxfTable
              files={files}
              onFileDeleted={refreshClientFiles}
              emptyHint="No DXF files yet. Click Import files to add drawings."
            />
          </div>

          {excelFiles.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Excel files
              </h4>
              <p className="text-[11px] text-muted-foreground mb-2 leading-snug">
                Spreadsheet rows linked to this client after mapping in the import wizard.
              </p>
              <FileList files={excelFiles} onFileDeleted={refreshClientFiles} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
