import {
  CardPatternStyle,
  CardSpacingPreset,
  LoyaltyRule,
  LoyaltySystemCardCategory,
  PointTier,
  PointsCalcMode,
  StampShape,
} from '@/lib/types';

export type CardTextColorValue = string;

export interface CardColorPreset {
  id: string;
  label: string;
  name: string;
  category: 'داكن فاخر' | 'حيوي مشرق' | 'فاتح أنيق';
  cardColor: string;
  gradient: string;
  cssGradient: string;
  defaultTextColor: CardTextColorValue;
  recommendedTextColor: CardTextColorValue;
  swatchHex: string;
}

const RAW_CARD_COLORS: Array<{
  id: string;
  label: string;
  category: 'داكن فاخر' | 'حيوي مشرق' | 'فاتح أنيق';
  cardColor: string;
  cssGradient: string;
  defaultTextColor: string;
  swatchHex: string;
}> = [
  {
    id: 'royal-navy',
    label: 'كحلي ملكي (Aada Signature)',
    category: 'داكن فاخر',
    cardColor: 'from-[#0B1F3A] via-[#132E57] to-[#1E3A8A]',
    cssGradient: 'linear-gradient(135deg, #0B1F3A 0%, #132E57 50%, #1E3A8A 100%)',
    defaultTextColor: 'text-white',
    swatchHex: '#0B1F3A',
  },
  {
    id: 'amber-roast',
    label: 'قهوة مختصة محمصة',
    category: 'داكن فاخر',
    cardColor: 'from-amber-800 via-amber-900 to-stone-900',
    cssGradient: 'linear-gradient(135deg, #92400E 0%, #78350F 50%, #1C1917 100%)',
    defaultTextColor: 'text-white',
    swatchHex: '#78350F',
  },
  {
    id: 'emerald-oasis',
    label: 'زمردي فاخر',
    category: 'داكن فاخر',
    cardColor: 'from-emerald-700 via-teal-800 to-slate-900',
    cssGradient: 'linear-gradient(135deg, #047857 0%, #115E59 50%, #0F172A 100%)',
    defaultTextColor: 'text-white',
    swatchHex: '#047857',
  },
  {
    id: 'electric-sky',
    label: 'أزرق سماوي كهربائي',
    category: 'حيوي مشرق',
    cardColor: 'from-sky-600 via-blue-700 to-indigo-900',
    cssGradient: 'linear-gradient(135deg, #0284C7 0%, #1D4ED8 50%, #312E81 100%)',
    defaultTextColor: 'text-white',
    swatchHex: '#0284C7',
  },
  {
    id: 'imperial-gold',
    label: 'ذهبي إمبراطوري',
    category: 'حيوي مشرق',
    cardColor: 'from-amber-400 via-yellow-500 to-amber-700',
    cssGradient: 'linear-gradient(135deg, #FBBF24 0%, #EAB308 50%, #B45309 100%)',
    defaultTextColor: 'text-[#0B1F3A]',
    swatchHex: '#F59E0B',
  },
  {
    id: 'velvet-rose',
    label: 'وردي مخملي (بيوتي وسبا)',
    category: 'حيوي مشرق',
    cardColor: 'from-rose-600 via-pink-700 to-purple-900',
    cssGradient: 'linear-gradient(135deg, #E11D48 0%, #BE185D 50%, #581C87 100%)',
    defaultTextColor: 'text-white',
    swatchHex: '#E11D48',
  },
  {
    id: 'obsidian-gold',
    label: 'أسود أوبسيديان VIP',
    category: 'داكن فاخر',
    cardColor: 'from-zinc-900 via-neutral-900 to-stone-950',
    cssGradient: 'linear-gradient(135deg, #18181B 0%, #171717 50%, #0C0A09 100%)',
    defaultTextColor: 'text-amber-300',
    swatchHex: '#18181B',
  },
  {
    id: 'amethyst-crown',
    label: 'بنفسجي ملكي (عطور وأزياء)',
    category: 'داكن فاخر',
    cardColor: 'from-purple-700 via-indigo-800 to-slate-950',
    cssGradient: 'linear-gradient(135deg, #7E22CE 0%, #3730A3 50%, #020617 100%)',
    defaultTextColor: 'text-white',
    swatchHex: '#6D28D9',
  },
  {
    id: 'crimson-flame',
    label: 'ياقوتي ناري (مطاعم وبرجر)',
    category: 'حيوي مشرق',
    cardColor: 'from-red-600 via-rose-700 to-stone-900',
    cssGradient: 'linear-gradient(135deg, #DC2626 0%, #BE123C 50%, #1C1917 100%)',
    defaultTextColor: 'text-white',
    swatchHex: '#DC2626',
  },
  {
    id: 'warm-sand',
    label: 'رملي دافئ (فاتح)',
    category: 'فاتح أنيق',
    cardColor: 'from-amber-100 via-orange-100 to-amber-200',
    cssGradient: 'linear-gradient(135deg, #FEF3C7 0%, #FFEDD5 50%, #FDE68A 100%)',
    defaultTextColor: 'text-[#0B1F3A]',
    swatchHex: '#FDE68A',
  },
  {
    id: 'pearl-ice',
    label: 'لؤلؤي جليدي (فاتح)',
    category: 'فاتح أنيق',
    cardColor: 'from-sky-100 via-white to-indigo-100',
    cssGradient: 'linear-gradient(135deg, #E0F2FE 0%, #FFFFFF 50%, #E0E7FF 100%)',
    defaultTextColor: 'text-[#0B1F3A]',
    swatchHex: '#E0F2FE',
  },
  {
    id: 'mint-breeze',
    label: 'نعناعي منعش (فاتح)',
    category: 'فاتح أنيق',
    cardColor: 'from-emerald-100 via-teal-100 to-cyan-200',
    cssGradient: 'linear-gradient(135deg, #D1FAE5 0%, #CCFBF1 50%, #A5F3FC 100%)',
    defaultTextColor: 'text-emerald-950',
    swatchHex: '#A7F3D0',
  },
  {
    id: 'blush-silk',
    label: 'حرير وردي ناعم (فاتح)',
    category: 'فاتح أنيق',
    cardColor: 'from-rose-100 via-pink-100 to-amber-100',
    cssGradient: 'linear-gradient(135deg, #FFE4E6 0%, #FCE7F3 50%, #FEF3C7 100%)',
    defaultTextColor: 'text-rose-950',
    swatchHex: '#FFE4E6',
  },
  {
    id: 'matcha-zen',
    label: 'ماتشا ياباني',
    category: 'حيوي مشرق',
    cardColor: 'from-lime-700 via-emerald-800 to-teal-950',
    cssGradient: 'linear-gradient(135deg, #4D7C0F 0%, #065F46 50%, #042F2E 100%)',
    defaultTextColor: 'text-white',
    swatchHex: '#3F6212',
  },
  {
    id: 'midnight-cyan',
    label: 'منتصف الليل السياني',
    category: 'داكن فاخر',
    cardColor: 'from-slate-900 via-cyan-950 to-sky-900',
    cssGradient: 'linear-gradient(135deg, #0F172A 0%, #083344 50%, #0C4A6E 100%)',
    defaultTextColor: 'text-cyan-200',
    swatchHex: '#083344',
  },
  {
    id: 'bronze-oud',
    label: 'عود برونزي شرقي',
    category: 'داكن فاخر',
    cardColor: 'from-yellow-800 via-amber-950 to-neutral-950',
    cssGradient: 'linear-gradient(135deg, #854D0E 0%, #451A03 50%, #0A0A0A 100%)',
    defaultTextColor: 'text-amber-200',
    swatchHex: '#713F12',
  },
];

