'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import {
  detectCurrencyFromCountry,
  PREFERRED_CURRENCY_COOKIE,
  SupportedPricingCurrency,
} from '@/lib/pricingPlans';
import { readCookieValue, savePreferredCurrencyCookie } from './CurrencySwitcher';

interface PublicSubpageHeaderProps {
  currency?: SupportedPricingCurrency;
  onCurrencyChange?: (next: SupportedPricingCurrency) => void;
}

export default function PublicSubpageHeader({
  currency: controlledCurrency,
  onCurrencyChange,
}: PublicSubpageHeaderProps) {
  const [internalCurrency, setInternalCurrency] = useState<SupportedPricingCurrency>('EGP');
  const currency = controlledCurrency ?? internalCurrency;

  useEffect(() => {
    if (controlledCurrency !== undefined) return;
    const saved = readCookieValue(PREFERRED_CURRENCY_COOKIE);
    if (saved === 'EGP' || saved === 'SAR') {
      setInternalCurrency(saved);
      return;
    }
    const detectedCountry = readCookieValue('detected_country');
    const detectedCurrency = readCookieValue('detected_currency');
    if (detectedCountry) {
      setInternalCurrency(detectCurrencyFromCountry(detectedCountry));
    } else if (detectedCurrency === 'EGP' || detectedCurrency === 'SAR') {
      setInternalCurrency(detectedCurrency);
    }
  }, [controlledCurrency]);

  const handleSelectCountry = (next: SupportedPricingCurrency) => {
    savePreferredCurrencyCookie(next);
    setInternalCurrency(next);
    onCurrencyChange?.(next);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aadapass-currency-change', { detail: next }));
    }
  };

  return (
    <div className="sticky top-0 z-40 px-4 sm:px-6 lg:px-8 pt-3.5 pb-2 pointer-events-none">
      <header className="max-w-7xl mx-auto glass-card rounded-full px-5 sm:px-7 h-16 flex items-center justify-between gap-4 sm:gap-8 pointer-events-auto">
        <Link
          href="/"
          className="flex items-center whitespace-nowrap shrink-0"
        >
          <img
            src="/logo-color.png"
            alt="Aada Pass"
            className="h-9 sm:h-10 w-auto object-contain dark:hidden"
          />
          <img
            src="/logo-white.png"
            alt="Aada Pass"
            className="h-9 sm:h-10 w-auto object-contain hidden dark:block"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-bold text-slate-600 dark:text-slate-300">
          <Link href="/" className="hover:text-[#0B1F3A] dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
            الرئيسية
          </Link>
          <Link href="/stores" className="hover:text-[#0B1F3A] dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
            دليل المتاجر
          </Link>
          <Link href="/privacy" className="hover:text-[#0B1F3A] dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
            الخصوصية
          </Link>
          <Link href="/terms" className="hover:text-[#0B1F3A] dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
            الشروط
          </Link>
          <Link href="/contact" className="hover:text-[#0B1F3A] dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
            تواصل معنا
          </Link>
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <div
            role="group"
            aria-label="تحديد البلد والعملة"
            className="inline-flex items-center p-1 rounded-full bg-white/75 dark:bg-slate-900/75 backdrop-blur-md border border-slate-200/90 dark:border-sky-500/30 shadow-xs"
          >
            <button
              type="button"
              onClick={() => handleSelectCountry('EGP')}
              title="مصر (الجنيه المصري)"
              className={`px-2.5 py-1 rounded-full text-[11px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                currency === 'EGP'
                  ? 'bg-[#0B1F3A] text-white shadow-xs'
                  : 'text-[#0B1F3A]/75 dark:text-slate-300 hover:text-sky-600'
              }`}
            >
              <span aria-hidden="true">🇪🇬</span>
              <span className="hidden sm:inline">مصر</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectCountry('SAR')}
              title="السعودية (الريال السعودي)"
              className={`px-2.5 py-1 rounded-full text-[11px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                currency === 'SAR'
                  ? 'bg-[#0B1F3A] text-white shadow-xs'
                  : 'text-[#0B1F3A]/75 dark:text-slate-300 hover:text-sky-600'
              }`}
            >
              <span aria-hidden="true">🇸🇦</span>
              <span className="hidden sm:inline">السعودية</span>
            </button>
          </div>

          <Link
            href="/?auth=1"
            className="bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] font-black px-5 py-2 rounded-full text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-amber-500/20 whitespace-nowrap shrink-0"
          >
            <span>دخول / تسجيل</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>
    </div>
  );
}
