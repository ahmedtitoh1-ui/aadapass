import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { appendAuditLog, enforcePolicy } from '@/lib/server/policy';
import { withTenant } from '@/lib/server/rls';
import { hashPassword } from '@/lib/server/crypto';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ merchantId: string; staffId: string }> }
) {
  const { merchantId, staffId } = await context.params;
  const guard = enforcePolicy(req, 'merchant.staff.mutate', { merchantId });
  if (!guard.ok) return guard.response;

  const actor = guard.ctx.user!;
  const db = getDb();
  const store = db.stores.find((s) => s.merchantId === merchantId);
  if (!store) {
    return NextResponse.json({ error: 'المتجر غير موجود.' }, { status: 404 });
  }

  const tenantCheck = withTenant(actor, store.merchantId, (scope) => scope);
  if (!tenantCheck.ok) {
    return NextResponse.json({ error: tenantCheck.error }, { status: tenantCheck.status });
  }

  if (store.subscriptionState === 'readonly') {
    return NextResponse.json(
      { error: 'المتجر في وضع القراءة فقط (Read-only). يرجى تجديد الباقة.' },
      { status: 403 }
    );
  }

  const staffIdx = store.cashiers.findIndex((c) => c.id === staffId || c.userId === staffId);
  if (staffIdx === -1) {
    return NextResponse.json({ error: 'الموظف غير موجود في هذا المتجر.' }, { status: 404 });
  }

  const staff = store.cashiers[staffIdx];
  const targetUser = db.users.find((u) => u.id === staff.id || u.username === staff.username);

  // Role matrix: Manager cannot mutate another Manager
  if (staff.role === 'MERCHANT_MANAGER' && actor.role === 'MERCHANT_MANAGER') {
    return NextResponse.json(
      { error: 'تعديل أو تعطيل مدير فرع آخر متاح لمالك المتجر فقط.' },
      { status: 403 }
    );
  }

  // Manager branch boundary
  if (actor.role === 'MERCHANT_MANAGER') {
    const allowed = tenantCheck.data.allowedBranchIds;
    const staffBranches = staff.branchIds && staff.branchIds.length > 0 ? staff.branchIds : [staff.branchId];
    if (allowed.length > 0 && !staffBranches.some((bid) => allowed.includes(bid))) {
      return NextResponse.json(
        { error: 'هذا الموظف يتبع لفرع خارج نطاق صلاحياتك.' },
        { status: 403 }
      );
    }
  }

  const body = await req.json().catch(() => ({}));

  // Reset temporary password
  if (typeof body.tempPassword === 'string') {
    const nextPass = body.tempPassword.trim();
    if (nextPass.length < 6) {
      return NextResponse.json(
        { error: 'كلمة المرور المؤقتة يجب أن تكون 6 أحرف على الأقل.' },
        { status: 400 }
      );
    }
    if (targetUser) {
      targetUser.passwordHash = hashPassword(nextPass);
      targetUser.mustChangePassword = true;
      targetUser.tokenVersion += 1;
      for (const rt of db.refreshTokens.values()) {
        if (rt.userId === targetUser.id) rt.revoked = true;
      }
    }
    staff.mustChangePassword = true;
    appendAuditLog({
      actorName: `${actor.firstName} ${actor.lastName}`,
      actorRole: actor.role,
      action: 'إعادة تعيين كلمة مرور موظف مؤقتة',
      target: `${store.name} (@${staff.username})`,
      oldValue: 'كلمة مرور سابقة',
      newValue: 'تم التعيين (تتطلب تغييراً عند الدخول)',
      ip: guard.ctx.ip,
    });
  }

  // Suspend / Activate
  if (typeof body.active === 'boolean' && body.active !== staff.active) {
    const prevActive = staff.active;
    staff.active = body.active;
    if (!staff.active && targetUser) {
      targetUser.tokenVersion += 1;
      for (const rt of db.refreshTokens.values()) {
        if (rt.userId === targetUser.id) rt.revoked = true;
      }
    }
    appendAuditLog({
      actorName: `${actor.firstName} ${actor.lastName}`,
      actorRole: actor.role,
      action: staff.active ? 'تفعيل حساب موظف' : 'إيقاف مؤقت لحساب موظف',
      target: `${store.name} (@${staff.username})`,
      oldValue: prevActive ? 'مفعل' : 'معطل',
      newValue: staff.active ? 'مفعل' : 'معطل',
      ip: guard.ctx.ip,
    });
  }

  if (Array.isArray(body.permissions)) {
    staff.permissions = body.permissions.filter((p: unknown): p is string => typeof p === 'string');
  }

  store.cashiers[staffIdx] = { ...staff };
  return NextResponse.json({ ok: true, staff: store.cashiers[staffIdx], store });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ merchantId: string; staffId: string }> }
) {
  const { merchantId, staffId } = await context.params;
  const guard = enforcePolicy(req, 'merchant.staff.delete', { merchantId });
  if (!guard.ok) return guard.response;

  const actor = guard.ctx.user!;
  const db = getDb();
  const store = db.stores.find((s) => s.merchantId === merchantId);
  if (!store) {
    return NextResponse.json({ error: 'المتجر غير موجود.' }, { status: 404 });
  }

  const tenantCheck = withTenant(actor, store.merchantId, (scope) => scope);
  if (!tenantCheck.ok) {
    return NextResponse.json({ error: tenantCheck.error }, { status: tenantCheck.status });
  }

  const staffIdx = store.cashiers.findIndex((c) => c.id === staffId || c.userId === staffId);
  if (staffIdx === -1) {
    return NextResponse.json({ error: 'الموظف غير موجود.' }, { status: 404 });
  }

  const removed = store.cashiers[staffIdx];
  store.cashiers.splice(staffIdx, 1);

  const userIdx = db.users.findIndex((u) => u.id === removed.id || u.username === removed.username);
  if (userIdx !== -1) {
    const removedUser = db.users[userIdx];
    for (const rt of db.refreshTokens.values()) {
      if (rt.userId === removedUser.id) rt.revoked = true;
    }
    db.users.splice(userIdx, 1);
  }

  appendAuditLog({
    actorName: `${actor.firstName} ${actor.lastName}`,
    actorRole: actor.role,
    action: `حذف حساب ${removed.role === 'MERCHANT_MANAGER' ? 'مدير فرع' : 'كاشير'}`,
    target: `${store.name} (@${removed.username})`,
    oldValue: `${removed.name} (${removed.role})`,
    newValue: 'محذوف',
    ip: guard.ctx.ip,
  });

  return NextResponse.json({ ok: true, deletedId: removed.id, store });
}
