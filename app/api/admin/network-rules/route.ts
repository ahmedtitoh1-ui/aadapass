import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { appendAuditLog, enforcePolicy } from '@/lib/server/policy';

export async function GET(req: NextRequest) {
  const auth = enforcePolicy(req, 'admin.networkRules.get');
  if (!auth.ok) return auth.response;

  const db = getDb();
  return NextResponse.json({ networkRules: db.networkRules });
}

export async function PATCH(req: NextRequest) {
  const auth = enforcePolicy(req, 'admin.networkRules.update');
  if (!auth.ok) return auth.response;
  const { user, ip } = auth.ctx;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const sameStore = Number(body?.sameStore100PtsSar);
  const crossStore = Number(body?.crossStore100PtsSar);
  const pointSharingEnabled = Boolean(body?.pointSharingEnabled);
  const pointSharingStartDate = String(body?.pointSharingStartDate || '');
  const pointSharingEndDate = String(body?.pointSharingEndDate || '');
  const pointSharingAllowedMerchantIds = Array.isArray(body?.pointSharingAllowedMerchantIds)
    ? body.pointSharingAllowedMerchantIds.map(String)
    : [];

  if (Number.isNaN(sameStore) || Number.isNaN(crossStore) || sameStore <= 0 || crossStore <= 0) {
    return NextResponse.json({ error: 'قيم التسوية غير صالحة.' }, { status: 400 });
  }

  const db = getDb();
  const prev = { ...db.networkRules };
  db.networkRules = {
    sameStore100PtsSar: sameStore,
    crossStore100PtsSar: crossStore,
    pointSharingEnabled,
    pointSharingStartDate,
    pointSharingEndDate,
    pointSharingAllowedMerchantIds,
  };

  const nextVersionNum =
    db.networkRuleVersions.length > 0
      ? Math.max(...db.networkRuleVersions.map((v) => v.version)) + 1
      : 1;
  db.networkRuleVersions.unshift({
    version: nextVersionNum,
    sameStore100PtsSar: sameStore,
    crossStore100PtsSar: crossStore,
    pointSharingEnabled,
    pointSharingStartDate,
    pointSharingEndDate,
    pointSharingAllowedMerchantIds,
    updatedAt: new Date().toLocaleString('sv-SE').slice(0, 16),
    updatedBy: `${user.firstName} ${user.lastName}`,
  });

  const auditLog = appendAuditLog({
    actorName: `${user.firstName} ${user.lastName}`,
    actorRole: user.role,
    action: 'تغيير قواعد وإعدادات مشاركة النقاط في الشبكة',
    target: `Network Rules v${nextVersionNum}`,
    oldValue: `مشاركة النقاط: ${prev.pointSharingEnabled ? 'مفعلة' : 'معطلة'} | داخل: ${prev.sameStore100PtsSar} | خارج: ${prev.crossStore100PtsSar}`,
    newValue: `مشاركة النقاط: ${pointSharingEnabled ? 'مفعلة' : 'معطلة'} (${pointSharingStartDate} إلى ${pointSharingEndDate}) | داخل: ${sameStore} | خارج: ${crossStore}`,
    ip,
  });

  return NextResponse.json({
    networkRules: db.networkRules,
    networkRuleVersions: db.networkRuleVersions,
    auditLog,
  });
}
