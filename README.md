# Kyros

Kyros is an AI-powered multi-agent data intelligence platform. A user describes the business information they need; Kyros plans and runs a collection workflow, checks the results, and delivers a structured dataset whose values can be traced to sources. The core abstraction is **natural-language intent compiled into a managed, executable, auditable data-collection workflow**.

**Product loop:** Ask → Plan → Execute → Acquire → Extract → Validate → Deduplicate → Verify → Explore → Export.

Planned capabilities include open-web discovery, complex browser research, paid premium-data acquisition within a user-set budget, parallel work with dependencies, progress and retry handling, evidence inspection, dataset history, filtering, CSV export, and re-runs. The intended acquisition split is: **Exa finds it. Webcmd navigates it. x402 buys it.**

## Current status

This repository is a starter, not an operational Kyros deployment. It currently contains a Next.js 16.3.6 App Router page, React 19, strict TypeScript, Tailwind CSS 4, shadcn/Base UI configuration, one button component, and design tokens. The home page and metadata still show Create Next App content. There is no planner, API, authentication, database schema, payment integration, environment example, or test infrastructure yet. The architecture documents describe intended implementation; they do not imply those features are installed.

## Intended architecture

Gemini will plan a validated task graph. A custom executor will persist task state in Supabase PostgreSQL and run independent work concurrently. Exa, Webcmd, and x402 acquisition adapters will supply content to Gemini extraction and deterministic validation/deduplication. Clerk will identify users; Stripe-funded internal credits will govern platform-owned x402 spending through viem on Base Sepolia. The Next.js app will show the plan, live progress, datasets, evidence, and budgets. See [Architecture](docs/ARCHITECTURE.md) and [Workflows](docs/WORKFLOWS.md).

## Local setup

Use Node.js and npm compatible with the checked-in lockfile. No exact Node version is declared in the repository.

```bash
npm ci
npm run dev
```

Open <http://localhost:3000>. The available checks are `npm run lint` and `npm run build`; `npm run start` serves a production build. There are currently no format, typecheck, test, or database migration scripts.

No environment file or variable names are defined yet. Future integration setup will need server-side credentials/configuration for Gemini, Exa, Webcmd if required, Supabase, Clerk, Stripe, x402 facilitator/RPC, and the platform treasury. Public Clerk configuration must be separated from server-only secrets. Agree on exact variable names and validation before adding an environment example; never commit real secrets (`.env*` is ignored).

## Guides

| Need | Document |
| --- | --- |
| Coding-agent entry point and routing | [AGENTS.md](AGENTS.md) |
| System, data, acquisition, and payment design | [Architecture](docs/ARCHITECTURE.md) |
| Agent roles and workflow execution | [Workflows](docs/WORKFLOWS.md) |
| Product UI and frontend conventions | [Frontend](docs/FRONTEND.md) |
| Four-person ownership and milestones | [Team](docs/TEAM.md) |
| Contracts, security, testing, and development practice | [Engineering](docs/ENGINEERING.md) |
