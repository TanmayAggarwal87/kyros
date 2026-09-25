-- Apply after 20260925_init_schema.sql. All money is stored in USD to four decimals.
CREATE UNIQUE INDEX IF NOT EXISTS kyros_credit_ledger_reference_unique
  ON kyros_credit_ledger (user_id, type, receipt_ref)
  WHERE receipt_ref IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS kyros_external_payment_reference_unique
  ON kyros_credit_ledger (type, receipt_ref)
  WHERE receipt_ref IS NOT NULL AND type IN ('stripe_topup', 'x402_debit');

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kyros_credit_balance_consistent') THEN
    ALTER TABLE kyros_credit_accounts ADD CONSTRAINT kyros_credit_balance_consistent
      CHECK (balance_usd = reserved_usd + available_usd);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS kyros_workflow_reservations (
  user_id VARCHAR(64) NOT NULL REFERENCES kyros_credit_accounts(user_id),
  workflow_id VARCHAR(64) NOT NULL REFERENCES kyros_workflows(id),
  run_id VARCHAR(64) NOT NULL,
  remaining_usd NUMERIC(10,4) NOT NULL CHECK (remaining_usd >= 0),
  initial_usd NUMERIC(10,4) NOT NULL CHECK (initial_usd > 0),
  PRIMARY KEY (user_id, workflow_id, run_id)
);
ALTER TABLE kyros_workflow_reservations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION kyros_ensure_credit_account(p_user_id TEXT)
RETURNS kyros_credit_accounts LANGUAGE plpgsql AS $$
DECLARE v_account kyros_credit_accounts;
BEGIN
  IF p_user_id IS NULL OR length(p_user_id) = 0 THEN RAISE EXCEPTION 'user_id required'; END IF;
  INSERT INTO kyros_credit_accounts (user_id, balance_usd, reserved_usd, available_usd)
  VALUES (p_user_id, 10, 0, 10)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING * INTO v_account;
  IF FOUND THEN
    INSERT INTO kyros_credit_ledger (id, user_id, type, amount_usd, description, receipt_ref)
    VALUES (gen_random_uuid()::text, p_user_id, 'welcome_grant', 10, 'Kyros welcome credit', 'welcome-grant-v1');
  ELSE
    SELECT * INTO v_account FROM kyros_credit_accounts WHERE user_id = p_user_id;
  END IF;
  RETURN v_account;
END;
$$;

CREATE OR REPLACE FUNCTION kyros_deposit_credit(
  p_user_id TEXT, p_amount_usd NUMERIC, p_receipt_ref TEXT, p_description TEXT
) RETURNS kyros_credit_accounts LANGUAGE plpgsql AS $$
DECLARE v_account kyros_credit_accounts;
BEGIN
  IF p_amount_usd IS NULL OR p_amount_usd <= 0 OR p_amount_usd > 500 OR p_amount_usd <> round(p_amount_usd, 2)
     OR p_receipt_ref IS NULL OR length(p_receipt_ref) = 0 THEN RAISE EXCEPTION 'invalid deposit'; END IF;
  PERFORM kyros_ensure_credit_account(p_user_id);
  SELECT * INTO v_account FROM kyros_credit_accounts WHERE user_id = p_user_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM kyros_credit_ledger WHERE user_id = p_user_id AND type = 'stripe_topup' AND receipt_ref = p_receipt_ref) THEN
    RETURN v_account;
  END IF;
  INSERT INTO kyros_credit_ledger (id, user_id, type, amount_usd, description, receipt_ref)
  VALUES (gen_random_uuid()::text, p_user_id, 'stripe_topup', p_amount_usd, p_description, p_receipt_ref);
  UPDATE kyros_credit_accounts SET balance_usd = balance_usd + p_amount_usd,
    available_usd = available_usd + p_amount_usd, updated_at = now()
    WHERE user_id = p_user_id RETURNING * INTO v_account;
  RETURN v_account;
END;
$$;

CREATE OR REPLACE FUNCTION kyros_reserve_credit(
  p_user_id TEXT, p_workflow_id TEXT, p_run_id TEXT, p_amount_usd NUMERIC
) RETURNS kyros_credit_accounts LANGUAGE plpgsql AS $$
DECLARE v_account kyros_credit_accounts; v_prior NUMERIC;
BEGIN
  IF p_amount_usd IS NULL OR p_amount_usd <= 0 OR p_amount_usd <> round(p_amount_usd, 4) THEN RAISE EXCEPTION 'invalid reservation'; END IF;
  PERFORM kyros_ensure_credit_account(p_user_id);
  SELECT * INTO v_account FROM kyros_credit_accounts WHERE user_id = p_user_id FOR UPDATE;
  SELECT initial_usd INTO v_prior FROM kyros_workflow_reservations
    WHERE user_id = p_user_id AND workflow_id = p_workflow_id AND run_id = p_run_id;
  IF FOUND THEN
    IF v_prior <> p_amount_usd THEN RAISE EXCEPTION 'reservation amount conflict'; END IF;
    RETURN v_account;
  END IF;
  IF v_account.available_usd < p_amount_usd THEN RAISE EXCEPTION 'insufficient credits'; END IF;
  INSERT INTO kyros_workflow_reservations (user_id, workflow_id, run_id, remaining_usd, initial_usd)
    VALUES (p_user_id, p_workflow_id, p_run_id, p_amount_usd, p_amount_usd);
  UPDATE kyros_credit_accounts SET reserved_usd = reserved_usd + p_amount_usd,
    available_usd = available_usd - p_amount_usd, updated_at = now()
    WHERE user_id = p_user_id RETURNING * INTO v_account;
  INSERT INTO kyros_credit_ledger (id, user_id, workflow_id, run_id, type, amount_usd, description, receipt_ref)
    VALUES (gen_random_uuid()::text, p_user_id, p_workflow_id, p_run_id, 'workflow_reservation', p_amount_usd,
      'Workflow budget reservation', p_workflow_id || ':' || p_run_id);
  RETURN v_account;
