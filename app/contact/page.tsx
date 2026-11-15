import React from 'react';
import type { Metadata } from 'next';
import { getDb } from '@/lib/server/db';
import PublicSubpageHeader from '@/components/PublicSubpageHeader';
import PublicFooter from '@/components/PublicFooter';
import ContactFormClient from '@/components/ContactFormClient';
import { Mail, MapPin, Phone } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'تواصل معنا | Aada Pass - عادة باس',
  description: 'تواصل مع فريق Aada Pass للانضمام كتاجر، طلب دعم فني، أو اقتراح تحسينات لدليل المتاجر.',
};

export default function ContactPage() {
  const db = getDb();
  const adminWhatsappNumber = db.siteSettings.adminWhatsappNumber || '966500000000';
  return (
    <div dir="rtl" className="min-h-screen bg-light-canvas text-slate-800 dark:text-slate-100 flex flex-col">
      <PublicSubpageHeader />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="space-y-2 text-center max-w-2xl mx-auto">
          <h1 className="text-3xl font-black text-[#0B1F3A] dark:text-white">تواصل مع فريق Aada Pass</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            سواء كنت صاحب متجر ترغب في إطلاق برنامج ولاء، أو زائراً لديك استفسار أو طلب خدمة، يسعدنا خدمتك.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="glass-card rounded-2xl p-5 space-y-2">
            <Phone className="w-5 h-5 text-sky-600" />
            <h2 className="font-black text-sm text-[#0B1F3A] dark:text-white">واتساب الإدارة الموحد</h2>
            <p className="text-xs font-mono text-slate-600 dark:text-slate-300" dir="ltr">
              +{adminWhatsappNumber}
            </p>
          </div>
          <div className="glass-card rounded-2xl p-5 space-y-2">
            <Mail className="w-5 h-5 text-amber-500" />
            <h2 className="font-black text-sm text-[#0B1F3A] dark:text-white">البريد الإلكتروني</h2>
            <p className="text-xs font-mono text-slate-600 dark:text-slate-300" dir="ltr">
              support@aadapass.sa
            </p>
          </div>
          <div className="glass-card rounded-2xl p-5 space-y-2">
            <MapPin className="w-5 h-5 text-emerald-600" />
            <h2 className="font-black text-sm text-[#0B1F3A] dark:text-white">المقر الرئيسي</h2>
            <p className="text-xs text-slate-600 dark:text-slate-300">الرياض، المملكة العربية السعودية</p>
          </div>
        </div>

        <ContactFormClient adminWhatsappNumber={adminWhatsappNumber} />
      </main>

      <PublicFooter adminWhatsappNumber={adminWhatsappNumber} />
    </div>
  );
}
