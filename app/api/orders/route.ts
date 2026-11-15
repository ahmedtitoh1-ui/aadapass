import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/policy';
import { OnlineOrder, OrderItem } from '@/lib/types';

function buildWhatsAppOrderMessage(order: OnlineOrder): string {
  const itemsText = order.items
    .map((item) => `• ${item.quantity}x ${item.title} (${item.price * item.quantity} ${order.currency})`)
    .join('\n');

  const deliveryOrPickup =
    order.orderType === 'DELIVERY'
      ? `🚚 توصيل إلى:\n📍 ${order.deliveryAddress || 'العنوان المسجل'}`
      : `🏃 استلام من الفرع:\n🏢 ${order.branchName}\n⏰ الموعد: ${order.pickupTime || 'خلال 20-30 دقيقة'}`;

  const notesText = order.customerNotes ? `\n📝 ملاحظات خاصة: ${order.customerNotes}` : '';

  return `*طلب جديد عبر Aada Pass* 🛍️
-----------------------------------
📋 *رقم الطلب:* #${order.orderNumber}
🏪 *المتجر:* ${order.storeName}
👤 *العميل:* ${order.customerName}
📱 *الهاتف:* ${order.customerPhone}
-----------------------------------
${deliveryOrPickup}
-----------------------------------
*الأصناف المطلوبة:*
${itemsText}
-----------------------------------
💵 *المجموع الفرعي:* ${order.subtotal} ${order.currency}
🛵 *رسوم التوصيل:* ${order.deliveryFee} ${order.currency}
💰 *الإجمالي النهائي:* ${order.total} ${order.currency}
💳 *طريقة الدفع:* ${
    order.paymentMethod === 'CASH_ON_DELIVERY'
      ? 'الدفع نقداً عند الاستلام'
      : order.paymentMethod === 'CARD_ON_DELIVERY'
      ? 'شبكة / بطاقة عند الاستلام'
      : 'الدفع عند الاستلام بالفرع'
  }${notesText}
-----------------------------------
تاريخ الطلب: ${new Date(order.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
تتبع حالة الطلب في منصة Aada Pass: https://aadapass.sa/portal?tab=orders`;
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const user = authenticateRequest(req);
  const { searchParams } = new URL(req.url);
  const storeIdParam = searchParams.get('storeId');
  const orderNumberParam = searchParams.get('orderNumber');

  if (orderNumberParam) {
    const found = db.orders.find((o) => o.orderNumber.toUpperCase() === orderNumberParam.toUpperCase().trim());
    if (found) {
      return NextResponse.json({ order: found });
    }
    return NextResponse.json({ error: 'لم يتم العثور على الطلب.' }, { status: 404 });
  }

  if (!user) {
    return NextResponse.json({ orders: [] });
  }

  let filtered = [...db.orders];

  if (user.role === 'CUSTOMER') {
    filtered = filtered.filter(
      (o) => o.customerId === user.id || o.customerPhone === user.phone
    );
  } else if (user.role === 'CASHIER' || user.role === 'MERCHANT_OWNER' || user.role === 'MERCHANT_MANAGER') {
    if (user.merchantId) {
      filtered = filtered.filter((o) => o.merchantId === user.merchantId);
      if (user.role === 'CASHIER' && user.branchId) {
        filtered = filtered.filter((o) => !o.branchId || o.branchId === user.branchId);
      }
    }
  }

  if (storeIdParam) {
    filtered = filtered.filter((o) => o.storeId === storeIdParam);
  }

  return NextResponse.json({ orders: filtered });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const user = authenticateRequest(req);
  const body = await req.json().catch(() => ({}));

  const {
    storeId,
    branchId,
    items,
    orderType = 'DELIVERY',
    deliveryAddress,
    pickupTime,
    customerNotes,
    paymentMethod = 'CASH_ON_DELIVERY',
    guestName,
    guestPhone,
  } = body;

  if (!storeId) {
    return NextResponse.json({ error: 'معرّف المتجر مطلوب.' }, { status: 400 });
  }

  const store = db.stores.find((s) => s.id === storeId);
  if (!store) {
    return NextResponse.json({ error: 'المتجر غير موجود.' }, { status: 404 });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'يجب اختيار صنف واحد على الأقل في السلة.' }, { status: 400 });
  }

  const customerId = user ? user.id : `guest-${crypto.randomUUID().slice(0, 6)}`;
  const customerName =
    (user ? `${user.firstName} ${user.lastName}`.trim() : guestName) ||
    'عميل المتجر';
  const customerPhone =
    (user ? user.phone : guestPhone) || '+966500000000';

  if (!customerPhone || customerPhone.length < 8) {
    return NextResponse.json({ error: 'رقم جوال العميل مطلوب لتأكيد الطلب وتجهيز الواتساب.' }, { status: 400 });
  }

  const branch =
    store.branches.find((b) => b.id === branchId) ||
    store.branches[0] || {
      id: 'b-default',
      name: store.name,
    };

  const calculatedItems: OrderItem[] = items.map(
    (it: {
      menuItemId?: unknown;
      id?: unknown;
      title?: unknown;
      name?: unknown;
      quantity?: unknown;
      price?: unknown;
      selectedOption?: unknown;
      notes?: unknown;
    }) => ({
      menuItemId: String(it.menuItemId || it.id || ''),
      title: String(it.title || it.name || 'صنف'),
      quantity: Math.max(1, parseInt(String(it.quantity ?? '1'), 10) || 1),
      price: Math.max(0, parseFloat(String(it.price ?? '0')) || 0),
      selectedOption: it.selectedOption ? String(it.selectedOption) : undefined,
      notes: it.notes ? String(it.notes) : undefined,
    })
  );

  const subtotal = calculatedItems.reduce((acc, it) => acc + it.price * it.quantity, 0);
  const deliveryFee = orderType === 'DELIVERY' ? (store.deliveryFee ?? 15) : 0;
  const discount = Math.max(0, parseFloat(body.discount) || 0);
  const total = Math.max(0, subtotal + deliveryFee - discount);

  const orderNumber = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  const order: OnlineOrder = {
    id: `ord-${crypto.randomUUID().slice(0, 8)}`,
    orderNumber,
    storeId: store.id,
    storeName: store.name,
    merchantId: store.merchantId,
    branchId: branch.id,
    branchName: branch.name,
    customerId,
    customerName,
    customerPhone,
    orderType: orderType === 'PICKUP' ? 'PICKUP' : 'DELIVERY',
    deliveryAddress: orderType === 'DELIVERY' ? String(deliveryAddress || 'العنوان الرئيسي للعميل') : undefined,
    pickupTime: orderType === 'PICKUP' ? String(pickupTime || 'خلال 20-30 دقيقة') : undefined,
    items: calculatedItems,
    subtotal,
    deliveryFee,
    discount,
    total,
    currency: store.currency || 'SAR',
    status: 'PENDING',
    paymentMethod,
    customerNotes: customerNotes ? String(customerNotes) : undefined,
    createdAt: now,
    updatedAt: now,
  };

  const storePhone = store.whatsappOrdersNumber || store.phone || '+966501112233';
  const cleanStorePhone = storePhone.replace(/[^0-9]/g, '');
  const messageText = buildWhatsAppOrderMessage(order);
  order.whatsappMessage = messageText;

  const whatsappUrl = `https://wa.me/${cleanStorePhone}?text=${encodeURIComponent(messageText)}`;

  db.orders.unshift(order);

  return NextResponse.json({
    ok: true,
    order,
    whatsappUrl,
    message: 'تم تسجيل الطلب وتجهيز رسالة الواتساب بنجاح!',
  }, { status: 201 });
}
