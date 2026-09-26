import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { WebcmdProvider, type IWebcmdHttpClient } from '../research/webcmd-provider';
import { KyrosError } from '../errors/kyros-error';

class MockWebcmdHttpClient implements IWebcmdHttpClient {
  async post(url: string, headers: Record<string, string>, body: unknown) {
    return {
      status: 200,
      statusText: 'OK',
      data: {
        url: (body as { url: string }).url,
        title: 'Rendered SPA Application',
        markdown: '# SPA Content\n\nInteractive application loaded successfully.',
        statusCode: 200,
        executionTimeMs: 450,
      },
    };
  }
}

describe('Webcmd Provider Adapter & SSRF Protection', () => {
  const provider = new WebcmdProvider({
    apiKey: 'test-webcmd-key',
    httpClient: new MockWebcmdHttpClient(),
  });

  test('successfully navigates and extracts markdown from public URL', async () => {
    const result = await provider.navigateAndExtract({
      url: 'https://example.com/app',
      objective: 'Extract company details from dynamic dashboard',
    });

    assert.equal(result.url, 'https://example.com/app');
    assert.equal(result.title, 'Rendered SPA Application');
    assert.ok(result.markdown.includes('Interactive application loaded successfully.'));
    assert.equal(result.statusCode, 200);
  });

  test('blocks SSRF attempts to localhost and private networks', async () => {
    const dangerousUrls = [
      'http://localhost:3000/admin',
      'http://127.0.0.1/secrets',
      'http://10.0.0.1/internal-api',
      'http://192.168.1.1/router',
      'http://169.254.169.254/latest/meta-data/',
      'http://metadata.google.internal/computeMetadata/v1/',
    ];

    for (const url of dangerousUrls) {
      await assert.rejects(
        async () => provider.navigateAndExtract({ url }),
        (err: unknown) => {
          assert.ok(err instanceof KyrosError);
          assert.equal(err.category, 'acquisition');
          assert.equal(err.code, 'SSRF_BLOCKED');
          return true;
        }
      );
    }
  });

  test('blocks invalid URL schemes like javascript: and file:', async () => {
    const invalidSchemeUrls = [
      'javascript:alert(1)',
      'file:///etc/passwd',
      'data:text/html,<h1>Hello</h1>',
    ];

    for (const url of invalidSchemeUrls) {
      await assert.rejects(
        async () => provider.navigateAndExtract({ url }),
        (err: unknown) => {
          assert.ok(err instanceof KyrosError);
          assert.equal(err.category, 'input');
          return true;
        }
      );
    }
  });
});
