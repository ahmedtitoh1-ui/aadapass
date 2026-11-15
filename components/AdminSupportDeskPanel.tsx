'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Headphones,
  MessageSquarePlus,
  Plus,
  RotateCcw,
  Send,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { authFetch } from '@/lib/clientAuth';
import type {
  AuditLog,
  CannedResponse,
  DisputeCategory,
  FinancialAdjustmentRequest,
  SupportTicket,
  TicketWorkflowStatus,
  Transaction,
} from '@/lib/types';

interface AdminSupportDeskPanelProps {
  tickets: SupportTicket[];
  setTickets: React.Dispatch<React.SetStateAction<SupportTicket[]>>;
  cannedResponses: CannedResponse[];
  setCannedResponses: React.Dispatch<React.SetStateAction<CannedResponse[]>>;
  financialAdjustments: FinancialAdjustmentRequest[];
  setFinancialAdjustments: React.Dispatch<React.SetStateAction<FinancialAdjustmentRequest[]>>;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  onAuditLog?: (log: AuditLog) => void;
  notify: (text: string, type?: 'ok' | 'err') => void;
}

export default function AdminSupportDeskPanel({
  tickets,
  setTickets,
  cannedResponses,
  setCannedResponses,
  financialAdjustments,
  setFinancialAdjustments,
  setTransactions,
  onAuditLog,
  notify,
}: AdminSupportDeskPanelProps) {
  const [subTab, setSubTab] = useState<'tickets' | 'reversals' | 'canned'>('tickets');
  const [statusFilter, setStatusFilter] = useState<'ALL' | string>('ALL');
  const [selectedTicketId, setSelectedTicketId] = useState<string>(tickets[0]?.id || '');
  const [noteInput, setNoteInput] = useState('');
  const [adjPoints, setAdjPoints] = useState('25');
  const [adjReason, setAdjReason] = useState('');

  const [newCanTitle, setNewCanTitle] = useState('');
  const [newCanCat, setNewCanCat] = useState<DisputeCategory | 'عام'>('نقاط');
  const [newCanBody, setNewCanBody] = useState('');

  const filteredTickets = useMemo(() => {
    if (statusFilter === 'ALL') return tickets;
    return tickets.filter((t) => t.status === statusFilter);
  }, [tickets, statusFilter]);

  const selectedTicket = useMemo(
    () => tickets.find((t) => t.id === selectedTicketId) || filteredTickets[0] || null,
    [tickets, selectedTicketId, filteredTickets]
  );

  const pendingReversals = financialAdjustments.filter((a) => a.status === 'pending_admin').length;

  const callTicketsPatch = async (payload: Record<string, unknown>, okMsg: string) => {
    const res = await authFetch('/api/tickets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify(data.error || 'تعذر تنفيذ إجراء الدعم', 'err');
      return;
    }
    if (Array.isArray(data.tickets)) setTickets(data.tickets);
    if (Array.isArray(data.financialAdjustments)) setFinancialAdjustments(data.financialAdjustments);
    if (Array.isArray(data.transactions)) setTransactions(data.transactions);
    if (Array.isArray(data.cannedResponses)) setCannedResponses(data.cannedResponses);
    if (data.auditLog && onAuditLog) onAuditLog(data.auditLog);
    notify(okMsg);
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !noteInput.trim()) return;
    await callTicketsPatch(
      {
        action: 'add_note',
        ticketId: selectedTicket.id,
        text: noteInput.trim(),
      },
      'تمت إضافة الرد/الملاحظة على التذكرة'
    );
    setNoteInput('');
  };

  const handleStatusChange = async (ticketId: string, status: TicketWorkflowStatus) => {
    await callTicketsPatch(
      {
        action: 'update_status',
        ticketId,
        status,
      },
      `تم تحديث حالة التذكرة إلى: ${status}`
    );
  };

  const handleCreateAdjustment = async () => {
    if (!selectedTicket || !adjReason.trim()) {
      notify('يرجى كتابة سبب طلب التسوية المالية', 'err');
      return;
    }
    await callTicketsPatch(
      {
        action: 'request_financial_adjustment',
        ticketId: selectedTicket.id,
        originalTransactionId: selectedTicket.relatedTransactionId || 'tx-1001',
        requestedPointsDelta: Number(adjPoints) || 0,
        requestedAmountSar: 0,
        reason: adjReason.trim(),
      },
      'تم إنشاء طلب تصحيح مالي وربطه بالتذكرة (يمكنك اعتماده من تبويب التسويات العكسية)'
    );
    setAdjReason('');
  };

  const handleReviewAdjustment = async (adjustmentId: string, decision: 'approved' | 'rejected') => {
    await callTicketsPatch(
      {
        action: 'review_financial_adjustment',
        adjustmentId,
        decision,
      },
      decision === 'approved'
        ? 'تم اعتماد التسوية المالية وإنشاء قيد عكسي رسمي في دفتر الأستاذ'
        : 'تم رفض طلب التصحيح المالي'
    );
  };

  const handleAddCanned = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCanTitle.trim() || !newCanBody.trim()) return;
    await callTicketsPatch(
      {
        action: 'add_canned_response',
        title: newCanTitle.trim(),
        category: newCanCat,
        body: newCanBody.trim(),
      },
      'تم حفظ الرد الجاهز الجديد'
    );
    setNewCanTitle('');
    setNewCanBody('');
  };

  return (
    <div className="space-y-6">
      {/* Unified Support + Admin Header */}
      <div className="p-5 sm:p-6 rounded-3xl glass-card flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100 dark:bg-sky-500/20 text-[#0284C7] dark:text-[#00C2FF] text-xs font-black">
            <Headphones className="w-3.5 h-3.5" />
            <span>مركز الدعم الموحد والتسويات العكسية</span>
          </div>
          <h2 className="text-xl font-black text-[#0B1F3A] dark:text-white">
            إدارة تذاكر العملاء والمتاجر واعتماد التسويات المالية في مكان واحد
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('tickets')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              subTab === 'tickets'
                ? 'bg-gradient-gold-cta text-[#0B1F3A]'
                : 'bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            التذاكر والنزاعات ({tickets.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('reversals')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              subTab === 'reversals'
                ? 'bg-gradient-gold-cta text-[#0B1F3A]'
                : 'bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            القيود العكسية ({pendingReversals} معلق)
          </button>
          <button
            type="button"
            onClick={() => setSubTab('canned')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              subTab === 'canned'
                ? 'bg-gradient-gold-cta text-[#0B1F3A]'
                : 'bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            الردود الجاهزة ({cannedResponses.length})
          </button>
        </div>
      </div>

      {subTab === 'tickets' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Tickets List */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {['ALL', 'جديدة', 'قيد المعالجة', 'محلولة'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer ${
                    statusFilter === st
                      ? 'bg-[#0B1F3A] text-[#FBBF24]'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {st === 'ALL' ? 'الكل' : st}
                </button>
              ))}
            </div>

            <div className="space-y-2.5">
              {filteredTickets.map((t) => {
                const isSelected = selectedTicket?.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTicketId(t.id)}
                    className={`w-full p-4 rounded-2xl text-right border transition cursor-pointer space-y-1.5 ${
                      isSelected
                        ? 'bg-[#0B1F3A] text-white border-[#FBBF24] shadow-md'
                        : 'glass-card text-[#0B1F3A] dark:text-white hover:border-sky-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-black text-[#00C2FF]">
                        {t.userType} · {t.storeName || 'عام'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          t.status === 'محلولة' || t.status === 'تم الحل'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/20 text-[#FBBF24]'
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>
                    <div className="text-xs font-black line-clamp-1">{t.subject}</div>
                    <div
                      className={`text-[11px] flex items-center justify-between ${
                        isSelected ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <span>{t.userName}</span>
                      <span className="font-mono">{t.createdAt}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ticket Detail & Actions */}
          <div className="lg:col-span-7 space-y-4">
            {selectedTicket ? (
              <div className="p-6 rounded-3xl glass-card space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-200/80 dark:border-slate-700/70">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-[#0284C7] dark:text-[#00C2FF] font-bold">
                        #{selectedTicket.id}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 text-[10px] font-black">
                        {selectedTicket.disputeCategory || 'دعم'}
                      </span>
                    </div>
                    <h3 className="text-base font-black text-[#0B1F3A] dark:text-white">
                      {selectedTicket.subject}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      مقدم الطلب: {selectedTicket.userName} ({selectedTicket.userType}) · المتجر:{' '}
                      {selectedTicket.storeName || 'عام'}
                    </p>
                  </div>

                  <select
                    value={selectedTicket.status}
                    onChange={(e) =>
                      handleStatusChange(selectedTicket.id, e.target.value as TicketWorkflowStatus)
                    }
                    className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-black text-[#0B1F3A] dark:text-white"
                  >
                    <option value="جديدة">جديدة</option>
                    <option value="قيد المعالجة">قيد المعالجة</option>
                    <option value="بانتظار العميل">بانتظار العميل</option>
                    <option value="محلولة">محلولة</option>
                  </select>
                </div>

                <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-slate-900/70 border border-sky-100 dark:border-slate-800 text-xs text-[#0B1F3A] dark:text-slate-200 leading-relaxed">
                  {selectedTicket.message}
                </div>

                {/* Quick Canned Responses Insert */}
                {cannedResponses.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      إدراج رد جاهز سريع:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {cannedResponses.map((cr) => (
                        <button
                          key={cr.id}
                          type="button"
                          onClick={() => setNoteInput(cr.body)}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-sky-50 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-[#0284C7] dark:text-[#00C2FF] cursor-pointer"
                        >
                          + {cr.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes Thread */}
                <div className="space-y-2.5">
                  <div className="text-xs font-black text-[#0B1F3A] dark:text-white">
                    سجل المتابعة والملاحظات ({selectedTicket.notes?.length || 0})
                  </div>
                  {(selectedTicket.notes || []).map((n) => (
                    <div
                      key={n.id}
                      className="p-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-black text-[#0284C7] dark:text-[#00C2FF]">
                          {n.authorName}
                        </span>
                        <span className="font-mono text-slate-400">{n.createdAt}</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-200">{n.text}</p>
                    </div>
                  ))}
                </div>

                {/* Add Note Form */}
                <form onSubmit={handleAddNote} className="flex gap-2">
                  <input
                    type="text"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="اكتب رداً للعميل أو ملاحظة داخلية..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-[#0B1F3A] hover:bg-[#10325E] text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 text-[#FBBF24]" />
                    <span>إرسال</span>
                  </button>
                </form>

                {/* Request Financial Adjustment directly from Ticket */}
                <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/30 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-900 dark:text-amber-300">
                    <ShieldAlert className="w-4 h-4" />
                    <span>إنشاء تسوية نقاط / قيد عكسي لهذه التذكرة</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="number"
                      value={adjPoints}
                      onChange={(e) => setAdjPoints(e.target.value)}
                      placeholder="عدد النقاط (+/-)"
                      className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
                    />
                    <input
                      type="text"
                      value={adjReason}
                      onChange={(e) => setAdjReason(e.target.value)}
                      placeholder="سبب التسوية المالية..."
                      className="sm:col-span-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateAdjustment}
                    className="px-4 py-2 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] text-xs font-black cursor-pointer"
                  >
                    تسجيل طلب القيد العكسي
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-3xl glass-card text-center text-xs text-slate-500">
                اختر تذكرة لعرض تفاصيلها ومعالجتها.
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'reversals' && (
        <div className="p-6 rounded-3xl glass-card space-y-4">
          <div>
            <h3 className="text-base font-black text-[#0B1F3A] dark:text-white flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-rose-500" />
              اعتماد التسويات والقيود المالية العكسية
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              عند اعتماد الطلب يتم تعديل رصيد العميل وإصدار قيد عكسي رسمي في دفتر الأستاذ وسجل التدقيق.
            </p>
          </div>

          <div className="space-y-3">
            {financialAdjustments.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500">
                لا توجد طلبات تصحيح مالي حالياً.
              </div>
            ) : (
              financialAdjustments.map((adj) => (
                <div
                  key={adj.id}
                  className="p-4 rounded-2xl bg-white/85 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-[#0B1F3A] dark:text-white">
                        طلب #{adj.id} · تذكرة #{adj.ticketId}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-slate-800 text-amber-900 dark:text-amber-300 text-[11px] font-bold">
                        {adj.storeName}
                      </span>
                      <span className="text-xs font-bold text-[#0284C7] dark:text-[#00C2FF]">
                        العميل: {adj.customerName}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      العملية الأصلية: <span className="font-mono">{adj.originalTransactionId}</span> · فرق النقاط:{' '}
                      <strong
                        className={
                          adj.requestedPointsDelta >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }
                      >
                        {adj.requestedPointsDelta > 0
                          ? `+${adj.requestedPointsDelta}`
                          : adj.requestedPointsDelta}{' '}
                        نقطة
                      </strong>
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      السبب: {adj.reason}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {adj.status === 'pending_admin' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleReviewAdjustment(adj.id, 'approved')}
                          className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          اعتماد القيد العكسي
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReviewAdjustment(adj.id, 'rejected')}
                          className="px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" />
                          رفض
                        </button>
                      </>
                    ) : (
                      <span
                        className={`px-3 py-1.5 rounded-full text-xs font-black inline-flex items-center gap-1 ${
                          adj.status === 'approved'
                            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                            : 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300'
                        }`}
                      >
                        {adj.status === 'approved' ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        )}
                        {adj.status === 'approved'
                          ? `معتمد (${adj.reversalTransactionId || 'قيد عكسي'})`
                          : 'مرفوض'}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {subTab === 'canned' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-3">
            {cannedResponses.map((cr) => (
              <div key={cr.id} className="p-4 rounded-2xl glass-card space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-[#0B1F3A] dark:text-white">{cr.title}</h4>
                  <span className="px-2.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-500/20 text-[#0284C7] dark:text-[#00C2FF] text-[10px] font-black">
                    {cr.category}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{cr.body}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddCanned} className="lg:col-span-5 p-5 rounded-3xl glass-card space-y-3.5">
            <h4 className="text-sm font-black text-[#0B1F3A] dark:text-white flex items-center gap-1.5">
              <MessageSquarePlus className="w-4 h-4 text-[#0284C7]" />
              إضافة رد جاهز جديد لفريق الدعم
            </h4>
            <input
              type="text"
              required
              value={newCanTitle}
              onChange={(e) => setNewCanTitle(e.target.value)}
              placeholder="عنوان الرد الجاهز"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
            />
            <select
              value={newCanCat}
              onChange={(e) => setNewCanCat(e.target.value as DisputeCategory | 'عام')}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#0B1F3A] dark:text-white"
            >
              <option value="نقاط">نقاط</option>
              <option value="فواتير">فواتير</option>
              <option value="مكافآت">مكافآت</option>
              <option value="عام">عام</option>
            </select>
            <textarea
              rows={4}
              required
              value={newCanBody}
              onChange={(e) => setNewCanBody(e.target.value)}
              placeholder="نص الرسالة الجاهزة..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
            />
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] text-xs font-black inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>حفظ الرد الجاهز</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
