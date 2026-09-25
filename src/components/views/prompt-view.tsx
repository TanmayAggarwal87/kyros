"use client";

import React, { useState } from "react";
import {
  Search,
  ArrowRight,
  SlidersHorizontal,
  X,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DEMO_PRESET_PROMPTS } from "@/lib/fixtures";

interface PromptViewProps {
  onPlan: (prompt: string, constraints: string[], maxSpend: number, allowPaid: boolean) => Promise<void>;
  isPlanning: boolean;
  userAvailableCredits: number;
}

const COMMON_FIELDS = [
  "company_name",
  "funding_amount_usd",
  "stage",
  "founders",
  "verified_website",
  "headquarters",
  "technical_focus",
];

export function PromptView({ onPlan, isPlanning, userAvailableCredits }: PromptViewProps) {
  const [prompt, setPrompt] = useState(
    "Top AI infrastructure startups founded in 2024 with funding amounts, verified founders, and benchmark telemetry"
  );
  const [selectedFields, setSelectedFields] = useState<string[]>([
    "company_name",
    "funding_amount_usd",
    "stage",
    "founders",
    "verified_website",
  ]);
  const [customFieldInput, setCustomFieldInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [maxSpend, setMaxSpend] = useState<number>(0.05);
  const [allowPaidSources, setAllowPaidSources] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAddField = (field: string) => {
    const clean = field.trim().toLowerCase().replace(/\s+/g, "_");
    if (clean && !selectedFields.includes(clean)) {
      setSelectedFields([...selectedFields, clean]);
    }
    setCustomFieldInput("");
  };

  const handleRemoveField = (field: string) => {
    setSelectedFields(selectedFields.filter((f) => f !== field));
  };

  const handleSelectPreset = (preset: (typeof DEMO_PRESET_PROMPTS)[0]) => {
    setPrompt(preset.prompt);
    setSelectedFields(preset.constraints);
    setMaxSpend(preset.maxSpend);
    setAllowPaidSources(preset.allowPaid);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      setErrorMsg("Please enter a research prompt.");
      return;
    }

    if (maxSpend > userAvailableCredits) {
      setErrorMsg(
        `Budget ($${maxSpend.toFixed(2)}) exceeds available credit balance ($${userAvailableCredits.toFixed(2)}). Please add credits.`
      );
      return;
    }

    setErrorMsg(null);
    await onPlan(prompt.trim(), selectedFields, maxSpend, allowPaidSources);
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-8 animate-in fade-in duration-200">
      {/* Friendly, Professional Hero Header */}
      <div className="text-center space-y-3 pt-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-medium">
          <Search className="size-3.5" />
          <span>Verifiable Web Research & Structured Datasets</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          What would you like to research?
        </h1>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Ask in plain English. Kyros searches primary web sources, extracts verified columns, and links every single data point to its citation.
        </p>
      </div>

      {/* Main Research Composer Card */}
      <div className="rounded-2xl border border-border bg-card shadow-lg p-5 sm:p-6 space-y-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Research Objective</span>
              <span className="text-[11px] text-muted-foreground font-normal">
                Press <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px] font-mono">Ctrl+Enter</kbd> to run
              </span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              rows={3}
              placeholder="e.g. Find top AI infrastructure startups founded in 2024 with funding amounts, founders, and verified website..."
              className="w-full rounded-xl border border-input bg-background/60 p-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none leading-relaxed"
            />
          </div>

          {/* Columns Tag Builder */}
          <div className="space-y-2 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                Target Data Columns ({selectedFields.length} selected)
              </label>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span>Quick add:</span>
                {COMMON_FIELDS.filter((f) => !selectedFields.includes(f)).slice(0, 3).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => handleAddField(f)}
                    className="px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors"
                  >
                    + {f.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 min-h-[38px] p-2 rounded-xl bg-muted/30 border border-border/60">
              {selectedFields.map((field) => (
                <span
                  key={field}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background text-xs font-mono font-medium text-foreground border border-border/80 shadow-xs"
                >
                  <span>{field}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveField(field)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}

              <div className="inline-flex items-center">
                <input
                  type="text"
                  value={customFieldInput}
                  onChange={(e) => setCustomFieldInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddField(customFieldInput);
                    }
                  }}
                  placeholder="+ Add column"
                  className="h-7 px-2.5 text-xs font-mono rounded-lg bg-transparent border border-dashed border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary w-28"
                />
              </div>
            </div>
          </div>

          {/* Collapsible Budget & Source Settings */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <SlidersHorizontal className="size-3.5" />
              <span>Budget & Provider Settings</span>
              {showSettings ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>

            {showSettings && (
              <div className="mt-3 p-4 rounded-xl border border-border/70 bg-muted/20 space-y-4 animate-in slide-in-from-top-1 duration-150">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-foreground">Workflow Spend Limit</div>
                    <div className="text-[11px] text-muted-foreground">
                      Maximum cost allowed for this research run. Unspent budget is refunded.
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[0.05, 0.1, 0.25, 0.5].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setMaxSpend(amt)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                          maxSpend === amt
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-foreground border-border hover:bg-muted"
                        }`}
                      >
                        ${amt.toFixed(2)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-border/50 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <span>Include x402 Premium Telemetry</span>
                      <Badge variant="outline" className="text-[10px] text-purple-600 dark:text-purple-400 border-purple-500/30">
                        Base Sepolia
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Permits autonomous on-chain micropayments for private benchmark telemetry feeds.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowPaidSources}
                    onChange={(e) => setAllowPaidSources(e.target.checked)}
                    className="size-4 rounded border-border text-primary cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Error notice */}
          {errorMsg && (
            <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs">
              {errorMsg}
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 text-emerald-500" />
              <span>100% Sourced Claims • Citations linked to every cell</span>
            </div>

            <Button
              type="submit"
              disabled={isPlanning}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-md px-5"
            >
              {isPlanning ? (
                <>
                  <div className="size-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  <span>Creating Plan...</span>
                </>
              ) : (
                <>
                  <span>Create Research Plan</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Preset Inspirations Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Example Research Queries
          </span>
          <span className="text-xs text-muted-foreground">Click any card to load</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {DEMO_PRESET_PROMPTS.map((preset, idx) => (
            <div
              key={idx}
              onClick={() => handleSelectPreset(preset)}
              className="p-4 rounded-xl border border-border bg-card hover:bg-muted/40 hover:border-primary/50 transition-all cursor-pointer space-y-2 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                  {preset.title}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                  ${preset.maxSpend.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {preset.prompt}
              </p>
              <div className="flex flex-wrap items-center gap-1 pt-1">
                {preset.constraints.slice(0, 3).map((c) => (
                  <span
                    key={c}
                    className="px-2 py-0.5 rounded bg-muted/60 text-[10px] font-mono text-muted-foreground"
                  >
                    {c}
                  </span>
                ))}
                {preset.constraints.length > 3 && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    +{preset.constraints.length - 3} more
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
