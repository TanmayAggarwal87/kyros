"use client";

import React from "react";
import {
  RotateCw,
  Eye,
  Clock,
  Coins,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Workflow } from "@/core/contracts";

interface HistoryViewProps {
  workflows: Workflow[];
  onSelectWorkflow: (workflow: Workflow) => void;
  onRerun: (workflow: Workflow) => void;
}

export function HistoryView({ workflows, onSelectWorkflow, onRerun }: HistoryViewProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="success" className="text-[10px]">Completed</Badge>;
      case "partially_completed":
        return <Badge variant="warning" className="text-[10px]">Partial</Badge>;
      case "failed":
        return <Badge variant="destructive" className="text-[10px]">Failed</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="text-[10px]">Cancelled</Badge>;
      case "running":
        return <Badge variant="warning" className="text-[10px] animate-pulse">Running</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4 space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="border-b border-border/70 pb-4">
        <span className="text-xs uppercase tracking-wider font-semibold text-indigo-400">
          Prior Research Queries
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
          Research History & Re-Runs
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          View datasets from prior workflows or clone queries with updated constraints.
        </p>
      </div>

      {/* History List */}
      {workflows.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border/80 rounded-2xl space-y-3 bg-muted/10">
          <History className="size-10 text-muted-foreground mx-auto opacity-40" />
          <h3 className="text-sm font-semibold text-foreground">No Research History Yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Queries you plan and execute will appear here with complete logs and persistent dataset records.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
        {workflows.map((wf) => (
          <Card
            key={wf.id}
            className="border-border/80 shadow-sm hover:border-indigo-500/40 transition-all bg-card rounded-2xl"
          >
            <CardContent className="p-4 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {wf.id}
                  </Badge>
                  {getStatusBadge(wf.status)}
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="size-3" />
                    {new Date(wf.timestamps.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                  <Coins className="size-3 text-amber-500" />
                  <span>Max Budget: ${wf.budgetPolicy.maxSpendUsd.toFixed(2)} USD</span>
                </div>
              </div>

              <div>
                <h3 className="text-sm sm:text-base font-semibold text-foreground">
                  &ldquo;{wf.prompt}&rdquo;
                </h3>
                {wf.summary && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                    {wf.summary}
                  </p>
                )}
              </div>

              {/* Action row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/50">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[11px] text-muted-foreground mr-1">Columns:</span>
                  {wf.fieldSchema.slice(0, 4).map((f) => (
                    <span
                      key={f.name}
                      className="px-2 py-0.5 rounded-md bg-muted text-[10.5px] font-mono text-muted-foreground"
                    >
                      {f.name}
                    </span>
                  ))}
                  {wf.fieldSchema.length > 4 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{wf.fieldSchema.length - 4} more
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSelectWorkflow(wf)}
                    className="gap-1.5 text-xs rounded-lg"
                  >
                    <Eye className="size-3.5" />
                    <span>View Dataset</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onRerun(wf)}
                    className="gap-1.5 text-xs bg-primary text-primary-foreground font-medium rounded-lg"
                  >
                    <RotateCw className="size-3.5" />
                    <span>Re-run</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        </div>
      )}
    </div>
  );
}
