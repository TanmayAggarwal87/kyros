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
