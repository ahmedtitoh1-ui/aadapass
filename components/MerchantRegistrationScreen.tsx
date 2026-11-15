'use client';

import React, { useState } from 'react';
import {
  Store as StoreIcon,
  User,
  Phone,
  Mail,
  Lock,
  Upload,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  MapPin,
  Clock,
  FileText,
  Globe,
  Wifi,
  Instagram,
  Sparkles,
  MessageCircle,
  ShieldCheck,
  Building2,
  Image as ImageIcon,
  Tag,
  AlertCircle,
  Check,
  ExternalLink,
} from 'lucide-react';
import {
  MarketCurrency,
  SubscriptionPackage,
  SessionUser,
  Store,
  StoreCategory,
  SubscriptionPlanName,
} from '@/lib/types';

interface MerchantRegistrationScreenProps {
  initialPlan?: SubscriptionPlanName;
  initialAccountType?: 'MERCHANT_OWNER' | 'CUSTOMER';
  selectedCountryCurrency?: MarketCurrency;
  packages: SubscriptionPackage[];
  annualDiscountPercent?: number;
  adminWhatsappNumber: string;
  trialDaysConfig?: number;
  onBackToHome: () => void;
  onSwitchToLogin: () => void;
  onRegistrationComplete: (
    user: SessionUser,
    accessToken?: string,
    createdStore?: Store,
    trialDays?: number
  ) => void;
}

const STORE_CATEGORIES: string[] = [
  'كافيه',
  'مطعم',
  'حلويات ومخبوزات',
  'عطور وتجميل',
  'أزياء',
  'لياقة وسبا',
  'تجزئة',
  'خدمات',
  'ترفيه',
  'أخرى',
];

