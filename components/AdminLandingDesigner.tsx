'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BellRing,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  HelpCircle,
  ImagePlus,
  LayoutTemplate,
  Megaphone,
  Monitor,
  Moon,
  Paintbrush,
  Plus,
  Rocket,
  RotateCcw,
  Save,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Sun,
  Trash2,
  Upload,
  WifiOff,
  Wrench,
  Zap,
} from 'lucide-react';
import { INITIAL_SITE_SETTINGS } from '@/lib/mockData';
import { authFetch } from '@/lib/clientAuth';
import type {
  AnnouncementPlacement,
  AnnouncementType,
  AuditLog,
  LandingCustomSection,
  LandingFaqItem,
  LandingFeatureItem,
  LandingSectionVisibility,
  LandingStepItem,
  SiteAnnouncement,
  SiteSettings,
} from '@/lib/types';

interface AdminLandingDesignerProps {
  siteSettings: SiteSettings;
  setSiteSettings: React.Dispatch<React.SetStateAction<SiteSettings>>;
  onAuditLog?: (log: AuditLog) => void;
  notify: (text: string, type?: 'ok' | 'err') => void;
}

type StudioBlockId =
  | 'announcements'
  | 'hero'
  | 'marquee'
  | 'problem_solution'
  | 'steps'
  | 'features'
  | 'sections_text'
  | 'faq'
  | 'custom';

const DEFAULT_VISIBILITY: LandingSectionVisibility = {
  showMarquee: true,
  showProblemSolution: true,
  showHowItWorks: true,
  showFeatures: true,
  showPricing: true,
  showDirectory: true,
  showFaq: true,
  showFinalCta: true,
};

const BANNER_COLOR_PRESETS = [
  {
    label: 'كحلي وذهبي (رسمي)',
    value: 'bg-gradient-to-r from-[#0B1F3A] via-[#10325E] to-[#0B1F3A] text-[#FBBF24]',
  },
  {
    label: 'أزرق سماوي مشرق',
    value: 'bg-gradient-to-r from-[#0284C7] via-[#0EA5E9] to-[#0284C7] text-white',
  },
  {
    label: 'ذهبي لافت للانتباه',
    value: 'bg-gradient-to-r from-[#F59E0B] via-[#FBBF24] to-[#F59E0B] text-[#0B1F3A]',
  },
  {
    label: 'أخضر زمردي',
    value: 'bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-700 text-white',
  },
  {
    label: 'أحمر تنبيهي',
    value: 'bg-gradient-to-r from-rose-700 via-rose-600 to-rose-700 text-white',
  },
];

const ANNOUNCEMENT_COLOR_CLASSES: Record<SiteAnnouncement['colorPreset'], string> = {
  navy_gold: 'bg-gradient-to-r from-[#0B1F3A] via-[#10325E] to-[#0B1F3A] text-[#FBBF24]',
  sky: 'bg-gradient-to-r from-[#0284C7] via-[#0EA5E9] to-[#0284C7] text-white',
  amber: 'bg-gradient-to-r from-[#F59E0B] via-[#FBBF24] to-[#F59E0B] text-[#0B1F3A]',
  emerald: 'bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-700 text-white',
  rose: 'bg-gradient-to-r from-rose-700 via-rose-600 to-rose-700 text-white',
};

const HERO_IMAGE_PRESETS = [
  {
    label: 'مقهى حديث (كاشير وعملاء)',
    url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&q=80&w=1000',
  },
  {
    label: 'دفع بالبطاقة الذكية',
    url: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&q=80&w=1000',
  },
  {
    label: 'مطعم وكافيه راقي',
    url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=1000',
  },
];

