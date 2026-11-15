import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { computeDerivedCustomerTotalPoints, getDb } from '@/lib/server/db';
import { appendAuditLog, enforcePolicy } from '@/lib/server/policy';
import { rlsFilterTickets } from '@/lib/server/rls';
import { maskPhone } from '@/lib/server/auth';
import type {
  DisputeCategory,
  FinancialAdjustmentRequest,
  SupportTicket,
  TicketWorkflowStatus,
  Transaction,
} from '@/lib/types';

export async function GET(req: NextRequest) {
  const guard = enforcePolicy(req, 'tickets.list');
  if (!guard.ok) return guard.response;

  const user = guard.ctx.user!;
  const db = getDb();
  const isAdminOrSupport = user.role === 'PLATFORM_ADMIN' || user.role === 'SUPPORT_AGENT';

  return NextResponse.json({
    tickets: rlsFilterTickets(db.tickets, user),
    financialAdjustments: isAdminOrSupport ? db.financialAdjustments : [],
    cannedResponses: isAdminOrSupport ? db.cannedResponses : [],
  });
}

export async function POST(req: NextRequest) {
  const guard = enforcePolicy(req, 'tickets.create');
  if (!guard.ok) return guard.response;

  const user = guard.ctx.user!;
  const body = await req.json().catch(() => ({}));
  const subject = String(body.subject || '').trim();
  const message = String(body.message || '').trim();
  const invoiceRef = typeof body.invoiceRef === 'string' ? body.invoiceRef.trim() : undefined;
  const disputeCategory = (body.disputeCategory as DisputeCategory) || 'نقاط';

  if (!subject || !message) {
    return NextResponse.json({ error: 'يرجى كتابة عنوان التذكرة وتفاصيلها.' }, { status: 400 });
  }

  const db = getDb();
  const store = user.merchantId ? db.stores.find((s) => s.merchantId === user.merchantId) : undefined;

  const ticket: SupportTicket = {
    id: `tkt-${crypto.randomUUID().slice(0, 6)}`,
    userType: user.role === 'CUSTOMER' ? 'عميل' : 'تاجر',
    userName: `${user.firstName} ${user.lastName}`,
    subject,
    message,
    status: 'جديدة',
    createdAt: new Date().toLocaleString('sv-SE').slice(0, 16),
    merchantId: user.merchantId || store?.merchantId,
    storeName: store?.name || 'عام',
    customerId: user.role === 'CUSTOMER' ? user.id : undefined,
    customerPhoneMasked: maskPhone(user.phone),
    invoiceRef,
    disputeCategory,
    priority: 'متوسطة',
    slaHours: 8,
    slaDeadlineAt: new Date(Date.now() + 8 * 3600 * 1000).toLocaleString('sv-SE').slice(0, 16),
    assignedToName: 'ريم الحربي (وكيل الدعم)',
    escalatedToAdmin: false,
    notes: [],
  };

  db.tickets.unshift(ticket);

  appendAuditLog({
    actorName: `${user.firstName} ${user.lastName}`,
    actorRole: user.role,
    action: 'إنشاء تذكرة دعم / اعتراض جديد',
    target: `${ticket.id} (${subject})`,
    oldValue: '-',
    newValue: ticket.status,
    ip: guard.ctx.ip,
  });

  return NextResponse.json({ ticket, tickets: rlsFilterTickets(db.tickets, user) }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const guard = enforcePolicy(req, 'tickets.resolve');
  if (!guard.ok) return guard.response;

  const user = guard.ctx.user!;
  const ip = guard.ctx.ip;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'update_status');
  const db = getDb();

  if (action === 'direct_financial_edit' || (action === 'review_financial_adjustment' && user.role !== 'PLATFORM_ADMIN')) {
    return NextResponse.json(
      {
        error:
          'غير مصرح لوكيل الدعم (U6) بالتعديل المالي المباشر. يتم أي تصحيح مالي حصراً عبر طلب للأدمن وينتج قيداً عكسياً.',
      },
      { status: 403 }
    );
  }

  if (action === 'add_note') {
    const ticketId = String(body.ticketId || '');
    const text = String(body.text || '').trim();
    const ticket = db.tickets.find((t) => t.id === ticketId);
    if (!ticket || !text) {
      return NextResponse.json({ error: 'التذكرة أو نص الملاحظة غير صالح.' }, { status: 400 });
    }
    const note = {
      id: `note-${crypto.randomUUID().slice(0, 6)}`,
      authorName: `${user.firstName} ${user.lastName}`,
      authorRole: user.role,
      text,
      createdAt: new Date().toLocaleString('sv-SE').slice(0, 16),
    };
    ticket.notes = [...(ticket.notes || []), note];
    if (ticket.status === 'جديدة' || ticket.status === 'مفتوحة') {
      ticket.status = 'قيد المعالجة';
    }

    const auditLog = appendAuditLog({
      actorName: `${user.firstName} ${user.lastName}`,
      actorRole: user.role,
      action: 'إضافة ملاحظة معالجة على تذكرة دعم',
      target: ticket.id,
      oldValue: `ملاحظات (${(ticket.notes?.length || 1) - 1})`,
      newValue: text.slice(0, 60),
      ip,
    });

    return NextResponse.json({ ticket, tickets: db.tickets, auditLog });
  }

  if (action === 'escalate') {
    const ticketId = String(body.ticketId || '');
    const reason = String(body.reason || 'يتطلب مراجعة واعتماد مدير المنصة').trim();
    const ticket = db.tickets.find((t) => t.id === ticketId);
    if (!ticket) {
      return NextResponse.json({ error: 'التذكرة غير موجودة.' }, { status: 404 });
    }
    ticket.escalatedToAdmin = true;
    ticket.status = 'قيد المعالجة';
    ticket.assignedToName = 'عبدالعزيز المنصور (مدير المنصة)';
    ticket.notes = [
      ...(ticket.notes || []),
      {
        id: `note-${crypto.randomUUID().slice(0, 6)}`,
        authorName: `${user.firstName} ${user.lastName}`,
        authorRole: user.role,
        text: `تصعيد التذكرة لمدير المنصة: ${reason}`,
        createdAt: new Date().toLocaleString('sv-SE').slice(0, 16),
      },
    ];

    const auditLog = appendAuditLog({
      actorName: `${user.firstName} ${user.lastName}`,
      actorRole: user.role,
      action: 'تحويل وتصعيد تذكرة دعم لمدير المنصة',
      target: ticket.id,
      oldValue: 'فريق الدعم (U6)',
      newValue: `مصعدة للأدمن (${reason})`,
      ip,
    });

    return NextResponse.json({ ticket, tickets: db.tickets, auditLog });
  }

  if (action === 'request_financial_adjustment') {
    const ticketId = String(body.ticketId || '');
    const originalTransactionId = String(body.originalTransactionId || 'tx-1001');
    const requestedPointsDelta = Number(body.requestedPointsDelta || 0);
    const requestedAmountSar = Number(body.requestedAmountSar || 0);
    const reason = String(body.reason || '').trim();

    if (!reason || (requestedPointsDelta === 0 && requestedAmountSar === 0)) {
      return NextResponse.json(
        { error: 'يرجى تحديد قيمة التسوية المطلوبة وسبب التصحيح المالي.' },
        { status: 400 }
      );
    }

    const tx = db.transactions.find((t) => t.id === originalTransactionId) || db.transactions[0];
    const ticket = db.tickets.find((t) => t.id === ticketId);

    const reqItem: FinancialAdjustmentRequest = {
      id: `adj-${crypto.randomUUID().slice(0, 6)}`,
      ticketId: ticket?.id || ticketId || 'tkt-501',
      storeId: tx?.storeId || 'store-1',
      storeName: tx?.storeName || ticket?.storeName || 'محمصة كيان المختصة',
      customerId: tx?.customerId || ticket?.customerId || 'cust-1',
      customerName: tx?.customerName || ticket?.userName || 'فهد العتيبي',
      originalTransactionId: tx?.id || originalTransactionId,
      requestedPointsDelta,
      requestedAmountSar,
      reason,
      requestedByAgentName: `${user.firstName} ${user.lastName} (${user.role})`,
      status: 'pending_admin',
      createdAt: new Date().toLocaleString('sv-SE').slice(0, 16),
    };

    db.financialAdjustments.unshift(reqItem);
    if (ticket) {
      ticket.escalatedToAdmin = true;
      ticket.status = 'قيد المعالجة';
      ticket.notes = [
        ...(ticket.notes || []),
        {
          id: `note-${crypto.randomUUID().slice(0, 6)}`,
          authorName: `${user.firstName} ${user.lastName}`,
          authorRole: user.role,
          text: `تم رفع طلب تصحيح مالي للأدمن (#${reqItem.id}): ${requestedPointsDelta} نقطة — ${reason}`,
          createdAt: reqItem.createdAt,
        },
      ];
    }

    const auditLog = appendAuditLog({
      actorName: `${user.firstName} ${user.lastName}`,
      actorRole: user.role,
      action: 'رفع طلب تصحيح مالي للأدمن (بدون تعديل مباشر)',
      target: `${reqItem.id} (تذكرة ${reqItem.ticketId})`,
      oldValue: 'قيد المراجعة',
      newValue: `طلب ${requestedPointsDelta > 0 ? `+${requestedPointsDelta}` : requestedPointsDelta} نقطة`,
      ip,
    });

    return NextResponse.json(
      {
        adjustment: reqItem,
        financialAdjustments: db.financialAdjustments,
        tickets: db.tickets,
        auditLog,
      },
      { status: 201 }
    );
  }

  if (action === 'review_financial_adjustment') {
    const adjustmentId = String(body.adjustmentId || '');
    const decision = body.decision === 'approved' ? 'approved' : 'rejected';
    const adj = db.financialAdjustments.find((a) => a.id === adjustmentId);
    if (!adj) {
      return NextResponse.json({ error: 'طلب التصحيح المالي غير موجود.' }, { status: 404 });
    }
    if (adj.status !== 'pending_admin') {
      return NextResponse.json({ error: 'تمت معالجة هذا الطلب مسبقاً.' }, { status: 400 });
    }

    adj.status = decision;
    adj.reviewedByAdminName = `${user.firstName} ${user.lastName}`;
    adj.reviewedAt = new Date().toLocaleString('sv-SE').slice(0, 16);

    let reversalTx: Transaction | undefined;
    if (decision === 'approved') {
      const store = db.stores.find((s) => s.id === adj.storeId) || db.stores[0];
      const cust = db.customers.get(adj.customerId);
      if (cust && store) {
        const card = cust.cards.find((c) => c.merchantId === store.merchantId);
        if (card) {
          card.currentBalance = Math.max(0, card.currentBalance + adj.requestedPointsDelta);
          if (adj.requestedPointsDelta > 0) {
            card.totalEarned += adj.requestedPointsDelta;
          }
        }
        cust.totalPointsAcrossAllStores = computeDerivedCustomerTotalPoints(cust.cards);
      }

      reversalTx = {
        id: `tx-rev-${crypto.randomUUID().slice(0, 6)}`,
        merchantId: store?.merchantId || 'merch-1',
        branchId: store?.branches[0]?.id || 'b-1',
        storeId: adj.storeId,
        storeName: adj.storeName,
        customerId: adj.customerId,
        customerName: adj.customerName,
        cashierId: user.id,
        cashierName: `${user.firstName} ${user.lastName} (أدمن)`,
        branchName: store?.branches[0]?.name || 'الفرع الرئيسي',
        invoiceNumber: `REV-${adj.originalTransactionId.toUpperCase()}`,
        amount: adj.requestedAmountSar,
        currency: store?.currency || 'SAR',
        pointsEarned: adj.requestedPointsDelta,
        type: 'refund',
        ruleVersion: 'v2.0',
        timestamp: adj.reviewedAt,
        createdAtMs: Date.now(),
        refundedTxId: adj.originalTransactionId,
        notes: `قيد عكسي معتمد من الأدمن للتذكرة ${adj.ticketId}: ${adj.reason}`,
      };
      db.transactions.unshift(reversalTx);
      adj.reversalTransactionId = reversalTx.id;

      const linkedTicket = db.tickets.find((t) => t.id === adj.ticketId);
      if (linkedTicket) {
        linkedTicket.status = 'محلولة';
      }
    }

    const auditLog = appendAuditLog({
      actorName: `${user.firstName} ${user.lastName}`,
      actorRole: user.role,
      action:
        decision === 'approved'
          ? 'اعتماد طلب تصحيح مالي وإنشاء قيد عكسي'
          : 'رفض طلب تصحيح مالي من الدعم',
      target: `${adj.id} (${adj.customerName})`,
      oldValue: 'pending_admin',
      newValue:
        decision === 'approved'
          ? `approved · قيد عكسي ${reversalTx?.invoiceNumber} (${adj.requestedPointsDelta} نقطة)`
          : 'rejected',
      ip,
    });

    return NextResponse.json({
      adjustment: adj,
      reversalTransaction: reversalTx,
      financialAdjustments: db.financialAdjustments,
      transactions: db.transactions,
      tickets: db.tickets,
      auditLog,
    });
  }

  if (action === 'add_canned_response') {
    const title = String(body.title || '').trim();
    const category = (body.category as DisputeCategory | 'عام') || 'عام';
    const responseBody = String(body.body || '').trim();
    if (!title || !responseBody) {
      return NextResponse.json({ error: 'عنوان ونص الرد الجاهز مطلوبان.' }, { status: 400 });
    }
    const created = {
      id: `can-${crypto.randomUUID().slice(0, 6)}`,
      title,
      category,
      body: responseBody,
    };
    db.cannedResponses.unshift(created);
    return NextResponse.json({ cannedResponse: created, cannedResponses: db.cannedResponses });
  }

  const ticketId = String(body.ticketId || body.id || '');
  const nextStatus = (body.status as TicketWorkflowStatus) || 'محلولة';
  const ticket = db.tickets.find((t) => t.id === ticketId);
  if (!ticket) {
    return NextResponse.json({ error: 'التذكرة غير موجودة.' }, { status: 404 });
  }

  const prevStatus = ticket.status;
  ticket.status = nextStatus;

  const auditLog = appendAuditLog({
    actorName: `${user.firstName} ${user.lastName}`,
    actorRole: user.role,
    action: 'تحديث حالة تذكرة دعم فني',
    target: `${ticket.id} (${ticket.subject})`,
    oldValue: prevStatus,
    newValue: nextStatus,
    ip,
  });

  return NextResponse.json({ ticket, tickets: db.tickets, auditLog });
}
