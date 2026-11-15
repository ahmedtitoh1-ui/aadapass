'use client';

import React, { useState } from 'react';
import { CheckCircle2, Plus } from 'lucide-react';

interface SuggestStoreFormProps {
  initialName?: string;
  initialCity?: string;
  initialCategory?: string;
}

export default function SuggestStoreForm({
  initialName = '',
  initialCity = 'الرياض',
  initialCategory = 'كافيه',
}: SuggestStoreFormProps) {
  const [storeName, setStoreName] = useState(initialName);
  const [city, setCity] = useState(initialCity || 'الرياض');
  const [category, setCategory] = useState(initialCategory || 'كافيه');
  const [busy, setBusy] = useState(false);
  const [submittedCount, setSubmittedCount] = useState<number | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) return;
    setBusy(true);
    setError('');

    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName: storeName.trim(), city, category }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'تعذر إرسال الطلب.');
      } else {
        setSubmittedCount(data.request?.count ?? 1);
      }
    } catch {
      setError('حدث خطأ أثناء إرسال الطلب.');
    } finally {
      setBusy(false);
    }
  };

  if (submittedCount !== null) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 flex items-center gap-3 text-emerald-800 dark:text-emerald-200 text-sm font-bold">
        <CheckCircle2 className="w-5 h-5 shrink-0" />
        <span>
          تم تسجيل طلب إضافة «{storeName}» ({city}) بنجاح! إجمالي الطلبات المتشابهة لهذا المتجر: {submittedCount}
        </span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
      <input
        type="text"
        required
        value={storeName}
        onChange={(e) => setStoreName(e.target.value)}
        placeholder="اسم المتجر المقترح..."
        className="sm:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
      />
      <select
        value={city}
        onChange={(e) => setCity(e.target.value)}
        className="sm:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
      >
        <option value="الرياض">الرياض</option>
        <option value="جدة">جدة</option>
        <option value="الخبر">الخبر</option>
        <option value="القاهرة">القاهرة</option>
      </select>
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="sm:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
      >
        <option value="كافيه">كافيه</option>
        <option value="مطعم">مطعم</option>
        <option value="صالون">صالون</option>
        <option value="متجر">متجر</option>
      </select>
      <button
        type="submit"
        disabled={busy}
        className="sm:col-span-2 bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] font-black px-4 py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 disabled:opacity-60"
      >
        <Plus className="w-4 h-4" />
        <span>{busy ? 'جاري...' : 'اقتراح إضافة'}</span>
      </button>
      {error && <p className="sm:col-span-12 text-xs font-bold text-rose-600">{error}</p>}
    </form>
  );
}
