import type { ITaskHandler, TaskExecutionContext, TaskExecutionResult } from '../handler';
import type { TaskType, TaskArtifactReference } from '../../contracts/task';
import type { IResearchProvider } from '../../contracts/research';
import type { IArtifactStore } from '../../research/artifacts-store';
import type { SourceArtifact, ContentArtifact } from '../../contracts/artifacts';
import { KyrosError } from '../../errors/kyros-error';

export interface ExaDiscoveryHandlerOptions {
  readonly researchProvider: IResearchProvider;
  readonly artifactStore: IArtifactStore;
}

export class ExaDiscoveryHandler implements ITaskHandler {
  readonly taskType: TaskType = 'discovery';
  private readonly researchProvider: IResearchProvider;
  private readonly artifactStore: IArtifactStore;

  constructor(options: ExaDiscoveryHandlerOptions) {
    this.researchProvider = options.researchProvider;
    this.artifactStore = options.artifactStore;
  }

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    const input = context.task.input as Record<string, unknown>;
    const query = typeof input.query === 'string' ? input.query : '';

    if (!query || query.trim().length === 0) {
      return {
        status: 'failed',
        error: KyrosError.invalidInput('Discovery task requires a non-empty "query" input parameter.'),
      };
    }

    const numResults = typeof input.numResults === 'number' ? input.numResults : 10;
    const includeDomains = Array.isArray(input.includeDomains) ? (input.includeDomains as string[]) : undefined;
    const excludeDomains = Array.isArray(input.excludeDomains) ? (input.excludeDomains as string[]) : undefined;

    try {
      const searchResponse = await this.researchProvider.search({
        query,
        numResults,
        includeDomains,
        excludeDomains,
        contents: {
          text: { maxCharacters: 5000 },
          highlights: true,
          summary: true,
        },
      });

      // If zero results and domain retry is possible, trigger retry_domain
      if (searchResponse.results.length === 0) {
        return {
          status: 'retry_domain',
          refinedInput: {
            query: `${query} news overview database`,
          },
          error: new KyrosError({
            category: 'acquisition',
            code: 'EXA_ZERO_RESULTS',
            safeMessage: `No results returned from Exa for query "${query}". Requesting query refinement.`,
            retryable: true,
            scope: 'task',
          }),
        };
      }

      const now = new Date().toISOString();
      const outputArtifacts: TaskArtifactReference[] = [];

      for (let i = 0; i < searchResponse.results.length; i++) {
        const item = searchResponse.results[i];
        const sourceId = `src-${context.task.id}-${i + 1}`;
        const contentText = item.text || item.summary || (item.highlights ? item.highlights.join('\n\n') : '');

        const sourceArt: SourceArtifact = {
          id: sourceId,
          workflowId: context.workflow.id,
          runId: context.workflow.runId,
          taskId: context.task.id,
          url: item.url,
          title: item.title,
          author: item.author,
          publishedDate: item.publishedDate,
          retrievedAt: now,
          query,
          acquisitionMethod: 'exa_search',
          score: item.score,
          metadata: item.rawMetadata,
        };

        const contentArt: ContentArtifact = {
          id: `cnt-${sourceId}`,
          sourceId,
          url: item.url,
          mimeType: 'text/plain',
          text: contentText,
          highlights: item.highlights,
          summary: item.summary,
          byteSize: Buffer.byteLength(contentText, 'utf8'),
          extractedAt: now,
        };

        await this.artifactStore.saveSourceArtifact(sourceArt);
        await this.artifactStore.saveContentArtifact(contentArt);

        outputArtifacts.push(this.artifactStore.toTaskArtifactReference(sourceArt));
        outputArtifacts.push(this.artifactStore.toTaskArtifactReference(contentArt));
      }

      return {
        status: 'succeeded',
        outputData: {
          totalResults: searchResponse.results.length,
          query,
        },
        outputArtifacts,
      };
    } catch (err) {
      const kyrosErr = KyrosError.fromUnknown(err, 'acquisition', 'task');
      return {
        status: 'failed',
        error: kyrosErr,
      };
    }
  }
}
