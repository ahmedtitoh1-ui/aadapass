import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { appendAuditLog, enforcePolicy } from '@/lib/server/policy';

export async function GET(req: NextRequest) {
  const auth = enforcePolicy(req, 'admin.network.get');
  if (!auth.ok) return auth.response;

  const db = getDb();
  return NextResponse.json({
    networkRules: db.networkRules,
    networkRuleVersions: db.networkRuleVersions,
    networkAgreements: db.networkAgreements,
    networkSettlements: db.networkSettlements,
    networkDisputes: db.networkDisputes,
  });
}

export async function POST(req: NextRequest) {
  const auth = enforcePolicy(req, 'admin.network.mutate');
  if (!auth.ok) return auth.response;
  const { user, ip } = auth.ctx;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');
  const db = getDb();

  if (action === 'toggle_agreement') {
    const merchantId = String(body.merchantId || '');
    const store = db.stores.find((s) => s.merchantId === merchantId);
    if (!store) {
      return NextResponse.json({ error: 'المتجر غير موجود.' }, { status: 404 });
    }
    if (store.subscriptionPlan === 'Viewer') {
      return NextResponse.json(
        { error: 'متاجر باقة Viewer غير مسموح لها بالانضمام لشبكة النقاط المشتركة.' },
        { status: 403 }
      );
    }

    let agr = db.networkAgreements.find((a) => a.merchantId === merchantId);
    const oldStatus = agr?.status || 'غير منضم';
    if (!agr) {
      agr = {
        id: `agr-${store.id}`,
        merchantId: store.merchantId,
        storeName: store.name,
        status: 'active',
        revenueSharePct: 5,
        signedAt: new Date().toISOString().slice(0, 10),
      };
      db.networkAgreements.unshift(agr);
    } else {
      agr.status = agr.status === 'active' ? 'suspended' : 'active';
    }

    const auditLog = appendAuditLog({
      actorName: `${user.firstName} ${user.lastName}`,
      actorRole: user.role,
      action: 'تحديث عضوية المتجر بالشبكة المشتركة',
      target: store.name,
      oldValue: oldStatus,
      newValue: agr.status,
      ip,
    });

    return NextResponse.json({
      networkAgreements: db.networkAgreements,
      auditLog,
    });
  }

  if (action === 'run_bullmq_settlement') {
    const monthLabel = typeof body.month === 'string' && body.month ? body.month : new Date().toISOString().slice(0, 7);
    const crossRatePerPoint = db.networkRules.crossStore100PtsSar / 100;
    const activeAgreements = db.networkAgreements.filter((a) => a.status === 'active');

    let updatedCount = 0;
    for (const agr of activeAgreements) {
      const storeTx = db.transactions.filter((t) => t.merchantId === agr.merchantId);
      const issuedPts = storeTx.reduce((s, t) => s + (t.pointsEarned > 0 ? t.pointsEarned : 0), 0);
      const redeemedPts = storeTx.reduce((s, t) => s + (t.pointsSpent && t.pointsSpent > 0 ? t.pointsSpent : 0), 0);
      const issuedVal = Math.max(100, Math.round(issuedPts * crossRatePerPoint * 10));
      const redeemedVal = Math.max(50, Math.round(redeemedPts * crossRatePerPoint * 12));
      const netAmountSar = Number((redeemedVal - issuedVal).toFixed(2));

      const existingIdx = db.networkSettlements.findIndex(
        (s) => s.merchantId === agr.merchantId && s.month === monthLabel
      );

      if (existingIdx >= 0 && db.networkSettlements[existingIdx].status === 'pending') {
        db.networkSettlements[existingIdx] = {
          ...db.networkSettlements[existingIdx],
          issuedPointsValue: issuedVal,
          redeemedPointsValue: redeemedVal,
          netAmountSar,
        };
        updatedCount += 1;
      } else if (existingIdx === -1) {
        db.networkSettlements.unshift({
          id: `stl-${monthLabel}-${agr.merchantId}`,
          month: monthLabel,
          merchantId: agr.merchantId,
          storeName: agr.storeName,
          issuedPointsValue: issuedVal,
          redeemedPointsValue: redeemedVal,
          netAmountSar,
          status: 'pending',
        });
        updatedCount += 1;
      }
    }

    const auditLog = appendAuditLog({
      actorName: `${user.firstName} ${user.lastName}`,
      actorRole: user.role,
      action: 'تشغيل مهمة BullMQ لحساب صافي تسويات الشبكة',
      target: `دورة ${monthLabel}`,
      oldValue: 'صافي ما قبل الحساب',
      newValue: `تم تحديث ${updatedCount} تسويات بمعدل ${db.networkRules.crossStore100PtsSar} ر.س / 100 نقطة`,
      ip,
    });

    return NextResponse.json({
      networkSettlements: db.networkSettlements,
      updatedCount,
      auditLog,
    });
  }

  if (action === 'mark_settlement_paid') {
    const settlementId = String(body.settlementId || '');
    const attachmentName = String(body.attachmentName || '').trim();
    const attachmentNote = String(body.attachmentNote || '').trim();

    if (!attachmentName) {
      return NextResponse.json(
        { error: 'يجب إرفاق ملف/مرجع إيصال الحوالة البنكية قبل اعتماد السداد.' },
        { status: 400 }
      );
    }

    const stl = db.networkSettlements.find((s) => s.id === settlementId);
    if (!stl) {
      return NextResponse.json({ error: 'سجل التسوية غير موجود.' }, { status: 404 });
    }

    const oldStatus = stl.status;
    stl.status = 'paid';
    stl.paidAt = new Date().toISOString().slice(0, 10);
    stl.attachmentName = attachmentName;
    stl.attachmentNote = attachmentNote || 'سداد تسوية شهرية للشبكة المشتركة';

    const auditLog = appendAuditLog({
      actorName: `${user.firstName} ${user.lastName}`,
      actorRole: user.role,
      action: 'اعتماد سداد تسوية الشبكة المشتركة (تم السداد)',
      target: `${stl.storeName} (${stl.month})`,
      oldValue: oldStatus === 'pending' ? `معلق (${stl.netAmountSar} ر.س)` : oldStatus,
      newValue: `تم السداد · مرفق: ${attachmentName}`,
      ip,
    });

    return NextResponse.json({
      networkSettlements: db.networkSettlements,
      auditLog,
    });
  }

  if (action === 'resolve_dispute') {
    const disputeId = String(body.disputeId || '');
    const dispute = db.networkDisputes.find((d) => d.id === disputeId);
    if (!dispute) {
      return NextResponse.json({ error: 'الاعتراض غير موجود.' }, { status: 404 });
    }

    const oldStatus = dispute.status;
    dispute.status = 'تمت التسوية';
    dispute.resolvedBy = `${user.firstName} ${user.lastName}`;

    const auditLog = appendAuditLog({
      actorName: `${user.firstName} ${user.lastName}`,
      actorRole: user.role,
      action: 'حل اعتراض تسوية شبكة المكافآت',
      target: `${dispute.merchantName} (${dispute.id})`,
      oldValue: oldStatus,
      newValue: `تمت التسوية (${dispute.amountSar} ر.س)`,
      ip,
    });

    return NextResponse.json({
      networkDisputes: db.networkDisputes,
      auditLog,
    });
  }

  return NextResponse.json({ error: 'إجراء شبكة غير مدعوم.' }, { status: 400 });
}
