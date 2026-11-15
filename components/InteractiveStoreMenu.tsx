'use client';

import React, { useMemo, useState } from 'react';
import {
  Flame,
  LayoutGrid,
  List,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Tag,
  Wallet,
} from 'lucide-react';
import type { LoyaltyRule, MarketCurrency } from '@/lib/types';

export interface InteractiveMenuItem {
  id?: string;
  name: string;
  type: 'product' | 'service' | 'offer';
  category: string;
  price: number;
  currency: MarketCurrency;
  image: string;
  description: string;
  available: boolean;
  expiryDate?: string;
}

interface InteractiveStoreMenuProps {
  storeName: string;
  items: InteractiveMenuItem[];
  loyaltyRule?: LoyaltyRule;
  isViewerOnly?: boolean;
  isNewStore?: boolean;
  compact?: boolean;
}

export default function InteractiveStoreMenu({
  storeName,
  items,
  loyaltyRule,
  isViewerOnly = false,
  isNewStore = false,
  compact = false,
}: InteractiveStoreMenuProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});

  const categories = useMemo(() => {
    const unique = Array.from(new Set(items.map((i) => i.category)));
    const hasOffers = items.some((i) => i.type === 'offer');
    return hasOffers ? ['الكل', '🔥 العروض الخاصة', ...unique] : ['الكل', ...unique];
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedCategory === '🔥 العروض الخاصة') {
        if (item.type !== 'offer') return false;
      } else if (selectedCategory !== 'الكل' && item.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [items, selectedCategory, searchQuery]);

  const updateQty = (itemKey: string, delta: number) => {
    setSelectedQuantities((prev) => {
      const current = prev[itemKey] || 0;
      const next = Math.max(0, current + delta);
      const copy = { ...prev };
      if (next === 0) {
        delete copy[itemKey];
      } else {
        copy[itemKey] = next;
      }
      return copy;
    });
  };

  // Compute simulated order total & loyalty points/stamps earned
  const orderSummary = useMemo(() => {
    let totalAmount = 0;
    let totalCount = 0;
    let currency: MarketCurrency = items[0]?.currency || 'SAR';

    items.forEach((item, idx) => {
      const key = item.id || `${item.name}-${idx}`;
      const qty = selectedQuantities[key] || 0;
      if (qty > 0) {
        totalAmount += item.price * qty;
        totalCount += qty;
        currency = item.currency;
      }
    });

    let earnedText = '';
    if (!isViewerOnly && totalAmount > 0) {
      if (loyaltyRule?.type === 'stamps') {
        const req = loyaltyRule.stampsRequired || 6;
        earnedText = `+1 ختم ولاء جديد في محفظتك (من أصل ${req} أختام للمكافأة)`;
      } else {
        // Calculate points from rules or fallback 1 point per 2 currency units
        const matchedTier = loyaltyRule?.pointRules?.find(
          (r) => totalAmount >= r.minAmount && totalAmount <= r.maxAmount
        );
        const pts = matchedTier ? matchedTier.points : Math.max(15, Math.round(totalAmount * 0.6));
        earnedText = `+${pts} نقطة ولاء فورية تضاف لبطاقتك عند الكاشير`;
      }
    }

    return {
      totalAmount,
      totalCount,
      currency,
      earnedText,
    };
  }, [items, selectedQuantities, loyaltyRule, isViewerOnly]);

  const formatPrice = (price: number, curr: MarketCurrency) =>
    `${price} ${curr === 'SAR' ? 'ر.س' : 'ج.م'}`;

  return (
    <div className="space-y-6">
      {/* Digital Menu Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 text-sky-700 dark:text-[#00C2FF] border border-sky-500/20 text-[11px] font-black">
            <Sparkles className="w-3.5 h-3.5 text-[#FBBF24]" />
            <span>المنيو الرقمي التفاعلي · {items.length} أصناف</span>
          </div>
          <h3 className={`${compact ? 'text-lg' : 'text-xl sm:text-2xl'} font-black text-[#0B1F3A] dark:text-white`}>
            قائمة {storeName} والعروض الحصرية
          </h3>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن مشروب، طبق، أو عرض..."
              className="w-full pr-9 pl-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#0B1F3A] dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Grid / List Toggle */}
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="عرض شبكي بصور كبيرة"
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[#0B1F3A] text-[#00C2FF] shadow-xs'
                  : 'text-slate-500 hover:text-[#0B1F3A] dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="عرض قائمة سريعة"
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[#0B1F3A] text-[#00C2FF] shadow-xs'
                  : 'text-slate-500 hover:text-[#0B1F3A] dark:hover:text-white'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat;
          const count =
            cat === 'الكل'
              ? items.length
              : cat === '🔥 العروض الخاصة'
              ? items.filter((i) => i.type === 'offer').length
              : items.filter((i) => i.category === cat).length;

          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-2xl text-xs font-black whitespace-nowrap flex items-center gap-2 transition cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-gradient-to-l from-[#0B1F3A] to-[#10325E] text-white border border-[#00C2FF]/40 shadow-md'
                  : 'bg-slate-100/90 dark:bg-slate-800/80 text-[#0B1F3A] dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 hover:bg-sky-50'
              }`}
            >
              <span>{cat}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  isActive
                    ? 'bg-[#00C2FF]/20 text-[#00C2FF]'
                    : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Menu Items Display */}
      {filteredItems.length === 0 ? (
        <div className="p-8 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-800 text-center space-y-2">
          <p className="text-sm font-black text-[#0B1F3A] dark:text-white">
            لا توجد أصناف مطابقة لبحثك
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('الكل');
              setSearchQuery('');
            }}
            className="px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-black cursor-pointer"
          >
            عرض كل الأصناف
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className={`grid grid-cols-1 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'} gap-5`}>
          {filteredItems.map((item, idx) => {
            const itemKey = item.id || `${item.name}-${idx}`;
            const qty = selectedQuantities[itemKey] || 0;
            const isOffer = item.type === 'offer';

            return (
              <div
                key={itemKey}
                className={`group rounded-3xl overflow-hidden transition-all duration-300 flex flex-col justify-between border ${
                  isOffer
                    ? 'bg-gradient-to-b from-amber-50/70 via-white to-white dark:from-amber-950/25 dark:via-slate-900 dark:to-slate-900 border-amber-300 dark:border-amber-700/60 shadow-md'
                    : 'bg-white dark:bg-slate-900/90 border-slate-200/90 dark:border-slate-800 hover:border-sky-400 hover:shadow-lg'
                }`}
              >
                <div>
                  {/* Dish Image Header */}
                  <div className="relative h-44 w-full overflow-hidden bg-slate-900">
                    <img
                      src={item.image}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0B1F3A]/80 via-transparent to-transparent" />

                    {/* Top Badges */}
                    <div className="absolute top-3 right-3 left-3 flex items-center justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-full bg-[#0B1F3A]/85 backdrop-blur-md text-white text-[10px] font-black border border-white/15">
                        {item.category}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isNewStore && (
                          <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-[10px] font-black flex items-center gap-1 shadow-md border border-white/40">
                            <Sparkles className="w-3 h-3" />
                            <span>جديد</span>
                          </span>
                        )}
                        {isOffer && (
                          <span className="px-2.5 py-1 rounded-full bg-gradient-gold-cta text-[#0B1F3A] text-[10px] font-black flex items-center gap-1 shadow-sm">
                            <Flame className="w-3 h-3 fill-current" />
                            <span>عرض حصري</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Price Pill on Image Bottom */}
                    <div className="absolute bottom-3 right-3 left-3 flex items-end justify-between">
                      <span className="px-3.5 py-1.5 rounded-2xl bg-[#0B1F3A]/90 backdrop-blur-md text-[#FBBF24] border border-[#FBBF24]/40 text-sm font-black shadow-md tabular-nums">
                        {formatPrice(item.price, item.currency)}
                      </span>
                      {!isViewerOnly && (
                        <span className="px-2.5 py-1 rounded-xl bg-sky-500/25 backdrop-blur-md text-sky-200 border border-sky-400/30 text-[10px] font-black">
                          {loyaltyRule?.type === 'stamps' ? '+ ختم ولاء' : '+ نقاط ولاء'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Item Details */}
                  <div className="p-4 space-y-2">
                    <h4 className="text-sm sm:text-base font-black text-[#0B1F3A] dark:text-white leading-snug">
                      {item.name}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                      {item.description}
                    </p>
                    {item.expiryDate && (
                      <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1 pt-0.5">
                        <Tag className="w-3 h-3" />
                        <span>العرض ساري حتى {item.expiryDate}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Interactive Add to Order Simulator Footer */}
                <div className="px-4 py-3 bg-slate-50/80 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {item.available ? '● متوفر الآن في الفرع' : 'غير متوفر حالياً'}
                  </span>

                  {qty === 0 ? (
                    <button
                      type="button"
                      onClick={() => updateQty(itemKey, 1)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#0B1F3A] hover:bg-[#10325E] text-white text-xs font-black flex items-center gap-1 transition cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#00C2FF]" />
                      <span>أضف لمعاينة الطلب</span>
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-2 bg-[#0B1F3A] text-white px-2.5 py-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => updateQty(itemKey, -1)}
                        className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-black text-[#FBBF24] min-w-[18px] text-center tabular-nums">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQty(itemKey, 1)}
                        className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
                      >
                        <Plus className="w-3 h-3 text-[#00C2FF]" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Compact Luxury List Mode */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredItems.map((item, idx) => {
            const itemKey = item.id || `${item.name}-${idx}`;
            const qty = selectedQuantities[itemKey] || 0;
            return (
              <div
                key={itemKey}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-sky-400 transition flex items-center gap-3.5"
              >
                <div className="relative w-20 h-20 shrink-0">
                  <img
                    src={item.image}
                    alt={item.name}
                    referrerPolicy="no-referrer"
                    className="w-20 h-20 rounded-2xl object-cover border border-slate-100 dark:border-slate-800"
                  />
                  {isNewStore && (
                    <span className="absolute -top-1.5 -right-1.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-[9px] font-black shadow-md border border-white">
                      جديد
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black text-sky-600 dark:text-[#00C2FF]">
                      {item.category}
                    </span>
                    <span className="text-sm font-black text-[#0B1F3A] dark:text-[#FBBF24] tabular-nums">
                      {formatPrice(item.price, item.currency)}
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-[#0B1F3A] dark:text-white truncate">
                    {item.name}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                    {item.description}
                  </p>
                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      متوفر
                    </span>
                    {qty === 0 ? (
                      <button
                        type="button"
                        onClick={() => updateQty(itemKey, 1)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-[#0B1F3A] hover:text-white text-xs font-black transition cursor-pointer"
                      >
                        + أضف
                      </button>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 bg-[#0B1F3A] text-white px-2 py-0.5 rounded-lg text-xs font-black">
                        <button type="button" onClick={() => updateQty(itemKey, -1)} className="cursor-pointer">
                          -
                        </button>
                        <span className="text-[#FBBF24] px-1">{qty}</span>
                        <button type="button" onClick={() => updateQty(itemKey, 1)} className="cursor-pointer">
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Order & Loyalty Points Calculator Bar */}
      {orderSummary.totalCount > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-l from-[#0B1F3A] via-[#10325E] to-[#0B1F3A] text-white border-2 border-[#FBBF24] shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#FBBF24]/20 border border-[#FBBF24]/40 flex items-center justify-center text-[#FBBF24] shrink-0">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300">
                  معاينة طلبك المختار ({orderSummary.totalCount} أصناف):
                </span>
                <span className="text-base sm:text-lg font-black text-[#FBBF24] tabular-nums">
                  {formatPrice(orderSummary.totalAmount, orderSummary.currency)}
                </span>
              </div>
              {orderSummary.earnedText && (
                <div className="text-xs font-black text-[#00C2FF] flex items-center gap-1.5 mt-0.5">
                  <Wallet className="w-3.5 h-3.5 text-[#FBBF24]" />
                  <span>{orderSummary.earnedText}</span>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedQuantities({})}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-200 cursor-pointer shrink-0"
          >
            إفراغ المعاينة
          </button>
        </div>
      )}
    </div>
  );
}
