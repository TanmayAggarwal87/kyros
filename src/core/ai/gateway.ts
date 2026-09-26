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
    modelId: 'gemini-3.1-flash-lite',
    temperature: 0.2,
    maxOutputTokens: 8192,
  },
  extractor: {
    modelId: 'gemini-3.1-flash-lite',
    temperature: 0.1,
    maxOutputTokens: 4096,
  },
  refiner: {
    modelId: 'gemini-3.1-flash-lite',
    temperature: 0.3,
    maxOutputTokens: 2048,
  },
};

export function extractJsonFromAiOutput(rawOutput: string): unknown {
  const trimmed = rawOutput.trim();

  // Attempt 1: Direct parse
  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue
  }

  // Attempt 2: Extract from markdown code fence (```json ... ``` or ``` ... ```)
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // Continue
    }
  }

  // Attempt 3: Extract from first '{' or '[' to last '}' or ']'
  const firstBrace = trimmed.indexOf('{');
  const firstBracket = trimmed.indexOf('[');
  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = trimmed.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = trimmed.lastIndexOf(']');
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const candidate = trimmed.substring(startIdx, endIdx + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      // Attempt 4: Clean trailing commas before closing braces/brackets
      try {
        const withoutTrailingCommas = candidate.replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(withoutTrailingCommas);
      } catch {
        // Continue
      }
    }
  }

  // Attempt 5: Fallback fence strip
  const cleaned = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

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

export class GeminiHttpCaller implements IGeminiCaller {
  private readonly apiKey?: string;
  private readonly baseUrl: string;

  constructor(options?: { apiKey?: string; baseUrl?: string }) {
    this.apiKey = options?.apiKey ?? process.env.GEMINI_API_KEY;
    this.baseUrl = (options?.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
  }

  async callModel(params: {
    modelId: string;
    temperature: number;
    maxOutputTokens?: number;
    systemInstruction?: string;
    prompt: string;
  }): Promise<string> {
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new KyrosError({
        category: 'acquisition',
        code: 'GEMINI_API_KEY_MISSING',
        safeMessage: 'Gemini API key is not configured. Please set GEMINI_API_KEY in environment variables.',
        retryable: false,
        scope: 'workflow',
      });
    }

    const endpoint = `${this.baseUrl}/models/${encodeURIComponent(params.modelId)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const body: Record<string, unknown> = {
      contents: [
        {
          role: 'user',
          parts: [{ text: params.prompt }],
        },
      ],
      generationConfig: {
        temperature: params.temperature,
        maxOutputTokens: params.maxOutputTokens ?? 4096,
        responseMimeType: 'application/json',
      },
    };

    if (params.systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: params.systemInstruction }],
      };
    }

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: AbortSignal.timeout(30000),
      });
    } catch (networkErr) {
      throw new KyrosError({
        category: 'provider/rate-limit',
        code: 'GEMINI_SERVER_BUSY',
        safeMessage: 'Gemini server is busy. Please try again later.',
        diagnosticContext: {
          error: networkErr instanceof Error ? networkErr.message : String(networkErr),
        },
        retryable: true,
        scope: 'task',
      });
    }

    if (response.status === 429 || response.status === 503 || response.status === 500) {
      throw new KyrosError({
        category: 'provider/rate-limit',
        code: 'GEMINI_SERVER_BUSY',
        safeMessage: 'Gemini server is busy. Please try again later.',
        diagnosticContext: { status: response.status, statusText: response.statusText },
        retryable: true,
        scope: 'task',
      });
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new KyrosError({
        category: 'unexpected/internal',
        code: 'GEMINI_API_ERROR',
        safeMessage: `Gemini API returned status ${response.status}.`,
        diagnosticContext: { status: response.status, body: errText },
        retryable: false,
        scope: 'workflow',
      });
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new KyrosError({
        category: 'validation',
        code: 'EMPTY_AI_RESPONSE',
        safeMessage: 'Gemini returned an empty response.',
        retryable: false,
        scope: 'workflow',
      });
    }

    return text;
  }
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

  static fromEnvironment(options?: {
    caller?: IGeminiCaller;
    routes?: Partial<Record<AiRole, ModelRouteConfig>>;
    retryConfig?: Partial<GeminiRetryConfig>;
  }): GeminiGateway {
    const caller = options?.caller ?? new GeminiHttpCaller();
    return new GeminiGateway({
      caller,
      routes: options?.routes,
      retryConfig: options?.retryConfig,
    });
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
      parsedJson = extractJsonFromAiOutput(rawOutput);
    } catch (parseErr) {
      throw new KyrosError({
        category: 'validation',
        code: 'MALFORMED_AI_JSON',
        safeMessage: 'AI output could not be parsed as valid JSON.',
        diagnosticContext: {
          rawOutputSample: rawOutput.slice(0, 500),
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
          rawOutputSample: rawOutput.slice(0, 500),
        },
        retryable: false,
        scope: 'workflow',
      });
    }

    return validationResult.data;
  }
}
