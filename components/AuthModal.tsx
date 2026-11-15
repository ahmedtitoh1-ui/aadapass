'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Headphones,
  KeyRound,
  QrCode,
  Rocket,
  Shield,
  Store,
  User,
  UserPlus,
  Sparkles,
  X,
} from 'lucide-react';
import { setStoredAccessToken } from '@/lib/clientAuth';
import type {
  MarketCurrency,
  SessionUser,
  Store as StoreType,
  SubscriptionPlanName,
  UserRole,
} from '@/lib/types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: SessionUser, accessToken?: string, createdStore?: StoreType) => void;
  onOpenFullRegister?: (plan?: SubscriptionPlanName) => void;
  initialRoleHint?: UserRole;
  initialMode?: 'login' | 'register_merchant' | 'register_customer';
  initialIdentifier?: string;
  environmentSlug?: string;
  defaultPlan?: SubscriptionPlanName;
  defaultCurrency?: MarketCurrency;
  trialDays?: number;
}

export default function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  onOpenFullRegister,
  initialRoleHint,
  initialMode = 'login',
  initialIdentifier,
  environmentSlug,
  defaultPlan = 'Starter',
  defaultCurrency = 'SAR',
  trialDays = 14,
}: AuthModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register_merchant' | 'register_customer'>(initialMode);

  // Quick Customer Registration state (with Username & Password for login)
  const [custFullName, setCustFullName] = useState('');
  const [custUsername, setCustUsername] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custPassword, setCustPassword] = useState('');
  const [showCustPassword, setShowCustPassword] = useState(false);
  const [custSuccessMessage, setCustSuccessMessage] = useState<string | null>(null);

  // Login state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaCode, setMfaCode] = useState('123456');

  // Merchant Registration state
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regStoreName, setRegStoreName] = useState('');
  const [regCategory, setRegCategory] = useState('كافيه');
  const [regCurrency, setRegCurrency] = useState<MarketCurrency>(
    defaultCurrency === 'EGP' ? 'EGP' : 'SAR'
  );
  const [regCity, setRegCity] = useState(defaultCurrency === 'EGP' ? 'القاهرة' : 'الرياض');
  const [regArea, setRegArea] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regCommercialReg, setRegCommercialReg] = useState('');
  const [regPlan, setRegPlan] = useState<SubscriptionPlanName>(defaultPlan);
  const [regDescription, setRegDescription] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (initialMode === 'register_merchant' && onOpenFullRegister) {
      onClose();
      onOpenFullRegister(defaultPlan);
      return;
    }
    setMode(initialMode);
    if (initialIdentifier) {
      setIdentifier(initialIdentifier);
      setPassword('');
    }
    setRegPlan(defaultPlan);
    const nextCurr = defaultCurrency === 'EGP' ? 'EGP' : 'SAR';
    setRegCurrency(nextCurr);
    setRegCity(nextCurr === 'EGP' ? 'القاهرة' : 'الرياض');
    setError(null);
  }, [isOpen, initialMode, initialIdentifier, defaultPlan, defaultCurrency, onClose, onOpenFullRegister]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const routeUserToScreen = (user?: SessionUser, explicitRedirect?: string) => {
    if (explicitRedirect) {
      router.push(explicitRedirect);
      return;
    }
    if (!user) return;
    if (user.role === 'PLATFORM_ADMIN' || user.role === 'SUPPORT_AGENT') {
      router.push('/admin');
    } else if (user.role === 'CASHIER') {
      router.push('/cashier');
    } else if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      router.push('/?portal=1');
    }
  };

  const handleQuickRoleSignIn = async (demoRole: UserRole, redirectPath?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          demoRole,
          demoQuickSignIn: true,
          mfaCode: '123456',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'تعذر تسجيل الدخول');
        return;
      }
      if (data.accessToken) {
        setStoredAccessToken(data.accessToken);
      }
      if (onSuccess && data.user) {
        onSuccess(data.user, data.accessToken);
      }
      onClose();
      routeUserToScreen(data.user, redirectPath);
    } finally {
      setLoading(false);
    }
  };

  const handleCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('يرجى إدخال اسم المستخدم لتسجيل الدخول.');
      return;
    }
    if (!password) {
      setError('يرجى إدخال كلمة المرور.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
          mfaCode: mfaCode || '123456',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'اسم المستخدم أو كلمة المرور غير صحيحة');
        return;
      }
      if (data.accessToken) {
        setStoredAccessToken(data.accessToken);
      }
      if (onSuccess && data.user) {
        onSuccess(data.user, data.accessToken);
      }
      onClose();
      routeUserToScreen(data.user);
    } finally {
      setLoading(false);
    }
  };

  const handleMerchantRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regStoreName.trim() || !regFirstName.trim() || !regUsername.trim()) {
      setError('يرجى إدخال اسم المالك واسم المستخدم واسم المتجر.');
      return;
    }
    if (regPassword.length < 6) {
      setError('يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountType: 'MERCHANT_OWNER',
          firstName: regFirstName.trim(),
          lastName: regLastName.trim() || 'التاجر',
          username: regUsername.trim(),
          email: regEmail.trim() || `${regUsername.trim()}@aadapass.sa`,
          phone: regPhone.trim() || (regCurrency === 'EGP' ? '+201000000000' : '+966500000000'),
          password: regPassword,
          storeName: regStoreName.trim(),
          storePhone: regPhone.trim() || undefined,
          category: regCategory,
          currency: regCurrency,
          city: regCity.trim() || (regCurrency === 'EGP' ? 'القاهرة' : 'الرياض'),
          area: regArea.trim() || (regCurrency === 'EGP' ? 'المعادي' : 'العليا'),
          address: regAddress.trim() || 'الشارع الرئيسي',
          commercialReg: regCommercialReg.trim() || undefined,
          plan: regPlan,
          description: regDescription.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'تعذر إنشاء حساب المتجر. يرجى التحقق من البيانات.');
        return;
      }
      if (data.accessToken) {
        setStoredAccessToken(data.accessToken);
      }
      if (onSuccess && data.user) {
        onSuccess(data.user, data.accessToken, data.store);
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanUsername = custUsername.trim();
    const cleanP = custPhone.trim();
    const cleanPass = custPassword.trim();

    if (!cleanUsername || cleanUsername.length < 3) {
      setError('يرجى كتابة اسم مستخدم لحسابك (3 أحرف أو أرقام على الأقل) لتسجيل الدخول به لاحقاً.');
      return;
    }
    if (!cleanPass || cleanPass.length < 4) {
      setError('يرجى كتابة كلمة مرور لحسابك (4 أحرف أو أرقام على الأقل).');
      return;
    }
    if (!cleanP || cleanP.length < 8) {
      setError('يرجى إدخال رقم جوال صحيح (مثال: 0501234567 أو 01012345678).');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: custFullName.trim() || 'عميل مميز',
          username: cleanUsername,
          phone: cleanP,
          password: cleanPass,
          accountType: 'CUSTOMER',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'فشل التسجيل السريع.');
      }
      if (data.accessToken) {
        setStoredAccessToken(data.accessToken);
      }
      setCustSuccessMessage(
        `تم إنشاء حسابك باسم المستخدم (${cleanUsername}) وإصدار بطاقاتك الرقمية فوراً! جاري تحويلك...`
      );
      setTimeout(() => {
        if (onSuccess && data.user) {
          onSuccess(data.user, data.accessToken);
        }
        onClose();
        router.push('/?portal=1');
      }, 700);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء التسجيل السريع.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir="rtl"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-3xl bg-white border border-sky-200/90 shadow-2xl p-6 space-y-5 max-h-[92vh] overflow-y-auto text-[#0B1F3A]"
      >
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo-color.png"
              alt="عادة باس"
              className="h-9 w-auto object-contain"
            />
            <div>
              <h2 className="text-lg font-black text-[#0B1F3A]">
                {mode === 'login'
                  ? 'تسجيل الدخول باسم المستخدم وكلمة المرور'
                  : mode === 'register_customer'
                  ? 'تسجيل عميل جديد وإصدار بطاقة رقمية (في ثوانٍ) ⚡'
                  : `تسجيل متجر جديد (تجربة مجانية ${trialDays} يوماً)`}
              </h2>
              <p className="text-xs text-slate-500">
                {mode === 'login'
                  ? 'أدخل اسم المستخدم وكلمة المرور الخاصة بك أو اختر حساباً تجريبياً'
                  : mode === 'register_customer'
                  ? 'اختر اسم المستخدم وكلمة المرور ورقم جوالك واستلم بطاقاتك ونقاطك الترحيبية فوراً'
                  : 'سجّل بياناتك وبيانات متجرك واستمتع بالتجربة الكاملة فوراً لحين موافقة الإدارة'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-slate-100 border border-slate-200/80 text-center">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
              mode === 'login'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-[#0B1F3A]'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>تسجيل الدخول</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register_customer');
              setError(null);
            }}
            className={`py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
              mode === 'register_customer'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-emerald-600'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>تسجيل عميل ⚡</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (onOpenFullRegister) {
                onClose();
                onOpenFullRegister(defaultPlan);
                return;
              }
              if (typeof window !== 'undefined' && window.location.pathname !== '/') {
                onClose();
                router.push(`/?register=1&plan=${encodeURIComponent(defaultPlan)}`);
                return;
              }
              setMode('register_merchant');
              setError(null);
            }}
            className={`py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
              mode === 'register_merchant'
                ? 'bg-gradient-gold-cta text-[#0B1F3A] shadow-sm'
                : 'text-slate-600 hover:text-[#0B1F3A]'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>تسجيل متجر 🏪</span>
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
            {error}
          </div>
        )}

        {mode === 'login' ? (
          <>
            {/* Primary Credential Login Form (Username + Password) */}
            <form
              onSubmit={handleCredentialLogin}
              className="p-4 sm:p-5 rounded-2xl bg-sky-50/70 border border-sky-200/90 space-y-3.5"
            >
              {environmentSlug && (
                <div className="p-3 rounded-xl bg-white border border-sky-200 text-[#0B1F3A] text-xs font-bold flex items-center justify-between gap-2">
                  <span>بوابة الدخول المخصصة للبيئة:</span>
                  <span className="font-mono px-2 py-0.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-700">
                    {environmentSlug}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="text-xs font-black text-[#0B1F3A] flex items-center gap-1.5">
                  <User className="w-4 h-4 text-sky-600" />
                  <span>الدخول باسم المستخدم وكلمة المرور (للعميل أو التاجر):</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register_customer');
                    setError(null);
                  }}
                  className="text-[11px] font-black text-emerald-700 hover:underline cursor-pointer"
                >
                  عميل جديد؟ سجّل الآن ⚡
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1">
                    اسم المستخدم *
                  </label>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="اكتب اسم المستخدم الخاص بك..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-[#0B1F3A] focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1">
                    كلمة المرور *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="اكتب كلمة المرور..."
                      className="w-full px-3.5 py-2.5 pl-9 rounded-xl bg-white border border-slate-200 text-xs font-bold text-[#0B1F3A] focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {(identifier.trim().toLowerCase() === 'admin' || initialRoleHint === 'PLATFORM_ADMIN') && (
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    placeholder="رمز التحقق الثنائي للإدارة (123456)"
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-[#0B1F3A] font-mono"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-electric hover:opacity-95 text-white text-xs sm:text-sm font-black shadow-md shadow-sky-500/20 cursor-pointer transition"
              >
                {loading ? 'جاري التحقق وتأكيد الدخول...' : 'تسجيل الدخول إلى حسابي'}
              </button>
            </form>

            {/* Quick Role Access Buttons (Light Mode) */}
            <div className="space-y-2.5 pt-2 border-t border-slate-200/80">
              <div className="text-[11px] font-black text-slate-500">
                أو الدخول السريع للحسابات التجريبية المعتمدة:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickRoleSignIn('CUSTOMER')}
                  className="p-3 rounded-2xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-[#0B1F3A] text-right flex items-center gap-2.5 transition cursor-pointer"
                >
                  <User className="w-5 h-5 text-sky-600 shrink-0" />
                  <div>
                    <div className="text-xs font-black">حساب العميل التجريبي</div>
                    <div className="text-[10px] text-slate-500">
                      فهد العتيبي (3 بطاقات ذكية)
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickRoleSignIn('MERCHANT_OWNER')}
                  className="p-3 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-[#0B1F3A] text-right flex items-center gap-2.5 transition cursor-pointer"
                >
                  <Store className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <div className="text-xs font-black">لوحة تحكم التاجر</div>
                    <div className="text-[10px] text-slate-500">
                      محمصة كيان المختصة
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickRoleSignIn('CASHIER', '/cashier')}
                  className="p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[#0B1F3A] text-right flex items-center gap-2.5 transition cursor-pointer"
                >
                  <QrCode className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <div className="text-xs font-black">بوابة الكاشير الذكي</div>
                    <div className="text-[10px] text-slate-500">
                      مسح البطاقات والطلبات
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickRoleSignIn('PLATFORM_ADMIN', '/admin')}
                  className="p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[#0B1F3A] text-right flex items-center justify-between gap-2.5 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-5 h-5 text-sky-700 shrink-0" />
                    <div>
                      <div className="text-xs font-black">مدير النظام والدعم</div>
                      <div className="text-[10px] text-slate-500">
                        الإدارة الشاملة والتدخل اليدوي
                      </div>
                    </div>
                  </div>
                  <Headphones className="w-4 h-4 text-sky-600 shrink-0" />
                </button>
              </div>
            </div>
          </>
        ) : mode === 'register_customer' ? (
          <form onSubmit={handleCustomerRegister} className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="font-black text-sm text-emerald-950">
                  تسجيل عميل جديد باسم مستخدم وكلمة مرور ⚡
                </h4>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  أدخل اسمك، واختر <strong>اسم المستخدم</strong> و<strong>كلمة المرور</strong> لتسجيل الدخول بهما في أي وقت، وسنصدر لك فوراً بطاقاتك الـ 3 الذكية مع رصيد نقاط ترحيبي مجاني!
                </p>
              </div>
            </div>

            {custSuccessMessage ? (
              <div className="p-8 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-600 animate-bounce" />
                <p className="font-black text-base">{custSuccessMessage}</p>
                <p className="text-xs text-emerald-700">جاري نقلك إلى محفظة بطاقاتك...</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-black text-[#0B1F3A] mb-1">
                      الاسم الكامل (أو اسمك المفضل) *
                    </label>
                    <input
                      type="text"
                      required
                      value={custFullName}
                      onChange={(e) => setCustFullName(e.target.value)}
                      placeholder="مثال: أحمد محمد أو سارة الدوسري"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-[#0B1F3A] text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-[#0B1F3A] mb-1">
                      اسم المستخدم (للدخول لحسابك) *
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      required
                      value={custUsername}
                      onChange={(e) => setCustUsername(e.target.value.replace(/\s+/g, ''))}
                      placeholder="مثال: ahmed2026"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-[#0B1F3A] text-xs font-mono font-bold text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-[#0B1F3A] mb-1">
                      كلمة المرور (للدخول لحسابك) *
                    </label>
                    <div className="relative">
                      <input
                        type={showCustPassword ? 'text' : 'password'}
                        required
                        minLength={4}
                        value={custPassword}
                        onChange={(e) => setCustPassword(e.target.value)}
                        placeholder="اكتب كلمة المرور (4 أحرف+)"
                        className="w-full px-3.5 py-2.5 pl-9 rounded-xl bg-white border border-slate-200 text-[#0B1F3A] text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCustPassword((p) => !p)}
                        aria-label={showCustPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showCustPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-black text-[#0B1F3A] mb-1">
                      رقم الجوال (لتأكيد الطلبات وإشعارات الواتساب) *
                    </label>
                    <input
                      type="tel"
                      dir="ltr"
                      required
                      value={custPhone}
                      onChange={(e) => setCustPhone(e.target.value)}
                      placeholder="0501234567 أو 01012345678"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-[#0B1F3A] text-xs font-mono font-bold text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-black shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 transition"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>
                    {loading ? 'جاري إنشاء حسابك وإصدار البطاقات...' : '⚡ تسجيل الحساب وإصدار بطاقاتي الآن'}
                  </span>
                </button>
              </>
            )}
          </form>
        ) : (
          <form onSubmit={handleMerchantRegister} className="space-y-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 flex items-start gap-2.5 text-[#0B1F3A] dark:text-sky-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>تجربة مجانية فورية لمدة {trialDays} يوماً:</strong> فور إكمال التسجيل، تُفتح
                لك لوحة المتجر وبطاقة الولاء ورابط الـ QR فوراً، ويصل طلبك تلقائياً إلى مدير النظام
                للمراجعة والتفعيل اليدوي.
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-black text-sky-700 dark:text-[#00C2FF]">
                أولاً: بيانات مالك المتجر
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  required
                  value={regFirstName}
                  onChange={(e) => setRegFirstName(e.target.value)}
                  placeholder="الاسم الأول للمالك *"
                  className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#0B1F3A] dark:text-white"
                />
                <input
                  type="text"
                  value={regLastName}
                  onChange={(e) => setRegLastName(e.target.value)}
                  placeholder="اسم العائلة"
                  className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#0B1F3A] dark:text-white"
                />
                <input
                  type="text"
                  required
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="اسم المستخدم للدخول (إنجليزي) *"
                  className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#0B1F3A] dark:text-white font-mono"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="كلمة المرور (6 أحرف+) *"
                  className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#0B1F3A] dark:text-white"
                />
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="البريد الإلكتروني *"
                  className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#0B1F3A] dark:text-white"
                />
                <input
                  type="tel"
                  required
                  dir="ltr"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="رقم الجوال / الواتساب (+966... / +20...) *"
                  className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#0B1F3A] dark:text-white font-mono text-right"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/60">
              <div className="text-[11px] font-black text-amber-600 dark:text-[#FBBF24]">
                ثانياً: بيانات المتجر والباقة المطلوبة
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  required
                  value={regStoreName}
                  onChange={(e) => setRegStoreName(e.target.value)}
                  placeholder="اسم المتجر / العلامة التجارية *"
                  className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#0B1F3A] dark:text-white font-bold"
                />
                <select
                  value={regCategory}
                  onChange={(e) => setRegCategory(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#0B1F3A] dark:text-white font-bold"
                >
                  <option value="كافيه">كافيه ومقهى مختص</option>
                  <option value="مطعم">مطعم ومأكولات</option>
                  <option value="حلويات ومخبوزات">حلويات ومخبوزات</option>
                  <option value="صالون">صالون وعناية</option>
                  <option value="متجر">متجر تجزئة</option>
                </select>
                <select
                  value={regCurrency}
                  onChange={(e) => {
                    const next = e.target.value === 'EGP' ? 'EGP' : 'SAR';
                    setRegCurrency(next);
                    if (!regCity || regCity === 'الرياض' || regCity === 'القاهرة') {
                      setRegCity(next === 'EGP' ? 'القاهرة' : 'الرياض');
                    }
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#0B1F3A] dark:text-white font-bold"
                >
                  <option value="SAR">🇸🇦 السعودية (ريال سعودي - SAR)</option>
                  <option value="EGP">🇪🇬 مصر (جنيه مصري - EGP)</option>
                </select>
                <select
                  value={regPlan}
                  onChange={(e) => setRegPlan(e.target.value as SubscriptionPlanName)}
                  className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#0B1F3A] dark:text-white font-bold"
                >
                  <option value="Viewer">باقة التواجد الرقمي (Viewer)</option>
                  <option value="Starter">باقة الانطلاق (Starter)</option>
                  <option value="Growth">باقة النمو (Growth)</option>
                  <option value="Business">باقة الشركات (Business)</option>
                </select>
                <input
                  type="text"
                  required
                  value={regCity}
                  onChange={(e) => setRegCity(e.target.value)}
                  placeholder="المدينة (الرياض، جدة، القاهرة...) *"
                  className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#0B1F3A] dark:text-white"
                />
                <input
                  type="text"
                  value={regArea}
                  onChange={(e) => setRegArea(e.target.value)}
                  placeholder="الحي / المنطقة"
                  className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#0B1F3A] dark:text-white"
                />
                <input
                  type="text"
                  value={regAddress}
                  onChange={(e) => setRegAddress(e.target.value)}
                  placeholder="العنوان التفصيلي"
                  className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#0B1F3A] dark:text-white"
                />
                <input
                  type="text"
                  value={regCommercialReg}
                  onChange={(e) => setRegCommercialReg(e.target.value)}
                  placeholder="رقم السجل التجاري (اختياري)"
                  className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#0B1F3A] dark:text-white font-mono"
                />
              </div>
              <textarea
                rows={2}
                value={regDescription}
                onChange={(e) => setRegDescription(e.target.value)}
                placeholder="نبذة قصيرة عن المتجر وما يقدمه للعملاء (اختياري)..."
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#0B1F3A] dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] text-xs sm:text-sm font-black shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Rocket className="w-4 h-4" />
              <span>
                {loading
                  ? 'جاري إنشاء حساب المتجر وتفعيل التجربة...'
                  : `إنشاء الحساب وبدء التجربة المجانية (${trialDays} يوماً)`}
              </span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

