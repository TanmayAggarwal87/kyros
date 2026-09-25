import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { BudgetGovernor, InMemoryCreditRepository } from '../finance/budget-governor';
import { KyrosError } from '../errors/kyros-error';

describe('Budget Governor & Credit Ledger', () => {
  test('initializes new account with $10.00 base research credit grant', async () => {
    const repo = new InMemoryCreditRepository();
    const governor = new BudgetGovernor(repo);

    const account = await governor.getOrCreateAccount('user-1');
    assert.equal(account.userId, 'user-1');
    assert.equal(account.balanceUsd, 10.0);
    assert.equal(account.reservedUsd, 0);
    assert.equal(account.availableUsd, 10.0);

    const ledger = await governor.getLedger('user-1');
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].type, 'stripe_topup');
    assert.equal(ledger[0].amountUsd, 10.0);
  });

  test('deposits credits via stripe top-up', async () => {
    const repo = new InMemoryCreditRepository();
    const governor = new BudgetGovernor(repo);

    const updated = await governor.depositCredits('user-1', 15.0, 'pi_stripe_123', 'Stripe checkout top-up');
    assert.equal(updated.balanceUsd, 25.0); // 10 base + 15 deposit
    assert.equal(updated.availableUsd, 25.0);
    assert.equal(updated.reservedUsd, 0.0);

    const ledger = await governor.getLedger('user-1');
    assert.equal(ledger.length, 2);
    const topup = ledger.find((e) => e.receiptRef === 'pi_stripe_123');
    assert.ok(topup);
    assert.equal(topup.amountUsd, 15.0);
  });

  test('atomically reserves budget and rejects when exceeding available credits', async () => {
    const repo = new InMemoryCreditRepository();
    const governor = new BudgetGovernor(repo);

    // Initial base is $10.00. Attempting to reserve $15.00 must fail
    await assert.rejects(
      () => governor.reserveWorkflowBudget('user-1', 'wf-1', 'run-1', 15.00),
      (err: unknown) => {
        return err instanceof KyrosError && err.code === 'INSUFFICIENT_CREDITS';
      }
    );

    // Reserving $5.00 from $10.00 succeeds
    const reserved = await governor.reserveWorkflowBudget('user-1', 'wf-1', 'run-1', 5.00);
    assert.equal(reserved.balanceUsd, 10.0);
    assert.equal(reserved.reservedUsd, 5.00);
    assert.equal(reserved.availableUsd, 5.00);
  });

  test('settles x402 debit against reserved funds', async () => {
    const repo = new InMemoryCreditRepository();
    const governor = new BudgetGovernor(repo);

    await governor.depositCredits('user-1', 1.0, 'pi_1'); // 10 base + 1 = 11.0
    await governor.reserveWorkflowBudget('user-1', 'wf-1', 'run-1', 0.10);

    const settled = await governor.settleX402Debit(
      'user-1',
      'wf-1',
      'run-1',
      0.02,
      '0xabcdef1234567890',
      'x402 query to premium provider'
    );

    assert.equal(settled.balanceUsd, 10.98);
    assert.equal(settled.reservedUsd, 0.08);
    assert.equal(settled.availableUsd, 10.90);
  });

  test('releases unspent reservation back to available balance', async () => {
    const repo = new InMemoryCreditRepository();
    const governor = new BudgetGovernor(repo);

    await governor.depositCredits('user-1', 1.0, 'pi_1');
    await governor.reserveWorkflowBudget('user-1', 'wf-1', 'run-1', 0.10);
    // Settle 0.02, leaving 0.08 reserved
    await governor.settleX402Debit('user-1', 'wf-1', 'run-1', 0.02, '0xhash');

    // Release remaining 0.08 unspent
    const released = await governor.releaseWorkflowBudget('user-1', 'wf-1', 'run-1', 0.08);
    assert.equal(released.balanceUsd, 10.98);
    assert.equal(released.reservedUsd, 0.0);
    assert.equal(released.availableUsd, 10.98);

    const ledger = await governor.getLedger('user-1');
    const releaseEntry = ledger.find((e) => e.type === 'workflow_release');
    assert.ok(releaseEntry);
    assert.equal(releaseEntry.amountUsd, 0.08);
  });

  test('guards against exceeding per-task ceiling', () => {
    const repo = new InMemoryCreditRepository();
    const governor = new BudgetGovernor(repo);

    assert.doesNotThrow(() => governor.assertTaskCostCeiling(0.015, 0.02));

    assert.throws(
      () => governor.assertTaskCostCeiling(0.025, 0.02),
      (err: unknown) => err instanceof KyrosError && err.code === 'BUDGET_CEILING_EXCEEDED'
    );
  });

  test('rejects invalid reservations and debits that exceed reserved funds', async () => {
    const governor = new BudgetGovernor(new InMemoryCreditRepository());
    await assert.rejects(() => governor.reserveWorkflowBudget('user-1', 'wf-1', 'run-1', -1));
    await assert.rejects(() => governor.depositCredits('user-1', Number.NaN, 'pi-bad'));
    await governor.reserveWorkflowBudget('user-1', 'wf-1', 'run-1', 0.02);
    await assert.rejects(() => governor.settleX402Debit('user-1', 'wf-1', 'run-1', 0.03, 'receipt-1'));
    const account = await governor.getOrCreateAccount('user-1');
    assert.equal(account.reservedUsd, 0.02);
    assert.equal(account.balanceUsd, 10);
  });
});
