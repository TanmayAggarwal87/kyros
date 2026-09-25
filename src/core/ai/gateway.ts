import { z } from 'zod';
import { KyrosError } from '../errors/kyros-error';
import { GeminiRetryPolicy, type GeminiRetryConfig } from './retry-policy';

export type AiRole = 'planner' | 'extractor' | 'refiner';

export interface ModelRouteConfig {
  readonly modelId: string;
  readonly temperature: number;
  readonly maxOutputTokens?: number;
}

export const DEFAULT_MODEL_ROUTES: Record<AiRole, ModelRouteConfig> = {
  planner: {
    modelId: 'gemini-2.5-pro',
    temperature: 0.2,
    maxOutputTokens: 8192,
  },
  extractor: {
    modelId: 'gemini-2.5-flash',
    temperature: 0.1,
    maxOutputTokens: 4096,
  },
  refiner: {
    modelId: 'gemini-2.5-flash',
    temperature: 0.3,
    maxOutputTokens: 2048,
  },
};

export interface StructuredAiRequest<T> {
  readonly role: AiRole;
  readonly systemInstruction?: string;
  readonly prompt: string;
  readonly schema: z.ZodType<T>;
}

export interface IGeminiCaller {
  callModel(params: {
    modelId: string;
    temperature: number;
    maxOutputTokens?: number;
    systemInstruction?: string;
    prompt: string;
  }): Promise<string>;
}

export interface IGeminiGateway {
  generateStructuredJson<T>(request: StructuredAiRequest<T>): Promise<T>;
  getModelRoute(role: AiRole): ModelRouteConfig;
}

export class GeminiGateway implements IGeminiGateway {
  private readonly caller: IGeminiCaller;
  private readonly routes: Record<AiRole, ModelRouteConfig>;
  private readonly retryPolicy: GeminiRetryPolicy;

  constructor(options: {
    caller: IGeminiCaller;
    routes?: Partial<Record<AiRole, ModelRouteConfig>>;
    retryConfig?: Partial<GeminiRetryConfig>;
  }) {
    this.caller = options.caller;
    this.routes = {
      planner: options.routes?.planner ?? DEFAULT_MODEL_ROUTES.planner,
      extractor: options.routes?.extractor ?? DEFAULT_MODEL_ROUTES.extractor,
      refiner: options.routes?.refiner ?? DEFAULT_MODEL_ROUTES.refiner,
    };
    this.retryPolicy = new GeminiRetryPolicy(options.retryConfig);
  }

  getModelRoute(role: AiRole): ModelRouteConfig {
    return this.routes[role];
  }

  async generateStructuredJson<T>(request: StructuredAiRequest<T>): Promise<T> {
    const route = this.getModelRoute(request.role);

    // Execute with Gemini infrastructure retry policy
    const rawOutput = await this.retryPolicy.execute(async () => {
      return await this.caller.callModel({
        modelId: route.modelId,
        temperature: route.temperature,
        maxOutputTokens: route.maxOutputTokens,
        systemInstruction: request.systemInstruction,
        prompt: request.prompt,
      });
    });

    // Parse JSON
    let parsedJson: unknown;
    try {
      // Strip markdown code fences if model returned ```json ... ```
      const cleaned = rawOutput
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/, '');
      parsedJson = JSON.parse(cleaned);
    } catch (parseErr) {
      throw new KyrosError({
        category: 'validation',
        code: 'MALFORMED_AI_JSON',
        safeMessage: 'AI output could not be parsed as valid JSON.',
        diagnosticContext: {
          rawOutputSample: rawOutput.slice(0, 200),
          error: parseErr instanceof Error ? parseErr.message : String(parseErr),
        },
        retryable: false,
        scope: 'workflow',
      });
    }

    // Validate with Zod schema
    const validationResult = request.schema.safeParse(parsedJson);
    if (!validationResult.success) {
      throw new KyrosError({
        category: 'validation',
        code: 'SCHEMA_VALIDATION_FAILED',
        safeMessage: 'AI output failed schema validation.',
        diagnosticContext: {
          issues: validationResult.error.issues,
        },
        retryable: false,
        scope: 'workflow',
      });
    }

    return validationResult.data;
  }
}
