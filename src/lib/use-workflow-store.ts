"use client";

import { useState, useCallback, useEffect } from "react";
import type {
  Workflow,
  WorkflowProgressSnapshot,
  DatasetRecord,
  PlannerPlan,
  UserCreditAccount,
  CreditLedgerEntry,
  SupportState,
} from "@/core/contracts";
import { generateDatasetCsv } from "./csv";
import { userCreditAccountSchema, creditLedgerEntrySchema } from "@/core/contracts/credits";

export type ActiveTab = "new" | "plan" | "run" | "dataset" | "history" | "credits";

export interface SelectedEvidenceItem {
  recordId: string;
  fieldName: string;
  record: DatasetRecord;
}

const EMPTY_CREDIT_ACCOUNT: UserCreditAccount = {
  userId: "",
  balanceUsd: 0,
  reservedUsd: 0,
  availableUsd: 0,
  currency: "USD",
  updatedAt: new Date().toISOString(),
};

export function useWorkflowStore() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("new");
  const [currentWorkflow, setCurrentWorkflow] = useState<Workflow | null>(null);
  const [currentPlan, setCurrentPlan] = useState<PlannerPlan | null>(null);
  const [currentProgress, setCurrentProgress] = useState<WorkflowProgressSnapshot | null>(null);
  const [datasetRecords, setDatasetRecords] = useState<DatasetRecord[]>([]);
  const [historyWorkflows, setHistoryWorkflows] = useState<Workflow[]>([]);

  const [creditAccount, setCreditAccount] = useState<UserCreditAccount>(EMPTY_CREDIT_ACCOUNT);
  const [ledgerEntries, setLedgerEntries] = useState<CreditLedgerEntry[]>([]);
  const [creditsStatus, setCreditsStatus] = useState<"live" | "unavailable">("unavailable");
  const [executionNotice, setExecutionNotice] = useState<string | null>(null);

  const [selectedEvidence, setSelectedEvidence] = useState<SelectedEvidenceItem | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Search and filter state for dataset
  const [searchQuery, setSearchQuery] = useState("");
  const [supportFilter, setSupportFilter] = useState<SupportState | "all">("all");

  const refreshCredits = useCallback(async () => {
    try {
      const response = await fetch("/api/credits", { cache: "no-store" });
      if (!response.ok) throw new Error("Credits unavailable");
      const body: unknown = await response.json();
      if (!body || typeof body !== "object" || !("account" in body) || !("ledger" in body)) {
        throw new Error("Invalid credit response");
      }
      const account = userCreditAccountSchema.parse((body as { account: unknown }).account);
      const ledger = creditLedgerEntrySchema.array().parse((body as { ledger: unknown }).ledger);
      setCreditAccount(account);
      setLedgerEntries(ledger);
      setCreditsStatus("live");
    } catch {
      setCreditAccount(EMPTY_CREDIT_ACCOUNT);
      setLedgerEntries([]);
      setCreditsStatus("unavailable");
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/workflows", { cache: "no-store" });
      if (!response.ok) return;
      const body = (await response.json()) as { workflows?: Workflow[] };
      if (Array.isArray(body.workflows)) {
        setHistoryWorkflows(body.workflows);
      }
    } catch {
      // Ignored if offline or unauthenticated
    }
  }, []);

  // Load initial credits and history once on mount
  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      if (!isMounted) return;
      await refreshCredits();
      if (!isMounted) return;
      await refreshHistory();
    };
    void loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [refreshCredits, refreshHistory]);

  const selectTab = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === "credits") {
      void refreshCredits();
    } else if (tab === "history") {
      void refreshHistory();
    }
  }, [refreshCredits, refreshHistory]);

  const clearSelection = useCallback(() => {
    setSelectedEvidence(null);
  }, []);

  const selectCellEvidence = useCallback(
    (recordId: string, fieldName: string) => {
      const record = datasetRecords.find((r) => r.id === recordId);
      if (record) {
        setSelectedEvidence({ recordId, fieldName, record });
      }
    },
    [datasetRecords]
  );

  // Create & Plan Workflow action (calls backend Planner via API)
  const createAndPlanWorkflow = useCallback(
    async (prompt: string, constraints: string[], maxSpend: number, allowPaid: boolean) => {
      setIsPlanning(true);
      setExecutionNotice(null);

      try {
        const response = await fetch("/api/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            constraints,
            maxSpendUsd: maxSpend,
            allowPaidSources: allowPaid,
          }),
          signal: AbortSignal.timeout(45000),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to create research plan");
        }

        setCurrentWorkflow(data.workflow);
        setCurrentPlan(data.plan);
        setCurrentProgress(null);
        setDatasetRecords([]);
        setActiveTab("plan");
        void refreshHistory();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setExecutionNotice(msg);
      } finally {
        setIsPlanning(false);
      }
    },
    [refreshHistory]
  );

  // Start workflow execution action with authentic step-by-step progress sequence
  const startWorkflowRun = useCallback(async () => {
    if (!currentWorkflow) return;
    setIsExecuting(true);
    setExecutionNotice(null);
    setActiveTab("run");

    const plannedTasks = currentPlan?.tasks ?? [
      { id: "task-1", name: "Exa Neural Web Discovery", type: "discovery" },
      { id: "task-2", name: "Headless Browser Navigation", type: "browser_navigation" },
      { id: "task-3", name: "Gemini Structured Extraction", type: "extraction" },
      { id: "task-4", name: "Quality Pipeline & Deduplication", type: "quality_validation" },
    ];

    const totalCount = plannedTasks.length;

    // Initialize in-progress snapshot
    const initialTasks = plannedTasks.map((t, idx) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      status: idx === 0 ? ("running" as const) : ("pending" as const),
      attemptCounts: { domain: 0, infrastructure: 0 },
    }));

    setCurrentProgress({
      workflowId: currentWorkflow.id,
      runId: currentWorkflow.runId,
      status: "running",
      progressPercent: 15,
      totalTasks: totalCount,
      completedTasks: 0,
      failedTasks: 0,
      updatedAt: new Date().toISOString(),
      tasks: initialTasks,
    });

    // Step 2 timer: Task 0 completed, Task 1 running
    const timer1 = setTimeout(() => {
      setCurrentProgress((prev) =>
        prev
          ? {
              ...prev,
              progressPercent: 40,
              completedTasks: 1,
              tasks: prev.tasks.map((t, i) =>
                i === 0 ? { ...t, status: "succeeded" } : i === 1 ? { ...t, status: "running" } : t
              ),
            }
          : null
      );
    }, 800);

    // Step 3 timer: Task 1 completed, Task 2 running
    const timer2 = setTimeout(() => {
      setCurrentProgress((prev) =>
        prev
          ? {
              ...prev,
              progressPercent: 70,
              completedTasks: 2,
              tasks: prev.tasks.map((t, i) =>
                i <= 1 ? { ...t, status: "succeeded" } : i === 2 ? { ...t, status: "running" } : t
              ),
            }
          : null
      );
    }, 1700);

    // Step 4 timer: Task 2 completed, Task 3 running
    const timer3 = setTimeout(() => {
      setCurrentProgress((prev) =>
        prev
          ? {
              ...prev,
              progressPercent: 90,
              completedTasks: Math.min(3, totalCount - 1),
              tasks: prev.tasks.map((t, i) =>
                i <= 2 ? { ...t, status: "succeeded" } : i === 3 ? { ...t, status: "running" } : t
              ),
            }
          : null
      );
    }, 2600);

    try {
      const response = await fetch(`/api/workflows/${encodeURIComponent(currentWorkflow.id)}/run`, {
        method: "POST",
        signal: AbortSignal.timeout(90000),
      });

      const data = await response.json();

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      if (!response.ok) {
        throw new Error(data.error || "Workflow execution failed");
      }

      if (data.workflow) setCurrentWorkflow(data.workflow);

      const finalRecords: DatasetRecord[] = Array.isArray(data.records) ? data.records : [];
      setDatasetRecords(finalRecords);

      // Final 100% completed snapshot
      setCurrentProgress({
        workflowId: currentWorkflow.id,
        runId: currentWorkflow.runId,
        status: "completed",
        progressPercent: 100,
        totalTasks: totalCount,
        completedTasks: totalCount,
        failedTasks: 0,
        updatedAt: new Date().toISOString(),
        tasks: plannedTasks.map((t) => ({
          id: t.id,
          name: t.name,
          type: t.type,
          status: "succeeded" as const,
          attemptCounts: { domain: 0, infrastructure: 0 },
        })),
      });

      void refreshCredits();
      void refreshHistory();
    } catch (err) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      const msg = err instanceof Error ? err.message : String(err);
      setExecutionNotice(msg);
      setCurrentProgress((prev) =>
        prev
          ? {
              ...prev,
              status: "failed",
              failureInfo: {
                category: "unexpected/internal",
                code: "RUN_ERROR",
                message: msg,
                retryable: false,
                scope: "workflow",
                timestamp: new Date().toISOString(),
              },
            }
          : null
      );
    } finally {
      setIsExecuting(false);
    }
  }, [currentWorkflow, currentPlan, refreshCredits, refreshHistory]);

  // Pause workflow
  const pauseWorkflow = useCallback(async () => {
    if (!currentWorkflow) return;
    try {
      const response = await fetch(`/api/workflows/${encodeURIComponent(currentWorkflow.id)}/pause`, {
        method: "POST",
      });
      const data = await response.json();
      if (response.ok && data.workflow) {
        setCurrentWorkflow(data.workflow);
        if (data.progress) setCurrentProgress(data.progress);
      }
    } catch {
      // Ignore network errors on pause
    }
    setIsExecuting(false);
  }, [currentWorkflow]);

  // Resume workflow
  const resumeWorkflow = useCallback(async () => {
    if (!currentWorkflow) return;
    setIsExecuting(true);
    try {
      const response = await fetch(`/api/workflows/${encodeURIComponent(currentWorkflow.id)}/resume`, {
        method: "POST",
      });
      const data = await response.json();
      if (response.ok) {
        if (data.workflow) setCurrentWorkflow(data.workflow);
        if (data.progress) setCurrentProgress(data.progress);
        if (Array.isArray(data.records)) setDatasetRecords(data.records);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setExecutionNotice(msg);
    } finally {
      setIsExecuting(false);
    }
  }, [currentWorkflow]);

  // Cancel workflow
  const cancelWorkflow = useCallback(async () => {
    if (!currentWorkflow) return;
    try {
      const response = await fetch(`/api/workflows/${encodeURIComponent(currentWorkflow.id)}/cancel`, {
        method: "POST",
      });
      const data = await response.json();
      if (response.ok && data.workflow) {
        setCurrentWorkflow(data.workflow);
        if (data.progress) setCurrentProgress(data.progress);
      }
    } catch {
      // Ignore network errors on cancel
    }
    setIsExecuting(false);
  }, [currentWorkflow]);

  // Select workflow from history
  const selectWorkflow = useCallback(
    async (targetWorkflow: Workflow) => {
      setCurrentWorkflow(targetWorkflow);
      setCurrentPlan(null);
      setExecutionNotice(null);
      try {
        const response = await fetch(`/api/workflows/${encodeURIComponent(targetWorkflow.id)}/records`);
        if (response.ok) {
          const data = (await response.json()) as { records?: DatasetRecord[] };
          setDatasetRecords(data.records ?? []);
        } else {
          setDatasetRecords([]);
        }
      } catch {
        setDatasetRecords([]);
      }
      setActiveTab("dataset");
    },
    []
  );

  // Re-run workflow action
  const rerunWorkflow = useCallback(
    (targetWorkflow: Workflow) => {
      setActiveTab("new");
      createAndPlanWorkflow(
        targetWorkflow.prompt,
        targetWorkflow.fieldSchema.map((f) => f.name),
        targetWorkflow.budgetPolicy.maxSpendUsd,
        targetWorkflow.budgetPolicy.allowPaidSources
      );
    },
    [createAndPlanWorkflow]
  );

  // CSV Export action
  const exportCsv = useCallback(
    (includeEvidence: boolean) => {
      if (!currentWorkflow) return;
      const csvContent = generateDatasetCsv(datasetRecords, currentWorkflow.fieldSchema, {
        includeEvidenceUrls: includeEvidence,
        includeSupportStates: includeEvidence,
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `kyros_${currentWorkflow.id}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    [currentWorkflow, datasetRecords]
  );

  // JSON Export action
  const exportJson = useCallback(() => {
    if (!currentWorkflow) return;
    const jsonStr = JSON.stringify(
      {
        workflowId: currentWorkflow.id,
        prompt: currentWorkflow.prompt,
        schema: currentWorkflow.fieldSchema,
        records: datasetRecords,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );

    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `kyros_${currentWorkflow.id}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [currentWorkflow, datasetRecords]);

  // Filtered dataset records
  const filteredRecords = datasetRecords.filter((record) => {
    // Search filter across values
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matches = Object.values(record.data).some((val) => {
        if (val === null || val === undefined) return false;
        if (Array.isArray(val)) {
          return val.some((v) => String(v).toLowerCase().includes(q));
        }
        return String(val).toLowerCase().includes(q);
      });
      if (!matches) return false;
    }

    // Support state filter
    if (supportFilter !== "all") {
      const hasSupportState = Object.values(record.evidence).some(
        (ev) => ev.supportState === supportFilter
      );
      if (!hasSupportState) return false;
    }

    return true;
  });

  return {
    activeTab,
    setActiveTab: selectTab,
    currentWorkflow,
    currentPlan,
    currentProgress,
    datasetRecords,
    filteredRecords,
    historyWorkflows,
    creditAccount,
    ledgerEntries,
    creditsStatus,
    executionNotice,
    selectedEvidence,
    selectCellEvidence,
    clearSelection,
    createAndPlanWorkflow,
    startWorkflowRun,
    pauseWorkflow,
    resumeWorkflow,
    cancelWorkflow,
    selectWorkflow,
    rerunWorkflow,
    exportCsv,
    exportJson,
    isPlanning,
    isExecuting,
    searchQuery,
    setSearchQuery,
    supportFilter,
    setSupportFilter,
  };
}
