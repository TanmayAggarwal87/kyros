import { z } from 'zod';
import { KyrosError } from '../errors/kyros-error';

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLERK_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  TREASURY_PRIVATE_KEY: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, 'TREASURY_PRIVATE_KEY must be a 64-character hex string starting with 0x')
    .optional(),
  BASE_SEPOLIA_RPC_URL: z.string().url().default('https://sepolia.base.org'),
  BASE_SEPOLIA_CHAIN_ID: z.number().int().default(84532),
  X402_PAYMENT_FACILITATOR_URL: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

export function validateServerEnv(rawEnv: Record<string, unknown> = process.env): ServerEnv {
  const result = serverEnvSchema.safeParse(rawEnv);
  if (!result.success) {
    const issues = result.error.issues ?? [];
    const errorDetails = issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new KyrosError({
      category: 'input',
      code: 'INVALID_CONFIG',
      safeMessage: `Invalid server environment configuration: ${errorDetails}`,
      retryable: false,
      scope: 'workflow',
      diagnosticContext: { errors: issues },
    });
  }
  return result.data;
}

export function getServerEnv(): ServerEnv {
  if (!cachedEnv) {
    cachedEnv = validateServerEnv(process.env);
  }
  return cachedEnv;
}