END;
$$;

CREATE OR REPLACE FUNCTION kyros_settle_credit(
  p_user_id TEXT, p_workflow_id TEXT, p_run_id TEXT, p_amount_usd NUMERIC, p_receipt_ref TEXT
) RETURNS kyros_credit_accounts LANGUAGE plpgsql AS $$
DECLARE v_account kyros_credit_accounts; v_remaining NUMERIC;
BEGIN
  IF p_amount_usd IS NULL OR p_amount_usd <= 0 OR p_amount_usd <> round(p_amount_usd, 4)
     OR p_receipt_ref IS NULL OR length(p_receipt_ref) = 0 THEN RAISE EXCEPTION 'invalid settlement'; END IF;
  SELECT * INTO v_account FROM kyros_credit_accounts WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'credit account missing'; END IF;
  IF EXISTS (SELECT 1 FROM kyros_credit_ledger WHERE user_id = p_user_id AND type = 'x402_debit' AND receipt_ref = p_receipt_ref) THEN
    RETURN v_account;
  END IF;
  SELECT remaining_usd INTO v_remaining FROM kyros_workflow_reservations
    WHERE user_id = p_user_id AND workflow_id = p_workflow_id AND run_id = p_run_id FOR UPDATE;
  IF v_remaining IS NULL OR v_remaining < p_amount_usd THEN RAISE EXCEPTION 'insufficient reservation'; END IF;
  UPDATE kyros_workflow_reservations SET remaining_usd = remaining_usd - p_amount_usd
    WHERE user_id = p_user_id AND workflow_id = p_workflow_id AND run_id = p_run_id;
  UPDATE kyros_credit_accounts SET balance_usd = balance_usd - p_amount_usd,
    reserved_usd = reserved_usd - p_amount_usd, updated_at = now()
    WHERE user_id = p_user_id RETURNING * INTO v_account;
  INSERT INTO kyros_credit_ledger (id, user_id, workflow_id, run_id, type, amount_usd, description, receipt_ref)
    VALUES (gen_random_uuid()::text, p_user_id, p_workflow_id, p_run_id, 'x402_debit', p_amount_usd,
      'Verified x402 settlement', p_receipt_ref);
  RETURN v_account;
END;
$$;

CREATE OR REPLACE FUNCTION kyros_release_credit(
  p_user_id TEXT, p_workflow_id TEXT, p_run_id TEXT, p_amount_usd NUMERIC
) RETURNS kyros_credit_accounts LANGUAGE plpgsql AS $$
DECLARE v_account kyros_credit_accounts; v_remaining NUMERIC;
BEGIN
  IF p_amount_usd IS NULL OR p_amount_usd <= 0 OR p_amount_usd <> round(p_amount_usd, 4) THEN RAISE EXCEPTION 'invalid release'; END IF;
  SELECT * INTO v_account FROM kyros_credit_accounts WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'credit account missing'; END IF;
  SELECT remaining_usd INTO v_remaining FROM kyros_workflow_reservations
    WHERE user_id = p_user_id AND workflow_id = p_workflow_id AND run_id = p_run_id FOR UPDATE;
  IF v_remaining IS NULL OR v_remaining < p_amount_usd THEN RAISE EXCEPTION 'insufficient reservation'; END IF;
  UPDATE kyros_workflow_reservations SET remaining_usd = remaining_usd - p_amount_usd
    WHERE user_id = p_user_id AND workflow_id = p_workflow_id AND run_id = p_run_id;
  UPDATE kyros_credit_accounts SET reserved_usd = reserved_usd - p_amount_usd,
    available_usd = available_usd + p_amount_usd, updated_at = now()
    WHERE user_id = p_user_id RETURNING * INTO v_account;
  INSERT INTO kyros_credit_ledger (id, user_id, workflow_id, run_id, type, amount_usd, description)
    VALUES (gen_random_uuid()::text, p_user_id, p_workflow_id, p_run_id, 'workflow_release', p_amount_usd,
      'Unused workflow budget release');
  RETURN v_account;
END;
$$;

CREATE OR REPLACE FUNCTION kyros_credit_ready() RETURNS BOOLEAN LANGUAGE sql AS $$
  SELECT true;
$$;

REVOKE EXECUTE ON FUNCTION kyros_ensure_credit_account(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION kyros_deposit_credit(TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION kyros_reserve_credit(TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION kyros_settle_credit(TEXT, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION kyros_release_credit(TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION kyros_credit_ready() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION kyros_ensure_credit_account(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION kyros_deposit_credit(TEXT, NUMERIC, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION kyros_reserve_credit(TEXT, TEXT, TEXT, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION kyros_settle_credit(TEXT, TEXT, TEXT, NUMERIC, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION kyros_release_credit(TEXT, TEXT, TEXT, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION kyros_credit_ready() TO service_role;
