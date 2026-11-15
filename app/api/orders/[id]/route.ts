import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/policy';
import { OrderStatus } from '@/lib/types';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const db = getDb();
  const user = authenticateRequest(req);
  const { id } = await context.params;

  if (!user) {
    return NextResponse.json({ error: 'يجب تسجيل الدخول ككاشير أو تاجر لإدارة الطلب.' }, { status: 401 });
  }

  if (user.role === 'CUSTOMER') {
    return NextResponse.json({ error: 'ليس لديك صلاحية لتعديل حالة الطلب.' }, { status: 403 });
  }

  const orderIndex = db.orders.findIndex((o) => o.id === id || o.orderNumber === id);
  if (orderIndex === -1) {
    return NextResponse.json({ error: 'الطلب غير موجود.' }, { status: 404 });
  }

  const order = db.orders[orderIndex];

  // Authorization check
  if (user.role !== 'PLATFORM_ADMIN') {
    if (user.merchantId && order.merchantId !== user.merchantId) {
      return NextResponse.json({ error: 'ليس لديك صلاحية لتعديل هذا الطلب.' }, { status: 403 });
    }
  }

  const body = await req.json().catch(() => ({}));
  const nextStatus = body.status as OrderStatus | undefined;
  const rejectionReason = body.rejectionReason as string | undefined;
  const merchantNotes = body.merchantNotes as string | undefined;

  const validStatuses: OrderStatus[] = [
    'PENDING',
    'ACCEPTED',
    'PREPARING',
    'READY',
    'OUT_FOR_DELIVERY',
    'COMPLETED',
    'REJECTED',
  ];

  if (nextStatus && !validStatuses.includes(nextStatus)) {
    return NextResponse.json({ error: 'حالة الطلب غير صالحة.' }, { status: 400 });
  }

  const updatedOrder = {
    ...order,
    ...(nextStatus ? { status: nextStatus } : {}),
    ...(rejectionReason !== undefined ? { rejectionReason } : {}),
    ...(merchantNotes !== undefined ? { merchantNotes } : {}),
    updatedAt: new Date().toISOString(),
  };

  db.orders[orderIndex] = updatedOrder;

  // Build a WhatsApp status notification for the customer
  const statusLabels: Record<OrderStatus, string> = {
    PENDING: 'قيد الانتظار والمراجعة ⏳',
    ACCEPTED: 'تم قبول طلبك بنجاح ✅',
    PREPARING: 'قيد التجهيز والتحضير بالمطبخ 🍳',
    READY: 'جاهز للاستلام من الفرع 🛍️',
    OUT_FOR_DELIVERY: 'خرج مع مندوب التوصيل 🛵',
    COMPLETED: 'تم التسليم بنجاح، شكراً لاختياركم لنا ❤️',
    REJECTED: `عذراً، تم تعذر تنفيذ الطلب: ${rejectionReason || 'غير متوفر حالياً'} ❌`,
  };

  const statusLabel = statusLabels[updatedOrder.status] || updatedOrder.status;
  const customerNotifyMsg = `مرحباً ${updatedOrder.customerName} 👋
تحديث بخصوص طلبك رقم #${updatedOrder.orderNumber} من ${updatedOrder.storeName}:

📢 *الحالة الحالية:* ${statusLabel}
${updatedOrder.orderType === 'DELIVERY' ? `العنوان: ${updatedOrder.deliveryAddress || ''}` : `الفرع: ${updatedOrder.branchName}`}
الإجمالي: ${updatedOrder.total} ${updatedOrder.currency}

نتشرف بخدمتك دائماً في ${updatedOrder.storeName}! ✨`;

  const cleanCustomerPhone = updatedOrder.customerPhone.replace(/[^0-9]/g, '');
  const customerNotifyWhatsAppUrl = cleanCustomerPhone
    ? `https://wa.me/${cleanCustomerPhone}?text=${encodeURIComponent(customerNotifyMsg)}`
    : undefined;

  return NextResponse.json({
    ok: true,
    order: updatedOrder,
    customerNotifyWhatsAppUrl,
    message: 'تم تحديث حالة الطلب بنجاح.',
  });
}
