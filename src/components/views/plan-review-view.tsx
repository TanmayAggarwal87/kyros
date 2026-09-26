"use client";

import React from "react";
import {
  Database,
  Layers,
  Play,
  ArrowLeft,
  Coins,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
        <Database className="size-10 text-zinc-600 mx-auto" />
        <h2 className="text-xl font-bold text-zinc-100 font-mono">NO ACTIVE PLAN</h2>
        <p className="text-xs text-zinc-400">
          Enter a query in the Query Terminal to compile an execution graph.
        </p>
        <Button onClick={onBackToEdit}>Return to Query Terminal</Button>
      </div>
    );
  }



  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono tracking-wider font-semibold text-cyan-400 uppercase">
              COMPILED EXECUTION GRAPH
            </span>
            <span className="text-zinc-600">•</span>
            <span className="text-[11px] font-mono text-zinc-400">
              DAG VERIFIED (NO CYCLES)
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 mt-1">
            Execution Plan & Schema Review
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xl">
            {plan.summary}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button variant="outline" size="sm" onClick={onBackToEdit} disabled={isStarting} className="border-zinc-700 text-zinc-300">
            <ArrowLeft className="size-3.5 mr-1" />
            Edit Query
          </Button>
          <Button
            size="sm"
            onClick={onApproveAndStart}
            disabled={isStarting}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold font-mono text-xs shadow-md shadow-emerald-950 px-4"
          >
            {isStarting ? (
              <>
                <div className="size-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                DEPLOYING PIPELINE...
              </>
            ) : (
              <>
                <Play className="size-3.5 mr-1.5 fill-current" />
                APPROVE & RUN PIPELINE
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 3-Stage Pipeline Overview */}
      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-3 font-mono">
        <div className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="size-3.5 text-cyan-400" />
          <span>Execution Stages Breakdown</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-950/60 space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
              <span className="size-5 rounded bg-zinc-800 text-cyan-400 flex items-center justify-center text-[10px] font-mono">
                01
              </span>
              <span>Web Discovery</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
              Exa search agent queries verified primary news, announcements, and databases.
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-950/60 space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
              <span className="size-5 rounded bg-zinc-800 text-purple-400 flex items-center justify-center text-[10px] font-mono">
                02
              </span>
              <span>Data Extraction</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
              Extracts required columns into structured records with source snippets.
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-950/60 space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
              <span className="size-5 rounded bg-zinc-800 text-emerald-400 flex items-center justify-center text-[10px] font-mono">
                03
              </span>
              <span>Citation Audit</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
              Validates citations against extracted text. Missing data remains explicitly missing.
            </p>
          </div>
        </div>
      </div>

      {/* Target Columns & Cost Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Output Columns */}
        <div className="md:col-span-2 p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-3">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="font-semibold text-zinc-200 uppercase tracking-wider">
              Output Schema ({plan.fields.length} Columns)
            </span>
            <span className="text-[11px] text-zinc-400">Strict Type Checks</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {plan.fields.map((f, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg border border-zinc-800 bg-zinc-950/40 space-y-0.5"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs font-mono font-semibold text-zinc-200">{f.name}</span>
                  <Badge variant="outline" className="text-[9.5px] font-mono border-zinc-700 text-zinc-300">
                    {f.type}
                  </Badge>
                </div>
                <div className="text-[11px] text-zinc-400 line-clamp-1">{f.description}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Cost & Budget Summary */}
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-3 flex flex-col justify-between font-mono">
          <div className="space-y-3">
            <span className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center justify-between">
              <span>Financial Governor</span>
              <Coins className="size-3.5 text-amber-400" />
            </span>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Est. Pipeline Cost:</span>
                <span className="font-semibold text-zinc-100">
                  ~${(plan.totalEstimatedCostUsd ?? 0.035).toFixed(3)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Budget Limit:</span>
                <span className="font-semibold text-zinc-100">
                  ${workflow.budgetPolicy.maxSpendUsd.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Available Balance:</span>
                <span className="font-semibold text-zinc-100">
                  {creditsStatus === "live" ? `$${availableCredits.toFixed(2)}` : "Unavailable"}
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 text-[11px] text-zinc-400 font-sans">
            <div className="flex items-center gap-1 font-medium text-zinc-200 mb-0.5 font-mono text-xs">
              <ShieldCheck className="size-3 text-emerald-400" />
              <span>Budget Governor</span>
            </div>
            Approving this plan reserves the estimated budget and initiates autonomous data acquisition and extraction.
          </div>
        </div>
      </div>
    </div>
  );
}
