import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { appendAuditLog, enforcePolicy } from '@/lib/server/policy';
import type { ManagedUserRecord, UserRole } from '@/lib/types';

const VALID_ROLES: UserRole[] = [
  'CUSTOMER',
  'CASHIER',
  'MERCHANT_MANAGER',
  'MERCHANT_OWNER',
  'PLATFORM_ADMIN',
  'SUPPORT_AGENT',
];

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const auth = enforcePolicy(req, 'admin.users.changeRole');
  if (!auth.ok) return auth.response;
  const { user: actor, ip } = auth.ctx;
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId } = await context.params;
  const body = await req.json().catch(() => null);
  const newRole = body?.role as UserRole | undefined;
  const merchantId = typeof body?.merchantId === 'string' ? body.merchantId : undefined;
  const branchId = typeof body?.branchId === 'string' ? body.branchId : undefined;

  if (!newRole || !VALID_ROLES.includes(newRole)) {
    return NextResponse.json({ error: 'الدور المطلوب غير صالح.' }, { status: 400 });
  }

  const db = getDb();
  const target = db.users.find((u) => u.id === userId);
  if (!target) {
    return NextResponse.json({ error: 'المستخدم غير موجود.' }, { status: 404 });
  }

  if (target.id === actor.id && newRole !== 'PLATFORM_ADMIN') {
    return NextResponse.json(
      { error: 'لا يمكن لمدير المنصة خفض صلاحية حسابه الشخصي أثناء الجلسة.' },
      { status: 400 }
    );
  }

  const oldRole = target.role;
  target.role = newRole;
  target.merchantId = merchantId ?? target.merchantId;
  target.branchId = branchId ?? target.branchId;
  // Invalidate existing sessions whenever role changes
  target.tokenVersion += 1;

  for (const [, rt] of db.refreshTokens.entries()) {
    if (rt.userId === target.id) {
      rt.revoked = true;
    }
  }

  const auditLog = appendAuditLog({
    actorName: `${actor.firstName} ${actor.lastName}`,
    actorRole: actor.role,
    action: 'تغيير صلاحية/دور حساب إداري',
    target: `${target.username} (${target.firstName} ${target.lastName})`,
    oldValue: oldRole,
    newValue: `${newRole}${target.merchantId ? ` · ${target.merchantId}` : ''}`,
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
    failedAttempts: target.failedAttempts,
    lockedUntil: target.lockedUntil,
    tokenVersion: target.tokenVersion,
  };

  return NextResponse.json({ user: safeUser, auditLog });
}