export const CARD_COLOR_LIBRARY: CardColorPreset[] = RAW_CARD_COLORS.map((item) => ({
  ...item,
  name: item.label,
  gradient: item.cardColor,
  recommendedTextColor: item.defaultTextColor,
}));

export interface CardTextColorOption {
  id: string;
  label: string;
  textClass: CardTextColorValue;
  className: CardTextColorValue;
  swatchHex: string;
  forLightBg?: boolean;
}

export const CARD_TEXT_COLOR_OPTIONS: CardTextColorOption[] = [
  { id: 'white', label: 'أبيض ناصع', textClass: 'text-white', className: 'text-white', swatchHex: '#FFFFFF', forLightBg: false },
  { id: 'navy', label: 'كحلي داكن', textClass: 'text-[#0B1F3A]', className: 'text-[#0B1F3A]', swatchHex: '#0B1F3A', forLightBg: true },
  { id: 'gold', label: 'ذهبي لامع', textClass: 'text-amber-300', className: 'text-amber-300', swatchHex: '#FCD34D', forLightBg: false },
  { id: 'sky', label: 'سماوي مضيء', textClass: 'text-sky-200', className: 'text-sky-200', swatchHex: '#BAE6FD', forLightBg: false },
  { id: 'emerald', label: 'زمردي فاتح', textClass: 'text-emerald-200', className: 'text-emerald-200', swatchHex: '#A7F3D0', forLightBg: false },
  { id: 'emerald-dark', label: 'زمردي داكن', textClass: 'text-emerald-950', className: 'text-emerald-950', swatchHex: '#022C22', forLightBg: true },
  { id: 'rose', label: 'وردي داكن', textClass: 'text-rose-950', className: 'text-rose-950', swatchHex: '#4C0519', forLightBg: true },
  { id: 'cyan', label: 'سياني كهربائي', textClass: 'text-[#00C2FF]', className: 'text-[#00C2FF]', swatchHex: '#00C2FF', forLightBg: false },
  { id: 'amber-dark', label: 'عنبر ملكي داكن', textClass: 'text-amber-950', className: 'text-amber-950', swatchHex: '#451A03', forLightBg: true },
];

export const CARD_TEXT_COLOR_LIBRARY: CardTextColorOption[] = CARD_TEXT_COLOR_OPTIONS;

export interface StampShapeOption {
  id: StampShape;
  label: string;
  categoryLabel: string;
  description: string;
}

export const STAMP_SHAPE_OPTIONS: StampShapeOption[] = [
  { id: 'coffee', label: 'كوب قهوة', categoryLabel: 'كافيهات ومشروبات', description: 'كافيهات ومشروبات' },
  { id: 'star', label: 'نجمة ذهبية', categoryLabel: 'عام ومميز', description: 'عام ومميز' },
  { id: 'crown', label: 'تاج ملكي', categoryLabel: 'VIP وفاخر', description: 'VIP وفاخر' },
  { id: 'heart', label: 'قلب', categoryLabel: 'جمال وعناية', description: 'جمال وعناية' },
  { id: 'diamond', label: 'جوهرة ماسية', categoryLabel: 'عطور ومجوهرات', description: 'عطور ومجوهرات' },
  { id: 'utensils', label: 'شوكة وسكين', categoryLabel: 'مطاعم وضيافة', description: 'مطاعم وضيافة' },
  { id: 'scissors', label: 'مقص صالون', categoryLabel: 'صالونات وحلاقة', description: 'صالونات وحلاقة' },
  { id: 'shopping-bag', label: 'حقيبة تسوق', categoryLabel: 'متاجر وأزياء', description: 'متاجر وأزياء' },
  { id: 'gift', label: 'صندوق هدية', categoryLabel: 'مكافآت وهدايا', description: 'مكافآت وهدايا' },
  { id: 'flame', label: 'شعلة حماس', categoryLabel: 'لياقة ومشويات', description: 'لياقة ومشويات' },
  { id: 'sparkles', label: 'بريق لامع', categoryLabel: 'سبا وتجميل', description: 'سبا وتجميل' },
  { id: 'zap', label: 'صاعقة سريعة', categoryLabel: 'طاقة وخدمات', description: 'طاقة وخدمات' },
  { id: 'award', label: 'وسام التميز', categoryLabel: 'نخبة العملاء', description: 'نخبة العملاء' },
  { id: 'check', label: 'علامة صح', categoryLabel: 'كلاسيكي واضح', description: 'كلاسيكي واضح' },
  { id: 'moon', label: 'هلال شرقي', categoryLabel: 'مواسم وضيافة', description: 'مواسم وضيافة' },
  { id: 'shield', label: 'درع الثقة', categoryLabel: 'ضمان وعضويات', description: 'ضمان وعضويات' },
  { id: 'smile', label: 'ابتسامة ترحيب', categoryLabel: 'ترفيه وعائلة', description: 'ترفيه وعائلة' },
  { id: 'leaf', label: 'ورقة طبيعية', categoryLabel: 'منتجات عضوية وصحية', description: 'منتجات عضوية وصحية' },
];

