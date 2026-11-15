import { MarketCurrency, UserRole } from '@/lib/types';

export const AR_TRANSLATIONS = {
  brand: {
    name: 'Aada Pass',
    arabicName: 'عادة باس',
    slogan: 'حوّل زيارة زبونك.. لعادة.',
    heroHeadlineLine1: 'ولاء عملائك ..',
    heroHeadlineLine2: 'أسهل وأذكى',
    heroDescription:
      'حل رقمي متكامل لإدارة برامج الولاء والمكافآت بكل مرونة عبر بطاقات الويب الرقمية الذكية وبدون الحاجة لتطبيقات. بيانات معزولة لكل متجر وحماية خادم كاملة.',
  },
  nav: {
    home: 'الرئيسية',
    directory: 'دليل المتاجر',
    features: 'المميزات',
    pricing: 'الأسعار',
    faq: 'الأسئلة الشائعة',
    loginOrStart: 'تسجيل الدخول / ابدأ معنا',
    switchAccount: 'تبديل الحساب',
    logout: 'تسجيل الخروج',
    logoutAllDevices: 'خروج من كل الأجهزة',
    publicSite: 'الصفحة العامة',
    lightMode: 'الوضع الفاتح',
    darkMode: 'الوضع الليلي',
  },
  roles: {
    CUSTOMER: 'العميل',
    CASHIER: 'الكاشير',
    MERCHANT_MANAGER: 'مدير الفرع / المتجر',
    MERCHANT_OWNER: 'مالك المتجر',
    PLATFORM_ADMIN: 'المدير العام للمنصة',
    SUPPORT_AGENT: 'وكيل الدعم الفني',
    VISITOR: 'زائر',
  } satisfies Record<UserRole | 'VISITOR', string>,
  markets: {
    launchMarketTitle: 'السوق الأول المعتمد للإطلاق: المملكة العربية السعودية (SAR · +966)',
    currencyLabels: {
      SAR: 'ريال سعودي (ر.س)',
      EGP: 'جنيه مصري (ج.م)',
      AED: 'درهم إماراتي (د.إ)',
    } satisfies Record<MarketCurrency, string>,
  },
  welcome: {
    badge: 'التسجيل السريع في محفظة الولاء',
    title: 'أهلاً بك في بطاقة ولائك الرقمية',
    subtitle: 'أدخل اسمك ورقم جوالك (+966) لإصدار بطاقتك وحفظها في محفظتك فوراً.',
    nameLabel: 'الاسم الكامل',
    namePlaceholder: 'مثال: فهد العتيبي',
    phoneLabel: 'رقم الجوال',
    phonePlaceholder: '+966 50 123 4567',
    ctaButton: 'احصل على بطاقتك',
    successTitle: 'تم إصدار بطاقتك بنجاح!',
  },
  dashboard: {
    title: 'لوحة المؤشرات والأداء',
    visitorCurveTitle: 'منحنى الزوار والزيارات الشرائية الموثقة',
    transactionsTableTitle: 'سجل المعاملات والفواتير',
    kpis: {
      digitalVisitors: 'الزيارات الرقمية للبروفايل',
      verifiedPurchases: 'الزيارات الشرائية الموثقة',
      activeCards: 'مستخدمو البطاقات النشطون',
      periodSales: 'المبيعات الشهرية',
    },
  },
  security: {
    unauthorized: 'غير مصرح: يجب تسجيل الدخول أولاً.',
    forbiddenRole: 'صلاحياتك لا تسمح بتنفيذ هذا الإجراء على الخادم.',
    forbiddenScope: 'عزل البيانات: لا يمكنك الوصول إلى متجر أو فرع خارج نطاق حسابك.',
    rateLimited: 'تم تجاوز الحد المسموح للطلبات. يرجى المحاولة لاحقاً.',
    accountLocked: 'تم قفل الحساب مؤقتاً بسبب محاولات دخول فاشلة متكررة.',
    sessionRevokedAll: 'تم تسجيل الخروج من جميع الأجهزة بنجاح وتحديث رقم نسخة الجلسة.',
  },
} as const;

export function formatCurrency(amount: number, currency: MarketCurrency = 'SAR'): string {
  const unit = currency === 'SAR' ? 'ر.س' : currency === 'EGP' ? 'ج.م' : 'د.إ';
  return `${amount.toLocaleString('en-US')} ${unit}`;
}
