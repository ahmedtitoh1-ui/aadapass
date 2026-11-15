import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/server/db';
import { appendAuditLog, enforcePolicy } from '@/lib/server/policy';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ txId: string }> }
) {
  const { txId } = await context.params;
  const db = getDb();
  const tx = db.transactions.find((t) => t.id === txId);
  if (!tx) {
    return NextResponse.json({ error: 'العملية غير موجودة.' }, { status: 404 });
  }

  const guard = enforcePolicy(req, 'transactions.requestRefund', {
    merchantId: tx.merchantId,
    branchId: tx.branchId,
  });
  if (!guard.ok) return guard.response;

  const user = guard.ctx.user!;
  if (user.role === 'CASHIER' && tx.cashierId && tx.cashierId !== user.id) {
    return NextResponse.json(
      { error: 'يمكن للكاشير تقديم طلب استرجاع لعملياته المسجلة فقط.' },
      { status: 403 }
    );
  }
  if (tx.type === 'refund') {
    return NextResponse.json({ error: 'تم استرجاع هذه الفاتورة مسبقاً.' }, { status: 400 });
  }
  if (tx.refundRequested) {
    return NextResponse.json({ error: 'تم إرسال طلب استرجاع لهذه الفاتورة مسبقاً وهو قيد المراجعة.' }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'طلب استرجاع من الكاشير';

  tx.refundRequested = true;
  tx.refundRequestReason = reason;
  tx.refundRequestedBy = `${user.firstName} ${user.lastName}`;

  const ticket = {
    id: `tkt-${crypto.randomUUID().slice(0, 6)}`,
    merchantId: tx.merchantId,
    userType: 'تاجر' as const,
    userName: `${user.firstName} ${user.lastName} (كاشير)`,
    subject: `طلب استرجاع فاتورة #${tx.invoiceNumber}`,
    invoiceRef: tx.invoiceNumber,
    message: `الكاشير: ${user.firstName} ${user.lastName} • الفرع: ${tx.branchName} • العميل: ${tx.customerName} • السبب: ${reason}`,
    status: 'قيد المراجعة' as const,
    createdAt: new Date().toLocaleString('ar-SA', { hour12: true }),
  };
  db.tickets.unshift(ticket);

  appendAuditLog({
    actorName: `${user.firstName} ${user.lastName}`,
    actorRole: user.role,
    action: 'طلب استرجاع فاتورة (بانتظار موافقة المالك/المدير)',
    target: `فاتورة ${tx.invoiceNumber}`,
    oldValue: 'عملية مؤكدة',
    newValue: `طلب استرجاع: ${reason}`,
    ip: guard.ctx.ip,
  });

  return NextResponse.json({ ok: true, transaction: tx, ticket });
}
