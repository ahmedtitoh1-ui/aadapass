'use client';

import React, { useMemo, useState } from 'react';
import {
  Activity,
  Compass,
  CreditCard,
  Eye,
  Monitor,
  Search,
  Smartphone,
  Store as StoreIcon,
  UserCheck,
  Users,
} from 'lucide-react';
import type {
  CustomerProfile,
  StoreAdditionRequest,
  Transaction,
  VisitorLog,
} from '@/lib/types';

interface AdminVisitorsPanelProps {
  visitorLogs: VisitorLog[];
  customers: CustomerProfile[];
  transactions: Transaction[];
  storeRequests: StoreAdditionRequest[];
}

export default function AdminVisitorsPanel({
  visitorLogs,
  customers,
  transactions,
  storeRequests,
}: AdminVisitorsPanelProps) {
  const [viewMode, setViewMode] = useState<'visitors' | 'customers'>('visitors');
  const [visitorSearch, setVisitorSearch] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | 'EGP' | 'SAR'>('ALL');
  const [deviceFilter, setDeviceFilter] = useState<'ALL' | 'جوال' | 'كمبيوتر'>('ALL');

  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    customers[0]?.id || null
  );

  const filteredVisitors = useMemo(() => {
    const q = visitorSearch.trim().toLowerCase();
    return visitorLogs.filter((v) => {
      if (currencyFilter !== 'ALL' && v.currency !== currencyFilter) return false;
      if (deviceFilter !== 'ALL' && v.device !== deviceFilter) return false;
      if (!q) return true;
      return (
        v.pagePath.toLowerCase().includes(q) ||
        (v.storeName || '').toLowerCase().includes(q) ||
        (v.customerName || '').toLowerCase().includes(q) ||
        v.city.toLowerCase().includes(q) ||
        v.source.toLowerCase().includes(q)
      );
    });
  }, [visitorLogs, visitorSearch, currencyFilter, deviceFilter]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q)
    );
  }, [customers, customerSearch]);

  const selectedCustomer = useMemo(
    () =>
      customers.find((c) => c.id === selectedCustomerId) ||
      filteredCustomers[0] ||
      null,
    [customers, selectedCustomerId, filteredCustomers]
  );

  const selectedCustomerTx = useMemo(() => {
    if (!selectedCustomer) return [];
    return transactions.filter((t) => t.customerId === selectedCustomer.id).slice(0, 12);
  }, [transactions, selectedCustomer]);

  const registeredVisitsCount = visitorLogs.filter((v) => v.visitorType === 'عميل مسجل').length;
  const mobilePct = visitorLogs.length
    ? Math.round(
        (visitorLogs.filter((v) => v.device === 'جوال').length / visitorLogs.length) * 100
      )
    : 80;

  return (
    <div className="space-y-6">
      {/* KPIs Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        <div className="p-5 rounded-3xl glass-card">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
            <span>إجمالي زيارات الصفحات</span>
            <Eye className="w-4 h-4 text-[#0284C7] dark:text-[#00C2FF]" />
          </div>
          <div className="text-3xl font-black text-[#0B1F3A] dark:text-white">
            {visitorLogs.length}
          </div>
          <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            نسبة تصفح الجوال: {mobilePct}%
          </p>
        </div>

        <div className="p-5 rounded-3xl glass-card">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
            <span>العملاء المسجلون بالمنصة</span>
            <UserCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-black text-[#0B1F3A] dark:text-white">
            {customers.length}
          </div>
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">
            زيارات عملاء مسجلين: {registeredVisitsCount}
          </p>
        </div>

        <div className="p-5 rounded-3xl glass-card">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
            <span>بطاقات الولاء النشطة</span>
            <CreditCard className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-black text-[#0B1F3A] dark:text-white">
            {customers.reduce((acc, c) => acc + c.cards.length, 0)}
          </div>
          <p className="text-[11px] font-bold text-amber-700 dark:text-[#FBBF24] mt-1">
            إجمالي النقاط:{' '}
            {customers
              .reduce((acc, c) => acc + c.totalPointsAcrossAllStores, 0)
              .toLocaleString('en-US')}
          </p>
        </div>

        <div className="p-5 rounded-3xl glass-card">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
            <span>طلبات إضافة متاجر جديدة</span>
            <StoreIcon className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-3xl font-black text-[#0B1F3A] dark:text-white">
            {storeRequests.reduce((acc, r) => acc + r.count, 0)}
          </div>
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">
            من {storeRequests.length} متاجر مقترحة
          </p>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="p-2 rounded-2xl glass-card inline-flex items-center gap-2">
        <button
          type="button"
          onClick={() => setViewMode('visitors')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer ${
            viewMode === 'visitors'
              ? 'bg-gradient-gold-cta text-[#0B1F3A] shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-800'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>سجل الزوار المباشر ({visitorLogs.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setViewMode('customers')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer ${
            viewMode === 'customers'
              ? 'bg-gradient-gold-cta text-[#0B1F3A] shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>متابعة ملفات العملاء النهائيين ({customers.length})</span>
        </button>
      </div>

      {viewMode === 'visitors' ? (
        <div className="space-y-4">
          {/* Filters */}
          <div className="p-4 rounded-2xl glass-card flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={visitorSearch}
                onChange={(e) => setVisitorSearch(e.target.value)}
                placeholder="ابحث بالمسار، اسم المتجر، المدينة، أو المصدر..."
                className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={currencyFilter}
                onChange={(e) => setCurrencyFilter(e.target.value as 'ALL' | 'EGP' | 'SAR')}
                className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#0B1F3A] dark:text-white"
              >
                <option value="ALL">جميع الأسواق</option>
                <option value="EGP">مصر (EGP)</option>
                <option value="SAR">السعودية (SAR)</option>
              </select>

              <select
                value={deviceFilter}
                onChange={(e) => setDeviceFilter(e.target.value as 'ALL' | 'جوال' | 'كمبيوتر')}
                className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#0B1F3A] dark:text-white"
              >
                <option value="ALL">كل الأجهزة</option>
                <option value="جوال">الجوال</option>
                <option value="كمبيوتر">الكمبيوتر</option>
              </select>
            </div>
          </div>

          {/* Visitor Activity Table */}
          <div className="rounded-3xl glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-sky-50/70 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 font-black">
                    <th className="py-3.5 px-4">نوع الزائر</th>
                    <th className="py-3.5 px-4">الصفحة / المتجر الذي تمت زيارته</th>
                    <th className="py-3.5 px-4">المدينة والسوق</th>
                    <th className="py-3.5 px-4">الجهاز والمصدر</th>
                    <th className="py-3.5 px-4">التوقيت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                  {filteredVisitors.map((vis) => (
                    <tr key={vis.id} className="hover:bg-sky-50/40 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                            vis.visitorType === 'عميل مسجل'
                              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                              : vis.visitorType === 'زائر عائد'
                              ? 'bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300'
                              : 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300'
                          }`}
                        >
                          {vis.customerName || vis.visitorType}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-black text-[#0B1F3A] dark:text-white">
                          {vis.storeName || 'الصفحة الرئيسية / الدليل'}
                        </div>
                        <div className="text-[11px] font-mono text-[#0284C7] dark:text-[#00C2FF]">
                          {vis.pagePath}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-bold">
                        {vis.city} ({vis.currency})
                      </td>
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-bold">
                          {vis.device === 'جوال' ? (
                            <Smartphone className="w-3.5 h-3.5 text-[#0284C7]" />
                          ) : (
                            <Monitor className="w-3.5 h-3.5 text-amber-500" />
                          )}
                          <span>{vis.device}</span>
                          <span className="text-slate-400">·</span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {vis.source}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {vis.timestamp}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Customer Search & List (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="ابحث بالاسم، رقم الهاتف، أو البريد الإلكتروني..."
                className="w-full pr-10 pl-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
              />
            </div>

            <div className="space-y-2.5">
              {filteredCustomers.map((cust) => {
                const isSelected = selectedCustomer?.id === cust.id;
                return (
                  <button
                    key={cust.id}
                    type="button"
                    onClick={() => setSelectedCustomerId(cust.id)}
                    className={`w-full p-4 rounded-2xl text-right transition border cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-[#0B1F3A] text-white border-[#FBBF24] shadow-md'
                        : 'glass-card text-[#0B1F3A] dark:text-white hover:border-sky-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-black truncate">
                        {cust.firstName} {cust.lastName}
                      </div>
                      <div
                        className={`text-[11px] font-mono ${
                          isSelected ? 'text-sky-200' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {cust.phone} · {cust.cards.length} بطاقات
                      </div>
                    </div>
                    <div className="text-left shrink-0 tabular-nums">
                      <div className="text-sm font-black text-[#FBBF24]">
                        {cust.totalPointsAcrossAllStores} نقطة
                      </div>
                      <div
                        className={`text-[10px] ${
                          isSelected ? 'text-emerald-300' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {cust.referralsCount} دعوات ناجحة
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Customer Profile & Ledger (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {selectedCustomer ? (
              <div className="p-6 rounded-3xl glass-card space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200/80 dark:border-slate-700/70">
                  <div>
                    <h3 className="text-lg font-black text-[#0B1F3A] dark:text-white">
                      {selectedCustomer.firstName} {selectedCustomer.lastName}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {selectedCustomer.phone} · {selectedCustomer.email} · كود الدعوة:{' '}
                      {selectedCustomer.referralCode}
                    </p>
                  </div>
                  <span className="px-3.5 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-black tabular-nums">
                    إجمالي النقاط: {selectedCustomer.totalPointsAcrossAllStores}
                  </span>
                </div>

                {/* Loyalty Cards */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-black text-[#0284C7] dark:text-[#00C2FF]">
                    بطاقات الولاء لدى المتاجر ({selectedCustomer.cards.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 tabular-nums">
                    {selectedCustomer.cards.map((card) => (
                      <div
                        key={card.id}
                        className="p-3.5 rounded-2xl bg-white/85 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-black text-[#0B1F3A] dark:text-white">
                            {card.storeName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {card.rule.type === 'stamps' ? 'بطاقة أختام' : 'بطاقة نقاط'} · إجمالي مكتسب:{' '}
                            {card.totalEarned}
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 text-xs font-black">
                          {card.currentBalance}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Transactions */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-black text-[#0B1F3A] dark:text-white flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-[#0284C7]" />
                    سجل عمليات العميل ({selectedCustomerTx.length})
                  </h4>
                  {selectedCustomerTx.length === 0 ? (
                    <p className="text-xs text-slate-500">لا توجد عمليات مسجلة بعد لهذا العميل.</p>
                  ) : (
                    <div className="space-y-2 tabular-nums">
                      {selectedCustomerTx.map((tx) => (
                        <div
                          key={tx.id}
                          className="p-3 rounded-2xl bg-white/75 dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-black text-[#0B1F3A] dark:text-white">
                              {tx.storeName} — فاتورة {tx.invoiceNumber}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {tx.branchName} · {tx.timestamp}
                            </div>
                          </div>
                          <div className="text-left">
                            <div className="font-black text-[#0284C7] dark:text-[#00C2FF]">
                              {tx.amount} {tx.currency}
                            </div>
                            <div
                              className={`text-[11px] font-black ${
                                tx.pointsEarned >= 0 ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {tx.pointsEarned >= 0 ? `+${tx.pointsEarned}` : tx.pointsEarned} نقطة
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-3xl glass-card text-center text-xs text-slate-500">
                لا يوجد عملاء مطابقون لبحثك.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
