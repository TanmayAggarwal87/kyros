import { KyrosError } from '../errors/kyros-error';
import {
  type IResearchProvider,
  type ResearchRequest,
  type ResearchResponse,
  type ResearchSourceResult,
  researchRequestSchema,
} from '../contracts/research';

export interface IExaHttpClient {
  post(url: string, headers: Record<string, string>, body: unknown): Promise<{
    status: number;
    statusText: string;
    data: unknown;
  }>;
}

export class DefaultExaHttpClient implements IExaHttpClient {
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

export interface ExaProviderOptions {
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly httpClient?: IExaHttpClient;
}

interface RawExaResultItem {
  id?: string;
  url?: string;
  title?: string;
  author?: string;
  publishedDate?: string;
  text?: string;
  highlights?: string[];
  highlightScores?: number[];
  summary?: string;
  score?: number;
  [key: string]: unknown;
}

interface RawExaSearchResponse {
  results?: RawExaResultItem[];
  autopromptString?: string;
  resolvedSearchType?: string;
  [key: string]: unknown;
}

export class ExaResearchProvider implements IResearchProvider {
  readonly name = 'exa';
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly httpClient: IExaHttpClient;

  constructor(options: ExaProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.EXA_API_KEY;
    this.baseUrl = (options.baseUrl ?? 'https://api.exa.ai').replace(/\/+$/, '');
    this.httpClient = options.httpClient ?? new DefaultExaHttpClient();
  }

  async search(request: ResearchRequest): Promise<ResearchResponse> {
    // 1. Validate request parameters
    const parseResult = researchRequestSchema.safeParse(request);
    if (!parseResult.success) {
      throw new KyrosError({
        category: 'input',
        code: 'INVALID_RESEARCH_REQUEST',
        safeMessage: 'Invalid research search parameters provided.',
        diagnosticContext: { issues: parseResult.error.issues },
        retryable: false,
        scope: 'task',
      });
    }

    const validRequest = parseResult.data;

    // 2. Validate API key presence
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new KyrosError({
        category: 'acquisition',
        code: 'EXA_API_KEY_MISSING',
        safeMessage: 'Exa API key is not configured. Research queries cannot be performed.',
        retryable: false,
        scope: 'task',
      });
    }

    // 3. Construct Exa API payload
    const payload: Record<string, unknown> = {
      query: validRequest.query,
      numResults: validRequest.numResults ?? 10,
      useAutoprompt: validRequest.useAutoprompt ?? true,
      type: validRequest.type ?? 'auto',
    };

    if (validRequest.includeDomains && validRequest.includeDomains.length > 0) {
      payload.includeDomains = validRequest.includeDomains;
    }
    if (validRequest.excludeDomains && validRequest.excludeDomains.length > 0) {
      payload.excludeDomains = validRequest.excludeDomains;
    }
    if (validRequest.startPublishedDate) {
      payload.startPublishedDate = validRequest.startPublishedDate;
    }
    if (validRequest.endPublishedDate) {
      payload.endPublishedDate = validRequest.endPublishedDate;
    }

    // Default contents extraction parameters: retrieve text snippets and highlights
    payload.contents = {
      text: typeof validRequest.contents?.text === 'object'
        ? validRequest.contents.text
        : { maxCharacters: 4000 },
      highlights: validRequest.contents?.highlights ?? true,
      summary: validRequest.contents?.summary ?? false,
    };

    const endpoint = `${this.baseUrl}/search`;

    // 4. Execute HTTP request via pluggable client
    let response: { status: number; statusText: string; data: unknown };
    try {
      response = await this.httpClient.post(
        endpoint,
        {
          'x-api-key': this.apiKey,
        },
        payload
      );
    } catch (networkErr) {
      throw new KyrosError({
        category: 'acquisition',
        code: 'EXA_NETWORK_ERROR',
        safeMessage: 'Network error connecting to Exa research service.',
        diagnosticContext: {
          error: networkErr instanceof Error ? networkErr.message : String(networkErr),
        },
        retryable: true,
        scope: 'task',
      });
    }

    // 5. Handle HTTP status codes
    if (response.status === 401 || response.status === 403) {
      throw new KyrosError({
        category: 'acquisition',
        code: 'EXA_AUTH_FAILED',
        safeMessage: 'Exa research authentication failed. Check API key configuration.',
        diagnosticContext: { status: response.status },
        retryable: false,
        scope: 'task',
      });
    }

    if (response.status === 429) {
      throw new KyrosError({
        category: 'provider/rate-limit',
        code: 'EXA_RATE_LIMIT',
        safeMessage: 'Exa research rate limit exceeded. Please retry later.',
        diagnosticContext: { status: response.status },
        retryable: true,
        scope: 'task',
      });
    }

    if (response.status >= 500) {
      throw new KyrosError({
        category: 'acquisition',
        code: 'EXA_SERVICE_ERROR',
        safeMessage: 'Exa research service returned a server error.',
        diagnosticContext: { status: response.status, statusText: response.statusText },
        retryable: true,
        scope: 'task',
      });
    }

    if (response.status >= 400) {
      throw new KyrosError({
        category: 'acquisition',
        code: 'EXA_REQUEST_ERROR',
        safeMessage: `Exa search failed with status ${response.status}.`,
        diagnosticContext: { status: response.status, data: response.data },
        retryable: false,
        scope: 'task',
      });
    }

    // 6. Normalize Exa response into Kyros domain models
    const rawData = response.data as RawExaSearchResponse;
    const rawResults = Array.isArray(rawData?.results) ? rawData.results : [];

    const normalizedResults: ResearchSourceResult[] = rawResults
      .filter((item): item is RawExaResultItem => Boolean(item && typeof item === 'object' && item.url))
      .map((item, index) => {
        const id = item.id || `exa-src-${Date.now()}-${index}`;
        const url = String(item.url).trim();
        const title = item.title ? String(item.title).trim() : undefined;
        const author = item.author ? String(item.author).trim() : undefined;
        const publishedDate = item.publishedDate ? String(item.publishedDate).trim() : undefined;
        const text = typeof item.text === 'string' ? item.text.trim() : undefined;
        const highlights = Array.isArray(item.highlights)
          ? item.highlights.map((h) => String(h).trim()).filter((h) => h.length > 0)
          : undefined;
        const summary = typeof item.summary === 'string' ? item.summary.trim() : undefined;
        const score = typeof item.score === 'number' ? item.score : undefined;

        const knownKeys = new Set(['id', 'url', 'title', 'author', 'publishedDate', 'text', 'highlights', 'summary', 'score']);
        const restMetadata: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(item)) {
          if (!knownKeys.has(k)) {
            restMetadata[k] = v;
          }
        }

        return {
          id,
          url,
          title,
          author,
          publishedDate,
          text,
          highlights,
          summary,
          score,
          rawMetadata: Object.keys(restMetadata).length > 0 ? restMetadata : undefined,
        };
      });

    return {
      query: validRequest.query,
      results: normalizedResults,
      autopromptString: typeof rawData.autopromptString === 'string' ? rawData.autopromptString : undefined,
      totalResults: normalizedResults.length,
    };
  }
}