export interface CardSpacingPresetOption {
  id: CardSpacingPreset;
  label: string;
  description: string;
  paddingClass: string;
  gapClass: string;
  stampGridGapClass: string;
  stampSizeClass: string;
}

export const CARD_SPACING_PRESETS: CardSpacingPresetOption[] = [
  {
    id: 'compact',
    label: 'مدمج (Compact)',
    description: 'تباعد متقارب يناسب الشاشات الصغيرة والأختام الكثيرة',
    paddingClass: 'p-4',
    gapClass: 'gap-1.5',
    stampGridGapClass: 'gap-1.5',
    stampSizeClass: 'h-8',
  },
  {
    id: 'normal',
    label: 'قياسي متوازن (Normal)',
    description: 'التباعد المثالي لمعظم الهواتف الذكية',
    paddingClass: 'p-5',
    gapClass: 'gap-2',
    stampGridGapClass: 'gap-2',
    stampSizeClass: 'h-9',
  },
  {
    id: 'relaxed',
    label: 'مريح وواضح (Relaxed)',
    description: 'مساحات تنفس أوسع تبرز الشعار والرصيد بوضوح',
    paddingClass: 'p-6',
    gapClass: 'gap-2.5',
    stampGridGapClass: 'gap-2.5',
    stampSizeClass: 'h-10',
  },
  {
    id: 'spacious',
    label: 'فاخر واسع (Spacious VIP)',
    description: 'تباعد واسع بلمسة البطاقات البنكية البلاتينية',
    paddingClass: 'p-7',
    gapClass: 'gap-3',
    stampGridGapClass: 'gap-3',
    stampSizeClass: 'h-11',
  },
  {
    id: 'ultra',
    label: 'بانورامي عريض (Ultra Studio)',
    description: 'أقصى تباعد وأوضح قراءة للباركود والأختام على جميع الشاشات',
    paddingClass: 'p-7 sm:p-8',
    gapClass: 'gap-3 sm:gap-3.5',
    stampGridGapClass: 'gap-3 sm:gap-3.5',
    stampSizeClass: 'h-11',
  },
];

export interface CardPatternOption {
  id: CardPatternStyle;
  label: string;
  description: string;
  overlayStyle: Record<string, string>;
  cssBackground?: string;
}

export const CARD_PATTERN_PRESETS: CardPatternOption[] = [
  {
    id: 'none',
    label: 'سادة ناعم',
    description: 'تدرج لوني صافي بدون نقوش إضافية',
    overlayStyle: {},
  },
  {
    id: 'dots',
    label: 'نقاط هندسية',
    description: 'نققش نقاط عصري خفيف',
    overlayStyle: {
      backgroundImage: 'radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1px)',
      backgroundSize: '14px 14px',
    },
    cssBackground: 'radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1px)',
  },
  {
    id: 'grid',
    label: 'شبكة تقنية',
    description: 'خطوط شبكية دقيقة',
    overlayStyle: {
      backgroundImage:
        'linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)',
      backgroundSize: '20px 20px',
    },
    cssBackground:
      'linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)',
  },
  {
    id: 'waves',
    label: 'تموجات قطرية',
    description: 'خطوط قطرية تمنح إحساساً بالحركة',
    overlayStyle: {
      backgroundImage:
        'repeating-linear-gradient(45deg, rgba(255,255,255,0.07) 0px, rgba(255,255,255,0.07) 2px, transparent 2px, transparent 10px)',
    },
    cssBackground:
      'repeating-linear-gradient(45deg, rgba(255,255,255,0.07) 0px, rgba(255,255,255,0.07) 2px, transparent 2px, transparent 10px)',
  },
  {
    id: 'luxury',
    label: 'إشعاع ملكي VIP',
    description: 'توهج ذهبي مركزي فخم للبطاقات المميزة',
    overlayStyle: {
      backgroundImage:
        'radial-gradient(circle at 85% 15%, rgba(251,191,36,0.28), transparent 45%), radial-gradient(circle at 15% 85%, rgba(56,189,248,0.22), transparent 45%)',
    },
    cssBackground:
      'radial-gradient(circle at 85% 15%, rgba(251,191,36,0.28), transparent 45%), radial-gradient(circle at 15% 85%, rgba(56,189,248,0.22), transparent 45%)',
  },
  {
    id: 'diamonds',
    label: 'معينات ماسية',
    description: 'نقش هندسي ماسي فاخر يبرز فخامة البطاقة',
    overlayStyle: {
      backgroundImage:
        'linear-gradient(135deg, rgba(255,255,255,0.09) 25%, transparent 25%), linear-gradient(225deg, rgba(255,255,255,0.09) 25%, transparent 25%)',
      backgroundSize: '22px 22px',
    },
    cssBackground:
      'linear-gradient(135deg, rgba(255,255,255,0.09) 25%, transparent 25%), linear-gradient(225deg, rgba(255,255,255,0.09) 25%, transparent 25%)',
  },
  {
    id: 'arabesque',
    label: 'زخرفة عربية ناعمة',
    description: 'نقاط وزوايا مستوحاة من الضيافة العربية الأصيلة',
    overlayStyle: {
      backgroundImage:
        'radial-gradient(circle at center, rgba(251,191,36,0.18) 2px, transparent 2.5px), radial-gradient(circle at 0 0, rgba(255,255,255,0.1) 1.5px, transparent 2px)',
      backgroundSize: '18px 18px',
    },
    cssBackground:
      'radial-gradient(circle at center, rgba(251,191,36,0.18) 2px, transparent 2.5px), radial-gradient(circle at 0 0, rgba(255,255,255,0.1) 1.5px, transparent 2px)',
  },
  {
    id: 'prism',
    label: 'انعكاس كريستالي',
    description: 'تدرج ضوئي متعدد الزوايا كالبطاقات المعدنية',
    overlayStyle: {
      backgroundImage:
        'linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.14) 36%, transparent 52%), radial-gradient(circle at 90% 10%, rgba(255,255,255,0.18), transparent 40%)',
    },
    cssBackground:
      'linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.14) 36%, transparent 52%), radial-gradient(circle at 90% 10%, rgba(255,255,255,0.18), transparent 40%)',
  },
];

