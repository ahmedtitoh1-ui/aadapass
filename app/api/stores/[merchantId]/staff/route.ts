import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb, ServerUserRecord } from '@/lib/server/db';
import { appendAuditLog, enforcePolicy } from '@/lib/server/policy';
import { withTenant } from '@/lib/server/rls';
import { hashPassword } from '@/lib/server/crypto';
import { CashierStaff } from '@/lib/types';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ merchantId: string }> }
) {
  const { merchantId } = await context.params;
  const guard = enforcePolicy(req, 'merchant.staff.create', { merchantId });
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
      { error: 'المتجر في وضع القراءة فقط (Read-only). يرجى تجديد الباقة لإضافة موظفين.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const tempPassword = typeof body.tempPassword === 'string' ? body.tempPassword : '';
  const role: 'CASHIER' | 'MERCHANT_MANAGER' =
    body.role === 'MERCHANT_MANAGER' ? 'MERCHANT_MANAGER' : 'CASHIER';

  // Owner-only rule: MERCHANT_MANAGER cannot create another MERCHANT_MANAGER
  if (role === 'MERCHANT_MANAGER' && actor.role !== 'MERCHANT_OWNER' && actor.role !== 'PLATFORM_ADMIN') {
    return NextResponse.json(
      { error: 'إنشاء حسابات مديري الفروع متاح لمالك المتجر (MERCHANT_OWNER) فقط.' },
      { status: 403 }
    );
  }

  // Package maxStaff limit
  const pkg = db.packages.find((p) => p.name === store.subscriptionPlan);
  if (pkg && store.cashiers.length >= pkg.maxStaff) {
    return NextResponse.json(
      {
        error: `تجاوزت الحد الأقصى للموظفين في باقة ${pkg.title} (${pkg.maxStaff} موظف). قم بالترقية لإضافة موظفين جدد.`,
      },
      { status: 400 }
    );
  }

  const requestedBranchIds = Array.isArray(body.branchIds)
    ? body.branchIds.filter((b: unknown): b is string => typeof b === 'string' && b.trim().length > 0)
    : typeof body.branchId === 'string' && body.branchId.trim()
      ? [body.branchId.trim()]
      : [];

  if (actor.role === 'MERCHANT_MANAGER') {
    const allowed = tenantCheck.data.allowedBranchIds;
    if (allowed.length > 0 && requestedBranchIds.some((bid: string) => !allowed.includes(bid))) {
      return NextResponse.json(
        { error: 'لا يمكنك ربط كاشير بفرع خارج نطاق صلاحياتك.' },
        { status: 403 }
      );
    }
  }

  if (!name || !username) {
    return NextResponse.json({ error: 'اسم الموظف واسم المستخدم مطلوبان.' }, { status: 400 });
  }
  if (tempPassword.trim().length < 6) {
    return NextResponse.json({ error: 'كلمة المرور المؤقتة يجب أن تكون 6 أحرف على الأقل.' }, { status: 400 });
  }

  const usernameExists = db.users.some((u) => u.username.toLowerCase() === username);
  if (usernameExists) {
    return NextResponse.json({ error: 'اسم المستخدم مسجل مسبقاً في المنصة.' }, { status: 409 });
  }

  const validBranches = store.branches.filter((b) => requestedBranchIds.includes(b.id));
  const fallbackBranches =
    actor.role === 'MERCHANT_MANAGER' && tenantCheck.data.allowedBranchIds.length > 0
      ? store.branches.filter((b) => tenantCheck.data.allowedBranchIds.includes(b.id))
      : store.branches.slice(0, 1);
  const assignedBranches = validBranches.length > 0 ? validBranches : fallbackBranches;
  const assignedBranchIds = assignedBranches.map((b) => b.id);
  const primaryBranch = assignedBranches[0] || store.branches[0];

  const userId = `${role === 'MERCHANT_MANAGER' ? 'manager' : 'cashier'}-${crypto.randomUUID().slice(0, 6)}`;
  const nameParts = name.split(/\s+/);
  const firstName = nameParts[0] || name;
  const lastName = nameParts.slice(1).join(' ') || store.name;

  const newUserRecord: ServerUserRecord = {
    id: userId,
    username,
    firstName,
    lastName,
    email: `${username}@${store.slug || 'store'}.aadapass.local`,
    phone: `+9665${Math.floor(10000000 + Math.random() * 89999999)}`,
    role,
    merchantId: store.merchantId,
    branchId: primaryBranch?.id || 'b-1',
    branchIds: assignedBranchIds,
    mustChangePassword: true,
    passwordHash: hashPassword(tempPassword),
    failedAttempts: 0,
    lockedUntil: null,
    tokenVersion: 1,
  };
  db.users.push(newUserRecord);

  const newStaff: CashierStaff = {
    id: userId,
    userId,
    merchantId: store.merchantId,
    name,
    username,
    role,
    branchId: primaryBranch?.id || 'b-1',
    branchIds: assignedBranchIds,
    branchName: assignedBranches.map((b) => b.name).join('، ') || 'الفرع الرئيسي',
    permissions:
      role === 'MERCHANT_MANAGER'
        ? ['تسجيل فاتورة', 'صرف مكافأة', 'استعلام', 'إدارة الفرع']
        : ['تسجيل فاتورة', 'صرف مكافأة', 'استعلام'],
    active: true,
    mustChangePassword: true,
  };
  store.cashiers.push(newStaff);

  appendAuditLog({
    actorName: `${actor.firstName} ${actor.lastName}`,
    actorRole: actor.role,
    action: `إنشاء حساب ${role === 'CASHIER' ? 'كاشير' : 'مدير فرع'} بكلمة مرور مؤقتة`,
    target: `${store.name} (@${username})`,
    oldValue: 'غير موجود',
    newValue: `فروع: ${newStaff.branchName}`,
    ip: guard.ctx.ip,
  });

  return NextResponse.json({ ok: true, staff: newStaff, store }, { status: 201 });
}
