import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/server/db';
import { hashPassword } from '@/lib/server/crypto';
import { appendAuditLog, enforcePolicy } from '@/lib/server/policy';
import type { ManagedUserRecord } from '@/lib/types';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const auth = enforcePolicy(req, 'admin.users.resetPassword');
  if (!auth.ok) return auth.response;
  const { user: actor, ip } = auth.ctx;
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId } = await context.params;
  const body = await req.json().catch(() => ({}));
  const requestedPassword = typeof body?.tempPassword === 'string' ? body.tempPassword.trim() : '';
  const unlockOnly = body?.unlockOnly === true;

  const db = getDb();
  const target = db.users.find((u) => u.id === userId);
  if (!target) {
    return NextResponse.json({ error: 'الحساب المطلوب غير موجود.' }, { status: 404 });
  }

  let tempPassword: string | undefined;
  const oldState = `locked=${Boolean(target.lockedUntil && target.lockedUntil > Date.now())}, tv=${target.tokenVersion}`;

  if (!unlockOnly) {
    if (requestedPassword && requestedPassword.length < 6) {
      return NextResponse.json(
        { error: 'كلمة المرور المؤقتة يجب ألا تقل عن 6 أحرف.' },
        { status: 400 }
      );
    }
    const generated = requestedPassword || `Aada@${crypto.randomInt(1000, 9999)}`;
    tempPassword = generated;
    target.passwordHash = hashPassword(generated);
    target.mustChangePassword = true;
    target.tokenVersion += 1;
    for (const [, rt] of db.refreshTokens.entries()) {
      if (rt.userId === target.id) {
        rt.revoked = true;
      }
    }
  }

  target.failedAttempts = 0;
  target.lockedUntil = null;

  const auditLog = appendAuditLog({
    actorName: `${actor.firstName} ${actor.lastName}`,
    actorRole: actor.role,
    action: unlockOnly ? 'فك قفل حساب مستخدم' : 'إعادة تعيين كلمة مرور وإبطال الجلسات',
    target: `@${target.username} (${target.role})`,
    oldValue: oldState,
    newValue: unlockOnly
      ? 'نشط (تم فك القفل)'
      : `كلمة مرور مؤقتة + إبطال الجلسات (tv=${target.tokenVersion})`,
    ip,
  });

  const safeUser: ManagedUserRecord = {
    id: target.id,
    username: target.username,
    firstName: target.firstName,
    lastName: target.lastName,
    email: target.email,
    phone: target.phone,
    role: target.role,
    merchantId: target.merchantId,
    branchId: target.branchId,
    branchIds: target.branchIds,
    mustChangePassword: Boolean(target.mustChangePassword),
    failedAttempts: target.failedAttempts,
    lockedUntil: target.lockedUntil,
    tokenVersion: target.tokenVersion,
  };

  return NextResponse.json({
    user: safeUser,
    tempPassword,
    auditLog,
  });
}
