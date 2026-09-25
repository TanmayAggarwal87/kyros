import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { BaseSepoliaTreasuryPayer } from '../finance/x402-payer';

describe('x402 treasury boundary', () => {
  const testPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

  test('requires a configured valid private key', () => {
    assert.throws(() => new BaseSepoliaTreasuryPayer({ privateKey: 'invalid' }));
  });

  test('does not invent a confirmed receipt from a signature', async () => {
    const payer = new BaseSepoliaTreasuryPayer({ privateKey: testPrivateKey });
    assert.equal(payer.chainId, 84532);
    assert.match(payer.getTreasuryAddress(), /^0x[a-fA-F0-9]{40}$/);
    await assert.rejects(() => payer.settlePayment({
      resourceUri: 'https://kyros.ai/api/demo/premium-data',
      recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      amountUsd: 0.02,
    }), /settlement/i);
  });
});
