import test from 'node:test';
import assert from 'node:assert/strict';
import { GeminiRetryPolicy, type Sleeper, type RetryAttemptLog } from '../ai/retry-policy';
import { DomainRetryPolicy } from '../retry/domain-retry';
import { KyrosError } from '../errors/kyros-error';
import type { Task } from '../contracts/task';

// Fake sleeper that records delays without real waiting
class MockSleeper implements Sleeper {
  readonly delays: number[] = [];

  async sleep(ms: number): Promise<void> {
    this.delays.push(ms);
  }
}

test('13. Gemini infrastructure retry policy (30s and 90s delays)', async () => {
  const sleeper = new MockSleeper();
  const policy = new GeminiRetryPolicy({
    maxAttempts: 3,
    retryDelaysMs: [30_000, 90_000],
    sleeper,
  });

  const retryLogs: RetryAttemptLog[] = [];
  let calls = 0;

  // Fails on attempt 1 and 2, succeeds on attempt 3
  const result = await policy.execute(
    async (attempt) => {
      calls++;
      if (attempt < 3) {
        throw new Error(`Transient failure ${attempt}`);
      }
      return 'success';
    },
    (log) => retryLogs.push(log)
  );

  assert.equal(result, 'success');
  assert.equal(calls, 3);
  // Delays must be exactly 30000ms before call 2, 90000ms before call 3
  assert.deepEqual(sleeper.delays, [30_000, 90_000]);
  assert.equal(retryLogs.length, 2);
  assert.equal(retryLogs[0].attemptNumber, 2);
  assert.equal(retryLogs[0].delayMsBeforeAttempt, 30_000);
  assert.equal(retryLogs[1].attemptNumber, 3);
  assert.equal(retryLogs[1].delayMsBeforeAttempt, 90_000);
});

test('14. Gemini retry exhaustion fails on 3rd failure with safe busy message', async () => {
  const sleeper = new MockSleeper();
  const policy = new GeminiRetryPolicy({
    maxAttempts: 3,
    retryDelaysMs: [30_000, 90_000],
    sleeper,
  });

  let calls = 0;

  await assert.rejects(
    async () => {
      await policy.execute(async () => {
        calls++;
        throw new Error('Persistent 429 rate limit');
      });
    },
    (err: unknown) => {
      assert(err instanceof KyrosError);
      assert.equal(err.category, 'provider/rate-limit');
      assert.equal(err.code, 'GEMINI_SERVER_BUSY');
      // Must match exact documented message: "Gemini server is busy. Please try again later."
      assert.equal(err.safeMessage, 'Gemini server is busy. Please try again later.');
      assert.equal(err.retryable, false);
      return true;
    }
  );

  assert.equal(calls, 3);
  assert.deepEqual(sleeper.delays, [30_000, 90_000]);
});

test('12. Domain retry limits (capped at 3 attempts)', () => {
  const domainPolicy = new DomainRetryPolicy({ maxDomainAttempts: 3 });

  const dummyTask: Task = {
    id: 't-search',
    runId: 'r-1',
    workflowId: 'wf-1',
    type: 'discovery',
    status: 'running',
    name: 'Search',
    dependencies: [],
    completionPolicy: 'all_succeeded',
    input: {},
    outputArtifacts: [],
    attemptCounts: { domain: 0, infrastructure: 0 },
    timestamps: { createdAt: '', updatedAt: '' },
  };

  // Attempt 1: domain attempts 0 -> retry eligible (next: 1)
  const d1 = domainPolicy.evaluate(dummyTask);
  assert.equal(d1.shouldRetry, true);
  assert.equal(d1.nextAttemptNumber, 1);

  // Attempt 2: domain attempts 1 -> retry eligible (next: 2)
  const taskAttempt1 = { ...dummyTask, attemptCounts: { domain: 1, infrastructure: 0 } };
  const d2 = domainPolicy.evaluate(taskAttempt1);
  assert.equal(d2.shouldRetry, true);
  assert.equal(d2.nextAttemptNumber, 2);

  // Attempt 3: domain attempts 2 -> retry eligible (next: 3)
  const taskAttempt2 = { ...dummyTask, attemptCounts: { domain: 2, infrastructure: 0 } };
  const d3 = domainPolicy.evaluate(taskAttempt2);
  assert.equal(d3.shouldRetry, true);
  assert.equal(d3.nextAttemptNumber, 3);

  // Exhausted: domain attempts 3 -> NOT eligible
  const taskAttempt3 = { ...dummyTask, attemptCounts: { domain: 3, infrastructure: 0 } };
  const d4 = domainPolicy.evaluate(taskAttempt3);
  assert.equal(d4.shouldRetry, false);
  assert.match(d4.reason ?? '', /limit of 3 attempts exhausted/i);
});
