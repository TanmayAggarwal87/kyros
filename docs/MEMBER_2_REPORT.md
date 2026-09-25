# Member 2 Implementation & Handoff Report: Planning & Orchestration

> **Document Status:** Active Handoff Reference  
> **Author:** Developer / Member 2 (Planning & Orchestration)  
> **Audience:** Member 1 (UI), Member 3 (Acquisition & Extraction), Member 4 (Platform & Persistence)  
> **Date:** September 2026

---

## 1. Executive Summary & Repository Status

Member 2 is responsible for:
1. Gemini gateway & model routing
2. Planner & schema validation
3. Task graph / DAG compilation & cycle detection
4. Dependency resolution & independent task concurrency
5. Workflow & task executor loop
6. Concurrency control & state machine lifecycle
7. Domain & infrastructure retry engines
8. Shared contracts required across team boundaries

This deliverable provides the complete core orchestration vertical slice. All modules are implemented in strict TypeScript with comprehensive test coverage (20/20 tests passing).

---

## 2. Inventory of Additions & Readiness (Production vs. Placeholder)

| Component / File Path | What Was Added | Why It Was Added | Readiness Status | Notes & Integration Guidance |
| :--- | :--- | :--- | :--- | :--- |
| `src/core/contracts/errors.ts`<br>`src/core/errors/kyros-error.ts` | Normalized `KyrosError` class & `NormalizedErrorPayload` interface | Unifies error handling across UI, AI, providers, and persistence without leaking secrets or credentials. | **Production-Ready** | Standard taxonomy covering 10 categories. Exposes `safeMessage` to users while keeping diagnostic data internal. |
| `src/core/contracts/task.ts` | `Task`, `TaskType`, `TaskState`, `DependencyCompletionPolicy`, `TaskArtifactReference` | Formalizes task execution units and enables passing artifacts by durable reference rather than bloating prompt context. | **Production-Ready** | Used by Member 3 for handlers and Member 4 for database tables/entities. |
| `src/core/contracts/workflow.ts` | `Workflow`, `WorkflowState`, `BudgetPolicy`, `WorkflowSummary` | Formal domain types for workflow lifecycle and deterministic financial constraints. | **Production-Ready** | Direct interface for Member 1 (UI) and Member 4 (Credit & budget governor). |
| `src/core/contracts/planner.ts` | `PlannerInput`, `PlannerPlan`, `PlanTask`, `DatasetFieldSchema`, `IPlanner` | Contract for prompt compilation into task graphs and dataset schemas. | **Production-Ready** | Prevents arbitrary code execution; validates inputs and outputs. |
| `src/core/contracts/events.ts` | `WorkflowProgressSnapshot`, `WorkflowEvent`, `IWorkflowEventObserver` | Progress tracking and event stream for client-side observability. | **Production-Ready** | Ready for Member 1 to connect to Server-Sent Events (SSE) or polling route handlers. |
| `src/core/state/state-machine.ts` | `WorkflowStateMachine`, `TaskStateMachine` | Strictly guards lifecycle state transitions; blocks illegal transitions with explicit errors. | **Production-Ready** | Shared transition rules preventing UI or backend state divergence. |
| `src/core/dag/cycle-detector.ts` | 3-color DFS cycle detector & topological sorter | Detects cycles, self-dependencies, duplicate task IDs, and dangling dependencies before execution starts. | **Production-Ready** | Pure deterministic validator. |
| `src/core/dag/task-graph.ts` | `TaskGraph` model & plan compiler | Builds immutable task graph from validated plan; provides dependency/dependent lookups. | **Production-Ready** | Instantiates runnable root tasks and pending dependent tasks. |
| `src/core/dag/dependency-resolver.ts` | Dependency completion policy resolver | Evaluates when pending tasks become runnable or skipped (`all_succeeded` vs `allow_partial`). | **Production-Ready** | Unlocks independent parallel paths while safely skipping failed branches. |
| `src/core/ai/retry-policy.ts` | `GeminiRetryPolicy` & `Sleeper` abstraction | Implements documented infrastructure retry rule: max 3 calls, 30s delay before attempt 2, 90s delay before attempt 3, and user-safe busy message. | **Production-Ready** | Configurable sleeper enables instant test execution while preserving production delays. |
| `src/core/ai/gateway.ts` | `GeminiGateway`, `IGeminiGateway`, model router | Central gateway routing AI roles (`planner` -> `gemini-2.5-pro`, `extractor`/`refiner` -> `gemini-2.5-flash`), markdown stripping, and Zod validation. | **Production-Ready Core / Adapter Pending** | Gateway logic and validation are production-ready. Accepts pluggable `IGeminiCaller`. Member 3/4 can supply live Google Gen AI SDK caller. |
| `src/core/planner/schema.ts`<br>`src/core/planner/planner.ts` | Zod validation schemas & `Planner` engine | Validates planner input and output schemas, checks budget ceilings, and verifies supported capabilities. | **Production-Ready** | Never generates executable scraper code; only validated task graph structures. |
| `src/core/persistence/repository.ts` | `IWorkflowRepository`, `ITaskClaimer` interfaces | Repository boundaries for workflow loading, state persistence, and atomic task leasing. | **Production-Ready Interface** | Member 4 will implement these interfaces over Supabase PostgreSQL. |
| `src/core/persistence/in-memory-repository.ts` | In-memory implementation of repo & task claimer | Fast, atomic in-memory persistence and lease tracker. | **Testing / Dev Adapter** | Intended for unit/integration tests and local vertical slices before Supabase is connected. |
| `src/core/retry/domain-retry.ts` | `DomainRetryPolicy` | Evaluates domain failures (e.g. zero results) and triggers query refinement, capped at 3 attempts. | **Production-Ready** | Decoupled from infrastructure network/rate-limit retries. |
| `src/core/executor/handler.ts` | `ITaskHandler`, `TaskHandlerRegistry`, `TaskExecutionContext`, `TaskExecutionResult` | Provider-agnostic task dispatch interface. | **Production-Ready** | Member 3 plugs in Exa, Webcmd, and Gemini extraction handlers without touching orchestration code. |
| `src/core/executor/concurrency.ts` | `ConcurrencyLimiter` | Bounded concurrency limiter (semaphore) preventing runaway parallel execution. | **Production-Ready** | Configurable concurrency ceiling (default: 4). |
| `src/core/executor/workflow-executor.ts` | `WorkflowExecutor` engine | Complete execution loop: claim tasks, execute concurrently, persist results, handle cancellation/pause/resume, and recover stranded crashed tasks. | **Production-Ready Core** | Runs against any implementation of `IWorkflowRepository` and `ITaskClaimer`. |
| `src/core/__tests__/*.test.ts` | 5 test suites (20 tests) covering all 18 mandated edge cases | Protects risky logic (cycles, retries, concurrency, cancellation, state transitions). | **Production-Ready** | Built using native `node:test` executed via `tsx`. |