export interface ReadyCardTemplate {
  id: string;
  name: string;
  title: string;
  subtitle: string;
  systemTypeLabel: string;
  cardCategory: LoyaltySystemCardCategory;
  badgeText: string;
  description: string;
  cardColor: string;
  cardTextColor: CardTextColorValue;
  cardSpacing: CardSpacingPreset;
  cardPattern: CardPatternStyle;
  cardPatternStyle: CardPatternStyle;
  cardType: 'stamps' | 'points';
  stampsRequired: number;
  stampShape: StampShape;
  pointsCalcMode: PointsCalcMode;
  pointsPerUnit: number;
  currencyUnitAmount: number;
  percentageRate: number;
  rewardTargetPoints: number;
  rewardDescription: string;
  loyaltyRule: LoyaltyRule;
}

const RAW_READY_TEMPLATES: Array<{
  id: string;
  name: string;
  cardCategory: LoyaltySystemCardCategory;
  badgeText: string;
  description: string;
  cardColor: string;
  cardTextColor: string;
  cardSpacing: CardSpacingPreset;
  cardPattern: CardPatternStyle;
  loyaltyRule: LoyaltyRule;
}> = [
  {
    id: 'tpl-cafe-stamps',
    name: 'قالب أختام الكافيهات المختصة',
    cardCategory: 'store_stamps',
    badgeText: 'مشروبك السابع مجاناً ☕',
    description: 'مثالي للمقاهي والمخابز: 6 أختام بتصميم دافئ وأيقونة كوب قهوة.',
    cardColor: 'from-amber-800 via-amber-900 to-stone-900',
    cardTextColor: 'text-white',
    cardSpacing: 'normal',
    cardPattern: 'dots',
    loyaltyRule: {
      type: 'stamps',
      stampsRequired: 6,
      stampShape: 'coffee',
      rewardDescription: 'مشروب قهوة مختصة مجاني عند إكمال 6 أختام',
    },
  },
  {
    id: 'tpl-salon-stamps',
    name: 'قالب أختام الصالونات والسبا',
    cardCategory: 'store_stamps',
    badgeText: 'جلسة عناية مجانية ✨',
    description: 'مصمم لصالونات التجميل والحلاقة والسبا مع أيقونة مقص أو بريق.',
    cardColor: 'from-rose-600 via-pink-700 to-purple-900',
    cardTextColor: 'text-white',
    cardSpacing: 'relaxed',
    cardPattern: 'luxury',
    loyaltyRule: {
      type: 'stamps',
      stampsRequired: 5,
      stampShape: 'scissors',
      rewardDescription: 'جلسة عناية متكاملة مجانية عند الزيارة الخامسة',
    },
  },
  {
    id: 'tpl-restaurant-points',
    name: 'قالب نقاط المطاعم والبرجر',
    cardCategory: 'store_points',
    badgeText: 'كاش باك نقاط فوري 🍔',
    description: 'بطاقة نقاط خاصة بالمتجر تمنح 10 نقاط لكل 20 ريال/جنيه مع شريط تقدم.',
    cardColor: 'from-red-600 via-rose-700 to-stone-900',
    cardTextColor: 'text-white',
    cardSpacing: 'normal',
    cardPattern: 'waves',
    loyaltyRule: {
      type: 'points',
      pointsCalcMode: 'per_amount',
      pointsPerUnit: 10,
      currencyUnitAmount: 20,
      rewardTargetPoints: 100,
      rewardDescription: 'خصم 25 ر.س أو وجبة مجانية عند جمع 100 نقطة',
    },
  },
  {
    id: 'tpl-vip-points',
    name: 'قالب النخبة البلاتيني (نسبة مئوية)',
    cardCategory: 'store_points',
    badgeText: 'عضوية النخبة VIP 👑',
    description: 'بطاقة نقاط فاخرة للمتاجر الكبرى والعطور تمنح 15% من قيمة الفاتورة كنقاط.',
    cardColor: 'from-zinc-900 via-neutral-900 to-stone-950',
    cardTextColor: 'text-amber-300',
    cardSpacing: 'spacious',
    cardPattern: 'luxury',
    loyaltyRule: {
      type: 'points',
      pointsCalcMode: 'percentage',
      percentageRate: 15,
      rewardTargetPoints: 200,
      rewardDescription: 'قسيمة شرائية فاخرة بقيمة 50 ر.س عند بلوغ 200 نقطة',
    },
  },
  {
    id: 'tpl-bakery-stamps',
    name: 'قالب الحلويات والمخبوزات الذهبي',
    cardCategory: 'store_stamps',
    badgeText: 'بوكس حلا مجاني 🎁',
    description: 'تصميم ذهبي فاتح يفتح الشهية لمحلات الحلويات والباتيسري مع 8 أختام.',
    cardColor: 'from-amber-100 via-orange-100 to-amber-200',
    cardTextColor: 'text-[#0B1F3A]',
    cardSpacing: 'relaxed',
    cardPattern: 'arabesque',
    loyaltyRule: {
      type: 'stamps',
      stampsRequired: 8,
      stampShape: 'gift',
      rewardDescription: 'بوكس حلويات مشكل مجاناً بعد 8 أختام',
    },
  },
  {
    id: 'tpl-oud-perfume-points',
    name: 'قالب العود والعطور الشرقية',
    cardCategory: 'store_points',
    badgeText: 'نادي عشاق العود 💎',
    description: 'تصميم برونزي شرقي فاخر بلمسات زخرفية يمنح شرائح نقاط تصاعدية.',
    cardColor: 'from-yellow-800 via-amber-950 to-neutral-950',
    cardTextColor: 'text-amber-200',
    cardSpacing: 'spacious',
    cardPattern: 'diamonds',
    loyaltyRule: {
      type: 'points',
      pointsCalcMode: 'per_amount',
      pointsPerUnit: 15,
      currencyUnitAmount: 25,
      rewardTargetPoints: 150,
      rewardDescription: 'تولة دهن عود ملكي أو خصم 50 ر.س عند جمع 150 نقطة',
    },
  },
  {
    id: 'tpl-fitness-stamps',
    name: 'قالب اللياقة والأندية الصحية',
    cardCategory: 'store_stamps',
    badgeText: 'تحدي الأبطال ⚡',
    description: 'تصميم كاربون رياضي مع أيقونة شعلة أو صاعقة لتحفيز الزيارات المتكررة.',
    cardColor: 'from-zinc-900 via-slate-900 to-cyan-950',
    cardTextColor: 'text-[#00C2FF]',
    cardSpacing: 'normal',
    cardPattern: 'grid',
    loyaltyRule: {
      type: 'stamps',
      stampsRequired: 10,
      stampShape: 'flame',
      rewardDescription: 'أسبوع تدريب إضافي + مشروب بروتين مجاني بعد 10 زيارات',
    },
  },
  {
    id: 'tpl-fashion-points',
    name: 'قالب الأزياء والبوتيكات العصرية',
    cardCategory: 'store_points',
    badgeText: 'مكافآت الأناقة 🛍️',
    description: 'بطاقة نقاط بتدرج بنفسجي ملكي وانعكاس كريستالي لمحلات الأزياء.',
    cardColor: 'from-purple-700 via-indigo-800 to-slate-950',
    cardTextColor: 'text-white',
    cardSpacing: 'relaxed',
    cardPattern: 'prism',
    loyaltyRule: {
      type: 'points',
      pointsCalcMode: 'percentage',
      percentageRate: 12,
      rewardTargetPoints: 120,
      rewardDescription: 'خصم فوري 35 ر.س على التشكيلة الجديدة عند جمع 120 نقطة',
    },
  },
  {
    id: 'tpl-organic-stamps',
    name: 'قالب المتاجر الصحية والماتشا',
    cardCategory: 'store_stamps',
    badgeText: 'حياة صحية متجددة 🌿',
    description: 'تصميم أخضر زمردي هادئ بأيقونة ورقة طبيعية للمتاجر العضوية والماتشا.',
    cardColor: 'from-lime-700 via-emerald-800 to-teal-950',
    cardTextColor: 'text-white',
    cardSpacing: 'normal',
    cardPattern: 'dots',
    loyaltyRule: {
      type: 'stamps',
      stampsRequired: 6,
      stampShape: 'leaf',
      rewardDescription: 'سموذي عضوي أو ماتشا لاتيه مجاناً عند إكمال 6 أختام',
    },
  },
  {
    id: 'tpl-pizza-stamps',
    name: 'قالب أختام البيتزا والمأكولات السريعة',
    cardCategory: 'store_stamps',
    badgeText: 'بيتزا مجانية عند الختم السادس 🍕',
    description: 'قالب مخصص لمتاجر البيتزا والوجبات السريعة مع أيقونة أواني وضيافة.',
    cardColor: 'from-orange-600 via-red-700 to-amber-950',
    cardTextColor: 'text-white',
    cardSpacing: 'normal',
    cardPattern: 'waves',
    loyaltyRule: {
      type: 'stamps',
      stampsRequired: 6,
      stampShape: 'utensils',
      rewardDescription: 'بيتزا متوسطة مجانية عند إكمال 6 أختام',
    },
  },
  {
    id: 'tpl-juice-points',
    name: 'قالب نقاط العصائر والسموذي',
    cardCategory: 'store_points',
    badgeText: 'عصيرك المفضّل علينا 🥤',
    description: 'قالب منعش بمزيج فيروزوي وأزرق لإحصاء نقاط العصائر والمشروبات.',
    cardColor: 'from-teal-500 via-cyan-600 to-blue-800',
    cardTextColor: 'text-white',
    cardSpacing: 'normal',
    cardPattern: 'dots',
    loyaltyRule: {
      type: 'points',
      pointsCalcMode: 'per_amount',
      pointsPerUnit: 10,
      currencyUnitAmount: 15,
      rewardTargetPoints: 80,
      rewardDescription: 'عصير طازج كبير مجاناً عند جمع 80 نقطة',
    },
  },
  {
    id: 'tpl-carwash-stamps',
    name: 'قالب مغاسل السيارات والعناية',
    cardCategory: 'store_stamps',
    badgeText: 'غسلة فاخرة مجانية 🚗',
    description: 'قالب معدني تيتانيوم مخصص لمراكز مغاسل السيارات والعناية بالمركبات.',
    cardColor: 'from-slate-700 via-slate-800 to-zinc-950',
    cardTextColor: 'text-cyan-200',
    cardSpacing: 'spacious',
    cardPattern: 'grid',
    loyaltyRule: {
      type: 'stamps',
      stampsRequired: 5,
      stampShape: 'shield',
      rewardDescription: 'غسلة خارجية وداخلية شاملة مجاناً عند الزيارة الخامسة',
    },
  },
  {
    id: 'tpl-books-points',
    name: 'قالب المكتبات والقرطاسية',
    cardCategory: 'store_points',
    badgeText: 'نادي القراء والمبدعين 📚',
    description: 'قالب هادئ وراقي للمكتبات وبيع الكتب وأدوات الفن.',
    cardColor: 'from-sky-700 via-indigo-900 to-slate-950',
    cardTextColor: 'text-amber-200',
    cardSpacing: 'relaxed',
    cardPattern: 'arabesque',
    loyaltyRule: {
      type: 'points',
      pointsCalcMode: 'percentage',
      percentageRate: 10,
      rewardTargetPoints: 100,
      rewardDescription: 'خصم 30 ر.س على إصدارك القادم عند جمع 100 نقطة',
    },
  },
  {
    id: 'tpl-pets-stamps',
    name: 'قالب متاجر الحيوانات الأليفة',
    cardCategory: 'store_stamps',
    badgeText: 'عناية خاصة بألفتك 🐾',
    description: 'قالب لطيف ومبهج لمستلزمات وعناية الحيوانات الأليفة.',
    cardColor: 'from-emerald-700 via-teal-800 to-stone-900',
    cardTextColor: 'text-white',
    cardSpacing: 'normal',
    cardPattern: 'dots',
    loyaltyRule: {
      type: 'stamps',
      stampsRequired: 6,
      stampShape: 'smile',
      rewardDescription: 'طعام جاف أو جلسة عناية مجانية بعد 6 زيارات',
    },
  },
  {
    id: 'tpl-electronics-points',
    name: 'قالب المتاجر الإلكترونية والتقنية',
    cardCategory: 'store_points',
    badgeText: 'مكافآت الجيكس والتقنية ⚡',
    description: 'قالب كاربون سياني عصري لكسسوارات ومتاجر الهواتف والتقنية.',
    cardColor: 'from-zinc-900 via-slate-900 to-cyan-950',
    cardTextColor: 'text-[#00C2FF]',
    cardSpacing: 'relaxed',
    cardPattern: 'grid',
    loyaltyRule: {
      type: 'points',
      pointsCalcMode: 'per_amount',
      pointsPerUnit: 20,
      currencyUnitAmount: 50,
      rewardTargetPoints: 200,
      rewardDescription: 'سماعة لاسلكية أو كابل شحن سريع هدية عند 200 نقطة',
    },
  },
  {
    id: 'tpl-account-master-vip',
    name: 'قالب بطاقة الحساب الشاملة (VIP Master)',
    cardCategory: 'account_master',
    badgeText: 'بطاقة الحساب الشاملة 👑',
    description: 'النوع الثالث في منظومة عادة باس: نقاط حرة للمشاركة مع المتاجر والإهداء والخصومات.',
    cardColor: 'from-[#0B1F3A] via-[#132E57] to-[#1E3A8A]',
    cardTextColor: 'text-amber-300',
    cardSpacing: 'ultra',
    cardPattern: 'luxury',
    loyaltyRule: {
      type: 'points',
      pointsCalcMode: 'percentage',
      percentageRate: 15,
      rewardTargetPoints: 100,
      rewardDescription: 'نقاط حساب شاملة قابلة للمشاركة مع المتاجر أو الإهداء أو الخصم الفوري',
    },
  },
];

