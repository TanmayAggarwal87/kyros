"use client";

import React from "react";
import {
  Database,
  Layers,
  Play,
  ArrowLeft,
  Coins,
  ShieldCheck,
  Search,
  FileCheck2,
  GitFork,
  ArrowRight,
  Zap,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { PlannerPlan, Workflow } from "@/core/contracts";

interface PlanReviewViewProps {
  workflow: Workflow | null;
  plan: PlannerPlan | null;
  onApproveAndStart: () => Promise<void>;
  onBackToEdit: () => void;
  isStarting: boolean;
  availableCredits: number;
  creditsStatus: "live" | "unavailable";
}

export function PlanReviewView({
  workflow,
  plan,
  onApproveAndStart,
  onBackToEdit,
  isStarting,
  availableCredits,
  creditsStatus,
}: PlanReviewViewProps) {
  if (!workflow || !plan) {
    return (
      <div className="w-full max-w-3xl mx-auto py-16 text-center space-y-4">
        <Database className="size-10 text-muted-foreground mx-auto" />
        <h2 className="text-xl font-bold text-foreground font-mono">NO ACTIVE PLAN</h2>
        <p className="text-xs text-muted-foreground">
          Enter a prompt in the Research Console to compile an execution graph.
        </p>
        <Button onClick={onBackToEdit}>Return to Research Console</Button>
      </div>
    );
  }

  const getTypeBadgeStyle = (type: string) => {
    switch (type.toLowerCase()) {
      case "string":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      case "number":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "array":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "url":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      default:
        return "bg-slate-500/10 text-slate-300 border-slate-500/20";
    }
  };

  const estCost = plan.totalEstimatedCostUsd ?? 0.04;
  const maxLimit = workflow.budgetPolicy.maxSpendUsd;
  const budgetPercent = Math.min(100, Math.round((estCost / Math.max(0.01, maxLimit)) * 100));

  return (
    <div className="w-full max-w-5xl mx-auto py-8 px-4 space-y-6 animate-in fade-in duration-300">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono tracking-widest font-bold text-cyan-400 uppercase flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-cyan-400 animate-ping" />
              COMPILED EXECUTION GRAPH
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-[11px] font-mono text-emerald-400 font-semibold">
              DAG VERIFIED (NO CYCLES)
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mt-1">
            Execution Plan & Schema Review
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl leading-relaxed">
            {plan.summary}
          </p>
        </div>

        {/* Header CTA Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onBackToEdit}
            disabled={isStarting}
            className="rounded-xl border-border/80 hover:bg-muted/50 font-semibold text-xs"
          >
            <ArrowLeft className="size-3.5 mr-1" />
            Edit Query
          </Button>

          <Button
            size="sm"
            onClick={onApproveAndStart}
            disabled={isStarting}
            className="relative group overflow-hidden bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:via-teal-400 hover:to-emerald-500 text-white font-extrabold font-mono text-xs px-6 py-3 rounded-xl shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/45 hover:scale-[1.03] active:scale-[0.98] transition-all border border-emerald-400/40"
          >
            <span className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />

            {isStarting ? (
              <span className="relative flex items-center gap-2">
                <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                DEPLOYING PIPELINE...
              </span>
            ) : (
              <span className="relative flex items-center gap-2 tracking-wider">
                <Play className="size-4 fill-current text-white" />
                APPROVE & RUN PIPELINE
                <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* 3-Stage Pipeline Overview with Connectors */}
      <div className="p-5 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md space-y-4 font-mono shadow-xs">
        <div className="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-cyan-400" />
            <span>Execution Stages Breakdown</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">Sequential DAG Flow</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 relative">
          {/* Stage 1 */}
          <div className="p-4 rounded-xl border border-border/70 bg-muted/20 hover:border-cyan-500/40 transition-all space-y-2 group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <span className="size-6 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 flex items-center justify-center text-[11px] font-mono font-bold">
                  01
                </span>
                <span>Web Discovery</span>
              </div>
              <Search className="size-3.5 text-cyan-400 opacity-60 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed font-sans">
              Exa search agent queries verified primary news, announcements, and databases.
            </p>
          </div>

          {/* Stage 2 */}
          <div className="p-4 rounded-xl border border-border/70 bg-muted/20 hover:border-purple-500/40 transition-all space-y-2 group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <span className="size-6 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/20 flex items-center justify-center text-[11px] font-mono font-bold">
                  02
                </span>
                <span>Data Extraction</span>
              </div>
              <Database className="size-3.5 text-purple-400 opacity-60 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed font-sans">
              Extracts required columns into structured records with source snippets.
            </p>
          </div>

          {/* Stage 3 */}
          <div className="p-4 rounded-xl border border-border/70 bg-muted/20 hover:border-emerald-500/40 transition-all space-y-2 group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <span className="size-6 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 flex items-center justify-center text-[11px] font-mono font-bold">
                  03
                </span>
                <span>Citation Audit</span>
              </div>
              <FileCheck2 className="size-3.5 text-emerald-400 opacity-60 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed font-sans">
              Validates citations against extracted text. Missing data remains explicitly missing.
            </p>
          </div>
        </div>
      </div>

      {/* Target Columns & Cost Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Output Columns */}
        <div className="md:col-span-2 p-5 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md space-y-4 shadow-xs">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Database className="size-3.5 text-indigo-400" />
              Output Schema ({plan.fields.length} Columns)
            </span>
            <span className="text-[10px] text-muted-foreground font-mono bg-muted/50 px-2 py-0.5 rounded border border-border/50">
              Strict Type Checks
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {plan.fields.map((f, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors space-y-1"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs font-mono font-bold text-foreground">{f.name}</span>
                  <Badge variant="outline" className={`text-[10px] font-mono border ${getTypeBadgeStyle(f.type)}`}>
                    {f.type}
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                  {f.description}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cost & Budget Summary */}
        <div className="p-5 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md space-y-4 flex flex-col justify-between font-mono shadow-xs">
          <div className="space-y-4">
            <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center justify-between border-b border-border/60 pb-2">
              <span>Financial Governor</span>
              <Coins className="size-4 text-amber-500" />
            </span>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Est. Pipeline Cost:</span>
                <span className="font-bold font-mono text-emerald-400">
                  ~${estCost.toFixed(3)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Budget Limit:</span>
                <span className="font-bold font-mono text-foreground">
                  ${maxLimit.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Available Balance:</span>
                <span className="font-bold font-mono text-indigo-400">
                  {creditsStatus === "live" ? `$${availableCredits.toFixed(2)}` : "Unavailable"}
                </span>
              </div>
            </div>

            {/* Spend Capacity Progress Bar */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>Budget Allocated</span>
                <span>{budgetPercent}% of Max Cap</span>
              </div>
              <Progress value={budgetPercent} indicatorClassName="bg-amber-500" />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 text-[11px] text-muted-foreground font-sans space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-foreground font-mono text-xs">
              <ShieldCheck className="size-3.5 text-emerald-400" />
              <span>Budget Governor Active</span>
            </div>
            <p className="leading-relaxed">
              Approving this plan reserves the estimated budget and initiates autonomous data acquisition and extraction.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
