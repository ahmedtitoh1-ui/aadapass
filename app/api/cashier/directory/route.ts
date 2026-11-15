import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { enforcePolicy } from '@/lib/server/policy';
import { getEd25519PublicJwk } from '@/lib/server/crypto';

export async function GET(req: NextRequest) {
  const guard = enforcePolicy(req, 'cashier.directory.get');
  if (!guard.ok) return guard.response;

  const user = guard.ctx.user!;
  const db = getDb();
  const store = db.stores.find((s) => s.merchantId === user.merchantId);
  if (!store) {
    return NextResponse.json({ error: 'تعذر العثور على المتجر المقيد لهذا الموظف.' }, { status: 404 });
  }

  const allowedBranchIds =
    user.branchIds && user.branchIds.length > 0 ? user.branchIds : user.branchId ? [user.branchId] : [];
  const branches =
    user.role === 'CASHIER' && allowedBranchIds.length > 0
      ? store.branches.filter((b) => allowedBranchIds.includes(b.id))
      : store.branches;

  return NextResponse.json({
    merchantId: store.merchantId,
    storeId: store.id,
    storeName: store.name,
    currency: store.currency,
    publicKeyJwk: getEd25519PublicJwk(),
    revokedQrKeyIds: Array.from(db.revokedQrKeyIds),
    activeRuleVersion: store.programs.find((p) => p.status === 'فعال')?.version || 2,
    loyaltyRule: store.loyaltyRule,
    branches: branches.map((b) => ({ id: b.id, name: b.name, city: b.city })),
    limits: {
      maxTxAmount: store.maxTxAmount ?? 5000,
      dailyCustomerCap: store.dailyCustomerCap ?? 1500,
      dailyCashierCap: store.dailyCashierCap ?? 20000,
      offlineCustomerHourlyCapPoints: 250,
      offlineCustomerHourlyMaxScans: 3,
    },
    syncedAt: Date.now(),
  });
}
