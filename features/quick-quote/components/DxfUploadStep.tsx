"use client";

import { useState, useCallback, useMemo } from "react";
import { Upload, FileIcon, CheckCircle2, AlertCircle, X, Check, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { formatDecimal } from "@/lib/formatNumbers";
import { cn } from "@/lib/utils";
import { parseDxfFile } from "@/lib/parsers/dxfParser";
import { getMaterialConfig } from "@/lib/settings/materialConfig";
import { PlateGeometryCanvas } from "@/components/parts/PlateGeometryCanvas";
import type { DxfPartGeometry, ProcessedGeometry } from "@/types";
import type { MaterialType } from "@/types/materials";

type DxfSubStep = 1 | 2 | 3;

const SUB_STEPS = [
  { step: 1 as DxfSubStep, label: "Upload DXF" },
  { step: 2 as DxfSubStep, label: "Parse Files" },
  { step: 3 as DxfSubStep, label: "Review Parts" },
];

interface DxfFileUpload {
  file: File;
  content: string;
  parsed: DxfPartGeometry | null;
  parseError: string | null;
}

interface DxfMetrics {
  totalFiles: number;
  validParts: number;
  errorParts: number;
  totalArea: number;
  totalWeight: number;
  totalPerimeter: number;
}

interface DxfUploadStepProps {
  materialType: MaterialType;
  defaultThickness?: number;
  onDataApproved: (data: DxfPartGeometry[]) => void;
}

export function DxfUploadStep({ materialType, defaultThickness = 10, onDataApproved }: DxfUploadStepProps) {
  const [subStep, setSubStep] = useState<DxfSubStep>(1);
  const [uploadedFiles, setUploadedFiles] = useState<DxfFileUpload[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewGeometry, setPreviewGeometry] = useState<DxfPartGeometry | null>(null);

  const handleFilesSelect = useCallback(async (files: FileList | File[]) => {
    setUploadError(null);
    
    const fileArray = Array.from(files).filter(f => 
      f.name.toLowerCase().endsWith('.dxf')
    );

    if (fileArray.length === 0) {
      setUploadError("Please select at least one DXF file");
      return;
    }

    try {
      const uploads: DxfFileUpload[] = await Promise.all(
        fileArray.map(async (file) => {
          const content = await file.text();
          return {
            file,
            content,
            parsed: null,
            parseError: null,
          };
        })
      );

      setUploadedFiles(prev => [...prev, ...uploads]);
      setSubStep(2);
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Failed to read DXF files"
      );
    }
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFilesSelect(e.target.files);
      }
    },
    [handleFilesSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFilesSelect(e.dataTransfer.files);
      }
    },
    [handleFilesSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    if (uploadedFiles.length === 1) {
      setSubStep(1);
    }
  }, [uploadedFiles.length]);

  const handleParseFiles = useCallback(() => {
    const parsed = uploadedFiles.map((upload) => {
      try {
        const result = parseDxfFile(
          upload.content,
          `dxf-${Date.now()}-${Math.random()}`,
          upload.file.name,
          "temp-client-id",
          "temp-batch-id"
        );

        return {
          ...upload,
          parsed: { id: `parsed-${Date.now()}-${Math.random()}`, ...result.geometry },
          parseError: result.warnings.length > 0 ? result.warnings.join("; ") : null,
        };
      } catch (error) {
        return {
          ...upload,
          parsed: null,
          parseError: error instanceof Error ? error.message : "Failed to parse DXF",
        };
      }
    });

    setUploadedFiles(parsed);
    setSubStep(3);
  }, [uploadedFiles]);

  const handleBackToUpload = useCallback(() => {
    setSubStep(1);
  }, []);

  const handleBackToParse = useCallback(() => {
    setSubStep(2);
  }, []);

  const handleContinueToNextPhase = useCallback(() => {
    const validGeometries = uploadedFiles
      .filter(u => u.parsed !== null)
      .map(u => u.parsed!);
    
    if (validGeometries.length > 0) {
      onDataApproved(validGeometries);
    }
  }, [uploadedFiles, onDataApproved]);

  const metrics = useMemo((): DxfMetrics => {
    const validParts = uploadedFiles.filter(u => u.parsed?.processedGeometry?.isValid);
    
    // Get density from material configuration
    const materialConfig = getMaterialConfig(materialType);
    const densityKgPerM3 = materialConfig.densityKgPerM3;
    
    let totalArea = 0;
    let totalWeight = 0;
    let totalPerimeter = 0;

    validParts.forEach(u => {
      const geom = u.parsed?.processedGeometry;
      if (geom) {
        totalArea += geom.area / 1000000; // mm² to m²
        totalPerimeter += geom.perimeter;
        // Calculate weight: area (m²) × thickness (m) × density (kg/m³)
        const areaM2 = geom.area / 1000000;
        const thicknessMm = defaultThickness;
        const volumeM3 = areaM2 * (thicknessMm / 1000);
        totalWeight += volumeM3 * densityKgPerM3;
      }
    });

    return {
      totalFiles: uploadedFiles.length,
      validParts: validParts.length,
      errorParts: uploadedFiles.length - validParts.length,
      totalArea,
      totalWeight,
      totalPerimeter,
    };
  }, [uploadedFiles, materialType, defaultThickness]);

  const getStatusColor = (geometry: DxfPartGeometry | null): "success" | "error" | "warning" => {
    if (!geometry || !geometry.processedGeometry) return "error";
    if (geometry.processedGeometry.status === "valid") return "success";
    if (geometry.processedGeometry.status === "warning") return "warning";
    return "error";
  };

  return (
    <div className="space-y-6">
      {/* Sub-Stepper */}
      <Card className="border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-2">
            {SUB_STEPS.map(({ step, label }, index) => {
              const isComplete = step < subStep;
              const isCurrent = step === subStep;

              return (
                <div key={step} className="flex items-center flex-1 last:flex-none">
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                        isComplete && "border-emerald-600 bg-emerald-600 text-white",
                        isCurrent && !isComplete && "border-primary bg-primary text-primary-foreground",
                        !isCurrent && !isComplete && "border-muted-foreground/30 bg-muted/50 text-muted-foreground"
                      )}
                    >
                      {isComplete ? <Check className="h-4 w-4" /> : step}
                    </div>
                    <span
                      className={cn(
                        "text-sm font-medium whitespace-nowrap",
                        isCurrent && "text-foreground",
                        !isCurrent && isComplete && "text-emerald-600",
                        !isCurrent && !isComplete && "text-muted-foreground"
                      )}
                    >
                      {label}
                    </span>
                  </div>
                  {index < SUB_STEPS.length - 1 && (
                    <div
                      className={cn(
                        "h-0.5 flex-1 mx-3",
                        step < subStep ? "bg-emerald-600" : "bg-border"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Upload DXF */}
      {subStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload DXF Files</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Upload part geometry files (multiple files supported)
            </p>
          </CardHeader>
          <CardContent>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={cn(
                "border-2 border-dashed rounded-lg p-12 text-center transition-colors",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div className="flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Drag and drop DXF files here
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    or click to browse (multiple files allowed)
                  </p>
                </div>
                <input
                  type="file"
                  accept=".dxf"
                  multiple
                  onChange={handleFileInputChange}
                  className="hidden"
                  id="dxf-upload"
                />
                <Button asChild variant="outline">
                  <label htmlFor="dxf-upload" className="cursor-pointer">
                    <FileIcon className="h-4 w-4 mr-2" />
                    Choose Files
                  </label>
                </Button>
              </div>
            </div>
            
            {uploadedFiles.length > 0 && (
              <div className="mt-6 space-y-2">
                <p className="text-sm font-medium">
                  {uploadedFiles.length} file{uploadedFiles.length !== 1 ? "s" : ""} ready
                </p>
                <div className="space-y-2">
                  {uploadedFiles.map((upload, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{upload.file.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {formatDecimal(upload.file.size / 1024, 1)} KB
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFile(index)}
                        className="shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {uploadError && (
              <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">{uploadError}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Parse Files */}
      {subStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Parse DXF Files</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Extract geometry and part data from uploaded files
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 border">
                <p className="text-sm font-medium mb-2">
                  {uploadedFiles.length} file{uploadedFiles.length !== 1 ? "s" : ""} ready to parse
                </p>
                <p className="text-xs text-muted-foreground">
                  Click the button below to extract geometry, dimensions, and material information from your DXF files.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={handleBackToUpload}>
                  Back to Upload
                </Button>
                <Button onClick={handleParseFiles} size="lg">
                  Parse All Files
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review Parts */}
      {subStep === 3 && uploadedFiles.length > 0 && (
        <>
          {/* Parts Table */}
          <Card>
            <CardHeader>
              <CardTitle>DXF Parts Data</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Parsed geometry and part information
              </p>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Part Number</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Width (mm)</TableHead>
                      <TableHead>Length (mm)</TableHead>
                      <TableHead>Weight (kg)</TableHead>
                      <TableHead>Area (m²)</TableHead>
                      <TableHead>Perimeter (mm)</TableHead>
                      <TableHead>Piercing</TableHead>
                      <TableHead>Preview</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploadedFiles.map((upload, index) => {
                      const geom = upload.parsed?.processedGeometry;
                      const bbox = geom?.boundingBox;
                      const status = getStatusColor(upload.parsed);
                      const hasError = upload.parseError !== null;

                      // Calculate weight using material density
                      const materialConfig = getMaterialConfig(materialType);
                      const densityKgPerM3 = materialConfig.densityKgPerM3;
                      const weight = geom 
                        ? (geom.area / 1000000) * (defaultThickness / 1000) * densityKgPerM3
                        : 0;

                      return (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {upload.parsed?.guessedPartName || upload.file.name.replace('.dxf', '')}
                          </TableCell>
                          <TableCell>
                            {upload.parsed?.materialGrade || "-"}
                          </TableCell>
                          <TableCell>
                            {bbox ? formatDecimal(bbox.width, 1) : "-"}
                          </TableCell>
                          <TableCell>
                            {bbox ? formatDecimal(bbox.height, 1) : "-"}
                          </TableCell>
                          <TableCell>
                            {weight > 0 ? formatDecimal(weight, 2) : "-"}
                          </TableCell>
                          <TableCell>
                            {geom ? formatDecimal(geom.area / 1000000, 4) : "-"}
                          </TableCell>
                          <TableCell>
                            {geom ? formatDecimal(geom.perimeter, 1) : "-"}
                          </TableCell>
                          <TableCell>
                            {geom?.preparation?.manufacturing?.cutInner?.length || 0}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPreviewGeometry(upload.parsed)}
                              className="h-7 w-7 p-0"
                              disabled={!upload.parsed}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                          <TableCell>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={cn(
                                      "h-2.5 w-2.5 rounded-full cursor-pointer",
                                      status === "success" && "bg-emerald-600",
                                      status === "warning" && "bg-amber-500",
                                      status === "error" && "bg-destructive"
                                    )}
                                  />
                                </TooltipTrigger>
                                {(status === "error" || status === "warning") && hasError && (
                                  <TooltipContent side="left" className="max-w-xs">
                                    <p className="text-xs">{upload.parseError}</p>
                                  </TooltipContent>
                                )}
                                {status === "success" && (
                                  <TooltipContent side="left">
                                    <p className="text-xs">Valid geometry</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={handleBackToParse}>
              Back to Parse
            </Button>
            <Button
              onClick={handleContinueToNextPhase}
              size="lg"
              className="gap-2"
              disabled={metrics.validParts === 0}
            >
              <CheckCircle2 className="h-4 w-4" />
              Continue to Next Phase
            </Button>
          </div>
        </>
      )}

      {/* Preview Modal */}
      <Dialog open={previewGeometry !== null} onOpenChange={(open) => !open && setPreviewGeometry(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Part Preview</DialogTitle>
            <DialogDescription>
              {previewGeometry?.guessedPartName || "DXF Part"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto max-h-[calc(90vh-200px)]">
            {previewGeometry?.processedGeometry && (
              <>
                {/* Geometry Canvas */}
                <div className="rounded-lg border bg-muted/10 p-4">
                  <PlateGeometryCanvas
                    geometry={previewGeometry.processedGeometry}
                    unitSystem="metric"
                    width={800}
                    height={500}
                    debugMode={false}
                  />
                </div>

                {/* Parameters */}
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm font-semibold mb-3">Part Parameters</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Width:</span>
                      <span className="ml-2 font-medium">
                        {formatDecimal(previewGeometry.processedGeometry.boundingBox.width, 2)} mm
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Height:</span>
                      <span className="ml-2 font-medium">
                        {formatDecimal(previewGeometry.processedGeometry.boundingBox.height, 2)} mm
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Area:</span>
                      <span className="ml-2 font-medium">
                        {formatDecimal(previewGeometry.processedGeometry.area / 1000000, 4)} m²
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Perimeter:</span>
                      <span className="ml-2 font-medium">
                        {formatDecimal(previewGeometry.processedGeometry.perimeter, 2)} mm
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Holes:</span>
                      <span className="ml-2 font-medium">
                        {previewGeometry.processedGeometry.holes?.length || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Entities:</span>
                      <span className="ml-2 font-medium">
                        {previewGeometry.entityCount}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
            {!previewGeometry?.processedGeometry && (
              <div className="p-8 rounded-lg bg-muted/30 text-center">
                <p className="text-sm text-muted-foreground">
                  No geometry data available
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setPreviewGeometry(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

