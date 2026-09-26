import { NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/core/auth/server-auth';
import { SupabaseCreditService } from '@/core/finance/supabase-credit-service';
import { KyrosError } from '@/core/errors/kyros-error';

export async function GET() {
  let userId: string;
  try { userId = await getAuthenticatedUserId(); }
  catch { return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 }); }
  try {
    const credits = SupabaseCreditService.fromEnvironment();
    const [account, ledger] = await Promise.all([
      credits.getOrCreateAccount(userId),
      credits.getLedger(userId),
    ]);
    return NextResponse.json({ account, ledger });
  } catch (error) {
    return NextResponse.json({ error: error instanceof KyrosError ? error.safeMessage : 'Credit ledger is unavailable' }, { status: 503 });
  }
}

export async function POST() {
  try { await getAuthenticatedUserId(); }
  catch { return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 }); }
  return NextResponse.json({ error: 'Manual credit deposits are disabled' }, { status: 405 });
}
