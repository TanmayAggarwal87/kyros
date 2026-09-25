"use client";

import React, { useState } from "react";
import {
  X,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  Receipt,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SelectedEvidenceItem } from "@/lib/use-workflow-store";

interface EvidenceDrawerProps {
  selectedItem: SelectedEvidenceItem | null;
  onClose: () => void;
}

export function EvidenceDrawer({ selectedItem, onClose }: EvidenceDrawerProps) {
  const [showTechnicalAudit, setShowTechnicalAudit] = useState(false);

  if (!selectedItem) return null;

  const { record, fieldName } = selectedItem;
  const rawValue = record.data[fieldName];
  const evidence = record.evidence[fieldName];

  const formatDisplayValue = (val: unknown) => {
    if (val === null || val === undefined) {
      return <span className="text-muted-foreground italic">— (missing)</span>;
    }
    if (Array.isArray(val)) {
      return (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {val.map((item, idx) => (
            <span
              key={idx}
              className="px-2.5 py-1 rounded-lg bg-muted text-xs font-mono font-medium text-foreground border border-border/60"
            >
              {String(item)}
            </span>
          ))}
        </div>
      );
    }
    if (typeof val === "number") {
      return <span className="font-mono font-bold text-lg">${val.toLocaleString()}</span>;
    }
    return <span className="font-semibold text-base">{String(val)}</span>;
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[460px] bg-background/95 backdrop-blur-2xl border-l border-border shadow-2xl flex flex-col transition-transform animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="p-5 border-b border-border/70 flex items-center justify-between bg-muted/20">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-indigo-400">
              Source Provenance
            </span>
            <Badge variant="outline" className="text-[10px] font-mono">
              {record.id}
            </Badge>
          </div>
          <h2 className="text-lg font-bold text-foreground capitalize mt-0.5">
            {fieldName.replace(/_/g, " ")}
          </h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="size-8 rounded-lg">
          <X className="size-4" />
        </Button>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Extracted Value Card */}
        <div className="p-4 rounded-2xl border border-border/80 bg-card shadow-sm space-y-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Extracted Field Value
          </span>
          <div className="text-foreground pt-1">{formatDisplayValue(rawValue)}</div>
        </div>

        {/* Verification Status Banner */}
        <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
            <ShieldCheck className="size-4" />
            <span>
              {evidence?.supportState === "supported"
                ? "Verified with Primary Source Citation"
                : evidence?.supportState === "partially_supported"
                ? "Partially Verified by Citation"
                : evidence?.supportState === "inferred"
                ? "Contextually Inferred by Model"
                : "Explicitly Missing from Available Sources"}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed pl-5">
            {evidence?.supportState === "supported"
              ? "This value was extracted verbatim from verified third-party source documents."
              : evidence?.supportState === "missing"
              ? "Kyros adheres to strict truthfulness: missing values are never fabricated."
              : "This value was derived from surrounding textual context in source articles."}
          </p>
        </div>

        {/* Verbatim Citation Quote */}
        {evidence?.snippet && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="size-3.5 text-indigo-400" />
              <span>Verbatim Citation Quote</span>
            </div>

            <div className="p-4 rounded-2xl border border-border/80 bg-card text-xs text-foreground leading-relaxed italic relative">
              <span className="text-2xl text-muted-foreground/30 absolute top-1 left-2 select-none">&ldquo;</span>
              <p className="pl-4 pr-1">{evidence.snippet}</p>
            </div>
          </div>
        )}

        {/* Canonical Source Link */}
        {evidence?.sourceUrl && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <LinkIcon className="size-3.5 text-indigo-400" />
              <span>Verified Source Link</span>
            </div>

            <div className="p-3.5 rounded-2xl border border-border/80 bg-card space-y-2">
              {evidence.sourceTitle && (
                <div className="text-xs font-semibold text-foreground line-clamp-1">
                  {evidence.sourceTitle}
                </div>
              )}
              <a
                href={evidence.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 break-all font-mono"
              >
                <span>{evidence.sourceUrl}</span>
                <ExternalLink className="size-3 shrink-0" />
              </a>
            </div>
          </div>
        )}

        {/* Optional Collapsible Technical & x402 Audit */}
        {evidence?.acquisitionMethod === "x402_paid" && evidence.transactionReceipt && (
          <div className="pt-2 border-t border-border/60">
            <button
              type="button"
              onClick={() => setShowTechnicalAudit(!showTechnicalAudit)}
              className="w-full flex items-center justify-between text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors py-2"
            >
              <div className="flex items-center gap-1.5">
                <Receipt className="size-3.5" />
                <span>Base Sepolia x402 Settlement Audit</span>
              </div>
              {showTechnicalAudit ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>

            {showTechnicalAudit && (
              <div className="p-3.5 rounded-2xl border border-purple-500/30 bg-purple-500/5 space-y-2.5 text-xs animate-in slide-in-from-top-1 duration-200 mt-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Network:</span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {evidence.transactionReceipt.network ?? "Base Sepolia (84532)"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Treasury Settlement:</span>
                  <Badge variant="success" className="text-[10px]">
                    Confirmed
                  </Badge>
                </div>

                {evidence.costUsd !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Settlement Cost:</span>
                    <span className="font-mono font-semibold text-foreground">
                      ${evidence.costUsd.toFixed(3)} USD
                    </span>
                  </div>
                )}

                {evidence.transactionReceipt.hash && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground text-[11px]">Tx Hash (BaseScan):</span>
                    <a
                      href={`https://sepolia.basescan.org/tx/${evidence.transactionReceipt.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] text-indigo-400 hover:underline flex items-center gap-1 break-all bg-background/60 p-2 rounded-lg border border-border/60"
                    >
                      <span>{evidence.transactionReceipt.hash}</span>
                      <ExternalLink className="size-3 shrink-0" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drawer Footer */}
      <div className="p-4 border-t border-border/70 bg-muted/20 flex items-center justify-end">
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
