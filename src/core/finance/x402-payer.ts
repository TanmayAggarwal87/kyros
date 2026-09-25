import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import type { Hex } from 'viem';
import type { TransactionReceipt } from '../contracts/dataset';
import { KyrosError } from '../errors/kyros-error';

export interface TreasuryPayerOptions {
  readonly privateKey?: string;
  readonly rpcUrl?: string;
}

export interface PaymentSettlementParams {
  readonly resourceUri: string;
  readonly recipientAddress?: string;
  readonly amountUsd: number;
  readonly taskId?: string;
  readonly workflowId?: string;
}

// This boundary remains unavailable until the official x402 client and facilitator are wired.
export class BaseSepoliaTreasuryPayer {
  readonly chainId = baseSepolia.id;
  readonly networkName = 'base-sepolia (84532)';
  private readonly account: ReturnType<typeof privateKeyToAccount>;

  constructor(options?: TreasuryPayerOptions) {
    const key = options?.privateKey ?? process.env.TREASURY_PRIVATE_KEY;
    if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
      throw new KyrosError({ category: 'payment', code: 'TREASURY_KEY_INVALID', safeMessage: 'Treasury wallet is not configured' });
    }
    this.account = privateKeyToAccount(key as Hex);
  }

  getTreasuryAddress(): string {
    return this.account.address;
  }

  async settlePayment(_params: PaymentSettlementParams): Promise<TransactionReceipt> {
    void _params;
    throw new KyrosError({ category: 'payment', code: 'SETTLEMENT_UNAVAILABLE', safeMessage: 'x402 settlement is not configured' });
  }
}
