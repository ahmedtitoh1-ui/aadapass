'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  Store,
  Trash2,
  Truck,
  User,
  Volume2,
  VolumeX,
  X,
  XCircle,
} from 'lucide-react';
import type { OnlineOrder, OrderStatus, OrderType, SessionUser } from '@/lib/types';
import { formatCurrency } from '@/lib/i18n/ar';

interface LiveOrdersManagerProps {
  sessionUser: SessionUser;
  storeId?: string;
  merchantId?: string;
  branchId?: string;
  isOwner?: boolean;
}

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  PENDING: {
    label: 'جديد بانتظار التأكيد ⏳',
    bg: 'bg-amber-100 dark:bg-amber-950/60',
    text: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-300 dark:border-amber-700',
  },
  ACCEPTED: {
    label: 'تم القبول ✅',
    bg: 'bg-sky-100 dark:bg-sky-950/60',
    text: 'text-sky-800 dark:text-sky-300',
    border: 'border-sky-300 dark:border-sky-700',
  },
  PREPARING: {
    label: 'قيد التحضير بالمطبخ 🍳',
    bg: 'bg-indigo-100 dark:bg-indigo-950/60',
    text: 'text-indigo-800 dark:text-indigo-300',
    border: 'border-indigo-300 dark:border-indigo-700',
  },
  READY: {
    label: 'جاهز للاستلام 🛍️',
    bg: 'bg-emerald-100 dark:bg-emerald-950/60',
    text: 'text-emerald-800 dark:text-emerald-300',
    border: 'border-emerald-300 dark:border-emerald-700',
  },
  OUT_FOR_DELIVERY: {
    label: 'خرج مع المندوب للتوصيل 🛵',
    bg: 'bg-cyan-100 dark:bg-cyan-950/60',
    text: 'text-cyan-800 dark:text-cyan-300',
    border: 'border-cyan-300 dark:border-cyan-700',
  },
  COMPLETED: {
    label: 'مكتمل ومسلّم ✅',
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-300 dark:border-slate-700',
  },
  REJECTED: {
    label: 'مرفوض / ملغي ❌',
    bg: 'bg-rose-100 dark:bg-rose-950/60',
    text: 'text-rose-800 dark:text-rose-300',
    border: 'border-rose-300 dark:border-rose-700',
  },
};

