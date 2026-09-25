-- ============================================================================
-- Kyros PostgreSQL Schema: Persistence, Workflows, Datasets, and Credits
-- Matches architecture and contracts defined in docs/ARCHITECTURE.md & docs/TEAM.md
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Kyros Workflows
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kyros_workflows (
  id VARCHAR(64) PRIMARY KEY,
  run_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  prompt TEXT NOT NULL,
  field_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'planning',
  budget_limit_usd NUMERIC(10, 4) NOT NULL DEFAULT 0.0500,
  max_per_task_cost_usd NUMERIC(10, 4) NOT NULL DEFAULT 0.0200,
  allow_paid_sources BOOLEAN NOT NULL DEFAULT TRUE,
  summary TEXT,
  failure_info JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyros_workflows_user ON kyros_workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_kyros_workflows_status ON kyros_workflows(status);
CREATE INDEX IF NOT EXISTS idx_kyros_workflows_run ON kyros_workflows(run_id);

-- ----------------------------------------------------------------------------
-- 2. Kyros Tasks & Execution Leases
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kyros_tasks (
  id VARCHAR(64) NOT NULL,
  workflow_id VARCHAR(64) NOT NULL REFERENCES kyros_workflows(id) ON DELETE CASCADE,
  run_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  dependency_policy VARCHAR(32) NOT NULL DEFAULT 'all_succeeded',
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_artifacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  attempt_counts JSONB NOT NULL DEFAULT '{"domain": 0, "infrastructure": 0}'::jsonb,
  failure_info JSONB,
  claimed_by_worker_id VARCHAR(64),
  claimed_until_ms BIGINT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workflow_id, id)
);

CREATE INDEX IF NOT EXISTS idx_kyros_tasks_claim ON kyros_tasks(workflow_id, status, claimed_until_ms);
CREATE INDEX IF NOT EXISTS idx_kyros_tasks_run ON kyros_tasks(run_id);

-- ----------------------------------------------------------------------------
-- 3. Stored Procedure: Atomic Task Claiming with SKIP LOCKED
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION claim_runnable_tasks(
  p_workflow_id VARCHAR(64),
  p_worker_id VARCHAR(64),
  p_limit INT,
  p_lease_duration_ms BIGINT
)
RETURNS SETOF kyros_tasks AS $$
DECLARE
  v_now_ms BIGINT := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
  v_expires_ms BIGINT := v_now_ms + p_lease_duration_ms;
BEGIN
  RETURN QUERY
  UPDATE kyros_tasks
  SET 
    status = 'running',
    claimed_by_worker_id = p_worker_id,
    claimed_until_ms = v_expires_ms,
    started_at = COALESCE(started_at, NOW()),
    updated_at = NOW()
  WHERE (workflow_id, id) IN (
    SELECT workflow_id, id 
    FROM kyros_tasks
    WHERE workflow_id = p_workflow_id 
      AND status = 'runnable'
      AND (claimed_until_ms IS NULL OR claimed_until_ms < v_now_ms)
    ORDER BY created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 4. Kyros Dataset Records & Verifiable Provenance
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kyros_dataset_records (
  id VARCHAR(64) PRIMARY KEY,
  workflow_id VARCHAR(64) NOT NULL REFERENCES kyros_workflows(id) ON DELETE CASCADE,
  run_id VARCHAR(64) NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyros_records_wf ON kyros_dataset_records(workflow_id);
CREATE INDEX IF NOT EXISTS idx_kyros_records_run ON kyros_dataset_records(run_id);

-- ----------------------------------------------------------------------------
-- 5. User Credit Accounts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kyros_credit_accounts (
  user_id VARCHAR(64) PRIMARY KEY,
  balance_usd NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
  reserved_usd NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
  available_usd NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
  currency VARCHAR(8) NOT NULL DEFAULT 'USD',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_balances CHECK (balance_usd >= 0 AND reserved_usd >= 0 AND available_usd >= 0)
);

-- ----------------------------------------------------------------------------
-- 6. Credit Ledger (Double-Entry Audit)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kyros_credit_ledger (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES kyros_credit_accounts(user_id) ON DELETE CASCADE,
  workflow_id VARCHAR(64),
  run_id VARCHAR(64),
  type VARCHAR(32) NOT NULL,
  amount_usd NUMERIC(10, 4) NOT NULL,
  description TEXT NOT NULL,
  receipt_ref VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyros_ledger_user ON kyros_credit_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kyros_ledger_wf ON kyros_credit_ledger(workflow_id);

-- ----------------------------------------------------------------------------
-- 7. Payment Receipts (x402 Base Sepolia & Stripe)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kyros_payment_receipts (
  id VARCHAR(64) PRIMARY KEY,
  workflow_id VARCHAR(64),
  task_id VARCHAR(64),
  hash VARCHAR(128),
  network VARCHAR(64) NOT NULL DEFAULT 'base-sepolia (84532)',
  status VARCHAR(32) NOT NULL DEFAULT 'confirmed',
  resource_uri TEXT,
  amount_usd NUMERIC(10, 4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyros_receipts_hash ON kyros_payment_receipts(hash);
CREATE INDEX IF NOT EXISTS idx_kyros_receipts_task ON kyros_payment_receipts(task_id);

-- ----------------------------------------------------------------------------
-- 8. Row-Level Security (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE kyros_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyros_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyros_dataset_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyros_credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyros_credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyros_payment_receipts ENABLE ROW LEVEL SECURITY;

-- Note: In addition to Supabase RLS, all server operations enforce
-- application-level authorization in src/core/auth/server-auth.ts.
