export * from './exa-discovery-handler';
export * from './webcmd-navigation-handler';
export * from './gemini-extraction-handler';
export * from './quality-validation-handler';
export * from './deduplication-handler';

import { TaskHandlerRegistry } from '../handler';
import { ExaDiscoveryHandler, type ExaDiscoveryHandlerOptions } from './exa-discovery-handler';
import { WebcmdNavigationHandler, type WebcmdNavigationHandlerOptions } from './webcmd-navigation-handler';
import { GeminiExtractionHandler, type GeminiExtractionHandlerOptions } from './gemini-extraction-handler';
import { QualityValidationHandler, type QualityValidationHandlerOptions } from './quality-validation-handler';
import { DeduplicationHandler, type DeduplicationHandlerOptions } from './deduplication-handler';
import type { IWorkflowRepository } from '../../persistence/repository';
import type { IArtifactStore } from '../../research/artifacts-store';
import { InMemoryArtifactStore } from '../../research/artifacts-store';
import type { IResearchProvider } from '../../contracts/research';
import { ExaResearchProvider } from '../../research/exa-provider';
import type { IGeminiGateway } from '../../ai/gateway';
import { GeminiGateway } from '../../ai/gateway';
import { GeminiExtractor, type IExtractionService } from '../../extraction/gemini-extractor';
import type { IWebcmdProvider } from '../../contracts/webcmd';
import { WebcmdProvider } from '../../research/webcmd-provider';

export interface StandardHandlersConfig {
  readonly discovery?: ExaDiscoveryHandlerOptions;
  readonly browserNavigation?: WebcmdNavigationHandlerOptions;
  readonly extraction?: GeminiExtractionHandlerOptions;
  readonly validation?: QualityValidationHandlerOptions;
  readonly deduplication?: DeduplicationHandlerOptions;
}

export function registerStandardHandlers(
  registry: TaskHandlerRegistry,
  config: StandardHandlersConfig
): void {
  if (config.discovery) {
    registry.register(new ExaDiscoveryHandler(config.discovery));
  }
  if (config.browserNavigation) {
    registry.register(new WebcmdNavigationHandler(config.browserNavigation));
  }
  if (config.extraction) {
    registry.register(new GeminiExtractionHandler(config.extraction));
  }
  if (config.validation) {
    registry.register(new QualityValidationHandler(config.validation));
  }
  if (config.deduplication) {
    registry.register(new DeduplicationHandler(config.deduplication));
  }
}

export function createStandardHandlerRegistry(options?: {
  repository?: IWorkflowRepository;
  artifactStore?: IArtifactStore;
  researchProvider?: IResearchProvider;
  geminiGateway?: IGeminiGateway;
  webcmdProvider?: IWebcmdProvider;
  extractionService?: IExtractionService;
}): TaskHandlerRegistry {
  const artifactStore = options?.artifactStore ?? new InMemoryArtifactStore();
  const researchProvider = options?.researchProvider ?? new ExaResearchProvider();
  const extractor =
    options?.extractionService ??
    new GeminiExtractor(options?.geminiGateway ?? GeminiGateway.fromEnvironment());
  const webcmdProvider = options?.webcmdProvider ?? new WebcmdProvider();

  const registry = new TaskHandlerRegistry();
  registerStandardHandlers(registry, {
    discovery: { researchProvider, artifactStore },
    browserNavigation: { webcmdProvider, artifactStore },
    extraction: { extractionService: extractor, artifactStore },
    validation: { repository: options?.repository },
    deduplication: { repository: options?.repository },
  });

  return registry;
}

