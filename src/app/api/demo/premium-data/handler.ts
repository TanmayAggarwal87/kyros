import { NextResponse, type NextRequest } from 'next/server';
import { withX402 } from '@x402/next';
import { HTTPFacilitatorClient, x402ResourceServer } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { isAddress, type Address } from 'viem';

export interface DemoPremiumConfig {
  readonly facilitatorUrl: string;
  readonly payTo: Address;
}

export function readDemoPremiumConfig(env: Record<string, string | undefined> = process.env): DemoPremiumConfig | null {
  const url = env.X402_FACILITATOR_URL ?? env.X402_PAYMENT_FACILITATOR_URL;
  const payTo = env.X402_PAYEE_ADDRESS;
  if (!url || !payTo || !isAddress(payTo)) return null;
  try {
    if (new URL(url).protocol !== 'https:') return null;
  } catch { return null; }
  return { facilitatorUrl: url, payTo };
}

export function createDemoPremiumRoute(config: DemoPremiumConfig) {
  const facilitator = new HTTPFacilitatorClient({ url: config.facilitatorUrl, timeoutMs: 10000 });
  const server = new x402ResourceServer(facilitator).register('eip155:84532', new ExactEvmScheme());
  return withX402(
    async (_request: NextRequest) => {
      void _request;
      return NextResponse.json({
        dataKind: 'synthetic-demo',
        data: [{ company: 'Example Robotics', note: 'Synthetic record for the x402 settlement demonstration' }],
      });
    },
    {
      accepts: [{ scheme: 'exact', price: '$0.02', network: 'eip155:84532', payTo: config.payTo }],
      description: 'Synthetic premium research record demonstrating Base Sepolia x402 settlement',
      mimeType: 'application/json',
    },
    server,
  );
}
