import type { ITaskHandler, TaskExecutionContext, TaskExecutionResult } from '../handler';
import type { TaskType, TaskArtifactReference } from '../../contracts/task';
import type { IWebcmdProvider } from '../../contracts/webcmd';
import type { IArtifactStore } from '../../research/artifacts-store';
import type { SourceArtifact, ContentArtifact } from '../../contracts/artifacts';
import { KyrosError } from '../../errors/kyros-error';

export interface WebcmdNavigationHandlerOptions {
  readonly webcmdProvider: IWebcmdProvider;
  readonly artifactStore: IArtifactStore;
}

export class WebcmdNavigationHandler implements ITaskHandler {
  readonly taskType: TaskType = 'browser_navigation';
  private readonly webcmdProvider: IWebcmdProvider;
  private readonly artifactStore: IArtifactStore;

  constructor(options: WebcmdNavigationHandlerOptions) {
    this.webcmdProvider = options.webcmdProvider;
    this.artifactStore = options.artifactStore;
  }

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    const input = context.task.input as Record<string, unknown>;
    const url = typeof input.url === 'string' ? input.url : '';

    if (!url || url.trim().length === 0) {
      return {
        status: 'failed',
        error: KyrosError.invalidInput('Browser navigation task requires a non-empty "url" input parameter.'),
      };
    }

    try {
      const result = await this.webcmdProvider.navigateAndExtract({
        url,
        objective: typeof input.objective === 'string' ? input.objective : undefined,
        extractMarkdown: true,
      });

      const now = new Date().toISOString();
      const sourceId = `src-${context.task.id}-webcmd`;

      const sourceArt: SourceArtifact = {
        id: sourceId,
        workflowId: context.workflow.id,
        runId: context.workflow.runId,
        taskId: context.task.id,
        url: result.url,
        title: result.title,
        retrievedAt: now,
        acquisitionMethod: 'webcmd_browser',
        metadata: {
          statusCode: result.statusCode,
          executionTimeMs: result.executionTimeMs,
          screenshotUri: result.screenshotUri,
        },
      };

      const contentArt: ContentArtifact = {
        id: `cnt-${sourceId}`,
        sourceId,
        url: result.url,
        mimeType: 'text/markdown',
        text: result.markdown,
        byteSize: Buffer.byteLength(result.markdown, 'utf8'),
        extractedAt: now,
      };

      await this.artifactStore.saveSourceArtifact(sourceArt);
      await this.artifactStore.saveContentArtifact(contentArt);

      const outputArtifacts: TaskArtifactReference[] = [
        this.artifactStore.toTaskArtifactReference(sourceArt),
        this.artifactStore.toTaskArtifactReference(contentArt),
      ];

      return {
        status: 'succeeded',
        outputData: {
          url: result.url,
          title: result.title,
          statusCode: result.statusCode,
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
