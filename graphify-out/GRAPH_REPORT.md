# Graph Report - kyros  (2026-09-26)

## Corpus Check
- 137 files · ~57,273 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: .example 1, (none) 1, .ico 1)

## Summary
- 851 nodes · 2471 edges · 50 communities (39 shown, 11 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 155 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `692b8b4e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- 2. Inventory of Additions & Readiness (Production vs. Placeholder)
- use-workflow-store.ts
- supabase-repository.ts
- retry.test.ts
- package.json
- phase1-thin-slice.test.ts
- components.json
- compilerOptions
- Architecture
- KyrosError
- AGENTS.md
- postcss.config.mjs
- Engineering guide
- Workflows
- Frontend
- Team and delivery plan
- Kyros
- Kyros agent entry point
- MEMBER_2_CONTEXT.MD
- UserCreditAccount
- handlers/index.ts
- dependencies
- core/index.ts
- e2e-integration.test.ts
- webcmd-provider.ts
- Task
- page.tsx
- InMemoryWorkflowRepository
- ConcurrencyLimiter
- history-view.tsx
- Member 2 Implementation & Handoff Report: Planning & Orchestration
- Member 4 platform audit
- .isTerminal
- GEMINI.md
- badge.tsx
- react
- IGeminiCaller
- PostgrestSupabaseDbClient
- dataset-view.tsx
- run-progress-view.tsx
- devDependencies
- DatasetRecord
- x402-payer.ts
- premium-data/handler.ts
- layout.tsx
- supabase-repository.test.ts
- domain-retry.ts
- scripts
- ITaskClaimer

## God Nodes (most connected - your core abstractions)
1. `KyrosError` - 89 edges
2. `Task` - 47 edges
3. `2. Inventory of Additions & Readiness` - 42 edges
4. `DatasetFieldSchema` - 39 edges
5. `2. Inventory of Additions & Readiness (Production vs. Placeholder)` - 38 edges
6. `Workflow` - 37 edges
7. `WorkflowExecutor` - 34 edges
8. `IWorkflowRepository` - 28 edges
9. `DatasetRecord` - 26 edges
10. `UserCreditAccount` - 24 edges

## Surprising Connections (you probably didn't know these)
- `Working boundaries` --references--> `SupabaseWorkflowRepository`  [INFERRED]
  docs/MEMBER_4_REPORT.md → src/core/persistence/supabase-repository.ts
- `2. Inventory of Additions & Readiness` --references--> `Badge()`  [INFERRED]
  docs/MEMBER_1_REPORT.md → src/components/ui/badge.tsx
- `2. Inventory of Additions & Readiness (Production vs. Placeholder)` --references--> `IGeminiCaller`  [INFERRED]
  docs/MEMBER_2_REPORT.md → src/core/ai/gateway.ts
- `Environment Configuration and Integration Wiring` --references--> `GeminiGateway`  [INFERRED]
  docs/ENGINEERING.md → src/core/ai/gateway.ts
- `2. Inventory of Additions & Readiness (Production vs. Placeholder)` --references--> `GeminiGateway`  [INFERRED]
  docs/MEMBER_2_REPORT.md → src/core/ai/gateway.ts

## Import Cycles
- None detected.

## Communities (50 total, 11 thin omitted)

### Community 0 - "2. Inventory of Additions & Readiness (Production vs. Placeholder)"
Cohesion: 0.24
Nodes (9): 2. Inventory of Additions & Readiness (Production vs. Placeholder), PlanReviewViewProps, IGeminiGateway, IPlanner, PlannerInput, PlannerPlan, BudgetPolicy, WorkflowSummary (+1 more)

### Community 1 - "use-workflow-store.ts"
Cohesion: 0.14
Nodes (19): PlanReviewView(), src_core_contracts_index_creditledgerentry, src_core_contracts_index_datasetfieldschema, src_core_contracts_index_datasetrecord, src_core_contracts_index_plannerplan, src_core_contracts_index_supportstate, src_core_contracts_index_usercreditaccount, src_core_contracts_index_workflow (+11 more)

### Community 2 - "supabase-repository.ts"
Cohesion: 0.18
Nodes (13): NormalizedErrorPayload, TaskProgressItem, WorkflowEventType, TaskAttemptCounts, TaskState, TaskTimestamps, WorkflowState, WorkflowTimestamps (+5 more)

### Community 3 - "retry.test.ts"
Cohesion: 0.15
Nodes (7): 5. Architectural Decisions Documented, DEFAULT_GEMINI_RETRY_CONFIG, defaultSleeper, RetryAttemptLog, Sleeper, DomainRetryPolicy, MockSleeper

### Community 4 - "package.json"
Cohesion: 0.11
Nodes (17): eslintConfig, name, private, version, @base-ui/react, eslint, eslint-config-next, react-dom (+9 more)

### Community 5 - "phase1-thin-slice.test.ts"
Cohesion: 0.06
Nodes (44): ref_node_assert, ref_node_test, acquisitionMethodSchema, DatasetExportOptions, DatasetFilter, datasetRecordSchema, DatasetSort, FieldEvidence (+36 more)

### Community 6 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 7 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 8 - "Architecture"
Cohesion: 0.22
Nodes (9): Architecture, Architecture decisions, Authorization and safety, Components and boundaries, Credits, budgets, and x402, Data and provenance, Decisions to settle before implementation, Demo x402 workflow reference (+1 more)

### Community 9 - "KyrosError"
Cohesion: 0.09
Nodes (36): nextConfig, next, isValidCheckoutAmount(), POST(), sessionResponseSchema, GET(), POST(), POST() (+28 more)

### Community 12 - "Engineering guide"
Cohesion: 0.22
Nodes (9): API and contract conventions, Code quality, Engineering guide, Environment Configuration and Integration Wiring, Error handling and reliability, Repository workflow and actual commands, Security, Testing and evaluation (+1 more)

### Community 13 - "Workflows"
Cohesion: 0.29
Nodes (7): Failure and retry policy, Invariants, Lifecycle and execution, Plan and task contract, Roles and capabilities, Shared state and context, Workflows

### Community 14 - "Frontend"
Cohesion: 0.40
Nodes (5): Component and data boundaries, Design and accessibility, Frontend, Integration sequence, Product path and information architecture

### Community 15 - "Team and delivery plan"
Cohesion: 0.40
Nodes (5): Contracts to agree in Phase 0, Early blockers and handoff rule, Milestones and parallel work, Ownership and handoffs, Team and delivery plan

### Community 16 - "Kyros"
Cohesion: 0.40
Nodes (5): Current status, Guides, Intended architecture, Kyros, Local setup

### Community 17 - "Kyros agent entry point"
Cohesion: 0.50
Nodes (4): Before changing code, Commands and completion, Guardrails, Kyros agent entry point

### Community 20 - "UserCreditAccount"
Cohesion: 0.08
Nodes (20): ref_node_crypto, zod, POST(), CreditsViewProps, CreditLedgerEntry, creditLedgerEntrySchema, LedgerEntryType, UserCreditAccount (+12 more)

### Community 21 - "handlers/index.ts"
Cohesion: 0.05
Nodes (58): 1. Executive Summary & Deliverable Status, 2. Inventory of Additions & Readiness, 3. Representative Payloads & Handoffs, 4. Verification & Health Summary, A. Success Pipeline Flow, B. Partial Failure Pipeline Flow (`QualityPipelineReport`), Member 3 Implementation & Handoff Report: Research, Extraction & Quality, ContentArtifact (+50 more)

### Community 22 - "dependencies"
Cohesion: 0.12
Nodes (16): dependencies, @base-ui/react, class-variance-authority, @clerk/nextjs, cn, lucide-react, next, react (+8 more)

### Community 23 - "core/index.ts"
Cohesion: 0.15
Nodes (7): PlanTask, DependencyCompletionPolicy, CycleDetector, DirectedNode, TaskGraph, PlanTaskSchemaZod, execute()

### Community 24 - "e2e-integration.test.ts"
Cohesion: 0.18
Nodes (8): AiRole, DEFAULT_MODEL_ROUTES, GeminiGateway, ModelRouteConfig, StructuredAiRequest, GeminiRetryConfig, GeminiRetryPolicy, search()

### Community 25 - "webcmd-provider.ts"
Cohesion: 0.16
Nodes (11): WebcmdNavigationAction, webcmdNavigationActionSchema, WebcmdNavigationRequest, webcmdNavigationRequestSchema, WebcmdNavigationResult, webcmdNavigationResultSchema, DefaultWebcmdHttpClient, IWebcmdHttpClient (+3 more)

### Community 26 - "Task"
Cohesion: 0.12
Nodes (5): HistoryViewProps, Task, Workflow, IWorkflowRepository, SupabaseWorkflowRepository

### Community 27 - "page.tsx"
Cohesion: 0.22
Nodes (9): Home(), CreditsView(), DatasetView(), HistoryView(), COMMON_FIELDS, PromptView(), PromptViewProps, DEMO_PRESET_PROMPTS (+1 more)

### Community 30 - "history-view.tsx"
Cohesion: 0.15
Nodes (12): cn, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, Input (+4 more)

### Community 31 - "Member 2 Implementation & Handoff Report: Planning & Orchestration"
Cohesion: 0.22
Nodes (8): 1. Executive Summary & Repository Status, 3. Scope Verification: Changes Outside Member 2 Ownership, 4. Handoff & Contract Payloads (Per TEAM.md line 37), 6. Verification & Health Summary, B. Member 3 (Research, Extraction & Quality) Integration, Handler Contract:, Member 2 Implementation & Handoff Report: Planning & Orchestration, Necessary Shared Configuration Changes:

### Community 32 - "Member 4 platform audit"
Cohesion: 0.40
Nodes (4): Disabled pending integration, Member 4 platform audit, Required to complete Member 4, Working boundaries

### Community 35 - "badge.tsx"
Cohesion: 0.36
Nodes (6): Badge(), BadgeProps, badgeVariants, EvidenceDrawer(), EvidenceDrawerProps, SelectedEvidenceItem

### Community 36 - "react"
Cohesion: 0.23
Nodes (10): class-variance-authority, react, ClerkLiveButton(), ClerkUserButton(), GoogleLogo(), Header(), HeaderProps, Button() (+2 more)

### Community 37 - "IGeminiCaller"
Cohesion: 0.22
Nodes (4): GeminiHttpCaller, IGeminiCaller, MockGeminiCaller, MockGeminiCaller

### Community 39 - "dataset-view.tsx"
Cohesion: 0.36
Nodes (9): lucide-react, Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader (+1 more)

### Community 40 - "run-progress-view.tsx"
Cohesion: 0.23
Nodes (10): A. With Member 2 (Planning & Orchestration), A. Member 1 (Product Experience & Dataset UI) Integration, Representative Error / Partial Failure Payload:, Representative Progress Payload (`WorkflowProgressSnapshot`):, Progress, ProgressProps, RunProgressView(), RunProgressViewProps (+2 more)

### Community 41 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx, @types/node, @types/react (+2 more)

### Community 42 - "DatasetRecord"
Cohesion: 0.14
Nodes (10): 1. Executive Summary & Deliverable Status, 2. Inventory of Additions & Readiness, 3. Contract Agreements & Handoffs, 4. Verification & Quality Summary, B. With Member 3 (Research, Extraction & Quality), C. With Member 4 (Platform, Persistence & Payments), Member 1 Implementation & Handoff Report: Product Experience & Dataset UI, DatasetViewProps (+2 more)

### Community 43 - "x402-payer.ts"
Cohesion: 0.24
Nodes (5): viem, TransactionReceipt, BaseSepoliaTreasuryPayer, PaymentSettlementParams, TreasuryPayerOptions

### Community 44 - "premium-data/handler.ts"
Cohesion: 0.33
Nodes (7): @x402/core, @x402/evm, @x402/next, createDemoPremiumRoute(), DemoPremiumConfig, readDemoPremiumConfig(), GET()

### Community 45 - "layout.tsx"
Cohesion: 0.18
Nodes (8): @clerk/nextjs, src_app_globals, geistMono, geistSans, inter, metadata, KyrosAuthProvider(), config

### Community 50 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, typecheck

### Community 51 - "ITaskClaimer"
Cohesion: 0.33
Nodes (3): C. Member 4 (Platform, Persistence & Payments) Integration, Contract Interfaces (`src/core/persistence/repository.ts`):, ITaskClaimer

## Knowledge Gaps
- **216 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+211 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 277 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `KyrosError` connect `KyrosError` to `2. Inventory of Additions & Readiness (Production vs. Placeholder)`, `supabase-repository.ts`, `retry.test.ts`, `IGeminiCaller`, `phase1-thin-slice.test.ts`, `x402-payer.ts`, `UserCreditAccount`, `handlers/index.ts`, `core/index.ts`, `e2e-integration.test.ts`, `webcmd-provider.ts`?**
  _High betweenness centrality (0.142) - this node is a cross-community bridge._
- **Why does `Environment Configuration and Integration Wiring` connect `Engineering guide` to `e2e-integration.test.ts`, `handlers/index.ts`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Why does `Engineering guide` connect `Engineering guide` to `AGENTS.md`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `KyrosError` (e.g. with `2. Inventory of Additions & Readiness (Production vs. Placeholder)` and `1. Executive Summary & Deliverable Status`) actually correct?**
  _`KyrosError` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 41 inferred relationships involving `2. Inventory of Additions & Readiness` (e.g. with `GeminiGateway` and `ContentArtifact`) actually correct?**
  _`2. Inventory of Additions & Readiness` has 41 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `DatasetFieldSchema` (e.g. with `2. Inventory of Additions & Readiness (Production vs. Placeholder)` and `2. Inventory of Additions & Readiness`) actually correct?**
  _`DatasetFieldSchema` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 37 inferred relationships involving `2. Inventory of Additions & Readiness (Production vs. Placeholder)` (e.g. with `GeminiGateway` and `IGeminiCaller`) actually correct?**
  _`2. Inventory of Additions & Readiness (Production vs. Placeholder)` has 37 INFERRED edges - model-reasoned connections that need verification._