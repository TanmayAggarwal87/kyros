export type ErrorCategory =
  | 'input'
  | 'planning'
  | 'acquisition'
  | 'extraction'
  | 'validation'
  | 'provider/rate-limit'
  | 'payment'
  | 'budget'
  | 'persistence'
  | 'unexpected/internal';

export type ErrorScope = 'task' | 'workflow';

export interface NormalizedErrorPayload {
  readonly category: ErrorCategory;
  readonly code: string;
  readonly message: string; // User-safe message
  readonly diagnosticContext?: Record<string, unknown>; // Internal debugging only (no secrets)
  readonly retryable: boolean;
  readonly scope: ErrorScope;
  readonly timestamp: string;
}
