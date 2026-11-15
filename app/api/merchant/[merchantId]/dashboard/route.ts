import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { enforcePolicy } from '@/lib/server/policy';
import { rlsFilterTickets, rlsFilterTransactions, withTenant } from '@/lib/server/rls';
import { MerchantCrmCustomerDTO } from '@/lib/types';

function maskPhoneNumber(phone: string): string {
  const clean = phone.trim();
  if (clean.length <= 7) return '****';
  return `${clean.slice(0, 6)}****${clean.slice(-3)}`;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ merchantId: string }> }
) {
  const { merchantId } = await context.params;
  const guard = enforcePolicy(req, 'merchant.dashboard', { merchantId });
  if (!guard.ok) return guard.response;

  const actor = guard.ctx.user!;
  const db = getDb();
  const store = db.stores.find((s) => s.merchantId === merchantId || s.id === merchantId);
  if (!store) {
    return NextResponse.json({ error: 'المتجر غير موجود.' }, { status: 404 });
  }

  const tenantCheck = withTenant(actor, store.merchantId, (scope) => scope);
  if (!tenantCheck.ok) {
    return NextResponse.json({ error: tenantCheck.error }, { status: tenantCheck.status });
  }

  const scopedTxs = rlsFilterTransactions(db.transactions, actor).filter(
    (t) => t.merchantId === store.merchantId
  );

  // Scoped disputes / support tickets for this merchant
  const scopedTickets = rlsFilterTickets(db.tickets, actor);

  // Staff activity summary (tx count & volume per cashier/manager)
  const staffActivity: Record<string, { txCount: number; totalAmount: number }> = {};
  for (const tx of scopedTxs) {
    if (!tx.cashierId) continue;
    if (!staffActivity[tx.cashierId]) {
      staffActivity[tx.cashierId] = { txCount: 0, totalAmount: 0 };
    }
    staffActivity[tx.cashierId].txCount += 1;
    staffActivity[tx.cashierId].totalAmount += Math.max(0, tx.amount);
  }

  // Privacy-minimal CRM customer rows (masked phone, visits count, store balance, segment)
  const crmCustomers: MerchantCrmCustomerDTO[] = [];
  for (const cust of db.customers.values()) {
    const storeCard = cust.cards.find((c) => c.merchantId === store.merchantId);
    const custTxs = scopedTxs.filter((t) => t.customerId === cust.id && t.type !== 'refund');
    if (!storeCard && custTxs.length === 0) continue;

    const visitsCount = Math.max(custTxs.length, storeCard && storeCard.totalEarned > 0 ? 1 : 0);
    const storeBalance = storeCard?.currentBalance ?? 0;
    const totalEarnedInStore = storeCard?.totalEarned ?? 0;
    const lastTx = custTxs[0];
    const lastVisit = lastTx ? lastTx.timestamp : 'هذا الأسبوع';

    let segment: MerchantCrmCustomerDTO['segment'] = 'جدد';
    if (totalEarnedInStore >= 1000 || visitsCount >= 5) {
      segment = 'VIP';
    } else if (visitsCount >= 2) {
      segment = 'عائدون';
    } else if (visitsCount === 0) {
      segment = 'غير نشطين';
    }

    crmCustomers.push({
      id: cust.id,
      displayName: `${cust.firstName} ${cust.lastName}`,
      maskedPhone: maskPhoneNumber(cust.phone),
      visitsCount,
      storeBalance,
      totalEarnedInStore,
      lastVisit,
      segment,
      currency: store.currency,
    });
  }

  const pointsGranted =
    store.metrics.pointsGranted ??
    scopedTxs.reduce((acc, t) => (t.pointsEarned > 0 ? acc + t.pointsEarned : acc), 0);
  const rewardsRedeemed =
    store.metrics.rewardsRedeemed ??
    scopedTxs.filter((t) => t.type === 'redemption').length;

  return NextResponse.json({
    store,
    metrics: {
      ...store.metrics,
      pointsGranted,
      rewardsRedeemed,
      refundLossTotal: store.metrics.refundLossTotal ?? 0,
    },
    visitorSeries: store.visitorSeries,
    transactions: scopedTxs,
    tickets: scopedTickets,
    staffActivity,
    crmCustomers,
  });
}
