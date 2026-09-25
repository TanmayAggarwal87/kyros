import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { StripeWebhookHandler, verifyStripeWebhookSignature } from '../finance/stripe-service';
import { BudgetGovernor, InMemoryCreditRepository } from '../finance/budget-governor';
import crypto from 'node:crypto';

describe('Stripe Webhook & Fiat Deposits', () => {
  const secret = 'whsec_test_secret_key_12345';

  function generateValidStripeHeader(payload: string, secretKey: string, timestamp = Math.floor(Date.now() / 1000)): string {
    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(`${timestamp}.${payload}`)
      .digest('hex');
    return `t=${timestamp},v1=${signature}`;
  }

  test('verifies valid stripe webhook signature', () => {
    const payload = JSON.stringify({ id: 'evt_1', type: 'payment_intent.succeeded' });
    const header = generateValidStripeHeader(payload, secret);

    const isValid = verifyStripeWebhookSignature(payload, header, secret);
    assert.equal(isValid, true);
  });

  test('rejects tampered stripe payload or invalid signature', () => {
    const payload = JSON.stringify({ id: 'evt_1', type: 'payment_intent.succeeded' });
    const header = generateValidStripeHeader(payload, secret);
    const tamperedPayload = JSON.stringify({ id: 'evt_1', type: 'payment_intent.succeeded', hacker: true });

    const isValid = verifyStripeWebhookSignature(tamperedPayload, header, secret);
    assert.equal(isValid, false);
  });

  test('processes checkout.session.completed and deposits credits idempotently', async () => {
    const repo = new InMemoryCreditRepository();
    const governor = new BudgetGovernor(repo);
    const handler = new StripeWebhookHandler(governor, secret);

    const payloadObj = {
      id: 'evt_checkout_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          client_reference_id: 'user_bob',
          amount_total: 1000, // $10.00 in cents
          currency: 'usd',
          payment_status: 'paid',
          payment_intent: 'pi_test_123',
        },
      },
    };
    const payloadStr = JSON.stringify(payloadObj);
    const header = generateValidStripeHeader(payloadStr, secret);

    // First call
    const result1 = await handler.handleWebhook(payloadStr, header);
    assert.equal(result1.status, 'processed');
    assert.equal(result1.amountUsd, 10.0);

    const account = await governor.getOrCreateAccount('user_bob');
    assert.equal(account.balanceUsd, 20.0); // 10 base grant + 10 deposit
    assert.equal(account.availableUsd, 20.0);

    // Duplicate call (replay / duplicate webhook delivery)
    const result2 = await handler.handleWebhook(payloadStr, header);
    assert.equal(result2.status, 'already_processed');

    // Balance must still be 20.0, NOT 30.0
    const accountAfterReplay = await governor.getOrCreateAccount('user_bob');
    assert.equal(accountAfterReplay.balanceUsd, 20.0);
  });

  test('does not credit an unpaid checkout session', async () => {
    const governor = new BudgetGovernor(new InMemoryCreditRepository());
    const handler = new StripeWebhookHandler(governor, secret);
    const payload = JSON.stringify({
      id: 'evt_unpaid', type: 'checkout.session.completed',
      data: { object: { id: 'cs_unpaid', client_reference_id: 'user_bob', amount_total: 1000, currency: 'usd', payment_status: 'unpaid' } },
    });
    const result = await handler.handleWebhook(payload, generateValidStripeHeader(payload, secret));
    assert.equal(result.status, 'ignored');
    const account = await governor.getOrCreateAccount('user_bob');
    assert.equal(account.balanceUsd, 10);
  });
});
