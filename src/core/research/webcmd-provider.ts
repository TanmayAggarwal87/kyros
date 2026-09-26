import { KyrosError } from '../errors/kyros-error';
import {
  type IWebcmdProvider,
  type WebcmdNavigationRequest,
  type WebcmdNavigationResult,
  webcmdNavigationRequestSchema,
} from '../contracts/webcmd';

export interface IWebcmdHttpClient {
  post(url: string, headers: Record<string, string>, body: unknown): Promise<{
    status: number;
    statusText: string;
    data: unknown;
  }>;
}

export class DefaultWebcmdHttpClient implements IWebcmdHttpClient {
  async post(url: string, headers: Record<string, string>, body: unknown): Promise<{
    status: number;
    statusText: string;
    data: unknown;
  }> {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    });

    let data: unknown;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    return {
      status: res.status,
      statusText: res.statusText,
      data,
    };
  }
}

export interface WebcmdProviderOptions {
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly httpClient?: IWebcmdHttpClient;
}

export class WebcmdProvider implements IWebcmdProvider {
  readonly name = 'webcmd';
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly httpClient: IWebcmdHttpClient;

  constructor(options: WebcmdProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.WEBCMD_API_KEY;
    this.baseUrl = (options.baseUrl ?? 'https://api.webcmd.com/v1').replace(/\/+$/, '');
    this.httpClient = options.httpClient ?? new DefaultWebcmdHttpClient();
  }

  /**
   * SSRF protection guard: ensures URLs are public http/https endpoints.
   */
  private validateUrlSafety(urlStr: string): void {
    let parsed: URL;
    try {
      parsed = new URL(urlStr);
    } catch {
      throw KyrosError.invalidInput(`Invalid URL format: "${urlStr}".`);
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw KyrosError.invalidInput(`Blocked forbidden URL scheme: "${parsed.protocol}". Only HTTP and HTTPS are permitted.`);
    }

    const hostname = parsed.hostname.toLowerCase();
    const blockedHosts = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      'metadata.google.internal',
      '169.254.169.254', // AWS/GCP instance metadata
    ];

    if (
      blockedHosts.includes(hostname) ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      throw new KyrosError({
        category: 'acquisition',
        code: 'SSRF_BLOCKED',
        safeMessage: 'Access to private or local network addresses is prohibited.',
        diagnosticContext: { blockedHost: hostname },
        retryable: false,
        scope: 'task',
      });
    }
  }

  async navigateAndExtract(request: WebcmdNavigationRequest): Promise<WebcmdNavigationResult> {
    // 1. Validate request schema
    const parseResult = webcmdNavigationRequestSchema.safeParse(request);
    if (!parseResult.success) {
      throw new KyrosError({
        category: 'input',
        code: 'INVALID_WEBCMD_REQUEST',
        safeMessage: 'Invalid Webcmd navigation parameters provided.',
        diagnosticContext: { issues: parseResult.error.issues },
        retryable: false,
        scope: 'task',
      });
    }

    const validRequest = parseResult.data;

    // 2. Enforce SSRF safety
    this.validateUrlSafety(validRequest.url);

    const startTime = Date.now();

    // 3. If API key is not configured, check if mock or fail gracefully
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      // In development / testing without live Webcmd service key, return minimal safe response if mock client provided, else error
      if (!(this.httpClient instanceof DefaultWebcmdHttpClient)) {
        // Mock client in tests will handle this
      } else {
        throw new KyrosError({
          category: 'acquisition',
          code: 'WEBCMD_API_KEY_MISSING',
          safeMessage: 'Webcmd API key is not configured.',
          retryable: false,
          scope: 'task',
        });
      }
    }

    const endpoint = `${this.baseUrl}/navigate`;

    let response: { status: number; statusText: string; data: unknown };
    try {
      response = await this.httpClient.post(
        endpoint,
        {
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        validRequest
      );
    } catch (networkErr) {
      throw new KyrosError({
        category: 'acquisition',
        code: 'WEBCMD_NETWORK_ERROR',
        safeMessage: 'Network error connecting to Webcmd browser navigation service.',
        diagnosticContext: {
          error: networkErr instanceof Error ? networkErr.message : String(networkErr),
        },
        retryable: true,
        scope: 'task',
      });
    }

    if (response.status >= 400) {
      throw new KyrosError({
        category: 'acquisition',
        code: 'WEBCMD_NAVIGATION_FAILED',
        safeMessage: `Webcmd navigation failed with status ${response.status}.`,
        diagnosticContext: { status: response.status, data: response.data },
        retryable: response.status >= 500 || response.status === 429,
        scope: 'task',
      });
    }

    const rawData = (response.data ?? {}) as Record<string, unknown>;
    const executionTimeMs = typeof rawData.executionTimeMs === 'number'
      ? rawData.executionTimeMs
      : Date.now() - startTime;

    return {
      url: typeof rawData.url === 'string' ? rawData.url : validRequest.url,
      title: typeof rawData.title === 'string' ? rawData.title : '',
      markdown: typeof rawData.markdown === 'string' ? rawData.markdown : '',
      html: typeof rawData.html === 'string' ? rawData.html : undefined,
      statusCode: typeof rawData.statusCode === 'number' ? rawData.statusCode : 200,
      executionTimeMs,
      screenshotUri: typeof rawData.screenshotUri === 'string' ? rawData.screenshotUri : undefined,
      metadata: typeof rawData.metadata === 'object' && rawData.metadata !== null
        ? (rawData.metadata as Record<string, unknown>)
        : undefined,
    };
  }
}
