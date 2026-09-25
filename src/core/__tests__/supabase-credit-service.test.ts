import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseCreditService } from '../finance/supabase-credit-service';

describe('Supabase credit boundary', () => {
  const account = {
    user_id: 'user_123', balance_usd: '15.00', reserved_usd: '0.00',
    available_usd: '15.00', currency: 'USD', updated_at: '2026-09-25T00:00:00Z',
  };

  test('uses server-role RPC for deposits and maps account data', async () => {
    const calls: Array<{ url: string; body: string | undefined }> = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), body: init?.body?.toString() });
      return Response.json(account);
    }) as typeof fetch;
    const credits = new SupabaseCreditService({ url: 'https://project.supabase.co', serviceRoleKey: 'server-test-key', fetchImpl });
    const result = await credits.depositCredits('user_123', 5, 'pi_123');
    assert.equal(result.balanceUsd, 15);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://project.supabase.co/rest/v1/rpc/kyros_deposit_credit');
    assert.deepEqual(JSON.parse(calls[0].body ?? ''), {
      p_user_id: 'user_123', p_amount_usd: 5, p_receipt_ref: 'pi_123', p_description: 'Stripe fiat top-up',
    });
  });

  test('rejects inconsistent balances and never returns provider errors', async () => {
    const inconsistent = new SupabaseCreditService({
      url: 'https://project.supabase.co', serviceRoleKey: 'server-test-key',
      fetchImpl: (async () => Response.json({ ...account, available_usd: '20.00' })) as typeof fetch,
    });
    await assert.rejects(() => inconsistent.getOrCreateAccount('user_123'), /inconsistent/);

    const failed = new SupabaseCreditService({
      url: 'https://project.supabase.co', serviceRoleKey: 'server-test-key',
      fetchImpl: (async () => Response.json({ message: 'secret internal detail' }, { status: 500 })) as typeof fetch,
    });
    await assert.rejects(() => failed.getOrCreateAccount('user_123'), /Credit ledger is unavailable/);
  });

  test('requires a fully applied migration before checkout', async () => {
    const ready = new SupabaseCreditService({
      url: 'https://project.supabase.co', serviceRoleKey: 'server-test-key',
      fetchImpl: (async () => Response.json(true)) as typeof fetch,
    });
    await assert.doesNotReject(() => ready.assertReady());
    const incomplete = new SupabaseCreditService({
      url: 'https://project.supabase.co', serviceRoleKey: 'server-test-key',
      fetchImpl: (async () => Response.json(false)) as typeof fetch,
    });
    await assert.rejects(() => incomplete.assertReady(), /not ready/);
  });

  test('uses apikey only for a new Supabase secret key', async () => {
    let apiKeyHeader: string | null = null;
    let authorizationHeader: string | null = null;
    const credits = new SupabaseCreditService({
      url: 'https://project.supabase.co', serviceRoleKey: 'sb_secret_test',
      fetchImpl: (async (_input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        apiKeyHeader = headers.get('apikey');
        authorizationHeader = headers.get('Authorization');
        return Response.json(true);
      }) as typeof fetch,
    });
    await credits.assertReady();
    assert.equal(apiKeyHeader, 'sb_secret_test');
    assert.equal(authorizationHeader, null);
  });
});