---

## 3. Scope Verification: Changes Outside Member 2 Ownership

**Zero application or feature code was written outside Member 2's scope:**
- ❌ **No UI / Frontend components modified:** Left untouched for Member 1 (`src/app/`, `src/components/`).
- ❌ **No Exa or Webcmd adapters written:** Left untouched for Member 3.
- ❌ **No Gemini extraction prompts or data deduplication pipelines written:** Left untouched for Member 3.
- ❌ **No Supabase database migrations or schemas written:** Left untouched for Member 4.
- ❌ **No Clerk authentication, Stripe, x402, or viem treasury code written:** Left untouched for Member 4.

### Necessary Shared Configuration Changes:
The only file modified outside `src/core/` was `package.json` (and `package-lock.json`):
1. **Added `zod` (`^4.6.5`):** Explicitly planned in `docs/ENGINEERING.md` ("*Use Zod or another agreed runtime validator... Zod is planned, not installed*"). Required for planner and task runtime validation.
2. **Added `tsx` (`^4.23.15` as devDependency):** Required for executing TypeScript unit tests with path alias (`@/*`) support.
3. **Added scripts:** `"typecheck": "tsc --noEmit"` and `"test": "tsx --test src/**/*.test.ts"`.

---

## 4. Handoff & Contract Payloads (Per TEAM.md line 37)

### A. Member 1 (Product Experience & Dataset UI) Integration

Member 1 consumes `WorkflowProgressSnapshot` and `WorkflowEvent`.

