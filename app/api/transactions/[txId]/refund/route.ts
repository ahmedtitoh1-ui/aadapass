import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { computeDerivedCustomerTotalPoints, getDb } from '@/lib/server/db';
import { appendAuditLog, enforcePolicy } from '@/lib/server/policy';
import { withTenant } from '@/lib/server/rls';
import { Transaction } from '@/lib/types';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ txId: string }> }
) {
  const { txId } = await context.params;
  const db = getDb();
  const tx = db.transactions.find((t) => t.id === txId);
  if (!tx) {
    return NextResponse.json({ error: 'المعاملة غير موجودة.' }, { status: 404 });
  }

  const guard = enforcePolicy(req, 'transactions.refund', { merchantId: tx.merchantId });
  if (!guard.ok) return guard.response;

  const user = guard.ctx.user!;
  const tenantCheck = withTenant(user, tx.merchantId, (scope) => scope, tx.branchId);
  if (!tenantCheck.ok) {
    return NextResponse.json({ error: tenantCheck.error }, { status: tenantCheck.status });
  }

  const alreadyReversed =
    tx.type === 'refund' || db.transactions.some((t) => t.refundedTxId === tx.id);
  if (alreadyReversed) {
    return NextResponse.json({ error: 'تم استرجاع هذه الفاتورة بقيد عكسي مسبقاً.' }, { status: 400 });
  }

  const unitsToReverse = tx.type === 'stamp' ? 1 : Math.max(0, tx.pointsEarned);
  const cust = db.customers.get(tx.customerId);
  let refundLoss = 0;

  if (cust && unitsToReverse > 0) {
    const card = cust.cards.find((c) => c.merchantId === tx.merchantId);
    if (card) {
      const deducted = Math.min(card.currentBalance, unitsToReverse);
      refundLoss = Math.max(0, unitsToReverse - deducted);
      card.currentBalance = Math.max(0, card.currentBalance - unitsToReverse);
    } else {
      refundLoss = unitsToReverse;
    }
    cust.totalPointsAcrossAllStores = computeDerivedCustomerTotalPoints(cust.cards);
  }

  const nowTime = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  const reverseTx: Transaction = {
    id: `tx-ref-${crypto.randomUUID().slice(0, 8)}`,
    merchantId: tx.merchantId,
    branchId: tx.branchId,
    storeId: tx.storeId,
    storeName: tx.storeName,
    customerId: tx.customerId,
    customerName: tx.customerName,
    cashierId: user.id,
    cashierName: `${user.firstName} ${user.lastName}`,
    branchName: tx.branchName,
    invoiceNumber: `REF-${tx.invoiceNumber}`,
    amount: -Math.abs(tx.amount),
    currency: tx.currency,
    pointsEarned: -unitsToReverse,
    type: 'refund',
    timestamp: `استرجاع ${nowTime}`,
    createdAtMs: Date.now(),
    ruleVersion: tx.ruleVersion,
    refundedTxId: tx.id,
    refundLoss,
    notes:
      refundLoss > 0
        ? `قيد عكسي للفاتورة ${tx.invoiceNumber} — خسارة استرجاع: ${refundLoss} (العميل أنفق النقاط مسبقاً)`
        : `قيد عكسي لاسترجاع الفاتورة ${tx.invoiceNumber}`,
  };

  tx.refundRequested = false;
  tx.notes = `مسترجعة (قيد عكسي #${reverseTx.invoiceNumber})`;
  db.transactions.unshift(reverseTx);

  const store = db.stores.find((s) => s.merchantId === tx.merchantId);
  if (store) {
    store.metrics.refundLossTotal = (store.metrics.refundLossTotal || 0) + refundLoss;
    if (store.metrics.monthlySales >= tx.amount) {
      store.metrics.monthlySales = Math.max(0, store.metrics.monthlySales - tx.amount);
    }
  }

  const log = appendAuditLog({
    actorName: `${user.firstName} ${user.lastName}`,
    actorRole: user.role,
    action: refundLoss > 0 ? 'استرجاع فاتورة بقيد عكسي + خسارة استرجاع' : 'استرجاع فاتورة بقيد عكسي',
    target: `فاتورة ${tx.invoiceNumber} (${tx.storeName})`,
    oldValue: `+${unitsToReverse} ${tx.type === 'stamp' ? 'ختم' : 'نقطة'}`,
    newValue:
      refundLoss > 0
        ? `قيد عكسي -${unitsToReverse} | خسارة استرجاع: ${refundLoss}`
        : `قيد عكسي -${unitsToReverse}`,
    ip: guard.ctx.ip,
  });

  return NextResponse.json({
    transaction: tx,
    reverseTransaction: reverseTx,
    refundLoss,
    store: store || null,
    customer: cust || null,
    auditLog: log,
  });
}
