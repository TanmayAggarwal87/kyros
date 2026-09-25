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
import {
  DEMO_WORKFLOW,
  DEMO_PLAN,
  DEMO_PROGRESS_SNAPSHOT,
  DEMO_RECORDS,
  INITIAL_CREDIT_ACCOUNT,
  INITIAL_LEDGER_ENTRIES,
  DEMO_FIELDS,
} from "./fixtures";
import { generateDatasetCsv } from "./csv";
import { userCreditAccountSchema, creditLedgerEntrySchema } from "@/core/contracts/credits";

export type ActiveTab = "new" | "plan" | "run" | "dataset" | "history" | "credits";

export interface SelectedEvidenceItem {
  recordId: string;
  fieldName: string;
  record: DatasetRecord;
}

export function useWorkflowStore() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("new");
  const [currentWorkflow, setCurrentWorkflow] = useState<Workflow | null>(DEMO_WORKFLOW);
  const [currentPlan, setCurrentPlan] = useState<PlannerPlan | null>(DEMO_PLAN);
  const [currentProgress, setCurrentProgress] = useState<WorkflowProgressSnapshot | null>(
    DEMO_PROGRESS_SNAPSHOT
  );
  const [datasetRecords] = useState<DatasetRecord[]>(DEMO_RECORDS);
  const [historyWorkflows] = useState<Workflow[]>([
    DEMO_WORKFLOW,
    {
      id: "wf-cybersec-sponsors",
      runId: "run-cybersec-1",
      userId: "usr_clerk_demo_8829",
      prompt: "Enterprise sponsors and maintainers of open-source software security tooling",
      status: "completed",
      summary: "Identified 12 enterprise maintainers with verified GitHub security sponsorships.",
      fieldSchema: [
        { name: "company_name", type: "string", description: "Company", required: true },
        { name: "sponsored_projects", type: "array", description: "Projects", required: true },
        { name: "security_domain", type: "string", description: "Domain", required: false },
      ],
      budgetPolicy: { maxSpendUsd: 0.05, currency: "USD", allowPaidSources: false },
      timestamps: {
        createdAt: "2026-09-24T16:20:00.000Z",
        updatedAt: "2026-09-24T16:25:10.000Z",
        finishedAt: "2026-09-24T16:25:10.000Z",
      },
    },
    {
      id: "wf-underwater-robotics",
      runId: "run-underwater-1",
      userId: "usr_clerk_demo_8829",
      prompt: "Autonomous underwater robotic mapping startups with commercial contracts",
      status: "partially_completed",
      summary: "Sparse results: Found 3 candidate startups; commercial contract values were private or missing.",
      fieldSchema: [
        { name: "company_name", type: "string", description: "Company", required: true },
        { name: "fleet_size", type: "number", description: "Fleet size", required: false },
        { name: "contract_value_usd", type: "number", description: "Contract Value", required: false },
      ],
      budgetPolicy: { maxSpendUsd: 0.05, currency: "USD", allowPaidSources: true },
      failureInfo: {
        category: "extraction",
        code: "SPARSE_DATASET",
        message: "Commercial contract values are largely undisclosed in public sources. Available records preserved.",
        retryable: false,
        scope: "workflow",
        timestamp: "2026-09-23T11:15:00.000Z",
      },
      timestamps: {
        createdAt: "2026-09-23T11:10:00.000Z",
        updatedAt: "2026-09-23T11:15:00.000Z",
        finishedAt: "2026-09-23T11:15:00.000Z",
      },
    },
  ]);

  const [creditAccount, setCreditAccount] = useState<UserCreditAccount>(INITIAL_CREDIT_ACCOUNT);
  const [ledgerEntries, setLedgerEntries] = useState<CreditLedgerEntry[]>(INITIAL_LEDGER_ENTRIES);
  const [creditsStatus, setCreditsStatus] = useState<"live" | "unavailable">("unavailable");
  const [executionNotice, setExecutionNotice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function refreshCredits() {
      try {
        const response = await fetch('/api/credits', { cache: 'no-store' });
        if (!response.ok) throw new Error('Credits unavailable');
        const body: unknown = await response.json();
        if (!body || typeof body !== 'object' || !('account' in body) || !('ledger' in body)) throw new Error('Invalid credit response');
        const account = userCreditAccountSchema.parse(body.account);
        const ledger = creditLedgerEntrySchema.array().parse(body.ledger);
        if (!mounted) return;
        setCreditAccount(account);
        setLedgerEntries(ledger);
        setCreditsStatus('live');
      } catch {
        if (!mounted) return;
        setCreditAccount(INITIAL_CREDIT_ACCOUNT);
        setLedgerEntries([]);
        setCreditsStatus('unavailable');
      }
    }
    void refreshCredits();
    window.addEventListener('focus', refreshCredits);
    const interval = window.setInterval(refreshCredits, 30000);
    return () => { mounted = false; window.removeEventListener('focus', refreshCredits); window.clearInterval(interval); };
  }, []);

  const [selectedEvidence, setSelectedEvidence] = useState<SelectedEvidenceItem | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [runSimulationTimer, setRunSimulationTimer] = useState<number | null>(null);

  // Search and filter state for dataset
  const [searchQuery, setSearchQuery] = useState("");
  const [supportFilter, setSupportFilter] = useState<SupportState | "all">("all");

  const clearSelection = useCallback(() => {
    setSelectedEvidence(null);
  }, []);

  const selectCellEvidence = useCallback((recordId: string, fieldName: string) => {
    const record = datasetRecords.find((r) => r.id === recordId);
    if (record) {
      setSelectedEvidence({ recordId, fieldName, record });
    }
  }, [datasetRecords]);

  // Create & Plan Workflow action
  const createAndPlanWorkflow = useCallback(
    async (prompt: string, constraints: string[], maxSpend: number, allowPaid: boolean) => {
      setIsPlanning(true);

      // Simulate planner call / compile plan
      await new Promise((resolve) => setTimeout(resolve, 800));

      const workflowId = `wf-${Date.now().toString(36)}`;
      const runId = `run-${Date.now().toString(36)}`;

      const fields = constraints.length > 0
        ? constraints.map((c) => ({
            name: c.toLowerCase().replace(/\s+/g, "_"),
            type: "string" as const,
            description: `Extracted ${c}`,
            required: true,
          }))
        : DEMO_FIELDS;

      const newPlan: PlannerPlan = {
        summary: `Research plan compiled for: "${prompt}". Tasks mapped to discovery, structured extraction, and quality verification.`,
        fields,
        totalEstimatedCostUsd: Math.min(maxSpend * 0.8, 0.045),
        tasks: [
          {
            id: `task-disc-${workflowId}`,
            name: "Discover Primary Candidates",
            type: "discovery",
            description: "Query search providers for verified sources",
            dependencies: [],
            completionPolicy: "all_succeeded",
            input: { query: prompt },
            expectedArtifactTypes: ["source"],
            estimatedCostUsd: 0.005,
          },
          {
            id: `task-extr-${workflowId}`,
            name: "Extract Target Entities & Schema",
            type: "extraction",
            description: "Deep structured extraction with Gemini AI gateway",
            dependencies: [`task-disc-${workflowId}`],
            completionPolicy: "allow_partial",
            input: { fields: fields.map((f) => f.name) },
            expectedArtifactTypes: ["record_slice"],
            estimatedCostUsd: 0.015,
          },
          ...(allowPaid
            ? [
                {
                  id: `task-x402-${workflowId}`,
                  name: "Acquire Verified Premium Telemetry via x402",
                  type: "browser_navigation" as const,
                  description: "Execute cryptographic x402 settlement on Base Sepolia",
                  dependencies: [`task-extr-${workflowId}`],
                  completionPolicy: "allow_partial" as const,
                  input: { resourceUri: "kyros-demo://premium-eval/resource" },
                  expectedArtifactTypes: ["record_slice"],
                  estimatedCostUsd: 0.02,
                },
              ]
            : []),
          {
            id: `task-val-${workflowId}`,
            name: "Quality & Provenance Verification",
            type: "quality_validation",
            description: "Verify source links and flag missing or ungrounded data",
            dependencies: [`task-extr-${workflowId}`],
            completionPolicy: "allow_partial",
            input: {},
            expectedArtifactTypes: ["record_slice"],
            estimatedCostUsd: 0.005,
          },
          {
            id: `task-dedupe-${workflowId}`,
            name: "Entity Resolution & Deduplication",
            type: "deduplication",
            description: "Merge duplicates into final auditable dataset",
            dependencies: [`task-val-${workflowId}`],
            completionPolicy: "all_succeeded",
            input: {},
            expectedArtifactTypes: ["dataset"],
            estimatedCostUsd: 0.005,
          },
        ],
      };

      const newWorkflow: Workflow = {
        id: workflowId,
        runId,
        userId: creditAccount.userId,
        prompt,
        status: "ready",
        summary: newPlan.summary,
        fieldSchema: fields,
        budgetPolicy: {
          maxSpendUsd: maxSpend,
          perCallCeilingUsd: 0.02,
          currency: "USD",
          allowPaidSources: allowPaid,
        },
        timestamps: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      setCurrentWorkflow(newWorkflow);
      setCurrentPlan(newPlan);
      setIsPlanning(false);
      setActiveTab("plan");
    },
    [creditAccount.userId]
  );

  // Execution stays unavailable until the API is connected to a durable worker.
  const startWorkflowRun = useCallback(async () => {
    setExecutionNotice('Research execution is not connected yet. This plan is a preview only.');
  }, []);
  // Pause workflow
  const pauseWorkflow = useCallback(() => {
    if (runSimulationTimer) {
      window.clearInterval(runSimulationTimer);
      setRunSimulationTimer(null);
    }
    setIsExecuting(false);
    setCurrentProgress((prev) => (prev ? { ...prev, status: "paused" } : null));
    setCurrentWorkflow((prev) => (prev ? { ...prev, status: "paused" } : null));
  }, [runSimulationTimer]);

  // Resume workflow
  const resumeWorkflow = useCallback(() => {
    setCurrentProgress((prev) => (prev ? { ...prev, status: "running" } : null));
    setCurrentWorkflow((prev) => (prev ? { ...prev, status: "running" } : null));
    setIsExecuting(true);
  }, []);

  // Cancel workflow
  const cancelWorkflow = useCallback(() => {
    if (runSimulationTimer) {
      window.clearInterval(runSimulationTimer);
      setRunSimulationTimer(null);
    }
    setIsExecuting(false);
    setCurrentProgress((prev) => (prev ? { ...prev, status: "cancelled" } : null));
    setCurrentWorkflow((prev) => (prev ? { ...prev, status: "cancelled" } : null));
  }, [runSimulationTimer]);

  // Re-run workflow action
  const rerunWorkflow = useCallback((targetWorkflow: Workflow) => {
    setActiveTab("new");
    createAndPlanWorkflow(
      targetWorkflow.prompt,
      targetWorkflow.fieldSchema.map((f) => f.name),
      targetWorkflow.budgetPolicy.maxSpendUsd,
      targetWorkflow.budgetPolicy.allowPaidSources
    );
  }, [createAndPlanWorkflow]);

  // CSV Export action
  const exportCsv = useCallback((includeEvidence: boolean) => {
    if (!currentWorkflow) return;
    const csvContent = generateDatasetCsv(datasetRecords, currentWorkflow.fieldSchema, {
      includeEvidenceUrls: includeEvidence,
      includeSupportStates: includeEvidence,
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `kyros_${currentWorkflow.id}_${Date.now()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [currentWorkflow, datasetRecords]);

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
    setActiveTab,
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