#### Representative Progress Payload (`WorkflowProgressSnapshot`):
```json
{
  "workflowId": "wf-c2e8a1",
  "runId": "run-98a72b",
  "status": "running",
  "progressPercent": 66,
  "totalTasks": 3,
  "completedTasks": 2,
  "failedTasks": 0,
  "updatedAt": "2026-09-25T14:10:00.000Z",
  "tasks": [
    {
      "id": "discover_startups",
      "name": "Discover AI Startups",
      "type": "discovery",
      "status": "succeeded",
      "attemptCounts": { "domain": 1, "infrastructure": 1 },
      "startedAt": "2026-09-25T14:09:10.000Z",
      "finishedAt": "2026-09-25T14:09:25.000Z"
    },
    {
      "id": "extract_funding",
      "name": "Extract Startup Funding",
      "type": "extraction",
      "status": "running",
      "attemptCounts": { "domain": 0, "infrastructure": 1 },
      "startedAt": "2026-09-25T14:09:26.000Z"
    },
    {
      "id": "deduplicate_records",
      "name": "Deduplicate Dataset",
      "type": "deduplication",
      "status": "pending",
      "attemptCounts": { "domain": 0, "infrastructure": 0 }
    }
  ]
}
```

#### Representative Error / Partial Failure Payload:
```json
{
  "workflowId": "wf-c2e8a1",
  "runId": "run-98a72b",
  "status": "partially_completed",
  "progressPercent": 100,
  "totalTasks": 3,
  "completedTasks": 3,
  "failedTasks": 1,
  "failureInfo": {
    "category": "provider/rate-limit",
    "code": "GEMINI_SERVER_BUSY",
    "message": "Gemini server is busy. Please try again later.",
    "retryable": false,
    "scope": "task",
    "timestamp": "2026-09-25T14:11:00.000Z"
  }
}
```

---

### B. Member 3 (Research, Extraction & Quality) Integration

Member 3 implements `ITaskHandler` and registers them with `TaskHandlerRegistry`.

#### Handler Contract:
```typescript
import { ITaskHandler, TaskExecutionContext, TaskExecutionResult } from '@/core/executor/handler';

export class ExaDiscoveryHandler implements ITaskHandler {
  readonly taskType = 'discovery';

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    // 1. context.task.input contains validated inputs
    // 2. context.signal allows handling workflow cancellation
    // 3. context.upstreamArtifacts contains durable output references from parent tasks
    return {
      status: 'succeeded',
      outputArtifacts: [
        {
          id: 'art-src-1',
          type: 'source',
          uri: 'https://storage.kyros.ai/raw/exa-results-1.json',
          mimeType: 'application/json'
        }
      ]
    };
  }
}
```

To request a domain query refinement:
```typescript
return {
  status: 'retry_domain',
  refinedInput: { query: 'refined query with broader keywords' }
};
```

---

### C. Member 4 (Platform, Persistence & Payments) Integration

Member 4 implements `IWorkflowRepository` and `ITaskClaimer` over Supabase PostgreSQL.

#### Contract Interfaces (`src/core/persistence/repository.ts`):
```typescript
export interface ITaskClaimer {
  claimRunnableTasks(
    workflowId: string,
    workerId: string,
    limit: number,
    leaseDurationMs: number
  ): Promise<readonly Task[]>;

  releaseClaim(taskId: string, workerId: string): Promise<void>;
  renewLease(taskId: string, workerId: string, extendByMs: number): Promise<void>;
}
```

Recommended Supabase SQL Pattern for Member 4:
```sql
-- Atomically claim runnable tasks with lease duration
UPDATE kyros_tasks
SET 
  status = 'running',
  claimed_by_worker_id = $workerId,
  claimed_until_ms = $claimedUntilMs,
  updated_at = NOW()
WHERE id IN (
  SELECT id FROM kyros_tasks
  WHERE workflow_id = $workflowId 
    AND status = 'runnable'
  ORDER BY created_at ASC
  LIMIT $limit
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

---

## 5. Architectural Decisions Documented

1. **Atomic Leases with Deterministic Recovery:** Rather than assuming persistent webhooks, tasks are leased with a timeout (`leaseDurationMs`). In the event of a worker crash or serverless instance shutdown, `recoverStrandedTasks()` automatically resets orphaned running tasks to `runnable`.
2. **Sleeper Clock Abstraction:** Gemini infrastructure retries enforce 30s and 90s delays. Injecting a `Sleeper` interface allows unit and integration tests to verify retry schedules and backoffs in milliseconds without artificial test delays.
3. **Zod Runtime Validation Boundary:** Strictly validates planner outputs and rejects invalid task types or malformed schemas before any execution begins.

---

## 6. Verification & Health Summary

All checks run and verified:
- **`npm test`**: 20/20 tests passed across DAG, state machine, planner, retries, and executor.
- **`npm run typecheck`**: Exited with code 0 (zero TypeScript errors under strict mode).
- **`npm run lint`**: Exited with code 0 (zero ESLint errors or warnings).
- **`npm run build`**: Exited with code 0 (Turbopack production build compiled successfully).