export default function MerchantRegistrationScreen({
  initialPlan,
  initialAccountType = 'MERCHANT_OWNER',
  selectedCountryCurrency = 'SAR',
  packages,
  annualDiscountPercent = 20,
  adminWhatsappNumber,
  trialDaysConfig = 14,
  onBackToHome,
  onSwitchToLogin,
  onRegistrationComplete,
}: MerchantRegistrationScreenProps) {
  const [accountType, setAccountType] = useState<'MERCHANT_OWNER' | 'CUSTOMER'>(initialAccountType);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  // Owner / User details
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Store details
  const [storeName, setStoreName] = useState('');
  const [storeCategory, setStoreCategory] = useState<string>('كافيه');
  const [storeCurrency, setStoreCurrency] = useState<MarketCurrency>(selectedCountryCurrency);
  const [storeCity, setStoreCity] = useState(selectedCountryCurrency === 'EGP' ? 'القاهرة' : 'الرياض');
  const [storeArea, setStoreArea] = useState(selectedCountryCurrency === 'EGP' ? 'التجمع الخامس' : 'العليا');
  const [storeAddress, setStoreAddress] = useState('');
  const [workingHours, setWorkingHours] = useState('يومياً 9:00 ص - 11:30 م');
  const [commercialReg, setCommercialReg] = useState('');
  const [googleMapLink, setGoogleMapLink] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [storeDescription, setStoreDescription] = useState('');

  // Store visual identity (Logo & Cover)
  const [storeLogo, setStoreLogo] = useState(
    'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?auto=format&fit=crop&q=80&w=300'
  );
  const [secondaryLogo, setSecondaryLogo] = useState('');
  const [storeCover, setStoreCover] = useState(
    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&q=80&w=1200'
  );

  // Selected package in Step 2
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanName>(initialPlan || 'Growth');
  const [whatsappNotes, setWhatsappNotes] = useState('');

  // Registration & submission state
  const [error, setError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredData, setRegisteredData] = useState<{
    user: SessionUser;
    accessToken?: string;
    store?: Store;
    trialDays: number;
  } | null>(null);
  const [whatsappSent, setWhatsappSent] = useState(false);

  const visiblePackages = packages.filter((p) => p.visibleForStores !== false);

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'logo' | 'secondaryLogo' | 'cover'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('يرجى اختيار صورة بصيغة PNG أو JPG أو WEBP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('حجم الصورة يتجاوز الحد الأقصى المسموح به (2MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        if (target === 'logo') setStoreLogo(reader.result);
        else if (target === 'secondaryLogo') setSecondaryLogo(reader.result);
        else setStoreCover(reader.result);
        setError(null);
        setUploadNotice(
          target === 'logo'
            ? 'تم رفع شعار المتجر الأساسي بنجاح'
            : target === 'secondaryLogo'
            ? 'تم رفع الشعار الثانوي للبطاقة بنجاح'
            : 'تم رفع صورة غلاف المتجر بنجاح'
        );
      }
    };
    reader.readAsDataURL(file);
  };

  const handleStep1Continue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) {
      setError('يرجى إدخال اسم المالك.');
      return;
    }
    if (!phone.trim()) {
      setError('يرجى إدخال رقم الجوال / الواتساب للتواصل والتفعيل.');
      return;
    }
    if (!email.trim()) {
      setError('يرجى إدخال البريد الإلكتروني.');
      return;
    }
    if (!username.trim() || !password.trim()) {
      setError('يرجى تحديد اسم المستخدم وكلمة المرور للدخول لحسابك.');
      return;
    }

    if (accountType === 'CUSTOMER') {
      // Immediate customer registration
      setIsSubmitting(true);
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim() || 'عميل',
            username: username.trim(),
            email: email.trim(),
            phone: phone.trim(),
            password,
            accountType: 'CUSTOMER',
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'تعذر إنشاء الحساب، يرجى التحقق من البيانات.');
          return;
        }
        if (data.accessToken && typeof window !== 'undefined') {
          window.localStorage.setItem('aada_access_token', data.accessToken);
        }
        onRegistrationComplete(data.user, data.accessToken);
      } catch {
        setError('تعذر الاتصال بالخادم، يرجى المحاولة مرة أخرى.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Merchant validation
    if (!storeName.trim()) {
      setError('يرجى إدخال اسم المتجر التجاري.');
      return;
    }
    if (!storeCity.trim() || !storeAddress.trim()) {
      setError('يرجى إدخال المدينة والعنوان التفصيلي للمتجر.');
      return;
    }

    setStep(2);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleRegisterMerchantAccount = async () => {
    if (registeredData) {
      setStep(3);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim() || 'المالك',
          username: username.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
          accountType: 'MERCHANT_OWNER',
          storeName: storeName.trim(),
          storePhone: phone.trim(),
          category: storeCategory,
          currency: storeCurrency,
          city: storeCity.trim(),
          area: storeArea.trim(),
          address: storeAddress.trim(),
          workingHours: workingHours.trim(),
          commercialReg: commercialReg.trim(),
          googleMapLink: googleMapLink.trim(),
          wifiPassword: wifiPassword.trim(),
          instagramUrl: instagramUrl.trim(),
          description: storeDescription.trim(),
          logo: storeLogo.trim(),
          secondaryLogo: secondaryLogo.trim() || undefined,
          cover: storeCover.trim(),
          plan: selectedPlan,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'تعذر تسجيل المتجر، قد يكون اسم المستخدم أو البريد مسجلاً مسبقاً.');
        return;
      }
      if (data.accessToken && typeof window !== 'undefined') {
        window.localStorage.setItem('aada_access_token', data.accessToken);
      }

      // Also record contact/WhatsApp request ticket with package & billing cycle details
      const pkgObj = packages.find((p) => p.id === selectedPlan);
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName: `${firstName.trim()} ${lastName.trim()} (${storeName.trim()})`,
          senderPhone: phone.trim(),
          storeName: storeName.trim(),
          requestedPlan: selectedPlan,
          subject: `طلب تفعيل باقة ${pkgObj?.name || selectedPlan} (${billingCycle === 'annual' ? 'سنوي' : 'شهري'}) — متجر ${storeName.trim()}`,
          message: `تم إكمال تسجيل المتجر واختيار باقة ${pkgObj?.name || selectedPlan} (${billingCycle === 'annual' ? 'سنوي' : 'شهري'}) | السوق: ${storeCurrency} - ${storeCity} (${storeArea}) | الجوال: ${phone} | ملاحظات: ${whatsappNotes || 'يرجى مراجعة المتجر وتفعيل الباقة'}.`,
        }),
      }).catch(() => null);

      setRegisteredData({
        user: data.user,
        accessToken: data.accessToken,
        store: data.store,
        trialDays: data.trialDays || trialDaysConfig,
      });
      setStep(3);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch {
      setError('تعذر الاتصال بالخادم أثناء إنشاء المتجر.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Build formatted WhatsApp link for Admin
  const selectedPkg = packages.find((p) => p.name === selectedPlan) || packages[0];
  const getPackagePriceDisplay = (pkg: SubscriptionPackage) => {
    const basePrice = storeCurrency === 'EGP' ? pkg.monthlyPriceEgp || Math.round(pkg.monthlyPrice * 12) : pkg.monthlyPrice;
    if (basePrice === 0) return 'مجانية';
    const finalPrice =
      billingCycle === 'annual'
        ? Math.round(basePrice * (1 - annualDiscountPercent / 100))
        : basePrice;
    return `${finalPrice.toLocaleString('en-US')} ${storeCurrency === 'EGP' ? 'ج.م' : 'ر.س'} / شهرياً`;
  };

  const cleanWhatsappNumber = (adminWhatsappNumber || '966500000000').replace(/[^0-9]/g, '');
  const whatsappMessageLines = [
    `مرحباً إدارة منصة عادة باس 👋`,
    `أرغب في تفعيل متجري الجديد واعتماد الباقة المختارة:`,
    `• اسم المتجر: ${storeName || '-'} (${storeCategory})`,
    `• اسم المالك: ${firstName} ${lastName}`,
    `• رقم الجوال/واتساب: ${phone}`,
    `• البريد الإلكتروني: ${email}`,
    `• اسم المستخدم: ${username}`,
    `• الموقع: ${storeCity} - ${storeArea} (${storeAddress})`,
    `• الباقة المختارة: ${selectedPkg?.name || selectedPlan} (${billingCycle === 'annual' ? `اشتراك سنوي بخصم ${annualDiscountPercent}%` : 'اشتراك شهري'})`,
    `• قيمة الباقة: ${selectedPkg ? getPackagePriceDisplay(selectedPkg) : ''}`,
    whatsappNotes ? `• ملاحظات إضافية: ${whatsappNotes}` : '',
    `تم بدء الفترة التجريبية المجانية (${registeredData?.trialDays || trialDaysConfig} يوماً) وبانتظار التفعيل الرسمي من قبلكم.`,
  ]
    .filter(Boolean)
    .join('\n');

  const whatsappUrl = `https://wa.me/${cleanWhatsappNumber}?text=${encodeURIComponent(whatsappMessageLines)}`;

  const handleEnterTrialPortal = () => {
    if (!registeredData) return;
    onRegistrationComplete(
      registeredData.user,
      registeredData.accessToken,
      registeredData.store,
      registeredData.trialDays
    );
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#F5F7FA] dark:bg-[#070E1A] text-slate-900 dark:text-white pb-20">
      {/* Top Full-Screen Header Bar */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B1F3A]/95 backdrop-blur-md border-b border-slate-200 dark:border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToHome}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowRight className="w-4 h-4" />
              العودة للرئيسية
            </button>
            <div className="h-6 w-px bg-slate-200 dark:bg-white/10 hidden sm:block" />
            <div>
              <h1 className="text-base sm:text-lg font-black text-[#0B1F3A] dark:text-white">
                {accountType === 'MERCHANT_OWNER'
                  ? 'تسجيل متجر جديد وتفعيل التجربة المجانية'
                  : 'تسجيل حساب عميل جديد'}
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                {accountType === 'MERCHANT_OWNER'
                  ? `أدخل بيانات المالك والمتجر وارفع الشعار، ثم اختر باقتك وأرسل الطلب للواتساب واستمتع بتجربة مجانية (${trialDaysConfig} يوماً)`
                  : 'أنشئ محفظتك الرقمية مجاناً واجمع النقاط والمكافآت من جميع المتاجر الشريكة'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden md:inline">لديك حساب بالفعل؟</span>
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-xs font-black text-[#0B1F3A] dark:text-white transition-colors whitespace-nowrap shrink-0"
            >
              تسجيل الدخول
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8">
        {/* Account Type Switcher (only on Step 1 before registering) */}
        {step === 1 && !registeredData && (
          <div className="bg-white dark:bg-[#0B1F3A] rounded-2xl p-2 border border-slate-200 dark:border-white/10 flex flex-col sm:flex-row gap-2 mb-8 shadow-sm">
            <button
              type="button"
              onClick={() => setAccountType('MERCHANT_OWNER')}
              className={`flex-1 py-3.5 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2.5 transition-all ${
                accountType === 'MERCHANT_OWNER'
                  ? 'bg-[#0B1F3A] dark:bg-[#007BFF] text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
              }`}
            >
              <StoreIcon className="w-4 h-4 text-[#FFC107]" />
              <span>تسجيل مالك متجر جديد (شامل الشعار والباقة وتجربة {trialDaysConfig} يوم)</span>
            </button>
            <button
              type="button"
              onClick={() => setAccountType('CUSTOMER')}
              className={`sm:w-72 py-3.5 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all ${
                accountType === 'CUSTOMER'
                  ? 'bg-[#0B1F3A] dark:bg-[#007BFF] text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
              }`}
            >
              <User className="w-4 h-4" />
              <span>تسجيل كعميل (محفظة نقاط)</span>
            </button>
          </div>
        )}

        {/* Stepper Bar for Merchant Registration */}
        {accountType === 'MERCHANT_OWNER' && (
          <div className="bg-white dark:bg-[#0B1F3A] rounded-2xl p-5 border border-slate-200 dark:border-white/10 mb-8 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  num: 1,
                  title: '1. بيانات المالك والمتجر واللوجو',
                  subtitle: 'الاسم، الجوال، البريد، تفاصيل المتجر ورفع الشعار',
                },
                {
                  num: 2,
                  title: '2. اختيار الباقة وإرسال للواتساب',
                  subtitle: 'تحديد الباقة المناسبة وإشعار مدير النظام',
                },
                {
                  num: 3,
                  title: `3. بدء التجربة المجانية (${trialDaysConfig} يوماً)`,
                  subtitle: 'الدخول الفوري للوحة المتجر لحين التفعيل',
                },
              ].map((item) => {
                const isActive = step === item.num;
                const isDone = step > item.num;
                return (
                  <div
                    key={item.num}
                    className={`flex items-center gap-3.5 p-3.5 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-[#007BFF]/5 dark:bg-[#007BFF]/15 border-[#007BFF]'
                        : isDone
                        ? 'bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-slate-50/60 dark:bg-white/5 border-slate-200/70 dark:border-white/10 opacity-75'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                        isDone
                          ? 'bg-emerald-500 text-white'
                          : isActive
                          ? 'bg-[#007BFF] text-white'
                          : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {isDone ? <Check className="w-5 h-5" /> : item.num}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-black text-[#0B1F3A] dark:text-white truncate">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-center gap-3 text-rose-700 dark:text-rose-300 text-xs sm:text-sm font-bold">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {uploadNotice && (
          <div className="mb-6 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-between text-emerald-700 dark:text-emerald-300 text-xs font-bold">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {uploadNotice}
            </span>
            <button
              type="button"
              onClick={() => setUploadNotice(null)}
              className="text-[11px] underline hover:no-underline"
            >
              إخفاء
            </button>
          </div>
        )}

        {/* STEP 1: OWNER + STORE FORM + LOGO UPLOAD */}
        {step === 1 && (
          <form onSubmit={handleStep1Continue} className="space-y-8">
            {/* Section A: Owner / User Information */}
            <div className="bg-white dark:bg-[#0B1F3A] rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-white/10 shadow-sm">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-white/10">
                <div className="w-10 h-10 rounded-xl bg-[#007BFF]/10 text-[#007BFF] flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-[#0B1F3A] dark:text-white">
                    {accountType === 'MERCHANT_OWNER' ? 'أولاً: بيانات مالك المتجر وحساب الدخول' : 'بيانات الحساب الشخصي'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    أدخل اسم المالك ورقم الجوال (الواتساب) والبريد الإلكتروني وبيانات تسجيل الدخول
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-2">
                    الاسم الأول للمالك <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="مثال: محمد"
                      className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-bold text-[#0B1F3A] dark:text-white focus:outline-none focus:border-[#007BFF]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-2">
                    اسم العائلة / اللقب <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="مثال: العتيبي / المنشاوي"
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-bold text-[#0B1F3A] dark:text-white focus:outline-none focus:border-[#007BFF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-2">
                    رقم الجوال (واتساب المالك) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      dir="ltr"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+966501234567 / +201012345678"
                      className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-mono font-bold text-[#0B1F3A] dark:text-white focus:outline-none focus:border-[#007BFF]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-2">
                    البريد الإلكتروني الرسمي <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      dir="ltr"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="owner@store.com"
                      className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-mono font-bold text-[#0B1F3A] dark:text-white focus:outline-none focus:border-[#007BFF]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-2">
                    اسم المستخدم لتسجيل الدخول <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="merchant_username"
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-mono font-bold text-[#0B1F3A] dark:text-white focus:outline-none focus:border-[#007BFF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-2">
                    كلمة المرور <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      dir="ltr"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-mono font-bold text-[#0B1F3A] dark:text-white focus:outline-none focus:border-[#007BFF]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section B: Store Details & Logo Upload (Merchant Only) */}
            {accountType === 'MERCHANT_OWNER' && (
              <>
                <div className="bg-white dark:bg-[#0B1F3A] rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-white/10 shadow-sm">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-white/10">
                    <div className="w-10 h-10 rounded-xl bg-[#FFC107]/15 text-[#0B1F3A] dark:text-[#FFC107] flex items-center justify-center">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-black text-[#0B1F3A] dark:text-white">
                        ثانياً: رفع لوجو المتجر وهوية العرض
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        ارفع شعار المتجر الأساسي وصورة الغلاف ليظهرا في صفحة المتجر وعلى بطاقات الولاء والـ QR المطبوع
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Store Logo Upload Card */}
                    <div className="lg:col-span-5 bg-slate-50 dark:bg-white/5 rounded-2xl p-5 border border-slate-200 dark:border-white/10 space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-2xl bg-white dark:bg-[#0B1F3A] border-2 border-slate-200 dark:border-white/15 overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
                          {storeLogo ? (
                            <img src={storeLogo} alt="Store Logo" className="w-full h-full object-cover" />
                          ) : (
                            <StoreIcon className="w-8 h-8 text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                          <p className="text-xs font-black text-[#0B1F3A] dark:text-white">
                            شعار المتجر الأساسي (اللوجو) <span className="text-rose-500">*</span>
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            يدعم PNG, JPG, WEBP حتى 2MB
                          </p>
                          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#007BFF] hover:bg-blue-600 text-white text-xs font-black cursor-pointer transition-colors shadow-sm">
                            <Upload className="w-3.5 h-3.5" />
                            <span>رفع لوجو من جهازك</span>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="hidden"
                              onChange={(e) => handleImageUpload(e, 'logo')}
                            />
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                          أو أدخل رابط مباشر لشعار المتجر (URL)
                        </label>
                        <input
                          type="url"
                          dir="ltr"
                          value={storeLogo}
                          onChange={(e) => setStoreLogo(e.target.value)}
                          placeholder="https://..."
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0B1F3A] border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-700 dark:text-slate-200"
                        />
                      </div>
                    </div>

                    {/* Store Cover & Secondary Logo */}
                    <div className="lg:col-span-7 bg-slate-50 dark:bg-white/5 rounded-2xl p-5 border border-slate-200 dark:border-white/10 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-black text-[#0B1F3A] dark:text-white">
                            صورة غلاف المتجر (Cover) والشعار الثانوي
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            تظهر صورة الغلاف أعلى صفحة المتجر وفي معاينة دليل المتاجر للزوار
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#0B1F3A] border border-slate-200 dark:border-white/15 hover:border-[#007BFF] text-xs font-black text-[#0B1F3A] dark:text-white cursor-pointer transition-colors">
                            <Upload className="w-3.5 h-3.5 text-[#007BFF]" />
                            <span>رفع صورة الغلاف</span>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="hidden"
                              onChange={(e) => handleImageUpload(e, 'cover')}
                            />
                          </label>
                          <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#0B1F3A] border border-slate-200 dark:border-white/15 hover:border-[#007BFF] text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer transition-colors">
                            <Upload className="w-3.5 h-3.5 text-amber-500" />
                            <span>شعار ثانوي (اختياري)</span>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="hidden"
                              onChange={(e) => handleImageUpload(e, 'secondaryLogo')}
                            />
                          </label>
                        </div>
                      </div>

                      {/* Live Cover + Logo Banner Preview */}
                      <div className="relative h-32 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-900">
                        <img
                          src={storeCover}
                          alt="Store Cover Preview"
                          className="w-full h-full object-cover opacity-80"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0B1F3A]/90 via-[#0B1F3A]/30 to-transparent" />
                        <div className="absolute bottom-3 right-3 left-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={storeLogo}
                              alt="Logo"
                              className="w-12 h-12 rounded-xl object-cover border-2 border-white shadow-md bg-white"
                            />
                            <div>
                              <p className="text-sm font-black text-white">
                                {storeName || 'اسم المتجر يظهر هنا'}
                              </p>
                              <p className="text-[11px] text-slate-200">
                                {storeCategory} • {storeCity} ({storeArea})
                              </p>
                            </div>
                          </div>
                          {secondaryLogo && (
                            <img
                              src={secondaryLogo}
                              alt="Secondary Logo"
                              className="w-10 h-10 rounded-lg object-cover border border-white/40 bg-white/90 p-0.5"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section C: Full Store Information */}
                <div className="bg-white dark:bg-[#0B1F3A] rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-white/10 shadow-sm">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-white/10">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-black text-[#0B1F3A] dark:text-white">
                        ثالثاً: البيانات التفصيلية للمتجر والعنوان
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        تُستخدم هذه البيانات في دليل المتاجر وصفحة المتجر الخاصة بك عند مسح باركود الطاولات أو الكاشير
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-2">
                        اسم المتجر التجاري <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <StoreIcon className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={storeName}
                          onChange={(e) => setStoreName(e.target.value)}
                          placeholder="مثال: كافيه أرابيكا المختص"
                          className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-bold text-[#0B1F3A] dark:text-white focus:outline-none focus:border-[#007BFF]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-2">
                        تصنيف ونوع المتجر <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={storeCategory}
                        onChange={(e) => setStoreCategory(e.target.value as StoreCategory)}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-bold text-[#0B1F3A] dark:text-white focus:outline-none focus:border-[#007BFF]"
                      >
                        {STORE_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-2">
                        الدولة والعملة المعتمدة <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={storeCurrency}
                        onChange={(e) => {
                          const nextCurr = e.target.value as MarketCurrency;
                          setStoreCurrency(nextCurr);
                          setStoreCity(nextCurr === 'EGP' ? 'القاهرة' : 'الرياض');
                          setStoreArea(nextCurr === 'EGP' ? 'التجمع الخامس' : 'العليا');
                        }}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-bold text-[#0B1F3A] dark:text-white focus:outline-none focus:border-[#007BFF]"
                      >
                        <option value="SAR">السعودية — ريال سعودي (SAR)</option>
                        <option value="EGP">مصر — جنيه مصري (EGP)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-2">
                        المدينة <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={storeCity}
                        onChange={(e) => setStoreCity(e.target.value)}
                        placeholder={storeCurrency === 'EGP' ? 'القاهرة / الإسكندرية' : 'الرياض / جدة / الدمام'}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-bold text-[#0B1F3A] dark:text-white focus:outline-none focus:border-[#007BFF]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-2">
                        الحي / المنطقة <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={storeArea}
                        onChange={(e) => setStoreArea(e.target.value)}
                        placeholder={storeCurrency === 'EGP' ? 'المعادي / التجمع / الشيخ زايد' : 'العليا / الملقا / الروضة'}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-bold text-[#0B1F3A] dark:text-white focus:outline-none focus:border-[#007BFF]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-2">
                        العنوان التفصيلي <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={storeAddress}
                          onChange={(e) => setStoreAddress(e.target.value)}
                          placeholder="اسم الشارع أو المركز التجاري ورقم المبنى"
                          className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-bold text-[#0B1F3A] dark:text-white focus:outline-none focus:border-[#007BFF]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-2">
                        مواعيد العمل اليومية
                      </label>
                      <div className="relative">
                        <Clock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={workingHours}
                          onChange={(e) => setWorkingHours(e.target.value)}
                          placeholder="يومياً 9:00 ص - 11:30 م"
                          className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-bold text-[#0B1F3A] dark:text-white focus:outline-none focus:border-[#007BFF]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-2">
                        رقم السجل التجاري / الوثيقة (اختياري)
                      </label>
                      <div className="relative">
                        <FileText className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          dir="ltr"
                          value={commercialReg}
                          onChange={(e) => setCommercialReg(e.target.value)}
                          placeholder="1010XXXXXX"
                          className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-mono font-bold text-[#0B1F3A] dark:text-white focus:outline-none focus:border-[#007BFF]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-2">
                        رابط موقع المتجر على خرائط Google (اختياري)
                      </label>
                      <div className="relative">
                        <Globe className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="url"
                          dir="ltr"
                          value={googleMapLink}
                          onChange={(e) => setGoogleMapLink(e.target.value)}
                          placeholder="https://maps.google.com/..."
                          className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-mono text-[#0B1F3A] dark:text-white focus:outline-none focus:border-[#007BFF]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-2">
                        كلمة مرور Wi-Fi للضيوف (اختياري)
                      </label>
                      <div className="relative">
                        <Wifi className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          dir="ltr"
                          value={wifiPassword}
                          onChange={(e) => setWifiPassword(e.target.value)}
                          placeholder="GuestWifi2026"
                          className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-mono text-[#0B1F3A] dark:text-white focus:outline-none focus:border-[#007BFF]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-2">
                        حساب إنستغرام أو التواصل الاجتماعي (اختياري)
                      </label>
                      <div className="relative">
                        <Instagram className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          dir="ltr"
                          value={instagramUrl}
                          onChange={(e) => setInstagramUrl(e.target.value)}
                          placeholder="https://instagram.com/yourstore"
                          className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-mono text-[#0B1F3A] dark:text-white focus:outline-none focus:border-[#007BFF]"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2 lg:col-span-3">
                      <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-2">
                        نبذة تعريفية عن المتجر وما يقدمه للعملاء
                      </label>
                      <textarea
                        rows={3}
                        value={storeDescription}
                        onChange={(e) => setStoreDescription(e.target.value)}
                        placeholder="اكتب وصفاً مختصراً عن المتجر، المنتجات المميزة، وأجواء المكان ليظهر للعملاء في صفحة المتجر..."
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-medium text-[#0B1F3A] dark:text-white focus:outline-none focus:border-[#007BFF]"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Step 1 Submit Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-[#0B1F3A] p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {accountType === 'MERCHANT_OWNER' ? (
                  <span>
                    الخطوة التالية: <strong className="text-[#0B1F3A] dark:text-white">اختيار الباقة وإرسال طلب التفعيل عبر واتساب</strong>
                  </span>
                ) : (
                  <span>سيتم تفعيل محفظة النقاط الرقمية الخاصة بك فوراً</span>
                )}
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#007BFF] hover:bg-blue-600 text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
              >
                <span>
                  {accountType === 'MERCHANT_OWNER'
                    ? 'حفظ البيانات والانتقال لاختيار الباقة'
                    : isSubmitting
                    ? 'جاري إنشاء الحساب...'
                    : 'إنشاء حساب العميل والدخول فوراً'}
                </span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: CHOOSE PACKAGE & SEND TO WHATSAPP */}
        {step === 2 && accountType === 'MERCHANT_OWNER' && (
          <div className="space-y-8">
            <div className="bg-white dark:bg-[#0B1F3A] rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-white/10 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-white/10">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-black text-[#007BFF] mb-1">
                    <Sparkles className="w-4 h-4" />
                    الخطوة الثانية من التسجيل
                  </span>
                  <h2 className="text-lg sm:text-xl font-black text-[#0B1F3A] dark:text-white">
                    اختر الباقة المناسبة لمتجرك ({storeName})
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    ستحصل فوراً على تجربة مجانية لمدة {trialDaysConfig} يوماً، وسيتم إرسال طلب الباقة إلى مدير النظام عبر واتساب للتفعيل الرسمي
                  </p>
                </div>

                {/* Monthly / Annual Billing Toggle */}
                <div className="inline-flex items-center bg-slate-100 dark:bg-white/5 p-1.5 rounded-xl border border-slate-200 dark:border-white/10 self-start">
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all ${
                      billingCycle === 'monthly'
                        ? 'bg-white dark:bg-[#0B1F3A] text-[#0B1F3A] dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    اشتراك شهري
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('annual')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                      billingCycle === 'annual'
                        ? 'bg-[#007BFF] text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <span>سنوي</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400 text-[#0B1F3A] font-black">
                      وفر {annualDiscountPercent}%
                    </span>
                  </button>
                </div>
              </div>

              {/* Packages Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {visiblePackages.map((pkg) => {
                  const isSelected = selectedPlan === pkg.name;
                  const basePrice =
                    storeCurrency === 'EGP'
                      ? pkg.monthlyPriceEgp || Math.round(pkg.monthlyPrice * 12)
                      : pkg.monthlyPrice;
                  const displayPrice =
                    billingCycle === 'annual' && basePrice > 0
                      ? Math.round(basePrice * (1 - annualDiscountPercent / 100))
                      : basePrice;
                  return (
                    <div
                      key={pkg.name}
                      onClick={() => setSelectedPlan(pkg.name)}
                      className={`cursor-pointer rounded-2xl p-6 border-2 transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#007BFF] bg-[#007BFF]/5 dark:bg-[#007BFF]/15 shadow-md'
                          : 'border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-white/5 hover:border-slate-300 dark:hover:border-white/20'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div>
                            <h3 className="text-base font-black text-[#0B1F3A] dark:text-white">
                              {pkg.name}
                            </h3>
                            <p className="text-[11px] font-bold text-slate-400">{pkg.title}</p>
                          </div>
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                              isSelected
                                ? 'bg-[#007BFF] border-[#007BFF] text-white'
                                : 'border-slate-300 dark:border-white/20'
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </div>
                        </div>

                        <div className="my-4 pb-4 border-b border-slate-200/70 dark:border-white/10">
                          {displayPrice === 0 ? (
                            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                              مجانية
                            </p>
                          ) : (
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-3xl font-black font-mono tabular-nums text-[#0B1F3A] dark:text-white">
                                {displayPrice.toLocaleString('en-US')}
                              </span>
                              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                {storeCurrency === 'EGP' ? 'ج.م' : 'ر.س'} / شهرياً
                              </span>
                            </div>
                          )}
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                            تشمل تجربة مجانية لمدة {trialDaysConfig} يوماً قبل الدفع
                          </p>
                        </div>

                        <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 mb-5">
                          {pkg.features.map((feat, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#007BFF] shrink-0 mt-0.5" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedPlan(pkg.name as SubscriptionPlanName)}
                        className={`w-full py-2.5 rounded-xl text-xs font-black transition-all ${
                          isSelected
                            ? 'bg-[#007BFF] text-white'
                            : 'bg-white dark:bg-[#0B1F3A] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10'
                        }`}
                      >
                        {isSelected ? 'الباقة المختارة حالياً ✓' : 'اختيار هذه الباقة'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Optional note for Admin on WhatsApp */}
              <div className="mt-6 pt-6 border-t border-slate-100 dark:border-white/10">
                <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-2">
                  ملاحظات إضافية لمدير النظام في رسالة الواتساب (اختياري)
                </label>
                <input
                  type="text"
                  value={whatsappNotes}
                  onChange={(e) => setWhatsappNotes(e.target.value)}
                  placeholder="مثال: نرغب في تفعيل الباقة السنوية مع ربط فرعين..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-medium text-[#0B1F3A] dark:text-white focus:outline-none focus:border-[#007BFF]"
                />
              </div>
            </div>

            {/* Step 2 Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-[#0B1F3A] p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full sm:w-auto px-5 py-3.5 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-black text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-center gap-2"
              >
                <ArrowRight className="w-4 h-4" />
                <span>تعديل بيانات المالك أو المتجر</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleRegisterMerchantAccount}
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
              >
                <MessageCircle className="w-5 h-5" />
                <span>
                  {isSubmitting
                    ? 'جاري إنشاء المتجر وتجهيز طلب الواتساب...'
                    : `تأكيد الباقة (${selectedPkg?.name || selectedPlan}) والمتابعة لإرسال الواتساب`}
                </span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: WHATSAPP SEND & RETURN TO FREE TRIAL PORTAL */}
        {step === 3 && registeredData && (
          <div className="bg-white dark:bg-[#0B1F3A] rounded-2xl p-6 sm:p-10 border border-slate-200 dark:border-white/10 shadow-sm space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                    تم إنشاء حساب المالك والمتجر بنجاح!
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-[#0B1F3A] dark:text-white mt-0.5">
                    إرسال طلب الباقة للواتساب وبدء التجربة المجانية ({registeredData.trialDays} يوماً)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    تم تسجيل طلبك لدى مدير النظام، أرسل رسالة الواتساب الآن لتأكيد التفعيل وابدأ استخدام لوحة متجرك فوراً
                  </p>
                </div>
              </div>
              {storeLogo && (
                <img
                  src={storeLogo}
                  alt={storeName}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-200 dark:border-white/15 shrink-0"
                />
              )}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
                <p className="text-[11px] font-bold text-slate-400 mb-1">بيانات المالك والحساب</p>
                <p className="text-sm font-black text-[#0B1F3A] dark:text-white">
                  {firstName} {lastName}
                </p>
                <p className="text-xs font-mono text-slate-500 dark:text-slate-300 mt-1">{phone}</p>
                <p className="text-xs font-mono text-slate-500 dark:text-slate-300">{email}</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
                <p className="text-[11px] font-bold text-slate-400 mb-1">المتجر المسجل</p>
                <p className="text-sm font-black text-[#0B1F3A] dark:text-white">
                  {storeName} ({storeCategory})
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
                  {storeCity} — {storeArea}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-300 truncate">{storeAddress}</p>
              </div>

              <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-500/10 border border-amber-300/60 dark:border-amber-500/30">
                <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 mb-1">
                  الباقة والفترة التجريبية
                </p>
                <p className="text-sm font-black text-[#0B1F3A] dark:text-white">
                  باقة {selectedPkg?.name || selectedPlan} ({billingCycle === 'annual' ? 'سنوي' : 'شهري'})
                </p>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  تجربة مجانية مفعّلة لمدة {registeredData.trialDays} يوماً
                </p>
                <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                  بانتظار الموافقة والتفعيل اليدوي من مدير النظام
                </p>
              </div>
            </div>

            {/* WhatsApp Preview Box */}
            <div className="p-5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  معاينة رسالة طلب الباقة الجاهزة للإرسال عبر واتساب مدير النظام ({cleanWhatsappNumber}+)
                </span>
                {whatsappSent && (
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                    تم فتح واتساب لإرسال الطلب ✓
                  </span>
                )}
              </div>
              <pre className="whitespace-pre-wrap text-xs font-sans bg-white dark:bg-[#0B1F3A] p-4 rounded-xl border border-emerald-200/70 dark:border-white/10 text-slate-700 dark:text-slate-200 leading-relaxed">
                {whatsappMessageLines}
              </pre>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setWhatsappSent(true)}
                  className="py-4 px-6 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-500/20 transition-all"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>1. إرسال طلب الباقة عبر واتساب الآن</span>
                  <ExternalLink className="w-4 h-4" />
                </a>

                <button
                  type="button"
                  onClick={handleEnterTrialPortal}
                  className="py-4 px-6 rounded-xl bg-[#0B1F3A] dark:bg-[#007BFF] hover:bg-slate-800 dark:hover:bg-blue-600 text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-lg transition-all"
                >
                  <ShieldCheck className="w-5 h-5 text-[#FFC107]" />
                  <span>2. الدخول للوحة المتجر وبدء التجربة المجانية الآن</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