export default function AdminLandingDesigner({
  siteSettings,
  setSiteSettings,
  onAuditLog,
  notify,
}: AdminLandingDesignerProps) {
  const [activeBlock, setActiveBlock] = useState<StudioBlockId>('announcements');
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [previewDark, setPreviewDark] = useState(false);

  const updateSettings = (updater: (prev: SiteSettings) => SiteSettings) => {
    setHasUnsavedChanges(true);
    setSiteSettings(updater);
  };

  const announcements: SiteAnnouncement[] = siteSettings.announcements || [];
  const partnerLogos =
    siteSettings.partnerLogos && siteSettings.partnerLogos.length > 0
      ? siteSettings.partnerLogos
      : INITIAL_SITE_SETTINGS.partnerLogos || [];

  const steps: LandingStepItem[] =
    siteSettings.steps && siteSettings.steps.length > 0
      ? siteSettings.steps
      : INITIAL_SITE_SETTINGS.steps || [];

  const features: LandingFeatureItem[] =
    siteSettings.features && siteSettings.features.length > 0
      ? siteSettings.features
      : INITIAL_SITE_SETTINGS.features || [];

  const faqItems: LandingFaqItem[] =
    siteSettings.faqItems && siteSettings.faqItems.length > 0
      ? siteSettings.faqItems
      : INITIAL_SITE_SETTINGS.faqItems || [];

  const customSections: LandingCustomSection[] = siteSettings.customSections || [];
  const visibility: LandingSectionVisibility = {
    ...DEFAULT_VISIBILITY,
    ...(siteSettings.sectionVisibility || {}),
  };

  const handleImageFileUpload = (
    file: File | undefined,
    onLoaded: (dataUrl: string) => void
  ) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notify('يرجى اختيار ملف صورة صالح (PNG / JPG / WebP)', 'err');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      notify('حجم الصورة كبير جداً (الحد الأقصى 2 ميجابايت)', 'err');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onLoaded(reader.result);
        setHasUnsavedChanges(true);
        notify('تم رفع الصورة وتطبيقها في المعاينة المباشرة');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await authFetch('/api/admin/site-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(siteSettings),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || 'تعذر حفظ تصميم الصفحة الرئيسية', 'err');
        return;
      }
      if (data.siteSettings) setSiteSettings(data.siteSettings);
      if (data.auditLog && onAuditLog) onAuditLog(data.auditLog);
      setHasUnsavedChanges(false);
      notify('تم حفظ ونشر جميع تعديلات مصمم الواجهة والإعلانات على الصفحة الرئيسية!');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setSiteSettings(structuredClone(INITIAL_SITE_SETTINGS));
    setHasUnsavedChanges(true);
    notify('تمت استعادة الإعدادات الافتراضية (اضغط «حفظ ونشر» لتطبيقها)');
  };

  const toggleVisibility = (key: keyof LandingSectionVisibility) => {
    updateSettings((prev) => ({
      ...prev,
      sectionVisibility: {
        ...DEFAULT_VISIBILITY,
        ...(prev.sectionVisibility || {}),
        [key]: !visibility[key],
      },
    }));
  };

  // Multi-announcements handlers
  const addAnnouncement = (presetType: AnnouncementType = 'announcement', placement: AnnouncementPlacement = 'top_bar') => {
    const newItem: SiteAnnouncement = {
      id: `ann-${Date.now()}`,
      title:
        presetType === 'alert'
          ? 'تنبيه هام للمتاجر والعملاء'
          : presetType === 'offer'
          ? 'عرض ترويجي خاص'
          : presetType === 'maintenance'
          ? 'إشعار صيانة مجدولة'
          : 'إعلان جديد من إدارة المنصة',
      message: 'اكتب هنا نص الإعلان أو التنبيه الذي سيظهر لزوار الصفحة الرئيسية.',
      type: presetType,
      placement,
      linkText: 'التفاصيل',
      linkUrl: '#pricing',
      colorPreset:
        presetType === 'alert'
          ? 'rose'
          : presetType === 'offer'
          ? 'amber'
          : presetType === 'maintenance'
          ? 'navy_gold'
          : 'sky',
      isActive: true,
      dismissible: true,
    };
    updateSettings((prev) => ({
      ...prev,
      announcements: [newItem, ...(prev.announcements || [])],
    }));
  };

  const updateAnnouncement = (id: string, patch: Partial<SiteAnnouncement>) => {
    updateSettings((prev) => ({
      ...prev,
      announcements: (prev.announcements || []).map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  };

  const removeAnnouncement = (id: string) => {
    updateSettings((prev) => ({
      ...prev,
      announcements: (prev.announcements || []).filter((a) => a.id !== id),
    }));
  };

  // Partner Logos handlers
  const addPartnerLogo = () => {
    updateSettings((prev) => ({
      ...prev,
      partnerLogos: [...partnerLogos, { name: 'شريك جديد', tag: 'LOYALTY PARTNER' }],
    }));
  };

  const updatePartnerLogo = (idx: number, patch: { name?: string; tag?: string }) => {
    const next = [...partnerLogos];
    next[idx] = { ...next[idx], ...patch };
    updateSettings((prev) => ({ ...prev, partnerLogos: next }));
  };

  const removePartnerLogo = (idx: number) => {
    updateSettings((prev) => ({
      ...prev,
      partnerLogos: partnerLogos.filter((_, i) => i !== idx),
    }));
  };

  // Steps handlers
  const addStep = () => {
    const next: LandingStepItem = {
      id: `step-${Date.now()}`,
      stepNumber: `${steps.length + 1}`,
      title: `خطوة جديدة ${steps.length + 1}`,
      description: 'اشرح الخطوة بإيجاز ووضوح للعميل أو التاجر.',
    };
    updateSettings((prev) => ({ ...prev, steps: [...steps, next] }));
  };

  const updateStep = (idx: number, patch: Partial<LandingStepItem>) => {
    const next = [...steps];
    next[idx] = { ...next[idx], ...patch };
    updateSettings((prev) => ({ ...prev, steps: next }));
  };

  const removeStep = (idx: number) => {
    updateSettings((prev) => ({
      ...prev,
      steps: steps.filter((_, i) => i !== idx),
    }));
  };

  // Features handlers
  const updateFeature = (idx: number, patch: Partial<LandingFeatureItem>) => {
    const next = [...features];
    next[idx] = { ...next[idx], ...patch };
    updateSettings((prev) => ({ ...prev, features: next }));
  };

  const addFeature = () => {
    const next: LandingFeatureItem = {
      id: `feat-${Date.now()}`,
      title: 'ميزة جديدة للمتجر',
      description: 'اشرح كيف تساعد هذه الميزة التاجر في زيادة المبيعات أو ولاء العملاء.',
      icon: 'sparkles',
    };
    updateSettings((prev) => ({ ...prev, features: [...features, next] }));
  };

  const removeFeature = (idx: number) => {
    updateSettings((prev) => ({
      ...prev,
      features: features.filter((_, i) => i !== idx),
    }));
  };

  // Custom Sections handlers
  const addCustomSection = () => {
    const created: LandingCustomSection = {
      id: `sec-${Date.now()}`,
      title: 'قسم مخصص جديد — تجربة تسوق أذكى لعملائك',
      subtitle: 'عرض أو خدمة إضافية',
      body: 'أضف هنا التفاصيل والرسائل التسويقية والصور التي تريد إبرازها للزوار والتجار في الصفحة الرئيسية.',
      imageUrl: null,
      ctaText: 'ابدأ الآن مجاناً',
      ctaUrl: '#pricing',
      theme: 'light',
      isActive: true,
    };
    updateSettings((prev) => ({
      ...prev,
      customSections: [...customSections, created],
    }));
  };

  const updateCustomSection = (id: string, patch: Partial<LandingCustomSection>) => {
    updateSettings((prev) => ({
      ...prev,
      customSections: customSections.map((sec) => (sec.id === id ? { ...sec, ...patch } : sec)),
    }));
  };

  const moveCustomSection = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= customSections.length) return;
    const next = [...customSections];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    updateSettings((prev) => ({ ...prev, customSections: next }));
  };

  const removeCustomSection = (id: string) => {
    updateSettings((prev) => ({
      ...prev,
      customSections: customSections.filter((sec) => sec.id !== id),
    }));
  };

  // FAQ handlers
  const addFaq = () => {
    const next: LandingFaqItem = {
      id: `faq-${Date.now()}`,
      q: 'سؤال جديد من التجار',
      a: 'الإجابة الواضحة والمختصرة تظهر هنا فور الحفظ.',
    };
    updateSettings((prev) => ({ ...prev, faqItems: [...faqItems, next] }));
  };

  const updateFaq = (idx: number, patch: Partial<LandingFaqItem>) => {
    const next = [...faqItems];
    next[idx] = { ...next[idx], ...patch };
    updateSettings((prev) => ({ ...prev, faqItems: next }));
  };

  const removeFaq = (idx: number) => {
    updateSettings((prev) => ({
      ...prev,
      faqItems: faqItems.filter((_, i) => i !== idx),
    }));
  };

  const activeAlertsCount =
    (siteSettings.isBannerActive ? 1 : 0) + announcements.filter((a) => a.isActive).length;

  const studioBlocks: Array<{
    id: StudioBlockId;
    label: string;
    badge?: string;
    icon: React.ComponentType<{ className?: string }>;
    visible?: boolean;
  }> = [
    {
      id: 'announcements',
      label: 'الإعلانات والتنبيهات',
      badge: `${activeAlertsCount} نشط`,
      icon: Megaphone,
    },
    { id: 'hero', label: 'القسم الرئيسي والصور', icon: LayoutTemplate },
    {
      id: 'marquee',
      label: 'شريط الشركاء',
      badge: `${partnerLogos.length}`,
      icon: Store,
      visible: visibility.showMarquee,
    },
    {
      id: 'problem_solution',
      label: 'المشكلة والحل',
      icon: AlertTriangle,
      visible: visibility.showProblemSolution,
    },
    {
      id: 'steps',
      label: 'خطوات العمل',
      badge: `${steps.length}`,
      icon: Zap,
      visible: visibility.showHowItWorks,
    },
    {
      id: 'features',
      label: 'الميزات التنافسية',
      badge: `${features.length}`,
      icon: Sparkles,
      visible: visibility.showFeatures,
    },
    {
      id: 'sections_text',
      label: 'الباقات، الدليل والفوتر',
      icon: CreditCard,
    },
    {
      id: 'faq',
      label: 'الأسئلة الشائعة',
      badge: `${faqItems.length}`,
      icon: HelpCircle,
      visible: visibility.showFaq,
    },
    {
      id: 'custom',
      label: 'الأقسام المخصصة',
      badge: `${customSections.length}`,
      icon: Plus,
    },
  ];

  const inputClass =
    'w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white focus:outline-none focus:border-[#0284C7]';

  const activeTopAnnouncements = announcements.filter(
    (a) => a.isActive && a.placement === 'top_bar'
  );
  const activeHeroAlerts = announcements.filter(
    (a) => a.isActive && a.placement === 'hero_alert'
  );
  const activeFloatingAlerts = announcements.filter(
    (a) => a.isActive && a.placement === 'floating_toast'
  );

  return (
    <div className="space-y-6">
      {/* Top Studio Header Bar */}
      <div className="p-5 sm:p-6 rounded-3xl glass-card flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 text-xs font-black">
              <Paintbrush className="w-3.5 h-3.5" />
              <span>استوديو تصميم الصفحة الرئيسية والإعلانات (Visual Studio CMS)</span>
            </div>
            {hasUnsavedChanges ? (
              <span className="px-2.5 py-1 rounded-full bg-amber-500 text-[#0B1F3A] text-[11px] font-black">
                ● تعديلات غير منشورة
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[11px] font-black inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>الواجهة متزامنة ومنشورة</span>
              </span>
            )}
          </div>
          <h2 className="text-xl font-black text-[#0B1F3A] dark:text-white">
            تحكم كامل في النصوص، الصور، الأقسام، والإعلانات والتنبيهات المتعددة
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            اختر أي قسم أو اضغط عليه مباشرة من المعاينة التفاعلية لتعديله ونشره فوراً على الواجهة الرئيسية.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/"
            target="_blank"
            className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-sky-50 text-[#0284C7] dark:text-[#00C2FF] border border-slate-200 dark:border-slate-700 text-xs font-black inline-flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>فتح الواجهة الحية</span>
          </Link>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>استعادة الافتراضي</span>
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] text-xs font-black flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'جاري النشر...' : 'حفظ ونشر على الصفحة الرئيسية'}</span>
          </button>
        </div>
      </div>

      {/* Block Switcher Strip */}
      <div className="p-2.5 rounded-2xl glass-card flex items-center gap-2 overflow-x-auto">
        {studioBlocks.map((block) => {
          const Icon = block.icon;
          const active = activeBlock === block.id;
          return (
            <button
              key={block.id}
              type="button"
              onClick={() => setActiveBlock(block.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 shrink-0 transition cursor-pointer ${
                active
                  ? 'bg-[#0B1F3A] text-[#FBBF24] shadow-sm'
                  : 'bg-white/70 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{block.label}</span>
              {block.badge && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums ${
                    active
                      ? 'bg-[#FBBF24]/20 text-[#FBBF24]'
                      : 'bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {block.badge}
                </span>
              )}
              {block.visible === false && (
                <EyeOff className="w-3 h-3 text-rose-500 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Main Split Studio: Left Editor + Right Interactive Browser Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Editor Panel (7 cols) */}
        <div className="xl:col-span-7 space-y-5">
          {/* 1. ANNOUNCEMENTS & ALERTS STUDIO */}
          {activeBlock === 'announcements' && (
            <div className="space-y-5">
              {/* Primary Top Banner */}
              <div className="p-5 rounded-3xl glass-card space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-amber-700 dark:text-[#FBBF24] flex items-center gap-2">
                      <Megaphone className="w-4 h-4" />
                      الشريط الإعلاني الرئيسي (أعلى الصفحة فوق القائمة)
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      يظهر في أعلى الصفحة فوق شريط التنقل مع رابط توجيه مباشر.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-black cursor-pointer px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30">
                    <input
                      type="checkbox"
                      checked={siteSettings.isBannerActive}
                      onChange={(e) =>
                        updateSettings((prev) => ({ ...prev, isBannerActive: e.target.checked }))
                      }
                      className="w-4 h-4 accent-amber-500"
                    />
                    <span>{siteSettings.isBannerActive ? 'مفعل' : 'متوقف'}</span>
                  </label>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    نص الشريط الرئيسي
                  </label>
                  <input
                    type="text"
                    value={siteSettings.bannerText || ''}
                    onChange={(e) =>
                      updateSettings((prev) => ({ ...prev, bannerText: e.target.value }))
                    }
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      رابط الانتقال عند الضغط
                    </label>
                    <input
                      type="text"
                      value={siteSettings.bannerLinkUrl || ''}
                      onChange={(e) =>
                        updateSettings((prev) => ({ ...prev, bannerLinkUrl: e.target.value }))
                      }
                      placeholder="#pricing"
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      مظهر لون الشريط
                    </label>
                    <select
                      value={siteSettings.bannerColor}
                      onChange={(e) =>
                        updateSettings((prev) => ({ ...prev, bannerColor: e.target.value }))
                      }
                      className={inputClass}
                    >
                      {BANNER_COLOR_PRESETS.map((preset) => (
                        <option key={preset.label} value={preset.value}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Multi-Announcements & Alerts Builder */}
              <div className="p-5 rounded-3xl glass-card space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white flex items-center gap-2">
                      <BellRing className="w-4 h-4 text-[#0284C7] dark:text-[#00C2FF]" />
                      إدارة الإعلانات والتنبيهات والعروض الإضافية ({announcements.length})
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      أضف أي عدد من الإعلانات أو التنبيهات أو العروض أو إشعارات الصيانة وحدد مكان ظهورها.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => addAnnouncement('announcement', 'top_bar')}
                      className="px-3 py-2 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] text-xs font-black inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ إعلان جديد</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => addAnnouncement('alert', 'hero_alert')}
                      className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 text-xs font-black inline-flex items-center gap-1 cursor-pointer"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>+ تنبيه هام</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => addAnnouncement('offer', 'floating_toast')}
                      className="px-3 py-2 rounded-xl bg-sky-50 dark:bg-sky-500/20 text-[#0284C7] dark:text-[#00C2FF] border border-sky-200 dark:border-sky-500/30 text-xs font-black inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>+ عرض عائم</span>
                    </button>
                  </div>
                </div>

                {announcements.length === 0 ? (
                  <div className="p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500">
                    لا توجد إعلانات أو تنبيهات إضافية حالياً. اضغط «+ إعلان جديد» أو «+ تنبيه هام» للبدء.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {announcements.map((ann) => (
                      <div
                        key={ann.id}
                        className={`p-4 rounded-2xl border space-y-3 transition ${
                          ann.isActive
                            ? 'bg-white/90 dark:bg-slate-900/90 border-sky-200 dark:border-sky-500/30'
                            : 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-80'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <label className="inline-flex items-center gap-1.5 text-xs font-black cursor-pointer">
                              <input
                                type="checkbox"
                                checked={ann.isActive}
                                onChange={(e) =>
                                  updateAnnouncement(ann.id, { isActive: e.target.checked })
                                }
                                className="accent-emerald-500 w-4 h-4"
                              />
                              <span>{ann.isActive ? 'ظاهر للزوار' : 'متوقف'}</span>
                            </label>
                            <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={ann.dismissible}
                                onChange={(e) =>
                                  updateAnnouncement(ann.id, { dismissible: e.target.checked })
                                }
                                className="accent-sky-500"
                              />
                              <span>قابل للإغلاق من الزائر</span>
                            </label>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeAnnouncement(ann.id)}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>حذف</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">
                              نوع التنبيه
                            </label>
                            <select
                              value={ann.type}
                              onChange={(e) =>
                                updateAnnouncement(ann.id, {
                                  type: e.target.value as AnnouncementType,
                                })
                              }
                              className={inputClass}
                            >
                              <option value="announcement">إعلان عام</option>
                              <option value="alert">تنبيه هام</option>
                              <option value="offer">عرض وتخفيض</option>
                              <option value="maintenance">إشعار صيانة</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">
                              مكان الظهور
                            </label>
                            <select
                              value={ann.placement}
                              onChange={(e) =>
                                updateAnnouncement(ann.id, {
                                  placement: e.target.value as AnnouncementPlacement,
                                })
                              }
                              className={inputClass}
                            >
                              <option value="top_bar">شريط علوي بأعلى الصفحة</option>
                              <option value="hero_alert">صندوق تنبيه بالواجهة الرئيسية</option>
                              <option value="floating_toast">بطاقة تنبيه عائمة أسفل الشاشة</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">
                              اللون
                            </label>
                            <select
                              value={ann.colorPreset}
                              onChange={(e) =>
                                updateAnnouncement(ann.id, {
                                  colorPreset: e.target.value as SiteAnnouncement['colorPreset'],
                                })
                              }
                              className={inputClass}
                            >
                              <option value="navy_gold">كحلي وذهبي</option>
                              <option value="sky">أزرق سماوي</option>
                              <option value="amber">ذهبي تحذيري</option>
                              <option value="emerald">أخضر تأكيدي</option>
                              <option value="rose">أحمر تنبيه عاجل</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <input
                            type="text"
                            value={ann.title}
                            onChange={(e) =>
                              updateAnnouncement(ann.id, { title: e.target.value })
                            }
                            placeholder="عنوان الإعلان أو التنبيه"
                            className={`${inputClass} font-black`}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={ann.linkText || ''}
                              onChange={(e) =>
                                updateAnnouncement(ann.id, { linkText: e.target.value })
                              }
                              placeholder="نص الزر (اختياري)"
                              className={inputClass}
                            />
                            <input
                              type="text"
                              value={ann.linkUrl || ''}
                              onChange={(e) =>
                                updateAnnouncement(ann.id, { linkUrl: e.target.value })
                              }
                              placeholder="الرابط (#pricing)"
                              className={`${inputClass} font-mono`}
                            />
                          </div>
                        </div>

                        <textarea
                          rows={2}
                          value={ann.message}
                          onChange={(e) =>
                            updateAnnouncement(ann.id, { message: e.target.value })
                          }
                          placeholder="محتوى رسالة الإعلان أو التنبيه..."
                          className={inputClass}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. HERO SECTION STUDIO */}
          {activeBlock === 'hero' && (
            <div className="p-5 rounded-3xl glass-card space-y-4">
              <h3 className="text-sm font-black text-[#0284C7] dark:text-[#00C2FF]">
                تصميم واجهة العرض الرئيسية (Hero Section)
              </h3>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  الشارة الترحيبية العلوية
                </label>
                <input
                  type="text"
                  value={siteSettings.heroBadgeText || ''}
                  onChange={(e) =>
                    updateSettings((prev) => ({ ...prev, heroBadgeText: e.target.value }))
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  العنوان الرئيسي الكبير (H1)
                </label>
                <input
                  type="text"
                  value={siteSettings.heroTitle}
                  onChange={(e) =>
                    updateSettings((prev) => ({ ...prev, heroTitle: e.target.value }))
                  }
                  className={`${inputClass} font-black`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  الوصف التوضيحي أسفل العنوان
                </label>
                <textarea
                  rows={3}
                  value={siteSettings.heroSubtitle}
                  onChange={(e) =>
                    updateSettings((prev) => ({ ...prev, heroSubtitle: e.target.value }))
                  }
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    نص الزر الأساسي (CTA)
                  </label>
                  <input
                    type="text"
                    value={siteSettings.heroPrimaryCta || ''}
                    onChange={(e) =>
                      updateSettings((prev) => ({ ...prev, heroPrimaryCta: e.target.value }))
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    رابط مخصص للزر الأساسي (اختياري)
                  </label>
                  <input
                    type="text"
                    value={siteSettings.heroPrimaryCtaUrl || ''}
                    onChange={(e) =>
                      updateSettings((prev) => ({ ...prev, heroPrimaryCtaUrl: e.target.value }))
                    }
                    placeholder="اتركه فارغاً لفتح التسجيل"
                    className={`${inputClass} font-mono`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    نص الزر الثانوي
                  </label>
                  <input
                    type="text"
                    value={siteSettings.heroSecondaryCta || ''}
                    onChange={(e) =>
                      updateSettings((prev) => ({ ...prev, heroSecondaryCta: e.target.value }))
                    }
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Hero Visual Showcase */}
              <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-slate-900/70 border border-sky-200/70 dark:border-slate-700 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black text-[#0B1F3A] dark:text-white">
                    الوسيط البصري بجانب العنوان الرئيسي
                  </span>
                  <div className="inline-flex rounded-xl bg-white dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 text-[11px] font-black">
                    <button
                      type="button"
                      onClick={() =>
                        updateSettings((prev) => ({ ...prev, heroShowcaseMode: 'mockups' }))
                      }
                      className={`px-3 py-1 rounded-lg cursor-pointer ${
                        (siteSettings.heroShowcaseMode || 'mockups') === 'mockups'
                          ? 'bg-[#0B1F3A] text-white'
                          : 'text-slate-500'
                      }`}
                    >
                      شاشات الهواتف التفاعلية
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateSettings((prev) => ({ ...prev, heroShowcaseMode: 'image' }))
                      }
                      className={`px-3 py-1 rounded-lg cursor-pointer ${
                        siteSettings.heroShowcaseMode === 'image'
                          ? 'bg-[#0284C7] text-white'
                          : 'text-slate-500'
                      }`}
                    >
                      صورة مخصصة
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <input
                    type="text"
                    value={siteSettings.heroImageUrl || ''}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        heroImageUrl: e.target.value,
                        heroShowcaseMode: e.target.value.trim() ? 'image' : prev.heroShowcaseMode,
                      }))
                    }
                    placeholder="أدخل رابط صورة أو ارفع ملف صورة من جهازك..."
                    className={`${inputClass} flex-1 font-mono`}
                  />
                  <label className="px-3.5 py-2 rounded-xl bg-[#0B1F3A] hover:bg-[#10325E] text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer shrink-0">
                    <Upload className="w-3.5 h-3.5 text-[#FBBF24]" />
                    <span>رفع صورة</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleImageFileUpload(e.target.files?.[0], (dataUrl) =>
                          updateSettings((prev) => ({
                            ...prev,
                            heroImageUrl: dataUrl,
                            heroShowcaseMode: 'image',
                          }))
                        )
                      }
                    />
                  </label>
                  {siteSettings.heroImageUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        updateSettings((prev) => ({
                          ...prev,
                          heroImageUrl: null,
                          heroShowcaseMode: 'mockups',
                        }))
                      }
                      className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-bold cursor-pointer"
                    >
                      إزالة
                    </button>
                  )}
                </div>

                {/* Quick Image Library Presets */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                    أو اختر من مكتبة الصور الجاهزة:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {HERO_IMAGE_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() =>
                          updateSettings((prev) => ({
                            ...prev,
                            heroImageUrl: preset.url,
                            heroShowcaseMode: 'image',
                          }))
                        }
                        className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-sky-400 text-[11px] font-bold text-[#0B1F3A] dark:text-slate-200 cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. PARTNER MARQUEE */}
          {activeBlock === 'marquee' && (
            <div className="p-5 rounded-3xl glass-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white">
                    شريط الشركاء والثقة (Infinite Marquee)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    تحكم في العنوان الترويجي وقائمة العلامات التجارية المتحركة.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleVisibility('showMarquee')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black inline-flex items-center gap-1.5 cursor-pointer ${
                    visibility.showMarquee
                      ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {visibility.showMarquee ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span>{visibility.showMarquee ? 'ظاهر' : 'مخفي'}</span>
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  العنوان فوق شريط الشركاء
                </label>
                <input
                  type="text"
                  value={siteSettings.marqueeTitle || ''}
                  onChange={(e) =>
                    updateSettings((prev) => ({ ...prev, marqueeTitle: e.target.value }))
                  }
                  className={inputClass}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-black text-[#0B1F3A] dark:text-white">
                  قائمة الشركاء ({partnerLogos.length})
                </span>
                <button
                  type="button"
                  onClick={addPartnerLogo}
                  className="px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-500/20 text-[#0284C7] dark:text-[#00C2FF] text-xs font-black inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة شريك</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {partnerLogos.map((partner, idx) => (
                  <div
                    key={`${partner.name}-${idx}`}
                    className="p-3 rounded-2xl bg-white/85 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400">شريك #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => removePartnerLogo(idx)}
                        className="text-rose-600 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>حذف</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={partner.name}
                      onChange={(e) => updatePartnerLogo(idx, { name: e.target.value })}
                      placeholder="اسم المتجر"
                      className={`${inputClass} font-black`}
                    />
                    <input
                      type="text"
                      value={partner.tag}
                      onChange={(e) => updatePartnerLogo(idx, { tag: e.target.value })}
                      placeholder="التصنيف الإنجليزي المختصر"
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. PROBLEM & SOLUTION */}
          {activeBlock === 'problem_solution' && (
            <div className="p-5 rounded-3xl glass-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-black text-[#0284C7] dark:text-[#00C2FF]">
                  قسم المشكلة والحل + صور اختيارية
                </h3>
                <button
                  type="button"
                  onClick={() => toggleVisibility('showProblemSolution')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black inline-flex items-center gap-1.5 cursor-pointer ${
                    visibility.showProblemSolution
                      ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {visibility.showProblemSolution ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span>{visibility.showProblemSolution ? 'ظاهر' : 'مخفي'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 space-y-2.5">
                  <div className="text-xs font-black text-rose-800 dark:text-rose-300">بطاقة المشكلة</div>
                  <input
                    type="text"
                    value={siteSettings.problemTitle || ''}
                    onChange={(e) =>
                      updateSettings((prev) => ({ ...prev, problemTitle: e.target.value }))
                    }
                    className={inputClass}
                  />
                  <textarea
                    rows={3}
                    value={siteSettings.problemDesc || ''}
                    onChange={(e) =>
                      updateSettings((prev) => ({ ...prev, problemDesc: e.target.value }))
                    }
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={siteSettings.problemImageUrl || ''}
                    onChange={(e) =>
                      updateSettings((prev) => ({ ...prev, problemImageUrl: e.target.value || null }))
                    }
                    placeholder="رابط صورة للمشكلة (اختياري)"
                    className={`${inputClass} font-mono`}
                  />
                  <div className="flex items-center gap-2">
                    <label className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-rose-200 dark:border-slate-700 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer">
                      <ImagePlus className="w-3.5 h-3.5 text-rose-600" />
                      <span>رفع صورة للمشكلة</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          handleImageFileUpload(e.target.files?.[0], (url) =>
                            updateSettings((prev) => ({ ...prev, problemImageUrl: url }))
                          )
                        }
                      />
                    </label>
                    {siteSettings.problemImageUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          updateSettings((prev) => ({ ...prev, problemImageUrl: null }))
                        }
                        className="text-[11px] font-bold text-rose-700 cursor-pointer"
                      >
                        حذف الصورة
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-slate-900 border border-sky-200 dark:border-slate-700 space-y-2.5">
                  <div className="text-xs font-black text-[#0B1F3A] dark:text-[#FBBF24]">بطاقة الحل الذكي</div>
                  <input
                    type="text"
                    value={siteSettings.solutionTitle || ''}
                    onChange={(e) =>
                      updateSettings((prev) => ({ ...prev, solutionTitle: e.target.value }))
                    }
                    className={inputClass}
                  />
                  <textarea
                    rows={3}
                    value={siteSettings.solutionDesc || ''}
                    onChange={(e) =>
                      updateSettings((prev) => ({ ...prev, solutionDesc: e.target.value }))
                    }
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={siteSettings.solutionImageUrl || ''}
                    onChange={(e) =>
                      updateSettings((prev) => ({ ...prev, solutionImageUrl: e.target.value || null }))
                    }
                    placeholder="رابط صورة للحل (اختياري)"
                    className={`${inputClass} font-mono`}
                  />
                  <div className="flex items-center gap-2">
                    <label className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-sky-200 dark:border-slate-700 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer">
                      <ImagePlus className="w-3.5 h-3.5 text-[#0284C7]" />
                      <span>رفع صورة للحل</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          handleImageFileUpload(e.target.files?.[0], (url) =>
                            updateSettings((prev) => ({ ...prev, solutionImageUrl: url }))
                          )
                        }
                      />
                    </label>
                    {siteSettings.solutionImageUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          updateSettings((prev) => ({ ...prev, solutionImageUrl: null }))
                        }
                        className="text-[11px] font-bold text-rose-600 cursor-pointer"
                      >
                        حذف الصورة
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5. HOW IT WORKS (STEPS) */}
          {activeBlock === 'steps' && (
            <div className="p-5 rounded-3xl glass-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white">
                  قسم خطوات العمل ({steps.length})
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={addStep}
                    className="px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-500/20 text-[#0284C7] dark:text-[#00C2FF] text-xs font-black inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة خطوة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleVisibility('showHowItWorks')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black inline-flex items-center gap-1.5 cursor-pointer ${
                      visibility.showHowItWorks
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {visibility.showHowItWorks ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{visibility.showHowItWorks ? 'ظاهر' : 'مخفي'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={siteSettings.howItWorksTitle || ''}
                  onChange={(e) =>
                    updateSettings((prev) => ({ ...prev, howItWorksTitle: e.target.value }))
                  }
                  placeholder="عنوان القسم"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={siteSettings.howItWorksSubtitle || ''}
                  onChange={(e) =>
                    updateSettings((prev) => ({ ...prev, howItWorksSubtitle: e.target.value }))
                  }
                  placeholder="الوصف الفرعي"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {steps.map((st, idx) => (
                  <div
                    key={st.id}
                    className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={st.stepNumber}
                        onChange={(e) => updateStep(idx, { stepNumber: e.target.value })}
                        className="w-16 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-black text-center"
                      />
                      {steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStep(idx)}
                          className="text-rose-600 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>حذف</span>
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={st.title}
                      onChange={(e) => updateStep(idx, { title: e.target.value })}
                      className={`${inputClass} font-black`}
                    />
                    <textarea
                      rows={2}
                      value={st.description}
                      onChange={(e) => updateStep(idx, { description: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. FEATURES */}
          {activeBlock === 'features' && (
            <div className="p-5 rounded-3xl glass-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white">
                  بطاقات الميزات التنافسية ({features.length})
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={addFeature}
                    className="px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-500/20 text-[#0284C7] dark:text-[#00C2FF] text-xs font-black inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة ميزة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleVisibility('showFeatures')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black inline-flex items-center gap-1.5 cursor-pointer ${
                      visibility.showFeatures
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {visibility.showFeatures ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{visibility.showFeatures ? 'ظاهر' : 'مخفي'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={siteSettings.featuresTitle || ''}
                  onChange={(e) =>
                    updateSettings((prev) => ({ ...prev, featuresTitle: e.target.value }))
                  }
                  placeholder="عنوان قسم الميزات"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={siteSettings.featuresSubtitle || ''}
                  onChange={(e) =>
                    updateSettings((prev) => ({ ...prev, featuresSubtitle: e.target.value }))
                  }
                  placeholder="وصف قسم الميزات"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {features.map((feat, idx) => (
                  <div
                    key={feat.id}
                    className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <select
                        value={feat.icon}
                        onChange={(e) =>
                          updateFeature(idx, {
                            icon: e.target.value as LandingFeatureItem['icon'],
                          })
                        }
                        className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold"
                      >
                        <option value="wifi-off">أيقونة أوفلاين</option>
                        <option value="message">أيقونة رسائل</option>
                        <option value="smartphone">أيقونة جوال</option>
                        <option value="shield">أيقونة حماية</option>
                        <option value="sparkles">أيقونة تميز</option>
                        <option value="zap">أيقونة سرعة</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeFeature(idx)}
                        className="text-rose-600 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>حذف</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={feat.title}
                      onChange={(e) => updateFeature(idx, { title: e.target.value })}
                      className={`${inputClass} font-black`}
                    />
                    <textarea
                      rows={2}
                      value={feat.description}
                      onChange={(e) => updateFeature(idx, { description: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. PRICING / DIRECTORY / FINAL CTA / FOOTER HEADINGS */}
          {activeBlock === 'sections_text' && (
            <div className="space-y-5">
              {/* Visibility switches */}
              <div className="p-5 rounded-3xl glass-card space-y-3">
                <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white">
                  إظهار وإخفاء باقي أقسام الصفحة الرئيسية
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(
                    [
                      { key: 'showPricing', label: 'قسم الباقات والأسعار' },
                      { key: 'showDirectory', label: 'دليل المتاجر المشتركة' },
                      { key: 'showFinalCta', label: 'قسم الدعوة الختامية' },
                    ] as const
                  ).map((item) => {
                    const active = visibility[item.key];
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => toggleVisibility(item.key)}
                        className={`p-3 rounded-2xl border text-right text-xs font-black flex items-center justify-between gap-2 cursor-pointer transition ${
                          active
                            ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                            : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400'
                        }`}
                      >
                        <span>{item.label}</span>
                        {active ? <Eye className="w-4 h-4 shrink-0" /> : <EyeOff className="w-4 h-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-5 rounded-3xl glass-card space-y-4">
                <h3 className="text-sm font-black text-[#0284C7] dark:text-[#00C2FF] flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  عناوين وأوصاف الباقات، الدليل، الختام والفوتر
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">عنوان الباقات</label>
                    <input
                      type="text"
                      value={siteSettings.pricingTitle || ''}
                      onChange={(e) =>
                        updateSettings((prev) => ({ ...prev, pricingTitle: e.target.value }))
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      نسبة خصم الدفع السنوي الافتراضية (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={siteSettings.annualDiscountPct ?? 20}
                      onChange={(e) =>
                        updateSettings((prev) => ({
                          ...prev,
                          annualDiscountPct: Math.max(0, Math.min(90, Number(e.target.value) || 0)),
                        }))
                      }
                      className={inputClass}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      الوصف الفرعي للباقات (اتركه فارغاً ليُعرض الخصم السنوي تلقائياً)
                    </label>
                    <input
                      type="text"
                      value={siteSettings.pricingSubtitle || ''}
                      placeholder="(يُدفع شهرياً، أو سنوياً بخصم تلقائي حسب النسبة المحددة)"
                      onChange={(e) =>
                        updateSettings((prev) => ({ ...prev, pricingSubtitle: e.target.value }))
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">عنوان دليل المتاجر</label>
                    <input
                      type="text"
                      value={siteSettings.directoryTitle || ''}
                      onChange={(e) =>
                        updateSettings((prev) => ({ ...prev, directoryTitle: e.target.value }))
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">وصف دليل المتاجر</label>
                    <input
                      type="text"
                      value={siteSettings.directorySubtitle || ''}
                      onChange={(e) =>
                        updateSettings((prev) => ({ ...prev, directorySubtitle: e.target.value }))
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">عنوان القسم الختامي</label>
                    <input
                      type="text"
                      value={siteSettings.finalCtaTitle || ''}
                      onChange={(e) =>
                        updateSettings((prev) => ({ ...prev, finalCtaTitle: e.target.value }))
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">نص الزر الختامي</label>
                    <input
                      type="text"
                      value={siteSettings.finalCtaButton || ''}
                      onChange={(e) =>
                        updateSettings((prev) => ({ ...prev, finalCtaButton: e.target.value }))
                      }
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">وصف القسم الختامي</label>
                  <textarea
                    rows={2}
                    value={siteSettings.finalCtaSubtitle || ''}
                    onChange={(e) =>
                      updateSettings((prev) => ({ ...prev, finalCtaSubtitle: e.target.value }))
                    }
                    className={inputClass}
                  />
                </div>

                <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800 space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      النص التعريفي في تذييل الموقع (Footer Tagline)
                    </label>
                    <textarea
                      rows={2}
                      value={siteSettings.footerTagline || ''}
                      onChange={(e) =>
                        updateSettings((prev) => ({ ...prev, footerTagline: e.target.value }))
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      نص حقوق الملكية في أسفل الموقع (Footer Copyright)
                    </label>
                    <input
                      type="text"
                      value={siteSettings.footerCopyright || ''}
                      onChange={(e) =>
                        updateSettings((prev) => ({ ...prev, footerCopyright: e.target.value }))
                      }
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 8. FAQ MANAGER */}
          {activeBlock === 'faq' && (
            <div className="p-5 rounded-3xl glass-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white">
                  إدارة الأسئلة الشائعة ({faqItems.length})
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={addFaq}
                    className="px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-500/20 text-[#0284C7] dark:text-[#00C2FF] text-xs font-black inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة سؤال</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleVisibility('showFaq')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black inline-flex items-center gap-1.5 cursor-pointer ${
                      visibility.showFaq
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {visibility.showFaq ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{visibility.showFaq ? 'ظاهر' : 'مخفي'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={siteSettings.faqTitle || ''}
                  onChange={(e) =>
                    updateSettings((prev) => ({ ...prev, faqTitle: e.target.value }))
                  }
                  placeholder="عنوان قسم الأسئلة الشائعة"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={siteSettings.faqSubtitle || ''}
                  onChange={(e) =>
                    updateSettings((prev) => ({ ...prev, faqSubtitle: e.target.value }))
                  }
                  placeholder="الوصف الفرعي لقسم الأسئلة الشائعة"
                  className={inputClass}
                />
              </div>

              <div className="space-y-3">
                {faqItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-white/85 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-black text-[#0284C7]">سؤال #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeFaq(idx)}
                        className="text-rose-600 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>حذف</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={item.q}
                      onChange={(e) => updateFaq(idx, { q: e.target.value })}
                      className={`${inputClass} font-black`}
                    />
                    <textarea
                      rows={2}
                      value={item.a}
                      onChange={(e) => updateFaq(idx, { a: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 9. CUSTOM SECTIONS */}
          {activeBlock === 'custom' && (
            <div className="p-5 rounded-3xl glass-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white">
                    الأقسام المضافة المخصصة ({customSections.length})
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    أضف أقساماً تسويقية أو عروضاً بالصور والأزرار مع ترتيب ظهورها في الصفحة الرئيسية.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addCustomSection}
                  className="px-4 py-2 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة قسم جديد</span>
                </button>
              </div>

              {customSections.length === 0 ? (
                <div className="p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
                  لم يتم إضافة أقسام مخصصة بعد. اضغط «إضافة قسم جديد» لإنشاء قسم بصورة وزر مخصص.
                </div>
              ) : (
                <div className="space-y-4">
                  {customSections.map((sec, idx) => (
                    <div
                      key={sec.id}
                      className="p-4 rounded-2xl bg-white/85 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="inline-flex items-center gap-2 text-xs font-black cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sec.isActive}
                            onChange={(e) =>
                              updateCustomSection(sec.id, { isActive: e.target.checked })
                            }
                            className="accent-emerald-500"
                          />
                          <span>ظاهر في الصفحة الرئيسية</span>
                        </label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveCustomSection(idx, -1)}
                            title="تحريك لأعلى"
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 disabled:opacity-40 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === customSections.length - 1}
                            onClick={() => moveCustomSection(idx, 1)}
                            title="تحريك لأسفل"
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 disabled:opacity-40 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <select
                            value={sec.theme}
                            onChange={(e) =>
                              updateCustomSection(sec.id, {
                                theme: e.target.value as LandingCustomSection['theme'],
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold"
                          >
                            <option value="light">خلفية زجاجية فاتحة</option>
                            <option value="navy">خلفية كحلية داكنة</option>
                            <option value="gold">خلفية ذهبية</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => removeCustomSection(sec.id)}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>حذف</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={sec.title}
                          onChange={(e) => updateCustomSection(sec.id, { title: e.target.value })}
                          placeholder="عنوان القسم"
                          className={`${inputClass} font-black`}
                        />
                        <input
                          type="text"
                          value={sec.subtitle || ''}
                          onChange={(e) =>
                            updateCustomSection(sec.id, { subtitle: e.target.value })
                          }
                          placeholder="الشارة الفرعية (اختياري)"
                          className={inputClass}
                        />
                      </div>

                      <textarea
                        rows={2}
                        value={sec.body}
                        onChange={(e) => updateCustomSection(sec.id, { body: e.target.value })}
                        placeholder="محتوى القسم..."
                        className={inputClass}
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={sec.ctaText || ''}
                          onChange={(e) => updateCustomSection(sec.id, { ctaText: e.target.value })}
                          placeholder="نص زر الإجراء (اختياري)"
                          className={inputClass}
                        />
                        <input
                          type="text"
                          value={sec.ctaUrl || ''}
                          onChange={(e) => updateCustomSection(sec.id, { ctaUrl: e.target.value })}
                          placeholder="رابط الزر (#pricing)"
                          className={`${inputClass} font-mono`}
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={sec.imageUrl || ''}
                          onChange={(e) => updateCustomSection(sec.id, { imageUrl: e.target.value })}
                          placeholder="رابط صورة للقسم أو ارفع من جهازك..."
                          className={`${inputClass} flex-1 font-mono`}
                        />
                        <label className="px-3 py-2 rounded-xl bg-[#0B1F3A] text-white text-[11px] font-black inline-flex items-center gap-1 cursor-pointer">
                          <ImagePlus className="w-3.5 h-3.5 text-[#FBBF24]" />
                          <span>رفع صورة</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                              handleImageFileUpload(e.target.files?.[0], (url) =>
                                updateCustomSection(sec.id, { imageUrl: url })
                              )
                            }
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live Interactive Browser Preview (5 cols) */}
        <div className="xl:col-span-5 space-y-3 sticky top-24">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="text-xs font-black text-[#0B1F3A] dark:text-white flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-[#0284C7]" />
              معاينة تفاعلية حية (اضغط أي قسم لتعديله)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPreviewDevice('desktop')}
                aria-label="معاينة سطح المكتب"
                className={`p-1.5 rounded-lg border text-xs cursor-pointer ${
                  previewDevice === 'desktop'
                    ? 'bg-[#0B1F3A] text-[#FBBF24] border-[#0B1F3A]'
                    : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice('mobile')}
                aria-label="معاينة الجوال"
                className={`p-1.5 rounded-lg border text-xs cursor-pointer ${
                  previewDevice === 'mobile'
                    ? 'bg-[#0B1F3A] text-[#FBBF24] border-[#0B1F3A]'
                    : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPreviewDark((prev) => !prev)}
                aria-label="تبديل سمة المعاينة"
                className="p-1.5 rounded-lg border bg-white dark:bg-slate-800 text-slate-600 dark:text-amber-300 border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                {previewDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex justify-center">
            <div
              className={`rounded-3xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl transition-all ${
                previewDevice === 'mobile' ? 'w-80' : 'w-full'
              } ${previewDark ? 'dark bg-[#060E1B] text-white' : 'bg-white text-[#0B1F3A]'}`}
            >
              {/* Browser Chrome Strip */}
              <div className="px-3.5 py-2 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <span className="font-mono">aadapass.com/</span>
              </div>

              {/* Legacy Top Banner + Multi Top Bar Announcements Preview */}
              <div
                onClick={() => setActiveBlock('announcements')}
                className="cursor-pointer group"
              >
                {siteSettings.isBannerActive && siteSettings.bannerText && (
                  <div className={`px-3 py-1.5 text-center text-[10px] font-black ${siteSettings.bannerColor}`}>
                    {siteSettings.bannerText}
                  </div>
                )}
                {activeTopAnnouncements.map((ann) => (
                  <div
                    key={ann.id}
                    className={`px-3 py-1.5 text-center text-[10px] font-black border-t border-white/15 ${
                      ANNOUNCEMENT_COLOR_CLASSES[ann.colorPreset]
                    }`}
                  >
                    {ann.title}: {ann.message}
                  </div>
                ))}
              </div>

              {/* Hero Alerts Preview */}
              {activeHeroAlerts.length > 0 && (
                <div
                  onClick={() => setActiveBlock('announcements')}
                  className="px-4 pt-3 space-y-1.5 cursor-pointer"
                >
                  {activeHeroAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="px-3 py-2 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-700/60 text-[10px] flex items-center justify-between gap-2"
                    >
                      <span className="font-bold truncate">
                        <strong className="font-black">{alert.title}:</strong> {alert.message}
                      </span>
                      {alert.linkText && (
                        <span className="px-2 py-0.5 rounded-lg bg-gradient-gold-cta text-[#0B1F3A] text-[9px] font-black shrink-0">
                          {alert.linkText}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Mini Hero Preview */}
              <div
                onClick={() => setActiveBlock('hero')}
                className="p-4 space-y-3 bg-gradient-to-b from-sky-50/70 to-white dark:from-[#0B1F3A] dark:to-[#071324] cursor-pointer hover:ring-2 hover:ring-[#00C2FF]/40"
              >
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 text-[9px] font-black">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span className="truncate">{siteSettings.heroBadgeText || 'منصة الولاء الرقمي الأولى'}</span>
                </div>

                <div className={`grid gap-3 items-center ${previewDevice === 'mobile' ? 'grid-cols-1' : 'grid-cols-12'}`}>
                  <div className={previewDevice === 'mobile' ? 'space-y-1.5' : 'col-span-7 space-y-1.5'}>
                    <h4 className="text-sm font-black leading-snug">{siteSettings.heroTitle}</h4>
                    <p className="text-[10px] text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                      {siteSettings.heroSubtitle}
                    </p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      <span className="px-2.5 py-1 rounded-full bg-gradient-gold-cta text-[#0B1F3A] text-[9px] font-black inline-flex items-center gap-1">
                        <Rocket className="w-2.5 h-2.5" />
                        {siteSettings.heroPrimaryCta || 'ابدأ تجربتك'}
                      </span>
                      <span className="px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 text-[9px] font-bold">
                        {siteSettings.heroSecondaryCta || 'شاهد كيف نعمل'}
                      </span>
                    </div>
                  </div>

                  <div className={previewDevice === 'mobile' ? '' : 'col-span-5'}>
                    {siteSettings.heroShowcaseMode === 'image' && siteSettings.heroImageUrl ? (
                      <img
                        src={siteSettings.heroImageUrl}
                        alt="Hero Preview"
                        className="w-full h-24 object-cover rounded-xl border border-sky-200 dark:border-slate-700"
                      />
                    ) : (
                      <div className="p-2.5 rounded-xl bg-[#0B1F3A] text-white text-center space-y-1 border border-[#00C2FF]/30">
                        <Smartphone className="w-5 h-5 text-[#00C2FF] mx-auto" />
                        <div className="text-[9px] font-black text-[#FBBF24]">شاشات البطاقة + الكاشير</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Marquee Preview */}
              {visibility.showMarquee && (
                <div
                  onClick={() => setActiveBlock('marquee')}
                  className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 cursor-pointer space-y-1"
                >
                  <div className="text-[9px] font-bold text-slate-500 text-center truncate">
                    {siteSettings.marqueeTitle}
                  </div>
                  <div className="flex items-center gap-1.5 overflow-hidden justify-center">
                    {partnerLogos.slice(0, 4).map((p, i) => (
                      <span
                        key={`${p.name}-${i}`}
                        className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[8px] font-black truncate"
                      >
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Problem & Solution Preview */}
              {visibility.showProblemSolution && (
                <div
                  onClick={() => setActiveBlock('problem_solution')}
                  className="px-4 py-2.5 grid grid-cols-2 gap-2 border-t border-slate-100 dark:border-slate-800 cursor-pointer"
                >
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 space-y-0.5">
                    <div className="text-[9px] font-black text-rose-800 dark:text-rose-200 line-clamp-1">
                      {siteSettings.problemTitle}
                    </div>
                    <div className="text-[8px] text-rose-700/80 dark:text-rose-300/70 line-clamp-2">
                      {siteSettings.problemDesc}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#0B1F3A] border border-[#FBBF24] space-y-0.5 text-white">
                    <div className="text-[9px] font-black line-clamp-1">
                      {siteSettings.solutionTitle}
                    </div>
                    <div className="text-[8px] text-slate-300 line-clamp-2">
                      {siteSettings.solutionDesc}
                    </div>
                  </div>
                </div>
              )}

              {/* Custom Sections Preview */}
              {customSections
                .filter((s) => s.isActive)
                .map((sec) => (
                  <div
                    key={sec.id}
                    onClick={() => setActiveBlock('custom')}
                    className={`px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 cursor-pointer ${
                      sec.theme === 'navy'
                        ? 'bg-[#0B1F3A] text-white'
                        : sec.theme === 'gold'
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-[#0B1F3A] dark:text-amber-100'
                        : 'bg-sky-50/40 dark:bg-slate-900/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-[10px] font-black truncate">{sec.title}</div>
                        <div className="text-[9px] opacity-80 line-clamp-1">{sec.body}</div>
                      </div>
                      {sec.imageUrl && (
                        <img
                          src={sec.imageUrl}
                          alt={sec.title}
                          className="w-10 h-9 rounded-lg object-cover shrink-0"
                        />
                      )}
                    </div>
                  </div>
                ))}

              {/* Footer & Active Floating Alerts Preview */}
              <div
                onClick={() => setActiveBlock('sections_text')}
                className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 space-y-1.5 cursor-pointer"
              >
                <div className="flex flex-wrap gap-1.5 text-[9px] font-bold text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <WifiOff className="w-2.5 h-2.5 text-[#0284C7]" />
                    {features.length} ميزات
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5 text-amber-500" />
                    {steps.length} خطوات
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="w-2.5 h-2.5 text-indigo-500" />
                    {Object.values(visibility).filter(Boolean).length}/8 أقسام ظاهرة
                  </span>
                </div>
                <div className="text-[9px] font-bold text-slate-400 truncate">
                  {siteSettings.footerCopyright || 'جميع الحقوق محفوظة لمنصة عادة باس © 2026.'}
                </div>
              </div>

              {activeFloatingAlerts.length > 0 && (
                <div
                  onClick={() => setActiveBlock('announcements')}
                  className="px-4 py-2 bg-[#0B1F3A] text-[#FBBF24] text-[9px] font-black flex items-center justify-between cursor-pointer"
                >
                  <span>تنبيه عائم مفعل: {activeFloatingAlerts[0].title}</span>
                  <span>{activeFloatingAlerts.length} نشط</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
