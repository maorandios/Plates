"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  FileText,
  TableProperties,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { BatchStatusBadge } from "@/components/shared/StatusBadge";
import { AddClientForm } from "@/features/clients/AddClientForm";
import { ClientList } from "@/features/clients/ClientList";
import { FileUploadZone } from "@/features/uploads/FileUploadZone";
import { FileList } from "@/features/uploads/FileList";
import {
  getBatchById,
  getClientsByBatch,
  getFilesByClient,
  deleteClient,
  saveBatch,
} from "@/lib/store";
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

  function handleClientAdded(client: Client) {
    reload();
    setExpandedClientId(client.id);
  }

  function handleDeleteClient(clientId: string) {
    deleteClient(clientId);
    // Update batch
    const b = getBatchById(batchId);
    if (b) {
      saveBatch({
        ...b,
        clientIds: b.clientIds.filter((cid) => cid !== clientId),
        updatedAt: new Date().toISOString(),
      });
    }
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

  if (!batch) return null;

  const totalFiles = clients.reduce(
    (sum, c) => sum + getFilesByClient(c.id).length,
    0
  );

  return (
    <PageContainer>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/batches">
            <ArrowLeft className="h-4 w-4 mr-1" />
            All Batches
          </Link>
        </Button>
      </div>

      <PageHeader
        title={batch.name}
        description={batch.notes}
        actions={
          <div className="flex items-center gap-2">
            <BatchStatusBadge status={batch.status} />
            <Button variant="outline" size="sm" asChild>
              <Link href={`/batches/${batchId}/parts`}>
                <TableProperties className="h-4 w-4 mr-2" />
                Parts Review
              </Link>
            </Button>
          </div>
        }
      />

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
        {/* Add Client */}
        <Card className="border border-border shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Add Client</CardTitle>
            <CardDescription>
              Each client gets a unique 3-character code for plate marking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddClientForm batchId={batchId} onClientAdded={handleClientAdded} />
          </CardContent>
        </Card>

        {/* Clients */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Clients ({clients.length})
          </h2>

          <div className="space-y-2">
            {clients.map((client) => (
              <ClientExpandable
                key={client.id}
                client={client}
                batchId={batchId}
                isExpanded={expandedClientId === client.id}
                onToggle={() => handleToggleExpand(client.id)}
                onDelete={handleDeleteClient}
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
                  Add clients above to start uploading files
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

// ─── Expandable client row ────────────────────────────────────────────────────

interface ClientExpandableProps {
  client: Client;
  batchId: string;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: (id: string) => void;
  onFilesUploaded: () => void;
  fileRefreshKey: number;
}

function ClientExpandable({
  client,
  batchId,
  isExpanded,
  onToggle,
  onDelete,
  onFilesUploaded,
  fileRefreshKey,
}: ClientExpandableProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);

  useEffect(() => {
    setFiles(getFilesByClient(client.id));
  }, [client.id, fileRefreshKey]);

  const dxfCount = files.filter((f) => f.type === "dxf").length;
  const excelCount = files.filter((f) => f.type === "excel").length;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-muted/30 transition-colors select-none"
        onClick={onToggle}
      >
        <span className="inline-flex items-center justify-center h-8 w-12 rounded-md bg-primary text-primary-foreground text-xs font-bold font-mono tracking-wider shrink-0">
          {client.code}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {client.fullName}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {files.length === 0
              ? "No files uploaded"
              : `${files.length} file${files.length !== 1 ? "s" : ""} · ${dxfCount} DXF · ${excelCount} Excel`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(client.id);
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
        <div className="px-4 pb-4 pt-1 border-t border-border bg-muted/20">
          <div className="mb-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Upload Files
            </h4>
            <FileUploadZone
              clientId={client.id}
              batchId={batchId}
              onFilesUploaded={onFilesUploaded}
            />
          </div>

          {files.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Uploaded Files
              </h4>
              <p className="text-[11px] text-muted-foreground mb-2 leading-snug">
                DXF entries show parse status, detected drawing units (header / inferred), and
                upload time. Unknown units do not block upload.
              </p>
              <FileList
                files={files}
                onFileDeleted={() => {
                  setFiles(getFilesByClient(client.id));
                  onFilesUploaded();
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
