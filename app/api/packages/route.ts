import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { enforcePolicy } from '@/lib/server/policy';

export async function GET(req: NextRequest) {
  const auth = enforcePolicy(req, 'packages.publicList');
  if (!auth.ok) return auth.response;

  const db = getDb();
  return NextResponse.json({ packages: db.packages });
}
