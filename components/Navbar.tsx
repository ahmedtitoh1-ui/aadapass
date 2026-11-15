'use client';

import React from 'react';
import { SessionUser, SubscriptionPlanName, UserRole } from '@/lib/types';
import { AR_TRANSLATIONS } from '@/lib/i18n/ar';
import { SupportedPricingCurrency } from '@/lib/pricingPlans';
import { savePreferredCurrencyCookie } from './CurrencySwitcher';
import { handleSectionHrefClick } from '@/lib/scrollToSection';
import {
  ArrowLeft,
  Compass,
  Globe,
  LayoutDashboard,
  LogOut,
  ShieldAlert,
  Sparkles,
  Store,
} from 'lucide-react';

interface NavbarProps {
  sessionUser: SessionUser | null;
  activePortalMode: 'public' | 'portal';
  activePublicPage?: 'home' | 'merchant' | 'visitor';
  onNavigatePublicPage?: (page: 'home' | 'merchant' | 'visitor', anchorId?: string) => void;
  isDark?: boolean;
  currency?: SupportedPricingCurrency;
  onCurrencyChange?: (next: SupportedPricingCurrency) => void;
  onToggleDark?: () => void;
  onShowPublic: () => void;
  onShowPortal: () => void;
  onOpenAuthModal: (
    roleHint?: UserRole,
    options?: { mode?: 'login' | 'register_merchant' | 'register_customer'; plan?: SubscriptionPlanName }
  ) => void;
  onLogout: () => void;
  onLogoutAll: () => void;
}

