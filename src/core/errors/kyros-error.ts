import type { ErrorCategory, ErrorScope, NormalizedErrorPayload } from '../contracts/errors';

export class KyrosError extends Error {
  readonly category: ErrorCategory;
  readonly code: string;
  readonly safeMessage: string;
  readonly diagnosticContext?: Record<string, unknown>;
  readonly retryable: boolean;
  readonly scope: ErrorScope;
  readonly timestamp: string;

  constructor(options: {
    category: ErrorCategory;
    code: string;
    safeMessage: string;
    diagnosticContext?: Record<string, unknown>;
    retryable?: boolean;
    scope?: ErrorScope;
    cause?: unknown;
  }) {
    super(options.safeMessage);
    this.name = 'KyrosError';
    this.category = options.category;
    this.code = options.code;
    this.safeMessage = options.safeMessage;
    this.diagnosticContext = options.diagnosticContext;
    this.retryable = options.retryable ?? false;
    this.scope = options.scope ?? 'task';
    this.timestamp = new Date().toISOString();

    if (options.cause) {
      this.cause = options.cause;
    }
  }

  toPayload(): NormalizedErrorPayload {
    return {
      category: this.category,
      code: this.code,
      message: this.safeMessage,
      diagnosticContext: this.diagnosticContext,
      retryable: this.retryable,
      scope: this.scope,
      timestamp: this.timestamp,
    };
  }

  static fromUnknown(err: unknown, fallbackCategory: ErrorCategory = 'unexpected/internal', scope: ErrorScope = 'task'): KyrosError {
    if (err instanceof KyrosError) {
      return err;
    }

    const message = err instanceof Error ? err.message : String(err);

    return new KyrosError({
      category: fallbackCategory,
      code: 'UNEXPECTED_ERROR',
      safeMessage: 'An unexpected internal error occurred. Please try again.',
      diagnosticContext: { originalMessage: message },
      retryable: false,
      scope,
      cause: err,
    });
  }

  static geminiBusy(diagnosticContext?: Record<string, unknown>): KyrosError {
    return new KyrosError({
      category: 'provider/rate-limit',
      code: 'GEMINI_SERVER_BUSY',
      safeMessage: 'Gemini server is busy. Please try again later.',
      diagnosticContext,
      retryable: false,
      scope: 'task',
    });
  }

  static invalidPlan(message: string, diagnosticContext?: Record<string, unknown>): KyrosError {
    return new KyrosError({
      category: 'planning',
      code: 'INVALID_PLAN',
      safeMessage: `Plan validation failed: ${message}`,
      diagnosticContext,
      retryable: false,
      scope: 'workflow',
    });
  }

  static invalidInput(message: string, diagnosticContext?: Record<string, unknown>): KyrosError {
    return new KyrosError({
      category: 'input',
      code: 'INVALID_INPUT',
      safeMessage: message,
      diagnosticContext,
      retryable: false,
      scope: 'workflow',
    });
  }

  static stateTransitionForbidden(
    entity: 'workflow' | 'task',
    from: string,
    to: string,
    id: string
  ): KyrosError {
    return new KyrosError({
      category: 'unexpected/internal',
      code: 'INVALID_STATE_TRANSITION',
      safeMessage: `Cannot transition ${entity} ${id} from ${from} to ${to}.`,
      diagnosticContext: { entity, from, to, id },
      retryable: false,
      scope: entity === 'workflow' ? 'workflow' : 'task',
    });
  }
}
