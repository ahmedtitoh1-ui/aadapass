'use client';

import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  Printer,
  TrendingUp,
} from 'lucide-react';
import type {
  CustomerProfile,
  Store,
  SubscriptionPackage,
  SupportTicket,
  Transaction,
  VisitorLog,
} from '@/lib/types';

interface AdminReportsPanelProps {
  stores: Store[];
  packages: SubscriptionPackage[];
  transactions: Transaction[];
  visitorLogs: VisitorLog[];
  customers: CustomerProfile[];
  tickets: SupportTicket[];
  notify: (text: string, type?: 'ok' | 'err') => void;
}

const PIE_COLORS = ['#0284C7', '#FBBF24', '#10B981', '#6366F1', '#F43F5E'];

export default function AdminReportsPanel({
  stores,
  packages,
  transactions,
  visitorLogs,
  customers,
  tickets,
  notify,
}: AdminReportsPanelProps) {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'quarter' | 'all'>('30d');
  const [marketFilter, setMarketFilter] = useState<'ALL' | 'EGP' | 'SAR'>('ALL');

  const scopedStores = useMemo(() => {
    if (marketFilter === 'ALL') return stores;
    return stores.filter((s) => s.currency === marketFilter);
  }, [stores, marketFilter]);

  const scopedTransactions = useMemo(() => {
    const storeIds = new Set(scopedStores.map((s) => s.id));
    return transactions.filter((t) => marketFilter === 'ALL' || storeIds.has(t.storeId));
  }, [transactions, scopedStores, marketFilter]);

  const scaleFactor =
    dateRange === '7d' ? 0.35 : dateRange === '30d' ? 1 : dateRange === 'quarter' ? 2.6 : 4;

  const monthlyRevenueSar = useMemo(() => {
    return scopedStores.reduce((sum, s) => {
      const pkg = packages.find((p) => p.name === s.subscriptionPlan);
      return sum + (pkg?.monthlyPrice || 0);
    }, 0);
  }, [scopedStores, packages]);

  const totalPointsIssued = useMemo(() => {
    const raw = scopedTransactions
      .filter((t) => t.pointsEarned > 0)
      .reduce((acc, t) => acc + t.pointsEarned, 0);
    return Math.round((raw || 18450) * scaleFactor);
  }, [scopedTransactions, scaleFactor]);

  const totalPointsRedeemed = useMemo(() => {
    const raw = scopedTransactions
      .filter((t) => t.pointsEarned < 0 || (t.pointsSpent ?? 0) > 0)
      .reduce((acc, t) => acc + Math.abs(t.pointsSpent || t.pointsEarned), 0);
    return Math.round((raw || 6420) * scaleFactor);
  }, [scopedTransactions, scaleFactor]);

  const redemptionRate = totalPointsIssued
    ? Math.min(100, Math.round((totalPointsRedeemed / totalPointsIssued) * 100))
    : 34;

  // Weekly / Period trend series for AreaChart
  const growthChartData = useMemo(() => {
    const labels =
      dateRange === '7d'
        ? ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']
        : ['الأسبوع 1', 'الأسبوع 2', 'الأسبوع 3', 'الأسبوع 4', 'الأسبوع 5', 'الأسبوع 6'];

    return labels.map((label, idx) => {
      const factor = 0.72 + idx * 0.14;
      return {
        label,
        visitors: Math.round((scopedStores.length * 420 + visitorLogs.length * 45) * factor * (dateRange === '7d' ? 0.35 : 1)),
        purchases: Math.round((scopedStores.length * 165 + scopedTransactions.length * 12) * factor * (dateRange === '7d' ? 0.35 : 1)),
        points: Math.round((1400 + idx * 520) * scaleFactor),
      };
    });
  }, [dateRange, scopedStores.length, visitorLogs.length, scopedTransactions.length, scaleFactor]);

  // Top Stores BarChart Data
  const storePerformanceData = useMemo(() => {
    return scopedStores.map((s) => {
      const pkg = packages.find((p) => p.name === s.subscriptionPlan);
      return {
        name: s.name.split('—')[0].trim(),
        city: s.city,
        plan: s.subscriptionPlan,
        activeCards: Math.round(s.metrics.activeCards * scaleFactor),
        digitalVisitors: Math.round(s.metrics.digitalVisitors * scaleFactor),
        verifiedPurchases: Math.round(s.metrics.verifiedPurchases * scaleFactor),
        retentionRate: s.metrics.retentionRate,
        revenueSar: Math.round((pkg?.monthlyPrice || 0) * (dateRange === 'quarter' ? 3 : 1)),
      };
    });
  }, [scopedStores, packages, scaleFactor, dateRange]);

  // Package Distribution PieChart Data
  const planDistributionData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of scopedStores) {
      const label =
        s.subscriptionPlan === 'Viewer'
          ? 'التواجد الرقمي'
          : s.subscriptionPlan === 'Starter'
          ? 'باقة الانطلاق'
          : s.subscriptionPlan === 'Growth'
          ? 'باقة النمو'
          : s.subscriptionPlan;
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [scopedStores]);

  const exportExcel = (kind: 'stores' | 'visitors' | 'transactions') => {
    const wb = XLSX.utils.book_new();
    if (kind === 'stores') {
      const rows = storePerformanceData.map((r) => ({
        'المتجر': r.name,
        'المدينة': r.city,
        'الباقة': r.plan,
        'الزوار الرقميون': r.digitalVisitors,
        'العمليات الموثقة': r.verifiedPurchases,
        'البطاقات النشطة': r.activeCards,
        'معدل الاحتفاظ %': r.retentionRate,
        'الإيراد (ر.س)': r.revenueSar,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'تقرير المتاجر');
      XLSX.writeFile(wb, `aada-stores-report-${dateRange}.xlsx`);
      notify('تم تصدير تقرير المتاجر والإيرادات إلى Excel بنجاح');
      return;
    }

    if (kind === 'visitors') {
      const rows = visitorLogs.map((v) => ({
        'نوع الزائر': v.visitorType,
        'العميل': v.customerName || '-',
        'الصفحة': v.pagePath,
        'المتجر': v.storeName || 'الرئيسية',
        'المدينة': v.city,
        'السوق': v.currency,
        'الجهاز': v.device,
        'المصدر': v.source,
        'التوقيت': v.timestamp,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'سجل الزوار');
      XLSX.writeFile(wb, `aada-visitors-report-${dateRange}.xlsx`);
      notify('تم تصدير تقرير الزوار والعملاء إلى Excel بنجاح');
      return;
    }

    const txRows = scopedTransactions.map((t) => ({
      'رقم الفاتورة': t.invoiceNumber,
      'المتجر': t.storeName,
      'الفرع': t.branchName,
      'العميل': t.customerName,
      'القيمة': t.amount,
      'العملة': t.currency,
      'النقاط': t.pointsEarned,
      'النوع': t.type,
      'التوقيت': t.timestamp,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txRows), 'سجل العمليات');
    XLSX.writeFile(wb, `aada-transactions-${dateRange}.xlsx`);
    notify('تم تصدير سجل العمليات المالي إلى Excel بنجاح');
  };

  return (
    <div className="space-y-6">
      {/* Header Controls & Export Toolbar */}
      <div className="p-5 sm:p-6 rounded-3xl glass-card flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100 dark:bg-sky-500/20 text-[#0284C7] dark:text-[#00C2FF] text-xs font-black">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>مركز التقارير والتحليلات المالية</span>
          </div>
          <h2 className="text-xl font-black text-[#0B1F3A] dark:text-white">
            تقارير الأداء، نمو المتاجر، وتفاعل العملاء
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#0B1F3A] dark:text-white"
          >
            <option value="7d">آخر 7 أيام</option>
            <option value="30d">آخر 30 يوماً</option>
            <option value="quarter">الربع الحالي</option>
            <option value="all">كل الفترات</option>
          </select>

          <select
            value={marketFilter}
            onChange={(e) => setMarketFilter(e.target.value as typeof marketFilter)}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#0B1F3A] dark:text-white"
          >
            <option value="ALL">كل الأسواق (مصر + السعودية)</option>
            <option value="EGP">السوق المصري (EGP)</option>
            <option value="SAR">السوق السعودي (SAR)</option>
          </select>

          <button
            type="button"
            onClick={() => exportExcel('stores')}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel المتاجر</span>
          </button>

          <button
            type="button"
            onClick={() => exportExcel('visitors')}
            className="px-3.5 py-2 rounded-xl bg-[#0284C7] hover:bg-sky-600 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Excel الزوار</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl bg-[#0B1F3A] hover:bg-[#10325E] text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-[#FBBF24]" />
            <span>طباعة التقرير</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        <div className="p-5 rounded-3xl glass-card">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400">إيراد الاشتراكات المقدر</div>
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {Math.round(monthlyRevenueSar * (dateRange === 'quarter' ? 3 : 1)).toLocaleString('en-US')} ر.س
          </div>
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">
            من {scopedStores.length} متاجر في النطاق المختار
          </div>
        </div>

        <div className="p-5 rounded-3xl glass-card">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400">النقاط المصدرة والمستبدلة</div>
          <div className="text-3xl font-black text-[#0B1F3A] dark:text-white mt-1">
            {totalPointsIssued.toLocaleString('en-US')}
          </div>
          <div className="text-[11px] font-bold text-[#0284C7] dark:text-[#00C2FF] mt-1">
            المستبدلة: {totalPointsRedeemed.toLocaleString('en-US')} ({redemptionRate}%)
          </div>
        </div>

        <div className="p-5 rounded-3xl glass-card">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400">متوسط التذاكر والدعم</div>
          <div className="text-3xl font-black text-[#0B1F3A] dark:text-white mt-1">
            {tickets.length}
          </div>
          <div className="text-[11px] font-bold text-amber-700 dark:text-[#FBBF24] mt-1">
            محلولة: {tickets.filter((t) => t.status === 'محلولة' || t.status === 'تم الحل').length} · نشطة:{' '}
            {tickets.filter((t) => t.status !== 'محلولة' && t.status !== 'تم الحل').length}
          </div>
        </div>

        <div className="p-5 rounded-3xl glass-card">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400">حجم قاعدة العملاء</div>
          <div className="text-3xl font-black text-[#0B1F3A] dark:text-white mt-1">
            {customers.length}
          </div>
          <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            عمليات موثقة: {scopedTransactions.length}
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Growth Area Chart */}
        <div className="lg:col-span-8 p-6 rounded-3xl glass-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#0284C7]" />
              منحنى الزوار الرقميين والعمليات الموثقة
            </h3>
            <span className="text-[11px] font-bold text-slate-400">تحديث لحظي</span>
          </div>

          <div className="h-72 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthChartData}>
                <defs>
                  <linearGradient id="visGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284C7" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0284C7" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="purGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FBBF24" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#FBBF24" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="visitors"
                  name="الزوار الرقميون"
                  stroke="#0284C7"
                  strokeWidth={2.5}
                  fill="url(#visGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="purchases"
                  name="العمليات الموثقة"
                  stroke="#F59E0B"
                  strokeWidth={2.5}
                  fill="url(#purGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Package Split PieChart */}
        <div className="lg:col-span-4 p-6 rounded-3xl glass-card space-y-4">
          <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white">
            توزيع المتاجر حسب الباقة
          </h3>
          <div className="h-56 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={planDistributionData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={78}
                  paddingAngle={4}
                >
                  {planDistributionData.map((entry, idx) => (
                    <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5">
            {planDistributionData.map((item, idx) => (
              <div
                key={item.name}
                className="flex items-center justify-between text-xs font-bold tabular-nums"
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                  />
                  <span>{item.name}</span>
                </span>
                <span className="text-[#0B1F3A] dark:text-white font-black">{item.value} متجر</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Store Comparison BarChart + Performance Table */}
      <div className="p-6 rounded-3xl glass-card space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white">
            أداء المتاجر التفصيلي والبطاقات النشطة
          </h3>
          <button
            type="button"
            onClick={() => exportExcel('transactions')}
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#0284C7]" />
            <span>تصدير سجل العمليات</span>
          </button>
        </div>

        <div className="h-64 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={storePerformanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip />
              <Bar dataKey="verifiedPurchases" name="العمليات الموثقة" fill="#0284C7" radius={[8, 8, 0, 0]} />
              <Bar dataKey="activeCards" name="البطاقات النشطة" fill="#FBBF24" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs tabular-nums">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                <th className="py-3 px-3">المتجر</th>
                <th className="py-3 px-3">المدينة</th>
                <th className="py-3 px-3">الباقة</th>
                <th className="py-3 px-3">الزوار الرقميون</th>
                <th className="py-3 px-3">العمليات الموثقة</th>
                <th className="py-3 px-3">البطاقات النشطة</th>
                <th className="py-3 px-3">معدل الاحتفاظ</th>
                <th className="py-3 px-3">العائد المقدر</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
              {storePerformanceData.map((row) => (
                <tr key={row.name} className="hover:bg-sky-50/40 dark:hover:bg-slate-800/30">
                  <td className="py-3 px-3 font-black text-[#0B1F3A] dark:text-white">{row.name}</td>
                  <td className="py-3 px-3">{row.city}</td>
                  <td className="py-3 px-3 font-bold text-[#0284C7] dark:text-[#00C2FF]">{row.plan}</td>
                  <td className="py-3 px-3">{row.digitalVisitors.toLocaleString('en-US')}</td>
                  <td className="py-3 px-3 font-bold">{row.verifiedPurchases.toLocaleString('en-US')}</td>
                  <td className="py-3 px-3">{row.activeCards.toLocaleString('en-US')}</td>
                  <td className="py-3 px-3 font-black text-emerald-600 dark:text-emerald-400">
                    {row.retentionRate}%
                  </td>
                  <td className="py-3 px-3 font-black text-amber-700 dark:text-[#FBBF24]">
                    {row.revenueSar.toLocaleString('en-US')} ر.س
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
