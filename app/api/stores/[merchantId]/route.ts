import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { appendAuditLog, enforcePolicy } from '@/lib/server/policy';
import { withTenant } from '@/lib/server/rls';
import { invalidatePublicStoreCache } from '@/lib/server/publicCache';
import { getEffectiveSubscriptionState } from '@/lib/subscriptionStatus';
import { ProgramVersionSnapshot, Store } from '@/lib/types';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ merchantId: string }> }
) {
  const { merchantId } = await context.params;
  const guard = enforcePolicy(req, 'stores.update', { merchantId });
  if (!guard.ok) return guard.response;

  const user = guard.ctx.user!;
  const db = getDb();
  const idx = db.stores.findIndex((s) => s.merchantId === merchantId || s.id === merchantId);
  if (idx === -1) {
    return NextResponse.json({ error: 'المتجر غير موجود.' }, { status: 404 });
  }

  const existing = db.stores[idx];
  const tenantCheck = withTenant(user, existing.merchantId, (scope) => scope);
  if (!tenantCheck.ok) {
    return NextResponse.json({ error: tenantCheck.error }, { status: tenantCheck.status });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<Store>;
  const isAdmin = user.role === 'PLATFORM_ADMIN';

  // 1. Role matrix enforcement: ONLY PLATFORM_ADMIN can switch packages, extend expiry, or reactivate paused subscriptions
  const subscriptionTouched =
    (body.subscriptionPlan !== undefined && body.subscriptionPlan !== existing.subscriptionPlan) ||
    (body.subscriptionState !== undefined && body.subscriptionState !== existing.subscriptionState) ||
    (body.subscriptionExpiry !== undefined && body.subscriptionExpiry !== existing.subscriptionExpiry);

  if (subscriptionTouched && !isAdmin) {
    return NextResponse.json(
      { error: 'تعديل الباقة أو تجديدها يتم حصراً عبر التواصل مع مدير النظام.' },
      { status: 403 }
    );
  }

  // 2. Grace / Read-only state check: readonly / expired blocks non-admin mutations (except submitting requestedPlan upgrade request)
  const currentSubState = getEffectiveSubscriptionState(existing);
  const onlyUpdatingRequestedPlan =
    body.requestedPlan !== undefined &&
    Object.keys(body).every((k) => k === 'requestedPlan' || k === 'id' || k === 'merchantId');

  if (currentSubState === 'readonly' && !isAdmin && !onlyUpdatingRequestedPlan) {
    return NextResponse.json(
      { error: 'انتهت مدة الباقة والمتجر متوقف مؤقتاً لحين التجديد عبر مدير النظام.' },
      { status: 403 }
    );
  }

  // 3. Pending onboarding check: unapproved stores cannot be activated by non-admin
  if (existing.status === 'pending' && !isAdmin && body.status === 'active') {
    return NextResponse.json(
      { error: 'تفعيل المتجر وتوثيق ملكيته يتم حصراً عبر مدير المنصة.' },
      { status: 403 }
    );
  }

  // 4. Manager cannot add/delete branches globally or change manager staff entries
  if (user.role === 'MERCHANT_MANAGER') {
    if (Array.isArray(body.branches) && body.branches.length !== existing.branches.length) {
      return NextResponse.json(
        { error: 'إضافة أو حذف الفروع متاح لمالك المتجر فقط.' },
        { status: 403 }
      );
    }
    if (Array.isArray(body.cashiers)) {
      const existingManagers = existing.cashiers.filter((c) => c.role === 'MERCHANT_MANAGER');
      const incomingManagers = body.cashiers.filter((c) => c.role === 'MERCHANT_MANAGER');
      if (JSON.stringify(existingManagers) !== JSON.stringify(incomingManagers)) {
        return NextResponse.json(
          { error: 'تعديل صلاحيات أو حالة مديري الفروع متاح لمالك المتجر فقط.' },
          { status: 403 }
        );
      }
    }
  }

  // 5. Server-side Package Limits Enforcement
  const targetPlanName = isAdmin && body.subscriptionPlan ? body.subscriptionPlan : existing.subscriptionPlan;
  const activePkg =
    db.packages.find((p) => p.name === targetPlanName) ||
    db.packages.find((p) => p.name === existing.subscriptionPlan);

  if (activePkg) {
    if (
      Array.isArray(body.branches) &&
      body.branches.length > existing.branches.length &&
      body.branches.length > activePkg.maxBranches
    ) {
      return NextResponse.json(
        {
          error: `تجاوزت حد الباقة (${activePkg.title}): الحد الأقصى ${activePkg.maxBranches} فروع. يرجى طلب ترقية الباقة من مدير النظام.`,
        },
        { status: 400 }
      );
    }

    if (
      Array.isArray(body.cashiers) &&
      body.cashiers.length > existing.cashiers.length &&
      body.cashiers.length > activePkg.maxStaff
    ) {
      return NextResponse.json(
        {
          error: `تجاوزت حد الموظفين في الباقة (${activePkg.title}): الحد الأقصى ${activePkg.maxStaff} موظف.`,
        },
        { status: 400 }
      );
    }

    if (
      !activePkg.loyaltyEnabled &&
      Array.isArray(body.programs) &&
      body.programs.some((p) => p.status === 'فعال')
    ) {
      return NextResponse.json(
        { error: 'باقة العرض فقط (Viewer) لا تدعم تفعيل برامج الولاء والنقاط.' },
        { status: 400 }
      );
    }

    if (
      targetPlanName !== 'Business' &&
      !isAdmin &&
      Array.isArray(body.branches)
    ) {
      const hasNewBranchRule = body.branches.some((b) => {
        const old = existing.branches.find((ob) => ob.id === b.id);
        return Boolean(b.branchRule) && JSON.stringify(b.branchRule) !== JSON.stringify(old?.branchRule);
      });
      if (hasNewBranchRule) {
        return NextResponse.json(
          { error: 'تخصيص قواعد ولاء مستقلة لكل فرع متاح حصراً في باقة الشركات (Business).' },
          { status: 403 }
        );
      }
    }
  }

  const nextStore: Store = {
    ...existing,
    ...body,
    id: existing.id,
    merchantId: existing.merchantId,
    // Keep server-authoritative programVersions immutable except for appending new snapshots below
    programVersions: [...(existing.programVersions || [])],
  };

  // Non-PLATFORM_ADMIN users cannot self-approve ownership verification, force active status, or mutate billing
  if (!isAdmin) {
    nextStore.verifiedOwnership = existing.verifiedOwnership;
    nextStore.status = existing.status;
    nextStore.subscriptionPlan = existing.subscriptionPlan;
    nextStore.subscriptionExpiry = existing.subscriptionExpiry;
    nextStore.subscriptionState = existing.subscriptionState;
  }

  // Sync default card design fields if cardDesigns were updated
  if (Array.isArray(nextStore.cardDesigns) && nextStore.cardDesigns.length > 0) {
    const defCard =
      nextStore.cardDesigns.find((c) => c.isDefault && c.active) ||
      nextStore.cardDesigns.find((c) => c.isDefault) ||
      nextStore.cardDesigns[0];
    if (defCard) {
      nextStore.cardColor = defCard.cardColor;
      nextStore.cardTextColor = defCard.cardTextColor;
      nextStore.loyaltyRule = defCard.loyaltyRule;
    }
  }

  // 6. Immutable Program Versioning when programs array changes
  if (Array.isArray(body.programs)) {
    const nowLabel = new Date().toLocaleString('ar-SA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const nextVersions: ProgramVersionSnapshot[] = [...(existing.programVersions || [])];

    nextStore.programs = body.programs.map((prog) => {
      const prevProg = existing.programs.find((ep) => ep.id === prog.id);
      const changed =
        !prevProg ||
        prevProg.rewardValue !== prog.rewardValue ||
        prevProg.minInvoiceAmount !== prog.minInvoiceAmount ||
        prevProg.pointsExpiryDays !== prog.pointsExpiryDays ||
        prevProg.maxRedemption !== prog.maxRedemption ||
        prevProg.allowStacking !== prog.allowStacking ||
        prevProg.stampsRequired !== prog.stampsRequired ||
        prevProg.currency !== prog.currency ||
        prevProg.status !== prog.status ||
        JSON.stringify(prevProg.pointRules) !== JSON.stringify(prog.pointRules) ||
        JSON.stringify(prevProg.branches) !== JSON.stringify(prog.branches);

      if (!changed) return prog;

      const bumpedVersion = prevProg ? prevProg.version + 1 : Math.max(1, prog.version || 1);
      nextVersions.unshift({
        version: bumpedVersion,
        programId: prog.id,
        programName: prog.name,
        currency: prog.currency,
        summary: `${prog.status} · ${prog.rewardValue} · حد أدنى ${prog.minInvoiceAmount} ${prog.currency}`,
        savedAt: nowLabel,
        savedBy: `${user.firstName} ${user.lastName} (${user.role})`,
      });
      return { ...prog, version: bumpedVersion };
    });

    nextStore.programVersions = nextVersions;
  }

  db.stores[idx] = nextStore;
  for (const cust of db.customers.values()) {
    for (const card of cust.cards) {
      if (card.merchantId === nextStore.merchantId || card.storeId === nextStore.id) {
        card.storeName = nextStore.name;
        card.storeLogo = nextStore.logo;
        card.cardColor = nextStore.cardColor;
        card.cardTextColor = nextStore.cardTextColor;
        card.currency = nextStore.currency;
        card.rule = nextStore.loyaltyRule;
      }
    }
  }
  invalidatePublicStoreCache();

  if (existing.status !== nextStore.status) {
    appendAuditLog({
      actorName: `${user.firstName} ${user.lastName}`,
      actorRole: user.role,
      action: 'تغيير حالة متجر',
      target: nextStore.name,
      oldValue: existing.status === 'active' ? 'نشط' : existing.status === 'pending' ? 'قيد المراجعة' : 'موقوف',
      newValue: nextStore.status === 'active' ? 'نشط' : nextStore.status === 'pending' ? 'قيد المراجعة' : 'موقوف',
      ip: guard.ctx.ip,
    });
  } else if (existing.subscriptionPlan !== nextStore.subscriptionPlan) {
    appendAuditLog({
      actorName: `${user.firstName} ${user.lastName}`,
      actorRole: user.role,
      action: 'تغيير باقة متجر',
      target: nextStore.name,
      oldValue: existing.subscriptionPlan,
      newValue: nextStore.subscriptionPlan,
      ip: guard.ctx.ip,
    });
  } else if (!existing.verifiedOwnership && nextStore.verifiedOwnership) {
    appendAuditLog({
      actorName: `${user.firstName} ${user.lastName}`,
      actorRole: user.role,
      action: 'توثيق ملكية متجر',
      target: nextStore.name,
      oldValue: 'غير موثق',
      newValue: 'موثق ✓',
      ip: guard.ctx.ip,
    });
  } else if (existing.currency !== nextStore.currency) {
    appendAuditLog({
      actorName: `${user.firstName} ${user.lastName}`,
      actorRole: user.role,
      action: 'تغيير عملة المتجر',
      target: nextStore.name,
      oldValue: existing.currency,
      newValue: nextStore.currency,
      ip: guard.ctx.ip,
    });
  } else if (existing.subscriptionState !== nextStore.subscriptionState) {
    appendAuditLog({
      actorName: `${user.firstName} ${user.lastName}`,
      actorRole: user.role,
      action: 'تحديث حالة الاشتراك (فترة السماح / القراءة فقط)',
      target: nextStore.name,
      oldValue: existing.subscriptionState || 'active',
      newValue: nextStore.subscriptionState || 'active',
      ip: guard.ctx.ip,
    });
  }

  return NextResponse.json({ store: nextStore });
}
