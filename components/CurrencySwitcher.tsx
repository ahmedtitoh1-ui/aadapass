'use client';

import React from 'react';
import { Globe } from 'lucide-react';
import {
  PREFERRED_CURRENCY_COOKIE,
  SupportedPricingCurrency,
} from '@/lib/pricingPlans';

interface CurrencySwitcherProps {
  currency: SupportedPricingCurrency;
  onChange: (nextCurrency: SupportedPricingCurrency) => void;
  detectedSource?: 'cookie' | 'geoip' | 'default';
}

export function savePreferredCurrencyCookie(currency: SupportedPricingCurrency) {
  if (typeof document === 'undefined') return;
  document.cookie = `${PREFERRED_CURRENCY_COOKIE}=${currency}; path=/; max-age=31536000; SameSite=Lax`;
}

export function readCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

export default function CurrencySwitcher({
  currency,
  onChange,
  detectedSource,
}: CurrencySwitcherProps) {
  const handleSelect = (next: SupportedPricingCurrency) => {
    savePreferredCurrencyCookie(next);
    onChange(next);
  };

  return (
    <div className="inline-flex flex-col sm:flex-row items-center gap-3">
      <div
        role="group"
        aria-label="اختيار العملة"
        className="glass-card inline-flex items-center gap-1.5 p-1.5 rounded-full shadow-md"
      >
        <button
          type="button"
          onClick={() => handleSelect('EGP')}
          className={`px-4 py-2 rounded-full text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer ${
            currency === 'EGP'
              ? 'bg-gradient-gold-cta text-[#0B1F3A] shadow-md shadow-amber-500/20 scale-[1.02]'
              : 'text-[#0B1F3A]/80 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50/70 dark:hover:bg-white/5'
          }`}
        >
          <span className="text-base leading-none">🇪🇬</span>
          <span>مصر (EGP · جنيه)</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelect('SAR')}
          className={`px-4 py-2 rounded-full text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer ${
            currency === 'SAR'
              ? 'bg-gradient-gold-cta text-[#0B1F3A] shadow-md shadow-amber-500/20 scale-[1.02]'
              : 'text-[#0B1F3A]/80 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50/70 dark:hover:bg-white/5'
          }`}
        >
          <span className="text-base leading-none">🇸🇦</span>
          <span>السعودية (SAR · ريال)</span>
        </button>
      </div>

      {detectedSource && (
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300 font-bold">
          <Globe className="w-3.5 h-3.5 text-[#00C2FF]" />
          {detectedSource === 'cookie'
            ? 'تم حفظ اختيارك المفضل للعملة'
            : detectedSource === 'geoip'
            ? 'تم تحديد العملة تلقائياً حسب موقعك الجغرافي'
            : 'العملة الافتراضية (يمكنك التبديل في أي وقت)'}
        </span>
      )}
    </div>
  );
}