export const CARD_READY_TEMPLATES: ReadyCardTemplate[] = RAW_READY_TEMPLATES.map((tpl) => ({
  ...tpl,
  title: tpl.name,
  subtitle: tpl.description,
  systemTypeLabel:
    tpl.cardCategory === 'store_stamps'
      ? 'النوع 1: أختام المتجر'
      : tpl.cardCategory === 'account_master'
      ? 'النوع 3: بطاقة الحساب الشاملة'
      : 'النوع 2: نقاط المتجر',
  cardPatternStyle: tpl.cardPattern,
  cardType: tpl.loyaltyRule.type,
  stampsRequired: tpl.loyaltyRule.stampsRequired || 6,
  stampShape: tpl.loyaltyRule.stampShape || 'star',
  pointsCalcMode: tpl.loyaltyRule.pointsCalcMode || 'per_amount',
  pointsPerUnit: tpl.loyaltyRule.pointsPerUnit || 10,
  currencyUnitAmount: tpl.loyaltyRule.currencyUnitAmount || 10,
  percentageRate: tpl.loyaltyRule.percentageRate || 10,
  rewardTargetPoints: tpl.loyaltyRule.rewardTargetPoints || 100,
  rewardDescription: tpl.loyaltyRule.rewardDescription || tpl.description,
}));

