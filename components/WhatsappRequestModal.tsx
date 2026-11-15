'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  MessageCircle,
  Package,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';

export interface WhatsappRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminWhatsappNumber?: string;
  mode?: 'package' | 'service';
  defaultStoreName?: string;
  defaultRequesterName?: string;
  defaultPhone?: string;
  defaultPackageTitle?: string;
  defaultBillingCycle?: 'monthly' | 'annual';
  defaultCurrency?: 'EGP' | 'SAR' | 'AED';
  defaultPriceSummary?: string;
  onRegisterInstead?: () => void;
}

const SERVICE_OPTIONS = [
  'طلب تفعيل / ترقية باقة اشتراك',
  'تصميم وإعداد بطاقة الولاء الرقمية للمتجر',
  'تجهيز وربط نظام الكاشير الذكي (PWA)',
  'إضافة فروع وحسابات موظفين إضافية',
  'تسريع مراجعة وتفعيل حساب المتجر التجريبي',
  'استشارة أو عرض أسعار مخصص للسلاسل',
];

export default function WhatsappRequestModal({
  isOpen,
  onClose,
  adminWhatsappNumber = '966500000000',
  mode = 'service',
  defaultStoreName = '',
  defaultRequesterName = '',
  defaultPhone = '',
  defaultPackageTitle = '',
  defaultBillingCycle = 'annual',
  defaultCurrency = 'SAR',
  defaultPriceSummary = '',
  onRegisterInstead,
}: WhatsappRequestModalProps) {
  const [requesterName, setRequesterName] = useState(defaultRequesterName);
  const [storeName, setStoreName] = useState(defaultStoreName);
  const [phone, setPhone] = useState(defaultPhone);
  const [serviceType, setServiceType] = useState(
    mode === 'package'
      ? `طلب باقة: ${defaultPackageTitle || 'باقة النمو'}`
      : SERVICE_OPTIONS[0]
  );
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);
  const [loggedTicket, setLoggedTicket] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setRequesterName(defaultRequesterName);
    setStoreName(defaultStoreName);
    setPhone(defaultPhone);
    setServiceType(
      mode === 'package'
        ? `طلب باقة: ${defaultPackageTitle || 'باقة النمو'}`
        : SERVICE_OPTIONS[0]
    );
    setNotes('');
    setLoggedTicket(false);
  }, [
    isOpen,
    mode,
    defaultRequesterName,
    defaultStoreName,
    defaultPhone,
    defaultPackageTitle,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const normalizedPhone = useMemo(() => {
    const digits = (adminWhatsappNumber || '966500000000').replace(/[^\d]/g, '');
    return digits || '966500000000';
  }, [adminWhatsappNumber]);

  const whatsappMessage = useMemo(() => {
    const lines = [
      'السلام عليكم إدارة منصة عادة باس (Aada Pass)،',
      mode === 'package' ? 'أرغب في طلب وتفعيل باقة اشتراك:' : 'أرغب في طلب خدمة من المنصة:',
      `• نوع الطلب: ${serviceType}`,
    ];
    if (mode === 'package' && defaultPackageTitle) {
      lines.push(`• الباقة المختارة: ${defaultPackageTitle}`);
      lines.push(
        `• دورة الدفع: ${defaultBillingCycle === 'annual' ? 'اشتراك سنوي' : 'اشتراك شهري'} (${defaultCurrency})`
      );
      if (defaultPriceSummary) {
        lines.push(`• السعر المعروض: ${defaultPriceSummary}`);
      }
    }
    if (storeName.trim()) lines.push(`• اسم المتجر: ${storeName.trim()}`);
    if (requesterName.trim()) lines.push(`• الاسم: ${requesterName.trim()}`);
    if (phone.trim()) lines.push(`• رقم الجوال / الواتساب: ${phone.trim()}`);
    if (notes.trim()) lines.push(`• تفاصيل إضافية: ${notes.trim()}`);
    lines.push('شكراً لكم.');
    return lines.join('\n');
  }, [
    mode,
    serviceType,
    defaultPackageTitle,
    defaultBillingCycle,
    defaultCurrency,
    defaultPriceSummary,
    storeName,
    requesterName,
    phone,
    notes,
  ]);

  const whatsappUrl = useMemo(
    () => `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(whatsappMessage)}`,
    [normalizedPhone, whatsappMessage]
  );

  if (!isOpen) return null;

  const logRequestSilently = () => {
    if (loggedTicket) return;
    setLoggedTicket(true);
    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: requesterName.trim() || storeName.trim() || 'زائر عبر واتساب',
        contactInfo: phone.trim() || 'WhatsApp',
        subject: serviceType,
        message: whatsappMessage,
      }),
    }).catch(() => {});
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard restrictions
    }
  };

  return (
    <div
      dir="rtl"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[#0B1F3A]/65 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-3xl glass-card bg-white/95 dark:bg-[#0B1F3A]/95 border border-sky-100 dark:border-slate-700 shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700/70 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/25 shrink-0">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#0B1F3A] dark:text-white">
                {mode === 'package'
                  ? 'طلب باقة عبر واتساب الإدارة'
                  : 'طلب خدمة أو تواصل مباشر عبر واتساب'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                يُرسل الطلب مباشرة إلى رقم واتساب الإدارة المعتمد (+{normalizedPhone})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {mode === 'package' && defaultPackageTitle && (
          <div className="p-3.5 rounded-2xl bg-gradient-navy text-white flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Package className="w-5 h-5 text-[#FBBF24] shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-black truncate">{defaultPackageTitle}</div>
                <div className="text-[11px] text-sky-200 truncate">
                  {defaultBillingCycle === 'annual' ? 'اشتراك سنوي' : 'اشتراك شهري'}
                  {defaultPriceSummary ? ` · ${defaultPriceSummary}` : ''}
                </div>
              </div>
            </div>
            <Sparkles className="w-4 h-4 text-[#00C2FF] shrink-0" />
          </div>
        )}

        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-black text-[#0B1F3A] dark:text-slate-200 mb-1">
              نوع الخدمة / الطلب
            </label>
            {mode === 'package' ? (
              <input
                type="text"
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#0B1F3A] dark:text-white font-bold"
              />
            ) : (
              <div className="relative">
                <Wrench className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full pr-9 pl-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#0B1F3A] dark:text-white font-bold"
                >
                  {SERVICE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                الاسم الكامل
              </label>
              <input
                type="text"
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                placeholder="مثال: أحمد المنصور"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#0B1F3A] dark:text-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                رقم الجوال / واتساب
              </label>
              <input
                type="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+966 5... / +20 1..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#0B1F3A] dark:text-white font-mono text-right"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
              اسم المتجر / النشاط (إن وجد)
            </label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="مثال: كافيه أثر المختص"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#0B1F3A] dark:text-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
              تفاصيل إضافية للطلب
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="اكتب عدد الفروع أو أي ملاحظات تود إرسالها للإدارة..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#0B1F3A] dark:text-white"
            />
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span>معاينة نص رسالة الواتساب:</span>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="inline-flex items-center gap-1 text-sky-600 dark:text-[#00C2FF] font-black cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'تم النسخ' : 'نسخ النص'}</span>
              </button>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
              {whatsappMessage}
            </pre>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={logRequestSilently}
            className="flex-1 py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition"
          >
            <MessageCircle className="w-4 h-4" />
            <span>إرسال الطلب عبر واتساب الإدارة</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          {onRegisterInstead && (
            <button
              type="button"
              onClick={onRegisterInstead}
              className="py-3 px-4 rounded-xl bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] text-xs font-black cursor-pointer shadow-sm"
            >
              أو الانتقال للتسجيل المباشر 🏪
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
