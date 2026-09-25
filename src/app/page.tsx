"use client";

import React from "react";
import { Header } from "@/components/header";
import { PromptView } from "@/components/views/prompt-view";
import { PlanReviewView } from "@/components/views/plan-review-view";
import { RunProgressView } from "@/components/views/run-progress-view";
import { DatasetView } from "@/components/views/dataset-view";
import { EvidenceDrawer } from "@/components/views/evidence-drawer";
import { HistoryView } from "@/components/views/history-view";
import { CreditsView } from "@/components/views/credits-view";
import { useWorkflowStore } from "@/lib/use-workflow-store";

export default function Home() {
  const {
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
    selectedEvidence,
    selectCellEvidence,
    clearSelection,
    createAndPlanWorkflow,
    startWorkflowRun,
    pauseWorkflow,
    resumeWorkflow,
    cancelWorkflow,
    rerunWorkflow,
    topUpCredits,
    exportCsv,
    exportJson,
    isPlanning,
    isExecuting,
    searchQuery,
    setSearchQuery,
    supportFilter,
    setSupportFilter,
  } = useWorkflowStore();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20">
      {/* Kyros Header with Clerk user & credits indicator */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        availableCredits={creditAccount.availableUsd}
        onQuickTopUp={() => topUpCredits(10)}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 pb-16">
        {activeTab === "new" && (
          <PromptView
            onPlan={createAndPlanWorkflow}
            isPlanning={isPlanning}
            userAvailableCredits={creditAccount.availableUsd}
          />
        )}

        {activeTab === "plan" && (
          <PlanReviewView
            workflow={currentWorkflow}
            plan={currentPlan}
            onApproveAndStart={startWorkflowRun}
            onBackToEdit={() => setActiveTab("new")}
            isStarting={isExecuting}
            availableCredits={creditAccount.availableUsd}
          />
        )}

        {activeTab === "run" && (
          <RunProgressView
            workflow={currentWorkflow}
            progress={currentProgress}
            onPause={pauseWorkflow}
            onResume={resumeWorkflow}
            onCancel={cancelWorkflow}
            onRerun={(wf) => rerunWorkflow(wf)}
            onViewDataset={() => setActiveTab("dataset")}
            recordsCount={datasetRecords.length}
          />
        )}

        {activeTab === "dataset" && (
          <DatasetView
            workflow={currentWorkflow}
            records={filteredRecords}
            onSelectCell={selectCellEvidence}
            onExportCsv={exportCsv}
            onExportJson={exportJson}
            onRerun={(wf) => rerunWorkflow(wf)}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            supportFilter={supportFilter}
            setSupportFilter={setSupportFilter}
          />
        )}

        {activeTab === "history" && (
          <HistoryView
            workflows={historyWorkflows}
            onSelectWorkflow={() => {
              // Switch to dataset of selected workflow
              setActiveTab("dataset");
            }}
            onRerun={(wf) => rerunWorkflow(wf)}
          />
        )}

        {activeTab === "credits" && (
          <CreditsView
            creditAccount={creditAccount}
            ledgerEntries={ledgerEntries}
            onTopUp={topUpCredits}
          />
        )}
      </main>

      {/* Evidence Inspector Side Drawer */}
      <EvidenceDrawer
        selectedItem={selectedEvidence}
        onClose={clearSelection}
      />
    </div>
  );
}
