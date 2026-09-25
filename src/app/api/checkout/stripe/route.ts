import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUserId } from '@/core/auth/server-auth';
import { SupabaseCreditService } from '@/core/finance/supabase-credit-service';

const sessionResponseSchema = z.object({ id: z.string().min(1), url: z.url() });

export function isValidCheckoutAmount(amountUsd: unknown): amountUsd is number {
  return typeof amountUsd === 'number' && Number.isSafeInteger(amountUsd * 100) && amountUsd >= 5 && amountUsd <= 500;
}

export async function POST(request: Request) {
  let userId: string;
  try { userId = await getAuthenticatedUserId(); }
  catch { return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 }); }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }
  const amountUsd = typeof body === 'object' && body !== null && 'amountUsd' in body ? body.amountUsd : undefined;
  if (!isValidCheckoutAmount(amountUsd)) {
    return NextResponse.json({ error: 'Amount must be between $5 and $500 in whole cents' }, { status: 400 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!stripeKey || !webhookSecret || !appUrl) {
    return NextResponse.json({ error: 'Stripe Checkout is not configured' }, { status: 503 });
  }

  try {
    // Ensure migrations and database connectivity work before creating a chargeable session.
    const credits = SupabaseCreditService.fromEnvironment();
    await credits.assertReady();
    await credits.getOrCreateAccount(userId);
    const origin = new URL(appUrl).origin;
    const params = new URLSearchParams({
      mode: 'payment', client_reference_id: userId,
      success_url: `${origin}/?tab=credits&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?tab=credits&cancelled=true`,
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]': 'Kyros Research Credits',
      'line_items[0][price_data][unit_amount]': String(Math.round(amountUsd * 100)),
      'line_items[0][quantity]': '1',
    });
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(), cache: 'no-store', signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return NextResponse.json({ error: 'Stripe Checkout is unavailable' }, { status: 502 });
    const session = sessionResponseSchema.parse(await response.json());
    return NextResponse.json({ checkoutUrl: session.url, sessionId: session.id });
  } catch {
    return NextResponse.json({ error: 'Checkout is unavailable' }, { status: 503 });
  }
}
