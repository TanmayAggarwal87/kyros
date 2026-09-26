"use client";

import React from "react";
import {
  PlayCircle,
  PauseCircle,
  StopCircle,
  RotateCw,
  Search,
  Database,
  Globe,
  FileCheck2,
  GitFork,
  ArrowRight,
  ShieldAlert,
  Cpu,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { Workflow, WorkflowProgressSnapshot } from "@/core/contracts";

interface RunProgressViewProps {
  workflow: Workflow | null;
  progress: WorkflowProgressSnapshot | null;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRerun: (workflow: Workflow) => void;
  onViewDataset: () => void;
  recordsCount: number;
}

export function RunProgressView({
  workflow,
  progress,
  onPause,
  onResume,
  onCancel,
  onRerun,
  onViewDataset,
  recordsCount,
}: RunProgressViewProps) {
  if (!workflow || !progress) {
    return (
      <div className="w-full max-w-3xl mx-auto py-16 text-center space-y-4">
        <PlayCircle className="size-10 text-muted-foreground mx-auto" />
        <h2 className="text-xl font-bold text-foreground">No Active Run</h2>
        <p className="text-sm text-muted-foreground">
          Start a new research workflow to inspect live progress and task status.
        </p>
      </div>
    );
  }

  const isRunning = progress.status === "running";
  const isPaused = progress.status === "paused";
  const isCompleted = progress.status === "completed";
  const isPartiallyCompleted = progress.status === "partially_completed";
  const isCancelled = progress.status === "cancelled";
  const isFailed = progress.status === "failed";

  const getTaskIcon = (type: string) => {
    switch (type) {
      case "discovery":
        return Search;
      case "extraction":
        return Database;
      case "browser_navigation":
        return Globe;
      case "quality_validation":
        return FileCheck2;
      case "deduplication":
        return GitFork;
      default:
        return Cpu;
    }
  };

  const getHeadline = () => {
    if (isCompleted) return "Research Completed Successfully";
    if (isPartiallyCompleted) return "Research Completed with Partial Data";
    if (isPaused) return "Research Paused";
    if (isCancelled) return "Research Cancelled";
    if (isFailed) return "Research Encountered an Issue";
    return "Conducting Autonomous Web Research...";
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4 space-y-6 animate-in fade-in duration-300">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-indigo-400">
              Live Research Status
            </span>
            {isRunning && (
              <Badge variant="warning" className="animate-pulse flex items-center gap-1 text-[10px]">
                <span className="size-1.5 rounded-full bg-amber-500 animate-ping" />
                Active
              </Badge>
            )}
            {isCompleted && <Badge variant="success" className="text-[10px]">Completed</Badge>}
            {isPaused && <Badge variant="outline" className="text-[10px]">Paused</Badge>}
            {isPartiallyCompleted && <Badge variant="warning" className="text-[10px]">Partial</Badge>}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
            {getHeadline()}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-1">
            &ldquo;{workflow.prompt}&rdquo;
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          {isRunning && (
            <>
              <Button variant="outline" size="sm" onClick={onPause}>
                <PauseCircle className="size-3.5 mr-1 text-amber-500" />
                Pause
              </Button>
              <Button variant="destructive" size="sm" onClick={onCancel}>
                <StopCircle className="size-3.5 mr-1" />
                Cancel
              </Button>
            </>
          )}

          {isPaused && (
            <>
              <Button size="sm" onClick={onResume} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <PlayCircle className="size-3.5 mr-1" />
                Resume
              </Button>
              <Button variant="destructive" size="sm" onClick={onCancel}>
                <StopCircle className="size-3.5 mr-1" />
                Cancel
              </Button>
            </>
          )}

          {(isCompleted || isPartiallyCompleted) && (
            <Button
              size="sm"
              onClick={onViewDataset}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-lg shadow-indigo-600/20 px-4"
            >
              <span>View Sourced Dataset ({recordsCount} records)</span>
              <ArrowRight className="size-3.5 ml-1.5" />
            </Button>
          )}

          {(isCancelled || isFailed || isCompleted) && (
            <Button variant="outline" size="sm" onClick={() => onRerun(workflow)}>
              <RotateCw className="size-3.5 mr-1" />
              Re-run
            </Button>
          )}
        </div>
      </div>

      {/* Progress & Metrics */}
      <div className="p-5 rounded-2xl border border-border/80 bg-card shadow-sm space-y-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground">
            Progress: {progress.progressPercent}%
          </span>
          <span className="text-muted-foreground font-mono">
            {progress.completedTasks} of {progress.totalTasks} Steps Completed
          </span>
        </div>

        <Progress
          value={progress.progressPercent}
          indicatorClassName={isCompleted ? "bg-emerald-500" : "bg-gradient-to-r from-indigo-500 to-purple-500"}
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-0.5">
            <span className="text-[11px] text-muted-foreground">Extracted Records</span>
            <div className="text-xl font-bold text-foreground">{recordsCount}</div>
          </div>
          <div className="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-0.5">
            <span className="text-[11px] text-muted-foreground">Tasks Completed</span>
            <div className="text-xl font-bold text-indigo-400">
              {progress.completedTasks} / {progress.totalTasks}
            </div>
          </div>
          <div className="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-0.5">
            <span className="text-[11px] text-muted-foreground">Citation Quality</span>
            <div className="text-xl font-bold text-emerald-400">
              {recordsCount > 0 ? "100% Sourced" : isRunning ? "Acquiring..." : "Pending"}
            </div>
          </div>
          <div className="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-0.5">
            <span className="text-[11px] text-muted-foreground">Est. Cost Incurred</span>
            <div className="text-xl font-bold font-mono text-foreground">
              ${((progress.completedTasks / Math.max(1, progress.totalTasks)) * (workflow.budgetPolicy?.maxSpendUsd ?? 0.05)).toFixed(3)}
            </div>
          </div>
        </div>
      </div>

      {/* Partial failure notice if any */}
      {progress.failureInfo && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-300 text-xs flex items-start gap-3">
          <ShieldAlert className="size-5 shrink-0 text-amber-500 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-sm">Truthful Partial Results Notice</div>
            <p className="leading-relaxed">{progress.failureInfo.message}</p>
            <p className="text-[11px] text-muted-foreground">
              Any collected and verified records are preserved and ready for export.
            </p>
          </div>
        </div>
      )}

      {/* Clean Tasks Steps List */}
      <div className="p-5 rounded-2xl border border-border/80 bg-card shadow-sm space-y-3">
        <div className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Task Execution Steps
        </div>

        <div className="space-y-2.5">
          {progress.tasks.map((task, idx) => {
            const Icon = getTaskIcon(task.type);
            const isTaskSucceeded = task.status === "succeeded";
            const isTaskRunning = task.status === "running";

            return (
              <div
                key={task.id}
                className="p-3 rounded-xl border border-border/60 bg-muted/10 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`size-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isTaskSucceeded
                        ? "bg-emerald-500/15 text-emerald-400"
                        : isTaskRunning
                        ? "bg-amber-500/15 text-amber-400 animate-pulse"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isTaskSucceeded ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <Icon className="size-3.5" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground">
                      {idx + 1}. {task.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      Type: {task.type}
                    </div>
                  </div>
                </div>

                <div>
                  {isTaskSucceeded && (
                    <Badge variant="success" className="text-[10px]">
                      Verified
                    </Badge>
                  )}
                  {isTaskRunning && (
                    <Badge variant="warning" className="text-[10px] animate-pulse">
                      In Progress
                    </Badge>
                  )}
                  {task.status === "pending" && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Pending
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
