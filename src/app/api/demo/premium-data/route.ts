import { NextResponse, type NextRequest } from 'next/server';
import { createDemoPremiumRoute, readDemoPremiumConfig } from './handler';

let paidHandler: ReturnType<typeof createDemoPremiumRoute> | null = null;

export async function GET(request: NextRequest) {
  const config = readDemoPremiumConfig();
  if (!config) {
    return NextResponse.json({ error: 'x402 resource is not configured' }, { status: 503 });
  }
  paidHandler ??= createDemoPremiumRoute(config);
  return paidHandler(request);
}
