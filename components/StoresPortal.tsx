'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Clock,
  ExternalLink,
  MapPin,
  Phone,
  Search,
  Shield,
  Star,
  Store as StoreIcon,
  Wallet,
  Wifi,
} from 'lucide-react';
import type { Store } from '@/lib/types';
import { INITIAL_STORES } from '@/lib/mockData';
import {
  detectCurrencyFromCountry,
  PREFERRED_CURRENCY_COOKIE,
  SupportedPricingCurrency,
} from '@/lib/pricingPlans';
import { readCookieValue, savePreferredCurrencyCookie } from './CurrencySwitcher';
import StoreDetailModal from './StoreDetailModal';
import PublicFooter from './PublicFooter';
import PublicSubpageHeader from './PublicSubpageHeader';

export default function StoresPortal() {
  const [stores, setStores] = useState<Store[]>(INITIAL_STORES);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState<SupportedPricingCurrency>('EGP');
  const [cityFilter, setCityFilter] = useState('الكل');
  const [categoryFilter, setCategoryFilter] = useState('الكل');
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  useEffect(() => {
    const saved = readCookieValue(PREFERRED_CURRENCY_COOKIE);
    if (saved === 'EGP' || saved === 'SAR') {
      setCountryFilter(saved);
    } else {
      const detectedCountry = readCookieValue('detected_country');
      const detectedCurrency = readCookieValue('detected_currency');
      if (detectedCountry) {
        setCountryFilter(detectCurrencyFromCountry(detectedCountry));
      } else if (detectedCurrency === 'EGP' || detectedCurrency === 'SAR') {
        setCountryFilter(detectedCurrency);
      }
    }

    fetch('/api/stores')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.stores) && d.stores.length > 0) {
          setStores(d.stores);
        }
      })
      .catch(() => {});
  }, []);

  const handleCountrySwitch = (next: SupportedPricingCurrency) => {
    savePreferredCurrencyCookie(next);
    setCountryFilter(next);
    setCityFilter('الكل');
    setCategoryFilter('الكل');
  };

  const countryStores = useMemo(
    () => stores.filter((s) => s.currency === countryFilter),
    [stores, countryFilter]
  );

  const cities = useMemo(
    () => ['الكل', ...Array.from(new Set(countryStores.map((s) => s.city)))],
    [countryStores]
  );

  const categories = useMemo(
    () => ['الكل', ...Array.from(new Set(countryStores.map((s) => s.category)))],
    [countryStores]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return countryStores.filter((s) => {
      if (cityFilter !== 'الكل' && s.city !== cityFilter) return false;
      if (categoryFilter !== 'الكل' && s.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.area.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
      );
    });
  }, [countryStores, search, cityFilter, categoryFilter]);

  return (
    <div dir="rtl" className="min-h-screen bg-light-canvas text-[#0B1F3A] dark:text-slate-100 flex flex-col justify-between">
      <div>
        <PublicSubpageHeader
          currency={countryFilter}
          onCurrencyChange={handleCountrySwitch}
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Header Banner */}
          <div className="p-6 sm:p-8 rounded-3xl glass-card flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 text-sky-700 dark:text-[#00C2FF] border border-sky-500/20 text-xs font-black">
                <StoreIcon className="w-3.5 h-3.5" />
                <span>
                  {countryFilter === 'EGP'
                    ? '🇪🇬 متاجر مصر المعتمدة (العملة: ج.م)'
                    : '🇸🇦 متاجر السعودية المعتمدة (العملة: ر.س)'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-[#0B1F3A] dark:text-white">
                دليل متاجر عادة باس المعتمدة ✨
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">
                تصفح بيانات المتاجر، الفروع، ومكافآت الولاء — ادخل صفحة المتجر لاستعراض المنيو والخدمات التفاعلية
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Strict Country Switcher */}
              <div className="inline-flex items-center p-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black">
                <button
                  type="button"
                  onClick={() => handleCountrySwitch('EGP')}
                  className={`px-3.5 py-1.5 rounded-full transition cursor-pointer ${
                    countryFilter === 'EGP'
                      ? 'bg-[#0B1F3A] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  🇪🇬 مصر
                </button>
                <button
                  type="button"
                  onClick={() => handleCountrySwitch('SAR')}
                  className={`px-3.5 py-1.5 rounded-full transition cursor-pointer ${
                    countryFilter === 'SAR'
                      ? 'bg-[#0B1F3A] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  🇸🇦 السعودية
                </button>
              </div>

              <Link
                href="/admin"
                className="px-4 py-2.5 rounded-full bg-[#0B1F3A] hover:bg-[#10325E] text-white text-xs font-black flex items-center gap-1.5 shadow-sm"
              >
                <Shield className="w-4 h-4 text-[#FBBF24]" />
                <span>دخول الأدمن</span>
              </Link>
            </div>
          </div>

          {/* Search & Filters Bar */}
          <div className="p-4 sm:p-5 rounded-3xl glass-card flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث عن اسم المقهى، المطعم، المدينة، أو الحي..."
                className="w-full pr-10 pl-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#0B1F3A] dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-slate-400">المدينة:</span>
              {cities.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCityFilter(c)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-black transition cursor-pointer ${
                    cityFilter === c
                      ? 'bg-[#0B1F3A] text-[#FBBF24] shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-sky-50'
                  }`}
                >
                  {c}
                </button>
              ))}

              <span className="text-[11px] font-bold text-slate-400 mr-2">التصنيف:</span>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-black transition cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-sky-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Store Cards Grid — Store Data Only (Menu shown inside the store page) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filtered.map((store) => {
              const firstBranch = store.branches[0];
              const crowdBadge =
                firstBranch?.crowdLevel === 'هادئ'
                  ? { label: 'هادئ الآن', cls: 'bg-emerald-500 text-white' }
                  : firstBranch?.crowdLevel === 'متوسط'
                  ? { label: 'ازدحام متوسط', cls: 'bg-amber-400 text-[#0B1F3A]' }
                  : { label: 'مزدحم', cls: 'bg-rose-500 text-white' };

              return (
                <div
                  key={store.id}
                  className="rounded-3xl glass-card hover:border-sky-400 hover:shadow-2xl transition overflow-hidden flex flex-col justify-between group"
                >
                  <div>
                    {/* Cover & Store Profile Identity */}
                    <Link
                      href={`/stores/${store.slug}`}
                      className="block h-48 bg-[#0B1F3A] relative overflow-hidden"
                    >
                      <img
                        src={store.cover}
                        alt={store.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0B1F3A] via-[#0B1F3A]/40 to-transparent" />

                      <div className="absolute top-3.5 right-3.5 left-3.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="px-3 py-1 rounded-full bg-[#0B1F3A]/85 text-[#00C2FF] border border-[#00C2FF]/30 text-[11px] font-black backdrop-blur-sm">
                            {store.category}
                          </span>
                          {store.verifiedOwnership && (
                            <span className="px-2.5 py-1 rounded-full bg-amber-400 text-[#0B1F3A] text-[10px] font-black">
                              موثق ✓
                            </span>
                          )}
                          <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[#FBBF24] text-[10px] font-black flex items-center gap-1">
                            <Star className="w-3 h-3 fill-current" />
                            <span>4.9</span>
                          </span>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${crowdBadge.cls}`}>
                          ● {crowdBadge.label}
                        </span>
                      </div>

                      <div className="absolute bottom-3.5 right-4 left-4 flex items-end justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={store.logo}
                            alt={store.name}
                            referrerPolicy="no-referrer"
                            className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-xl bg-white shrink-0"
                          />
                          <div>
                            <h3 className="text-lg font-black text-white leading-snug">{store.name}</h3>
                            <p className="text-xs text-slate-200 font-bold">
                              📍 {store.city} — {store.area} · {store.branches.length}{' '}
                              {store.branches.length === 1 ? 'فرع' : 'فروع'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Link>

                    {/* Store Information Only (No Menu/Services List on Card) */}
                    <div className="p-5 space-y-4">
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                        {store.description}
                      </p>

                      {/* Embedded Digital Wallet Pass Strip */}
                      <div className="p-3.5 rounded-2xl bg-gradient-to-l from-[#0B1F3A] via-[#10325E] to-[#0B1F3A] text-white border border-[#00C2FF]/30 flex items-center justify-between gap-3 shadow-sm">
                        <div>
                          <div className="text-[10px] font-black text-[#00C2FF] flex items-center gap-1">
                            <Wallet className="w-3.5 h-3.5 text-[#FBBF24]" />
                            <span>مكافأة بطاقة الولاء ({store.loyaltyRule.type === 'stamps' ? 'نظام أختام' : 'نظام نقاط'})</span>
                          </div>
                          <div className="text-xs sm:text-sm font-black text-white mt-0.5">
                            🎁 {store.loyaltyRule.rewardDescription || 'نقاط ومكافآت فورية'}
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-white/10 text-[#FBBF24] text-[10px] font-black shrink-0">
                          بطاقة ويب ذكية
                        </span>
                      </div>

                      {/* Store Info Details Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px] font-bold">
                        <div className="p-2.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-200">
                          <MapPin className="w-3.5 h-3.5 text-sky-600 dark:text-[#00C2FF] shrink-0" />
                          <span className="truncate">{store.address}</span>
                        </div>
                        <div className="p-2.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-200">
                          <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="truncate">{store.workingHours || 'مفتوح يومياً'}</span>
                        </div>
                        <div className="p-2.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-200">
                          <Phone className="w-3.5 h-3.5 text-amber-600 dark:text-[#FBBF24] shrink-0" />
                          <span dir="ltr" className="font-mono truncate">{store.phone}</span>
                        </div>
                        <div className="p-2.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700 flex items-center justify-between gap-2 text-slate-700 dark:text-slate-200">
                          <span className="flex items-center gap-1.5">
                            <Wifi className="w-3.5 h-3.5 text-sky-600 dark:text-[#00C2FF] shrink-0" />
                            <span>{store.wifiPassword ? 'واي فاي متاح' : `${store.branches.length} فروع معتمدة`}</span>
                          </span>
                          <span className="text-[10px] text-sky-600 dark:text-[#00C2FF] font-black">
                            {store.currency === 'SAR' ? '🇸🇦 SAR' : '🇪🇬 EGP'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="px-5 py-3.5 bg-slate-50/80 dark:bg-slate-900/60 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2.5">
                    <Link
                      href={`/stores/${store.slug}`}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-[#0B1F3A] hover:bg-[#10325E] text-white text-xs font-black flex items-center justify-center gap-1.5 transition shadow-xs"
                    >
                      <span>دخول المتجر وتصفح المنيو</span>
                      <ExternalLink className="w-3.5 h-3.5 text-[#00C2FF]" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setSelectedStore(store)}
                      className="py-2.5 px-4 rounded-xl bg-white dark:bg-slate-800 hover:bg-sky-50 text-[#0B1F3A] dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-black transition shrink-0 cursor-pointer"
                    >
                      كارت الولاء والفروع
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      <StoreDetailModal
        store={selectedStore}
        onClose={() => setSelectedStore(null)}
        initialTab="wallet"
      />
      <PublicFooter />
    </div>
  );
}
