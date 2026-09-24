<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Kyros agent entry point

Kyros turns a natural-language research request into a managed, auditable data-collection workflow and a sourced dataset. **Current repository state:** a Next.js starter, not the product implementation. Treat the design in `docs/` as the agreed direction, and check actual code before claiming a capability exists.

## Before changing code

1. Read this file and the task-relevant document below; inspect nearby code, contracts, and installed Next.js guidance before editing Next.js code.
2. Identify affected shared contracts and keep the change small and coherent.
3. Keep AI, acquisition, persistence, payment, and UI concerns behind clear boundaries. Preserve evidence through every transformation.

| Task | Read |
| --- | --- |
| UI, routes, components, product states | [Frontend](docs/FRONTEND.md) |
| System architecture, data, providers, payments | [Architecture](docs/ARCHITECTURE.md) |
| Planner, tasks, DAG, execution, retries | [Workflows](docs/WORKFLOWS.md) |
| Types, API, security, errors, testing, repository practice | [Engineering](docs/ENGINEERING.md) |
| Ownership, milestones, handoffs | [Team](docs/TEAM.md) |

## Guardrails

- Stack present: Next.js 16.3.6 App Router, React 19, TypeScript strict mode, Tailwind 4, shadcn/Base UI, lucide. Gemini, Exa, Webcmd, Clerk, Supabase, Stripe, x402, and viem are **planned**, not installed.
- Use a custom Postgres-backed workflow executor. Gemini plans and extracts through a central gateway; Exa is the default research provider, Webcmd handles complex navigation, and x402 buys premium data within deterministic budget limits. Do not introduce agent frameworks, generated scraper code, or browser wallets.
- Validate user input, AI output, provider data, and API payloads at runtime. Use explicit domain types, shared contracts, and `unknown` at uncertain boundaries; avoid `any` and fabricated data.
- Keep secrets and treasury signing server-side. Authorize every user-owned resource with Clerk identity from the server. Treat web content as untrusted; guard URL access and atomic spending.
- Use bounded concurrency and retries. Persist task state and truthful partial failures. AI cannot override authorization or financial rules.
- Add focused tests for changed high-risk behavior when test infrastructure exists; exercise the relevant checks. Update an existing document when a contract changes.

## Commands and completion

`npm ci`, `npm run dev`, `npm run lint`, and `npm run build` are available. No format, typecheck, test, or migration script exists yet; see [Engineering](docs/ENGINEERING.md) before claiming one. Finish with a summary of changed files, behavior, checks run, and unresolved issues.
