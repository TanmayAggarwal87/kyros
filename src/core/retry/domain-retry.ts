import type { Task } from '../contracts/task';

export interface DomainRetryConfig {
  readonly maxDomainAttempts: number; // default: 3
}

export const DEFAULT_DOMAIN_RETRY_CONFIG: DomainRetryConfig = {
  maxDomainAttempts: 3,
};

export interface DomainRetryDecision {
  readonly shouldRetry: boolean;
  readonly nextAttemptNumber: number;
  readonly reason?: string;
}

export class DomainRetryPolicy {
  private readonly config: DomainRetryConfig;

  constructor(config: Partial<DomainRetryConfig> = {}) {
    this.config = {
      maxDomainAttempts: config.maxDomainAttempts ?? DEFAULT_DOMAIN_RETRY_CONFIG.maxDomainAttempts,
    };
  }

  evaluate(task: Task, reason?: string): DomainRetryDecision {
    const currentAttempts = task.attemptCounts.domain;
    if (currentAttempts < this.config.maxDomainAttempts) {
      return {
        shouldRetry: true,
        nextAttemptNumber: currentAttempts + 1,
        reason: reason ?? 'Domain retry triggered (e.g., zero results or query refinement).',
      };
    }

    return {
      shouldRetry: false,
      nextAttemptNumber: currentAttempts,
      reason: `Domain retry limit of ${this.config.maxDomainAttempts} attempts exhausted.`,
    };
  }
}
