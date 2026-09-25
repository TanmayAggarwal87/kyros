import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readDemoPremiumConfig } from '../../app/api/demo/premium-data/handler';

describe('x402 premium resource configuration', () => {
  test('fails closed without a facilitator and recipient', () => {
    assert.equal(readDemoPremiumConfig({}), null);
    assert.equal(readDemoPremiumConfig({ X402_FACILITATOR_URL: 'http://localhost:3000', X402_PAYEE_ADDRESS: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' }), null);
    assert.equal(readDemoPremiumConfig({ X402_FACILITATOR_URL: 'https://x402.org/facilitator', X402_PAYEE_ADDRESS: 'bad-address' }), null);
  });

  test('accepts an HTTPS facilitator and valid Base Sepolia payee', () => {
    const config = readDemoPremiumConfig({
      X402_FACILITATOR_URL: 'https://x402.org/facilitator',
      X402_PAYEE_ADDRESS: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    });
    assert.equal(config?.payTo, '0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
  });
});
