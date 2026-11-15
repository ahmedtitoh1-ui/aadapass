import React from 'react';
import type { Metadata } from 'next';
import PublicSubpageHeader from '@/components/PublicSubpageHeader';
import PublicFooter from '@/components/PublicFooter';
import { FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'الشروط والأحكام | Aada Pass - عادة باس',
  description: 'الشروط والأحكام المنظمة لاستخدام دليل المتاجر وبرامج الولاء الرقمية عبر Aada Pass.',
};

export default function TermsPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-light-canvas text-slate-800 dark:text-slate-100 flex flex-col">
      <PublicSubpageHeader />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <article className="glass-card rounded-3xl p-6 sm:p-10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#0B1F3A] dark:text-white">
                الشروط والأحكام
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">آخر تحديث: نوفمبر 2026</p>
            </div>
          </div>

          <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            <section className="space-y-1.5">
              <h2 className="text-base font-black text-[#0B1F3A] dark:text-white">
                1. استخدام الدليل العام وحماية المحتوى
              </h2>
              <p>
                دليل المتاجر متاح للاكتشاف البشري والوصول إلى خدمات المتاجر وأرقام تواصلها وفروعها. يُحظر استخدام أدوات السحب الآلي (Scraping) أو استغلال البيانات لأغراض تجارية غير مصرح بها.
              </p>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-base font-black text-[#0B1F3A] dark:text-white">
                2. باقة التواجد الرقمي (عرض المتجر فقط)
              </h2>
              <p>
                المتاجر المدرجة ضمن باقة العرض التعريفي تظهر بشارة «لا يشارك في برنامج النقاط»، ولا تتيح إصدار بطاقات ولاء أو استبدال نقاط عبر المنصة حتى ترقية باقتها.
              </p>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-base font-black text-[#0B1F3A] dark:text-white">
                3. اعتماد الفواتير والنقاط
              </h2>
              <p>
                تُحتسب النقاط والأختام بناءً على الفاتورة المسجلة ومسح رمز QR الخاص بالعميل لدى الكاشير المخوّل، وفق قواعد البرنامج السارية وبعملة المتجر المعتمدة.
              </p>
            </section>
          </div>
        </article>
      </main>

      <PublicFooter />
    </div>
  );
}
