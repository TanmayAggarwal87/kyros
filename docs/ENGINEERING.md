# Engineering guide

**Status:** standards for future implementation, with current tooling called out explicitly. Consult [Architecture](ARCHITECTURE.md) for system decisions and [Workflows](WORKFLOWS.md) for task semantics.

## Type safety and boundary validation

The repository already has `strict: true` in `tsconfig.json`. Keep explicit domain types, use `unknown` for genuinely uncertain input, narrow with runtime validation, and avoid `any` and assertions that merely silence errors. Prefer discriminated unions for statuses/results where they prevent invalid combinations. Compile-time types cannot validate AI, network, database, or user input.

Use Zod or another agreed runtime validator at user/API, Gemini structured-output, provider-response, config, and persistence boundaries. Zod is installed. Validate planner output before any task executes, normalize provider data into internal contracts, and preserve one shared schema/type for frontend and backend. Generated dataset fields require schema-aware validation; missing information must remain explicit. Environment parsing should fail early for required server configuration and never leak a secret to a client bundle.

## API and contract conventions

Define a stable domain contract for workflow creation, plan review/start, task progress, dataset records/evidence, budgets, and errors before building consumers. Validate requests and responses at boundaries; return only fields the caller is authorized to see. Keep provider-specific formats inside adapters and Gemini calls inside a central gateway. Coordinate contract changes with all consumers in one PR, including the relevant documentation. Decide versioning and progress transport in Phase 0; no current API endpoints exist.

## Security

- Keep Gemini/Exa/Stripe keys, Supabase service-role credentials, treasury private key, x402 signing credentials, and RPC secrets server-only. Use `NEXT_PUBLIC_` only for deliberately public values; never log secrets or raw credential-bearing headers.
- Resolve Clerk identity on the server and authorize every user-owned workflow, task, dataset, evidence item, export, credit account, and payment record. Never trust a client-supplied user ID. Service-role database access does not replace ownership checks.
- Treat external pages as untrusted data. Isolate their text from system instructions, restrict tool/capability calls, and reject prompt-injected requests to change scope, expose secrets, or alter payment policy. Render snippets safely.
- Validate external URLs and redirects; block local/private networks, metadata endpoints, unsupported schemes, and credential-bearing URLs. Scope authenticated browser access explicitly.
- Use atomic database reservations/debits and idempotency keys for concurrent spend. Apply user credits, workflow budget, per-call ceilings, and treasury guards in deterministic code. Verify Stripe webhooks and real x402 settlement/receipts; fail payment tasks loudly if verification fails.
- Keep structured logs useful for debugging while redacting credentials, sensitive content, and payment signing material.

## Error handling and reliability

Use one normalized error shape with category/code, safe user message, internal diagnostic context, retryability, and scope (`task` or `workflow`). At minimum distinguish: input, planning, acquisition, extraction, validation, provider/rate limit, payment, budget, persistence, and unexpected internal errors. Keep a causal trace internally without exposing secrets or raw provider failures to users.

Persist failures and attempt counts. For each Gemini API operation, allow at most **three calls total, including the initial call**. For transient 429/503 and similar temporary service failures, wait **30 seconds** before the second call and **90 seconds** before the third. If all three calls fail, mark the affected task failed and show **“Gemini server is busy. Please try again later.”** Domain retries may replan a query and have a separate counter; neither policy may create an unbounded loop. Decide workflow impact by dependencies and whether useful partial records remain. Never swallow errors, loop indefinitely, or create plausible fake balances, hashes, sources, records, or evidence. A truthful partial dataset is valid when state and provenance clearly show its limits.

## Testing and evaluation

No test runner or test script currently exists. When implementation begins, choose minimal tooling and protect the risky behavior first:

| Layer | Critical cases |
| --- | --- |
| Pure/unit | DAG dependency resolution, state transitions, retry limits, normalization, validation, dedupe, provenance retention |
| Boundary/integration | Malformed Gemini output, Exa/Webcmd adapter normalization, API contract/authorization, persistence recovery |
| Finance/concurrency | Atomic reservations, simultaneous paid tasks, insufficient credits, Stripe idempotency, x402 success/failure and receipt validation |
| Product flow | Prompt/plan/start, live progress, partial failure, dataset evidence, export and re-run |

Maintain a fixed evaluation set: internship discovery, recently funded startups, hackathon sponsors, company/market research, and a sparse/no-result request. Check that distinct requirements produce distinct plans, appropriate fields, and useful sourced outputs. Mock external services in automated tests where useful, then verify genuine x402 settlement separately; a mock is not proof of a real payment.

## Code quality

Keep modules focused: orchestration, provider adapters, AI gateway, repositories, quality transforms, and UI have separate responsibilities. Prefer pure transforms, explicit transitions, idempotent operations, clear domain names, structured logging, centralized config, and bounded concurrency. Use dependency injection at provider boundaries when it makes tests and replacement simpler. Avoid giant services, duplicated contracts, scattered `process.env`, magic sleeps, catch-all swallowing, direct SDK calls throughout the app, and premature abstractions without consumers. Add dependencies only for concrete features and review their maintenance/security cost.

## Repository workflow and actual commands

| Purpose | Current command/state |
| --- | --- |
| Install from lockfile | `npm ci` |
| Develop | `npm run dev` |
| Lint | `npm run lint` (ESLint) |
| Build | `npm run build` |
| Serve build | `npm run start` |
| Format | No script/config found |
| Typecheck | `npm run typecheck` |
| Tests | `npm test` (Node test runner through tsx) |
| Migrations | SQL file exists in `supabase/migrations`; no runner is configured |
| Environment | `.env.example` lists planned integration variables; `.env*` is ignored |

The repository uses npm (`package-lock.json`), `src/app`, `src/components/ui`, `@/*` alias, Tailwind 4 tokens in `src/app/globals.css`, and shadcn/Base UI configuration. `CLAUDE.md` points to root `AGENTS.md`. Before editing Next.js code, read the relevant installed guide in `node_modules/next/dist/docs/`; the root `AGENTS.md` contains the generated rule that requires this.

For the four-person team, use short feature branches and small reviewed PRs; request review from the owner of any affected boundary. Include migration and rollback notes when schema changes arrive; never edit production data by hand as a substitute for migrations. Keep dependencies and documentation in the same PR as the feature that needs them. A change is done when its behavior and contracts agree, relevant checks/tests have run, secrets and ownership boundaries are intact, and the PR/report states changed files, checks, and unresolved issues.

## Environment Configuration and Integration Wiring

A clean, uncommented `.env.example` template is provided in the repository root. The variables describe intended integrations; see [Member 4 platform audit](MEMBER_4_REPORT.md) for current readiness.

- **Identity (Clerk):** `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. Protected API identity comes from Clerk `auth()` behind `src/proxy.ts`. Without both keys, the preview page remains available and protected APIs reject requests.
- **Persistence (Supabase):** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. SQL schema and stored procedures live in `supabase/migrations/20260925_init_schema.sql`.
- **Finance (Stripe):** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`), and the SQL migrations are required for Checkout and webhook crediting. Deposits are atomic and keyed by Stripe payment reference. No live Stripe payment has been verified yet.
- **Autonomous Settlement (x402 & Treasury):** `X402_FACILITATOR_URL` and `X402_PAYEE_ADDRESS` configure the official x402 demo resource for Base Sepolia USDC. The platform treasury payer is still disabled until task payment intents, budget reconciliation, and real receipt verification are implemented.
- **AI & Research:** `GEMINI_API_KEY`, `EXA_API_KEY`. Centralized through `GeminiGateway` and `ExaDiscoveryHandler`.
