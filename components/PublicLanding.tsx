'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { handleSectionHrefClick, scrollToSectionById } from '@/lib/scrollToSection';
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BarChart3,
  Check,
  ChevronDown,
  Clock,
  Compass,
  CreditCard,
  ExternalLink,
  Gift,
  Globe,
  Handshake,
  Image as ImageIcon,
  Layers,
  Lock,
  MapPin,
  Megaphone,
  MessageCircle,
  Percent,
  Phone,
  QrCode,
  Rocket,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Store as StoreIcon,
  Ticket,
  TrendingUp,
  Users,
  Wifi,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { INITIAL_SITE_SETTINGS } from '@/lib/mockData';
import type {
  SiteSettings,
  Store as StoreType,
  SubscriptionPackage,
  SubscriptionPlanName,
  UserRole,
} from '@/lib/types';
import { SupportedPricingCurrency } from '@/lib/pricingPlans';
import PricingSection from './PricingSection';
import PublicFooter from './PublicFooter';
import StoreDetailModal from './StoreDetailModal';
import WhatsappRequestModal from './WhatsappRequestModal';

interface PublicLandingProps {
  stores: StoreType[];
  packages?: SubscriptionPackage[];
  siteSettings?: SiteSettings;
  currency?: SupportedPricingCurrency;
  activePublicPage?: 'home' | 'merchant' | 'visitor';
  onNavigatePublicPage?: (page: 'home' | 'merchant' | 'visitor', anchorId?: string) => void;
  onCurrencyChange?: (next: SupportedPricingCurrency) => void;
  joinedStoreIds?: string[];
  onJoinLoyalty?: (store: StoreType) => void;
  onOpenAuthModal: (
    roleHint?: UserRole,
    options?: {
      mode?: 'login' | 'register_merchant';
      planName?: SubscriptionPlanName;
      billingCycle?: 'monthly' | 'annual';
    }
  ) => void;
  onRequestAddStore: (storeName: string, city: string) => void;
  onWelcomePass?: () => void;
}

const PARTNER_LOGOS = [
  { name: 'محمصة كيان المختصة', tag: 'SPECIALTY COFFEE' },
  { name: 'بيسترو المعادي', tag: 'ARTISAN BISTRO' },
  { name: 'أثر للقهوة المختصة', tag: 'ROASTERY & CAFE' },
  { name: 'كافيه أورا التخصصي', tag: 'LOUNGE & ESPRESSO' },
  { name: 'مخبز لافندر الحرفي', tag: 'ARTISAN BAKERY' },
  { name: 'سيركل كافيه', tag: 'SPECIALTY BREW' },
  { name: 'مطاعم الذواقة', tag: 'FINE DINING' },
];

const FAQ_ITEMS = [
  {
    q: 'هل يحتاج العميل أو التاجر لتحميل أي تطبيق؟',
    a: 'إطلاقاً. منصة عادة باس هي تطبيق ويب سحابي 100% يعمل مباشرة عبر رابط ويب واحد من أي متصفح على الهاتف أو الكمبيوتر بدون تحميل أي تطبيقات.',
  },
  {
    q: 'كيف تعمل شبكة الخصومات المتبادلة بين المتاجر؟',
    a: 'تتيح شبكة عادة باس للمتاجر المشتركة تبادل العروض والنقاط ضمن حدود وسقوف محددة، مما يمنح الزبون خصومات متبادلة ويجلب لمتجرك عملاء جدد من المتاجر المجاورة.',
  },
  {
    q: 'ما الذي يحصل عليه التاجر عند تسجيل متجره؟',
    a: 'يحصل التاجر فوراً على صفحة ويب ترويجية خاصة بعلامته التجارية تعرض صور وديكور المكان، المنيو، العروض، والموقع الجغرافي، بالإضافة إلى لوحة تحكم سحابية متصلة بالإنترنت دائماً لإدارة البطاقات والنقاط والقسائم والعملاء.',
  },
  {
    q: 'هل يمكن للمتجر إضافة صور لديكور المكان والجلسات؟',
    a: 'نعم! يتيح قسم (الإعدادات وملف المتجر) لأصحاب الكافيهات والمطاعم رفع صور ديكور المكان والجلسات الداخلية والخارجية لتظهر بشكل جذاب للزوار في صفحة المتجر ودليل المتاجر.',
  },
];

const MERCHANT_PORTAL_FEATURES = [
  {
    emoji: '🌐',
    icon: Globe,
    title: 'صفحة ويب خاصة بك + معرض صور المكان:',
    description: 'واجهة ترويجية أنيقة لمطعمك أو مقهاك تعرض صور وديكور المكان، المنيو، وموقعك الجغرافي لجميع زوار المنصة.',
  },
  {
    emoji: '🧲',
    icon: Users,
    title: 'اكتساب عملاء جدد:',
    description: 'استفد من "شبكة عادة باس"؛ زبون المطعم المجاور سيشاهد عروضك ويأتيك!',
  },
  {
    emoji: '🎁',
    icon: Gift,
    title: 'عروض وخصومات مرنة:',
    description: 'أطلق حملات ترويجية وقسائم عامة أو لعملاء محددين، وامنح عملاءك نقاطاً لضمان عودتهم.',
  },
  {
    emoji: '🔒',
    icon: Lock,
    title: 'رقمي، آمن، ومباشر:',
    description: 'نظام سحابي متصل بالإنترنت دائماً، محمي بالكامل، ولا يحتاج عميلك لتحميل أي شيء.',
  },
];

const CUSTOMER_PORTAL_FEATURES = [
  {
    emoji: '📍',
    icon: Compass,
    title: 'اكتشف ما حولك وشاهد أجواء المكان:',
    description: 'تصفح المطاعم والكافيهات المشتركة، شاهد صور ديكور وجلسات المكان والمنيو، واختر وجهتك القادمة بسهولة.',
  },
  {
    emoji: '🤝',
    icon: Handshake,
    title: 'خصومات متبادلة:',
    description: 'نقاطك وعروضك لم تعد محبوسة في مكان واحد؛ استكشف شبكة من الخصومات التي تربط الأماكن ببعضها.',
  },
  {
    emoji: '⚡',
    icon: Zap,
    title: 'بدون تطبيقات مزعجة:',
    description: 'فقط افتح رابط الويب، سجل دخولك، وابدأ في جمع النقاط فوراً من متصفحك.',
  },
];

const HOME_OVERVIEW_STATS = [
  {
    value: '+180',
    label: 'مطعم وكافيه سحابي مشترك',
    sub: 'في مصر والمملكة العربية السعودية',
    icon: StoreIcon,
    tone: 'text-sky-600 dark:text-[#00C2FF] bg-sky-500/10 border-sky-500/20',
  },
  {
    value: '+48,500',
    label: 'زائر نشط عبر رابط الويب',
    sub: 'بدون تحميل أي تطبيقات',
    icon: Users,
    tone: 'text-amber-600 dark:text-[#FBBF24] bg-amber-500/10 border-amber-500/20',
  },
  {
    value: '+68%',
    label: 'نمو الزيارات المتكررة للمتاجر',
    sub: 'بفضل النقاط والخصومات المتبادلة',
    icon: TrendingUp,
    tone: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    value: '< 2 ثانية',
    label: 'سرعة فتح صفحة المتجر والبطاقة',
    sub: 'نظام سحابي آمن ومتصل دائماً',
    icon: Zap,
    tone: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  },
];

const HOME_WORKFLOW_VISUALS = [
  {
    step: '01',
    title: 'موقع ويب مصغر وصور ديكور لكل متجر',
    desc: 'يحصل كل كافيه أو مطعم على رابط ويب خاص يعرض صور وديكور المكان، المنيو التفاعلي، الفروع، وحالة الازدحام المباشرة.',
    stat: '100% واجهة ويب سحابية',
    image: 'https://picsum.photos/seed/aada-cafe-decor-step1/800/500',
    icon: Globe,
  },
  {
    step: '02',
    title: 'مسح باركود الطاولة أو فتح الرابط فوراً',
    desc: 'يمسح الزائر رمز الـ QR المطبوع من المتجر أو يفتح الرابط في متصفح هاتفه ليظهر له ملف المتجر وبطاقة الولاء الرقمية بدون تطبيقات.',
    stat: 'صفر تحميل تطبيقات',
    image: 'https://picsum.photos/seed/aada-qr-scan-step2/800/500',
    icon: QrCode,
  },
  {
    step: '03',
    title: 'احتساب النقاط وتبادل العروض عبر الشبكة',
    desc: 'يكسب العميل النقاط (حسب المبلغ أو النسبة المئوية أو الشرائح) ويستمتع بقسائم الخصم ومشاركة النقاط مع المتاجر الشريكة.',
    stat: '+68% ولاء وتكرار شراء',
    image: 'https://picsum.photos/seed/aada-rewards-network-step3/800/500',
    icon: Handshake,
  },
];

