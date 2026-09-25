# Graph Report - kyros  (2026-09-25)

## Corpus Check
- 69 files · ~29,661 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 1, .ico 1, .css 1)

## Summary
- 484 nodes · 1068 edges · 20 communities (16 shown, 4 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 63 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `13488c20`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- KyrosError
- dataset-view.tsx
- 2. Inventory of Additions & Readiness (Production vs. Placeholder)
- WorkflowExecutor
- package.json
- use-workflow-store.ts
- components.json
- compilerOptions
- Architecture
- layout.tsx
- AGENTS.md
- postcss.config.mjs
- Engineering guide
- Workflows
- Frontend
- Team and delivery plan
- Kyros
- Kyros agent entry point
- MEMBER_2_CONTEXT.MD

## God Nodes (most connected - your core abstractions)
1. `2. Inventory of Additions & Readiness (Production vs. Placeholder)` - 38 edges
2. `Task` - 37 edges
3. `KyrosError` - 34 edges
4. `Workflow` - 25 edges
5. `WorkflowExecutor` - 21 edges
6. `react` - 17 edges
7. `InMemoryWorkflowRepository` - 16 edges
8. `IWorkflowRepository` - 16 edges
9. `compilerOptions` - 16 edges
10. `NormalizedErrorPayload` - 15 edges

## Surprising Connections (you probably didn't know these)
- `2. Inventory of Additions & Readiness` --references--> `Badge()`  [INFERRED]
  docs/MEMBER_1_REPORT.md → src/components/ui/badge.tsx
- `2. Inventory of Additions & Readiness (Production vs. Placeholder)` --references--> `IGeminiCaller`  [INFERRED]
  docs/MEMBER_2_REPORT.md → src/core/ai/gateway.ts
- `2. Inventory of Additions & Readiness (Production vs. Placeholder)` --references--> `IGeminiGateway`  [INFERRED]
  docs/MEMBER_2_REPORT.md → src/core/ai/gateway.ts
- `2. Inventory of Additions & Readiness (Production vs. Placeholder)` --references--> `GeminiGateway`  [INFERRED]
  docs/MEMBER_2_REPORT.md → src/core/ai/gateway.ts
- `2. Inventory of Additions & Readiness (Production vs. Placeholder)` --references--> `Sleeper`  [INFERRED]
  docs/MEMBER_2_REPORT.md → src/core/ai/retry-policy.ts

## Import Cycles
- None detected.

## Communities (20 total, 4 thin omitted)

### Community 0 - "KyrosError"
Cohesion: 0.06
Nodes (39): ref_node_assert, ref_node_test, PlanReviewViewProps, AiRole, DEFAULT_MODEL_ROUTES, GeminiGateway, IGeminiCaller, IGeminiGateway (+31 more)

### Community 1 - "dataset-view.tsx"
Cohesion: 0.08
Nodes (43): class-variance-authority, cn, lucide-react, react, Header(), HeaderProps, Badge(), BadgeProps (+35 more)

### Community 2 - "2. Inventory of Additions & Readiness (Production vs. Placeholder)"
Cohesion: 0.05
Nodes (46): 2. Inventory of Additions & Readiness (Production vs. Placeholder), 4. Handoff & Contract Payloads (Per TEAM.md line 37), A. Member 1 (Product Experience & Dataset UI) Integration, B. Member 3 (Research, Extraction & Quality) Integration, C. Member 4 (Platform, Persistence & Payments) Integration, Contract Interfaces (`src/core/persistence/repository.ts`):, Handler Contract:, Representative Error / Partial Failure Payload: (+38 more)

### Community 3 - "WorkflowExecutor"
Cohesion: 0.11
Nodes (9): 1. Executive Summary & Repository Status, 3. Scope Verification: Changes Outside Member 2 Ownership, 5. Architectural Decisions Documented, 6. Verification & Health Summary, Member 2 Implementation & Handoff Report: Planning & Orchestration, Necessary Shared Configuration Changes:, ConcurrencyLimiter, WorkflowExecutor (+1 more)

### Community 4 - "package.json"
Cohesion: 0.04
Nodes (45): eslintConfig, dependencies, @base-ui/react, class-variance-authority, cn, lucide-react, next, react (+37 more)

### Community 5 - "use-workflow-store.ts"
Cohesion: 0.06
Nodes (51): 1. Executive Summary & Deliverable Status, 2. Inventory of Additions & Readiness, 3. Contract Agreements & Handoffs, 4. Verification & Quality Summary, A. With Member 2 (Planning & Orchestration), B. With Member 3 (Research, Extraction & Quality), C. With Member 4 (Platform, Persistence & Payments), Member 1 Implementation & Handoff Report: Product Experience & Dataset UI (+43 more)

### Community 6 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 7 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 8 - "Architecture"
Cohesion: 0.22
Nodes (9): Architecture, Architecture decisions, Authorization and safety, Components and boundaries, Credits, budgets, and x402, Data and provenance, Decisions to settle before implementation, Demo x402 workflow reference (+1 more)

### Community 9 - "layout.tsx"
Cohesion: 0.20
Nodes (7): nextConfig, next, src_app_globals, geistMono, geistSans, inter, metadata

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

## Knowledge Gaps
- **171 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+166 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 202 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Workflow` connect `2. Inventory of Additions & Readiness (Production vs. Placeholder)` to `KyrosError`, `dataset-view.tsx`, `WorkflowExecutor`, `use-workflow-store.ts`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **Why does `2. Inventory of Additions & Readiness (Production vs. Placeholder)` connect `2. Inventory of Additions & Readiness (Production vs. Placeholder)` to `KyrosError`, `WorkflowExecutor`?**
  _High betweenness centrality (0.111) - this node is a cross-community bridge._
- **Why does `zod` connect `use-workflow-store.ts` to `KyrosError`, `package.json`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Are the 37 inferred relationships involving `2. Inventory of Additions & Readiness (Production vs. Placeholder)` (e.g. with `GeminiGateway` and `IGeminiCaller`) actually correct?**
  _`2. Inventory of Additions & Readiness (Production vs. Placeholder)` has 37 INFERRED edges - model-reasoned connections that need verification._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _171 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `KyrosError` be split into smaller, more focused modules?**
  _Cohesion score 0.056140350877192984 - nodes in this community are weakly interconnected._
- **Should `dataset-view.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08418079096045197 - nodes in this community are weakly interconnected._