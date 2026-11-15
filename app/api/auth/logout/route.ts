import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { hashToken } from '@/lib/server/crypto';
import { clearSessionCookies, enforcePolicy, REFRESH_COOKIE_NAME } from '@/lib/server/policy';

export async function POST(req: NextRequest) {
  const guard = enforcePolicy(req, 'auth.logout');
  if (!guard.ok) return guard.response;

  const rawRefresh = req.cookies.get(REFRESH_COOKIE_NAME)?.value;
  if (rawRefresh) {
    const db = getDb();
    const record = db.refreshTokens.get(hashToken(rawRefresh));
    if (record) {
      record.revoked = true;
    }
  }

  const res = NextResponse.json({ ok: true, message: 'تم تسجيل الخروج بنجاح.' });
  res.cookies.delete('admin_role');
  return clearSessionCookies(res);
}
