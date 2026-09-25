"use client";

import React, { useState } from "react";
import {
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  ShieldCheck,
  RotateCw,
  Eye,
  FileCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DatasetRecord, Workflow, SupportState } from "@/core/contracts";

interface DatasetViewProps {
  workflow: Workflow | null;
  records: DatasetRecord[];
  onSelectCell: (recordId: string, fieldName: string) => void;
  onExportCsv: (includeEvidence: boolean) => void;
  onExportJson: () => void;
  onRerun: (workflow: Workflow) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  supportFilter: SupportState | "all";
  setSupportFilter: (state: SupportState | "all") => void;
}

export function DatasetView({
  workflow,
  records,
  onSelectCell,
  onExportCsv,
  onExportJson,
  onRerun,
  searchQuery,
  setSearchQuery,
  supportFilter,
  setSupportFilter,
}: DatasetViewProps) {
  const [includeEvidenceInCsv, setIncludeEvidenceInCsv] = useState(true);

  if (!workflow) {
    return (
      <div className="w-full max-w-3xl mx-auto py-16 text-center space-y-4">
        <FileSpreadsheet className="size-10 text-muted-foreground mx-auto" />
        <h2 className="text-xl font-bold text-foreground">No Dataset Available</h2>
        <p className="text-sm text-muted-foreground">
          Run a research workflow to populate and explore structured datasets.
        </p>
      </div>
    );
  }

  const fields = workflow.fieldSchema;

  const renderCellIndicator = (record: DatasetRecord, fieldName: string) => {
    const evidence = record.evidence[fieldName];
    const supportState = evidence?.supportState ?? "missing";

    if (supportState === "supported") {
      return (
        <span
          className="size-2 rounded-full bg-emerald-500 shrink-0"
          title="Verified by primary citation"
        />
      );
    }
    if (supportState === "partially_supported") {
      return (
        <span
          className="size-2 rounded-full bg-amber-500 shrink-0"
          title="Partially supported by source"
        />
      );
    }
    if (supportState === "inferred") {
      return (
        <span
          className="size-2 rounded-full bg-purple-500 shrink-0"
          title="Contextually inferred"
        />
      );
    }
    return (
      <span
        className="size-2 rounded-full bg-muted-foreground/30 shrink-0"
        title="Explicitly missing from sources"
      />
    );
  };

  const renderCellValue = (record: DatasetRecord, fieldName: string) => {
    const val = record.data[fieldName];

    if (val === null || val === undefined) {
      return <span className="text-muted-foreground text-xs italic">— (missing)</span>;
    }

    if (Array.isArray(val)) {
      return (
        <span className="text-xs font-medium text-foreground line-clamp-1" title={val.join(", ")}>
          {val.join(", ")}
        </span>
      );
    }

    if (typeof val === "number") {
      return (
        <span className="text-xs font-mono font-medium text-foreground">
          {val >= 1000000 ? `$${(val / 1000000).toFixed(1)}M` : val.toLocaleString()}
        </span>
      );
    }

    const str = String(val);
    if (str.startsWith("http://") || str.startsWith("https://")) {
      return (
        <span className="text-xs text-sky-400 truncate max-w-[160px] inline-block hover:underline">
          {str.replace(/^https?:\/\//, "")}
        </span>
      );
    }

    return <span className="text-xs text-foreground line-clamp-1">{str}</span>;
  };

  return (
    <div className="w-full max-w-7xl mx-auto py-6 px-4 space-y-5 animate-in fade-in duration-300">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-indigo-400">
              Verified Dataset
            </span>
            <Badge variant="success" className="text-[10px]">
              {records.length} Verified Records
            </Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-1">
            {workflow.prompt}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Click any cell to view the exact supporting quote, source URL, and telemetry receipt.
          </p>
        </div>

        {/* Export Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/70 text-xs bg-card">
            <input
              type="checkbox"
              id="includeEv"
              checked={includeEvidenceInCsv}
              onChange={(e) => setIncludeEvidenceInCsv(e.target.checked)}
              className="size-3.5 rounded border-border text-primary cursor-pointer"
            />
            <label htmlFor="includeEv" className="text-[11px] text-muted-foreground cursor-pointer select-none">
              Include Citations
            </label>
          </div>

          <Button
            size="sm"
            onClick={() => onExportCsv(includeEvidenceInCsv)}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
          >
            <Download className="size-3.5" />
            <span>Download CSV</span>
          </Button>

          <Button variant="outline" size="sm" onClick={onExportJson} className="gap-1.5">
            <FileCode className="size-3.5" />
            <span>JSON</span>
          </Button>

          <Button variant="ghost" size="sm" onClick={() => onRerun(workflow)} className="gap-1.5 text-muted-foreground">
            <RotateCw className="size-3.5" />
            <span>Re-run</span>
          </Button>
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl border border-border/80 bg-card shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="size-4 absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search records, founders, locations..."
            className="pl-9 h-9 text-xs bg-background/50 border-border/70"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
            <Filter className="size-3.5" />
            Verification Status:
          </span>
          <select
            value={supportFilter}
            onChange={(e) => setSupportFilter(e.target.value as SupportState | "all")}
            className="h-9 text-xs rounded-lg border border-border/70 bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">All Records</option>
            <option value="supported">Verified Only (🟢)</option>
            <option value="partially_supported">Partially Verified (🟡)</option>
            <option value="inferred">Inferred (🟣)</option>
            <option value="missing">Contains Missing (⚪)</option>
          </select>
        </div>
      </div>

      {/* Spreadsheet Table */}
      <div className="rounded-2xl border border-border/80 bg-card shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40 border-b border-border">
              <TableRow>
                <TableHead className="w-10 text-center font-mono text-[11px]">#</TableHead>
                {fields.map((field) => (
                  <TableHead key={field.name} className="whitespace-nowrap text-xs font-semibold text-foreground py-3">
                    <div className="flex items-center gap-1.5">
                      <span>{field.name.replace(/_/g, " ")}</span>
                      <span className="text-[10px] text-muted-foreground font-mono font-normal">
                        ({field.type})
                      </span>
                    </div>
                  </TableHead>
                ))}
                <TableHead className="w-16 text-center text-xs font-medium text-muted-foreground">Audit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={fields.length + 2} className="h-32 text-center text-muted-foreground text-xs">
                    No records matched your search query.
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record, rowIdx) => (
                  <TableRow key={record.id} className="hover:bg-muted/30 transition-colors group">
                    <TableCell className="text-center font-mono text-[10px] text-muted-foreground">
                      {rowIdx + 1}
                    </TableCell>
                    {fields.map((field) => (
                      <TableCell
                        key={field.name}
                        onClick={() => onSelectCell(record.id, field.name)}
                        className="cursor-pointer hover:bg-indigo-500/5 transition-colors py-3"
                        title="Click to view citation & proof"
                      >
                        <div className="flex items-center gap-2">
                          {renderCellIndicator(record, field.name)}
                          <div className="truncate max-w-[220px]">
                            {renderCellValue(record, field.name)}
                          </div>
                        </div>
                      </TableCell>
                    ))}
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => onSelectCell(record.id, fields[0]?.name ?? "company_name")}
                        className="size-7 opacity-60 group-hover:opacity-100 hover:text-indigo-400"
                        title="Open Evidence Inspector"
                      >
                        <Eye className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Legend */}
      <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-semibold text-foreground">Status Legend:</span>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>Verified Source</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-500" />
            <span>Partial Source</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-purple-500" />
            <span>Context Inferred</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-muted-foreground/30" />
            <span>Missing (Truthful)</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-emerald-500" />
          <span>Sanitized against CSV injection formulas</span>
        </div>
      </div>
    </div>
  );
}
