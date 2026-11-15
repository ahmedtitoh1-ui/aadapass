import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { appendAuditLog, clearSessionCookies, enforcePolicy } from '@/lib/server/policy';
import { AR_TRANSLATIONS } from '@/lib/i18n/ar';

export async function POST(req: NextRequest) {
  const guard = enforcePolicy(req, 'auth.logoutAll');
  if (!guard.ok) return guard.response;

  const userSession = guard.ctx.user!;
  const db = getDb();
  const userRecord = db.users.find((u) => u.id === userSession.id);

  if (userRecord) {
    const prevVersion = userRecord.tokenVersion;
    userRecord.tokenVersion += 1;
    for (const token of db.refreshTokens.values()) {
      if (token.userId === userRecord.id) {
        token.revoked = true;
      }
    }
    appendAuditLog({
      actorName: `${userRecord.firstName} ${userRecord.lastName}`,
      actorRole: userRecord.role,
      action: 'تسجيل خروج من كل الأجهزة',
      target: `@${userRecord.username}`,
      oldValue: `Session v${prevVersion}`,
      newValue: `Session v${userRecord.tokenVersion}`,
      ip: guard.ctx.ip,
    });
  }

  const res = NextResponse.json({
    ok: true,
    message: AR_TRANSLATIONS.security.sessionRevokedAll,
  });
  return clearSessionCookies(res);
}
