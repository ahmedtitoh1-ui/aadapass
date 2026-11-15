'use client';

import React, { useState } from 'react';
import { CheckCircle2, ExternalLink, MessageCircle, Send } from 'lucide-react';

interface ContactFormClientProps {
  adminWhatsappNumber?: string;
}

export default function ContactFormClient({
  adminWhatsappNumber = '966500000000',
}: ContactFormClientProps) {
  const [name, setName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // anti-spam honeypot
  const [busy, setBusy] = useState(false);
  const [refId, setRefId] = useState('');
  const [error, setError] = useState('');

  const cleanWaPhone = adminWhatsappNumber.replace(/[^\d]/g, '') || '966500000000';
  const waText = [
    '*طلب خدمة / تواصل عبر منصة عادة باس (Aada Pass)*',
    `الاسم: ${name.trim() || 'زائر'}`,
    `بيانات التواصل: ${contactInfo.trim() || 'غير محدد'}`,
    `الموضوع: ${subject.trim() || 'طلب خدمة / باقة'}`,
    message.trim() ? `التفاصيل: ${message.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const waHref = `https://wa.me/${cleanWaPhone}?text=${encodeURIComponent(waText)}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, contactInfo, subject, message, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'تعذر إرسال الرسالة، يرجى المحاولة لاحقاً.');
      } else {
        setRefId(data.reference || 'تم الإرسال');
        setName('');
        setContactInfo('');
        setSubject('');
        setMessage('');
      }
    } catch {
      setError('حدث خطأ في الاتصال بالخادم.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card rounded-3xl p-6 sm:p-8 space-y-4">
      <h2 className="text-xl font-black text-[#0B1F3A] dark:text-white">أرسل استفسارك مباشرة</h2>

      {refId && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 text-sm font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>تم استلام رسالتك بنجاح (رقم المرجع: {refId}). سيتواصل معك فريق الدعم قريباً.</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 text-xs font-bold text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Anti-spam honeypot field */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="hidden"
        aria-hidden="true"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">الاسم الكامل</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: سارة القحطاني"
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">رقم الجوال أو البريد الإلكتروني</label>
          <input
            type="text"
            required
            value={contactInfo}
            onChange={(e) => setContactInfo(e.target.value)}
            placeholder="+966 50 ... أو name@domain.com"
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">الموضوع</label>
        <input
          type="text"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="انضمام متجر / طلب باقة / طلب خدمة / دعم فني"
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">تفاصيل الرسالة</label>
        <textarea
          rows={4}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="اكتب رسالتك هنا..."
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={busy}
          className="bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] font-black px-8 py-3 rounded-2xl text-sm inline-flex items-center gap-2 shadow-md disabled:opacity-60 cursor-pointer"
        >
          <Send className="w-4 h-4" />
          <span>{busy ? 'جاري الإرسال...' : 'إرسال الرسالة'}</span>
        </button>

        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-7 py-3 rounded-2xl text-sm inline-flex items-center gap-2 shadow-md transition"
        >
          <MessageCircle className="w-4 h-4" />
          <span>إرسال الطلب عبر واتساب الإدارة</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </form>
  );
}
