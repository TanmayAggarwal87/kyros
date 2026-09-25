import { KyrosError } from '../errors/kyros-error';

export interface Sleeper {
  sleep(ms: number): Promise<void>;
}

export const defaultSleeper: Sleeper = {
  sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export interface GeminiRetryConfig {
  readonly maxAttempts: number; // 3 total (1 initial + 2 retries)
  readonly retryDelaysMs: readonly number[]; // [30000, 90000]
  readonly sleeper: Sleeper;
}

export const DEFAULT_GEMINI_RETRY_CONFIG: GeminiRetryConfig = {
  maxAttempts: 3,
  retryDelaysMs: [30_000, 90_000],
  sleeper: defaultSleeper,
};

export interface RetryAttemptLog {
  readonly attemptNumber: number;
  readonly delayMsBeforeAttempt?: number;
  readonly error?: unknown;
}

export class GeminiRetryPolicy {
  private readonly config: GeminiRetryConfig;

  constructor(config: Partial<GeminiRetryConfig> = {}) {
    this.config = {
      maxAttempts: config.maxAttempts ?? DEFAULT_GEMINI_RETRY_CONFIG.maxAttempts,
      retryDelaysMs: config.retryDelaysMs ?? DEFAULT_GEMINI_RETRY_CONFIG.retryDelaysMs,
      sleeper: config.sleeper ?? DEFAULT_GEMINI_RETRY_CONFIG.sleeper,
    };
  }

  /**
   * Executes an operation with the documented Gemini retry policy:
   * Max 3 calls total (1 initial + 2 retries).
   * 30s delay before attempt 2, 90s delay before attempt 3.
   * On 3rd failure, throws KyrosError with message "Gemini server is busy. Please try again later."
   */
  async execute<T>(
    operation: (attempt: number) => Promise<T>,
    onRetry?: (log: RetryAttemptLog) => void
  ): Promise<T> {
    const attempts: RetryAttemptLog[] = [];

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        return await operation(attempt);
      } catch (error) {
        attempts.push({ attemptNumber: attempt, error });

        if (attempt >= this.config.maxAttempts) {
          // Exhausted all 3 attempts!
          throw KyrosError.geminiBusy({
            totalAttempts: attempt,
            lastError: error instanceof Error ? error.message : String(error),
            history: attempts.map((a) => ({
              attempt: a.attemptNumber,
              error: a.error instanceof Error ? a.error.message : String(a.error),
            })),
          });
        }

        // Delay index: attempt 1 failed -> wait retryDelaysMs[0] (30s) before attempt 2
        // attempt 2 failed -> wait retryDelaysMs[1] (90s) before attempt 3
        const delayMs = this.config.retryDelaysMs[attempt - 1] ?? 30_000;
        if (onRetry) {
          onRetry({ attemptNumber: attempt + 1, delayMsBeforeAttempt: delayMs, error });
        }

        await this.config.sleeper.sleep(delayMs);
      }
    }

    throw KyrosError.geminiBusy({ totalAttempts: this.config.maxAttempts });
  }
}
