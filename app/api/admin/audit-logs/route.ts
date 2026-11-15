import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { enforcePolicy } from '@/lib/server/policy';
import { rlsFilterAuditLogs } from '@/lib/server/rls';

export async function GET(req: NextRequest) {
  const auth = enforcePolicy(req, 'admin.auditLogs.list');
  if (!auth.ok) return auth.response;

  const db = getDb();
  const logs = rlsFilterAuditLogs(db.auditLogs, auth.ctx.user);
  return NextResponse.json({ auditLogs: logs });
}