const MERCHANT_MECHANISM_CARDS = [
  {
    badge: '1. الهوية والديكور والمنيو',
    title: 'إبراز صور وديكور مكانك والمنيو الرقمي',
    description:
      'أضف صور الجلسات وديكور الكافيه أو المطعم من داخل الإعدادات وملف المتجر، مع منيو رقمي تفاعلي وصور منيو تحمل شارة «جديد».',
    stat: '+45% جذب للزوار الجدد',
    image: 'https://picsum.photos/seed/merchant-decor-showcase/800/500',
    icon: ImageIcon,
  },
  {
    badge: '2. استوديو البطاقات والـ QR',
    title: 'تصميم أكثر من بطاقة ومراجعتها وطباعتها',
    description:
      'صمّم بطاقات ولاء متعددة (عبر قائمة تصميم البطاقات وقائمة مراجعة البطاقات وطباعتها وتعديلها) واطبع بوستر الـ QR الجاهز للطاولات.',
    stat: 'طباعة بوستر QR بضغطة زر',
    image: 'https://picsum.photos/seed/merchant-card-studio/800/500',
    icon: CreditCard,
  },
  {
    badge: '3. شريط احتساب النقاط والقسائم',
    title: 'احتساب نقاط ذكي (مبلغ / نسبة % / شرائح)',
    description:
      'تحكم في شريط احتساب النقاط (لكل مبلغ = نقاط، أو نسبة مئوية %، أو شرائح من وإلى مبلغ)، وأصدر قسائم لكل العملاء أو لعملاء محددين.',
    stat: '3 أنماط احتساب مرنة',
    image: 'https://picsum.photos/seed/merchant-points-bar/800/500',
    icon: SlidersHorizontal,
  },
  {
    badge: '4. مشاركة النقاط مع متاجر أخرى',
    title: 'تبادل النقاط مع المتاجر الشريكة بسقوف محددة',
    description:
      'اربط متجرك مع متاجر أخرى لتبادل النقاط وحدد عدد النقاط لكل عملية، الحد الأقصى للفاتورة، والسقف الشهري المسموح بكل دقة.',
    stat: 'اكتساب عملاء من المتاجر المجاورة',
    image: 'https://picsum.photos/seed/merchant-partner-share/800/500',
    icon: Share2IconProxy,
  },
];

function Share2IconProxy({ className }: { className?: string }) {
  return <Handshake className={className} />;
}

const VISITOR_JOURNEY_CARDS = [
  {
    step: 'الخطوة 1',
    title: 'تصفح الدليل وشاهد صور ديكور المكان',
    description:
      'استعرض الكافيهات والمطاعم حسب دولتك ومدينتك، شاهد صور الجلسات وديكور المكان وحالة الازدحام قبل الذهاب.',
    stat: 'معاينة حية للمكان والمنيو',
    image: 'https://picsum.photos/seed/visitor-cafe-interior/800/500',
    icon: Compass,
  },
  {
    step: 'الخطوة 2',
    title: 'افتح رابط الويب واجمع النقاط فوراً',
    description:
      'بمجرد مسح باركود المتجر أو فتح الرابط من متصفح هاتفك، تحصل على بطاقة الويب الرقمية وتجمع النقاط والأختام في كل زيارة.',
    stat: 'بدون تحميل أي تطبيق',
    image: 'https://picsum.photos/seed/visitor-web-pass/800/500',
    icon: QrCode,
  },
  {
    step: 'الخطوة 3',
    title: 'استبدل المكافآت واستفد من الشبكة المشتركة',
    description:
      'حوّل نقاطك إلى مشروبات مجانية وقسائم خصم حصرية داخل مطعمك المفضل أو لدى المتاجر الشريكة في شبكة عادة باس.',
    stat: 'توفير يصل إلى 25%',
    image: 'https://picsum.photos/seed/visitor-coffee-reward/800/500',
    icon: Gift,
  },
];

