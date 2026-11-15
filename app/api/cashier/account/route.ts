import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { appendAuditLog, enforcePolicy, toSessionUser } from '@/lib/server/policy';
import { hashPassword, verifyPassword } from '@/lib/server/crypto';

export async function POST(req: NextRequest) {
  const guard = enforcePolicy(req, 'cashier.account.password');
  if (!guard.ok) return guard.response;

  const db = getDb();
  const userId = guard.ctx.user!.id;
  const userRecord = db.users.find((u) => u.id === userId);
  if (!userRecord) {
    return NextResponse.json({ error: 'حساب الموظف غير موجود.' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!currentPassword || !verifyPassword(currentPassword, userRecord.passwordHash)) {
    return NextResponse.json({ error: 'كلمة المرور الحالية أو المؤقتة غير صحيحة.' }, { status: 400 });
  }
  if (newPassword.trim().length < 6) {
    return NextResponse.json({ error: 'يجب أن تتكون كلمة المرور الجديدة من 6 أحرف على الأقل.' }, { status: 400 });
  }

  userRecord.passwordHash = hashPassword(newPassword);
  const wasForcedFirstChange = Boolean(userRecord.mustChangePassword);
  userRecord.mustChangePassword = false;

  // Sync store staff flag as well
  const store = db.stores.find((s) => s.merchantId === userRecord.merchantId);
  if (store) {
    store.cashiers = store.cashiers.map((c) =>
      c.userId === userRecord.id || c.username === userRecord.username
        ? { ...c, mustChangePassword: false }
        : c
    );
  }

  appendAuditLog({
    actorName: `${userRecord.firstName} ${userRecord.lastName}`,
    actorRole: userRecord.role,
    action: wasForcedFirstChange ? 'تغيير كلمة المرور المؤقتة عند أول دخول' : 'تحديث كلمة مرور الكاشير',
    target: `@${userRecord.username}`,
    oldValue: '********',
    newValue: 'تم التحديث بأمان',
    ip: guard.ctx.ip,
  });

  return NextResponse.json({
    ok: true,
    user: toSessionUser(userRecord),
    message: 'تم تحديث كلمة المرور بنجاح.',
  });
}
