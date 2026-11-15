import { NextRequest, NextResponse } from 'next/server';
import { enforcePolicy } from '@/lib/server/policy';

export async function GET(req: NextRequest) {
  const guard = enforcePolicy(req, 'auth.session');
  if (!guard.ok) return guard.response;

  const user = guard.ctx.user;
  return NextResponse.json(
    {
      authenticated: Boolean(user),
      user: user || null,
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
