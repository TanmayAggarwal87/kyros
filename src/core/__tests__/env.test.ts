import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateServerEnv } from '../config/env';

describe('Server Environment Validation', () => {
  test('validates valid server environment with defaults', () => {
    const rawEnv = {
      NODE_ENV: 'test',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'mock-service-role-key',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'mock-anon-key',
      STRIPE_SECRET_KEY: 'sk_test_12345',
      STRIPE_WEBHOOK_SECRET: 'whsec_12345',
      TREASURY_PRIVATE_KEY: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    };

    const parsed = validateServerEnv(rawEnv);
    assert.equal(parsed.NODE_ENV, 'test');
    assert.equal(parsed.BASE_SEPOLIA_CHAIN_ID, 84532);
    assert.equal(parsed.BASE_SEPOLIA_RPC_URL, 'https://sepolia.base.org');
    assert.equal(parsed.SUPABASE_URL, 'https://example.supabase.co');
  });

  test('rejects invalid treasury private key format', () => {
    const rawEnv = {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'mock-service-role-key',
      TREASURY_PRIVATE_KEY: 'invalid-not-hex',
    };

    assert.throws(() => validateServerEnv(rawEnv), (err: unknown) => {
      return err instanceof Error && err.message.includes('TREASURY_PRIVATE_KEY');
    });
  });

  test('rejects invalid supabase URL', () => {
    const rawEnv = {
      SUPABASE_URL: 'not-a-valid-url',
    };

    assert.throws(() => validateServerEnv(rawEnv));
  });
});
