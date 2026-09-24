# Team and delivery plan

**Status:** proposed ownership for four developers. Ownership means leading an area and reviewing its contracts with consumers; everyone helps integrate and review. The present repository is a starter, so Phase 0 contracts are the first shared deliverable.

## Ownership and handoffs

| Developer | Primary ownership | Key handoff and reviewer |
| --- | --- | --- |
| 1 — Product experience & dataset UI | App shell, prompt/plan, progress and task management, dataset table/search/filter, evidence, history/re-run, CSV UX, Clerk-facing UI, reusable components | Agree response/event/record/budget contracts with 2 and 4; review usability of partial failures |
| 2 — Planning & orchestration | Gemini gateway/model routing, planner/schema/task graph, dependency resolution, executor, concurrency, lifecycle, domain and infrastructure retries, workflow state contracts | Agree task/artifact shape with 3; persistence/claim/budget transaction boundary with 4; progress events with 1 |
| 3 — Research, extraction & quality | Exa adapter, source/content artifacts, Gemini extraction, schema-aware validation/normalization/dedupe, evidence/provenance, Webcmd spike/integration | Agree capability/task contracts with 2; record/evidence storage with 4; dataset shape with 1 |
| 4 — Platform, persistence & payments | Supabase schema/migrations/repositories, Clerk server authorization, credit ledger, atomic budgets, Stripe, x402 demo resource/payer, viem treasury/Base Sepolia, receipts, env validation | Agree workflow persistence with 2; account/budget UI with 1; paid source artifact/provenance with 3 |

All four review shared API contracts, integration behavior, architecture changes, and demo reliability. Keep mocks behind agreed contracts so implementation can replace them without rewriting consumers.

## Contracts to agree in Phase 0

Define and runtime-validate one shared representation for: workflow creation and plan approval; field schema; task types/status/dependencies; task and workflow lifecycle; progress snapshots/events; source/artifact; dataset record with evidence/support; budget and payment status; normalized errors. Decide IDs, timestamps, ownership fields, pagination, and version/change policy at the same time. Developer 2 leads workflow shapes, 3 leads record/evidence shapes, 4 leads persistence/budget shapes, and 1 checks that each is consumable in the UI.

## Milestones and parallel work

| Phase | Shared integration target | Concurrent work |
| --- | --- | --- |
| 0 — Foundation | Contract schemas, error shape, env validation, database foundation, minimal test tooling | 1: UX shell and contract consumer; 2: planner/task schemas; 3: source/record schemas and Exa boundary; 4: auth, migrations, repository and credit model |
| 1 — Thin slice | Prompt → Gemini plan → one workflow → Exa → extraction → validation → persisted dataset → UI | 1: prompt/plan/dataset views; 2: plan and simple executor; 3: Exa/extraction/quality; 4: persistence/auth and API integration |
| 2 — Orchestration | Durable DAG, parallel claims, retries, partial failures, progress | 1: live run/task UI; 2: scheduler and lifecycle; 3: retry feedback/artifact handling; 4: atomic claims and state storage |
| 3 — Acquisition | Webcmd and genuine x402 within budget | 1: budget/evidence UX; 2: paid/browser task integration; 3: Webcmd and source normalization; 4: Stripe, ledger, payer, demo resource and receipts |
| 4 — Completeness | History, re-run, search/filter, CSV, deeper evidence | 1: user flows; 2: re-run semantics; 3: record quality; 4: queries/export authorization |
| 5 — Hardening | Reliable demo and fixed prompt evaluation | All: integration, concurrency/payment failures, accessibility, performance, truthful errors |

The **first implementation milestone** is Phase 1's one complete prompt-to-dataset path. It proves the central user value before advanced acquisition and polish. x402 remains committed for the finished demo even though its integration follows that slice.

## Early blockers and handoff rule

Resolve worker hosting/claim model, exact auth-to-account mapping, database migration tool, Gemini/Exa SDK choices, and shared API transport before coupling modules. Resolve credit units, x402 facilitator/network details, treasury operation, and Stripe event policy before paid tasks. See [Architecture](ARCHITECTURE.md) for open decisions.

For each handoff, provide a shared validated contract, one representative success payload, one error/partial payload, ownership rules, and a brief note on any open choice. A PR changing a shared contract should update its consumers and the relevant existing document in the same change. Keep branches short, review across ownership boundaries, and merge vertical slices only when the end-to-end path remains coherent.
