'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  Headphones,
  Lock,
  MessageSquare,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  Store as StoreIcon,
  Sun,
  Ticket as TicketIcon,
  UserCheck,
} from 'lucide-react';
import { authFetch, setStoredAccessToken } from '@/lib/clientAuth';
import type {
  AuditLog,
  CannedResponse,
  CustomerProfile,
  DisputeCategory,
  FinancialAdjustmentRequest,
  SessionUser,
  Store,
  SupportTicket,
  TicketWorkflowStatus,
  Transaction,
} from '@/lib/types';

type SupportTab = 'tickets' | 'disputes' | 'lookup' | 'audit' | 'canned';

export default function SupportPortal() {
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(false);
  const [activeTab, setActiveTab] = useState<SupportTab>('tickets');
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [financialAdjustments, setFinancialAdjustments] = useState<FinancialAdjustmentRequest[]>([]);
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [disputeCategoryFilter, setDisputeCategoryFilter] = useState<string>('ALL');
  const [noteInput, setNoteInput] = useState('');
  const [escalateReason, setEscalateReason] = useState('');
  const [lookupQuery, setLookupQuery] = useState('');

  const [adjOriginalTxId, setAdjOriginalTxId] = useState('tx-1001');
  const [adjPointsDelta, setAdjPointsDelta] = useState('50');
  const [adjAmountSar, setAdjAmountSar] = useState('25');
  const [adjReason, setAdjReason] = useState('');

  const [newCannedTitle, setNewCannedTitle] = useState('');
  const [newCannedCategory, setNewCannedCategory] = useState<DisputeCategory | 'عام'>('نقاط');
  const [newCannedBody, setNewCannedBody] = useState('');

  const notify = (text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  const applyMePayload = useCallback((data: Record<string, unknown>) => {
    if (data.user) setCurrentUser(data.user as SessionUser);
    if (Array.isArray(data.tickets)) {
      const list = data.tickets as SupportTicket[];
      setTickets(list);
      if (list.length > 0) {
        setSelectedTicketId((prev) => prev || list[0].id);
      }
    }
    if (Array.isArray(data.financialAdjustments)) {
      setFinancialAdjustments(data.financialAdjustments as FinancialAdjustmentRequest[]);
    }
    if (Array.isArray(data.cannedResponses)) {
      setCannedResponses(data.cannedResponses as CannedResponse[]);
    }
    if (Array.isArray(data.stores)) setStores(data.stores as Store[]);
    if (Array.isArray(data.customers)) setCustomers(data.customers as CustomerProfile[]);
    if (Array.isArray(data.transactions)) {
      const txs = data.transactions as Transaction[];
      setTransactions(txs);
      if (txs.length > 0) setAdjOriginalTxId(txs[0].id);
    }
    if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs as AuditLog[]);
  }, []);

  const loadSupportSession = useCallback(async () => {
    setLoading(true);
    try {
      const sessionRes = await authFetch('/api/auth/session', { cache: 'no-store' });
      const sessionData = await sessionRes.json().catch(() => ({}));
      const sessionRole = sessionData?.user?.role as string | undefined;

      let meRes: Response | null = null;
      let meData: Record<string, unknown> = {};

      if (sessionRole === 'SUPPORT_AGENT' || sessionRole === 'PLATFORM_ADMIN') {
        meRes = await authFetch('/api/me');
        meData = await meRes.json().catch(() => ({}));
      }

      if (
        !meRes ||
        !meRes.ok ||
        (sessionRole !== 'SUPPORT_AGENT' && sessionRole !== 'PLATFORM_ADMIN')
      ) {
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            demoRole: 'SUPPORT_AGENT',
            demoQuickSignIn: true,
          }),
        });
        const loginData = await loginRes.json().catch(() => ({}));
        if (loginData?.accessToken) {
          setStoredAccessToken(loginData.accessToken);
        }
        meRes = await authFetch('/api/me', {
          headers: loginData?.accessToken
            ? { Authorization: `Bearer ${loginData.accessToken}` }
            : undefined,
        });
        meData = await meRes.json().catch(() => ({}));
      }

      if (meRes.ok) {
        applyMePayload(meData);
      }
    } finally {
      setLoading(false);
    }
  }, [applyMePayload]);

  useEffect(() => {
    loadSupportSession();
  }, [loadSupportSession]);

  const selectedTicket = useMemo(
    () => tickets.find((t) => t.id === selectedTicketId) || tickets[0] || null,
    [tickets, selectedTicketId]
  );

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (disputeCategoryFilter !== 'ALL' && t.disputeCategory !== disputeCategoryFilter) {
        return false;
      }
      return true;
    });
  }, [tickets, statusFilter, disputeCategoryFilter]);

  const handleUpdateTicketStatus = async (ticketId: string, status: TicketWorkflowStatus) => {
    const res = await authFetch('/api/tickets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_status', ticketId, status }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify(data.error || 'تعذر تحديث الحالة', 'err');
      return;
    }
    if (Array.isArray(data.tickets)) setTickets(data.tickets);
    if (data.auditLog) setAuditLogs((prev) => [data.auditLog, ...prev]);
    notify(`تم تحديث حالة التذكرة إلى «${status}»`);
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !noteInput.trim()) return;
    const res = await authFetch('/api/tickets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_note',
        ticketId: selectedTicket.id,
        text: noteInput.trim(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify(data.error || 'تعذر إضافة الملاحظة', 'err');
      return;
    }
    if (Array.isArray(data.tickets)) setTickets(data.tickets);
    if (data.auditLog) setAuditLogs((prev) => [data.auditLog, ...prev]);
    setNoteInput('');
    notify('تمت إضافة الملاحظة وتوثيقها في سجل التذكرة');
  };

  const handleEscalateTicket = async () => {
    if (!selectedTicket) return;
    const res = await authFetch('/api/tickets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'escalate',
        ticketId: selectedTicket.id,
        reason: escalateReason.trim() || 'يتطلب اعتماداً مالياً من المدير العام للمنصة',
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify(data.error || 'تعذر تصعيد التذكرة', 'err');
      return;
    }
    if (Array.isArray(data.tickets)) setTickets(data.tickets);
    if (data.auditLog) setAuditLogs((prev) => [data.auditLog, ...prev]);
    setEscalateReason('');
    notify('تم تحويل وتصعيد التذكرة إلى المدير العام للمنصة');
  };

  const handleRequestFinancialAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjReason.trim()) {
      notify('يرجى كتابة مبرر طلب التصحيح المالي للمدير العام', 'err');
      return;
    }
    const res = await authFetch('/api/tickets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'request_financial_adjustment',
        ticketId: selectedTicket?.id || 'tkt-501',
        originalTransactionId: adjOriginalTxId,
        requestedPointsDelta: Number(adjPointsDelta) || 0,
        requestedAmountSar: Number(adjAmountSar) || 0,
        reason: adjReason.trim(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify(data.error || 'تعذر إرسال طلب التصحيح', 'err');
      return;
    }
    if (Array.isArray(data.financialAdjustments)) {
      setFinancialAdjustments(data.financialAdjustments);
    }
    if (Array.isArray(data.tickets)) setTickets(data.tickets);
    if (data.auditLog) setAuditLogs((prev) => [data.auditLog, ...prev]);
    setAdjReason('');
    notify('تم رفع طلب التصحيح المالي للمدير العام؛ سينتج قيد عكسي فور الاعتماد');
  };

  const handleCreateCannedResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCannedTitle.trim() || !newCannedBody.trim()) return;
    const res = await authFetch('/api/tickets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_canned_response',
        title: newCannedTitle.trim(),
        category: newCannedCategory,
        body: newCannedBody.trim(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify(data.error || 'تعذر حفظ الرد الجاهز', 'err');
      return;
    }
    if (Array.isArray(data.cannedResponses)) setCannedResponses(data.cannedResponses);
    setNewCannedTitle('');
    setNewCannedBody('');
    notify('تمت إضافة الرد الجاهز إلى مكتبة الدعم');
  };

  const filteredLookupCustomers = useMemo(() => {
    const q = lookupQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
    );
  }, [customers, lookupQuery]);

  const filteredLookupStores = useMemo(() => {
    const q = lookupQuery.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.merchantId.toLowerCase().includes(q)
    );
  }, [stores, lookupQuery]);

  const menuItems: {
    id: SupportTab;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      id: 'tickets',
      label: `تذاكر الدعم والمتابعة (${tickets.length})`,
      description: 'متابعة التذاكر ومهلة الاستجابة',
      icon: TicketIcon,
    },
    {
      id: 'disputes',
      label: `النزاعات والتسويات (${financialAdjustments.length})`,
      description: 'رفع طلبات التصحيح المالي',
      icon: ShieldAlert,
    },
    {
      id: 'lookup',
      label: 'الاستعلام عن العملاء والمتاجر',
      description: 'بحث آمن مع إخفاء البيانات الحساسة',
      icon: Search,
    },
    {
      id: 'audit',
      label: `سجل العمليات والتدقيق (${auditLogs.length})`,
      description: 'متابعة الفواتير وسجل الرقابة',
      icon: Eye,
    },
    {
      id: 'canned',
      label: `مكتبة الردود الجاهزة (${cannedResponses.length})`,
      description: 'قوالب الردود السريعة للدعم',
      icon: MessageSquare,
    },
  ];

  if (loading) {
    return (
      <div
        dir="rtl"
        className={`min-h-screen bg-light-canvas text-[#0B1F3A] dark:text-white flex items-center justify-center p-6 ${isDark ? 'dark' : ''}`}
      >
        <div className="glass-card rounded-3xl px-8 py-6 flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#0284C7] dark:text-[#00C2FF] animate-spin" />
          <p className="text-sm font-black text-[#0B1F3A] dark:text-slate-200">
            جاري تحميل مركز خدمة العملاء والدعم الفني...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className={`min-h-screen bg-light-canvas text-[#0B1F3A] dark:text-slate-100 flex flex-col lg:flex-row ${isDark ? 'dark' : ''}`}
    >
      {/* Unified RTL Sidebar */}
      <aside className="w-full lg:w-72 glass-card border-l border-sky-100 dark:border-slate-800 p-5 flex flex-col justify-between shrink-0 lg:min-h-screen">
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-200/80 dark:border-slate-700/60">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/logo-color.png"
                alt="عادة باس | Aada Pass"
                className="h-9 w-auto object-contain dark:hidden shrink-0"
              />
              <img
                src="/logo-white.png"
                alt="عادة باس | Aada Pass"
                className="h-9 w-auto object-contain hidden dark:block shrink-0"
              />
              <div className="min-w-0">
                <h2 className="text-sm font-black text-[#0B1F3A] dark:text-white truncate">
                  عادة باس
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold truncate">
                  مركز الدعم الفني
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30 shrink-0">
              وكيل الدعم
            </span>
          </div>

          <nav className="space-y-1.5">
            {menuItems.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all text-right group cursor-pointer ${
                    active
                      ? 'bg-gradient-gold-cta text-[#0B1F3A] shadow-md shadow-amber-500/20 font-black'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-800/70 hover:text-[#0284C7] dark:hover:text-[#00C2FF]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        active
                          ? 'bg-[#0B1F3A]/10 text-[#0B1F3A]'
                          : 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-xs font-black truncate">{tab.label}</span>
                      <span
                        className={`block text-[10px] truncate ${
                          active ? 'text-[#0B1F3A]/75 font-bold' : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {tab.description}
                      </span>
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 shrink-0 transition-transform ${
                      active ? 'text-[#0B1F3A] rotate-180' : 'text-slate-400 dark:text-slate-600'
                    }`}
                  />
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-5 mt-6 border-t border-slate-200/80 dark:border-slate-700/60 space-y-2.5">
          <div className="bg-gradient-navy text-white p-4 rounded-2xl space-y-1.5 shadow-md">
            <img
              src="/logo-white.png"
              alt="Aada Pass"
              className="h-5 w-auto object-contain opacity-90"
            />
            <p className="text-[11px] font-black text-white truncate">
              {currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'فريق الدعم الفني'}
            </p>
            <p className="text-[10px] text-sky-200/80">قراءة محمية · قيود عكسية معتمدة</p>
          </div>

          <Link
            href="/admin"
            className="w-full py-2.5 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50 text-xs font-black flex items-center justify-center gap-1.5"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>لوحة الإدارة المركزية</span>
          </Link>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 glass-card border-b border-sky-100 dark:border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-electric text-white flex items-center justify-center shadow-md shadow-sky-500/20 shrink-0">
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base sm:text-lg font-black text-[#0B1F3A] dark:text-white">
                    مركز خدمة العملاء والدعم الفني
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-400/30">
                    صلاحية القراءة المحمية
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {currentUser
                    ? `الموظف النشط: ${currentUser.firstName} ${currentUser.lastName} · متابعة التذاكر وطلبات التسوية المالية`
                    : 'إدارة التذاكر والنزاعات والاستعلام عن العملاء والمتاجر'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsDark((prev) => !prev)}
                aria-label={isDark ? 'الوضع الفاتح' : 'الوضع الليلي'}
                className="bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-amber-300 border border-slate-200 dark:border-slate-700 p-2 rounded-xl transition-all cursor-pointer"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <Link
                href="/"
                className="px-4 py-2 rounded-xl bg-gradient-navy hover:opacity-95 text-white text-xs font-black"
              >
                الصفحة الرئيسية
              </Link>
            </div>
          </div>
        </header>

        {toast && (
          <div className="fixed bottom-5 left-5 z-50 max-w-md px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-2.5 bg-[#0B1F3A] border-[#00C2FF]/40 text-white">
            {toast.type === 'ok' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span className="text-xs font-bold">{toast.text}</span>
          </div>
        )}

        <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
          <div className="p-4 rounded-2xl glass-card border border-sky-200 dark:border-sky-500/30 bg-sky-50/70 dark:bg-sky-950/30 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Lock className="w-5 h-5 text-[#0284C7] dark:text-[#00C2FF] shrink-0" />
              <p className="text-xs font-bold text-[#0B1F3A] dark:text-slate-200">
                ضوابط صلاحية الدعم الفني: عرض شامل للبيانات مع إخفاء الحقول الحساسة تلقائياً، وتُرفع أي تسوية مالية لاعتماد المدير العام عبر قيد عكسي موثق.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-white/90 dark:bg-slate-900 text-[11px] font-black text-[#0284C7] dark:text-[#00C2FF] border border-sky-200 dark:border-slate-700">
              مراقبة سرعة الاستجابة مفعلة
            </span>
          </div>

          {activeTab === 'tickets' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 space-y-4">
                <div className="p-3.5 rounded-2xl glass-card flex flex-wrap gap-2">
                  {(['ALL', 'جديدة', 'قيد المعالجة', 'بانتظار العميل', 'محلولة'] as const).map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatusFilter(st)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          statusFilter === st
                            ? 'bg-gradient-gold-cta text-[#0B1F3A] font-black shadow-sm'
                            : 'bg-white/80 dark:bg-slate-900/70 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {st === 'ALL' ? 'كل الحالات' : st}
                      </button>
                    )
                  )}
                </div>

                <div className="space-y-3">
                  {filteredTickets.map((tkt) => {
                    const selected = selectedTicket?.id === tkt.id;
                    return (
                      <div
                        key={tkt.id}
                        onClick={() => setSelectedTicketId(tkt.id)}
                        className={`p-4 rounded-2xl border cursor-pointer transition ${
                          selected
                            ? 'glass-card border-[#0284C7] dark:border-[#00C2FF] shadow-lg shadow-sky-500/10'
                            : 'glass-card border-slate-200/80 dark:border-slate-800 hover:border-sky-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-xs font-mono text-[#0284C7] dark:text-[#00C2FF] font-black">
                            #{tkt.id}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {tkt.disputeCategory && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300">
                                نزاع {tkt.disputeCategory}
                              </span>
                            )}
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                                tkt.status === 'محلولة' || tkt.status === 'تم الحل'
                                  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                                  : tkt.status === 'بانتظار العميل'
                                  ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300'
                                  : 'bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300'
                              }`}
                            >
                              {tkt.status}
                            </span>
                          </div>
                        </div>
                        <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white mb-1">
                          {tkt.subject}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mb-2">
                          {tkt.message}
                        </p>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/80 dark:border-slate-700/60">
                          <span>
                            {tkt.userType}: {tkt.userName} ({tkt.customerPhoneMasked || '05****'})
                          </span>
                          <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300 font-bold">
                            <Clock className="w-3 h-3" />
                            مهلة الاستجابة: {tkt.slaHours || 4} ساعات
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-7">
                {selectedTicket ? (
                  <div className="p-6 rounded-3xl glass-card space-y-6">
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/80 dark:border-slate-700/70 pb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-mono text-[#0284C7] dark:text-[#00C2FF] font-black">
                            #{selectedTicket.id}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            · المتجر: {selectedTicket.storeName || 'عام'}
                          </span>
                          {selectedTicket.invoiceRef && (
                            <span className="px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-slate-800 text-amber-800 dark:text-amber-300 text-[11px] font-mono font-bold">
                              فاتورة: {selectedTicket.invoiceRef}
                            </span>
                          )}
                        </div>
                        <h2 className="text-lg font-black text-[#0B1F3A] dark:text-white">
                          {selectedTicket.subject}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          المرسل: {selectedTicket.userName} ({selectedTicket.userType}) · رقم الهاتف المحمي:{' '}
                          <span className="font-mono text-[#0B1F3A] dark:text-slate-200 font-bold">
                            {selectedTicket.customerPhoneMasked || '05****88'}
                          </span>
                        </p>
                      </div>

                      <div className="p-3 rounded-2xl bg-amber-50/90 dark:bg-slate-900/90 border border-amber-200 dark:border-slate-700 text-left">
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                          الموعد المستهدف للرد
                        </div>
                        <div className="text-xs font-black text-amber-800 dark:text-[#FBBF24]">
                          {selectedTicket.slaDeadlineAt || 'خلال 4 ساعات'}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                      {selectedTicket.message}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-black text-slate-600 dark:text-slate-300">
                        تحديث حالة التذكرة:
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {(['جديدة', 'قيد المعالجة', 'بانتظار العميل', 'محلولة'] as const).map(
                          (st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => handleUpdateTicketStatus(selectedTicket.id, st)}
                              className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                                selectedTicket.status === st
                                  ? 'bg-gradient-electric text-white shadow-sm'
                                  : 'bg-white/80 dark:bg-slate-900/70 hover:bg-sky-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {st}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {cannedResponses.length > 0 && (
                      <div className="space-y-2">
                        <label className="block text-xs font-black text-slate-600 dark:text-slate-300">
                          إدراج رد جاهز سريع:
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {cannedResponses.map((cr) => (
                            <button
                              key={cr.id}
                              type="button"
                              onClick={() => setNoteInput(cr.body)}
                              className="px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-slate-900 hover:bg-sky-100 dark:hover:bg-slate-800 border border-sky-200 dark:border-slate-700 text-[11px] font-bold text-[#0284C7] dark:text-[#00C2FF] cursor-pointer"
                            >
                              + {cr.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-[#0B1F3A] dark:text-white">
                        سجل الملاحظات والتحويلات ({selectedTicket.notes?.length || 0})
                      </h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {(selectedTicket.notes || []).map((n) => (
                          <div
                            key={n.id}
                            className="p-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-xs"
                          >
                            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                              <span className="font-bold text-[#0284C7] dark:text-[#00C2FF]">
                                {n.authorName} ({n.authorRole})
                              </span>
                              <span>{n.createdAt}</span>
                            </div>
                            <p className="text-slate-700 dark:text-slate-200">{n.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <form onSubmit={handleAddNote} className="space-y-3">
                      <textarea
                        rows={3}
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        placeholder="اكتب ملاحظة معالجة أو رداً للعميل / التاجر..."
                        className="w-full p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white focus:outline-none focus:border-[#0284C7]"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <button
                          type="submit"
                          className="px-4 py-2.5 rounded-xl bg-gradient-electric hover:opacity-95 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          حفظ الملاحظة على التذكرة
                        </button>

                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={escalateReason}
                            onChange={(e) => setEscalateReason(e.target.value)}
                            placeholder="سبب التحويل للمدير العام..."
                            className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={handleEscalateTicket}
                            className="px-3.5 py-2 rounded-xl bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] text-xs font-black flex items-center gap-1.5 cursor-pointer"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                            تصعيد للمدير العام
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="p-8 rounded-3xl glass-card text-center text-xs text-slate-500 dark:text-slate-400">
                    اختر تذكرة من القائمة لعرض التفاصيل وإضافة الملاحظات
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'disputes' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5">
                <form
                  onSubmit={handleRequestFinancialAdjustment}
                  className="p-6 rounded-3xl glass-card space-y-4"
                >
                  <div className="flex items-center gap-2 text-amber-600 dark:text-[#FBBF24]">
                    <ShieldAlert className="w-5 h-5" />
                    <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white">
                      رفع طلب تصحيح مالي للمدير العام
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    لضمان الشفافية المالية، لا يتم تعديل رصيد النقاط أو الفواتير مباشرة من الدعم؛ ارفع الطلب هنا ليراجعه المدير العام ويُنشئ قيداً عكسياً موثقاً.
                  </p>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      اختر العملية الأصلية محل النزاع
                    </label>
                    <select
                      value={adjOriginalTxId}
                      onChange={(e) => setAdjOriginalTxId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
                    >
                      {transactions.map((tx) => (
                        <option key={tx.id} value={tx.id}>
                          #{tx.invoiceNumber} — {tx.storeName} ({tx.customerName}) · {tx.amount}{' '}
                          {tx.currency}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                        فرق النقاط المطلوب (+ / -)
                      </label>
                      <input
                        type="number"
                        value={adjPointsDelta}
                        onChange={(e) => setAdjPointsDelta(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                        القيمة المرجعية (ر.س)
                      </label>
                      <input
                        type="number"
                        value={adjAmountSar}
                        onChange={(e) => setAdjAmountSar(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      سبب التصحيح المالي ورقم التذكرة أو الفاتورة
                    </label>
                    <textarea
                      rows={3}
                      value={adjReason}
                      onChange={(e) => setAdjReason(e.target.value)}
                      placeholder="مثال: العميل أبرز إيصال الدفع ورقم الفاتورة INV-908 ولم تُحتسب النقاط..."
                      className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] text-xs font-black shadow-md shadow-amber-500/20 cursor-pointer"
                  >
                    إرسال طلب التصحيح المالي للمدير العام
                  </button>
                </form>
              </div>

              <div className="lg:col-span-7 space-y-4">
                <div className="p-4 rounded-2xl glass-card flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-black text-[#0B1F3A] dark:text-white">
                    تصفية النزاعات حسب الفئة:
                  </span>
                  <div className="flex gap-2 flex-wrap">
                    {(['ALL', 'نقاط', 'فواتير', 'مكافآت'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setDisputeCategoryFilter(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                          disputeCategoryFilter === cat
                            ? 'bg-gradient-electric text-white font-black'
                            : 'bg-white/80 dark:bg-slate-900/70 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {cat === 'ALL' ? 'الكل' : `نزاعات ${cat}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-5 rounded-3xl glass-card space-y-3">
                  <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white">
                    سجل طلبات التصحيح المالي والقيود العكسية ({financialAdjustments.length})
                  </h3>
                  {financialAdjustments.map((adj) => (
                    <div
                      key={adj.id}
                      className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-[#0B1F3A] dark:text-white">
                            #{adj.id}
                          </span>
                          <span className="text-xs text-[#0284C7] dark:text-[#00C2FF] font-bold">
                            {adj.storeName}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            · العميل: {adj.customerName}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          العملية: <span className="font-mono">{adj.originalTransactionId}</span> · فرق النقاط:{' '}
                          <strong className="text-amber-700 dark:text-[#FBBF24]">
                            {adj.requestedPointsDelta > 0
                              ? `+${adj.requestedPointsDelta}`
                              : adj.requestedPointsDelta}{' '}
                            نقطة
                          </strong>
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{adj.reason}</p>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full text-[11px] font-black ${
                          adj.status === 'approved'
                            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                            : adj.status === 'rejected'
                            ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300'
                            : 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {adj.status === 'approved'
                          ? `معتمد · قيد عكسي (${adj.reversalTransactionId || 'موثق'})`
                          : adj.status === 'rejected'
                          ? 'مرفوض'
                          : 'بانتظار اعتماد المدير العام'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'lookup' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl glass-card flex items-center gap-3">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={lookupQuery}
                  onChange={(e) => setLookupQuery(e.target.value)}
                  placeholder="ابحث باسم العميل، اسم المتجر، المدينة، أو معرف المتجر..."
                  className="w-full bg-transparent text-xs text-[#0B1F3A] dark:text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-5 rounded-3xl glass-card space-y-3">
                  <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#0284C7] dark:text-[#00C2FF]" />
                    بيانات العملاء (البيانات الحساسة محمية تلقائياً)
                  </h3>
                  {filteredLookupCustomers.map((c) => (
                    <div
                      key={c.id}
                      className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-black text-[#0B1F3A] dark:text-white">
                          {c.firstName} {c.lastName} (@{c.username})
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          هاتف: {c.phone} · بريد: {c.email}
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-black text-amber-700 dark:text-[#FBBF24]">
                          {c.totalPointsAcrossAllStores} نقطة
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {c.cards.length} بطاقات ولاء
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-5 rounded-3xl glass-card space-y-3">
                  <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white flex items-center gap-2">
                    <StoreIcon className="w-4 h-4 text-amber-600 dark:text-[#FBBF24]" />
                    بيانات المتاجر (السجل التجاري والهاتف محميان)
                  </h3>
                  {filteredLookupStores.map((s) => (
                    <div
                      key={s.id}
                      className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-black text-[#0B1F3A] dark:text-white">
                          {s.name} ({s.city})
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          هاتف: {s.phone} · سجل تجاري: {s.commercialReg || '****'}
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-black">
                        {s.subscriptionPlan === 'Viewer'
                          ? 'التواجد الرقمي'
                          : s.subscriptionPlan === 'Starter'
                          ? 'الانطلاق'
                          : 'النمو'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-6">
              <div className="p-5 rounded-3xl glass-card space-y-4">
                <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white">
                  سجل العمليات المالية والفواتير (عرض للتحقق)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                        <th className="py-3 px-3">رقم الفاتورة</th>
                        <th className="py-3 px-3">المتجر</th>
                        <th className="py-3 px-3">العميل</th>
                        <th className="py-3 px-3">المبلغ</th>
                        <th className="py-3 px-3">النقاط</th>
                        <th className="py-3 px-3">النوع</th>
                        <th className="py-3 px-3">التوقيت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-sky-50/50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-mono text-[#0284C7] dark:text-[#00C2FF] font-bold">
                            {tx.invoiceNumber}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-[#0B1F3A] dark:text-white">
                            {tx.storeName}
                          </td>
                          <td className="py-2.5 px-3">{tx.customerName}</td>
                          <td className="py-2.5 px-3">
                            {tx.amount} {tx.currency}
                          </td>
                          <td className="py-2.5 px-3 font-black text-amber-700 dark:text-[#FBBF24]">
                            {tx.pointsEarned > 0 ? `+${tx.pointsEarned}` : tx.pointsEarned}
                          </td>
                          <td className="py-2.5 px-3">{tx.type}</td>
                          <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                            {tx.timestamp}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-5 rounded-3xl glass-card space-y-4">
                <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white">
                  سجل الرقابة والتدقيق (عرض فقط)
                </h3>
                <div className="space-y-2">
                  {auditLogs.slice(0, 15).map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between text-xs gap-2"
                    >
                      <div>
                        <span className="font-bold text-[#0B1F3A] dark:text-white">{log.user}</span>{' '}
                        <span className="text-slate-500 dark:text-slate-400">({log.actorRole})</span> —{' '}
                        <span className="text-[#0284C7] dark:text-[#00C2FF] font-bold">{log.action}</span> على{' '}
                        <span className="font-mono text-amber-700 dark:text-[#FBBF24]">{log.target}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {log.timestamp}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'canned' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5">
                <form
                  onSubmit={handleCreateCannedResponse}
                  className="p-6 rounded-3xl glass-card space-y-4"
                >
                  <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white flex items-center gap-2">
                    <Plus className="w-4 h-4 text-[#0284C7] dark:text-[#00C2FF]" />
                    إضافة قالب رد جاهز جديد
                  </h3>
                  <input
                    type="text"
                    value={newCannedTitle}
                    onChange={(e) => setNewCannedTitle(e.target.value)}
                    placeholder="عنوان القالب (مثال: تأكيد رفع تسوية مالية)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
                  />
                  <select
                    value={newCannedCategory}
                    onChange={(e) => setNewCannedCategory(e.target.value as DisputeCategory | 'عام')}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
                  >
                    <option value="نقاط">نقاط</option>
                    <option value="فواتير">فواتير</option>
                    <option value="مكافآت">مكافآت</option>
                    <option value="عام">عام</option>
                  </select>
                  <textarea
                    rows={4}
                    value={newCannedBody}
                    onChange={(e) => setNewCannedBody(e.target.value)}
                    placeholder="نص الرد الجاهز..."
                    className="w-full p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
                  />
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-gradient-electric hover:opacity-95 text-white text-xs font-black cursor-pointer"
                  >
                    حفظ في مكتبة الردود الجاهزة
                  </button>
                </form>
              </div>

              <div className="lg:col-span-7 space-y-3">
                {cannedResponses.map((cr) => (
                  <div
                    key={cr.id}
                    className="p-4 rounded-2xl glass-card space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-black text-[#0B1F3A] dark:text-white">
                          {cr.title}
                        </h4>
                        <span className="px-2.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-500/20 text-[#0284C7] dark:text-[#00C2FF] text-[10px] font-black">
                          {cr.category}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(cr.body);
                          notify('تم نسخ الرد الجاهز');
                        }}
                        className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[#0B1F3A] dark:text-slate-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        نسخ
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {cr.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