export default function Navbar({
  sessionUser,
  activePortalMode,
  activePublicPage = 'home',
  onNavigatePublicPage,
  currency = 'EGP',
  onCurrencyChange,
  onShowPublic,
  onShowPortal,
  onOpenAuthModal,
  onLogout,
  onLogoutAll,
}: NavbarProps) {
  const isVisitor = !sessionUser || activePortalMode === 'public';

  const handleSelectCountry = (nextCurrency: SupportedPricingCurrency) => {
    savePreferredCurrencyCookie(nextCurrency);
    onCurrencyChange?.(nextCurrency);
  };

  const handleScreenNav = (
    e: React.MouseEvent,
    page: 'home' | 'merchant' | 'visitor',
    anchorId?: string
  ) => {
    e.preventDefault();
    if (onNavigatePublicPage) {
      onNavigatePublicPage(page, anchorId);
    } else if (anchorId) {
      handleSectionHrefClick(e as React.MouseEvent<HTMLAnchorElement>, `#${anchorId}`);
    }
  };

  return (
    <div className="sticky top-0 z-40 px-3 sm:px-6 lg:px-8 pt-3 pb-2 pointer-events-none">
      <header className="max-w-7xl mx-auto bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-lg shadow-sky-900/5 rounded-3xl sm:rounded-full px-4 sm:px-6 py-2.5 min-h-[64px] flex flex-wrap md:flex-nowrap items-center justify-between gap-2.5 sm:gap-4 pointer-events-auto">
        {/* الجهة اليمنى (اللوجو): شعار "عادة باس | Aada Pass" */}
        <button
          type="button"
          onClick={() => {
            onShowPublic();
            onNavigatePublicPage?.('home');
          }}
          className="flex items-center gap-2.5 text-right focus:outline-none group whitespace-nowrap shrink-0 cursor-pointer"
        >
          <img
            src="/logo-color.png"
            alt="عادة باس | Aada Pass"
            className="h-9 sm:h-10 w-auto object-contain group-hover:scale-[1.03] transition-transform"
          />
          <span className="hidden xl:inline-block text-xs font-black text-[#0B1F3A] border-r border-slate-200 pr-2.5">
            عادة باس | <span className="text-sky-600">Aada Pass</span>
          </span>
        </button>

        {/* المنتصف: الشريط العلوي يحتوي فقط على: الرئيسية | بوابة التاجر | بوابة الزائر */}
        {isVisitor ? (
          <nav
            aria-label="التنقل الرئيسي"
            className="order-3 md:order-2 w-full md:w-auto flex items-center justify-center gap-1.5 sm:gap-2 p-1 rounded-2xl bg-slate-100/90 border border-slate-200/80 text-xs sm:text-sm font-black text-slate-700"
          >
            <button
              type="button"
              onClick={(e) => handleScreenNav(e, 'home')}
              className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                activePublicPage === 'home'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-700 hover:text-sky-600 hover:bg-white/70'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>الرئيسية</span>
            </button>

            <button
              type="button"
              onClick={(e) => handleScreenNav(e, 'merchant')}
              className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                activePublicPage === 'merchant'
                  ? 'bg-gradient-gold-cta text-[#0B1F3A] shadow-sm'
                  : 'text-slate-700 hover:text-amber-600 hover:bg-white/70'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>بوابة التاجر</span>
            </button>

            <button
              type="button"
              onClick={(e) => handleScreenNav(e, 'visitor')}
              className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                activePublicPage === 'visitor'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-700 hover:text-emerald-600 hover:bg-white/70'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>بوابة الزائر</span>
            </button>
          </nav>
        ) : (
          <div className="hidden sm:flex items-center gap-3 text-xs font-bold text-[#0B1F3A] whitespace-nowrap shrink-0">
            <span className="bg-sky-50 text-sky-800 px-3 py-1 rounded-full border border-sky-200">
              {AR_TRANSLATIONS.roles[sessionUser.role]}
            </span>
            <span className="text-slate-600">
              {sessionUser.firstName} {sessionUser.lastName}
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <button
              type="button"
              onClick={onShowPublic}
              className="text-sky-600 hover:underline flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Store className="w-3.5 h-3.5" />
              <span>{AR_TRANSLATIONS.nav.publicSite}</span>
            </button>
          </div>
        )}

        {/* الجهة اليسرى (الأدوات والأزرار): مبدل البلد والعملة + تسجيل عميل + تسجيل الدخول + ابدأ مجاناً */}
        <div className="order-2 md:order-3 flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* مبدل البلد والعملة */}
          {isVisitor && (
            <div
              role="group"
              aria-label="مبدل البلد والعملة"
              className="inline-flex items-center p-1 rounded-full bg-slate-100 border border-slate-200/90 shadow-2xs"
            >
              <button
                type="button"
                onClick={() => handleSelectCountry('EGP')}
                title="مصر (الجنيه المصري)"
                className={`px-2.5 py-1 rounded-full text-[11px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                  currency === 'EGP'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-700 hover:text-sky-600'
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
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-700 hover:text-sky-600'
                }`}
              >
                <span aria-hidden="true">🇸🇦</span>
                <span className="hidden sm:inline">السعودية</span>
              </button>
            </div>
          )}

          {sessionUser && activePortalMode === 'public' && (
            <button
              type="button"
              onClick={onShowPortal}
              className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-3.5 py-2 rounded-full text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-amber-300" />
              <span>لوحتي</span>
            </button>
          )}

          {!sessionUser && (
            <>
              <button
                type="button"
                onClick={() => onOpenAuthModal('CUSTOMER', { mode: 'register_customer' })}
                className="inline-flex items-center gap-1 text-xs font-black px-3 py-2 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition whitespace-nowrap cursor-pointer shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>تسجيل عميل ⚡</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenAuthModal('CUSTOMER', { mode: 'login' })}
                className="inline-flex text-xs font-black text-slate-800 bg-slate-100 hover:bg-sky-50 hover:text-sky-700 border border-slate-200 px-3.5 py-2 rounded-full transition-colors whitespace-nowrap cursor-pointer"
              >
                تسجيل الدخول
              </button>
            </>
          )}

          {/* زر الإجراء (CTA): "ابدأ مجاناً" */}
          <button
            type="button"
            onClick={() =>
              onOpenAuthModal('MERCHANT_OWNER', {
                mode: sessionUser ? 'login' : 'register_merchant',
              })
            }
            className="hidden lg:inline-flex bg-gradient-electric hover:opacity-95 text-white font-black px-4 py-2 rounded-full shadow-md shadow-sky-500/20 text-xs items-center gap-1.5 transition-all transform hover:scale-[1.02] active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>{sessionUser ? AR_TRANSLATIONS.nav.switchAccount : 'ابدأ مجاناً'}</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>

          {sessionUser && (
            <>
              <button
                type="button"
                onClick={onLogoutAll}
                title={AR_TRANSLATIONS.nav.logoutAllDevices}
                className="hidden lg:flex bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 p-2 rounded-full transition-all cursor-pointer"
              >
                <ShieldAlert className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onLogout}
                title={AR_TRANSLATIONS.nav.logout}
                className="bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 p-2 rounded-full transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </header>
    </div>
  );
}
