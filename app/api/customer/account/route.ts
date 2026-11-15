import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/server/db';
import { appendAuditLog, clearSessionCookies, enforcePolicy } from '@/lib/server/policy';
import { hashPassword, verifyPassword } from '@/lib/server/crypto';

export async function POST(req: NextRequest) {
  const guard = enforcePolicy(req, 'customer.account.password');
  if (!guard.ok) return guard.response;

  const db = getDb();
  const userId = guard.ctx.user!.id;
  const userRecord = db.users.find((u) => u.id === userId);
  if (!userRecord) {
    return NextResponse.json({ error: 'الحساب غير موجود.' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!currentPassword || !verifyPassword(currentPassword, userRecord.passwordHash)) {
    return NextResponse.json({ error: 'كلمة المرور الحالية غير صحيحة.' }, { status: 400 });
  }
  if (newPassword.trim().length < 6) {
    return NextResponse.json({ error: 'يجب أن تكون كلمة المرور الجديدة 6 أحرف على الأقل.' }, { status: 400 });
  }

  userRecord.passwordHash = hashPassword(newPassword);

  appendAuditLog({
    actorName: `${userRecord.firstName} ${userRecord.lastName}`,
    actorRole: 'CUSTOMER',
    action: 'تحديث كلمة مرور حساب العميل',
    target: `@${userRecord.username}`,
    oldValue: '********',
    newValue: 'تم التحديث بأمان',
    ip: guard.ctx.ip,
  });

  return NextResponse.json({ ok: true, message: 'تم تحديث كلمة المرور بنجاح.' });
}

export async function DELETE(req: NextRequest) {
  const guard = enforcePolicy(req, 'customer.account.anonymize');
  if (!guard.ok) return guard.response;

  const db = getDb();
  const userId = guard.ctx.user!.id;
  const userRecord = db.users.find((u) => u.id === userId);
  const profile = db.customers.get(userId);
  if (!userRecord || !profile) {
    return NextResponse.json({ error: 'الحساب غير موجود.' }, { status: 404 });
  }

  const anonTag = crypto.randomBytes(3).toString('hex').toUpperCase();
  const previousIdentity = `${userRecord.firstName} ${userRecord.lastName} (@${userRecord.username})`;

  // Preserve financial Transaction ledger rows while removing all PII
  for (const tx of db.transactions) {
    if (tx.customerId === userId) {
      tx.customerName = `عميل محذوف #${anonTag}`;
    }
  }

  // Anonymize user & profile records
  userRecord.firstName = 'عميل';
  userRecord.lastName = `محذوف #${anonTag}`;
  userRecord.username = `anon_${anonTag.toLowerCase()}`;
  userRecord.email = `deleted_${anonTag.toLowerCase()}@anonymized.local`;
  userRecord.phone = '+0000000000';
  userRecord.tokenVersion += 1;

  for (const rt of db.refreshTokens.values()) {
    if (rt.userId === userId) {
      rt.revoked = true;
    }
  }

  profile.firstName = 'عميل';
  profile.lastName = `محذوف #${anonTag}`;
  profile.username = userRecord.username;
  profile.email = userRecord.email;
  profile.phone = userRecord.phone;
  profile.phoneVerified = false;
  profile.marketingConsent = false;
  profile.geoProximityConsent = false;
  if (profile.qrKeyId) {
    db.revokedQrKeyIds.add(profile.qrKeyId);
  }
  profile.qrKeyId = `REVOKED_${anonTag}`;
  profile.qrCodeToken = '';
  profile.qrSignature = '';
  profile.anonymized = true;

  appendAuditLog({
    actorName: previousIdentity,
    actorRole: 'CUSTOMER',
    action: 'حذف وإخفاء هوية حساب عميل (Anonymization)',
    target: userId,
    oldValue: previousIdentity,
    newValue: `مُجهّل #${anonTag} (مع حفظ السجل المالي للمتاجر)`,
    ip: guard.ctx.ip,
  });

  const res = NextResponse.json({
    ok: true,
    anonymized: true,
    message: 'تم إخفاء هويتك الشخصية بنجاح مع الاحتفاظ بالسجل المالي المجهّل فقط لمتاجر الشبكة.',
  });
  return clearSessionCookies(res);
}
