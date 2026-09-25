# Graph Report - kyros  (2026-09-26)

## Corpus Check
- 100 files · ~38,504 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: .example 1, (none) 1, .ico 1)

## Summary
- 623 nodes · 1443 edges · 35 communities (24 shown, 11 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 75 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `13488c20`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- planner/planner.ts
- use-workflow-store.ts
- 2. Inventory of Additions & Readiness (Production vs. Placeholder)
- WorkflowExecutor
- package.json
- dataset.ts
- components.json
- compilerOptions
- Architecture
- supabase-credit-service.ts
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
- retry.test.ts
- dependencies
- Task
- KyrosError
- gateway.ts
- SupabaseWorkflowRepository
- ref_node_assert
- InMemoryWorkflowRepository
- ConcurrencyLimiter
- dag.test.ts
- Member 2 Implementation & Handoff Report: Planning & Orchestration
- Member 4 platform audit
- .isTerminal
- GEMINI.md

## God Nodes (most connected - your core abstractions)
1. `KyrosError` - 63 edges
2. `Task` - 46 edges
3. `2. Inventory of Additions & Readiness (Production vs. Placeholder)` - 38 edges
4. `Workflow` - 30 edges
5. `UserCreditAccount` - 24 edges
6. `WorkflowExecutor` - 21 edges
7. `react` - 20 edges
8. `SupabaseWorkflowRepository` - 19 edges
9. `IWorkflowRepository` - 18 edges
10. `NormalizedErrorPayload` - 17 edges

## Surprising Connections (you probably didn't know these)
- `B. With Member 3 (Research, Extraction & Quality)` --references--> `DatasetRecord`  [INFERRED]
  docs/MEMBER_1_REPORT.md → src/core/contracts/dataset.ts
- `Working boundaries` --references--> `SupabaseWorkflowRepository`  [INFERRED]
  docs/MEMBER_4_REPORT.md → src/core/persistence/supabase-repository.ts
- `2. Inventory of Additions & Readiness` --references--> `Badge()`  [INFERRED]
  docs/MEMBER_1_REPORT.md → src/components/ui/badge.tsx
- `2. Inventory of Additions & Readiness (Production vs. Placeholder)` --references--> `IGeminiCaller`  [INFERRED]
  docs/MEMBER_2_REPORT.md → src/core/ai/gateway.ts
- `2. Inventory of Additions & Readiness (Production vs. Placeholder)` --references--> `IGeminiGateway`  [INFERRED]
  docs/MEMBER_2_REPORT.md → src/core/ai/gateway.ts

## Import Cycles
- None detected.

## Communities (35 total, 11 thin omitted)

### Community 0 - "planner/planner.ts"
Cohesion: 0.15
Nodes (11): PlanReviewViewProps, IGeminiGateway, PlannerPlan, Planner, DatasetFieldSchemaZod, DatasetFieldTypeSchema, DependencyCompletionPolicySchema, PlannerInputSchemaZod (+3 more)

### Community 1 - "use-workflow-store.ts"
Cohesion: 0.05
Nodes (71): A. With Member 2 (Planning & Orchestration), class-variance-authority, cn, lucide-react, react, Home(), ClerkLiveButton(), ClerkUserButton() (+63 more)

### Community 2 - "2. Inventory of Additions & Readiness (Production vs. Placeholder)"
Cohesion: 0.07
Nodes (48): 2. Inventory of Additions & Readiness (Production vs. Placeholder), 4. Handoff & Contract Payloads (Per TEAM.md line 37), A. Member 1 (Product Experience & Dataset UI) Integration, B. Member 3 (Research, Extraction & Quality) Integration, C. Member 4 (Platform, Persistence & Payments) Integration, Contract Interfaces (`src/core/persistence/repository.ts`):, Handler Contract:, Representative Error / Partial Failure Payload: (+40 more)

### Community 4 - "package.json"
Cohesion: 0.05
Nodes (41): eslintConfig, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx, @types/node (+33 more)

### Community 5 - "dataset.ts"
Cohesion: 0.11
Nodes (18): 2. Inventory of Additions & Readiness, viem, DatasetViewProps, AcquisitionMethod, acquisitionMethodSchema, DatasetExportOptions, DatasetFilter, datasetRecordSchema (+10 more)

### Community 6 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 7 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 8 - "Architecture"
Cohesion: 0.22
Nodes (9): Architecture, Architecture decisions, Authorization and safety, Components and boundaries, Credits, budgets, and x402, Data and provenance, Decisions to settle before implementation, Demo x402 workflow reference (+1 more)

### Community 9 - "supabase-credit-service.ts"
Cohesion: 0.06
Nodes (32): nextConfig, @clerk/nextjs, next, ref_node_crypto, zod, isValidCheckoutAmount(), POST(), sessionResponseSchema (+24 more)

### Community 12 - "Engineering guide"
Cohesion: 0.25
Nodes (8): API and contract conventions, Code quality, Engineering guide, Error handling and reliability, Repository workflow and actual commands, Security, Testing and evaluation, Type safety and boundary validation

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
Cohesion: 0.11
Nodes (13): 1. Executive Summary & Deliverable Status, 3. Contract Agreements & Handoffs, 4. Verification & Quality Summary, B. With Member 3 (Research, Extraction & Quality), C. With Member 4 (Platform, Persistence & Payments), Member 1 Implementation & Handoff Report: Product Experience & Dataset UI, CreditsViewProps, CreditLedgerEntry (+5 more)

### Community 21 - "retry.test.ts"
Cohesion: 0.17
Nodes (8): 5. Architectural Decisions Documented, DEFAULT_GEMINI_RETRY_CONFIG, defaultSleeper, GeminiRetryConfig, GeminiRetryPolicy, RetryAttemptLog, Sleeper, MockSleeper

### Community 22 - "dependencies"
Cohesion: 0.12
Nodes (16): dependencies, @base-ui/react, class-variance-authority, @clerk/nextjs, cn, lucide-react, next, react (+8 more)

### Community 23 - "Task"
Cohesion: 0.18
Nodes (3): Task, TaskGraph, IWorkflowRepository

### Community 24 - "KyrosError"
Cohesion: 0.32
Nodes (7): authorizeCreditAccountAccess(), authorizeWorkflowAccess(), rejectClientSuppliedUserId(), requireAuthenticatedUserId(), ErrorCategory, ErrorScope, KyrosError

### Community 25 - "gateway.ts"
Cohesion: 0.19
Nodes (8): Environment Configuration and Integration Wiring, AiRole, DEFAULT_MODEL_ROUTES, GeminiGateway, IGeminiCaller, ModelRouteConfig, StructuredAiRequest, MockGeminiCaller

### Community 27 - "ref_node_assert"
Cohesion: 0.26
Nodes (6): ref_node_assert, ref_node_test, getServerEnv(), ServerEnv, serverEnvSchema, validateServerEnv()

### Community 31 - "Member 2 Implementation & Handoff Report: Planning & Orchestration"
Cohesion: 0.33
Nodes (5): 1. Executive Summary & Repository Status, 3. Scope Verification: Changes Outside Member 2 Ownership, 6. Verification & Health Summary, Member 2 Implementation & Handoff Report: Planning & Orchestration, Necessary Shared Configuration Changes:

### Community 32 - "Member 4 platform audit"
Cohesion: 0.40
Nodes (4): Disabled pending integration, Member 4 platform audit, Required to complete Member 4, Working boundaries

## Knowledge Gaps
- **187 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+182 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 227 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `KyrosError` connect `KyrosError` to `planner/planner.ts`, `.isTerminal`, `2. Inventory of Additions & Readiness (Production vs. Placeholder)`, `WorkflowExecutor`, `dataset.ts`, `supabase-credit-service.ts`, `UserCreditAccount`, `retry.test.ts`, `gateway.ts`, `ref_node_assert`, `dag.test.ts`?**
  _High betweenness centrality (0.170) - this node is a cross-community bridge._
- **Why does `2. Inventory of Additions & Readiness (Production vs. Placeholder)` connect `2. Inventory of Additions & Readiness (Production vs. Placeholder)` to `planner/planner.ts`, `WorkflowExecutor`, `retry.test.ts`, `Task`, `KyrosError`, `gateway.ts`, `ConcurrencyLimiter`, `Member 2 Implementation & Handoff Report: Planning & Orchestration`?**
  _High betweenness centrality (0.153) - this node is a cross-community bridge._
- **Why does `GeminiGateway` connect `gateway.ts` to `planner/planner.ts`, `2. Inventory of Additions & Readiness (Production vs. Placeholder)`, `retry.test.ts`?**
  _High betweenness centrality (0.137) - this node is a cross-community bridge._
- **Are the 37 inferred relationships involving `2. Inventory of Additions & Readiness (Production vs. Placeholder)` (e.g. with `GeminiGateway` and `IGeminiCaller`) actually correct?**
  _`2. Inventory of Additions & Readiness (Production vs. Placeholder)` has 37 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `UserCreditAccount` (e.g. with `2. Inventory of Additions & Readiness` and `C. With Member 4 (Platform, Persistence & Payments)`) actually correct?**
  _`UserCreditAccount` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _187 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `planner/planner.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14619883040935672 - nodes in this community are weakly interconnected._