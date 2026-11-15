'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Layers,
  Lock,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Save,
  Server,
  ShieldAlert,
  Store as StoreIcon,
  Trash2,
  Unlock,
  User,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import { authFetch } from '@/lib/clientAuth';
import type { AuditLog, EnvironmentType, PlatformEnvironment, Store } from '@/lib/types';

interface AdminEnvironmentsPanelProps {
  environments: PlatformEnvironment[];
  setEnvironments: React.Dispatch<React.SetStateAction<PlatformEnvironment[]>>;
  onStoreCreated?: (store: Store) => void;
  onAuditLog?: (log: AuditLog) => void;
  notify: (text: string, type?: 'ok' | 'err') => void;
}

interface CreatedCredentialsBanner {
  envName: string;
  slug: string;
  storeName: string;
  storeCategory: string;
  username: string;
  password: string;
  subscriptionAmount: number;
  currencyLabel: string;
  expiresAt: string;
  loginUrl: string;
}

const STORE_CATEGORIES = [
  { value: 'كافيه', label: 'كافيه ومقهى مختص' },
  { value: 'مطعم', label: 'مطعم ومأكولات' },
  { value: 'حلويات ومخبوزات', label: 'حلويات ومخبوزات' },
  { value: 'صالون', label: 'صالون وتجميل وعناية' },
  { value: 'متجر', label: 'متجر تجزئة' },
  { value: 'عيادة', label: 'عيادة ومركز طبي' },
  { value: 'أخرى', label: 'نشاط آخر' },
];

const ENV_TYPE_LABELS: Record<EnvironmentType, { label: string; cls: string }> = {
  production: {
    label: 'إنتاج فعلي (Production)',
    cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
  },
  staging: {
    label: 'اختبار ما قبل الإطلاق (Staging)',
    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
  },
  sandbox: {
    label: 'محاكاة تجريبية (Sandbox)',
    cls: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300 border-sky-200 dark:border-sky-500/30',
  },
  development: {
    label: 'بيئة تطوير (Dev)',
    cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  },
};

function buildFallbackLoginUrl(env: PlatformEnvironment): string {
  if (env.loginUrl) return env.loginUrl;
  const base = `/?login=merchant&env=${encodeURIComponent(env.slug)}`;
  return env.username ? `${base}&user=${encodeURIComponent(env.username)}` : base;
}

function currencyUnitLabel(scope: 'ALL' | 'EGP' | 'SAR'): string {
  return scope === 'EGP' ? 'ج.م' : 'ر.س';
}