export default function PublicLanding({
  stores,
  packages,
  siteSettings = INITIAL_SITE_SETTINGS,
  currency = 'EGP',
  activePublicPage = 'home',
  onNavigatePublicPage,
  onCurrencyChange,
  joinedStoreIds = [],
  onJoinLoyalty,
  onOpenAuthModal,
  onRequestAddStore,
}: PublicLandingProps) {
  const [selectedStore, setSelectedStore] = useState<StoreType | null>(null);
  const [selectedStoreInitialTab, setSelectedStoreInitialTab] = useState<
    'menu' | 'wallet' | 'branches' | 'gallery'
  >('wallet');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [dismissedHeroAlerts, setDismissedHeroAlerts] = useState<string[]>([]);
  const [localPage, setLocalPage] = useState<'home' | 'merchant' | 'visitor'>(activePublicPage);

  useEffect(() => {
    setLocalPage(activePublicPage);
  }, [activePublicPage]);

  const currentScreen = activePublicPage || localPage;

  const switchScreen = (page: 'home' | 'merchant' | 'visitor', anchorId?: string) => {
    setLocalPage(page);
    if (onNavigatePublicPage) {
      onNavigatePublicPage(page, anchorId);
    } else if (anchorId) {
      setTimeout(() => scrollToSectionById(anchorId), 60);
    } else if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const [waModalState, setWaModalState] = useState<{
    isOpen: boolean;
    mode: 'package' | 'service';
    packageTitle?: string;
    billingCycle?: 'monthly' | 'annual';
    currency?: SupportedPricingCurrency;
    priceSummary?: string;
  }>({
    isOpen: false,
    mode: 'service',
  });

  // Directory filters
  const [cityFilter, setCityFilter] = useState<string>('الكل');
  const [categoryFilter, setCategoryFilter] = useState<string>('الكل');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Reset city filter whenever country currency changes
  useEffect(() => {
    setCityFilter('الكل');
  }, [currency]);

  // Unregistered store modal
  const [unregisteredDialogOpen, setUnregisteredDialogOpen] = useState(false);
  const [suggestName, setSuggestName] = useState('');
  const [suggestCity, setSuggestCity] = useState('الرياض');
  const [suggestSent, setSuggestSent] = useState(false);

  const activeStores = stores.filter((s) => s.status === 'active');

  // Filter stores strictly by the selected country currency (EGP = Egypt, SAR = Saudi Arabia)
  const countryStores = activeStores.filter((s) => s.currency === currency);
  const cities = ['الكل', ...Array.from(new Set(countryStores.map((s) => s.city)))];
  const categories = ['الكل', ...Array.from(new Set(countryStores.map((s) => s.category)))];

  const filteredStores = countryStores.filter((store) => {
    const matchesCity = cityFilter === 'الكل' || store.city === cityFilter;
    const matchesCategory = categoryFilter === 'الكل' || store.category === categoryFilter;
    const q = searchQuery.trim();
    const matchesSearch =
      !q ||
      store.name.includes(q) ||
      store.description.includes(q) ||
      store.area.includes(q) ||
      store.city.includes(q);
    return matchesCity && matchesCategory && matchesSearch;
  });

  const handleOpenStoreModal = (
    store: StoreType,
    tab: 'menu' | 'wallet' | 'branches' | 'gallery' = 'wallet'
  ) => {
    setSelectedStoreInitialTab(tab);
    setSelectedStore(store);
  };

  const handleSuggestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestName.trim()) return;
    onRequestAddStore(suggestName.trim(), suggestCity);
    setSuggestSent(true);
    setSuggestName('');
    setTimeout(() => {
      setSuggestSent(false);
      setUnregisteredDialogOpen(false);
    }, 1400);
  };

  const lastTrackedCurrencyRef = useRef<string | null>(null);

  // Record visitor analytics on landing view
  useEffect(() => {
    const normalizedCurrency = currency === 'SAR' ? 'SAR' : 'EGP';
    if (lastTrackedCurrencyRef.current === normalizedCurrency) return;
    const timer = window.setTimeout(() => {
      lastTrackedCurrencyRef.current = normalizedCurrency;
      const isDesktop = window.innerWidth >= 1024;
      fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pagePath: '/',
          currency: normalizedCurrency,
          device: isDesktop ? 'كمبيوتر' : 'جوال',
          source: 'مباشر',
          visitorType: 'زائر جديد',
        }),
      }).catch(() => {});
    }, 150);
    return () => window.clearTimeout(timer);
  }, [currency]);

  const adminWhatsapp = siteSettings?.adminWhatsappNumber || '966500000000';
  const annualDiscountPercent = siteSettings?.annualDiscountPct ?? 20;
  const trialDays = siteSettings?.trialDays ?? 14;

  const faqList =
    siteSettings?.faqItems && siteSettings.faqItems.length > 0
      ? siteSettings.faqItems
      : FAQ_ITEMS.map((f, idx) => ({ id: `faq-${idx}`, ...f }));

  const heroAlerts = (siteSettings?.announcements || []).filter(
    (a) => a.isActive && a.placement === 'hero_alert' && !dismissedHeroAlerts.includes(a.id)
  );

  const partnerLogos =
    siteSettings?.partnerLogos && siteSettings.partnerLogos.length > 0
      ? siteSettings.partnerLogos
      : PARTNER_LOGOS;

  // Shared FAQ Section Component rendered on Merchant screen, Visitor screen, and Home screen
  const renderSharedFaqSection = (contextLabel: string) => (
    <section id="faq" className="py-12 sm:py-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      <div className="text-center space-y-2">
        <span className="text-xs font-black text-sky-600 dark:text-[#00C2FF] uppercase tracking-wider">
          {contextLabel}
        </span>
        <h2 className="text-2xl sm:text-4xl font-black text-[#0B1F3A] dark:text-white">
          {siteSettings?.faqTitle || 'الأسئلة الشائعة للتجار والزوار'}
        </h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 font-medium">
          إجابات واضحة ومباشرة حول آلية عمل المنصة السحابية للتجار والزوار
        </p>
      </div>

      <div className="space-y-3.5">
        {faqList.map((item, index) => {
          const isOpen = openFaqIndex === index;
          return (
            <div
              key={item.id || item.q}
              className="rounded-2xl glass-card overflow-hidden transition"
            >
              <button
                type="button"
                onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                className="w-full px-6 py-4.5 text-right flex items-center justify-between gap-4 font-black text-sm sm:text-base text-[#0B1F3A] dark:text-white cursor-pointer"
              >
                <span>{item.q}</span>
                <ChevronDown
                  className={`w-5 h-5 text-sky-600 dark:text-[#00C2FF] shrink-0 transition-transform duration-300 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {isOpen && (
                <div className="px-6 pb-5 pt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200/60 dark:border-slate-800/60">
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );

  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col justify-between text-[#0B1F3A] overflow-x-hidden"
    >
      <main>
        {/* تنبيهات وإعلانات الواجهة الرئيسية (Hero Alerts) */}
        {heroAlerts.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 space-y-2.5">
            {heroAlerts.map((alert) => {
              const toneCls =
                alert.colorPreset === 'amber'
                  ? 'bg-amber-50 border-amber-300 text-amber-950'
                  : alert.colorPreset === 'emerald'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : alert.colorPreset === 'rose'
                  ? 'bg-rose-50 border-rose-300 text-rose-950'
                  : 'bg-sky-50 border-sky-300 text-sky-950';

              const IconComp =
                alert.type === 'alert'
                  ? AlertTriangle
                  : alert.type === 'offer'
                  ? Gift
                  : alert.type === 'maintenance'
                  ? Wrench
                  : Megaphone;

              return (
                <div
                  key={alert.id}
                  className={`rounded-2xl border-2 px-4 py-3 shadow-sm flex flex-wrap items-center justify-between gap-3 ${toneCls}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center shrink-0 shadow-2xs">
                      <IconComp className="w-4 h-4 text-amber-500" />
                    </span>
                    <div className="text-xs sm:text-sm">
                      <strong className="font-black ml-1.5">{alert.title}:</strong>
                      <span className="font-medium opacity-95">{alert.message}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mr-auto">
                    {alert.dismissible && (
                      <button
                        type="button"
                        onClick={() =>
                          setDismissedHeroAlerts((prev) => [...prev, alert.id])
                        }
                        className="p-1.5 rounded-full hover:bg-black/5 cursor-pointer"
                        aria-label="إغلاق التنبيه"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* =====================================================================
            الشاشة الأولى المستقلة (1/3): الشاشة الرئيسية التعريفية (HOME SCREEN)
           ===================================================================== */}
        {currentScreen === 'home' && (
          <motion.div
            key="screen-home"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            {/* القسم الأول: الواجهة التعريفية (نظرة عامة على قوة المنصة) */}
            <section id="hero-intro" className="relative overflow-hidden py-10 sm:py-14 lg:py-16">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-24 right-10 w-96 h-96 rounded-full bg-sky-300/20 blur-3xl"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 left-10 w-96 h-96 rounded-full bg-amber-300/20 blur-3xl"
              />

              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
                  {/* Right Column (RTL): Fade-In Up Typography & Dual Screen Buttons */}
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55, ease: 'easeOut' }}
                    className="lg:col-span-6 space-y-6 text-right"
                  >
                    <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-black text-sky-700">
                      <Globe className="w-4 h-4 text-sky-600" />
                      <span>منصة ويب سحابية 100% · بدون تحميل تطبيقات · متصلة بالإنترنت دائماً</span>
                    </div>

                    {/* العنوان الرئيسي (H1) */}
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight text-[#0B1F3A]">
                      حوّل زيارة زبونك..{' '}
                      <span className="text-gradient-logo">لعادة! 🔄</span>
                    </h1>

                    {/* النص الفرعي */}
                    <p className="text-base sm:text-lg lg:text-xl text-slate-600 leading-relaxed font-medium">
                      المنصة الرقمية الأذكى لاكتشاف المطاعم والمقاهي، وبناء برامج ولاء تفاعلية. كل ما تحتاجه هو رابط ويب واحد.. بدون تحميل تطبيقات، بدون تعقيد، وبأعلى درجات الأمان.
                    </p>

                    {/* أزرار الإجراء (CTA): ينقل كل زر إلى شاشة مستقلة تماماً */}
                    <div className="flex flex-wrap items-center gap-3.5 pt-2">
                      <button
                        type="button"
                        onClick={() => switchScreen('merchant')}
                        className="px-6 py-4 rounded-2xl bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] text-sm sm:text-base font-black flex items-center gap-2.5 shadow-lg shadow-amber-500/20 transition transform hover:-translate-y-0.5 cursor-pointer min-h-[48px]"
                      >
                        <StoreIcon className="w-5 h-5" />
                        <span>بوابة التاجر والأسعار 🏪</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => switchScreen('visitor')}
                        className="px-6 py-4 rounded-2xl bg-white hover:bg-sky-50 text-[#0B1F3A] border-2 border-sky-300 text-sm sm:text-base font-black flex items-center gap-2.5 shadow-md shadow-sky-500/10 transition transform hover:-translate-y-0.5 cursor-pointer min-h-[48px]"
                      >
                        <Compass className="w-5 h-5 text-sky-600" />
                        <span>بوابة الزائر والمتاجر 🧑‍🍳</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-bold text-slate-500">
                      <span>رابط ويب موحّد لكل متجر</span>
                      <span aria-hidden="true">·</span>
                      <span>معرض صور وديكور المكان</span>
                      <span aria-hidden="true">·</span>
                      <span>شبكة خصومات متبادلة</span>
                    </div>
                  </motion.div>

                  {/* Left Column (RTL): Bright Light-Mode Interactive Cloud Pass Mockup */}
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.65, delay: 0.1, ease: 'easeOut' }}
                    className="lg:col-span-6 relative flex items-center justify-center"
                  >
                    <motion.div
                      animate={{ y: [0, -10, 0] }}
                      transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
                      className="relative w-full max-w-md mx-auto"
                    >
                      <div className="rounded-[2.4rem] bg-white p-3.5 border-2 border-sky-200/90 shadow-2xl shadow-sky-900/10 relative z-20">
                        <div className="w-24 h-3.5 bg-slate-100 border border-slate-200 rounded-full mx-auto mb-3 flex items-center justify-end px-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        </div>

                        <div className="rounded-t-2xl bg-slate-50 px-3.5 py-2 border border-slate-200 flex items-center justify-between gap-2 text-[11px] text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                          </div>
                          <div
                            dir="ltr"
                            className="flex-1 bg-white border border-sky-200/90 rounded-lg px-2.5 py-1 font-mono text-[10px] text-sky-700 font-bold flex items-center justify-center gap-1.5 truncate shadow-2xs"
                          >
                            <Lock className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>https://aadapass.com/kayan</span>
                          </div>
                          <Globe className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        </div>

                        <div className="rounded-b-[1.9rem] bg-gradient-to-br from-sky-50/90 via-white to-amber-50/80 p-5 text-[#0B1F3A] space-y-4 border-x border-b border-sky-200/80">
                          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] font-black flex items-center justify-center text-sm shadow-sm">
                                ع
                              </div>
                              <div>
                                <div className="text-xs font-black tracking-tight text-[#0B1F3A]">
                                  عادة باس · Aada Pass
                                </div>
                                <div className="text-[10px] text-sky-700 font-bold">
                                  صفحة المتجر الرقمية عبر الويب
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                              متصل سحابياً
                            </span>
                          </div>

                          <div className="p-3.5 rounded-2xl bg-white border border-amber-200/90 shadow-xs space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-[10px] text-amber-700 font-black">
                                  موقع ويب مصغر + صور المكان + منيو
                                </div>
                                <div className="text-sm font-black text-[#0B1F3A]">محمصة كيان المختصة ☕</div>
                              </div>
                              <span className="text-xs font-black text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-xl">
                                450 نقطة
                              </span>
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[10px] text-slate-600 font-bold">
                                <span>تقدم المكافأة عبر رابط الويب</span>
                                <span className="text-amber-700 font-black">5 / 6 زيارات</span>
                              </div>
                              <div className="grid grid-cols-6 gap-1.5">
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <div
                                    key={n}
                                    className="h-7 rounded-lg bg-gradient-gold-cta text-[#0B1F3A] flex items-center justify-center text-xs font-black shadow-2xs"
                                  >
                                    ✓
                                  </div>
                                ))}
                                <div className="h-7 rounded-lg border border-dashed border-sky-400 bg-sky-50/70 text-sky-700 flex items-center justify-center text-xs">
                                  🎁
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white text-[#0B1F3A] rounded-2xl p-3.5 flex items-center justify-between border border-sky-200/90 shadow-sm">
                            <div className="space-y-0.5">
                              <div className="text-[10px] text-slate-500 font-bold">
                                بطاقة الويب السحابية المباشرة
                              </div>
                              <div className="text-xs font-black">تفتح فوراً من أي متصفح</div>
                              <div className="text-[10px] font-mono text-sky-700 font-black">
                                aadapass.com/u/VIP-4829
                              </div>
                            </div>
                            <div className="p-2 rounded-xl bg-sky-50 border border-sky-200">
                              <QrCode className="w-10 h-10 text-sky-700" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                </div>
              </div>
            </section>

            {/* إحصائيات المنصة التوضيحية في الشاشة الرئيسية */}
            <section className="py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {HOME_OVERVIEW_STATS.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div
                      key={stat.label}
                      className="glass-card p-5 rounded-3xl border border-slate-200/90 flex items-start gap-4"
                    >
                      <div
                        className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${stat.tone}`}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-2xl font-black text-[#0B1F3A] font-mono">
                          {stat.value}
                        </div>
                        <div className="text-xs font-black text-[#0B1F3A]">
                          {stat.label}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {stat.sub}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* منظومة البطاقات الثلاثية الذكية (العصب الرئيسي للمنصة) */}
            <section className="py-10 sm:py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
              <div className="text-center max-w-3xl mx-auto space-y-2.5">
                <div className="inline-flex items-center gap-2 text-amber-800 text-xs sm:text-sm font-black">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>العصب الرئيسي لمنصة عادة باس · منظومة الـ 3 بطاقات الذكية</span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-black text-[#0B1F3A]">
                  3 أنواع بطاقات متكاملة للعميل والمتجر والكاشير
                </h2>
                <p className="text-xs sm:text-base text-slate-600 leading-relaxed">
                  صُممت كل بطاقة بأحدث مكتبات الألوان والأشكال والتباعد والأنماط الجاهزة لتُحفظ على الهاتف في ثوانٍ وتعمل بسلاسة تامة عند الكاشير
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Card Type 1: Store Stamp Card */}
                <div className="glass-card rounded-3xl p-6 border border-amber-200/90 flex flex-col justify-between space-y-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-black text-amber-800">
                      <span>النوع الأول · بطاقة أختام المتجر</span>
                      <span className="font-mono font-bold text-slate-400">Store Stamps</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-black text-[#0B1F3A]">
                      بطاقات أختام خاصة بكل متجر ☕✂️
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      مثالية للكافيهات والصالونات والسبا والمخابز. يختار التاجر عدد الأختام المطلوب (من 2 إلى 24 ختم) من بين 18 شكلاً احترافياً جاهزاً، ويحصل العميل على مشروبه أو جلسته المجانية تلقائياً.
                    </p>
                  </div>

                  {/* Mini Visual Stamp Card Preview (Light Mode) */}
                  <div className="rounded-2xl p-4 bg-gradient-to-br from-amber-50 via-orange-50/70 to-white text-[#0B1F3A] border-2 border-amber-200/90 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-amber-700 font-black block">بطاقة أختام القهوة المختصة</span>
                        <span className="text-sm font-black text-[#0B1F3A]">محمصة كيان المختصة</span>
                      </div>
                      <span className="text-sm font-black tabular-nums text-amber-700 bg-white border border-amber-200 px-2.5 py-0.5 rounded-xl">
                        4 / 6 أختام
                      </span>
                    </div>
                    <div className="grid grid-cols-6 gap-1.5">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="h-8 rounded-lg bg-gradient-gold-cta text-[#0B1F3A] font-black text-xs flex items-center justify-center shadow-2xs"
                        >
                          ☕
                        </div>
                      ))}
                      {[5, 6].map((i) => (
                        <div
                          key={i}
                          className="h-8 rounded-lg border border-dashed border-amber-300 bg-white text-slate-500 font-black text-xs flex items-center justify-center"
                        >
                          {i}
                        </div>
                      ))}
                    </div>
                    <div className="text-[11px] text-amber-900 font-bold flex items-center justify-between pt-2 border-t border-amber-200/70">
                      <span>المكافأة: مشروبك السابع مجاناً</span>
                      <span className="font-mono text-[10px] text-emerald-700">جاهزة للهاتف ✓</span>
                    </div>
                  </div>
                </div>

                {/* Card Type 2: Store Points Card */}
                <div className="glass-card rounded-3xl p-6 border border-sky-200/90 flex flex-col justify-between space-y-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-black text-sky-800">
                      <span>النوع الثاني · بطاقة نقاط المتجر</span>
                      <span className="font-mono font-bold text-slate-400">Store Points</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-black text-[#0B1F3A]">
                      بطاقات نقاط خاصة بكل متجر ⭐🛍️
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      محرك حسابي ذكي يدعم 3 أنظمة: نقاط لكل مبلغ محدد، أو نسبة مئوية كاش باك من الفاتورة، أو شرائح إنفاق تصاعدية، مع تحويل فوري لقسائم خصم رقمية عند الكاشير.
                    </p>
                  </div>

                  {/* Mini Visual Points Card Preview (Light Mode) */}
                  <div className="rounded-2xl p-4 bg-gradient-to-br from-sky-50 via-cyan-50/70 to-white text-[#0B1F3A] border-2 border-sky-200/90 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-sky-700 font-black block">بطاقة نقاط المتجر الذهبية</span>
                        <span className="text-sm font-black text-[#0B1F3A]">دار العود والعطور الملكية</span>
                      </div>
                      <span className="text-sm font-black tabular-nums text-sky-700 bg-white border border-sky-200 px-2.5 py-0.5 rounded-xl">
                        180 نقطة
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="w-full h-2.5 rounded-full bg-sky-100 border border-sky-200/60 overflow-hidden">
                        <div className="h-full bg-gradient-electric rounded-full w-4/5" />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-600 font-bold">
                        <span className="text-emerald-700">مؤهل لقسيمة خصم فورية ✓</span>
                        <span>15% نقاط على كل فاتورة</span>
                      </div>
                    </div>
                    <div className="text-[11px] text-sky-900 font-bold flex items-center justify-between pt-2 border-t border-sky-200/70">
                      <span>المكافأة: قسيمة خصم 50 ر.س</span>
                      <span className="font-mono text-[10px] text-emerald-700">حفظ PNG للهاتف ✓</span>
                    </div>
                  </div>
                </div>

                {/* Card Type 3: Account Master VIP Card */}
                <div className="glass-card rounded-3xl p-6 border-2 border-amber-300 flex flex-col justify-between space-y-5 relative overflow-hidden">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-black text-amber-800">
                      <span>النوع الثالث · بطاقة الحساب الشاملة VIP</span>
                      <span className="font-mono font-bold text-amber-600">Account Master</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-black text-[#0B1F3A]">
                      بطاقة الحساب للمشاركة والهدايا والخصومات 👑
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      بطاقة موحدة لحساب العميل تحصل على +15% نقاط إضافية تلقائياً مع كل عملية شراء، وتتيح للعميل مشاركة النقاط مع أي متجر شريك، أو إهداءها لحساب صديق، أو تحويلها لخصم فوري!
                    </p>
                  </div>

                  {/* Mini Visual Account Master Card Preview (Light Mode) */}
                  <div className="rounded-2xl p-4 bg-gradient-to-br from-amber-50/90 via-white to-sky-50/90 text-[#0B1F3A] border-2 border-amber-300 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-amber-700 font-black block">AADA PASS VIP MASTER</span>
                        <span className="text-sm font-black text-[#0B1F3A]">بطاقة الحساب الشاملة</span>
                      </div>
                      <span className="text-sm font-black tabular-nums text-[#0B1F3A] bg-gradient-gold-cta px-2.5 py-0.5 rounded-xl shadow-2xs">
                        350 نقطة VIP
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-[10px] font-black text-center">
                      <div className="py-1.5 px-2 rounded-lg bg-amber-100/80 text-amber-900 border border-amber-200">
                        مشاركة لمتجر
                      </div>
                      <div className="py-1.5 px-2 rounded-lg bg-sky-100/80 text-sky-900 border border-sky-200">
                        إهداء لصديق
                      </div>
                      <div className="py-1.5 px-2 rounded-lg bg-emerald-100/80 text-emerald-900 border border-emerald-200">
                        خصم فوري
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-700 font-bold flex items-center justify-between pt-2 border-t border-amber-200/70">
                      <span className="font-mono text-sky-700">كود: AADA-VIP-8841</span>
                      <span className="font-mono text-[10px] text-emerald-700">تعمل في كل المتاجر ✓</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* شرح آلية عمل الموقع بالصور والأيقونات والإحصائيات */}
            <section className="py-10 sm:py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
              <div className="text-center max-w-3xl mx-auto space-y-2">
                <span className="text-xs font-black text-sky-600">
                  آلية عمل منصة عادة باس بالصور والأرقام
                </span>
                <h2 className="text-2xl sm:text-4xl font-black text-[#0B1F3A]">
                  كيف تربط المنصة بين المتجر والزائر عبر رابط ويب واحد؟
                </h2>
                <p className="text-sm sm:text-base text-slate-600">
                  رحلة رقمية متكاملة تبدأ من صفحة المتجر وديكور المكان وحتى جمع النقاط وتبادل المكافآت
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {HOME_WORKFLOW_VISUALS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.step}
                      className="glass-card rounded-3xl overflow-hidden border border-slate-200/90 flex flex-col justify-between group hover:shadow-xl transition"
                    >
                      <div>
                        <div className="relative h-48 overflow-hidden bg-sky-50">
                          <img
                            src={item.image}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                          <div className="absolute top-3.5 right-3.5 w-10 h-10 rounded-2xl bg-white/95 text-[#0B1F3A] font-black text-sm flex items-center justify-center border border-amber-300 shadow-sm">
                            {item.step}
                          </div>
                          <div className="absolute bottom-3 right-3.5 left-3.5 flex items-center justify-between text-[#0B1F3A]">
                            <span className="text-xs font-black bg-white/95 backdrop-blur-md border border-slate-200 px-3 py-1 rounded-xl shadow-xs">
                              {item.stat}
                            </span>
                            <div className="w-9 h-9 rounded-xl bg-white/95 backdrop-blur-md flex items-center justify-center border border-slate-200 shadow-xs">
                              <Icon className="w-4 h-4 text-sky-600" />
                            </div>
                          </div>
                        </div>

                        <div className="p-6 space-y-2">
                          <h3 className="text-lg font-black text-[#0B1F3A]">
                            {item.title}
                          </h3>
                          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                            {item.desc}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* بطاقتا الانتقال إلى الشاشات المستقلة (شاشة بوابة التاجر & شاشة بوابة الزائر) */}
            <section className="py-10 sm:py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
              <div className="text-center max-w-2xl mx-auto space-y-1.5">
                <h2 className="text-2xl sm:text-3xl font-black text-[#0B1F3A]">
                  اختر بوابتك المستقلة الآن
                </h2>
                <p className="text-xs sm:text-sm text-slate-600">
                  صممنا شاشة مخصصة بالكامل للتاجر (تشمل المميزات وخطط الأسعار) وشاشة مخصصة للزائر (تشمل المزايا ودليل المتاجر)
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gateway Card 1: Merchant Screen (Bright Light Mode) */}
                <div className="rounded-3xl bg-gradient-to-br from-amber-50/80 via-white to-sky-50/50 text-[#0B1F3A] p-6 sm:p-8 border-2 border-amber-300 shadow-xl shadow-amber-500/5 flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    <div className="relative h-48 rounded-2xl overflow-hidden border border-amber-200/80 bg-amber-50">
                      <img
                        src="https://picsum.photos/seed/gateway-merchant-screen/900/500"
                        alt="شاشة بوابة التاجر"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                      <div className="absolute bottom-3 right-4 left-4 flex items-center justify-between">
                        <span className="text-xs font-black bg-white/95 text-amber-800 px-3 py-1 rounded-xl shadow-xs">
                          لأصحاب المطاعم والكافيهات 🏪
                        </span>
                        <span className="text-xs font-black bg-amber-400 text-[#0B1F3A] px-3 py-1 rounded-xl shadow-xs">
                          تشمل خطط الأسعار والباقات
                        </span>
                      </div>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-black text-[#0B1F3A]">
                      بوابة التاجر.. واجهتك الرقمية لجذب المزيد! 📈
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      تعرف على كيفية إنشاء موقع الويب المصغر لمتجرك، إضافة صور وديكور المكان، تصميم وطباعة بطاقات الولاء، شريط احتساب النقاط، ومشاركة النقاط مع المتاجر الشريكة، مع استعراض خطط الأسعار.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => switchScreen('merchant')}
                    className="w-full py-4 px-6 rounded-2xl bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 cursor-pointer transition"
                  >
                    <span>دخول شاشة بوابة التاجر والأسعار 🏪</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>

                {/* Gateway Card 2: Visitor Screen (Bright Light Mode) */}
                <div className="rounded-3xl bg-gradient-to-br from-sky-50/80 via-white to-emerald-50/40 text-[#0B1F3A] p-6 sm:p-8 border-2 border-sky-300 shadow-xl shadow-sky-500/5 flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    <div className="relative h-48 rounded-2xl overflow-hidden border border-sky-200/80 bg-sky-50">
                      <img
                        src="https://picsum.photos/seed/gateway-visitor-screen/900/500"
                        alt="شاشة بوابة الزائر"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                      <div className="absolute bottom-3 right-4 left-4 flex items-center justify-between">
                        <span className="text-xs font-black bg-white/95 text-sky-800 px-3 py-1 rounded-xl shadow-xs">
                          للزوار وعشاق الكافيهات والمطاعم 🧑‍🍳
                        </span>
                        <span className="text-xs font-black bg-sky-600 text-white px-3 py-1 rounded-xl shadow-xs">
                          تشمل دليل المتاجر وصور الأماكن
                        </span>
                      </div>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-black text-[#0B1F3A]">
                      بوابة الزوار.. مطاعمك المفضلة تكافئك! 🍕☕
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      استكشف دليل المطاعم والكافيهات المشتركة في مصر والسعودية، شاهد صور وديكور كل مكان قبل زيارتك، وافتح بطاقة الويب السحابية لجمع النقاط والخصومات المتبادلة.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => switchScreen('visitor')}
                    className="w-full py-4 px-6 rounded-2xl bg-gradient-electric hover:opacity-95 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-sky-500/20 cursor-pointer transition"
                  >
                    <span>دخول شاشة بوابة الزائر ودليل المتاجر 🧑‍🍳</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </section>

            {/* شريط الثقة (Social Proof - Infinite Marquee) */}
            <section className="py-7 border-y border-slate-200/80 bg-white/80 backdrop-blur-md overflow-hidden">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
                <p className="text-center text-xs sm:text-sm font-black text-slate-500">
                  {siteSettings?.marqueeTitle || 'موثوق من رواد قطاع المطاعم والمقاهي لتنمية مبيعاتهم عبر الويب السحابي.'}
                </p>

                <div className="relative w-full overflow-hidden py-1">
                  <div className="animate-marquee-rtl gap-6 items-center">
                    {[...partnerLogos, ...partnerLogos].map((partner, index) => (
                      <div
                        key={`${partner.name}-${index}`}
                        className="px-6 py-3 rounded-2xl border border-slate-200/90 bg-white hover:border-sky-300 transition flex items-center gap-3 shrink-0 shadow-2xs"
                      >
                        <StoreIcon className="w-4 h-4 text-sky-600" />
                        <div>
                          <div className="text-xs font-black text-[#0B1F3A] whitespace-nowrap">
                            {partner.name}
                          </div>
                          <div className="text-[9px] font-mono text-slate-400 tracking-widest">
                            {partner.tag}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* الأسئلة الشائعة في الشاشة الرئيسية */}
            {renderSharedFaqSection('الأسئلة الشائعة حول منصة عادة باس')}
          </motion.div>
        )}

        {/* =====================================================================
            الشاشة الثانية المستقلة (2/3): شاشة بوابة التاجر (MERCHANT SCREEN)
            تحتوي على: شرح بوابة التاجر + صور وأيقونات وإحصائيات التاجر + الأسعار + الأسئلة الشائعة
           ===================================================================== */}
        {currentScreen === 'merchant' && (
          <motion.div
            key="screen-merchant"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45 }}
          >
            {/* القسم الرئيسي لبوابة التاجر (Bright Light Mode Hero Card) */}
            <section
              id="merchant-portal-section"
              className="py-10 sm:py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-hidden"
            >
              <div className="rounded-[2.25rem] bg-gradient-to-br from-white via-sky-50/60 to-amber-50/60 text-[#0B1F3A] p-6 sm:p-10 lg:p-14 border-2 border-amber-200/90 shadow-xl shadow-sky-900/5 relative overflow-hidden">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-20 -right-20 w-80 h-80 rounded-full bg-amber-300/15 blur-3xl"
                />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center relative z-10">
                  {/* Right Column: Merchant Copywriting & 4 Features */}
                  <div className="lg:col-span-7 space-y-6 text-right">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs sm:text-sm font-black text-amber-700 tracking-wide">
                        بوابة التاجر المستقلة · متجرك الرقمي الذكي 🏪
                      </span>
                      <button
                        type="button"
                        onClick={() => switchScreen('home')}
                        className="text-xs font-bold text-sky-600 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>العودة للشاشة الرئيسية</span>
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black leading-tight text-[#0B1F3A]">
                      بوابة التاجر.. واجهتك الرقمية لجذب المزيد! 📈
                    </h1>

                    <p className="text-sm sm:text-base lg:text-lg text-slate-600 leading-relaxed font-medium">
                      ليس مجرد نظام نقاط، بل هو &quot;موقع ويب مصغر&quot; وخاص بعلامتك التجارية يعرض قائمة طعامك (المنيو)، صور وديكور مكانك، عروضك، وموقعك الجغرافي.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      {MERCHANT_PORTAL_FEATURES.map((feat, idx) => (
                        <motion.div
                          key={feat.title}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: idx * 0.08 }}
                          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2 hover:border-amber-400 transition"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl" aria-hidden="true">
                              {feat.emoji}
                            </span>
                            <h3 className="text-sm sm:text-base font-black text-[#0B1F3A]">
                              {feat.title}
                            </h3>
                          </div>
                          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                            {feat.description}
                          </p>
                        </motion.div>
                      ))}
                    </div>

                    <div className="pt-3 flex flex-wrap items-center gap-3.5">
                      <button
                        type="button"
                        onClick={() => onOpenAuthModal('MERCHANT_OWNER', { mode: 'register_merchant' })}
                        className="px-7 py-4 rounded-2xl bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] text-sm sm:text-base font-black flex items-center gap-2.5 shadow-lg shadow-amber-500/20 transition transform hover:scale-[1.02] cursor-pointer min-h-[48px]"
                      >
                        <Rocket className="w-5 h-5" />
                        <span>سجل متجرك الآن 🚀</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => scrollToSectionById('pricing')}
                        className="px-6 py-4 rounded-2xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs sm:text-sm font-black transition cursor-pointer min-h-[48px]"
                      >
                        استعرض خطط الأسعار والباقات ↓
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenAuthModal('MERCHANT_OWNER', { mode: 'login' })}
                        className="px-6 py-4 rounded-2xl bg-white hover:bg-slate-50 text-[#0B1F3A] border border-slate-200 text-xs sm:text-sm font-black transition cursor-pointer min-h-[48px] shadow-2xs"
                      >
                        دخول التجار المسجلين
                      </button>
                    </div>
                  </div>

                  {/* Left Column: Staggered Light Stat Cards */}
                  <div className="lg:col-span-5 space-y-4">
                    <motion.div
                      initial={{ opacity: 0, y: 25 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: 0.1 }}
                      className="p-5 rounded-3xl bg-white border border-sky-200/90 shadow-md flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 shrink-0">
                          <BarChart3 className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-xs text-sky-700 font-bold">الإحصائيات وزيارات موقع المتجر</div>
                          <div className="text-lg font-black text-[#0B1F3A]">+68% نمو الزيارات المتكررة</div>
                          <div className="text-[11px] text-slate-500">منيو رقمي + صور ديكور المكان + خرائط</div>
                        </div>
                      </div>
                      <TrendingUp className="w-7 h-7 text-emerald-600 shrink-0" />
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 25 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: 0.22 }}
                      className="p-5 rounded-3xl bg-white border border-amber-300 shadow-md flex items-center justify-between gap-4 sm:mr-4"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                          <Users className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-xs text-amber-700 font-bold">اكتساب العملاء من شبكة عادة باس</div>
                          <div className="text-lg font-black text-[#0B1F3A]">1,420 عميل مشترك نشط</div>
                          <div className="text-[11px] text-slate-500">عملاء المتاجر المجاورة يكتشفون عروضك تلقائياً</div>
                        </div>
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 25 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: 0.34 }}
                      className="p-5 rounded-3xl bg-white border border-emerald-200/90 shadow-md flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                          <Percent className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-xs text-emerald-700 font-bold">الخصومات ومشاركة النقاط المرنة</div>
                          <div className="text-lg font-black text-[#0B1F3A]">تحكم كامل بالسقوف والنسب</div>
                          <div className="text-[11px] text-slate-500">نظام سحابي آمن ومباشر 100% عبر المتصفح</div>
                        </div>
                      </div>
                      <ShieldCheck className="w-7 h-7 text-sky-600 shrink-0" />
                    </motion.div>
                  </div>
                </div>
              </div>
            </section>

            {/* إحصائيات وأدوات بوابة التاجر بالصور والأيقونات التوضيحية */}
            <section className="py-10 sm:py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
              <div className="text-center max-w-3xl mx-auto space-y-2">
                <span className="text-xs font-black text-sky-600">
                  شرح مصوّر لأدوات مالك ومدير المتجر
                </span>
                <h2 className="text-2xl sm:text-4xl font-black text-[#0B1F3A]">
                  كل ما تحتاجه لإدارة متجرك وبرنامج الولاء في لوحة سحابية واحدة
                </h2>
                <p className="text-sm sm:text-base text-slate-600">
                  أدوات احترافية مصممة خصيصاً للكافيهات والمطاعم والمتاجر لزيادة المبيعات وتكرار الزيارات
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {MERCHANT_MECHANISM_CARDS.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.title}
                      className="glass-card rounded-3xl overflow-hidden border border-slate-200/90 flex flex-col justify-between group hover:shadow-xl transition"
                    >
                      <div>
                        <div className="relative h-52 overflow-hidden bg-sky-50">
                          <img
                            src={card.image}
                            alt={card.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                          <div className="absolute top-3.5 right-3.5 px-3 py-1 rounded-xl bg-white/95 text-[#0B1F3A] text-xs font-black border border-amber-300 shadow-xs">
                            {card.badge}
                          </div>
                          <div className="absolute bottom-3.5 right-4 left-4 flex items-center justify-between text-[#0B1F3A]">
                            <span className="text-xs font-black bg-white/95 backdrop-blur-md border border-emerald-200 text-emerald-800 px-3 py-1 rounded-xl shadow-xs">
                              📊 {card.stat}
                            </span>
                            <div className="w-10 h-10 rounded-2xl bg-white/95 backdrop-blur-md flex items-center justify-center border border-slate-200 shadow-xs">
                              <Icon className="w-5 h-5 text-sky-600" />
                            </div>
                          </div>
                        </div>

                        <div className="p-6 space-y-2">
                          <h3 className="text-lg sm:text-xl font-black text-[#0B1F3A]">
                            {card.title}
                          </h3>
                          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                            {card.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* قسم خطط الأسعار والباقات — خاص بشاشة التاجر */}
            <PricingSection
              currency={currency}
              packages={packages || []}
              headingTitle={siteSettings?.pricingTitle}
              headingSubtitle={siteSettings?.pricingSubtitle}
              defaultAnnualDiscountPct={annualDiscountPercent}
              onCurrencyChange={onCurrencyChange}
              onSelectPlan={(roleHint, planName) => {
                onOpenAuthModal(roleHint || 'MERCHANT_OWNER', {
                  mode: 'register_merchant',
                  planName: planName || 'Growth',
                });
              }}
              onRequestPackageWhatsapp={(pkg) => {
                setWaModalState({
                  isOpen: true,
                  mode: 'package',
                  packageTitle: pkg.title,
                  billingCycle: pkg.billingCycle,
                  currency: pkg.currency,
                  priceSummary: pkg.priceSummary,
                });
              }}
            />

            {/* قسم الأسئلة الشائعة في شاشة التاجر */}
            {renderSharedFaqSection('الأسئلة الشائعة للتجار والزوار')}
          </motion.div>
        )}

        {/* =====================================================================
            الشاشة الثالثة المستقلة (3/3): شاشة بوابة الزائر (VISITOR SCREEN)
            تحتوي على: شرح بوابة الزائر + صور وأيقونات وإحصائيات الزائر + دليل المتاجر + الأسئلة الشائعة
           ===================================================================== */}
        {currentScreen === 'visitor' && (
          <motion.div
            key="screen-visitor"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45 }}
          >
            {/* القسم الرئيسي لبوابة الزائر */}
            <section
              id="customer-portal-section"
              className="py-10 sm:py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-hidden"
            >
              <div className="rounded-[2.25rem] glass-card p-6 sm:p-10 lg:p-14 border-2 border-sky-200/90 shadow-xl relative overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
                  {/* Right Column (Visual Bouncy Animation of Restaurant/Cafe Discount Cards Merging into One Web Link) */}
                  <div className="lg:col-span-5 order-2 lg:order-1">
                    <div className="relative p-6 rounded-3xl bg-gradient-to-br from-sky-50 via-white to-amber-50/70 border border-sky-200 shadow-inner space-y-5">
                      <div className="text-center space-y-1">
                        <span className="text-[11px] font-black text-sky-700">
                          شبكة خصومات المطاعم والكافيهات المتبادلة
                        </span>
                        <h3 className="text-sm font-black text-[#0B1F3A]">
                          عروض متعددة تتجمع في رابط ويب واحد!
                        </h3>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { name: 'محمصة كيان ☕', discount: 'خصم 20%', tone: 'from-amber-400 to-orange-500', delay: 0 },
                          { name: 'بيسترو المعادي 🍕', discount: 'خصم 15%', tone: 'from-sky-500 to-blue-600', delay: 0.1 },
                          { name: 'أثر للقهوة 🥐', discount: '+50 نقطة هدية', tone: 'from-emerald-500 to-teal-600', delay: 0.2 },
                          { name: 'مخبز لافندر 🧁', discount: 'خصم 25%', tone: 'from-rose-500 to-pink-600', delay: 0.3 },
                        ].map((card) => (
                          <motion.div
                            key={card.name}
                            initial={{ scale: 0.75, opacity: 0, y: -20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            whileHover={{ scale: 1.05, rotate: -1 }}
                            transition={{
                              type: 'spring',
                              stiffness: 240,
                              damping: 13,
                              delay: card.delay,
                            }}
                            className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2 text-right"
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={`px-2 py-0.5 rounded-lg bg-gradient-to-r ${card.tone} text-white text-[11px] font-black shadow-2xs`}
                              >
                                % {card.discount}
                              </span>
                              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            </div>
                            <div className="text-xs font-black text-[#0B1F3A]">
                              {card.name}
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      <motion.div
                        animate={{ scale: [1, 1.02, 1] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                        className="p-4 rounded-2xl bg-white text-[#0B1F3A] border-2 border-sky-300 shadow-md text-center space-y-1.5"
                      >
                        <div className="flex items-center justify-center gap-2 text-xs font-black text-amber-700">
                          <Globe className="w-4 h-4 text-sky-600" />
                          <span>نقطة تجمع واحدة في متصفحك بدون تطبيقات</span>
                        </div>
                        <div dir="ltr" className="font-mono text-xs font-black text-sky-700">
                          https://aadapass.com/my-rewards
                        </div>
                      </motion.div>
                    </div>
                  </div>

                  {/* Left Column (RTL): Visitor Copywriting & Features */}
                  <div className="lg:col-span-7 space-y-6 text-right order-1 lg:order-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs sm:text-sm font-black text-sky-700 tracking-wide">
                        بوابة الزائر المستقلة · عالم من العروض في جيبك 🧑‍🍳
                      </span>
                      <button
                        type="button"
                        onClick={() => switchScreen('home')}
                        className="text-xs font-bold text-sky-600 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>العودة للشاشة الرئيسية</span>
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black leading-tight text-[#0B1F3A]">
                      بوابة الزوار.. مطاعمك المفضلة تكافئك! 🍕☕
                    </h1>

                    <p className="text-sm sm:text-base lg:text-lg text-slate-600 leading-relaxed font-medium">
                      لماذا تدفع السعر كاملاً بينما يمكنك استرجاع جزء منه؟ اكتشف أفضل الأماكن، شاهد صور وديكور الكافيهات والمطاعم، اجمع النقاط عبر رابط ويب سريع، واستمتع بخصومات لا تنتهي!
                    </p>

                    <div className="space-y-3.5 pt-1">
                      {CUSTOMER_PORTAL_FEATURES.map((feat, idx) => (
                        <motion.div
                          key={feat.title}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, delay: idx * 0.1 }}
                          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 flex items-start gap-3.5 shadow-2xs"
                        >
                          <span className="text-2xl shrink-0" aria-hidden="true">
                            {feat.emoji}
                          </span>
                          <div className="space-y-1">
                            <h3 className="text-sm sm:text-base font-black text-[#0B1F3A]">
                              {feat.title}
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                              {feat.description}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    <div className="pt-2 flex flex-wrap items-center gap-3.5">
                      <button
                        type="button"
                        onClick={() => scrollToSectionById('directory')}
                        className="px-7 py-4 rounded-2xl bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] text-sm sm:text-base font-black flex items-center gap-2.5 shadow-lg shadow-amber-500/20 transition transform hover:scale-[1.02] cursor-pointer min-h-[48px]"
                      >
                        <Sparkles className="w-5 h-5" />
                        <span>استكشف العروض الآن 🎉</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenAuthModal('CUSTOMER', { mode: 'login' })}
                        className="px-6 py-4 rounded-2xl bg-gradient-electric hover:opacity-95 text-white text-xs sm:text-sm font-black transition cursor-pointer min-h-[48px] shadow-md shadow-sky-500/20"
                      >
                        دخول الزوار واستعراض نقاطي
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* شرح رحلة الزائر بالصور والأيقونات والإحصائيات */}
            <section className="py-8 sm:py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
              <div className="text-center max-w-3xl mx-auto space-y-2">
                <span className="text-xs font-black text-sky-600">
                  كيف تستفيد كزائر في 3 خطوات مصورة؟
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-[#0B1F3A]">
                  شاهد أجواء المكان، افتح الرابط، واكسب المكافآت فوراً
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {VISITOR_JOURNEY_CARDS.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.title}
                      className="glass-card rounded-3xl overflow-hidden border border-slate-200/90 flex flex-col justify-between group hover:shadow-xl transition"
                    >
                      <div>
                        <div className="relative h-48 overflow-hidden bg-sky-50">
                          <img
                            src={card.image}
                            alt={card.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                          <div className="absolute top-3.5 right-3.5 px-3 py-1 rounded-xl bg-white/95 text-sky-700 text-xs font-black border border-sky-200 shadow-xs">
                            {card.step}
                          </div>
                          <div className="absolute bottom-3 right-3.5 left-3.5 flex items-center justify-between text-[#0B1F3A]">
                            <span className="text-xs font-black bg-white/95 backdrop-blur-md border border-amber-200 text-amber-800 px-3 py-1 rounded-xl shadow-xs">
                              ✨ {card.stat}
                            </span>
                            <div className="w-9 h-9 rounded-xl bg-white/95 backdrop-blur-md flex items-center justify-center border border-slate-200 shadow-xs">
                              <Icon className="w-4 h-4 text-amber-600" />
                            </div>
                          </div>
                        </div>

                        <div className="p-6 space-y-2">
                          <h3 className="text-lg font-black text-[#0B1F3A]">
                            {card.title}
                          </h3>
                          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                            {card.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* دليل المتاجر المشتركة — خاص بشاشة الزائر */}
            <section id="directory" className="py-10 sm:py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
              <div className="p-6 sm:p-8 rounded-3xl glass-card space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-black text-sky-700">
                      {currency === 'EGP'
                        ? '🇪🇬 متاجر مصر المشتركة (بالجنيه المصري)'
                        : '🇸🇦 متاجر السعودية المشتركة (بالريال السعودي)'}
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-[#0B1F3A]">
                      {siteSettings?.directoryTitle || 'اكتشف المتاجر المشتركة وصور الأماكن في Aada Pass ✨'}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600">
                      تصفح صفحات الويب الترويجية للمطاعم والمقاهي، شاهد صور وديكور المكان، وادخل صفحة كل متجر لاستعراض المنيو والعروض
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="inline-flex items-center p-1 rounded-2xl bg-slate-100 border border-slate-200 text-xs font-black">
                      <button
                        type="button"
                        onClick={() => onCurrencyChange?.('EGP')}
                        className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
                          currency === 'EGP'
                            ? 'bg-sky-600 text-white shadow-xs'
                            : 'text-slate-600'
                        }`}
                      >
                        🇪🇬 مصر
                      </button>
                      <button
                        type="button"
                        onClick={() => onCurrencyChange?.('SAR')}
                        className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
                          currency === 'SAR'
                            ? 'bg-sky-600 text-white shadow-xs'
                            : 'text-slate-600'
                        }`}
                      >
                        🇸🇦 السعودية
                      </button>
                    </div>

                    <Link
                      href="/stores"
                      className="px-4 py-2.5 rounded-2xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-black transition"
                    >
                      تصفح الدليل الكامل ↗
                    </Link>
                    <button
                      type="button"
                      onClick={() => setUnregisteredDialogOpen(true)}
                      className="px-4 py-2.5 rounded-2xl bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] text-xs font-black cursor-pointer transition shadow-xs"
                    >
                      + اقتراح متجر غير مسجل
                    </button>
                  </div>
                </div>

                {/* Search & Filters Bar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-200/70">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ابحث باسم المتجر، الحي، أو نوع النشاط..."
                      className="w-full pr-10 pl-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-[#0B1F3A] focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400 ml-1">المدينة:</span>
                    {cities.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCityFilter(c)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                          cityFilter === c
                            ? 'bg-sky-600 text-white shadow-xs'
                            : 'bg-white text-[#0B1F3A] border border-slate-200 hover:bg-sky-50'
                        }`}
                      >
                        {c}
                      </button>
                    ))}

                    <span className="text-[11px] font-bold text-slate-400 mr-2 ml-1">التصنيف:</span>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                          categoryFilter === cat
                            ? 'bg-amber-400 text-[#0B1F3A] shadow-xs'
                            : 'bg-white text-[#0B1F3A] border border-slate-200 hover:bg-amber-50'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filteredStores.length === 0 ? (
                <div className="p-10 rounded-3xl glass-card text-center space-y-3">
                  <p className="text-base font-black text-[#0B1F3A]">
                    لا توجد متاجر مطابقة لبحثك في {currency === 'EGP' ? 'مصر' : 'السعودية'}
                  </p>
                  <p className="text-xs text-slate-500">
                    جرب إعادة ضبط فلاتر المدينة والتصنيف، أو بدّل الدولة من الشريط العلوي
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCityFilter('الكل');
                        setCategoryFilter('الكل');
                        setSearchQuery('');
                      }}
                      className="px-5 py-2.5 rounded-xl bg-sky-600 text-white text-xs font-black cursor-pointer"
                    >
                      إعادة ضبط الفلاتر
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredStores.map((store) => {
                    const isJoined = joinedStoreIds.includes(store.id);
                    const firstBranch = store.branches[0];
                    const crowdLabel =
                      firstBranch?.crowdLevel === 'هادئ'
                        ? 'هادئ الآن'
                        : firstBranch?.crowdLevel === 'متوسط'
                        ? 'ازدحام متوسط'
                        : 'مزدحم';

                    return (
                      <div
                        key={store.id}
                        className="rounded-3xl glass-card overflow-hidden border border-slate-200/90 hover:border-sky-400 hover:shadow-xl transition group flex flex-col justify-between"
                      >
                        <div>
                          {/* Cover Banner — Navigates directly into the store web page */}
                          <Link
                            href={`/stores/${store.slug}`}
                            className="block relative h-44 w-full overflow-hidden bg-sky-50"
                          >
                            <img
                              src={store.cover}
                              alt={store.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />

                            {/* Store Identity Overlay */}
                            <div className="absolute bottom-3 right-4 left-4 flex items-end justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <img
                                  src={store.logo}
                                  alt={store.name}
                                  referrerPolicy="no-referrer"
                                  className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-lg bg-white shrink-0"
                                />
                                <div>
                                  <div className="text-[11px] font-bold text-sky-100">
                                    {store.category} · {store.city} — {store.area} · {crowdLabel}
                                  </div>
                                  <h3 className="text-base sm:text-lg font-black text-white leading-snug drop-shadow-xs">
                                    {store.name}
                                  </h3>
                                </div>
                              </div>
                            </div>
                          </Link>

                          {/* Card Body */}
                          <div className="p-5 space-y-4">
                            <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                              {store.description}
                            </p>

                            {/* Store Interior & Decor Gallery Preview Strip */}
                            {store.storeGallery && store.storeGallery.length > 0 && (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                                  <span className="flex items-center gap-1">
                                    <ImageIcon className="w-3.5 h-3.5 text-sky-600" />
                                    <span>صور وديكور المكان ({store.storeGallery.length})</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenStoreModal(store, 'gallery')}
                                    className="text-sky-600 font-black hover:underline cursor-pointer"
                                  >
                                    عرض جميع صور المكان ←
                                  </button>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  {store.storeGallery.slice(0, 3).map((gUrl, idx) => (
                                    <button
                                      key={`${gUrl}-${idx}`}
                                      type="button"
                                      onClick={() => handleOpenStoreModal(store, 'gallery')}
                                      className="relative h-16 rounded-xl overflow-hidden border border-slate-200 cursor-pointer group/img"
                                    >
                                      <img
                                        src={gUrl}
                                        alt={`ديكور ${store.name}`}
                                        referrerPolicy="no-referrer"
                                        className="w-full h-full object-cover group-hover/img:scale-105 transition"
                                      />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Embedded Cloud Web Pass Strip (Light Mode) */}
                            <div className="p-3.5 rounded-2xl bg-gradient-to-l from-amber-50 via-sky-50/70 to-white text-[#0B1F3A] border border-amber-200/90 flex items-center justify-between gap-3 shadow-2xs">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <Globe className="w-3.5 h-3.5 text-amber-600" />
                                  <span className="text-[10px] font-black text-sky-700">
                                    مكافأة صفحة الويب ({store.loyaltyRule.type === 'stamps' ? 'نظام أختام' : 'نظام نقاط'})
                                  </span>
                                </div>
                                <p className="text-xs sm:text-sm font-black text-[#0B1F3A]">
                                  🎁 {store.loyaltyRule.rewardDescription}
                                </p>
                              </div>
                              <span className="text-[10px] font-black text-amber-800 bg-amber-100/80 border border-amber-200 px-2.5 py-1 rounded-xl shrink-0">
                                بطاقة ويب رقمية
                              </span>
                            </div>

                            {/* Store Metadata & Contact Details Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px] font-bold">
                              <div className="p-2.5 rounded-2xl bg-slate-50/90 border border-slate-200/70 flex items-center gap-2 text-slate-700">
                                <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                <span className="truncate">{store.address}</span>
                              </div>
                              <div className="p-2.5 rounded-2xl bg-slate-50/90 border border-slate-200/70 flex items-center gap-2 text-slate-700">
                                <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="truncate">{store.workingHours || 'مفتوح يومياً'}</span>
                              </div>
                              <div className="p-2.5 rounded-2xl bg-slate-50/90 border border-slate-200/70 flex items-center gap-2 text-slate-700">
                                <Phone className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span dir="ltr" className="font-mono truncate">{store.phone}</span>
                              </div>
                              <div className="p-2.5 rounded-2xl bg-slate-50/90 border border-slate-200/70 flex items-center justify-between gap-2 text-slate-700">
                                <span className="flex items-center gap-1.5">
                                  <Wifi className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                  <span>{store.wifiPassword ? 'واي فاي متاح' : `${store.branches.length} فروع معتمدة`}</span>
                                </span>
                                <span className="text-[10px] font-black text-sky-600">
                                  {store.currency === 'SAR' ? '🇸🇦 ر.س' : '🇪🇬 ج.م'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action Footer */}
                        <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-200/70 flex items-center justify-between gap-2">
                          <Link
                            href={`/stores/${store.slug}`}
                            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-electric hover:opacity-95 text-white text-xs font-black transition flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            <span>دخول صفحة المتجر والمنيو</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleOpenStoreModal(store, 'wallet')}
                            className="py-2.5 px-4 rounded-xl bg-white hover:bg-sky-50 text-[#0B1F3A] border border-slate-200 text-xs font-black transition shrink-0 cursor-pointer flex items-center gap-1.5"
                          >
                            <QrCode className="w-3.5 h-3.5 text-sky-600" />
                            <span>{isJoined ? 'بطاقتك' : 'رابط البطاقة'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* قسم الأسئلة الشائعة في شاشة الزائر */}
            {renderSharedFaqSection('الأسئلة الشائعة للزوار والتجار')}
          </motion.div>
        )}
      </main>

      <PublicFooter
        onMerchantLoginClick={() => onOpenAuthModal('MERCHANT_OWNER')}
        onAdminLoginClick={() => onOpenAuthModal('PLATFORM_ADMIN')}
        adminWhatsappNumber={adminWhatsapp}
        footerTagline={siteSettings?.footerTagline}
        footerCopyright={siteSettings?.footerCopyright}
      />

      <StoreDetailModal
        store={selectedStore}
        onClose={() => setSelectedStore(null)}
        isJoined={selectedStore ? joinedStoreIds.includes(selectedStore.id) : false}
        onJoinLoyalty={onJoinLoyalty}
        initialTab={selectedStoreInitialTab}
      />

      {unregisteredDialogOpen && (
        <div
          onClick={() => setUnregisteredDialogOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl glass-card p-6 sm:p-7 space-y-5 relative shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setUnregisteredDialogOpen(false)}
              aria-label="إغلاق"
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 flex items-center justify-center text-slate-600 dark:text-slate-300 absolute top-4 left-4 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1.5 pt-2 text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300 flex items-center justify-center mx-auto mb-2">
                <StoreIcon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-[#0B1F3A] dark:text-white">
                اقتراح إضافة متجر غير مسجل
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                أخبرنا باسم المتجر الذي ترغب بانضمامه إلى شبكة عادة باس السحابية وسنتواصل معه.
              </p>
            </div>

            {suggestSent ? (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300 text-center flex items-center justify-center gap-2">
                <Check className="w-4 h-4" />
                <span>تم استلام اقتراحك بنجاح!</span>
              </div>
            ) : (
              <form onSubmit={handleSuggestSubmit} className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    required
                    value={suggestName}
                    onChange={(e) => setSuggestName(e.target.value)}
                    placeholder="اسم المتجر المقترح..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                  />
                  <input
                    type="text"
                    value={suggestCity}
                    onChange={(e) => setSuggestCity(e.target.value)}
                    placeholder="المدينة..."
                    className="sm:w-32 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-[#0B1F3A] hover:bg-[#10325E] text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>إرسال طلب الإضافة</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <WhatsappRequestModal
        isOpen={waModalState.isOpen}
        onClose={() => setWaModalState((prev) => ({ ...prev, isOpen: false }))}
        adminWhatsappNumber={adminWhatsapp}
        mode={waModalState.mode}
        defaultPackageTitle={waModalState.packageTitle}
        defaultBillingCycle={waModalState.billingCycle}
        defaultCurrency={waModalState.currency || currency}
        defaultPriceSummary={waModalState.priceSummary}
        onRegisterInstead={() => {
          setWaModalState((prev) => ({ ...prev, isOpen: false }));
          onOpenAuthModal('MERCHANT_OWNER', { mode: 'register_merchant' });
        }}
      />
    </div>
  );
}
