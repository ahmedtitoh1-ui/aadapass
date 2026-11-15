'use client';

import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Minus,
  MessageCircle,
  Plus,
  ShoppingBag,
  Trash2,
  Truck,
  X,
  Store as StoreIcon,
  Phone,
  Sparkles,
} from 'lucide-react';
import type { CustomerProfile, MenuItem, OnlineOrder, OrderType, Store } from '@/lib/types';
import { formatCurrency } from '@/lib/i18n/ar';

interface CartItem {
  item: MenuItem;
  quantity: number;
  notes?: string;
}

interface OnlineOrderingModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: Store;
  customer?: CustomerProfile | null;
  onOrderSuccess?: (order: OnlineOrder) => void;
}

export default function OnlineOrderingModal({
  isOpen,
  onClose,
  store,
  customer,
  onOrderSuccess,
}: OnlineOrderingModalProps) {
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [orderType, setOrderType] = useState<OrderType>('DELIVERY');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    store.branches[0]?.id || ''
  );
  const [deliveryAddress, setDeliveryAddress] = useState<string>(
    store.area ? `حي ${store.area} - الشارع الرئيسي` : ''
  );
  const [pickupTime, setPickupTime] = useState<string>('خلال 20 - 30 دقيقة');
  const [customerName, setCustomerName] = useState<string>(
    customer ? `${customer.firstName} ${customer.lastName}`.trim() : ''
  );
  const [customerPhone, setCustomerPhone] = useState<string>(
    customer?.phone || ''
  );
  const [customerNotes, setCustomerNotes] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<
    'CASH_ON_DELIVERY' | 'CARD_ON_DELIVERY' | 'PAY_AT_BRANCH'
  >('CASH_ON_DELIVERY');

  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<OnlineOrder | null>(null);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    store.menu.forEach((m) => {
      if (m.category) set.add(m.category);
    });
    return ['الكل', ...Array.from(set)];
  }, [store.menu]);

  // Filtered menu
  const visibleItems = useMemo(() => {
    return store.menu.filter((m) => {
      if (!m.available) return false;
      if (selectedCategory === 'الكل') return true;
      return m.category === selectedCategory;
    });
  }, [store.menu, selectedCategory]);

  // Cart calculations
  const cartList = useMemo(() => Object.values(cart), [cart]);
  const cartItemsCount = useMemo(
    () => cartList.reduce((acc, it) => acc + it.quantity, 0),
    [cartList]
  );
  const subtotal = useMemo(
    () => cartList.reduce((acc, it) => acc + it.item.price * it.quantity, 0),
    [cartList]
  );
  const deliveryFee = orderType === 'DELIVERY' ? (store.deliveryFee ?? 15) : 0;
  const total = subtotal + deliveryFee;

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev[item.id];
      const nextQty = existing ? existing.quantity + 1 : 1;
      return {
        ...prev,
        [item.id]: { item, quantity: nextQty },
      };
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) => {
      const existing = prev[itemId];
      if (!existing) return prev;
      const nextQty = existing.quantity + delta;
      if (nextQty <= 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return {
        ...prev,
        [itemId]: { ...existing, quantity: nextQty },
      };
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const copy = { ...prev };
      delete copy[itemId];
      return copy;
    });
  };

  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (cartItemsCount === 0) {
      setErrorMessage('يرجى إضافة أصناف إلى السلة أولاً.');
      return;
    }

    const cleanPhone = customerPhone.trim();
    if (!cleanPhone || cleanPhone.length < 8) {
      setErrorMessage('يرجى إدخال رقم جوال العميل لتأكيد الطلب وتجهيز الواتساب.');
      return;
    }

    if (orderType === 'DELIVERY' && !deliveryAddress.trim()) {
      setErrorMessage('يرجى كتابة عنوان التوصيل بالتفصيل.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        storeId: store.id,
        branchId: selectedBranchId || store.branches[0]?.id,
        orderType,
        deliveryAddress: orderType === 'DELIVERY' ? deliveryAddress.trim() : undefined,
        pickupTime: orderType === 'PICKUP' ? pickupTime.trim() : undefined,
        guestName: customerName.trim() || 'عميل المتجر',
        guestPhone: cleanPhone,
        customerNotes: customerNotes.trim() || undefined,
        paymentMethod,
        items: cartList.map((c) => ({
          menuItemId: c.item.id,
          title: c.item.name,
          quantity: c.quantity,
          price: c.item.price,
          notes: c.notes,
        })),
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'تعذر إرسال الطلب، يرجى المحاولة مرة أخرى.');
      }

      setConfirmedOrder(data.order);
      setWhatsappUrl(data.whatsappUrl || null);
      if (onOrderSuccess) {
        onOrderSuccess(data.order);
      }

      // Automatically open WhatsApp in a new tab if supported
      if (data.whatsappUrl && typeof window !== 'undefined') {
        window.open(data.whatsappUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء إرسال الطلب.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      dir="rtl"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[#0B1F3A]/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <img
              src={store.logo}
              alt={store.name}
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 bg-white"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-[#0B1F3A] dark:text-white">
                  المتجر الإلكتروني — {store.name}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold text-[10px]">
                  مفتوح للطلب
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-sky-500" />
                  <span>توصيل: {store.deliveryFee ?? 15} {store.currency || 'ر.س'}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>وقت التجهيز: {store.estimatedDeliveryMinutes ?? 35} دقيقة</span>
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center hover:bg-slate-300 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {confirmedOrder ? (
          /* Confirmation Screen with WhatsApp confirmation */
          <div className="p-6 sm:p-10 space-y-6 text-center max-w-lg mx-auto overflow-y-auto">
            <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 mx-auto flex items-center justify-center shadow-md">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div className="space-y-2">
              <h4 className="text-xl font-black text-[#0B1F3A] dark:text-white">
                تم تسجيل وتأكيد طلبك بنجاح! 🎉
              </h4>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                رقم الطلب: <strong className="text-sky-600 font-mono text-base">#{confirmedOrder.orderNumber}</strong>
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                تم إرسال الطلب إلى لوحة كاشير ومطبخ <strong className="text-slate-700 dark:text-slate-200">{store.name}</strong>، وتم تجهيز رسالة تفصيلية لتأكيد الطلب مباشرة عبر الواتساب.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-right text-xs space-y-2">
              <div className="flex justify-between items-center text-emerald-900 dark:text-emerald-200 font-bold border-b border-emerald-200/60 pb-2">
                <span>نوع الطلب:</span>
                <span>{confirmedOrder.orderType === 'DELIVERY' ? '🚚 توصيل للمنزل' : '🏃 استلام من الفرع'}</span>
              </div>
              <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                <span>عدد الأصناف:</span>
                <span>{confirmedOrder.items.reduce((a, b) => a + b.quantity, 0)} أصناف</span>
              </div>
              <div className="flex justify-between items-center text-slate-900 dark:text-white font-black text-sm pt-1">
                <span>الإجمالي النهائي:</span>
                <span className="text-emerald-700 dark:text-emerald-300 font-mono">
                  {confirmedOrder.total} {confirmedOrder.currency}
                </span>
              </div>
            </div>

            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition cursor-pointer"
              >
                <MessageCircle className="w-5 h-5 fill-current" />
                <span>إعادة فتح رسالة الطلب عبر واتساب 💬</span>
                <ExternalLink className="w-4 h-4 opacity-70" />
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-200 transition cursor-pointer"
            >
              تم وإغلاق
            </button>
          </div>
        ) : (
          /* Main Ordering Layout: Menu on Right, Cart & Checkout on Left */
          <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-slate-200 dark:divide-slate-800">
            {/* Menu Section (7 cols) */}
            <div className="lg:col-span-7 flex flex-col overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
              {/* Category Pills */}
              <div className="p-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-white dark:bg-slate-900">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-[#0B1F3A] text-white shadow-xs dark:bg-sky-500'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Items List */}
              <div className="p-4 overflow-y-auto space-y-3 flex-1">
                {visibleItems.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <StoreIcon className="w-10 h-10 mx-auto opacity-50" />
                    <p className="font-bold text-xs">لا توجد عناصر متاحة حالياً في هذا التصنيف.</p>
                  </div>
                ) : (
                  visibleItems.map((item) => {
                    const inCart = cart[item.id]?.quantity || 0;
                    return (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center justify-between gap-3 hover:border-sky-300 transition"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {item.image && (
                            <img
                              src={item.image}
                              alt={item.name}
                              referrerPolicy="no-referrer"
                              className="w-16 h-16 rounded-xl object-cover border border-slate-100 dark:border-slate-700 shrink-0 bg-slate-100"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <h4 className="font-black text-xs sm:text-sm text-[#0B1F3A] dark:text-white truncate">
                              {item.name}
                            </h4>
                            {item.description && (
                              <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                {item.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="font-mono font-black text-xs text-amber-600 dark:text-[#FBBF24]">
                                {item.price} {item.currency || store.currency}
                              </span>
                              {item.type === 'offer' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                                  عرض خاص
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Add / Quantity buttons */}
                        <div className="shrink-0">
                          {inCart > 0 ? (
                            <div className="flex items-center gap-1.5 bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 rounded-xl p-1">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, -1)}
                                className="w-6 h-6 rounded-lg bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 flex items-center justify-center shadow-xs cursor-pointer hover:bg-rose-50 hover:text-rose-600"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-6 text-center font-black text-xs text-[#0B1F3A] dark:text-white font-mono">
                                {inCart}
                              </span>
                              <button
                                type="button"
                                onClick={() => addToCart(item)}
                                className="w-6 h-6 rounded-lg bg-sky-600 text-white flex items-center justify-center shadow-xs cursor-pointer hover:bg-sky-700"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => addToCart(item)}
                              className="px-3 py-1.5 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] font-black text-xs flex items-center gap-1 shadow-xs hover:opacity-95 transition cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>إضافة</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Cart & Checkout Section (5 cols) */}
            <div className="lg:col-span-5 flex flex-col overflow-y-auto p-4 sm:p-5 space-y-4 bg-white dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-sky-600" />
                  <h4 className="font-black text-sm text-[#0B1F3A] dark:text-white">
                    سلة الطلب ({cartItemsCount})
                  </h4>
                </div>
                {cartItemsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart({})}
                    className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    تفريغ السلة
                  </button>
                )}
              </div>

              {/* Cart items list */}
              {cartItemsCount === 0 ? (
                <div className="py-8 text-center text-slate-400 space-y-2 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  <ShoppingBag className="w-8 h-8 mx-auto opacity-40" />
                  <p className="text-xs font-bold">السلة فارغة، اختر من القائمة على اليمين.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {cartList.map(({ item, quantity }) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-black text-slate-800 dark:text-slate-100 truncate block">
                          {item.name}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">
                          {quantity} × {item.price} = {quantity * item.price} {store.currency}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-6 h-6 rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="w-5 text-center font-bold font-mono">{quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-6 h-6 rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer mr-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Order Type Selector */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300">
                  نوع الاستلام:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrderType('DELIVERY')}
                    className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                      orderType === 'DELIVERY'
                        ? 'bg-sky-600 text-white border-transparent shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>🚚 توصيل للمنزل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType('PICKUP')}
                    className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                      orderType === 'PICKUP'
                        ? 'bg-sky-600 text-white border-transparent shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <StoreIcon className="w-3.5 h-3.5" />
                    <span>🏃 استلام من الفرع</span>
                  </button>
                </div>
              </div>

              {/* Delivery or Pickup Details */}
              {orderType === 'DELIVERY' ? (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300">
                    عنوان التوصيل (الحي والشارع والعمارة):
                  </label>
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="مثال: حي العليا - شارع موسى بن نصير - عمارة 14"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                      الفرع المستلم منه:
                    </label>
                    <select
                      value={selectedBranchId}
                      onChange={(e) => setSelectedBranchId(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                    >
                      {store.branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.area || b.city})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                      موعد الاستلام التقديري:
                    </label>
                    <input
                      type="text"
                      value={pickupTime}
                      onChange={(e) => setPickupTime(e.target.value)}
                      placeholder="خلال 20 دقيقة"
                      className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                    />
                  </div>
                </div>
              )}

              {/* Customer Contact Details */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                    اسم المستلم:
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="أحمد محمد"
                    className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                    رقم الجوال للواتساب:
                  </label>
                  <input
                    type="tel"
                    dir="ltr"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="0501234567"
                    className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                  ملاحظات خاصة للطلب والمطبخ:
                </label>
                <input
                  type="text"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="مثال: سكر قليل، تغليف حراري إضافي..."
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>

              {/* Price Breakdown */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>المجموع الفرعي:</span>
                  <span className="font-mono font-bold">{subtotal} {store.currency}</span>
                </div>
                {orderType === 'DELIVERY' && (
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>رسوم التوصيل:</span>
                    <span className="font-mono font-bold">{deliveryFee} {store.currency}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-900 dark:text-white font-black text-sm pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span>الإجمالي المطلوب:</span>
                  <span className="text-amber-600 dark:text-[#FBBF24] font-mono text-base font-black">
                    {total} {store.currency}
                  </span>
                </div>
              </div>

              {errorMessage && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 text-rose-700 text-xs font-bold">
                  {errorMessage}
                </div>
              )}

              {/* Submit CTA */}
              <button
                type="button"
                onClick={handleConfirmOrder}
                disabled={submitting || cartItemsCount === 0}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition cursor-pointer disabled:opacity-50"
              >
                <MessageCircle className="w-5 h-5 fill-current" />
                <span>
                  {submitting
                    ? 'جاري تأكيد الطلب وتجهيز الواتساب...'
                    : 'تأكيد الطلب وإرسال عبر واتساب 💬'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
