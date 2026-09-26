# Graph Report - kyros  (2026-09-26)

## Corpus Check
- 130 files · ~51,834 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: .example 1, (none) 1, .ico 1)

## Summary
- 812 nodes · 2211 edges · 53 communities (41 shown, 12 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 145 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0767f425`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- kyros-error.ts
- use-workflow-store.ts
- task.ts
- WorkflowExecutor
- package.json
- phase1-thin-slice.test.ts
- components.json
- compilerOptions
- Architecture
- next
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
- 2. Inventory of Additions & Readiness
- dependencies
- executor.test.ts
- KyrosError
- webcmd-provider.ts
- Task
- env.ts
- InMemoryWorkflowRepository
- ConcurrencyLimiter
- run-progress-view.tsx
- Member 2 Implementation & Handoff Report: Planning & Orchestration
- Member 4 platform audit
- workflow-executor.ts
- GEMINI.md
- page.tsx
- react
- CreditLedgerEntry
- stripe.test.ts
- dataset-view.tsx
- 2. Inventory of Additions & Readiness (Production vs. Placeholder)
- devDependencies
- SupabaseCreditService
- x402-payer.ts
- premium-data/handler.ts
- layout.tsx
- history-view.tsx
- supabase-credit-service.ts
- Workflow
- Member 1 Implementation & Handoff Report: Product Experience & Dataset UI
- scripts
- ITaskClaimer
- Member 3 Implementation & Handoff Report: Research, Extraction & Quality

## God Nodes (most connected - your core abstractions)
1. `KyrosError` - 79 edges
2. `Task` - 47 edges
3. `2. Inventory of Additions & Readiness` - 42 edges
4. `DatasetFieldSchema` - 39 edges
5. `2. Inventory of Additions & Readiness (Production vs. Placeholder)` - 38 edges
6. `Workflow` - 32 edges
7. `UserCreditAccount` - 24 edges
8. `WorkflowExecutor` - 23 edges
9. `IArtifactStore` - 23 edges
10. `TaskType` - 22 edges

## Surprising Connections (you probably didn't know these)
- `B. With Member 3 (Research, Extraction & Quality)` --references--> `DatasetRecord`  [INFERRED]
  docs/MEMBER_1_REPORT.md → src/core/contracts/dataset.ts
- `B. Partial Failure Pipeline Flow (`QualityPipelineReport`)` --references--> `QualityPipelineReport`  [INFERRED]
  docs/MEMBER_3_REPORT.md → src/core/contracts/quality.ts
- `Working boundaries` --references--> `SupabaseWorkflowRepository`  [INFERRED]
  docs/MEMBER_4_REPORT.md → src/core/persistence/supabase-repository.ts
- `2. Inventory of Additions & Readiness` --references--> `Badge()`  [INFERRED]
  docs/MEMBER_1_REPORT.md → src/components/ui/badge.tsx
- `A. With Member 2 (Planning & Orchestration)` --references--> `RunProgressView()`  [INFERRED]
  docs/MEMBER_1_REPORT.md → src/components/views/run-progress-view.tsx

## Import Cycles
- None detected.

## Communities (53 total, 12 thin omitted)

### Community 0 - "kyros-error.ts"
Cohesion: 0.05
Nodes (31): PlanReviewViewProps, AiRole, DEFAULT_MODEL_ROUTES, GeminiGateway, IGeminiCaller, IGeminiGateway, ModelRouteConfig, StructuredAiRequest (+23 more)

### Community 1 - "use-workflow-store.ts"
Cohesion: 0.18
Nodes (18): src_core_contracts_index_creditledgerentry, src_core_contracts_index_datasetfieldschema, src_core_contracts_index_datasetrecord, src_core_contracts_index_plannerplan, src_core_contracts_index_supportstate, src_core_contracts_index_usercreditaccount, src_core_contracts_index_workflow, src_core_contracts_index_workflowprogresssnapshot (+10 more)

### Community 2 - "task.ts"
Cohesion: 0.22
Nodes (10): NormalizedErrorPayload, TaskProgressItem, WorkflowEventType, DependencyCompletionPolicy, TaskAttemptCounts, TaskState, TaskTimestamps, WorkflowState (+2 more)

### Community 4 - "package.json"
Cohesion: 0.11
Nodes (17): eslintConfig, name, private, version, @base-ui/react, eslint, eslint-config-next, react-dom (+9 more)

### Community 5 - "phase1-thin-slice.test.ts"
Cohesion: 0.06
Nodes (46): 2. Inventory of Additions & Readiness, ref_node_assert, ref_node_test, DatasetViewProps, DatasetExportOptions, DatasetFilter, DatasetRecord, datasetRecordSchema (+38 more)

### Community 6 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 7 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 8 - "Architecture"
Cohesion: 0.22
Nodes (9): Architecture, Architecture decisions, Authorization and safety, Components and boundaries, Credits, budgets, and x402, Data and provenance, Decisions to settle before implementation, Demo x402 workflow reference (+1 more)

### Community 9 - "next"
Cohesion: 0.16
Nodes (13): nextConfig, @clerk/nextjs, next, isValidCheckoutAmount(), POST(), sessionResponseSchema, GET(), POST() (+5 more)

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

### Community 21 - "2. Inventory of Additions & Readiness"
Cohesion: 0.06
Nodes (49): 1. Executive Summary & Deliverable Status, 2. Inventory of Additions & Readiness, ContentArtifact, contentArtifactSchema, SourceArtifact, sourceArtifactSchema, AcquisitionMethod, acquisitionMethodSchema (+41 more)

### Community 22 - "dependencies"
Cohesion: 0.12
Nodes (16): dependencies, @base-ui/react, class-variance-authority, @clerk/nextjs, cn, lucide-react, next, react (+8 more)

### Community 24 - "KyrosError"
Cohesion: 0.29
Nodes (8): authorizeCreditAccountAccess(), authorizeWorkflowAccess(), rejectClientSuppliedUserId(), requireAuthenticatedUserId(), ErrorCategory, ErrorScope, KyrosError, execute()

### Community 25 - "webcmd-provider.ts"
Cohesion: 0.16
Nodes (11): WebcmdNavigationAction, webcmdNavigationActionSchema, WebcmdNavigationRequest, webcmdNavigationRequestSchema, WebcmdNavigationResult, webcmdNavigationResultSchema, DefaultWebcmdHttpClient, IWebcmdHttpClient (+3 more)

### Community 26 - "Task"
Cohesion: 0.21
Nodes (3): Task, IWorkflowRepository, SupabaseWorkflowRepository

### Community 27 - "env.ts"
Cohesion: 0.47
Nodes (4): getServerEnv(), ServerEnv, serverEnvSchema, validateServerEnv()

### Community 30 - "run-progress-view.tsx"
Cohesion: 0.15
Nodes (13): class-variance-authority, cn, Badge(), BadgeProps, badgeVariants, Input, InputProps, Progress (+5 more)

### Community 31 - "Member 2 Implementation & Handoff Report: Planning & Orchestration"
Cohesion: 0.20
Nodes (9): 1. Executive Summary & Repository Status, 3. Scope Verification: Changes Outside Member 2 Ownership, 4. Handoff & Contract Payloads (Per TEAM.md line 37), 5. Architectural Decisions Documented, 6. Verification & Health Summary, B. Member 3 (Research, Extraction & Quality) Integration, Handler Contract:, Member 2 Implementation & Handoff Report: Planning & Orchestration (+1 more)

### Community 32 - "Member 4 platform audit"
Cohesion: 0.40
Nodes (4): Disabled pending integration, Member 4 platform audit, Required to complete Member 4, Working boundaries

### Community 33 - "workflow-executor.ts"
Cohesion: 0.15
Nodes (11): IWorkflowEventObserver, DependencyResolutionResult, DependencyResolver, WorkflowExecutorOptions, DEFAULT_DOMAIN_RETRY_CONFIG, DomainRetryConfig, DomainRetryDecision, TASK_TRANSITIONS (+3 more)

### Community 35 - "page.tsx"
Cohesion: 0.15
Nodes (13): Home(), CreditsView(), DatasetView(), EvidenceDrawer(), EvidenceDrawerProps, HistoryView(), PlanReviewView(), COMMON_FIELDS (+5 more)

### Community 36 - "react"
Cohesion: 0.25
Nodes (9): react, ClerkLiveButton(), ClerkUserButton(), GoogleLogo(), Header(), HeaderProps, Button(), buttonVariants (+1 more)

### Community 37 - "CreditLedgerEntry"
Cohesion: 0.23
Nodes (5): CreditsViewProps, CreditLedgerEntry, LedgerEntryType, ICreditRepository, InMemoryCreditRepository

### Community 38 - "stripe.test.ts"
Cohesion: 0.26
Nodes (6): ref_node_crypto, POST(), CreditDepositor, StripeWebhookHandler, verifyStripeWebhookSignature(), WebhookProcessingResult

### Community 39 - "dataset-view.tsx"
Cohesion: 0.36
Nodes (9): lucide-react, Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader (+1 more)

### Community 40 - "2. Inventory of Additions & Readiness (Production vs. Placeholder)"
Cohesion: 0.27
Nodes (10): A. With Member 2 (Planning & Orchestration), 2. Inventory of Additions & Readiness (Production vs. Placeholder), A. Member 1 (Product Experience & Dataset UI) Integration, Representative Error / Partial Failure Payload:, Representative Progress Payload (`WorkflowProgressSnapshot`):, RunProgressViewProps, WorkflowEvent, WorkflowProgressSnapshot (+2 more)

### Community 41 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx, @types/node, @types/react (+2 more)

### Community 43 - "x402-payer.ts"
Cohesion: 0.25
Nodes (5): viem, TransactionReceipt, BaseSepoliaTreasuryPayer, PaymentSettlementParams, TreasuryPayerOptions

### Community 44 - "premium-data/handler.ts"
Cohesion: 0.33
Nodes (7): @x402/core, @x402/evm, @x402/next, createDemoPremiumRoute(), DemoPremiumConfig, readDemoPremiumConfig(), GET()

### Community 45 - "layout.tsx"
Cohesion: 0.25
Nodes (6): src_app_globals, geistMono, geistSans, inter, metadata, KyrosAuthProvider()

### Community 46 - "history-view.tsx"
Cohesion: 0.28
Nodes (7): Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, HistoryViewProps

### Community 47 - "supabase-credit-service.ts"
Cohesion: 0.36
Nodes (6): zod, creditLedgerEntrySchema, userCreditAccountSchema, accountRowSchema, ledgerRowSchema, SupabaseCreditConfig

### Community 49 - "Member 1 Implementation & Handoff Report: Product Experience & Dataset UI"
Cohesion: 0.29
Nodes (6): 1. Executive Summary & Deliverable Status, 3. Contract Agreements & Handoffs, 4. Verification & Quality Summary, B. With Member 3 (Research, Extraction & Quality), C. With Member 4 (Platform, Persistence & Payments), Member 1 Implementation & Handoff Report: Product Experience & Dataset UI

### Community 50 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, typecheck

### Community 51 - "ITaskClaimer"
Cohesion: 0.33
Nodes (3): C. Member 4 (Platform, Persistence & Payments) Integration, Contract Interfaces (`src/core/persistence/repository.ts`):, ITaskClaimer

### Community 52 - "Member 3 Implementation & Handoff Report: Research, Extraction & Quality"
Cohesion: 0.33
Nodes (5): 3. Representative Payloads & Handoffs, 4. Verification & Health Summary, A. Success Pipeline Flow, B. Partial Failure Pipeline Flow (`QualityPipelineReport`), Member 3 Implementation & Handoff Report: Research, Extraction & Quality

## Knowledge Gaps
- **207 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+202 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 266 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `KyrosError` connect `KyrosError` to `kyros-error.ts`, `workflow-executor.ts`, `WorkflowExecutor`, `phase1-thin-slice.test.ts`, `stripe.test.ts`, `CreditLedgerEntry`, `2. Inventory of Additions & Readiness (Production vs. Placeholder)`, `next`, `SupabaseCreditService`, `x402-payer.ts`, `supabase-credit-service.ts`, `UserCreditAccount`, `2. Inventory of Additions & Readiness`, `executor.test.ts`, `webcmd-provider.ts`, `env.ts`, `InMemoryWorkflowRepository`?**
  _High betweenness centrality (0.160) - this node is a cross-community bridge._
- **Why does `Environment Configuration and Integration Wiring` connect `Engineering guide` to `kyros-error.ts`, `2. Inventory of Additions & Readiness`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **Why does `Engineering guide` connect `Engineering guide` to `AGENTS.md`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `KyrosError` (e.g. with `2. Inventory of Additions & Readiness (Production vs. Placeholder)` and `1. Executive Summary & Deliverable Status`) actually correct?**
  _`KyrosError` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 41 inferred relationships involving `2. Inventory of Additions & Readiness` (e.g. with `GeminiGateway` and `ContentArtifact`) actually correct?**
  _`2. Inventory of Additions & Readiness` has 41 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `DatasetFieldSchema` (e.g. with `2. Inventory of Additions & Readiness (Production vs. Placeholder)` and `2. Inventory of Additions & Readiness`) actually correct?**
  _`DatasetFieldSchema` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 37 inferred relationships involving `2. Inventory of Additions & Readiness (Production vs. Placeholder)` (e.g. with `GeminiGateway` and `IGeminiCaller`) actually correct?**
  _`2. Inventory of Additions & Readiness (Production vs. Placeholder)` has 37 INFERRED edges - model-reasoned connections that need verification._