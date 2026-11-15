import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { hashToken } from '@/lib/server/crypto';
import {
  attachSessionCookies,
  clearSessionCookies,
  enforcePolicy,
  issueSessionTokens,
  REFRESH_COOKIE_NAME,
  toSessionUser,
} from '@/lib/server/policy';

export async function POST(req: NextRequest) {
  const guard = enforcePolicy(req, 'auth.refresh');
  if (!guard.ok) return guard.response;

  const rawRefresh = req.cookies.get(REFRESH_COOKIE_NAME)?.value;
  if (!rawRefresh) {
    return NextResponse.json({ error: 'Refresh token cookie missing.' }, { status: 401 });
  }

  const db = getDb();
  const tokenHash = hashToken(rawRefresh);
  const record = db.refreshTokens.get(tokenHash);

  if (!record || record.expiresAt < Date.now()) {
    const res = NextResponse.json({ error: 'Refresh session expired.' }, { status: 401 });
    return clearSessionCookies(res);
  }

  // Reuse detection: if revoked token is presented again, revoke entire token family
  if (record.revoked) {
    for (const item of db.refreshTokens.values()) {
      if (item.familyId === record.familyId) {
        item.revoked = true;
      }
    }
    const res = NextResponse.json({ error: 'Refresh token reuse detected. Sessions revoked.' }, { status: 401 });
    return clearSessionCookies(res);
  }

  const user = db.users.find((u) => u.id === record.userId);
  if (!user || user.tokenVersion !== record.tokenVersion) {
    const res = NextResponse.json({ error: 'Session invalidated.' }, { status: 401 });
    return clearSessionCookies(res);
  }

  // Rotate refresh token
  record.revoked = true;
  const { accessToken, rawRefresh: nextRefresh } = issueSessionTokens(user, record.familyId);

  const res = NextResponse.json({
    user: toSessionUser(user),
    accessToken,
  });
  return attachSessionCookies(res, accessToken, nextRefresh, req);
}
