import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { appendAuditLog, enforcePolicy } from '@/lib/server/policy';
import type {
  AnnouncementPlacement,
  AnnouncementType,
  SiteAnnouncement,
  SiteSettings,
} from '@/lib/types';

export async function GET(req: NextRequest) {
  const auth = enforcePolicy(req, 'admin.settings.get');
  if (!auth.ok) return auth.response;

  const db = getDb();
  return NextResponse.json({ siteSettings: db.siteSettings });
}

export async function PATCH(req: NextRequest) {
  const auth = enforcePolicy(req, 'admin.settings.update');
  if (!auth.ok) return auth.response;
  const { user, ip } = auth.ctx;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Partial<SiteSettings> | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'بيانات إعدادات الهبوط غير صالحة.' }, { status: 400 });
  }

  const db = getDb();
  const prev = { ...db.siteSettings };

  const trimOrPrev = (val: unknown, fallback: string | undefined) =>
    typeof val === 'string' && val.trim() ? val.trim() : fallback;

  const nullableString = (val: unknown, fallback: string | null | undefined) =>
    typeof val === 'string' ? (val.trim() ? val.trim() : null) : fallback ?? null;

  const sanitizeAnnouncements = (raw: unknown): SiteAnnouncement[] | undefined => {
    if (!Array.isArray(raw)) return prev.announcements;
    return raw
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item, idx): SiteAnnouncement => {
        const type: AnnouncementType =
          item.type === 'alert' || item.type === 'offer' || item.type === 'maintenance'
            ? item.type
            : 'announcement';
        const placement: AnnouncementPlacement =
          item.placement === 'hero_alert' || item.placement === 'floating_toast'
            ? item.placement
            : 'top_bar';
        const colorPreset: SiteAnnouncement['colorPreset'] =
          item.colorPreset === 'sky' ||
          item.colorPreset === 'amber' ||
          item.colorPreset === 'emerald' ||
          item.colorPreset === 'rose'
            ? item.colorPreset
            : 'navy_gold';

        return {
          id:
            typeof item.id === 'string' && item.id.trim()
              ? item.id.trim()
              : `ann-${Date.now()}-${idx}`,
          title: typeof item.title === 'string' ? item.title.trim() : 'إعلان المنصة',
          message: typeof item.message === 'string' ? item.message.trim() : '',
          type,
          placement,
          linkText: typeof item.linkText === 'string' ? item.linkText.trim() : undefined,
          linkUrl: typeof item.linkUrl === 'string' ? item.linkUrl.trim() : undefined,
          colorPreset,
          isActive: Boolean(item.isActive),
          dismissible: item.dismissible !== false,
        };
      })
      .filter((a) => a.title || a.message);
  };

  const sanitizePartnerLogos = (raw: unknown) => {
    if (!Array.isArray(raw)) return prev.partnerLogos;
    return raw
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item) => ({
        name: typeof item.name === 'string' ? item.name.trim() : '',
        tag: typeof item.tag === 'string' ? item.tag.trim() : 'PARTNER',
      }))
      .filter((p) => p.name);
  };

  const next: SiteSettings = {
    ...prev,
    id: 'global',
    heroTitle: trimOrPrev(body.heroTitle, prev.heroTitle) || prev.heroTitle,
    heroSubtitle: trimOrPrev(body.heroSubtitle, prev.heroSubtitle) || prev.heroSubtitle,
    heroBadgeText: trimOrPrev(body.heroBadgeText, prev.heroBadgeText),
    heroPrimaryCta: trimOrPrev(body.heroPrimaryCta, prev.heroPrimaryCta),
    heroPrimaryCtaUrl:
      typeof body.heroPrimaryCtaUrl === 'string'
        ? body.heroPrimaryCtaUrl.trim()
        : prev.heroPrimaryCtaUrl,
    heroSecondaryCta: trimOrPrev(body.heroSecondaryCta, prev.heroSecondaryCta),
    heroImageUrl: nullableString(body.heroImageUrl, prev.heroImageUrl),
    heroShowcaseMode:
      body.heroShowcaseMode === 'image'
        ? 'image'
        : body.heroShowcaseMode === 'mockups'
        ? 'mockups'
        : prev.heroShowcaseMode,
    isBannerActive: typeof body.isBannerActive === 'boolean' ? body.isBannerActive : prev.isBannerActive,
    bannerText: nullableString(body.bannerText, prev.bannerText),
    bannerLinkUrl: nullableString(body.bannerLinkUrl, prev.bannerLinkUrl),
    bannerColor: trimOrPrev(body.bannerColor, prev.bannerColor) || prev.bannerColor,
    announcements: sanitizeAnnouncements(body.announcements),
    marqueeTitle: trimOrPrev(body.marqueeTitle, prev.marqueeTitle),
    partnerLogos: sanitizePartnerLogos(body.partnerLogos),
    problemTitle: trimOrPrev(body.problemTitle, prev.problemTitle),
    problemDesc: trimOrPrev(body.problemDesc, prev.problemDesc),
    problemImageUrl: nullableString(body.problemImageUrl, prev.problemImageUrl),
    solutionTitle: trimOrPrev(body.solutionTitle, prev.solutionTitle),
    solutionDesc: trimOrPrev(body.solutionDesc, prev.solutionDesc),
    solutionImageUrl: nullableString(body.solutionImageUrl, prev.solutionImageUrl),
    howItWorksTitle: trimOrPrev(body.howItWorksTitle, prev.howItWorksTitle),
    howItWorksSubtitle: trimOrPrev(body.howItWorksSubtitle, prev.howItWorksSubtitle),
    steps: Array.isArray(body.steps) ? body.steps : prev.steps,
    featuresTitle: trimOrPrev(body.featuresTitle, prev.featuresTitle),
    featuresSubtitle: trimOrPrev(body.featuresSubtitle, prev.featuresSubtitle),
    features: Array.isArray(body.features) ? body.features : prev.features,
    pricingTitle: trimOrPrev(body.pricingTitle, prev.pricingTitle),
    pricingSubtitle:
      typeof body.pricingSubtitle === 'string'
        ? body.pricingSubtitle.trim()
        : prev.pricingSubtitle,
    annualDiscountPct:
      typeof body.annualDiscountPct === 'number' && Number.isFinite(body.annualDiscountPct)
        ? Math.max(0, Math.min(90, Math.round(body.annualDiscountPct)))
        : prev.annualDiscountPct ?? 20,
    directoryTitle: trimOrPrev(body.directoryTitle, prev.directoryTitle),
    directorySubtitle: trimOrPrev(body.directorySubtitle, prev.directorySubtitle),
    finalCtaTitle: trimOrPrev(body.finalCtaTitle, prev.finalCtaTitle),
    finalCtaSubtitle: trimOrPrev(body.finalCtaSubtitle, prev.finalCtaSubtitle),
    finalCtaButton: trimOrPrev(body.finalCtaButton, prev.finalCtaButton),
    faqTitle: trimOrPrev(body.faqTitle, prev.faqTitle),
    faqSubtitle: trimOrPrev(body.faqSubtitle, prev.faqSubtitle),
    faqItems: Array.isArray(body.faqItems) ? body.faqItems : prev.faqItems,
    footerTagline: trimOrPrev(body.footerTagline, prev.footerTagline),
    footerCopyright: trimOrPrev(body.footerCopyright, prev.footerCopyright),
    adminWhatsappNumber:
      typeof body.adminWhatsappNumber === 'string'
        ? body.adminWhatsappNumber.replace(/[^\d]/g, '') || prev.adminWhatsappNumber || '966500000000'
        : prev.adminWhatsappNumber || '966500000000',
    trialDays:
      typeof body.trialDays === 'number' && Number.isFinite(body.trialDays)
        ? Math.max(1, Math.min(90, Math.round(body.trialDays)))
        : prev.trialDays ?? 14,
    customSections: Array.isArray(body.customSections) ? body.customSections : prev.customSections,
    sectionVisibility:
      body.sectionVisibility && typeof body.sectionVisibility === 'object'
        ? {
            showMarquee: Boolean(body.sectionVisibility.showMarquee),
            showProblemSolution: Boolean(body.sectionVisibility.showProblemSolution),
            showHowItWorks: Boolean(body.sectionVisibility.showHowItWorks),
            showFeatures: Boolean(body.sectionVisibility.showFeatures),
            showPricing: Boolean(body.sectionVisibility.showPricing),
            showDirectory: Boolean(body.sectionVisibility.showDirectory),
            showFaq: Boolean(body.sectionVisibility.showFaq),
            showFinalCta: Boolean(body.sectionVisibility.showFinalCta),
          }
        : prev.sectionVisibility,
    updatedAt: new Date().toISOString(),
  };

  db.siteSettings = next;

  const auditLog = appendAuditLog({
    actorName: `${user.firstName} ${user.lastName}`,
    actorRole: user.role,
    action: 'تحديث تصميم ومحتوى الصفحة الرئيسية والإعلانات (CMS)',
    target: 'SiteSettings (Global Visual Builder)',
    oldValue: `Title="${prev.heroTitle}" | Banner=${prev.isBannerActive}`,
    newValue: `Title="${next.heroTitle}" | Banner=${next.isBannerActive} | Alerts=${
      next.announcements?.filter((a) => a.isActive).length || 0
    } | CustomSections=${next.customSections?.length || 0}`,
    ip,
  });

  return NextResponse.json({
    siteSettings: db.siteSettings,
    auditLog,
  });
}
