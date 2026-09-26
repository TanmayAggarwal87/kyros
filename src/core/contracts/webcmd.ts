import { z } from 'zod';

export interface WebcmdNavigationAction {
  readonly type: 'click' | 'type' | 'scroll' | 'wait' | 'select';
  readonly selector?: string;
  readonly value?: string;
  readonly timeoutMs?: number;
}

export interface WebcmdNavigationRequest {
  readonly url: string;
  readonly objective?: string;
  readonly actions?: readonly WebcmdNavigationAction[];
  readonly waitForSelector?: string;
  readonly timeoutMs?: number;
  readonly extractHtml?: boolean;
  readonly extractMarkdown?: boolean;
}

export interface WebcmdNavigationResult {
  readonly url: string;
  readonly title: string;
  readonly markdown: string;
  readonly html?: string;
  readonly statusCode: number;
  readonly executionTimeMs: number;
  readonly screenshotUri?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface IWebcmdProvider {
  readonly name: string;
  navigateAndExtract(request: WebcmdNavigationRequest): Promise<WebcmdNavigationResult>;
}

export const webcmdNavigationActionSchema = z.object({
  type: z.enum(['click', 'type', 'scroll', 'wait', 'select']),
  selector: z.string().optional(),
  value: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
});

export const webcmdNavigationRequestSchema = z.object({
  url: z.string().url(),
  objective: z.string().optional(),
  actions: z.array(webcmdNavigationActionSchema).optional(),
  waitForSelector: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
  extractHtml: z.boolean().optional(),
  extractMarkdown: z.boolean().optional(),
});

export const webcmdNavigationResultSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  markdown: z.string(),
  html: z.string().optional(),
  statusCode: z.number().int(),
  executionTimeMs: z.number().nonnegative(),
  screenshotUri: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