const EXTRA_CSS_GRADIENTS: Record<string, string> = {
  'from-[#0B1F3A] via-[#10325E] to-[#0284C7]':
    'linear-gradient(135deg, #0B1F3A 0%, #10325E 50%, #0284C7 100%)',
  'from-[#0B1F3A] via-[#10325E] to-[#007BFF]':
    'linear-gradient(135deg, #0B1F3A 0%, #10325E 50%, #007BFF 100%)',
  'from-[#0B1F3A] via-[#13325B] to-[#0284C7]':
    'linear-gradient(135deg, #0B1F3A 0%, #13325B 50%, #0284C7 100%)',
  'from-[#3E2723] via-[#5D4037] to-[#8D6E63]':
    'linear-gradient(135deg, #3E2723 0%, #5D4037 50%, #8D6E63 100%)',
  'from-zinc-900 via-slate-900 to-cyan-950':
    'linear-gradient(135deg, #18181B 0%, #0F172A 50%, #083344 100%)',
  'from-orange-600 via-red-700 to-amber-950':
    'linear-gradient(135deg, #EA580C 0%, #B91C1C 50%, #451A03 100%)',
  'from-teal-500 via-cyan-600 to-blue-800':
    'linear-gradient(135deg, #14B8A6 0%, #0891B2 50%, #1E40AF 100%)',
  'from-slate-700 via-slate-800 to-zinc-950':
    'linear-gradient(135deg, #334155 0%, #1E293B 50%, #09090B 100%)',
  'from-sky-700 via-indigo-900 to-slate-950':
    'linear-gradient(135deg, #0369A1 0%, #312E81 50%, #020617 100%)',
  'from-emerald-700 via-teal-800 to-stone-900':
    'linear-gradient(135deg, #047857 0%, #115E59 50%, #1C1917 100%)',
  'from-rose-950 via-red-900 to-orange-800':
    'linear-gradient(135deg, #4C0519 0%, #7F1D1D 50%, #9A3412 100%)',
  'from-emerald-950 via-teal-900 to-emerald-700':
    'linear-gradient(135deg, #022C22 0%, #134E4A 50%, #047857 100%)',
  'from-purple-950 via-indigo-950 to-fuchsia-900':
    'linear-gradient(135deg, #3B0764 0%, #1E1B4B 50%, #701A75 100%)',
  'from-slate-950 via-zinc-900 to-neutral-800':
    'linear-gradient(135deg, #020617 0%, #18181B 50%, #262626 100%)',
  'from-amber-950 via-stone-900 to-amber-800':
    'linear-gradient(135deg, #451A03 0%, #1C1917 50%, #92400E 100%)',
  'from-sky-500 to-blue-700':
    'linear-gradient(135deg, #0EA5E9 0%, #1D4ED8 100%)',
  'from-emerald-500 to-teal-700':
    'linear-gradient(135deg, #10B981 0%, #0F766E 100%)',
};

