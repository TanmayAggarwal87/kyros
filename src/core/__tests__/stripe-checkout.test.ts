import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isValidCheckoutAmount } from '../../app/api/checkout/stripe/route';

describe('Stripe Checkout boundary', () => {
  test('accepts only positive whole-cent amounts', () => {
    assert.equal(isValidCheckoutAmount(25), true);
    for (const value of [-5, 0, 0.001, null, '25', Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(isValidCheckoutAmount(value), false);
    }
  });
});
