import React from 'react';
import type { Metadata } from 'next';
import PublicSubpageHeader from '@/components/PublicSubpageHeader';
import PublicFooter from '@/components/PublicFooter';
import { ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'سياسة الخصوصية | Aada Pass - عادة باس',
  description: 'سياسة الخصوصية وحماية البيانات الشخصية في منصة Aada Pass للولاء ودليل المتاجر.',
};

export default function PrivacyPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-light-canvas text-slate-800 dark:text-slate-100 flex flex-col">
      <PublicSubpageHeader />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <article className="glass-card rounded-3xl p-6 sm:p-10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#0B1F3A] dark:text-white">
                سياسة الخصوصية وحماية البيانات
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">آخر تحديث: نوفمبر 2026</p>
            </div>
          </div>

          <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            <section className="space-y-1.5">
              <h2 className="text-base font-black text-[#0B1F3A] dark:text-white">
                1. حماية خصوصية زوار الدليل العام
              </h2>
              <p>
                تصفح دليل المتاجر العام في Aada Pass متاح مجاناً دون إنشاء حساب، ولا يتم كشف أي بيانات عملاء أو معرفات داخلية في الصفحات العامة.
              </p>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-base font-black text-[#0B1F3A] dark:text-white">
                2. عزل بيانات المتاجر والعملاء (Tenant Isolation)
              </h2>
              <p>
                تُخزن بطاقات الولاء ومعاملات العميل بمعزل تام لكل متجر؛ لا يطلع أي متجر على رصيد العميل أو سجل مشترياته لدى المتاجر الأخرى، ولا يقرأ العميل سوى محفظته وبياناته الشخصية فقط.
              </p>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-base font-black text-[#0B1F3A] dark:text-white">
                3. أمان الجلسات ورموز QR
              </h2>
              <p>
                تُحمى الجلسات برموز JWT قصيرة العمر وكوكيز httpOnly متجددة مع إمكانية تسجيل الخروج من جميع الأجهزة، وتوقيع رموز QR رقمياً على الخادم مع سجل تدقيق AuditLog للعمليات الحساسة.
              </p>
            </section>
          </div>
        </article>
      </main>

      <PublicFooter />
    </div>
  );
}