const TAILWIND_HEX_STOP_MAP: Record<string, string> = {
  'white': '#FFFFFF',
  'black': '#000000',
  'slate-700': '#334155',
  'slate-800': '#1E293B',
  'slate-900': '#0F172A',
  'slate-950': '#020617',
  'zinc-900': '#18181B',
  'zinc-950': '#09090B',
  'neutral-800': '#262626',
  'neutral-900': '#171717',
  'neutral-950': '#0A0A0A',
  'stone-900': '#1C1917',
  'stone-950': '#0C0A09',
  'amber-100': '#FEF3C7',
  'amber-200': '#FDE68A',
  'amber-400': '#FBBF24',
  'amber-700': '#B45309',
  'amber-800': '#92400E',
  'amber-900': '#78350F',
  'amber-950': '#451A03',
  'yellow-500': '#EAB308',
  'yellow-800': '#854D0E',
  'orange-100': '#FFEDD5',
  'orange-600': '#EA580C',
  'orange-800': '#9A3412',
  'red-600': '#DC2626',
  'red-700': '#B91C1C',
  'red-900': '#7F1D1D',
  'rose-100': '#FFE4E6',
  'rose-600': '#E11D48',
  'rose-700': '#BE123C',
  'rose-950': '#4C0519',
  'pink-100': '#FCE7F3',
  'pink-700': '#BE185D',
  'fuchsia-900': '#701A75',
  'purple-700': '#7E22CE',
  'purple-900': '#581C87',
  'purple-950': '#3B0764',
  'indigo-100': '#E0E7FF',
  'indigo-800': '#3730A3',
  'indigo-900': '#312E81',
  'indigo-950': '#1E1B4B',
  'blue-700': '#1D4ED8',
  'blue-800': '#1E40AF',
  'sky-100': '#E0F2FE',
  'sky-500': '#0EA5E9',
  'sky-600': '#0284C7',
  'sky-700': '#0369A1',
  'sky-900': '#0C4A6E',
  'cyan-200': '#A5F3FC',
  'cyan-600': '#0891B2',
  'cyan-950': '#083344',
  'teal-100': '#CCFBF1',
  'teal-500': '#14B8A6',
  'teal-700': '#0F766E',
  'teal-800': '#115E59',
  'teal-900': '#134E4A',
  'teal-950': '#042F2E',
  'emerald-100': '#D1FAE5',
  'emerald-500': '#10B981',
  'emerald-600': '#059669',
  'emerald-700': '#047857',
  'emerald-800': '#065F46',
  'emerald-950': '#022C22',
  'lime-700': '#4D7C0F',
};

