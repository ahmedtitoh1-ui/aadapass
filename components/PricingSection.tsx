'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, MessageCircle, Sparkles, Tag } from 'lucide-react';
import CurrencySwitcher, { readCookieValue, savePreferredCurrencyCookie } from './CurrencySwitcher';
import {
  detectCurrencyFromCountry,
  PREFERRED_CURRENCY_COOKIE,
  PRICING_PLANS,
  SupportedPricingCurrency,
} from '@/lib/pricingPlans';
import type { SubscriptionPackage, SubscriptionPlanName, UserRole } from '@/lib/types';

interface PricingSectionProps {
  packages: SubscriptionPackage[];
  currency?: SupportedPricingCurrency;
  onCurrencyChange?: (next: SupportedPricingCurrency) => void;
  onSelectPlan: (roleHint?: UserRole, planName?: SubscriptionPlanName) => void;
  onRequestPackageWhatsapp?: (pkg: {
    title: string;
    billingCycle: 'monthly' | 'annual';
    currency: SupportedPricingCurrency;
    priceSummary: string;
    planName: SubscriptionPlanName;
  }) => void;
  trialDays?: number;
  annualDiscountPercent?: number;
  headingTitle?: string;
  headingSubtitle?: string;
  defaultAnnualDiscountPct?: number;
}

interface PricingCardViewModel {
  id: string;
  name: SubscriptionPackage['name'];
  title: string;
  subtitle: string;
  priceEgp: number;
  priceSar: number;
  maxBranches: number;
  maxStaff: number;
  maxCustomersPerMonth: number;
  features: string[];
  ctaText: string;
  highlighted?: boolean;
  promoText?: string;
  promoDiscountPct?: number;
  annualDiscountPct: number;
  customPricing?: boolean;
  loyaltyEnabled: boolean;
}

