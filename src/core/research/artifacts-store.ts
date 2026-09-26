import type { SourceArtifact, ContentArtifact } from '../contracts/artifacts';
import type { TaskArtifactReference } from '../contracts/task';

export interface IArtifactStore {
  saveSourceArtifact(artifact: SourceArtifact): Promise<void>;
  getSourceArtifact(id: string): Promise<SourceArtifact | null>;
  listSourceArtifacts(workflowId: string, runId?: string): Promise<readonly SourceArtifact[]>;

  saveContentArtifact(artifact: ContentArtifact): Promise<void>;
  getContentArtifact(id: string): Promise<ContentArtifact | null>;
  getContentArtifactBySourceId(sourceId: string): Promise<ContentArtifact | null>;

  toTaskArtifactReference(artifact: SourceArtifact | ContentArtifact): TaskArtifactReference;
}

export class InMemoryArtifactStore implements IArtifactStore {
  private readonly sources = new Map<string, SourceArtifact>();
  private readonly contents = new Map<string, ContentArtifact>();
  private readonly sourceToContent = new Map<string, string>();

  async saveSourceArtifact(artifact: SourceArtifact): Promise<void> {
    this.sources.set(artifact.id, artifact);
  }

  async getSourceArtifact(id: string): Promise<SourceArtifact | null> {
    return this.sources.get(id) ?? null;
  }

  async listSourceArtifacts(workflowId: string, runId?: string): Promise<readonly SourceArtifact[]> {
    const list: SourceArtifact[] = [];
    for (const source of this.sources.values()) {
      if (source.workflowId === workflowId) {
        if (!runId || source.runId === runId) {
          list.push(source);
        }
      }
    }
    return list;
  }

  async saveContentArtifact(artifact: ContentArtifact): Promise<void> {
    this.contents.set(artifact.id, artifact);
    this.sourceToContent.set(artifact.sourceId, artifact.id);
  }

  async getContentArtifact(id: string): Promise<ContentArtifact | null> {
    return this.contents.get(id) ?? null;
  }

  async getContentArtifactBySourceId(sourceId: string): Promise<ContentArtifact | null> {
    const contentId = this.sourceToContent.get(sourceId);
    if (!contentId) return null;
    return this.contents.get(contentId) ?? null;
  }

  toTaskArtifactReference(artifact: SourceArtifact | ContentArtifact): TaskArtifactReference {
    if ('retrievedAt' in artifact) {
      // SourceArtifact
      return {
        id: artifact.id,
        type: 'source',
        uri: `artifact://source/${artifact.id}`,
        mimeType: 'application/json',
        metadata: {
          url: artifact.url,
          title: artifact.title,
          acquisitionMethod: artifact.acquisitionMethod,
          retrievedAt: artifact.retrievedAt,
          query: artifact.query,
        },
      };
    } else {
      // ContentArtifact
      return {
        id: artifact.id,
        type: 'content',
        uri: `artifact://content/${artifact.id}`,
        mimeType: artifact.mimeType,
        sizeBytes: artifact.byteSize,
        metadata: {
          sourceId: artifact.sourceId,
          url: artifact.url,
          extractedAt: artifact.extractedAt,
        },
      };
    }
  }
}
