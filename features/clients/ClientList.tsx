"use client";

import { Users, Trash2, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { FileTypeBadge } from "@/components/shared/StatusBadge";
import { getFilesByClient } from "@/lib/store";
import type { Client } from "@/types";

interface ClientListProps {
  clients: Client[];
  onDelete?: (clientId: string) => void;
  expandedClientId?: string | null;
  onToggleExpand?: (clientId: string) => void;
}

export function ClientList({
  clients,
  onDelete,
  expandedClientId,
  onToggleExpand,
}: ClientListProps) {
  if (clients.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No clients yet"
        description="Add clients to this batch to begin uploading their DXF and Excel files."
      />
    );
  }

  return (
    <div className="space-y-2">
      {clients.map((client) => (
        <ClientRow
          key={client.id}
          client={client}
          onDelete={onDelete}
          isExpanded={expandedClientId === client.id}
          onToggle={() => onToggleExpand?.(client.id)}
        />
      ))}
    </div>
  );
}

interface ClientRowProps {
  client: Client;
  onDelete?: (id: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
}

function ClientRow({ client, onDelete, isExpanded, onToggle }: ClientRowProps) {
  const files = getFilesByClient(client.id);
  const dxfCount = files.filter((f) => f.type === "dxf").length;
  const excelCount = files.filter((f) => f.type === "excel").length;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={onToggle}
      >
        {/* Code badge */}
        <span className="inline-flex items-center justify-center h-8 w-12 rounded-md bg-primary text-primary-foreground text-xs font-bold font-mono tracking-wider shrink-0">
          {client.code}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{client.fullName}</p>
          <p className="text-xs text-muted-foreground">
            {files.length} file{files.length !== 1 ? "s" : ""} uploaded
            {dxfCount > 0 && ` · ${dxfCount} DXF`}
            {excelCount > 0 && ` · ${excelCount} Excel`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {dxfCount > 0 && <FileTypeBadge type="dxf" />}
          {excelCount > 0 && <FileTypeBadge type="excel" />}
          {onDelete && (
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
          )}
        </div>
      </div>
    </div>
  );
}
