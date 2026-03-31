"use client";

import { FileCode2 } from "lucide-react";

export function DxfQuotePhase() {
  return (
    <div className="max-w-lg mx-auto space-y-6 py-2">
      <div className="space-y-3 text-center sm:text-left">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <FileCode2 className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">DXF import</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Upload DXF files for geometry and quoting. In the next steps you will upload Excel BOM
          and DXF, then review matches — this screen will be expanded with DXF-specific options.
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed border-t border-border pt-4 mt-4">
          <span className="font-medium text-foreground">Material grade &amp; finish:</span> for bent
          or manually added plates, set <strong>Material grade</strong> (carbon steel defaults to{" "}
          <strong>S235</strong>) and <strong>Finish</strong> (Carbon, Galvanized, or Paint) in those
          quote methods.
        </p>
      </div>
    </div>
  );
}
