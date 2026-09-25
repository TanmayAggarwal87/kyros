import { NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/core/auth/server-auth';

async function requireUser(): Promise<NextResponse | null> {
  try { await getAuthenticatedUserId(); return null; }
  catch { return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 }); }
}

export async function GET() {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;
  return NextResponse.json({ error: 'Workflow persistence is not configured' }, { status: 503 });
}

export async function POST() {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;
  return NextResponse.json({ error: 'Workflow creation is not configured' }, { status: 503 });
}