export default function AdminEnvironmentsPanel({
  environments,
  setEnvironments,
  onStoreCreated,
  onAuditLog,
  notify,
}: AdminEnvironmentsPanelProps) {
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [todayIso, setTodayIso] = useState<string>('');

  // Create form state
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newType, setNewType] = useState<EnvironmentType>('sandbox');
  const [newStoreCategory, setNewStoreCategory] = useState('كافيه');
  const [newStoreName, setNewStoreName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newAmount, setNewAmount] = useState('299');
  const [newExpiresAt, setNewExpiresAt] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCurrencyScope, setNewCurrencyScope] = useState<'ALL' | 'EGP' | 'SAR'>('ALL');
  const [newIsActive, setNewIsActive] = useState(true);

  // Ready-to-use credentials banner shown right after environment creation
  const [createdBanner, setCreatedBanner] = useState<CreatedCredentialsBanner | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Inline card edit state
  const [editingEnvId, setEditingEnvId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState('كافيه');
  const [editAmount, setEditAmount] = useState('0');
  const [editExpiresAt, setEditExpiresAt] = useState('');
  const [editNewPassword, setEditNewPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);

  useEffect(() => {
    const now = new Date();
    setTodayIso(now.toISOString().slice(0, 10));
    const oneYearLater = new Date(now.getTime() + 365 * 86_400_000).toISOString().slice(0, 10);
    setNewExpiresAt((prev) => prev || oneYearLater);
  }, []);

  const handleCopy = async (key: string, text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      notify(successMessage);
      setTimeout(() => {
        setCopiedKey((curr) => (curr === key ? null : curr));
      }, 2200);
    } catch {
      notify('تعذر النسخ التلقائي، يرجى النسخ يدوياً', 'err');
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#';
    let pass = 'Ap@';
    for (let i = 0; i < 7; i += 1) {
      pass += chars[Math.floor(Math.random() * chars.length)];
    }
    setNewPassword(pass);
    setShowNewPassword(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      notify('يرجى إدخال اسم البيئة', 'err');
      return;
    }
    if (newUsername.trim().length < 3) {
      notify('اسم المستخدم مطلوب ويجب أن يكون 3 أحرف إنجليزية على الأقل', 'err');
      return;
    }
    if (newPassword.length < 6) {
      notify('كلمة المرور مطلوبة ويجب أن تكون 6 أحرف على الأقل', 'err');
      return;
    }
    if (!newExpiresAt) {
      notify('يرجى تحديد تاريخ انتهاء صلاحية البيئة', 'err');
      return;
    }

    const parsedAmount = Number(newAmount || 0);
    if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
      notify('يرجى إدخال مبلغ صحيح (0 أو أكثر)', 'err');
      return;
    }

    setCreating(true);
    try {
      const enteredPassword = newPassword;
      const enteredUsername = newUsername.trim();
      const enteredStoreCategory = newStoreCategory;
      const enteredStoreName = newStoreName.trim() || newName.trim();

      const res = await authFetch('/api/admin/environments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          slug: newSlug.trim(),
          type: newType,
          storeCategory: enteredStoreCategory,
          storeName: enteredStoreName,
          username: enteredUsername,
          password: enteredPassword,
          subscriptionAmount: parsedAmount,
          expiresAt: newExpiresAt,
          domainUrl: newDomain.trim() || undefined,
          description: newDesc.trim() || undefined,
          currencyScope: newCurrencyScope,
          isActive: newIsActive,
          maintenanceMode: !newIsActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || 'تعذر إنشاء البيئة الجديدة', 'err');
        return;
      }
      if (Array.isArray(data.environments)) setEnvironments(data.environments);
      if (data.store && onStoreCreated) onStoreCreated(data.store);
      if (data.auditLog && onAuditLog) onAuditLog(data.auditLog);

      const createdEnv = data.environment as PlatformEnvironment | undefined;
      if (createdEnv) {
        setCreatedBanner({
          envName: createdEnv.name,
          slug: createdEnv.slug,
          storeName: createdEnv.storeName || enteredStoreName,
          storeCategory: createdEnv.storeCategory || enteredStoreCategory,
          username: createdEnv.username || enteredUsername,
          password: enteredPassword,
          subscriptionAmount: createdEnv.subscriptionAmount ?? parsedAmount,
          currencyLabel: currencyUnitLabel(createdEnv.currencyScope),
          expiresAt: createdEnv.expiresAt || newExpiresAt,
          loginUrl: data.loginUrl || buildFallbackLoginUrl(createdEnv),
        });
      }

      setNewName('');
      setNewSlug('');
      setNewStoreName('');
      setNewUsername('');
      setNewPassword('');
      setShowNewPassword(false);
      setNewDomain('');
      setNewDesc('');
      notify('تم إنشاء البيئة وتجهيز حساب الدخول بنجاح');
    } finally {
      setCreating(false);
    }
  };

  const handlePatch = async (
    id: string,
    patch: Partial<PlatformEnvironment> & { newPassword?: string },
    msg: string
  ) => {
    setBusyId(id);
    try {
      const res = await authFetch('/api/admin/environments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || 'تعذر تحديث البيئة', 'err');
        return false;
      }
      if (Array.isArray(data.environments)) setEnvironments(data.environments);
      if (data.auditLog && onAuditLog) onAuditLog(data.auditLog);
      notify(msg);
      return true;
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveInlineEdit = async (env: PlatformEnvironment) => {
    if (editNewPassword && editNewPassword.length < 6) {
      notify('كلمة المرور الجديدة يجب أن تتكون من 6 أحرف على الأقل', 'err');
      return;
    }
    const amt = Number(editAmount || 0);
    if (Number.isNaN(amt) || amt < 0) {
      notify('قيمة المبلغ غير صالحة', 'err');
      return;
    }

    const ok = await handlePatch(
      env.id,
      {
        storeCategory: editCategory,
        subscriptionAmount: amt,
        expiresAt: editExpiresAt || env.expiresAt,
        newPassword: editNewPassword || undefined,
      },
      editNewPassword
        ? `تم تحديث بيانات البيئة (${env.name}) وتعيين كلمة المرور الجديدة`
        : `تم تحديث بيانات البيئة (${env.name}) بنجاح`
    );

    if (ok) {
      setEditingEnvId(null);
      setEditNewPassword('');
      setShowEditPassword(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      const res = await authFetch(`/api/admin/environments?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || 'تعذر حذف البيئة', 'err');
        return;
      }
      if (Array.isArray(data.environments)) setEnvironments(data.environments);
      if (data.auditLog && onAuditLog) onAuditLog(data.auditLog);
      notify('تم حذف البيئة المخصصة بنجاح');
    } finally {
      setBusyId(null);
    }
  };

  const activeCount = environments.filter((e) => e.isActive).length;
  const closedCount = environments.length - activeCount;

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <div className="p-6 rounded-3xl glass-card flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100 dark:bg-sky-500/20 text-[#0284C7] dark:text-[#00C2FF] text-xs font-black">
            <Layers className="w-3.5 h-3.5" />
            <span>مركز إدارة البيئات وتجهيز حسابات الدخول</span>
          </div>
          <h2 className="text-xl font-black text-[#0B1F3A] dark:text-white">
            إنشاء وتفعيل وقفل بيئات المنصة (Environments)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            أنشئ بيئة متكاملة بنوع المتجر والمبلغ وتاريخ الانتهاء واسم المستخدم وكلمة المرور، مع رابط دخول مباشر وتفعيل أو قفل فوري.
          </p>
        </div>

        <div className="flex items-center gap-3 tabular-nums">
          <div className="px-4 py-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-center">
            <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">بيئات مفعلة</div>
            <div className="text-xl font-black text-emerald-800 dark:text-emerald-200">{activeCount}</div>
          </div>
          <div className="px-4 py-2.5 rounded-2xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-center">
            <div className="text-[11px] font-bold text-rose-700 dark:text-rose-300">بيئات مقفلة</div>
            <div className="text-xl font-black text-rose-800 dark:text-rose-200">{closedCount}</div>
          </div>
        </div>
      </div>

      {/* Ready-to-Use Credentials Banner immediately after creation */}
      {createdBanner && (
        <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-l from-emerald-50 via-white to-sky-50 dark:from-emerald-950/40 dark:via-slate-900 dark:to-sky-950/30 border-2 border-emerald-400/70 dark:border-emerald-500/50 shadow-lg space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-[#0B1F3A] dark:text-white">
                  تم إنشاء البيئة وتجهيز بيانات الدخول للمستخدم بنجاح
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  يمكن لصاحب المتجر الآن الدخول مباشرة عبر الرابط أدناه باستخدام اسم المستخدم وكلمة المرور المحددة:
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCreatedBanner(null)}
              aria-label="إغلاق بطاقة بيانات الدخول"
              className="w-8 h-8 rounded-xl bg-white/80 dark:bg-slate-800 hover:bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] font-bold text-slate-500">المتجر ونوع النشاط</div>
              <div className="font-black text-[#0B1F3A] dark:text-white mt-0.5">{createdBanner.storeName}</div>
              <div className="text-[11px] font-bold text-[#0284C7] dark:text-[#00C2FF]">
                {createdBanner.storeCategory}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] font-bold text-slate-500">اسم المستخدم للدخول</div>
              <div className="font-mono font-black text-sm text-[#0B1F3A] dark:text-white mt-0.5 select-all">
                {createdBanner.username}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] font-bold text-slate-500">كلمة المرور</div>
              <div className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-300 mt-0.5 select-all">
                {createdBanner.password}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] font-bold text-slate-500">المبلغ وتاريخ الانتهاء</div>
              <div className="font-black text-[#0B1F3A] dark:text-white mt-0.5 tabular-nums">
                {createdBanner.subscriptionAmount.toLocaleString('en-US')} {createdBanner.currencyLabel}
              </div>
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                ينتهي: {createdBanner.expiresAt}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-2">
              <div className="text-[10px] font-bold text-slate-500">بوابة الدخول</div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const fullUrl =
                      typeof window !== 'undefined'
                        ? `${window.location.origin}${createdBanner.loginUrl}`
                        : createdBanner.loginUrl;
                    const summary = `بيئة: ${createdBanner.envName}\nنوع المتجر: ${createdBanner.storeCategory}\nرابط الدخول: ${fullUrl}\nاسم المستخدم: ${createdBanner.username}\nكلمة المرور: ${createdBanner.password}\nالمبلغ: ${createdBanner.subscriptionAmount.toLocaleString('en-US')} ${createdBanner.currencyLabel}\nتاريخ الانتهاء: ${createdBanner.expiresAt}`;
                    handleCopy('banner-creds', summary, 'تم نسخ بيانات الدخول والرابط بالكامل');
                  }}
                  className="flex-1 py-1.5 px-2.5 rounded-xl bg-[#0B1F3A] hover:bg-[#10325E] text-white text-[11px] font-black inline-flex items-center justify-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'banner-creds' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>نسخ البيانات</span>
                </button>
                <Link
                  href={createdBanner.loginUrl}
                  className="py-1.5 px-2.5 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] text-[11px] font-black inline-flex items-center gap-1"
                >
                  <span>دخول</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create New Environment Form */}
      <form onSubmit={handleCreate} className="p-6 rounded-3xl glass-card space-y-5 border border-sky-100 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-700/70 pb-3">
          <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#0284C7] dark:text-[#00C2FF]" />
            إنشاء بيئة تشغيل جديدة مع حساب الدخول
          </h3>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            يُنشأ معها المتجر وحساب التاجر تلقائياً وتخضع لحالة التفعيل وتاريخ الانتهاء
          </span>
        </div>

        {/* Row 1: Environment Name, Slug, Store Category, Store Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              اسم البيئة *
            </label>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="مثال: بيئة محمصة الرياض"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              المعرف (Slug)
            </label>
            <input
              type="text"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              placeholder="riyadh-roastery"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-[#0B1F3A] dark:text-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              نوع المتجر *
            </label>
            <select
              value={newStoreCategory}
              onChange={(e) => setNewStoreCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white font-bold"
            >
              {STORE_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              اسم المتجر (اختياري)
            </label>
            <input
              type="text"
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
              placeholder="يستخدم اسم البيئة افتراضياً"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
            />
          </div>
        </div>

        {/* Row 2: Username, Password, Amount, Expiration Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              اسم المستخدم للدخول *
            </label>
            <input
              type="text"
              required
              dir="ltr"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="store_owner1"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-right text-[#0B1F3A] dark:text-white"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                كلمة المرور *
              </label>
              <button
                type="button"
                onClick={generatePassword}
                className="text-[10px] font-black text-[#0284C7] dark:text-[#00C2FF] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                <span>توليد تلقائي</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="6 أحرف أو أكثر"
                className="w-full px-3.5 py-2.5 pl-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-[#0B1F3A] dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((p) => !p)}
                aria-label={showNewPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              المبلغ ({currencyUnitLabel(newCurrencyScope)}) *
            </label>
            <input
              type="number"
              min={0}
              step="any"
              required
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="299"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-[#0B1F3A] dark:text-white tabular-nums"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              تاريخ الانتهاء *
            </label>
            <input
              type="date"
              required
              value={newExpiresAt}
              onChange={(e) => setNewExpiresAt(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-[#0B1F3A] dark:text-white"
            />
          </div>
        </div>

        {/* Row 3: Environment Type, Currency Scope, Domain URL, Description, Submit */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              نوع البيئة
            </label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as EnvironmentType)}
              className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white font-bold"
            >
              <option value="sandbox">محاكاة تجريبية (Sandbox)</option>
              <option value="staging">اختبار قبل الإطلاق (Staging)</option>
              <option value="development">بيئة تطوير (Dev)</option>
              <option value="production">إنتاج فرعي (Production)</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              نطاق العملة والأسواق
            </label>
            <select
              value={newCurrencyScope}
              onChange={(e) => setNewCurrencyScope(e.target.value as 'ALL' | 'EGP' | 'SAR')}
              className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white font-bold"
            >
              <option value="ALL">جميع الأسواق</option>
              <option value="EGP">السوق المصري (ج.م)</option>
              <option value="SAR">السوق السعودي (ر.س)</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              رابط النطاق (Domain URL)
            </label>
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="https://store.aadapass.com"
              className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-[#0B1F3A] dark:text-white"
            />
          </div>

          <div className="lg:col-span-3">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              وصف البيئة والغرض منها
            </label>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="ملاحظات عن نشاط المتجر أو الباقة..."
              className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
            />
          </div>

          <div className="lg:col-span-3 flex flex-col gap-2">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-[#0B1F3A] dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={newIsActive}
                onChange={(e) => setNewIsActive(e.target.checked)}
                className="accent-emerald-500"
              />
              <span>تفعيل البيئة فور إنشائها</span>
            </label>
            <button
              type="submit"
              disabled={creating}
              className="w-full py-2.5 rounded-xl bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] text-xs font-black shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-60"
            >
              {creating ? 'جاري التجهيز...' : '+ إنشاء البيئة وتجهيز الدخول'}
            </button>
          </div>
        </div>
      </form>

      {/* Environments List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {environments.map((env) => {
          const badge = ENV_TYPE_LABELS[env.type] || ENV_TYPE_LABELS.sandbox;
          const isBusy = busyId === env.id;
          const loginUrl = buildFallbackLoginUrl(env);
          const isExpired = Boolean(todayIso && env.expiresAt && env.expiresAt < todayIso);
          const isEditing = editingEnvId === env.id;

          return (
            <div
              key={env.id}
              className={`p-5 rounded-3xl glass-card space-y-4 border-2 transition ${
                env.isActive && !isExpired
                  ? 'border-emerald-200/80 dark:border-emerald-500/30'
                  : 'border-rose-200/80 dark:border-rose-500/30 opacity-95'
              }`}
            >
              {/* Top Row */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1 ${
                        env.isActive
                          ? 'bg-emerald-500 text-white'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {env.isActive ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>مفعلة وتعمل</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3 h-3" />
                          <span>مقفلة حالياً</span>
                        </>
                      )}
                    </span>
                    {isExpired && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300">
                        منتهية الصلاحية
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-black text-[#0B1F3A] dark:text-white truncate">
                    {env.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-[#0284C7] dark:text-[#00C2FF]">
                    <Globe className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{env.domainUrl}</span>
                  </div>
                </div>

                {/* Primary Activate / Close Button */}
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() =>
                    handlePatch(
                      env.id,
                      { isActive: !env.isActive, maintenanceMode: env.isActive },
                      env.isActive
                        ? `تم قفل البيئة (${env.name}) وتحويلها لوضع الصيانة`
                        : `تم تفعيل البيئة (${env.name}) بنجاح`
                    )
                  }
                  className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 cursor-pointer transition ${
                    env.isActive
                      ? 'bg-rose-50 dark:bg-rose-500/20 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                  }`}
                >
                  {env.isActive ? (
                    <>
                      <PowerOff className="w-4 h-4" />
                      <span>قفل البيئة</span>
                    </>
                  ) : (
                    <>
                      <Power className="w-4 h-4" />
                      <span>تفعيل البيئة</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {env.description || 'لا يوجد وصف مضاف لهذه البيئة.'}
              </p>

              {/* Store Category, Username, Amount & Expiry Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-2xl bg-slate-50/90 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 text-[11px]">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                    <StoreIcon className="w-3 h-3 text-[#0284C7]" />
                    <span>نوع المتجر</span>
                  </div>
                  <div className="font-black text-[#0B1F3A] dark:text-white truncate">
                    {env.storeCategory || 'عام'}
                  </div>
                </div>

                <div className="space-y-0.5 min-w-0">
                  <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                    <User className="w-3 h-3 text-emerald-500" />
                    <span>اسم المستخدم</span>
                  </div>
                  <div className="font-mono font-black text-[#0B1F3A] dark:text-white truncate">
                    {env.username ? `@${env.username}` : 'غير محدد'}
                  </div>
                </div>

                <div className="space-y-0.5 min-w-0">
                  <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                    <Wallet className="w-3 h-3 text-amber-500" />
                    <span>المبلغ</span>
                  </div>
                  <div className="font-black text-[#0B1F3A] dark:text-white tabular-nums">
                    {Number(env.subscriptionAmount ?? 0).toLocaleString('en-US')}{' '}
                    {currencyUnitLabel(env.currencyScope)}
                  </div>
                </div>

                <div className="space-y-0.5 min-w-0">
                  <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-rose-500" />
                    <span>تاريخ الانتهاء</span>
                  </div>
                  <div
                    className={`font-mono font-black ${
                      isExpired ? 'text-rose-600 dark:text-rose-400' : 'text-[#0B1F3A] dark:text-white'
                    }`}
                  >
                    {env.expiresAt || 'غير محدد'}
                  </div>
                </div>
              </div>

              {/* Direct Login Strip */}
              <div className="p-2.5 rounded-2xl bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200/70 dark:border-sky-800/50 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 min-w-0 text-[#0B1F3A] dark:text-sky-100">
                  <KeyRound className="w-3.5 h-3.5 text-[#0284C7] dark:text-[#00C2FF] shrink-0" />
                  <span className="font-black shrink-0">دخول المستخدم:</span>
                  <span className="font-mono truncate text-slate-600 dark:text-slate-300" dir="ltr">
                    {loginUrl}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const fullUrl =
                        typeof window !== 'undefined' ? `${window.location.origin}${loginUrl}` : loginUrl;
                      handleCopy(`link-${env.id}`, fullUrl, `تم نسخ رابط الدخول المباشر لبيئة (${env.name})`);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-[#0B1F3A] dark:text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === `link-${env.id}` ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>نسخ الرابط</span>
                  </button>
                  <Link
                    href={loginUrl}
                    className="px-2.5 py-1 rounded-lg bg-[#0B1F3A] hover:bg-[#10325E] text-white font-black inline-flex items-center gap-1"
                  >
                    <span>فتح الدخول</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Inline Edit / Password Reset Drawer */}
              {isEditing && (
                <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-700/40 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-[#0B1F3A] dark:text-amber-200">
                      تعديل بيانات الاشتراك أو تعيين كلمة مرور جديدة
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingEnvId(null);
                        setEditNewPassword('');
                      }}
                      className="text-slate-500 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        نوع المتجر
                      </label>
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#0B1F3A] dark:text-white"
                      >
                        {STORE_CATEGORIES.map((cat) => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        المبلغ ({currencyUnitLabel(env.currencyScope)})
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-[#0B1F3A] dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        تاريخ الانتهاء
                      </label>
                      <input
                        type="date"
                        value={editExpiresAt}
                        onChange={(e) => setEditExpiresAt(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-[#0B1F3A] dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        كلمة مرور جديدة (اختياري)
                      </label>
                      <div className="relative">
                        <input
                          type={showEditPassword ? 'text' : 'password'}
                          value={editNewPassword}
                          onChange={(e) => setEditNewPassword(e.target.value)}
                          placeholder="اتركه فارغاً للإبقاء"
                          className="w-full px-2.5 py-2 pl-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-[#0B1F3A] dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowEditPassword((p) => !p)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer"
                        >
                          {showEditPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleSaveInlineEdit(env)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>حفظ التعديلات</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Environment Feature Switches */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() =>
                    handlePatch(
                      env.id,
                      { maintenanceMode: !env.maintenanceMode },
                      'تم تحديث وضع الصيانة للبيئة'
                    )
                  }
                  className={`p-2.5 rounded-xl border text-right text-[11px] font-bold transition cursor-pointer ${
                    env.maintenanceMode
                      ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-300'
                      : 'bg-white/80 dark:bg-slate-900/70 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Wrench className="w-3.5 h-3.5" />
                    <span>{env.maintenanceMode ? 'مفعل' : 'متوقف'}</span>
                  </div>
                  <div className="font-black">وضع الصيانة</div>
                </button>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() =>
                    handlePatch(
                      env.id,
                      { allowPublicRegistration: !env.allowPublicRegistration },
                      'تم تحديث حالة تسجيل العملاء الجدد'
                    )
                  }
                  className={`p-2.5 rounded-xl border text-right text-[11px] font-bold transition cursor-pointer ${
                    env.allowPublicRegistration
                      ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                      : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    {env.allowPublicRegistration ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    <span>{env.allowPublicRegistration ? 'مفتوح' : 'مغلق'}</span>
                  </div>
                  <div className="font-black">تسجيل العملاء</div>
                </button>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() =>
                    handlePatch(
                      env.id,
                      { allowStoreOnboarding: !env.allowStoreOnboarding },
                      'تم تحديث حالة تسجيل المتاجر الجديدة'
                    )
                  }
                  className={`p-2.5 rounded-xl border text-right text-[11px] font-bold transition cursor-pointer ${
                    env.allowStoreOnboarding
                      ? 'bg-sky-50 dark:bg-sky-500/15 border-sky-200 dark:border-sky-500/30 text-sky-800 dark:text-sky-300'
                      : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Server className="w-3.5 h-3.5" />
                    <span>{env.allowStoreOnboarding ? 'مفتوح' : 'مغلق'}</span>
                  </div>
                  <div className="font-black">انضمام المتاجر</div>
                </button>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() =>
                    handlePatch(
                      env.id,
                      { apiEnabled: !env.apiEnabled },
                      'تم تحديث حالة واجهة الربط البرمجي (API)'
                    )
                  }
                  className={`p-2.5 rounded-xl border text-right text-[11px] font-bold transition cursor-pointer ${
                    env.apiEnabled
                      ? 'bg-indigo-50 dark:bg-indigo-500/15 border-indigo-200 dark:border-indigo-500/30 text-indigo-800 dark:text-indigo-300'
                      : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>{env.apiEnabled ? 'متاح' : 'معطل'}</span>
                  </div>
                  <div className="font-black">واجهات API</div>
                </button>
              </div>

              {/* Footer Meta, Edit & Currency Scope */}
              <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <span>السوق:</span>
                  <select
                    value={env.currencyScope}
                    onChange={(e) =>
                      handlePatch(
                        env.id,
                        { currencyScope: e.target.value as 'ALL' | 'EGP' | 'SAR' },
                        'تم تحديث نطاق العملة للبيئة'
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#0B1F3A] dark:text-white font-bold"
                  >
                    <option value="ALL">جميع الأسواق (مصر + السعودية)</option>
                    <option value="EGP">السوق المصري فقط (ج.م)</option>
                    <option value="SAR">السوق السعودي فقط (ر.س)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditing) {
                        setEditingEnvId(null);
                      } else {
                        setEditingEnvId(env.id);
                        setEditCategory(env.storeCategory || 'كافيه');
                        setEditAmount(String(env.subscriptionAmount ?? 0));
                        setEditExpiresAt(env.expiresAt || todayIso);
                        setEditNewPassword('');
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 text-amber-800 dark:text-amber-300 font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>تعديل / كلمة المرور</span>
                  </button>
                  <span className="text-slate-400 font-mono hidden sm:inline">تحديث: {env.updatedAt}</span>
                  {env.id !== 'env-prod' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleDelete(env.id)}
                      className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 text-rose-700 dark:text-rose-300 font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>حذف</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
