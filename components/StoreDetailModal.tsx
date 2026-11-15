'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Store } from '@/lib/types';
import { isStoreNewWithinDays } from '@/lib/storeBadges';
import InteractiveStoreMenu from './InteractiveStoreMenu';
import { StampShapeIcon } from './StampShapeIcon';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Gift,
  Instagram,
  MapPin,
  Phone,
  QrCode,
  Sparkles,
  Star,
  UtensilsCrossed,
  Wallet,
  Wifi,
  X,
} from 'lucide-react';

interface StoreDetailModalProps {
  store: Store | null;
  onClose: () => void;
  isJoined?: boolean;
  onJoinLoyalty?: (store: Store) => void;
  initialTab?: 'menu' | 'wallet' | 'branches' | 'gallery';
}

export default function StoreDetailModal({
  store,
  onClose,
  isJoined,
  onJoinLoyalty,
  initialTab = 'menu',
}: StoreDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'menu' | 'wallet' | 'branches' | 'gallery'>(initialTab);
  const [copiedWifi, setCopiedWifi] = useState(false);
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
  }, []);

  useEffect(() => {
    if (!store) return;
    setActiveTab(initialTab);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store, onClose, initialTab]);

  if (!store) return null;

  const firstBranch = store.branches[0];
  const crowdBadge =
    firstBranch?.crowdLevel === 'هادئ'
      ? { label: 'هادئ الآن', cls: 'bg-emerald-500 text-white' }
      : firstBranch?.crowdLevel === 'متوسط'
      ? { label: 'ازدحام متوسط', cls: 'bg-amber-400 text-[#0B1F3A]' }
      : { label: 'مزدحم حالياً', cls: 'bg-rose-500 text-white' };

  const copyWifi = () => {
    if (!store.wifiPassword) return;
    navigator.clipboard?.writeText(store.wifiPassword).catch(() => {});
    setCopiedWifi(true);
    setTimeout(() => setCopiedWifi(false), 1800);
  };

  return (
    <div
      dir="rtl"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl rounded-3xl bg-white dark:bg-[#071324] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col text-[#0B1F3A] dark:text-slate-100"
      >
        {/* Store Profile Hero Cover */}
        <div className="relative h-52 sm:h-60 bg-[#0B1F3A] shrink-0">
          <img
            src={store.cover}
            alt={store.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-85"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B1F3A] via-[#0B1F3A]/45 to-transparent" />

          {/* Top Bar inside Cover */}
          <div className="absolute top-4 right-4 left-4 flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-[#0B1F3A]/85 backdrop-blur-md text-[#00C2FF] border border-[#00C2FF]/30 text-xs font-black">
                {store.category}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-black shadow-sm ${crowdBadge.cls}`}>
                ● {crowdBadge.label}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-[#FBBF24] text-xs font-black flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>4.9</span>
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="w-9 h-9 rounded-full bg-slate-950/80 hover:bg-slate-950 text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Store Identity at Bottom of Cover */}
          <div className="absolute bottom-4 right-5 left-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex items-end gap-3.5">
              <img
                src={store.logo}
                alt={store.name}
                referrerPolicy="no-referrer"
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-3 border-white object-cover bg-white shadow-xl shrink-0"
              />
              <div className="text-white space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg sm:text-2xl font-black">{store.name}</h2>
                  {store.verifiedOwnership && (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-[#0B1F3A] text-[10px] font-black flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>موثق</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-200 font-bold">
                  📍 {store.city} ({store.area}) · {store.branches.length}{' '}
                  {store.branches.length === 1 ? 'فرع' : 'فروع'} ·{' '}
                  <span className="text-[#00C2FF]">
                    +{store.metrics?.activeCards || 640} حامل بطاقة ولاء
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-end">
              <Link
                href={`/stores/${store.slug}`}
                className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md text-white border border-white/25 text-xs font-black flex items-center gap-1.5 transition"
              >
                <span>البروفايل الكامل</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#00C2FF]" />
              </Link>
            </div>
          </div>
        </div>

        {/* Profile Navigation Tabs */}
        <div className="px-5 pt-3 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('menu')}
              className={`px-4 py-2.5 rounded-t-2xl text-xs sm:text-sm font-black flex items-center gap-2 border-b-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'menu'
                  ? 'border-[#00C2FF] text-[#0B1F3A] dark:text-[#00C2FF] bg-white dark:bg-[#071324]'
                  : 'border-transparent text-slate-500 hover:text-[#0B1F3A] dark:hover:text-white'
              }`}
            >
              <UtensilsCrossed className="w-4 h-4 text-[#00C2FF]" />
              <span>المنيو الرقمي والعروض ({store.menu.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('wallet')}
              className={`px-4 py-2.5 rounded-t-2xl text-xs sm:text-sm font-black flex items-center gap-2 border-b-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'wallet'
                  ? 'border-[#FBBF24] text-[#0B1F3A] dark:text-[#FBBF24] bg-white dark:bg-[#071324]'
                  : 'border-transparent text-slate-500 hover:text-[#0B1F3A] dark:hover:text-white'
              }`}
            >
              <Wallet className="w-4 h-4 text-[#FBBF24]" />
              <span>بطاقة الولاء والمكافآت</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('branches')}
              className={`px-4 py-2.5 rounded-t-2xl text-xs sm:text-sm font-black flex items-center gap-2 border-b-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'branches'
                  ? 'border-sky-500 text-[#0B1F3A] dark:text-sky-400 bg-white dark:bg-[#071324]'
                  : 'border-transparent text-slate-500 hover:text-[#0B1F3A] dark:hover:text-white'
              }`}
            >
              <MapPin className="w-4 h-4 text-sky-500" />
              <span>الفروع والتواصل ({store.branches.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('gallery')}
              className={`px-4 py-2.5 rounded-t-2xl text-xs sm:text-sm font-black flex items-center gap-2 border-b-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'gallery'
                  ? 'border-emerald-500 text-[#0B1F3A] dark:text-emerald-400 bg-white dark:bg-[#071324]'
                  : 'border-transparent text-slate-500 hover:text-[#0B1F3A] dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4 text-emerald-500" />
              <span>صور المكان والديكور ({store.storeGallery?.length || 0})</span>
            </button>
          </div>

          {store.workingHours && (
            <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 pb-2">
              <Clock className="w-3.5 h-3.5 text-emerald-500" />
              <span>{store.workingHours}</span>
            </span>
          )}
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-white">
          {/* Quick Store Bio + Loyalty Highlight Banner (Light Mode) */}
          <div className="p-4 rounded-2xl bg-gradient-to-l from-amber-50 via-sky-50/70 to-white text-[#0B1F3A] border border-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-black text-sky-700">
                <Gift className="w-4 h-4 text-amber-500" />
                <span>
                  مكافأة ولاء المتجر ({store.loyaltyRule.type === 'stamps' ? 'نظام الأختام' : 'نظام النقاط'})
                </span>
              </div>
              <p className="text-sm sm:text-base font-black text-[#0B1F3A]">
                🎁 {store.loyaltyRule.rewardDescription || 'نقاط ومكافآت فورية في محفظة هاتفك'}
              </p>
              <p className="text-xs text-slate-600">{store.description}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onJoinLoyalty && store.subscriptionPlan !== 'Viewer' ? (
                <button
                  type="button"
                  onClick={() => onJoinLoyalty(store)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] text-xs font-black shadow-sm cursor-pointer"
                >
                  {isJoined ? 'مضاف لمحفظتك ✓' : 'احفظ الكارت في المحفظة'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveTab('wallet')}
                  className="px-4 py-2.5 rounded-xl bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] text-xs font-black shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <QrCode className="w-4 h-4" />
                  <span>معاينة كارت الولاء</span>
                </button>
              )}
            </div>
          </div>

          {/* TAB 1: Interactive Digital Menu */}
          {activeTab === 'menu' && (
            <InteractiveStoreMenu
              storeName={store.name}
              items={store.menu}
              loyaltyRule={store.loyaltyRule}
              isViewerOnly={store.subscriptionPlan === 'Viewer'}
              isNewStore={nowMs !== null ? isStoreNewWithinDays(store, 30, nowMs) : false}
              compact
            />
          )}

          {/* TAB 2: Digital Wallet Pass Preview (Light Mode) */}
          {activeTab === 'wallet' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Realistic Web-Based Smart Pass Card */}
              <div className="md:col-span-6 rounded-3xl bg-gradient-to-br from-sky-50 via-white to-amber-50 text-[#0B1F3A] p-6 border-2 border-amber-300 shadow-lg space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={store.logo}
                      alt={store.name}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-2xl border border-slate-200 object-cover bg-white shadow-2xs"
                    />
                    <div>
                      <div className="text-[10px] font-black text-sky-700">
                        WEB-BASED SMART PASS
                      </div>
                      <h4 className="text-base font-black text-[#0B1F3A]">{store.name}</h4>
                    </div>
                  </div>
                  <img
                    src="/logo-color.png"
                    alt="Aada Pass"
                    className="h-7 w-auto object-contain"
                  />
                </div>

                {/* Stamps or Points Visual */}
                <div className="p-4 rounded-2xl bg-white border border-amber-200/90 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-bold">هدف المكافأة</span>
                    <span className="font-black text-amber-700">
                      {store.loyaltyRule.type === 'stamps'
                        ? `${store.loyaltyRule.stampsRequired || 6} أختام`
                        : `${store.loyaltyRule.rewardTargetPoints || 100} نقطة ولاء`}
                    </span>
                  </div>

                  {store.loyaltyRule.type === 'stamps' ? (
                    <div
                      className={`grid gap-2 ${
                        (store.loyaltyRule.stampsRequired || 6) <= 4
                          ? 'grid-cols-4'
                          : (store.loyaltyRule.stampsRequired || 6) <= 8
                          ? 'grid-cols-4'
                          : 'grid-cols-6'
                      }`}
                    >
                      {Array.from({ length: store.loyaltyRule.stampsRequired || 6 }).map((_, idx) => {
                        const filled = idx < Math.ceil((store.loyaltyRule.stampsRequired || 6) * 0.6);
                        return (
                          <div
                            key={idx}
                            className={`h-9 rounded-xl flex items-center justify-center text-xs font-black ${
                              filled
                                ? 'bg-gradient-gold-cta text-[#0B1F3A] shadow-2xs'
                                : 'border border-dashed border-sky-300 bg-sky-50/50 text-sky-700'
                            }`}
                          >
                            {filled ? (
                              <StampShapeIcon shape={store.loyaltyRule.stampShape} className="w-4 h-4" />
                            ) : (
                              idx + 1
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="w-full h-2.5 bg-sky-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-electric rounded-full w-2/3" />
                      </div>
                      <div className="text-[11px] text-sky-700 font-bold">
                        {store.loyaltyRule.pointsCalcMode === 'per_amount'
                          ? `اكسب ${store.loyaltyRule.pointsPerUnit || 10} نقاط لكل ${store.loyaltyRule.currencyUnitAmount || 10} ${store.currency}`
                          : 'نظام شرائح الإنفاق التصاعدية'}
                      </div>
                    </div>
                  )}
                  <p className="text-xs font-bold text-amber-800">
                    {store.loyaltyRule.rewardDescription}
                  </p>
                </div>

                {/* QR Pass Footer */}
                <div className="bg-white text-[#0B1F3A] rounded-2xl p-4 flex items-center justify-between border border-sky-200/90 shadow-2xs">
                  <div className="space-y-0.5">
                    <div className="text-[10px] text-slate-400 font-bold">كود التفعيل السريع</div>
                    <div className="text-sm font-black">{store.name}</div>
                    <div className="text-xs font-mono text-sky-600 font-bold">
                      AADA-{store.id.toUpperCase()}-PASS
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-sky-50 border border-sky-200">
                    <QrCode className="w-12 h-12 text-sky-700" />
                  </div>
                </div>
              </div>

              {/* Loyalty Rules & Perks Explanation */}
              <div className="md:col-span-6 space-y-4">
                <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-sm font-black text-[#0B1F3A] dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#00C2FF]" />
                    <span>كيف تكسب النقاط والمكافآت في {store.name}؟</span>
                  </h4>
                  <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                    <li className="flex items-start gap-2">
                      <span className="text-[#00C2FF] font-black">1.</span>
                      <span>افتح رابط الويب الخاص بالمتجر من متصفح هاتفك مباشرة بدون تحميل أي تطبيقات.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#00C2FF] font-black">2.</span>
                      <span>اعرض بطاقة الويب السحابية للكاشير عند كل زيارة ليتم مسح الـ QR وإضافة نقاطك أو أختامك لحظياً عبر الإنترنت.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#00C2FF] font-black">3.</span>
                      <span>استبدل نقاطك بمكافآت فورية: <strong className="text-[#0B1F3A] dark:text-white">{store.loyaltyRule.rewardDescription}</strong>.</span>
                    </li>
                  </ul>
                </div>

                {store.vouchers && store.vouchers.length > 0 && (
                  <div className="p-5 rounded-3xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/50 space-y-2.5">
                    <div className="text-xs font-black text-amber-900 dark:text-amber-300">
                      قسائم المكافآت الفعالة في المتجر:
                    </div>
                    {store.vouchers.map((v) => (
                      <div
                        key={v.id}
                        className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-800/50 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-black text-[#0B1F3A] dark:text-white">{v.title}</div>
                          <div className="text-[11px] text-slate-500">كود: {v.code}</div>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 font-black">
                          مقابل {v.pointsCost} نقطة
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Branches & Contact Info */}
          {activeTab === 'branches' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                  <Phone className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold">رقم التواصل المباشر</div>
                    <a href={`tel:${store.phone}`} dir="ltr" className="font-black text-sm hover:text-sky-600">
                      {store.phone}
                    </a>
                  </div>
                </div>

                {store.wifiPassword && (
                  <button
                    type="button"
                    onClick={copyWifi}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-right cursor-pointer hover:border-sky-400 transition"
                  >
                    <div className="flex items-center gap-3">
                      <Wifi className="w-5 h-5 text-sky-600 shrink-0" />
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold">شبكة الواي فاي للعملاء</div>
                        <div className="font-black text-sm">{store.wifiPassword}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-black text-sky-600 bg-sky-50 px-2.5 py-1 rounded-lg">
                      {copiedWifi ? 'تم النسخ ✓' : 'نسخ'}
                    </span>
                  </button>
                )}

                {store.instagramUrl && (
                  <a
                    href={store.instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3 hover:border-pink-400 transition"
                  >
                    <Instagram className="w-5 h-5 text-pink-600 shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold">حساب إنستغرام</div>
                      <div className="font-black text-xs text-pink-600">زيارة الحساب الرسمي ↗</div>
                    </div>
                  </a>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-black text-[#0B1F3A] dark:text-white">
                  الفروع المعتمدة وحالة الازدحام المباشرة ({store.branches.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {store.branches.map((b) => (
                    <div
                      key={b.id}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <h5 className="text-sm font-black text-[#0B1F3A] dark:text-white">{b.name}</h5>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                            b.crowdLevel === 'هادئ'
                              ? 'bg-emerald-100 text-emerald-800'
                              : b.crowdLevel === 'متوسط'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          ● {b.crowdLevel || 'هادئ'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        📍 {b.city} — {b.area} ({b.address})
                      </p>
                      <div className="flex items-center justify-between pt-1 text-xs font-bold">
                        <span dir="ltr" className="text-slate-600 dark:text-slate-300">
                          📞 {b.phone}
                        </span>
                        <a
                          href={store.googleMapLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-600 dark:text-[#00C2FF] hover:underline flex items-center gap-1"
                        >
                          <span>الاتجاهات على الخريطة</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Store Interior & Decor Gallery ("صور المكان والديكور") */}
          {activeTab === 'gallery' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-base font-black text-[#0B1F3A] dark:text-white">
                    صور وديكور وأجواء {store.name}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    شاهد تصميم المكان والجلسات الداخلية والخارجية الخاصة بالمتجر
                  </p>
                </div>
              </div>

              {!store.storeGallery || store.storeGallery.length === 0 ? (
                <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-900 text-center text-xs text-slate-500">
                  لم يقم المتجر بإضافة صور لديكور المكان بعد.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {store.storeGallery.map((imgUrl, idx) => (
                    <div
                      key={`${imgUrl}-${idx}`}
                      className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 aspect-[4/3] bg-slate-100 shadow-sm group"
                    >
                      <img
                        src={imgUrl}
                        alt={`ديكور وأجواء ${store.name} - صورة ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                      <span className="absolute bottom-2.5 right-2.5 bg-[#0B1F3A]/85 text-white text-[11px] font-bold px-2.5 py-1 rounded-xl">
                        أجواء المكان #{idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <a
              href={store.googleMapLink}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-black text-sky-600 dark:text-[#00C2FF] hover:underline flex items-center gap-1.5"
            >
              <MapPin className="w-4 h-4" />
              <span>فتح موقع المتجر على خرائط جوجل</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href={`/stores/${store.slug}`}
              className="px-5 py-2.5 rounded-xl bg-gradient-electric text-white text-xs font-black shadow-sm hover:opacity-95 transition"
            >
              فتح بروفايل المتجر الكامل ↗
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-[#0B1F3A] text-white text-xs font-bold cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