export default function LiveOrdersManager({
  sessionUser,
  storeId,
  merchantId,
  branchId,
  isOwner = false,
}: LiveOrdersManagerProps) {
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Reject modal state
  const [rejectingOrder, setRejectingOrder] = useState<OnlineOrder | null>(null);
  const [rejectionReason, setRejectionReason] = useState('نعتذر، بعض الأصناف غير متوفرة حالياً.');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const url = storeId ? `/api/orders?storeId=${encodeURIComponent(storeId)}` : '/api/orders';
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.orders)) {
          setOrders(data.orders);
        }
      }
    } catch {
      // Keep existing state
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const updateOrderStatus = async (
    orderId: string,
    status: OrderStatus,
    reason?: string
  ) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          rejectionReason: reason,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? data.order : o))
        );
        // If cashier wants to notify customer via WhatsApp
        if (data.customerNotifyWhatsAppUrl) {
          // Can be used if cashier wants to click
        }
      }
    } catch {
      // Error handling
    }
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (branchId && o.branchId && o.branchId !== branchId) return false;
      if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && o.orderType !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesNum = o.orderNumber.toLowerCase().includes(q);
        const matchesName = o.customerName.toLowerCase().includes(q);
        const matchesPhone = o.customerPhone.includes(q);
        if (!matchesNum && !matchesName && !matchesPhone) return false;
      }
      return true;
    });
  }, [orders, branchId, statusFilter, typeFilter, searchQuery]);

  // Counts
  const counts = useMemo(() => {
    const pending = orders.filter((o) => o.status === 'PENDING').length;
    const preparing = orders.filter((o) => o.status === 'PREPARING').length;
    const ready = orders.filter(
      (o) => o.status === 'READY' || o.status === 'OUT_FOR_DELIVERY'
    ).length;
    const completed = orders.filter((o) => o.status === 'COMPLETED').length;
    return { pending, preparing, ready, completed, total: orders.length };
  }, [orders]);

  return (
    <div className="space-y-5" dir="rtl">
      {/* Top Header & Status Cards */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              إدارة ومتابعة طلبات الأونلاين 🛵
            </h3>
            {counts.pending > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500 text-white font-black text-xs animate-pulse">
                {counts.pending} طلب جديد!
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            استقبل طلبات العملاء أونلاين، راجع الأصناف والأسعار، وحدّث الحالة وتواصل عبر الواتساب فوراً.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled((v) => !v)}
            title={soundEnabled ? 'كتم صوت التنبيهات' : 'تفعيل صوت التنبيهات'}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition cursor-pointer"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
          </button>
          <button
            type="button"
            onClick={fetchOrders}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 font-bold text-xs flex items-center gap-1.5 hover:bg-sky-100 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث الطلبات</span>
          </button>
        </div>
      </div>

      {/* Stats Counter Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'PENDING' ? 'ALL' : 'PENDING')}
          className={`p-4 rounded-2xl border text-right transition cursor-pointer ${
            statusFilter === 'PENDING'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 shadow-sm'
              : 'glass-card hover:border-amber-300'
          }`}
        >
          <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 block">
            طلبات جديدة ⏳
          </span>
          <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {counts.pending}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'PREPARING' ? 'ALL' : 'PREPARING')}
          className={`p-4 rounded-2xl border text-right transition cursor-pointer ${
            statusFilter === 'PREPARING'
              ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 shadow-sm'
              : 'glass-card hover:border-indigo-300'
          }`}
        >
          <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 block">
            قيد التحضير بالمطبخ 🍳
          </span>
          <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
            {counts.preparing}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'READY' ? 'ALL' : 'READY')}
          className={`p-4 rounded-2xl border text-right transition cursor-pointer ${
            statusFilter === 'READY'
              ? 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-400 shadow-sm'
              : 'glass-card hover:border-cyan-300'
          }`}
        >
          <span className="text-[11px] font-bold text-cyan-700 dark:text-cyan-400 block">
            جاهز / خرج للتوصيل 🛵
          </span>
          <span className="text-2xl font-black text-cyan-600 dark:text-cyan-400 font-mono">
            {counts.ready}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={`p-4 rounded-2xl border text-right transition cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-400 shadow-sm'
              : 'glass-card hover:border-sky-300'
          }`}
        >
          <span className="text-[11px] font-bold text-slate-500 block">إجمالي الطلبات 📋</span>
          <span className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono">
            {counts.total}
          </span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="glass-card p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث برقم الطلب، اسم العميل، أو رقم الهاتف..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">جميع أنواع الاستلام</option>
            <option value="DELIVERY">توصيل للمنزل 🚚</option>
            <option value="PICKUP">استلام من الفرع 🏃</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">جميع الحالات</option>
            <option value="PENDING">جديد (بانتظار التأكيد)</option>
            <option value="ACCEPTED">تم القبول</option>
            <option value="PREPARING">قيد التجهيز</option>
            <option value="READY">جاهز للاستلام</option>
            <option value="OUT_FOR_DELIVERY">خرج للتوصيل</option>
            <option value="COMPLETED">مكتمل</option>
            <option value="REJECTED">مرفوض / ملغي</option>
          </select>
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="glass-card p-12 text-center rounded-3xl space-y-3 text-slate-400">
          <Store className="w-12 h-12 mx-auto opacity-50" />
          <p className="font-black text-sm text-slate-600 dark:text-slate-300">
            لا توجد طلبات تطابق الفلتر المحدد حالياً.
          </p>
          <p className="text-xs">
            فور قيام أي عميل بطلب أونلاين من متجرك أو فروعك، سيظهر هنا فوراَ مع تنبيه صوتي وإمكانية تأكيده بالواتساب.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredOrders.map((order) => {
            const statusMeta = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
            const cleanPhone = order.customerPhone.replace(/[^0-9]/g, '');
            const waChatUrl = cleanPhone
              ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                  `مرحباً ${order.customerName} 👋 بخصوص طلبك رقم #${order.orderNumber} من ${order.storeName}...`
                )}`
              : null;

            return (
              <div
                key={order.id}
                className={`glass-card p-5 rounded-3xl space-y-4 border-2 transition-all flex flex-col justify-between ${
                  order.status === 'PENDING'
                    ? 'border-amber-400 bg-amber-50/20 dark:bg-amber-950/10'
                    : 'border-slate-200/80 dark:border-slate-800'
                }`}
              >
                <div className="space-y-3">
                  {/* Card Header: Order #, Status, Time */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-base text-slate-900 dark:text-white">
                          #{order.orderNumber}
                        </span>
                        <span
                          className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${statusMeta.bg} ${statusMeta.text} ${statusMeta.border}`}
                        >
                          {statusMeta.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-1">
                        <Clock className="w-3 h-3" />
                        <span>
                          {new Date(order.createdAt).toLocaleTimeString('ar-SA', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span>•</span>
                        <span>{order.branchName}</span>
                      </p>
                    </div>

                    <span className="font-mono font-black text-lg text-emerald-600 dark:text-emerald-400">
                      {order.total} {order.currency}
                    </span>
                  </div>

                  {/* Customer Info & WhatsApp Button */}
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-black text-slate-800 dark:text-slate-100">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{order.customerName}</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        {order.customerPhone}
                      </div>
                    </div>

                    {waChatUrl && (
                      <a
                        href={waChatUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5 fill-current" />
                        <span>مراسلة واتساب</span>
                      </a>
                    )}
                  </div>

                  {/* Order Type & Address / Pickup Time */}
                  <div className="text-xs space-y-1 bg-sky-50/60 dark:bg-sky-950/30 p-3 rounded-2xl border border-sky-100 dark:border-sky-900/40">
                    <div className="flex items-center gap-1.5 font-bold text-sky-900 dark:text-sky-200">
                      {order.orderType === 'DELIVERY' ? (
                        <>
                          <Truck className="w-3.5 h-3.5 text-sky-600" />
                          <span>توصيل للمنزل (رسوم: {order.deliveryFee} {order.currency})</span>
                        </>
                      ) : (
                        <>
                          <Store className="w-3.5 h-3.5 text-sky-600" />
                          <span>استلام من الفرع ({order.pickupTime || 'خلال 20 دقيقة'})</span>
                        </>
                      )}
                    </div>
                    {order.orderType === 'DELIVERY' && order.deliveryAddress && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 pr-5">
                        📍 {order.deliveryAddress}
                      </p>
                    )}
                  </div>

                  {/* Order Items Table */}
                  <div className="space-y-1.5 text-xs">
                    <div className="font-bold text-slate-700 dark:text-slate-300 text-[11px] border-b border-slate-200 dark:border-slate-800 pb-1">
                      الأصناف المطلوبة ({order.items.reduce((a, b) => a + b.quantity, 0)}):
                    </div>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {order.items.map((it, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-slate-700 dark:text-slate-300 bg-slate-50/80 dark:bg-slate-800/40 px-2 py-1.5 rounded-lg"
                        >
                          <span className="font-bold">
                            <strong className="text-sky-600 font-mono ml-1">{it.quantity}x</strong>
                            {it.title}
                          </span>
                          <span className="font-mono text-[11px]">
                            {it.price * it.quantity} {order.currency}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {order.customerNotes && (
                    <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 text-amber-900 dark:text-amber-200 text-[11px]">
                      <strong>ملاحظة العميل:</strong> {order.customerNotes}
                    </div>
                  )}

                  {order.rejectionReason && (
                    <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 text-rose-900 dark:text-rose-200 text-[11px]">
                      <strong>سبب الرفض:</strong> {order.rejectionReason}
                    </div>
                  )}
                </div>

                {/* Status Action Buttons for Cashier */}
                <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
                  {order.status === 'PENDING' && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => updateOrderStatus(order.id, 'PREPARING')}
                        className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>قبول وبدء التحضير 🍳</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingOrder(order);
                          setRejectionReason('عذراً، بعض الأصناف غير متوفرة حالياً.');
                        }}
                        className="py-2.5 px-3 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>رفض الطلب ❌</span>
                      </button>
                    </div>
                  )}

                  {order.status === 'PREPARING' && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateOrderStatus(
                            order.id,
                            order.orderType === 'DELIVERY' ? 'OUT_FOR_DELIVERY' : 'READY'
                          )
                        }
                        className="flex-1 py-2.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                      >
                        <Truck className="w-4 h-4" />
                        <span>
                          {order.orderType === 'DELIVERY'
                            ? 'جاهز وخرج للتوصيل 🛵'
                            : 'جاهز للاستلام من الفرع 🛍️'}
                        </span>
                      </button>
                    </div>
                  )}

                  {(order.status === 'READY' || order.status === 'OUT_FOR_DELIVERY') && (
                    <button
                      type="button"
                      onClick={() => updateOrderStatus(order.id, 'COMPLETED')}
                      className="w-full py-2.5 px-3 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] font-black text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                    >
                      <BadgeCheck className="w-4 h-4" />
                      <span>تأكيد التسليم وإتمام الطلب ✅</span>
                    </button>
                  )}

                  {order.status === 'COMPLETED' && (
                    <div className="py-2 text-center text-xs text-emerald-700 dark:text-emerald-400 font-bold flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>تم تسليم هذا الطلب بنجاح</span>
                    </div>
                  )}

                  {order.status === 'REJECTED' && (
                    <div className="py-2 text-center text-xs text-rose-600 font-bold">
                      تم رفض هذا الطلب
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      {rejectingOrder && (
        <div
          dir="rtl"
          onClick={() => setRejectingOrder(null)}
          className="fixed inset-0 z-50 bg-[#0B1F3A]/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-black text-sm text-[#0B1F3A] dark:text-white">
                رفض طلب #{rejectingOrder.orderNumber}
              </h4>
              <button
                type="button"
                onClick={() => setRejectingOrder(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              يرجى تحديد سبب الرفض ليتم إشعار العميل {rejectingOrder.customerName} به وتحديث حالة الطلب:
            </p>

            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="اكتب سبب الرفض..."
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100"
            />

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingOrder(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  updateOrderStatus(rejectingOrder.id, 'REJECTED', rejectionReason);
                  setRejectingOrder(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs"
              >
                تأكيد الرفض
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
