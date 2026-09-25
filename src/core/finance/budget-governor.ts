import type {
  UserCreditAccount,
  CreditLedgerEntry,
  LedgerEntryType,
} from '../contracts/credits';
import { KyrosError } from '../errors/kyros-error';

export interface ICreditRepository {
  getAccount(userId: string): Promise<UserCreditAccount | null>;
  saveAccount(account: UserCreditAccount): Promise<void>;
  addLedgerEntry(entry: CreditLedgerEntry): Promise<void>;
  getLedger(userId: string): Promise<readonly CreditLedgerEntry[]>;
}

export class InMemoryCreditRepository implements ICreditRepository {
  private readonly accounts = new Map<string, UserCreditAccount>();
  private readonly ledger: CreditLedgerEntry[] = [];

  async getAccount(userId: string): Promise<UserCreditAccount | null> {
    return this.accounts.get(userId) ?? null;
  }

  async saveAccount(account: UserCreditAccount): Promise<void> {
    this.accounts.set(account.userId, { ...account });
  }

  async addLedgerEntry(entry: CreditLedgerEntry): Promise<void> {
    this.ledger.push({ ...entry });
  }

  async getLedger(userId: string): Promise<readonly CreditLedgerEntry[]> {
    return this.ledger
      .filter((e) => e.userId === userId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }
}

export class BudgetGovernor {
  constructor(private readonly repo: ICreditRepository) {}

  private assertPositiveAmount(amountUsd: number): void {
    if (!Number.isFinite(amountUsd) || amountUsd <= 0 || !Number.isSafeInteger(amountUsd * 10000)) {
      throw new KyrosError({ category: 'input', code: 'INVALID_AMOUNT', safeMessage: 'Amount must be a positive USD value with at most four decimal places' });
    }
  }

  async getOrCreateAccount(userId: string): Promise<UserCreditAccount> {
    const existing = await this.repo.getAccount(userId);
    if (existing) return existing;

    const newAccount: UserCreditAccount = {
      userId,
      balanceUsd: 10.0,
      reservedUsd: 0,
      availableUsd: 10.0,
      currency: 'USD',
      updatedAt: new Date().toISOString(),
    };
    await this.repo.saveAccount(newAccount);
    await this.recordLedgerEntry({
      userId,
      type: 'stripe_topup',
      amountUsd: 10.0,
      description: 'Kyros Welcome Research Credits ($10.00 base grant)',
      receiptRef: 'grant-welcome-10',
    });
    return newAccount;
  }

  async depositCredits(
    userId: string,
    amountUsd: number,
    receiptRef: string,
    description: string = 'Stripe fiat top-up'
  ): Promise<UserCreditAccount> {
    this.assertPositiveAmount(amountUsd);

    const account = await this.getOrCreateAccount(userId);
    const newBalance = Number((account.balanceUsd + amountUsd).toFixed(4));
    const newAvailable = Number((account.availableUsd + amountUsd).toFixed(4));

    const updatedAccount: UserCreditAccount = {
      ...account,
      balanceUsd: newBalance,
      availableUsd: newAvailable,
      updatedAt: new Date().toISOString(),
    };

    await this.repo.saveAccount(updatedAccount);
    await this.recordLedgerEntry({
      userId,
      type: 'stripe_topup',
      amountUsd,
      description,
      receiptRef,
    });

    return updatedAccount;
  }

  async reserveWorkflowBudget(
    userId: string,
    workflowId: string,
    runId: string,
    amountUsd: number
  ): Promise<UserCreditAccount> {
    this.assertPositiveAmount(amountUsd);
    const account = await this.getOrCreateAccount(userId);

    if (account.availableUsd < amountUsd) {
      throw new KyrosError({
        category: 'budget',
        code: 'INSUFFICIENT_CREDITS',
        safeMessage: `Insufficient research credits. Required: $${amountUsd.toFixed(4)}, Available: $${account.availableUsd.toFixed(4)}. Please top up.`,
        scope: 'workflow',
        diagnosticContext: { required: amountUsd, available: account.availableUsd, userId },
      });
    }

    const newReserved = Number((account.reservedUsd + amountUsd).toFixed(4));
    const newAvailable = Number((account.availableUsd - amountUsd).toFixed(4));

    const updatedAccount: UserCreditAccount = {
      ...account,
      reservedUsd: newReserved,
      availableUsd: newAvailable,
      updatedAt: new Date().toISOString(),
    };

    await this.repo.saveAccount(updatedAccount);
    await this.recordLedgerEntry({
      userId,
      workflowId,
      runId,
      type: 'workflow_reservation',
      amountUsd,
      description: `Workflow ${workflowId} budget reservation`,
    });

    return updatedAccount;
  }

