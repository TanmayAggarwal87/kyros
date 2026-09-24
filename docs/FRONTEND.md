# Frontend

**Status:** product design. The current UI is the default Next.js page; only `src/components/ui/button.tsx` and theme tokens exist. Use [Engineering](ENGINEERING.md) for shared contracts and server security.

## Product path and information architecture

**Ask → review plan → start → watch research → explore dataset → inspect evidence → export or re-run.** Keep primary navigation around New research, active/previous research, datasets, and credits/settings. A user should see research progress and cost without needing to understand the DAG, model names, providers, wallets, or Base Sepolia.

| View | Essential behavior |
| --- | --- |
| New research | Natural-language prompt, useful examples, constraints/desired fields, clear submit and validation feedback |
| Plan review | Plain-language stages, output columns, likely sources/cost, editable constraints, approve/start action |
| Research run | Progress, completed/running tasks, sources processed, records found, retries/failures, spent/remaining budget; pause/cancel/resume only when backend supports them |
| Dataset | Typed table, search/filter, visible missing/support states, source links, CSV export |
| Evidence inspector | Selected value, source URL/identity, snippet, collected time, acquisition and support status; paid cost in an advanced view if useful |
| History | Prior runs/datasets, status, dates, cost, view and re-run actions |
| Credits | Available research credits, workflow allowance, spending history/top-up; no normal wallet or chain UI |

Make partial results explicit and useful. Empty, loading, failed, cancelled, and budget-exhausted states need separate copy and actions. Keep technical trace details behind a deliberate advanced/audit disclosure.

## Component and data boundaries

Use the existing `src/app` App Router structure and `src/components/ui` shadcn/Base UI primitives. Build reusable product components for prompt form, plan summary, status/progress, dataset table, evidence panel, and budget summary as those features arrive. Keep source-specific data fetching and business rules out of generic visual primitives. Use `src/app/globals.css` theme variables and Tailwind utilities for consistent spacing, color, typography, and focus treatment; avoid repeated arbitrary color values.

Next.js 16.3.6 local documentation in `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` says layouts and pages are Server Components by default. Fetch authenticated initial data on the server and place client boundaries around interaction, browser APIs, local state, live progress, and table controls. Route handlers are available via `route.ts`; choose transport for live progress with the backend team before implementing it. Read the relevant installed Next.js guide before changing routes, caching, forms, or server/client boundaries because this version may differ from remembered APIs.

Use validated shared request/response and event schemas; do not invent UI-only versions of task status, record, provenance, budget, or error types. Render fields from the generated dataset schema and treat unknown values safely. The server is the authority for user identity, data access, financial decisions, and export permission. Client state may hold view controls and pending interactions, not canonical workflow state.

## Design and accessibility

Aim for a restrained, modern research workspace: clear hierarchy, readable dense tables, concise status language, and progressive disclosure. Use lucide icons with labels when meaning is otherwise ambiguous. Support keyboard navigation, visible focus, semantic tables/headings, associated form labels, contrast, and screen-reader status updates for live progress. Provide responsive layouts: table overflow/column controls on small screens, evidence in a drawer or stacked panel, and accessible alternatives to color-only statuses. Avoid raw JSON as the primary experience.

## Integration sequence

1. Agree with the workflow/platform owners on typed contracts for create, plan, start, progress, dataset, evidence, errors, and budget.
2. Build one prompt-to-dataset slice against the real endpoints as they arrive; use contract-shaped temporary fixtures only behind the data boundary.
3. Add task management, history, filtering, export, and advanced trace views as the corresponding backend states become real.

The current Create Next App home page, metadata, and template assets conflict with the intended Kyros experience; replace them during application implementation, not in this documentation bootstrap.