function extractColorStopHex(token: string): string | null {
  const bracketMatch = /\[([#a-zA-Z0-9]+)\]/.exec(token);
  if (bracketMatch) return bracketMatch[1];
  const stripped = token.replace(/^(from|via|to)-/, '');
  return TAILWIND_HEX_STOP_MAP[stripped] || null;
}

export function parseCustomCardGradient(cardColor?: string): { fromHex: string; toHex: string } {
  const raw = (cardColor || '').trim();
  if (raw.startsWith('custom:')) {
    const parts = raw.slice('custom:'.length).split(':').filter(Boolean);
    return {
      fromHex: parts[0] || '#0B1F3A',
      toHex: parts[1] || parts[0] || '#0284C7',
    };
  }
  const matchedPreset = CARD_COLOR_LIBRARY.find((c) => c.gradient === raw);
  if (matchedPreset) {
    const stops = matchedPreset.cssGradient.match(/#[0-9A-Fa-f]{6}/g) || [];
    return {
      fromHex: stops[0] || matchedPreset.swatchHex,
      toHex: stops[stops.length - 1] || matchedPreset.swatchHex,
    };
  }
  if (/^#[0-9A-Fa-f]{3,8}$/.test(raw)) {
    return { fromHex: raw, toHex: '#0B1F3A' };
  }
  const tokens = raw.split(/\s+/);
  const fromTok = tokens.find((t) => t.startsWith('from-'));
  const toTok = tokens.find((t) => t.startsWith('to-'));
  return {
    fromHex: (fromTok && extractColorStopHex(fromTok)) || '#0B1F3A',
    toHex: (toTok && extractColorStopHex(toTok)) || '#0284C7',
  };
}

export function resolveCardCssGradient(cardColor?: string): string {
  const raw = (cardColor || '').trim();
  if (!raw) {
    return 'linear-gradient(135deg, #0B1F3A 0%, #132E57 50%, #1E3A8A 100%)';
  }
  if (raw.startsWith('custom:')) {
    const { fromHex, toHex } = parseCustomCardGradient(raw);
    return `linear-gradient(135deg, ${fromHex} 0%, ${toHex} 100%)`;
  }
  if (/^#[0-9A-Fa-f]{3,8}$/.test(raw)) {
    return `linear-gradient(135deg, ${raw} 0%, #0F172A 100%)`;
  }
  const presetMatch = CARD_COLOR_LIBRARY.find((c) => c.cardColor === raw);
  if (presetMatch) return presetMatch.cssGradient;
  if (EXTRA_CSS_GRADIENTS[raw]) return EXTRA_CSS_GRADIENTS[raw];

  const normalizedClass = resolveCardGradientClass(raw);
  const normalizedPreset = CARD_COLOR_LIBRARY.find((c) => c.cardColor === normalizedClass);
  if (normalizedPreset) return normalizedPreset.cssGradient;
  if (EXTRA_CSS_GRADIENTS[normalizedClass]) return EXTRA_CSS_GRADIENTS[normalizedClass];

  const tokens = normalizedClass.split(/\s+/);
  const fromHex = tokens.find((t) => t.startsWith('from-'))
    ? extractColorStopHex(tokens.find((t) => t.startsWith('from-'))!)
    : null;
  const viaHex = tokens.find((t) => t.startsWith('via-'))
    ? extractColorStopHex(tokens.find((t) => t.startsWith('via-'))!)
    : null;
  const toHex = tokens.find((t) => t.startsWith('to-'))
    ? extractColorStopHex(tokens.find((t) => t.startsWith('to-'))!)
    : null;

  if (fromHex && viaHex && toHex) {
    return `linear-gradient(135deg, ${fromHex} 0%, ${viaHex} 50%, ${toHex} 100%)`;
  }
  if (fromHex && toHex) {
    return `linear-gradient(135deg, ${fromHex} 0%, ${toHex} 100%)`;
  }
  return 'linear-gradient(135deg, #0B1F3A 0%, #132E57 50%, #1E3A8A 100%)';
}

export function resolveCardGradientClass(cardColor?: string): string {
  const raw = (cardColor || '').trim();
  if (!raw) return 'from-[#0B1F3A] via-[#132E57] to-[#1E3A8A]';
  if (raw.startsWith('custom:')) return '';
  if (raw.includes('from-')) return raw;
  if (raw.toUpperCase() === '#0F172A') return 'from-[#0F172A] via-[#1E293B] to-[#334155]';
  if (raw.toUpperCase() === '#1E3A8A') return 'from-[#0B1F3A] via-[#1E3A8A] to-[#0284C7]';

  switch (raw.toLowerCase()) {
    case 'amber':
      return 'from-amber-700 via-amber-800 to-stone-900';
    case 'emerald':
      return 'from-emerald-600 via-teal-700 to-slate-900';
    case 'sky':
    case 'blue':
      return 'from-sky-600 via-blue-700 to-indigo-900';
    case 'rose':
    case 'pink':
      return 'from-rose-600 via-pink-700 to-purple-900';
    case 'purple':
    case 'indigo':
      return 'from-purple-700 via-indigo-800 to-slate-900';
    case 'slate':
    case 'dark':
      return 'from-slate-800 via-slate-900 to-black';
    default:
      return 'from-[#0B1F3A] via-[#132E57] to-[#1E3A8A]';
  }
}

export function resolveCardTextStyle(cardTextColor?: string): {
  className: string;
  style?: { color: string };
} {
  const raw = (cardTextColor || '').trim();
  if (!raw) {
    return { className: 'text-white', style: { color: '#FFFFFF' } };
  }
  if (raw.startsWith('#')) {
    return { className: '', style: { color: raw } };
  }
  const matchedOption = CARD_TEXT_COLOR_OPTIONS.find((opt) => opt.className === raw);
  if (matchedOption) {
    return { className: matchedOption.className, style: { color: matchedOption.swatchHex } };
  }
  if (raw.startsWith('text-')) {
    const bracket = /text-\[(#[0-9A-Fa-f]{3,8})\]/.exec(raw);
    return {
      className: raw,
      style: bracket ? { color: bracket[1] } : undefined,
    };
  }
  return { className: 'text-white', style: { color: '#FFFFFF' } };
}

export function isLightCardTextColor(cardTextColor?: string): boolean {
  if (!cardTextColor) return false;
  const lower = cardTextColor.toLowerCase();
  return (
    lower.includes('#0b1f3a') ||
    lower.includes('#0f172a') ||
    lower.includes('#022c22') ||
    lower.includes('#4c0519') ||
    lower.includes('#451a03') ||
    lower.includes('#000000') ||
    lower.includes('slate-900') ||
    lower.includes('slate-950') ||
    lower.includes('zinc-900') ||
    lower.includes('emerald-950') ||
    lower.includes('rose-950') ||
    lower.includes('amber-950')
  );
}

export function getCardSpacingConfig(preset?: CardSpacingPreset): CardSpacingPresetOption {
  return (
    CARD_SPACING_PRESETS.find((p) => p.id === preset) || CARD_SPACING_PRESETS[1] // normal
  );
}

export function getCardPatternConfig(pattern?: CardPatternStyle): CardPatternOption {
  return CARD_PATTERN_PRESETS.find((p) => p.id === pattern) || CARD_PATTERN_PRESETS[0];
}

/**
 * Normalizes a LoyaltyRule so missing sub-fields are always populated with sensible defaults.
 */
export function normalizeLoyaltyRule(rule?: Partial<LoyaltyRule>): LoyaltyRule {
  const type = rule?.type === 'stamps' ? 'stamps' : 'points';
  const defaultTiers: PointTier[] =
    Array.isArray(rule?.pointRules) && rule!.pointRules.length > 0
      ? rule!.pointRules.map((t) => ({
          minAmount: Number(t.minAmount) || 0,
          maxAmount: Number(t.maxAmount) || 99999,
          points: Number(t.points) || 10,
          tierCalcMode: t.tierCalcMode === 'percentage' ? 'percentage' : 'points',
          percentageRate: Number(t.percentageRate) || 10,
        }))
      : [
          { minAmount: 1, maxAmount: 99, points: 10, tierCalcMode: 'points', percentageRate: 10 },
          { minAmount: 100, maxAmount: 299, points: 35, tierCalcMode: 'points', percentageRate: 12 },
          { minAmount: 300, maxAmount: 99999, points: 90, tierCalcMode: 'points', percentageRate: 15 },
        ];

  return {
    type,
    rewardDescription:
      rule?.rewardDescription?.trim() ||
      (type === 'stamps'
        ? 'مشروب أو منتج مجاني عند إكمال الأختام'
        : 'مكافأة خصم فوري عند الوصول لهدف النقاط'),
    stampsRequired: Math.max(2, Math.min(24, Number(rule?.stampsRequired) || 6)),
    stampShape: rule?.stampShape || 'star',
    pointsCalcMode: rule?.pointsCalcMode || 'per_amount',
    pointsPerUnit: Math.max(1, Number(rule?.pointsPerUnit) || 10),
    currencyUnitAmount: Math.max(1, Number(rule?.currencyUnitAmount) || 10),
    percentageRate: Math.max(1, Math.min(100, Number(rule?.percentageRate) || 10)),
    rewardTargetPoints: Math.max(10, Number(rule?.rewardTargetPoints) || 100),
    pointRules: defaultTiers,
  };
}

/**
 * Calculates how many points or stamps a customer earns for a given invoice amount
 * based on the store or branch LoyaltyRule.
 */
export function calculatePointsForAmount(rule: LoyaltyRule, invoiceAmount: number): number {
  const amount = Math.max(0, Number(invoiceAmount) || 0);
  if (amount <= 0) return 0;

  if (rule.type === 'stamps') {
    const unitAmt = Number(rule.currencyUnitAmount) || 0;
    if (unitAmt > 0) {
      return Math.max(1, Math.floor(amount / unitAmt));
    }
    return 1;
  }

  const mode = rule.pointsCalcMode || 'per_amount';

  if (mode === 'per_amount') {
    const unit = Math.max(1, Number(rule.currencyUnitAmount) || 10);
    const pts = Math.max(1, Number(rule.pointsPerUnit) || 10);
    return Math.max(1, Math.floor(amount / unit) * pts);
  }

  if (mode === 'percentage') {
    const pct = Math.max(1, Number(rule.percentageRate) || 10);
    return Math.max(1, Math.round((amount * pct) / 100));
  }

  // tiers mode
  const tiers = rule.pointRules || [];
  const matchedTier = tiers.find((t) => amount >= t.minAmount && amount <= t.maxAmount);
  if (matchedTier) {
    if (matchedTier.tierCalcMode === 'percentage') {
      const pct = Math.max(1, Number(matchedTier.percentageRate) || 10);
      return Math.max(1, Math.round((amount * pct) / 100));
    }
    return Math.max(1, Number(matchedTier.points) || 1);
  }

  // Fallback if amount exceeds highest tier
  const highestTier = [...tiers].sort((a, b) => b.maxAmount - a.maxAmount)[0];
  if (highestTier && amount > highestTier.maxAmount) {
    if (highestTier.tierCalcMode === 'percentage') {
      const pct = Math.max(1, Number(highestTier.percentageRate) || 10);
      return Math.max(1, Math.round((amount * pct) / 100));
    }
    return Math.max(1, Number(highestTier.points) || 10);
  }

  return Math.max(1, Math.floor(amount / 10));
}