export default function PricingSection({
  packages,
  currency: controlledCurrency,
  onCurrencyChange,
  onSelectPlan,
  onRequestPackageWhatsapp,
  trialDays = 14,
  headingTitle,
  headingSubtitle,
  annualDiscountPercent,
  defaultAnnualDiscountPct = annualDiscountPercent ?? 20,
}: PricingSectionProps) {
  const [internalCurrency, setInternalCurrency] = useState<SupportedPricingCurrency>('EGP');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [detectedSource, setDetectedSource] = useState<'cookie' | 'geoip' | 'default'>('cookie');

  const currency = controlledCurrency ?? internalCurrency;

  const updateCurrency = (
    next: SupportedPricingCurrency,
    source: 'cookie' | 'geoip' | 'default' = 'cookie'
  ) => {
    savePreferredCurrencyCookie(next);
    setInternalCurrency(next);
    setDetectedSource(source);
    onCurrencyChange?.(next);
  };

  useEffect(() => {
    // Only resolve initial cookie if uncontrolled; never perform delayed external GeoIP fetches
    // that trigger post-render layout shifts or scroll jumps while reading the landing page.
    if (controlledCurrency !== undefined) {
      const saved = readCookieValue(PREFERRED_CURRENCY_COOKIE);
      setDetectedSource(saved === 'EGP' || saved === 'SAR' ? 'cookie' : 'default');
      return;
    }

    const savedCookie = readCookieValue(PREFERRED_CURRENCY_COOKIE);
    if (savedCookie === 'EGP' || savedCookie === 'SAR') {
      setInternalCurrency(savedCookie);
      setDetectedSource('cookie');
      return;
    }

    const middlewareCountry = readCookieValue('detected_country');
    const middlewareCurrency = readCookieValue('detected_currency');
    if (middlewareCountry) {
      setInternalCurrency(detectCurrencyFromCountry(middlewareCountry));
      setDetectedSource('geoip');
      return;
    }
    if (middlewareCurrency === 'EGP' || middlewareCurrency === 'SAR') {
      setInternalCurrency(middlewareCurrency);
      setDetectedSource('geoip');
    }
  }, [controlledCurrency]);

  const effectiveDefaultAnnual = Math.max(0, Math.min(90, Math.round(defaultAnnualDiscountPct)));

  // Merge static PRICING_PLANS with live Admin-configured packages
  const mergedPlans: PricingCardViewModel[] = useMemo(() => {
    const baseList: PricingCardViewModel[] = [
      {
        id: PRICING_PLANS.digital_presence.id,
        name: PRICING_PLANS.digital_presence.planName,
        title: PRICING_PLANS.digital_presence.title,
        subtitle: PRICING_PLANS.digital_presence.subtitle,
        priceEgp: PRICING_PLANS.digital_presence.prices.EGP,
        priceSar: PRICING_PLANS.digital_presence.prices.SAR,
        maxBranches: PRICING_PLANS.digital_presence.maxBranches,
        maxStaff: PRICING_PLANS.digital_presence.maxStaff,
        maxCustomersPerMonth: PRICING_PLANS.digital_presence.maxCustomersPerMonth,
        features: PRICING_PLANS.digital_presence.features,
        ctaText: PRICING_PLANS.digital_presence.ctaText,
        annualDiscountPct: effectiveDefaultAnnual,
        loyaltyEnabled: false,
      },
      {
        id: PRICING_PLANS.starter.id,
        name: PRICING_PLANS.starter.planName,
        title: PRICING_PLANS.starter.title,
        subtitle: PRICING_PLANS.starter.subtitle,
        priceEgp: PRICING_PLANS.starter.prices.EGP,
        priceSar: PRICING_PLANS.starter.prices.SAR,
        maxBranches: PRICING_PLANS.starter.maxBranches,
        maxStaff: PRICING_PLANS.starter.maxStaff,
        maxCustomersPerMonth: PRICING_PLANS.starter.maxCustomersPerMonth,
        features: PRICING_PLANS.starter.features,
        ctaText: PRICING_PLANS.starter.ctaText,
        annualDiscountPct: effectiveDefaultAnnual,
        loyaltyEnabled: true,
      },
      {
        id: PRICING_PLANS.growth.id,
        name: PRICING_PLANS.growth.planName,
        title: PRICING_PLANS.growth.title,
        subtitle: PRICING_PLANS.growth.subtitle,
        priceEgp: PRICING_PLANS.growth.prices.EGP,
        priceSar: PRICING_PLANS.growth.prices.SAR,
        maxBranches: PRICING_PLANS.growth.maxBranches,
        maxStaff: PRICING_PLANS.growth.maxStaff,
        maxCustomersPerMonth: PRICING_PLANS.growth.maxCustomersPerMonth,
        features: PRICING_PLANS.growth.features,
        ctaText: PRICING_PLANS.growth.ctaText,
        highlighted: true,
        promoText: PRICING_PLANS.growth.badge,
        annualDiscountPct: effectiveDefaultAnnual,
        loyaltyEnabled: true,
      },
    ];

    if (!Array.isArray(packages) || packages.length === 0) {
      return baseList;
    }

    return packages
      .filter((pkg) => pkg.id !== 'pkg-enterprise' && pkg.visibleOnLanding !== false)
      .sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99))
      .map((pkg) => {
        const fallback =
          baseList.find((b) => b.id === pkg.id || b.name === pkg.name) || baseList[1];
        const pkgAnnual =
          typeof pkg.annualDiscountPct === 'number' && Number.isFinite(pkg.annualDiscountPct)
            ? Math.max(0, Math.min(90, Math.round(pkg.annualDiscountPct)))
            : effectiveDefaultAnnual;
        return {
          id: pkg.id,
          name: pkg.name,
          title: pkg.title || fallback.title,
          subtitle: pkg.subtitle || fallback.subtitle,
          priceEgp:
            typeof pkg.monthlyPriceEgp === 'number'
              ? pkg.monthlyPriceEgp
              : fallback.priceEgp,
          priceSar:
            typeof pkg.monthlyPrice === 'number'
              ? pkg.monthlyPrice
              : fallback.priceSar,
          maxBranches:
            typeof pkg.maxBranches === 'number' ? pkg.maxBranches : fallback.maxBranches,
          maxStaff: typeof pkg.maxStaff === 'number' ? pkg.maxStaff : fallback.maxStaff,
          maxCustomersPerMonth:
            typeof pkg.maxCustomersPerMonth === 'number'
              ? pkg.maxCustomersPerMonth
              : fallback.maxCustomersPerMonth,
          features:
            Array.isArray(pkg.features) && pkg.features.length > 0
              ? pkg.features
              : fallback.features,
          ctaText:
            pkg.ctaText ||
            (pkg.name === 'Viewer' ? 'ابدأ التواجد الرقمي' : 'ابدأ تجربتك المجانية'),
          highlighted: pkg.highlighted ?? false,
          promoText: pkg.promoText,
          promoDiscountPct: pkg.promoDiscountPct,
          annualDiscountPct: pkgAnnual,
          customPricing: pkg.customPricing,
          loyaltyEnabled: pkg.loyaltyEnabled,
        };
      });
  }, [packages, effectiveDefaultAnnual]);

  const maxAnnualDiscount = useMemo(() => {
    const vals = mergedPlans.map((p) => p.annualDiscountPct);
    return vals.length > 0 ? Math.max(...vals) : effectiveDefaultAnnual;
  }, [mergedPlans, effectiveDefaultAnnual]);

  const resolvedSubtitle =
    headingSubtitle && headingSubtitle.trim()
      ? headingSubtitle
      : maxAnnualDiscount > 0
      ? `(يُدفع شهرياً، أو سنوياً بخصم يصل إلى ${maxAnnualDiscount}%) — اختر الباقة المناسبة لمرحلة نمو متجرك`
      : 'اختر الباقة المناسبة لمرحلة نمو متجرك ونظام الولاء';

  return (
    <section
      id="pricing"
      className="py-16 sm:py-20 relative overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 text-xs font-black">
            <Sparkles className="w-3.5 h-3.5 text-[#00C2FF]" />
            <span>خطط مرنة قابلة للتخصيص والعروض من لوحة مدير النظام</span>
          </span>

          <h2 className="text-2xl sm:text-4xl font-black text-[#0B1F3A] dark:text-white">
            {headingTitle || 'خطط الأسعار (Pricing Plans)'}
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 font-medium">
            {resolvedSubtitle}
          </p>

          {/* Controls Bar: Sleek Glassmorphism CurrencySwitcher + Billing Cycle Toggle */}
          <div className="pt-3 flex flex-col items-center justify-center gap-4">
            <CurrencySwitcher
              currency={currency}
              onChange={(next) => {
                updateCurrency(next, 'cookie');
              }}
              detectedSource={detectedSource}
            />

            <div className="glass-card inline-flex items-center p-1.5 rounded-full">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 rounded-full text-xs font-black transition cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-[#0B1F3A]/75 hover:text-sky-600'
                }`}
              >
                دفع شهري
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`px-4 py-2 rounded-full text-xs font-black transition cursor-pointer ${
                  billingCycle === 'annual'
                    ? 'bg-gradient-electric text-white shadow-sm'
                    : 'text-[#0B1F3A]/75 hover:text-sky-600'
                }`}
              >
                {maxAnnualDiscount > 0
                  ? `دفع سنوي (يوفر ${maxAnnualDiscount}% 🔥)`
                  : 'دفع سنوي'}
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Pricing Cards Grid */}
        <div
          className={`grid grid-cols-1 gap-6 items-stretch ${
            mergedPlans.length >= 4 ? 'lg:grid-cols-4 md:grid-cols-2' : 'lg:grid-cols-3'
          }`}
        >
          {mergedPlans.map((plan) => {
            const rawBasePrice = currency === 'EGP' ? plan.priceEgp : plan.priceSar;
            const annualFactor =
              billingCycle === 'annual' ? Math.max(0, 100 - plan.annualDiscountPct) / 100 : 1;
            const promoFactor =
              plan.promoDiscountPct && plan.promoDiscountPct > 0
                ? (100 - plan.promoDiscountPct) / 100
                : 1;
            const finalPrice = Math.floor(rawBasePrice * annualFactor * promoFactor);
            const hasAnnualDiscount = billingCycle === 'annual' && plan.annualDiscountPct > 0;
            const hasDiscount = hasAnnualDiscount || promoFactor < 1;

            const currencyLabel = currency === 'EGP' ? 'جنيه' : 'ريال سعودي';
            const annualTotal = finalPrice * 12;

            const isHighlighted = Boolean(plan.highlighted);

            return (
              <div
                key={plan.id}
                className={`p-7 rounded-3xl flex flex-col justify-between space-y-6 transition-all ${
                  isHighlighted
                    ? 'bg-gradient-to-b from-amber-50/80 via-white to-sky-50/60 text-[#0B1F3A] border-2 border-amber-400 shadow-2xl shadow-amber-500/15 relative lg:-translate-y-2'
                    : 'glass-card text-[#0B1F3A] hover:border-sky-300'
                }`}
              >
                <div className="space-y-4">
                  {/* Top Badges (Most Popular or Admin Promo Offer) */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`text-[11px] font-black ${
                        isHighlighted
                          ? 'text-amber-800'
                          : plan.loyaltyEnabled
                          ? 'text-sky-700'
                          : 'text-slate-600'
                      }`}
                    >
                      {plan.loyaltyEnabled
                        ? 'يشمل الكاشير الذكي ونظام النقاط'
                        : 'بطاقة رقمية ومنيو (بدون نقاط)'}
                    </span>

                    {(isHighlighted || plan.promoText) && (
                      <span className="px-3 py-1 rounded-full bg-gradient-gold-cta text-[#0B1F3A] text-[11px] font-black flex items-center gap-1 shadow-xs">
                        <Tag className="w-3 h-3" />
                        {plan.promoText || 'الأكثر طلباً'}
                      </span>
                    )}
                  </div>

                  {/* Plan Title & Subtitle */}
                  <div>
                    <h3 className="text-lg sm:text-xl font-black leading-snug text-[#0B1F3A]">
                      {plan.title}
                    </h3>
                    <p className="text-xs mt-1.5 leading-relaxed text-slate-600">
                      {plan.subtitle}
                    </p>
                  </div>

                  {/* Dynamic Price Display */}
                  <div
                    className={`pt-3 border-t ${
                      isHighlighted ? 'border-amber-200/80' : 'border-slate-200/80'
                    }`}
                  >
                    {plan.customPricing ? (
                      <div>
                        <div className="text-2xl font-black text-sky-600">
                          تواصل معنا (Custom Pricing)
                        </div>
                        <div className="text-xs mt-1 text-slate-500">
                          تسعير مخصص للسلاسل والفرانشايز
                        </div>
                      </div>
                    ) : (
                      <div>
                        {hasDiscount && (
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className="text-xs line-through font-bold text-slate-400">
                              {rawBasePrice} {currencyLabel}
                            </span>
                            {hasAnnualDiscount && (
                              <span className="text-emerald-700 text-[10px] font-black">
                                · خصم سنوي -{plan.annualDiscountPct}%
                              </span>
                            )}
                            {plan.promoDiscountPct ? (
                              <span className="text-rose-600 text-[10px] font-black">
                                · عرض خاص -{plan.promoDiscountPct}%
                              </span>
                            ) : null}
                          </div>
                        )}
                        <div className="flex items-baseline gap-1.5">
                          <span
                            className={`text-3xl sm:text-4xl font-black ${
                              isHighlighted ? 'text-amber-600' : 'text-[#0B1F3A]'
                            }`}
                          >
                            {finalPrice}
                          </span>
                          <span className="text-sm font-black text-slate-700">
                            {currencyLabel} / شهرياً
                          </span>
                        </div>
                        <div className="text-xs mt-1 font-bold text-sky-700">
                          {billingCycle === 'annual'
                            ? `تُدفع سنوياً (${annualTotal.toLocaleString('en-US')} ${currencyLabel}/سنة)`
                            : `الأسعار معروضة بعملة ${currency === 'EGP' ? 'مصر (ج.م)' : 'السعودية (ر.س)'}`}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Package Quotas & Limits Strip */}
                  <div
                    className={`p-3 rounded-2xl text-[11px] font-bold grid grid-cols-3 gap-2 text-center ${
                      isHighlighted
                        ? 'bg-amber-50/90 border border-amber-200/80 text-slate-700'
                        : 'bg-slate-50/90 border border-slate-200/70 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="text-[10px] text-slate-500">حد الفروع</div>
                      <div className="text-[#0B1F3A] font-black">
                        {plan.maxBranches >= 50 ? 'غير محدود' : `${plan.maxBranches} فرع`}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">الموظفين</div>
                      <div className="text-sky-700 font-black">
                        {plan.maxStaff >= 50 ? 'غير محدود' : `${plan.maxStaff} حساب`}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">العملاء/شهرياً</div>
                      <div className="text-emerald-700 font-black">
                        {!plan.loyaltyEnabled
                          ? 'عرض فقط'
                          : plan.maxCustomersPerMonth > 0
                          ? `حتى ${plan.maxCustomersPerMonth}`
                          : 'غير محدود'}
                      </div>
                    </div>
                  </div>

                  {/* Features List */}
                  <ul className="space-y-2.5 text-xs pt-1 text-slate-700">
                    {plan.features.map((feature, idx) => {
                      const isHeaderLine = feature.endsWith(':');
                      const isNoteLine = feature.startsWith('(') && feature.endsWith(').');
                      return (
                        <li
                          key={idx}
                          className={`flex items-start gap-2 leading-relaxed ${
                            isHeaderLine
                              ? isHighlighted
                                ? 'font-black text-amber-800 pb-0.5'
                                : 'font-black text-sky-700 pb-0.5'
                              : isNoteLine
                              ? 'text-slate-500 italic text-[11px]'
                              : ''
                          }`}
                        >
                          {!isHeaderLine && (
                            <Check
                              className={`w-4 h-4 shrink-0 mt-0.5 ${
                                isHighlighted ? 'text-amber-600' : 'text-sky-600'
                              }`}
                            />
                          )}
                          <span>{feature}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2.5">
                  {plan.customPricing ? (
                    onRequestPackageWhatsapp ? (
                      <button
                        type="button"
                        onClick={() =>
                          onRequestPackageWhatsapp({
                            title: plan.title,
                            billingCycle,
                            currency,
                            priceSummary: 'تسعير مخصص للسلاسل والفرانشايز',
                            planName: plan.name,
                          })
                        }
                        className="w-full py-3.5 rounded-full bg-gradient-electric hover:opacity-95 text-white text-xs sm:text-sm font-black text-center flex items-center justify-center gap-2 shadow-md shadow-sky-500/20 transition cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>{plan.ctaText} عبر واتساب</span>
                      </button>
                    ) : (
                      <Link
                        href="/contact"
                        className="w-full py-3.5 rounded-full bg-gradient-electric hover:opacity-95 text-white text-xs sm:text-sm font-black text-center block shadow-md shadow-sky-500/20 transition"
                      >
                        {plan.ctaText}
                      </Link>
                    )
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onSelectPlan('MERCHANT_OWNER', plan.name)}
                        className={`w-full py-3.5 rounded-full text-xs sm:text-sm font-black transition cursor-pointer ${
                          isHighlighted
                            ? 'bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] shadow-lg shadow-amber-500/25'
                            : 'bg-gradient-electric hover:opacity-95 text-white shadow-sm'
                        }`}
                      >
                        {plan.ctaText} ({trialDays} يوم مجاناً)
                      </button>
                      {onRequestPackageWhatsapp && (
                        <button
                          type="button"
                          onClick={() =>
                            onRequestPackageWhatsapp({
                              title: plan.title,
                              billingCycle,
                              currency,
                              priceSummary: `${finalPrice} ${currencyLabel} / شهرياً (${billingCycle === 'annual' ? 'دفع سنوي' : 'دفع شهري'})`,
                              planName: plan.name,
                            })
                          }
                          className="w-full py-2.5 rounded-full text-xs font-black flex items-center justify-center gap-1.5 border bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 transition cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>طلب الباقة عبر واتساب</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
