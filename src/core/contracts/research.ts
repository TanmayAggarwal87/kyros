import { z } from 'zod';

export interface ResearchRequest {
  readonly query: string;
  readonly numResults?: number;
  readonly includeDomains?: readonly string[];
  readonly excludeDomains?: readonly string[];
  readonly startPublishedDate?: string;
  readonly endPublishedDate?: string;
  readonly useAutoprompt?: boolean;
  readonly type?: 'keyword' | 'neural' | 'auto';
  readonly contents?: {
    readonly text?: boolean | { readonly maxCharacters?: number };
    readonly highlights?: boolean;
    readonly summary?: boolean;
  };
}

export interface ResearchSourceResult {
  readonly id: string;
  readonly url: string;
  readonly title?: string;
  readonly author?: string;
  readonly publishedDate?: string;
  readonly text?: string;
  readonly highlights?: readonly string[];
  readonly summary?: string;
  readonly score?: number;
  readonly rawMetadata?: Record<string, unknown>;
}

export interface ResearchResponse {
  readonly query: string;
  readonly results: readonly ResearchSourceResult[];
  readonly autopromptString?: string;
  readonly totalResults?: number;
}

export interface IResearchProvider {
  readonly name: string;
  search(request: ResearchRequest): Promise<ResearchResponse>;
}

export const researchRequestSchema = z.object({
  query: z.string().min(1, 'Search query cannot be empty'),
  numResults: z.number().int().positive().max(100).optional(),
  includeDomains: z.array(z.string()).optional(),
  excludeDomains: z.array(z.string()).optional(),
  startPublishedDate: z.string().optional(),
  endPublishedDate: z.string().optional(),
  useAutoprompt: z.boolean().optional(),
  type: z.enum(['keyword', 'neural', 'auto']).optional(),
  contents: z
    .object({
      text: z.union([z.boolean(), z.object({ maxCharacters: z.number().int().positive().optional() })]).optional(),
      highlights: z.boolean().optional(),
      summary: z.boolean().optional(),
    })
    .optional(),
});

export const researchSourceResultSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  title: z.string().optional(),
  author: z.string().optional(),
  publishedDate: z.string().optional(),
  text: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  summary: z.string().optional(),
  score: z.number().optional(),
  rawMetadata: z.record(z.string(), z.unknown()).optional(),
});

export const researchResponseSchema = z.object({
  query: z.string(),
  results: z.array(researchSourceResultSchema),
  autopromptString: z.string().optional(),
  totalResults: z.number().int().nonnegative().optional(),
});
