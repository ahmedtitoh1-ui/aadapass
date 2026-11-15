'use client';

import React from 'react';
import Link from 'next/link';
import { Headphones, MessageCircle, QrCode, Shield, Store } from 'lucide-react';
import { handleSectionHrefClick } from '@/lib/scrollToSection';

interface PublicFooterProps {
  onMerchantLoginClick?: () => void;
  onAdminLoginClick?: () => void;
  onWhatsappServiceClick?: () => void;
  adminWhatsappNumber?: string;
  footerTagline?: string;
  footerCopyright?: string;
}

export default function PublicFooter({
  onMerchantLoginClick,
  onAdminLoginClick,
  onWhatsappServiceClick,
  adminWhatsappNumber,
  footerTagline,
  footerCopyright,
}: PublicFooterProps) {
  const cleanWa = (adminWhatsappNumber || '').replace(/[^\d]/g, '');
  return (
    <footer
      dir="rtl"
      className="border-t border-slate-200/80 dark:border-slate-800 bg-white/85 dark:bg-[#071324]/95 backdrop-blur-xl text-[#0B1F3A] dark:text-slate-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* 4 Columns Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-slate-200/70 dark:border-slate-800/80">
          {/* العمود 1: شعار "عادة باس" ووصف قصير في سطرين */}
          <div className="space-y-3">
            <Link href="/" className="inline-flex items-center gap-2">
              <img
                src="/logo-color.png"
                alt="عادة باس | Aada Pass"
                className="h-10 w-auto object-contain dark:hidden"
              />
              <img
                src="/logo-white.png"
                alt="عادة باس | Aada Pass"
                className="h-10 w-auto object-contain hidden dark:block"
              />
            </Link>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              {footerTagline ||
                'منصة الولاء الرقمي المتكاملة عبر بطاقات الويب الذكية للمقاهي والمطاعم والمتاجر. حوّل زيارة زبونك العابرة إلى عادة دائمة في 10 ثوانٍ فقط.'}
            </p>
          </div>

          {/* العمود 2: المنتج (المميزات، الأسعار، المتاجر المشاركة، تسجيل الدخول) */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white">المنتج</h3>
            <ul className="space-y-2.5 text-xs font-bold text-slate-600 dark:text-slate-400">
              <li>
                <a
                  href="#features"
                  onClick={(e) => handleSectionHrefClick(e, '#features')}
                  className="hover:text-sky-600 dark:hover:text-[#00C2FF] transition"
                >
                  المميزات
                </a>
              </li>
              <li>
                <a
                  href="#pricing"
                  onClick={(e) => handleSectionHrefClick(e, '#pricing')}
                  className="hover:text-sky-600 dark:hover:text-[#00C2FF] transition"
                >
                  الأسعار
                </a>
              </li>
              <li>
                <a
                  href="#directory"
                  onClick={(e) => handleSectionHrefClick(e, '#directory')}
                  className="hover:text-sky-600 dark:hover:text-[#00C2FF] transition"
                >
                  المتاجر المشاركة
                </a>
              </li>
              <li>
                {onMerchantLoginClick ? (
                  <button
                    type="button"
                    onClick={onMerchantLoginClick}
                    className="hover:text-sky-600 dark:hover:text-[#00C2FF] transition cursor-pointer"
                  >
                    تسجيل الدخول
                  </button>
                ) : (
                  <Link href="/?login=merchant" className="hover:text-sky-600 dark:hover:text-[#00C2FF] transition">
                    تسجيل الدخول
                  </Link>
                )}
              </li>
            </ul>
          </div>

          {/* العمود 3: الدعم (تواصل معنا، الأسئلة الشائعة، واتساب الطلبات) */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white">الدعم</h3>
            <ul className="space-y-2.5 text-xs font-bold text-slate-600 dark:text-slate-400">
              <li>
                <Link href="/contact" className="hover:text-sky-600 dark:hover:text-[#00C2FF] transition">
                  تواصل معنا
                </Link>
              </li>
              <li>
                {onWhatsappServiceClick ? (
                  <button
                    type="button"
                    onClick={onWhatsappServiceClick}
                    className="hover:text-emerald-600 dark:hover:text-emerald-400 transition inline-flex items-center gap-1.5 cursor-pointer text-emerald-700 dark:text-emerald-400 font-black"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>طلب خدمة / باقة عبر واتساب</span>
                  </button>
                ) : cleanWa ? (
                  <a
                    href={`https://wa.me/${cleanWa}?text=${encodeURIComponent(
                      'مرحباً، أود الاستفسار وطلب خدمة أو باقة اشتراك من منصة عادة باس.'
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-emerald-600 dark:hover:text-emerald-400 transition inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-black"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>طلب خدمة / باقة عبر واتساب</span>
                  </a>
                ) : null}
              </li>
              <li>
                <a
                  href="#faq"
                  onClick={(e) => handleSectionHrefClick(e, '#faq')}
                  className="hover:text-sky-600 dark:hover:text-[#00C2FF] transition"
                >
                  الأسئلة الشائعة
                </a>
              </li>
              <li>
                <Link href="/cashier" className="hover:text-sky-600 dark:hover:text-[#00C2FF] transition inline-flex items-center gap-1">
                  <QrCode className="w-3.5 h-3.5 text-sky-600 dark:text-[#00C2FF]" />
                  <span>بوابة الكاشير (PWA)</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* العمود 4: قانوني (الشروط والأحكام، سياسة الخصوصية) */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white">قانوني</h3>
            <ul className="space-y-2.5 text-xs font-bold text-slate-600 dark:text-slate-400">
              <li>
                <Link href="/terms" className="hover:text-sky-600 dark:hover:text-[#00C2FF] transition">
                  الشروط والأحكام
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-sky-600 dark:hover:text-[#00C2FF] transition">
                  سياسة الخصوصية
                </Link>
              </li>
              <li>
                <Link href="/stores" className="hover:text-sky-600 dark:hover:text-[#00C2FF] transition inline-flex items-center gap-1">
                  <Store className="w-3.5 h-3.5 text-amber-500" />
                  <span>دليل المتاجر الكامل</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* أسفل التذييل: جميع الحقوق محفوظة لمنصة عادة باس © 2026 + بجوارها علامة دخول الأدمن */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-slate-500 font-bold">
              {footerCopyright || 'جميع الحقوق محفوظة لمنصة عادة باس © 2026.'}
            </p>
            {/* علامة دخول الأدمن منفصلة بجوار حقوق الملكية */}
            {onAdminLoginClick ? (
              <button
                type="button"
                onClick={onAdminLoginClick}
                title="دخول منفصل للوحة إشراف مدير النظام"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 text-[#0B1F3A] border border-amber-300 text-[11px] font-black shadow-2xs cursor-pointer transition"
              >
                <Shield className="w-3.5 h-3.5 text-amber-600" />
                <span>دخول الأدمن</span>
              </button>
            ) : (
              <Link
                href="/admin"
                title="دخول منفصل للوحة إشراف مدير النظام"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 text-[#0B1F3A] border border-amber-300 text-[11px] font-black shadow-2xs transition"
              >
                <Shield className="w-3.5 h-3.5 text-amber-600" />
                <span>دخول الأدمن</span>
              </Link>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/support"
              className="px-3 py-1.5 rounded-full bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-[11px] font-bold flex items-center gap-1.5 transition"
            >
              <Headphones className="w-3.5 h-3.5 text-sky-600" />
              <span>بوابة وكيل الدعم</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
