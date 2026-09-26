import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ExaResearchProvider, type IExaHttpClient } from '../research/exa-provider';
import { KyrosError } from '../errors/kyros-error';

class MockExaHttpClient implements IExaHttpClient {
  public lastRequest: { url: string; headers: Record<string, string>; body: unknown } | null = null;
  public mockResponse: { status: number; statusText: string; data: unknown } = {
    status: 200,
    statusText: 'OK',
    data: {
      results: [
        {
          id: 'exa-123',
          url: 'https://example.com/article-1',
          title: 'AI Breakthroughs in 2026',
          author: 'Jane Doe',
          publishedDate: '2026-03-15T00:00:00.000Z',
          text: 'Autonomous agents have achieved massive reliability benchmarks.',
          highlights: ['Autonomous agents have achieved massive reliability'],
          summary: 'Overview of 2026 AI breakthroughs.',
          score: 0.95,
        },
      ],
      autopromptString: 'AI breakthroughs in 2026 research',
    },
  };

  async post(url: string, headers: Record<string, string>, body: unknown) {
    this.lastRequest = { url, headers, body };
    return this.mockResponse;
  }
}

describe('Exa Research Provider Adapter', () => {
  test('performs successful search and normalizes source results', async () => {
    const mockClient = new MockExaHttpClient();
    const provider = new ExaResearchProvider({
      apiKey: 'test-exa-key',
      httpClient: mockClient,
    });

    const response = await provider.search({
      query: 'AI agents 2026',
      numResults: 5,
    });

    assert.equal(response.query, 'AI agents 2026');
    assert.equal(response.results.length, 1);
    const first = response.results[0];
    assert.equal(first.id, 'exa-123');
    assert.equal(first.url, 'https://example.com/article-1');
    assert.equal(first.title, 'AI Breakthroughs in 2026');
    assert.equal(first.author, 'Jane Doe');
    assert.equal(first.text, 'Autonomous agents have achieved massive reliability benchmarks.');
    assert.equal(first.score, 0.95);

    // Verify request payload sent to Exa
    assert.ok(mockClient.lastRequest);
    assert.equal(mockClient.lastRequest.headers['x-api-key'], 'test-exa-key');
    const body = mockClient.lastRequest.body as Record<string, unknown>;
    assert.equal(body.query, 'AI agents 2026');
    assert.equal(body.numResults, 5);
  });

  test('handles clean empty results without error', async () => {
    const mockClient = new MockExaHttpClient();
    mockClient.mockResponse = {
      status: 200,
      statusText: 'OK',
      data: { results: [] },
    };

    const provider = new ExaResearchProvider({
      apiKey: 'test-exa-key',
      httpClient: mockClient,
    });

    const response = await provider.search({
      query: 'obscure query with no results',
    });

    assert.equal(response.results.length, 0);
    assert.equal(response.totalResults, 0);
  });

  test('throws KyrosError when API key is missing', async () => {
    const provider = new ExaResearchProvider({
      apiKey: '',
      httpClient: new MockExaHttpClient(),
    });

    await assert.rejects(
      async () => provider.search({ query: 'test' }),
      (err: unknown) => {
        assert.ok(err instanceof KyrosError);
        assert.equal(err.category, 'acquisition');
        assert.equal(err.code, 'EXA_API_KEY_MISSING');
        return true;
      }
    );
  });

  test('throws normalized KyrosError on 401/403 authentication failure', async () => {
    const mockClient = new MockExaHttpClient();
    mockClient.mockResponse = {
      status: 401,
      statusText: 'Unauthorized',
      data: { error: 'Invalid API key' },
    };

    const provider = new ExaResearchProvider({
      apiKey: 'bad-key',
      httpClient: mockClient,
    });

    await assert.rejects(
      async () => provider.search({ query: 'test' }),
      (err: unknown) => {
        assert.ok(err instanceof KyrosError);
        assert.equal(err.category, 'acquisition');
        assert.equal(err.code, 'EXA_AUTH_FAILED');
        assert.equal(err.retryable, false);
        return true;
      }
    );
  });

  test('throws normalized retryable KyrosError on 429 rate limit', async () => {
    const mockClient = new MockExaHttpClient();
    mockClient.mockResponse = {
      status: 429,
      statusText: 'Too Many Requests',
      data: { error: 'Rate limit exceeded' },
    };

    const provider = new ExaResearchProvider({
      apiKey: 'test-key',
      httpClient: mockClient,
    });

    await assert.rejects(
      async () => provider.search({ query: 'test' }),
      (err: unknown) => {
        assert.ok(err instanceof KyrosError);
        assert.equal(err.category, 'provider/rate-limit');
        assert.equal(err.code, 'EXA_RATE_LIMIT');
        assert.equal(err.retryable, true);
        return true;
      }
    );
  });

  test('throws normalized retryable KyrosError on 500 server error', async () => {
    const mockClient = new MockExaHttpClient();
    mockClient.mockResponse = {
      status: 500,
      statusText: 'Internal Server Error',
      data: { error: 'Server crashed' },
    };

    const provider = new ExaResearchProvider({
      apiKey: 'test-key',
      httpClient: mockClient,
    });

    await assert.rejects(
      async () => provider.search({ query: 'test' }),
      (err: unknown) => {
        assert.ok(err instanceof KyrosError);
        assert.equal(err.category, 'acquisition');
        assert.equal(err.code, 'EXA_SERVICE_ERROR');
        assert.equal(err.retryable, true);
        return true;
      }
    );
  });
});