  async settleX402Debit(
    userId: string,
    workflowId: string,
    runId: string,
    amountUsd: number,
    receiptRef: string,
    description: string = 'x402 Base Sepolia data acquisition'
  ): Promise<UserCreditAccount> {
    this.assertPositiveAmount(amountUsd);
    const account = await this.getOrCreateAccount(userId);

    if (account.reservedUsd < amountUsd || account.balanceUsd < amountUsd) {
      throw new KyrosError({ category: 'budget', code: 'INSUFFICIENT_RESERVATION', safeMessage: 'Payment exceeds reserved research credits', scope: 'task' });
    }

    const newBalance = Number((account.balanceUsd - amountUsd).toFixed(4));
    const newReserved = Number((account.reservedUsd - amountUsd).toFixed(4));

    const updatedAccount: UserCreditAccount = {
      ...account,
      balanceUsd: newBalance,
      reservedUsd: newReserved,
      updatedAt: new Date().toISOString(),
    };

    await this.repo.saveAccount(updatedAccount);
    await this.recordLedgerEntry({
      userId,
      workflowId,
      runId,
      type: 'x402_debit',
      amountUsd,
      description,
      receiptRef,
    });

    return updatedAccount;
  }

  async releaseWorkflowBudget(
    userId: string,
    workflowId: string,
    runId: string,
    unspentAmountUsd: number
  ): Promise<UserCreditAccount> {
    if (unspentAmountUsd === 0) {
      return this.getOrCreateAccount(userId);
    }

    this.assertPositiveAmount(unspentAmountUsd);

    const account = await this.getOrCreateAccount(userId);
    if (account.reservedUsd < unspentAmountUsd) {
      throw new KyrosError({ category: 'budget', code: 'INSUFFICIENT_RESERVATION', safeMessage: 'Release exceeds reserved research credits', scope: 'workflow' });
    }
    const releaseAmt = unspentAmountUsd;

    const newReserved = Number((account.reservedUsd - releaseAmt).toFixed(4));
    const newAvailable = Number((account.availableUsd + releaseAmt).toFixed(4));

    const updatedAccount: UserCreditAccount = {
      ...account,
      reservedUsd: newReserved,
      availableUsd: newAvailable,
      updatedAt: new Date().toISOString(),
    };

    await this.repo.saveAccount(updatedAccount);
    await this.recordLedgerEntry({
      userId,
      workflowId,
      runId,
      type: 'workflow_release',
      amountUsd: releaseAmt,
      description: `Release unspent reservation for workflow ${workflowId}`,
    });

    return updatedAccount;
  }

  assertTaskCostCeiling(taskCostUsd: number, maxPerTaskCostUsd: number): void {
    this.assertPositiveAmount(taskCostUsd);
    this.assertPositiveAmount(maxPerTaskCostUsd);
    if (taskCostUsd > maxPerTaskCostUsd) {
      throw new KyrosError({
        category: 'budget',
        code: 'BUDGET_CEILING_EXCEEDED',
        safeMessage: `Task cost ($${taskCostUsd.toFixed(4)}) exceeds configured per-task limit of $${maxPerTaskCostUsd.toFixed(4)}`,
        scope: 'task',
        diagnosticContext: { taskCostUsd, maxPerTaskCostUsd },
      });
    }
  }

  async getLedger(userId: string): Promise<readonly CreditLedgerEntry[]> {
    return this.repo.getLedger(userId);
  }

  private async recordLedgerEntry(data: {
    userId: string;
    workflowId?: string;
    runId?: string;
    type: LedgerEntryType;
    amountUsd: number;
    description: string;
    receiptRef?: string;
  }): Promise<void> {
    const entry: CreditLedgerEntry = {
      id: `led-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      userId: data.userId,
      workflowId: data.workflowId,
      runId: data.runId,
      type: data.type,
      amountUsd: data.amountUsd,
      description: data.description,
      timestamp: new Date().toISOString(),
      receiptRef: data.receiptRef,
    };
    await this.repo.addLedgerEntry(entry);
  }
}
