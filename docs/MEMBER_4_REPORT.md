# Member 4 platform audit

Status: incomplete integration. The previous report marked several components production ready although the repository did not support those claims.

## Working boundaries

- Clerk UI uses the installed Clerk SDK when `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` are configured. Server routes derive identity from `auth()` behind `src/proxy.ts`. Missing credentials leave the preview page available while protected APIs return 401.
- Workflow persistence now writes the required owner ID and field schema. `SupabaseWorkflowRepository` requires a real database client; it no longer silently discards writes. The SQL migration defines the matching column.
- Credit accounts, Stripe deposits, and workflow reservations use atomic Postgres functions in `supabase/migrations/20260925_credit_atomic.sql`. The server client calls these functions with the Supabase service role. Stripe Checkout checks database readiness before creating a session. A signed, paid Checkout event is credited through the idempotent deposit function.
- The demo premium-data route uses the official `@x402` Next.js, core, and EVM packages. It issues a Base Sepolia USDC payment challenge with the configured HTTPS facilitator and payee address. Its data is explicitly synthetic.

## Disabled pending integration

- `/api/credits` and Stripe Checkout require `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`) and both migrations. The live project now responds to the credit readiness RPC and a read-only ledger query. Direct manual deposits are disabled.
- The demo resource accepts the configured in-house payee address and issues a real 402 challenge. The platform treasury payer still rejects: it needs a durable task-level payment intent, spend reservation, receipt reconciliation, and retry policy before it can safely spend.
- The product UI remains a prototype preview. Workflows, dataset records, and historical receipts are sample data and are labeled as such. The credits panel fetches the authenticated account and ledger; it shows unavailable until that request succeeds.

## Required to complete Member 4

1. Verify Clerk sign-in in a browser with the configured keys. Keep secrets only in `.env.local`; never commit them.
2. Verify a signed-in account can fetch its credits. Configure the Stripe webhook endpoint and test paid events and replay across processes.
3. Fund the treasury with Base Sepolia USDC, then verify one real facilitator settlement and receipt using the configured in-house payee.
4. Implement the platform payer with a durable payment intent, atomic budget reservation, receipt reconciliation, and task/source provenance. The [Coinbase x402 examples](https://github.com/coinbase/cdp-sdk/blob/main/examples/typescript/x402/README.md) show the current protocol flow.
5. Replace the UI simulation with authenticated API data and real workflow execution before removing the preview label.

Automated tests cannot prove live Clerk login, Stripe charging, Postgres transactions, or on-chain settlement without configured services and funded test credentials.

Read-only live checks confirmed that the configured Clerk and Stripe secret keys receive HTTP 200, the Supabase credit readiness RPC responds, and the server key can read the credit ledger. An unauthenticated request with a forged Clerk identity header receives HTTP 401. The demo x402 route returns HTTP 402 with a payment challenge. No payment or signed-in account was created during these checks.
