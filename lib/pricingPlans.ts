import type { SubscriptionPackage } from './types';

export type SupportedPricingCurrency = 'EGP' | 'SAR';

export const PREFERRED_CURRENCY_COOKIE = 'preferred_currency';

export const GCC_COUNTRY_CODES = new Set(['SA', 'AE', 'KW', 'QA', 'BH', 'OM']);

/**
 * Maps an ISO-3166 alpha-2 country code to the default display currency:
 * - 'EG' -> 'EGP'
 * - 'SA' or any GCC country -> 'SAR'
 * - Fallback -> 'EGP'
 */
export function detectCurrencyFromCountry(
  countryCode?: string | null
): SupportedPricingCurrency {
  if (!countryCode) return 'EGP';
  const normalized = countryCode.trim().toUpperCase();
  if (normalized === 'EG') return 'EGP';
  if (GCC_COUNTRY_CODES.has(normalized)) return 'SAR';
  return 'EGP';
}

export interface PricingTierConfig {
  id: string;
  key: 'digital_presence' | 'starter' | 'growth';
  planName: SubscriptionPackage['name'];
  title: string;
  subtitle: string;
  badge?: string;
  prices: {
    EGP: number;
    SAR: number;
  };
  customPricing?: boolean;
  maxBranches: number;
  maxStaff: number;
  maxCustomersPerMonth: number;
  loyaltyEnabled: boolean;
  features: string[];
  ctaText: string;
  highlighted?: boolean;
}

export const PRICING_PLANS: Record<
  'digital_presence' | 'starter' | 'growth',
  PricingTierConfig
> = {
  digital_presence: {
    id: 'pkg-viewer',
    key: 'digital_presence',
    planName: 'Viewer',
    title: '📱 باقة التواجد الرقمي (عرض المتجر فقط)',
    subtitle: '(للمتاجر التي ترغب في بطاقة رقمية أنيقة كبديل للورق)',
    prices: {
      EGP: 200,
      SAR: 19,
    },
    maxBranches: 1,
    maxStaff: 1,
    maxCustomersPerMonth: 0,
    loyaltyEnabled: false,
    features: [
      'إصدار بطاقة ويب رقمية ذكية (تُضاف مباشرة للشاشة الرئيسية بدون تطبيقات).',
      'إضافة شعار المتجر (Logo) وتصميم الهوية البصرية.',
      'إضافة المنيو الرقمي (Menu Link) في ظهر الكارت.',
      'إضافة رابط موقع المتجر (Google Maps) وأرقام التواصل.',
      '(هذه الباقة لا تشمل نظام الكاشير أو جمع النقاط).',
    ],
    ctaText: 'ابدأ التواجد الرقمي',
  },
  starter: {
    id: 'pkg-starter',
    key: 'starter',
    planName: 'Starter',
    title: '🥉 باقة الانطلاق',
    subtitle: '(للمقاهي والمتاجر الناشئة التي تريد تفعيل نظام الولاء)',
    prices: {
      EGP: 400,
      SAR: 39,
    },
    maxBranches: 1,
    maxStaff: 3,
    maxCustomersPerMonth: 500,
    loyaltyEnabled: true,
    features: [
      'كل ما في باقة التواجد الرقمي، بالإضافة إلى:',
      'إدارة فرع واحد.',
      'تفعيل نظام الكاشير الذكي لجمع النقاط.',
      'دعم العمل الكامل حتى عند انقطاع الإنترنت.',
      'حتى 500 عميل نشط شهرياً.',
      'دعم فني عبر البريد الإلكتروني.',
    ],
    ctaText: 'ابدأ تجربتك المجانية',
  },
  growth: {
    id: 'pkg-growth',
    key: 'growth',
    planName: 'Growth',
    title: '🌟 باقة النمو (3 فروع)',
    subtitle: '(للعلامات التجارية النشطة التي تبحث عن مضاعفة مبيعاتها)',
    badge: 'الأكثر طلباً',
    prices: {
      EGP: 1000,
      SAR: 99,
    },
    maxBranches: 3,
    maxStaff: 10,
    maxCustomersPerMonth: 0,
    loyaltyEnabled: true,
    highlighted: true,
    features: [
      'كل ما في باقة الانطلاق، بالإضافة إلى:',
      'إدارة حتى 3 فروع.',
      'عدد غير محدود من العملاء النشطين.',
      'صلاحيات متعددة للموظفين (مدير حساب / كاشير لكل فرع).',
      'لوحة إحصائيات وتقارير متقدمة لمتابعة أداء الفروع.',
      'أولوية الدعم الفني عبر الواتساب.',
    ],
    ctaText: 'ابدأ تجربتك المجانية',
  },
};

