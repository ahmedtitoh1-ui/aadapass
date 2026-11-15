'use client';

import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import type {
  CardPatternStyle,
  CardSpacingPreset,
  LoyaltyRule,
  PointTier,
  PointsCalcMode,
  StampShape,
  Store,
  StoreCardDesign,
} from '@/lib/types';
import {
  CARD_COLOR_LIBRARY,
  CARD_PATTERN_PRESETS,
  CARD_READY_TEMPLATES,
  CARD_SPACING_PRESETS,
  CARD_TEXT_COLOR_LIBRARY,
  STAMP_SHAPE_OPTIONS,
  calculatePointsForAmount,
  getCardPatternConfig,
  isLightCardTextColor,
  parseCustomCardGradient,
  resolveCardCssGradient,
  resolveCardGradientClass,
  resolveCardTextStyle,
  type CardTextColorValue,
  type ReadyCardTemplate,
} from '@/lib/cardDesignLibrary';
import { generatePassDataUrl } from '@/lib/passImageGenerator';
import { StampShapeIcon } from './StampShapeIcon';
import {
  Award,
  Calculator,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Instagram,
  Layers,
  Palette,
  Percent,
  Plus,
  Printer,
  QrCode,
  RotateCcw,
  Sparkles,
  Stamp,
  Trash2,
  Type,
  Wifi,
} from 'lucide-react';

interface LoyaltyCardStudioProps {
  store: Store;
  editingCard?: StoreCardDesign | null;
  onClearEditingCard?: () => void;
  onNavigateToCardReview?: () => void;
  onSaveDesign: (patch: Partial<Store>) => Promise<void>;
  onOpenQrPoster: () => void;
  showToast: (msg: string) => void;
}

export default function LoyaltyCardStudio({
  store,
  editingCard,
  onClearEditingCard,
  onNavigateToCardReview,
  onSaveDesign,
  onOpenQrPoster,
  showToast,
}: LoyaltyCardStudioProps) {
  const activeRuleSource = editingCard ? editingCard.loyaltyRule : store.loyaltyRule;

  // Card Design Name for multi-card management
  const [cardDesignName, setCardDesignName] = useState<string>(
    editingCard?.name || `بطاقة ولاء ${store.name}`
  );

  // Pattern Type: 'stamps' or 'points'
  const [cardPattern, setCardPattern] = useState<'stamps' | 'points'>(
    activeRuleSource.type || 'stamps'
  );

  // Stamps Mode State
  const [stampCount, setStampCount] = useState<number>(
    Math.min(12, Math.max(3, activeRuleSource.stampsRequired || 6))
  );
  const [stampShape, setStampShape] = useState<StampShape>(
    activeRuleSource.stampShape || 'coffee'
  );
  const [previewFilledStamps, setPreviewFilledStamps] = useState<number>(3);

  // Points Mode & Calculator State
  const [pointsCalcMode, setPointsCalcMode] = useState<PointsCalcMode>(
    activeRuleSource.pointsCalcMode || 'per_amount'
  );
  const [currencyUnitAmount, setCurrencyUnitAmount] = useState<number>(
    activeRuleSource.currencyUnitAmount || 10
  );
  const [pointsPerUnit, setPointsPerUnit] = useState<number>(
    activeRuleSource.pointsPerUnit || 10
  );
  const [percentageRate, setPercentageRate] = useState<number>(
    activeRuleSource.percentageRate ?? 10
  );
  const [rewardTargetPoints, setRewardTargetPoints] = useState<number>(
    activeRuleSource.rewardTargetPoints || 100
  );
  const [pointTiers, setPointTiers] = useState<PointTier[]>(
    activeRuleSource.pointRules && activeRuleSource.pointRules.length > 0
      ? activeRuleSource.pointRules
      : [
          { minAmount: 1, maxAmount: 50, points: 10, tierCalcMode: 'points', percentageRate: 10 },
          { minAmount: 51, maxAmount: 150, points: 30, tierCalcMode: 'points', percentageRate: 15 },
          { minAmount: 151, maxAmount: 500, points: 75, tierCalcMode: 'percentage', percentageRate: 20 },
        ]
  );
  const [calcInvoiceAmount, setCalcInvoiceAmount] = useState<number>(80);
  const [previewCustomerPoints, setPreviewCustomerPoints] = useState<number>(65);

  // Color & Text Libraries State
  const [colorCategory, setColorCategory] = useState<
    'الكل' | 'داكن فاخر' | 'حيوي مشرق' | 'فاتح أنيق'
  >('الكل');
  const [cardBg, setCardBg] = useState<string>(
    editingCard?.cardColor || store.cardColor || 'from-[#0B1F3A] via-[#10325E] to-[#0284C7]'
  );
  const [cardTextColor, setCardTextColor] = useState<CardTextColorValue>(
    ((editingCard?.cardTextColor || store.cardTextColor) as CardTextColorValue) || 'text-white'
  );

  // Ready Templates Category Filter & Selection State
  const [tplCategoryFilter, setTplCategoryFilter] = useState<
    'all' | 'store_stamps' | 'store_points' | 'account_master'
  >('all');
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  // Card Spacing & Geometric Pattern State
  const [cardSpacing, setCardSpacing] = useState<CardSpacingPreset>(
    editingCard?.cardSpacing || 'normal'
  );
  const [cardPatternStyle, setCardPatternStyle] = useState<CardPatternStyle>(
    editingCard?.cardPattern || 'luxury'
  );
  const [downloadingPass, setDownloadingPass] = useState<boolean>(false);

  // Card Details & Layout State
  const [cardLogoPos, setCardLogoPos] = useState<'right' | 'center' | 'left'>(
    editingCard?.cardLogoPos || 'right'
  );
  const [cardSizeMode, setCardSizeMode] = useState<'compact' | 'standard' | 'tall'>(
    editingCard?.cardSizeMode || 'standard'
  );
  const [cardElementsPos, setCardElementsPos] = useState<'top' | 'bottom'>(
    editingCard?.cardElementsPos || 'top'
  );
  const [cardTitle, setCardTitle] = useState<string>(editingCard?.cardTitle || store.name);
  const [cardSubtitle, setCardSubtitle] = useState<string>(
    activeRuleSource.rewardDescription || 'بطاقة الولاء الرسمية'
  );
  const [cardSecondaryLogo, setCardSecondaryLogo] = useState<string>(
    editingCard?.secondaryLogo || store.secondaryLogo || ''
  );
  const [passWifi, setPassWifi] = useState<string>(
    editingCard?.wifiPassword || store.wifiPassword || 'AadaPass_Guest'
  );
  const [passInstagram, setPassInstagram] = useState<string>(
    editingCard?.instagramUrl || store.instagramUrl || 'https://instagram.com/aadapass.sa'
  );
  const [showPassWifi, setShowPassWifi] = useState<boolean>(editingCard?.showPassWifi ?? true);
  const [showPassInstagram, setShowPassInstagram] = useState<boolean>(
    editingCard?.showPassInstagram ?? true
  );
  const [saving, setSaving] = useState<boolean>(false);
  const [origin, setOrigin] = useState<string>('https://aadapass.sa');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  // Sync state only when editingCard ID or store ID changes so live edits aren't overwritten
  useEffect(() => {
    const rule = editingCard ? editingCard.loyaltyRule : store.loyaltyRule;
    setCardDesignName(editingCard?.name || `بطاقة ولاء ${store.name}`);
    setCardTitle(editingCard?.cardTitle || store.name);
    setCardPattern(rule.type || 'stamps');
    setStampCount(Math.min(12, Math.max(3, rule.stampsRequired || 6)));
    setStampShape(rule.stampShape || 'coffee');
    setPointsCalcMode(rule.pointsCalcMode || 'per_amount');
    setCurrencyUnitAmount(rule.currencyUnitAmount || 10);
    setPointsPerUnit(rule.pointsPerUnit || 10);
    setPercentageRate(rule.percentageRate ?? 10);
    setRewardTargetPoints(rule.rewardTargetPoints || 100);
    if (rule.pointRules && rule.pointRules.length > 0) {
      setPointTiers(rule.pointRules);
    }
    setCardBg(
      editingCard?.cardColor || store.cardColor || 'from-[#0B1F3A] via-[#10325E] to-[#0284C7]'
    );
    setCardTextColor(
      ((editingCard?.cardTextColor || store.cardTextColor) as CardTextColorValue) || 'text-white'
    );
    setCardSpacing(editingCard?.cardSpacing || 'normal');
    setCardPatternStyle(editingCard?.cardPattern || 'luxury');
    setCardLogoPos(editingCard?.cardLogoPos || 'right');
    setCardSizeMode(editingCard?.cardSizeMode || 'standard');
    setCardElementsPos(editingCard?.cardElementsPos || 'top');
    setCardSubtitle(rule.rewardDescription || 'بطاقة الولاء الرسمية');
    setCardSecondaryLogo(editingCard?.secondaryLogo || store.secondaryLogo || '');
    setPassWifi(editingCard?.wifiPassword || store.wifiPassword || 'AadaPass_Guest');
    setPassInstagram(
      editingCard?.instagramUrl || store.instagramUrl || 'https://instagram.com/aadapass.sa'
    );
    setShowPassWifi(editingCard?.showPassWifi ?? true);
    setShowPassInstagram(editingCard?.showPassInstagram ?? true);
    setActiveTemplateId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingCard?.id, store.id]);

  const storeSlugOrId = store.slug || store.id;
  const storePublicUrl = `${origin}/stores/${encodeURIComponent(storeSlugOrId)}`;

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(storePublicUrl, {
      width: 480,
      margin: 2,
      color: { dark: '#0B1F3A', light: '#FFFFFF' },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [storePublicUrl]);

  const currencyLabel = store.currency === 'EGP' ? 'ج.م' : store.currency === 'AED' ? 'د.إ' : 'ر.س';

  const currentLoyaltyRule: LoyaltyRule = useMemo(
    () => ({
      ...store.loyaltyRule,
      type: cardPattern,
      stampsRequired: stampCount,
      stampShape,
      pointsCalcMode,
      currencyUnitAmount,
      pointsPerUnit,
      percentageRate,
      rewardTargetPoints,
      pointRules: pointTiers,
      rewardDescription: cardSubtitle,
    }),
    [
      store.loyaltyRule,
      cardPattern,
      stampCount,
      stampShape,
      pointsCalcMode,
      currencyUnitAmount,
      pointsPerUnit,
      percentageRate,
      rewardTargetPoints,
      pointTiers,
      cardSubtitle,
    ]
  );

  const simulatedEarnedPoints = useMemo(
    () => calculatePointsForAmount(currentLoyaltyRule, calcInvoiceAmount),
    [currentLoyaltyRule, calcInvoiceAmount]
  );

  const simulatedProgressPct = useMemo(() => {
    const target = Math.max(1, rewardTargetPoints);
    return Math.min(100, Math.round((simulatedEarnedPoints / target) * 100));
  }, [simulatedEarnedPoints, rewardTargetPoints]);

  const visitsToReward = useMemo(() => {
    if (simulatedEarnedPoints <= 0) return '—';
    return Math.max(1, Math.ceil(rewardTargetPoints / simulatedEarnedPoints));
  }, [simulatedEarnedPoints, rewardTargetPoints]);

  const filteredColorLibrary = useMemo(() => {
    if (colorCategory === 'الكل') return CARD_COLOR_LIBRARY;
    return CARD_COLOR_LIBRARY.filter((c) => c.category === colorCategory);
  }, [colorCategory]);

  const isDarkText = isLightCardTextColor(cardTextColor);
  const customGradientStops = useMemo(() => parseCustomCardGradient(cardBg), [cardBg]);
  const cardTextResolved = useMemo(() => resolveCardTextStyle(cardTextColor), [cardTextColor]);
  const activePatternConfig = useMemo(
    () => getCardPatternConfig(cardPatternStyle),
    [cardPatternStyle]
  );

  const handleSelectColorPreset = (gradient: string, recommendedText: CardTextColorValue) => {
    setCardBg(gradient);
    setCardTextColor(recommendedText);
  };

  const handleApplyReadyTemplate = (tpl: ReadyCardTemplate) => {
    setActiveTemplateId(tpl.id);
    setCardDesignName(`${tpl.name} — ${store.name}`);
    setCardPattern(tpl.cardType);
    setStampCount(Math.min(12, Math.max(3, tpl.stampsRequired || 6)));
    setPreviewFilledStamps((prev) => Math.min(prev, Math.min(12, Math.max(3, tpl.stampsRequired || 6))));
    setStampShape(tpl.stampShape);
    setPointsCalcMode(tpl.pointsCalcMode);
    setPointsPerUnit(tpl.pointsPerUnit);
    setCurrencyUnitAmount(tpl.currencyUnitAmount);
    setPercentageRate(tpl.percentageRate);
    setRewardTargetPoints(tpl.rewardTargetPoints);
    setCardBg(tpl.cardColor);
    setCardTextColor(tpl.cardTextColor);
    setCardSpacing(tpl.cardSpacing);
    setCardPatternStyle(tpl.cardPatternStyle);
    setCardSubtitle(tpl.rewardDescription);
    showToast(`تم تطبيق قالب "${tpl.title}" بنجاح! يمكنك التخصيص أو الحفظ مباشرة.`);
  };

  const handleDownloadStudioPass = async () => {
    setDownloadingPass(true);
    try {
      const dataUrl = await generatePassDataUrl({
        kind: cardPattern === 'stamps' ? 'store_stamps' : 'store_points',
        storeName: cardTitle || store.name,
        badgeLabel: cardPattern === 'stamps' ? 'بطاقة أختام متجر ☕' : 'بطاقة نقاط متجر ⭐',
        holderName: 'معاينة بطاقة العميل',
        primaryValue:
          cardPattern === 'stamps'
            ? `${previewFilledStamps} / ${stampCount} أختام`
            : `${previewCustomerPoints} / ${rewardTargetPoints} نقطة`,
        secondaryLabel: cardDesignName,
        rewardText: `المكافأة: ${cardSubtitle}`,
        qrPayload: storePublicUrl,
        codeText: `AADA-${storeSlugOrId.toUpperCase()}`,
        accentGradient: cardBg,
        expiryText: 'امسح الكود للانضمام وحفظ البطاقة على هاتفك فوراً',
        wifiPassword: showPassWifi ? passWifi : undefined,
        stampsCurrent: cardPattern === 'stamps' ? previewFilledStamps : undefined,
        stampsTarget: cardPattern === 'stamps' ? stampCount : undefined,
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `aada-pass-${storeSlugOrId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('تم تجهيز وحفظ البطاقة كصورة عالية الدقة للهاتف بنجاح!');
    } catch {
      showToast('تعذر توليد صورة البطاقة حالياً.');
    } finally {
      setDownloadingPass(false);
    }
  };

  const handleAddTier = () => {
    const lastMax = pointTiers.length > 0 ? pointTiers[pointTiers.length - 1].maxAmount : 0;
    setPointTiers((prev) => [
      ...prev,
      {
        minAmount: lastMax + 1,
        maxAmount: lastMax + 100,
        points: 50,
        tierCalcMode: 'points',
        percentageRate: 15,
      },
    ]);
  };

  const handleUpdateTier = (
    index: number,
    field: keyof PointTier,
    value: number | 'points' | 'percentage'
  ) => {
    setPointTiers((prev) =>
      prev.map((tier, idx) => {
        if (idx !== index) return tier;
        if (field === 'tierCalcMode') {
          return { ...tier, tierCalcMode: value as 'points' | 'percentage' };
        }
        return { ...tier, [field]: Math.max(0, Number(value) || 0) };
      })
    );
  };

  const handleRemoveTier = (index: number) => {
    if (pointTiers.length <= 1) return;
    setPointTiers((prev) => prev.filter((_, idx) => idx !== index));
  };

  const buildUpdatedCardDesigns = (asNewCard: boolean): StoreCardDesign[] => {
    const existingList: StoreCardDesign[] =
      store.cardDesigns && store.cardDesigns.length > 0
        ? [...store.cardDesigns]
        : [
            {
              id: `cd-default-${store.id}`,
              name: `بطاقة ولاء ${store.name} الأساسية`,
              cardColor: store.cardColor,
              cardTextColor: store.cardTextColor,
              secondaryLogo: store.secondaryLogo,
              loyaltyRule: store.loyaltyRule,
              isActive: true,
              isDefault: true,
              createdAt: new Date().toISOString().slice(0, 10),
              printedCount: 1,
            },
          ];

    if (asNewCard || !editingCard) {
      const newCard: StoreCardDesign = {
        id: `cd-${Date.now().toString(36)}`,
        name: cardDesignName.trim() || `بطاقة ${store.name} #${existingList.length + 1}`,
        cardTitle: cardTitle.trim() || store.name,
        description: cardSubtitle,
        cardColor: cardBg,
        cardTextColor,
        cardSpacing,
        cardPattern: cardPatternStyle,
        cardCategory: cardPattern === 'stamps' ? 'store_stamps' : 'store_points',
        cardLogoPos,
        cardSizeMode,
        cardElementsPos,
        secondaryLogo: cardSecondaryLogo.trim() || undefined,
        wifiPassword: showPassWifi ? passWifi : undefined,
        instagramUrl: showPassInstagram ? passInstagram : undefined,
        showPassWifi,
        showPassInstagram,
        loyaltyRule: currentLoyaltyRule,
        active: true,
        isActive: true,
        isDefault: existingList.length === 0,
        createdAt: new Date().toISOString().slice(0, 10),
        printedCount: 0,
      };
      if (asNewCard) {
        return [newCard, ...existingList];
      }
      // Updating the default card when not explicitly editing a secondary card
      const defaultIdx = existingList.findIndex((c) => c.isDefault);
      if (defaultIdx >= 0) {
        existingList[defaultIdx] = {
          ...existingList[defaultIdx],
          name: cardDesignName.trim() || existingList[defaultIdx].name,
          cardTitle: cardTitle.trim() || store.name,
          description: cardSubtitle,
          cardColor: cardBg,
          cardTextColor,
          cardSpacing,
          cardPattern: cardPatternStyle,
          cardCategory: cardPattern === 'stamps' ? 'store_stamps' : 'store_points',
          cardLogoPos,
          cardSizeMode,
          cardElementsPos,
          secondaryLogo: cardSecondaryLogo.trim() || undefined,
          wifiPassword: showPassWifi ? passWifi : undefined,
          instagramUrl: showPassInstagram ? passInstagram : undefined,
          showPassWifi,
          showPassInstagram,
          loyaltyRule: currentLoyaltyRule,
          active: true,
          isActive: true,
        };
        return existingList;
      }
      return [newCard, ...existingList];
    }

    return existingList.map((c) =>
      c.id === editingCard.id
        ? {
            ...c,
            name: cardDesignName.trim() || c.name,
            cardTitle: cardTitle.trim() || store.name,
            description: cardSubtitle,
            cardColor: cardBg,
            cardTextColor,
            cardSpacing,
            cardPattern: cardPatternStyle,
            cardCategory: cardPattern === 'stamps' ? 'store_stamps' : 'store_points',
            cardLogoPos,
            cardSizeMode,
            cardElementsPos,
            secondaryLogo: cardSecondaryLogo.trim() || undefined,
            wifiPassword: showPassWifi ? passWifi : undefined,
            instagramUrl: showPassInstagram ? passInstagram : undefined,
            showPassWifi,
            showPassInstagram,
            loyaltyRule: currentLoyaltyRule,
            active: true,
            isActive: true,
          }
        : c
    );
  };

  const handleSave = async (asNewCard = false) => {
    setSaving(true);
    try {
      const updatedDesigns = buildUpdatedCardDesigns(asNewCard);
      const defaultCard = updatedDesigns.find((c) => c.isDefault) || updatedDesigns[0];
      await onSaveDesign({
        cardColor: defaultCard.cardColor,
        cardTextColor: defaultCard.cardTextColor,
        secondaryLogo: defaultCard.secondaryLogo,
        wifiPassword: showPassWifi ? passWifi : store.wifiPassword,
        instagramUrl: showPassInstagram ? passInstagram : store.instagramUrl,
        loyaltyRule: defaultCard.loyaltyRule,
        cardDesigns: updatedDesigns,
      });
      showToast(
        asNewCard
          ? `تمت إضافة البطاقة الجديدة "${cardDesignName}" إلى قائمة بطاقات المتجر!`
          : 'تم حفظ تصميم البطاقة وقواعد الولاء بنجاح!'
      );
      if (onClearEditingCard && editingCard) {
        onClearEditingCard();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setCardPattern('stamps');
    setStampCount(6);
    setStampShape('coffee');
    setPointsCalcMode('per_amount');
    setCurrencyUnitAmount(10);
    setPointsPerUnit(10);
    setPercentageRate(10);
    setRewardTargetPoints(100);
    setCardBg('from-[#0B1F3A] via-[#10325E] to-[#0284C7]');
    setCardTextColor('text-white');
    setCardSpacing('normal');
    setCardPatternStyle('luxury');
    setCardLogoPos('right');
    setCardSizeMode('standard');
    setCardElementsPos('top');
    setCardTitle(store.name);
    setCardSubtitle(store.loyaltyRule.rewardDescription || 'بطاقة الولاء الرسمية');
    showToast('تمت إعادة التصميم إلى الوضع الافتراضي.');
  };

  const previewTargetPoints = Math.max(1, rewardTargetPoints);
  const previewPointsPct = Math.min(
    100,
    Math.round((previewCustomerPoints / previewTargetPoints) * 100)
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-2xl font-black text-[#0B1F3A] dark:text-white">
            تصميم البطاقات واستوديو الهوية الرقمية
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            يمكنك تصميم أكثر من بطاقة ولاء لمتجرك (بطاقة نقاط، بطاقة أختام، بطاقة حساب VIP)، وحفظها في قائمة البطاقات لمراجعتها وطباعتها في أي وقت.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onNavigateToCardReview && (
            <button
              type="button"
              onClick={onNavigateToCardReview}
              className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#0B1F3A] dark:text-white text-xs font-black flex items-center gap-1.5 cursor-pointer hover:border-[#007BFF]"
            >
              <Layers className="w-4 h-4 text-[#007BFF]" />
              <span>مراجعة البطاقات وطباعتها ({store.cardDesigns?.length || 1})</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenQrPoster}
            className="px-4 py-2 rounded-xl bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة ورقة الباركود والرابط</span>
          </button>
        </div>
      </div>

      {/* Ready-Made Templates Library (3 System Types) */}
      <div className="glass-card p-5 sm:p-6 rounded-3xl border border-amber-200/80 dark:border-amber-500/25 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-[#0B1F3A] dark:text-white">
                مكتبة الأنماط والقوالب الجاهزة (تجهيز فوري بضغطة واحدة)
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                اختر من بين 16 قالباً احترافياً لمختلف الأنشطة التجارية (كافيهات، مطاعم، صالونات، عطور، مغاسل، ومتاجر)
              </p>
            </div>
          </div>

          {/* Template Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
            {[
              { id: 'all', label: 'الكل (16)' },
              { id: 'store_stamps', label: 'أختام المتجر' },
              { id: 'store_points', label: 'نقاط المتجر' },
              { id: 'account_master', label: 'الحساب الشامل VIP' },
            ].map((tab) => {
              const active = tplCategoryFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTplCategoryFilter(tab.id as 'all' | 'store_stamps' | 'store_points' | 'account_master')}
                  className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                    active
                      ? 'bg-[#0B1F3A] dark:bg-white text-white dark:text-[#0B1F3A] font-black shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {CARD_READY_TEMPLATES.filter((tpl) => {
            if (tplCategoryFilter === 'all') return true;
            return tpl.cardCategory === tplCategoryFilter;
          }).map((tpl) => {
            const isSelectedTpl = activeTemplateId === tpl.id;
            const tplTextStyle = resolveCardTextStyle(tpl.cardTextColor);
            const tplPattern = getCardPatternConfig(tpl.cardPatternStyle);
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleApplyReadyTemplate(tpl)}
                className={`group text-right p-4 rounded-2xl border bg-white/95 dark:bg-slate-900/85 hover:border-[#007BFF] hover:shadow-lg transition flex flex-col justify-between gap-3 cursor-pointer ${
                  isSelectedTpl
                    ? 'border-[#007BFF] ring-2 ring-[#00C2FF]/40 shadow-md'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="space-y-2.5 w-full">
                  <div
                    className={`h-14 w-full rounded-xl bg-gradient-to-br ${resolveCardGradientClass(
                      tpl.cardColor
                    )} ${tplTextStyle.className} px-3.5 flex items-center justify-between shadow-sm relative overflow-hidden`}
                    style={{
                      backgroundImage: resolveCardCssGradient(tpl.cardColor),
                      ...tplTextStyle.style,
                    }}
                  >
                    {tpl.cardPatternStyle !== 'none' && (
                      <div
                        className="pointer-events-none absolute inset-0"
                        style={tplPattern.overlayStyle}
                      />
                    )}
                    <span className="relative z-10 text-[11px] font-black truncate">
                      {tpl.badgeText}
                    </span>
                    <StampShapeIcon
                      shape={tpl.stampShape}
                      className="relative z-10 w-5 h-5 shrink-0"
                    />
                  </div>
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded bg-sky-500/10 text-sky-700 dark:text-[#00C2FF] text-[10px] font-black mb-1">
                      {tpl.systemTypeLabel}
                    </span>
                    <div className="font-black text-xs text-[#0B1F3A] dark:text-white">
                      {tpl.title}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {tpl.subtitle}
                    </p>
                  </div>
                </div>
                <div className="text-[11px] font-black text-[#0284C7] dark:text-[#00C2FF] group-hover:underline flex items-center gap-1 pt-1 border-t border-slate-100 dark:border-slate-800 w-full justify-between">
                  <span>{isSelectedTpl ? '✓ القالب المطبّق حالياً' : 'تطبيق القالب'}</span>
                  <span>←</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Card Design Name & Multi-Card Bar */}
      <div className="glass-card p-5 rounded-3xl border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <label className="text-xs font-black text-[#0B1F3A] dark:text-white">
              اسم البطاقة في قائمة بطاقات المتجر:
            </label>
            {editingCard && (
              <span className="px-2.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[11px] font-black">
                وضع تعديل بطاقة: {editingCard.name}
              </span>
            )}
          </div>
          <input
            type="text"
            value={cardDesignName}
            onChange={(e) => setCardDesignName(e.target.value)}
            placeholder="مثال: بطاقة أختام القهوة اليومية / بطاقة نقاط VIP"
            className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-black text-[#0B1F3A] dark:text-white focus:outline-none focus:border-[#007BFF]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {editingCard && onClearEditingCard && (
            <button
              type="button"
              onClick={onClearEditingCard}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold"
            >
              إلغاء التعديل
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave(false)}
            className="px-4 py-2.5 rounded-xl bg-[#007BFF] hover:bg-blue-600 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{editingCard ? 'حفظ التعديلات على البطاقة' : 'حفظ البطاقة الأساسية'}</span>
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave(true)}
            className="px-4 py-2.5 rounded-xl bg-[#0B1F3A] dark:bg-emerald-600 hover:opacity-95 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4 text-[#FBBF24]" />
            <span>حفظ كبطاقة إضافية جديدة</span>
          </button>
        </div>
      </div>

      {/* Auto-generated Storefront QR Code & Direct Link Banner */}
      <div className="glass-card p-5 sm:p-6 rounded-3xl border border-sky-200/80 dark:border-sky-500/30 flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-4 min-w-0 w-full md:w-auto">
          <div className="w-24 h-24 rounded-2xl bg-white p-2 border border-slate-200 shadow-sm shrink-0 flex items-center justify-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR ${store.name}`}
                className="w-full h-full object-contain"
              />
            ) : (
              <QrCode className="w-12 h-12 text-[#0B1F3A]" />
            )}
          </div>
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="text-xs font-black text-sky-700 dark:text-[#00C2FF] flex items-center gap-1.5">
              <QrCode className="w-4 h-4" />
              <span>باركود ورابط صفحة المتجر التلقائي (جاهز للطباعة)</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              أي عميل أو زائر يمسح هذا الباركود بكاميرا هاتفه سيفتح له مباشرة رابط صفحة متجرك على الموقع لاستعراض المنيو وحفظ بطاقتك.
            </p>
            <div
              dir="ltr"
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[11px] text-[#0B1F3A] dark:text-sky-300 truncate max-w-md"
            >
              {storePublicUrl}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(storePublicUrl);
                setCopiedUrl(true);
                showToast('تم نسخ رابط صفحة المتجر بنجاح!');
                setTimeout(() => setCopiedUrl(false), 2000);
              } catch {
                // ignore
              }
            }}
            className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedUrl ? 'تم النسخ' : 'نسخ الرابط'}</span>
          </button>
          <a
            href={`/stores/${encodeURIComponent(storeSlugOrId)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-[#00C2FF] border border-sky-200 dark:border-sky-800 text-xs font-black flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>فتح الصفحة</span>
          </a>
          {qrDataUrl && (
            <a
              href={qrDataUrl}
              download={`qr-${storeSlugOrId}.png`}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تحميل PNG</span>
            </a>
          )}
          <button
            type="button"
            onClick={onOpenQrPoster}
            className="px-4 py-2.5 rounded-xl bg-[#0B1F3A] hover:bg-[#10325E] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Printer className="w-3.5 h-3.5 text-[#FBBF24]" />
            <span>معاينة وطباعة الورقة</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* Controls Column */}
        <div className="lg:col-span-7 space-y-6 text-xs">
          {/* 1. Pattern Selector: Stamps vs Points */}
          <div className="glass-card p-6 rounded-3xl space-y-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-black text-[#0B1F3A] dark:text-white">
                  1. اختر نمط بطاقة الولاء
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  بدّل بين نمط الأختام أو نمط النقاط مع تخصيص كامل لكل نمط
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCardPattern('stamps')}
                className={`p-4 rounded-2xl border-2 text-right transition-all cursor-pointer flex items-start gap-3 ${
                  cardPattern === 'stamps'
                    ? 'border-[#0284C7] bg-sky-50/90 dark:bg-sky-950/50 shadow-md shadow-sky-500/10'
                    : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 hover:border-sky-300'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    cardPattern === 'stamps'
                      ? 'bg-gradient-electric text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  <Stamp className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-black text-sm text-[#0B1F3A] dark:text-white">
                    نمط الأختام
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    مربعات أختام تفاعلية مع اختيار عدد الأختام وشكل الختم المناسب لنشاطك.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setCardPattern('points')}
                className={`p-4 rounded-2xl border-2 text-right transition-all cursor-pointer flex items-start gap-3 ${
                  cardPattern === 'points'
                    ? 'border-[#F59E0B] bg-amber-50/90 dark:bg-amber-950/30 shadow-md shadow-amber-500/10'
                    : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 hover:border-amber-300'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    cardPattern === 'points'
                      ? 'bg-gradient-gold-cta text-[#0B1F3A]'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-black text-sm text-[#0B1F3A] dark:text-white">
                    نمط النقاط والحاسبة
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    تحديد النقاط لكل مبلغ أو حسب الشرائح مع حاسبة فورية لنقاط العميل.
                  </p>
                </div>
              </button>
            </div>

            {/* Pattern-Specific Config: STAMPS */}
            {cardPattern === 'stamps' && (
              <div className="p-5 rounded-2xl bg-sky-50/60 dark:bg-slate-900/70 border border-sky-200/80 dark:border-slate-700 space-y-5">
                {/* Stamp Count Selector */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="font-black text-[#0B1F3A] dark:text-white text-xs">
                      عدد الأختام المطلوبة للمكافأة
                    </label>
                    <span className="text-[11px] font-black text-[#0284C7] dark:text-[#00C2FF]">
                      المختار: {stampCount} أختام
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {[4, 5, 6, 8, 10, 12].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => {
                          setStampCount(cnt);
                          setPreviewFilledStamps((prev) => Math.min(prev, cnt));
                        }}
                        className={`px-3.5 py-2 rounded-xl font-black text-xs transition cursor-pointer ${
                          stampCount === cnt
                            ? 'bg-gradient-electric text-white shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-sky-400'
                        }`}
                      >
                        {cnt} أختام
                      </button>
                    ))}
                    <div className="flex items-center gap-1.5 mr-auto">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                        مخصص:
                      </span>
                      <input
                        type="number"
                        min={3}
                        max={12}
                        value={stampCount}
                        onChange={(e) => {
                          const val = Math.min(12, Math.max(3, Number(e.target.value) || 6));
                          setStampCount(val);
                          setPreviewFilledStamps((prev) => Math.min(prev, val));
                        }}
                        className="w-16 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center font-black text-[#0B1F3A] dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Stamp Shape Selector */}
                <div className="space-y-2.5">
                  <label className="font-black text-[#0B1F3A] dark:text-white text-xs block">
                    اختر شكل الختم على البطاقة
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {STAMP_SHAPE_OPTIONS.map((opt) => {
                      const active = stampShape === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setStampShape(opt.id)}
                          className={`p-3 rounded-2xl border text-right flex items-center gap-2.5 transition cursor-pointer ${
                            active
                              ? 'border-[#0284C7] bg-white dark:bg-slate-800 shadow-md ring-2 ring-[#00C2FF]/30'
                              : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-800'
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              active
                                ? 'bg-gradient-electric text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            <StampShapeIcon shape={opt.id} className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-[11px] text-[#0B1F3A] dark:text-white truncate">
                              {opt.label}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {opt.description}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Pattern-Specific Config: POINTS + CALCULATOR */}
            {cardPattern === 'points' && (
              <div className="p-5 rounded-2xl bg-amber-50/50 dark:bg-slate-900/70 border border-amber-200/80 dark:border-slate-700 space-y-5">
                {/* Method Switcher (3 modes: per_amount | percentage | tiers) */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-black text-[#0B1F3A] dark:text-white text-xs">
                    شريط احتساب النقاط (عدد نقاط ومبلغ / نسبة % / من وإلى مبلغ):
                  </span>
                  <div className="inline-flex flex-wrap p-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 gap-1">
                    <button
                      type="button"
                      onClick={() => setPointsCalcMode('per_amount')}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition cursor-pointer ${
                        pointsCalcMode === 'per_amount'
                          ? 'bg-gradient-gold-cta text-[#0B1F3A]'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      عدد نقاط لكل مبلغ
                    </button>
                    <button
                      type="button"
                      onClick={() => setPointsCalcMode('percentage')}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition cursor-pointer flex items-center gap-1 ${
                        pointsCalcMode === 'percentage'
                          ? 'bg-gradient-gold-cta text-[#0B1F3A]'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Percent className="w-3 h-3" />
                      <span>نسبة % من المبلغ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPointsCalcMode('tiers')}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition cursor-pointer ${
                        pointsCalcMode === 'tiers'
                          ? 'bg-gradient-gold-cta text-[#0B1F3A]'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      من وإلى مبلغ (عدد أو نسبة %)
                    </button>
                  </div>
                </div>

                {/* Mode 1: Fixed per amount */}
                {pointsCalcMode === 'per_amount' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                        لكل مبلغ ({currencyLabel})
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={currencyUnitAmount}
                        onChange={(e) =>
                          setCurrencyUnitAmount(Math.max(1, Number(e.target.value) || 1))
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-black text-[#0B1F3A] dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                        يكسب العميل (عدد النقاط)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={pointsPerUnit}
                        onChange={(e) =>
                          setPointsPerUnit(Math.max(1, Number(e.target.value) || 1))
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-black text-[#0B1F3A] dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                        هدف المكافأة (نقطة)
                      </label>
                      <input
                        type="number"
                        min={10}
                        step={10}
                        value={rewardTargetPoints}
                        onChange={(e) =>
                          setRewardTargetPoints(Math.max(10, Number(e.target.value) || 100))
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-black text-[#0B1F3A] dark:text-white"
                      />
                    </div>
                  </div>
                )}

                {/* Mode 2: Percentage of Invoice */}
                {pointsCalcMode === 'percentage' && (
                  <div className="space-y-3 bg-white/80 dark:bg-slate-900/80 p-4 rounded-2xl border border-amber-200/80 dark:border-slate-700">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="font-black text-[#0B1F3A] dark:text-white text-xs">
                            نسبة النقاط من إجمالي الفاتورة (%)
                          </label>
                          <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-800 dark:text-[#FBBF24] font-black font-mono text-xs">
                            {percentageRate}%
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min={1}
                            max={50}
                            step={1}
                            value={percentageRate}
                            onChange={(e) => setPercentageRate(Number(e.target.value))}
                            className="flex-1 accent-[#F59E0B]"
                          />
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={percentageRate}
                            onChange={(e) =>
                              setPercentageRate(Math.max(1, Math.min(100, Number(e.target.value) || 1)))
                            }
                            className="w-20 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-black text-center"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                          هدف المكافأة (نقطة)
                        </label>
                        <input
                          type="number"
                          min={10}
                          step={10}
                          value={rewardTargetPoints}
                          onChange={(e) =>
                            setRewardTargetPoints(Math.max(10, Number(e.target.value) || 100))
                          }
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-black text-[#0B1F3A] dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Mode 3: Spend Tiers (From - To with Points or Percentage) */}
                {pointsCalcMode === 'tiers' && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-slate-600 dark:text-slate-300">
                        شرائح من وإلى مبلغ (حدد لكل شريحة عدد نقاط ثابت أو نسبة %)
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500">هدف المكافأة:</span>
                        <input
                          type="number"
                          min={10}
                          value={rewardTargetPoints}
                          onChange={(e) =>
                            setRewardTargetPoints(Math.max(10, Number(e.target.value) || 100))
                          }
                          className="w-20 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-black text-center"
                        />
                        <button
                          type="button"
                          onClick={handleAddTier}
                          className="px-3 py-1.5 rounded-xl bg-gradient-electric text-white font-black flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          إضافة شريحة
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {pointTiers.map((tier, idx) => {
                        const mode = tier.tierCalcMode || 'points';
                        return (
                          <div
                            key={idx}
                            className="grid grid-cols-12 gap-2 items-center bg-white/90 dark:bg-slate-900/90 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700"
                          >
                            <div className="col-span-3 sm:col-span-2">
                              <span className="block text-[10px] text-slate-400">
                                من ({currencyLabel})
                              </span>
                              <input
                                type="number"
                                value={tier.minAmount}
                                onChange={(e) =>
                                  handleUpdateTier(idx, 'minAmount', Number(e.target.value))
                                }
                                className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                              />
                            </div>
                            <div className="col-span-3 sm:col-span-2">
                              <span className="block text-[10px] text-slate-400">
                                إلى ({currencyLabel})
                              </span>
                              <input
                                type="number"
                                value={tier.maxAmount}
                                onChange={(e) =>
                                  handleUpdateTier(idx, 'maxAmount', Number(e.target.value))
                                }
                                className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                              />
                            </div>
                            <div className="col-span-6 sm:col-span-3">
                              <span className="block text-[10px] text-slate-400">نوع الاحتساب</span>
                              <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateTier(idx, 'tierCalcMode', 'points')}
                                  className={`py-1 rounded text-[10px] font-black ${
                                    mode === 'points'
                                      ? 'bg-[#0B1F3A] text-white'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  عدد نقاط
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateTier(idx, 'tierCalcMode', 'percentage')
                                  }
                                  className={`py-1 rounded text-[10px] font-black ${
                                    mode === 'percentage'
                                      ? 'bg-[#007BFF] text-white'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  نسبة %
                                </button>
                              </div>
                            </div>
                            <div className="col-span-10 sm:col-span-4">
                              <span className="block text-[10px] text-slate-400">
                                {mode === 'percentage' ? 'النسبة من المبلغ (%)' : 'النقاط المضافة'}
                              </span>
                              {mode === 'percentage' ? (
                                <input
                                  type="number"
                                  min={1}
                                  max={100}
                                  value={tier.percentageRate ?? 10}
                                  onChange={(e) =>
                                    handleUpdateTier(idx, 'percentageRate', Number(e.target.value))
                                  }
                                  className="w-full px-2 py-1 rounded-lg bg-sky-50 dark:bg-slate-800 border border-sky-200 dark:border-slate-700 font-black text-sky-800 dark:text-[#00C2FF]"
                                />
                              ) : (
                                <input
                                  type="number"
                                  value={tier.points}
                                  onChange={(e) =>
                                    handleUpdateTier(idx, 'points', Number(e.target.value))
                                  }
                                  className="w-full px-2 py-1 rounded-lg bg-amber-50 dark:bg-slate-800 border border-amber-200 dark:border-slate-700 font-black text-amber-800 dark:text-[#FBBF24]"
                                />
                              )}
                            </div>
                            <div className="col-span-2 sm:col-span-1 flex justify-end">
                              <button
                                type="button"
                                onClick={() => handleRemoveTier(idx)}
                                disabled={pointTiers.length <= 1}
                                className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-30 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Interactive Points Calculator */}
                <div className="p-4 rounded-2xl bg-gradient-navy text-white space-y-3 shadow-md">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-[#FBBF24]" />
                      <span className="font-black text-xs">شريط محاكاة واحتساب النقاط التفاعلي</span>
                    </div>
                    <span className="text-[11px] text-sky-200">
                      {pointsCalcMode === 'per_amount'
                        ? `كل ${currencyUnitAmount} ${currencyLabel} = ${pointsPerUnit} نقطة`
                        : pointsCalcMode === 'percentage'
                        ? `نسبة ${percentageRate}% من قيمة الفاتورة`
                        : 'الحساب حسب شريحة الإنفاق (عدد أو نسبة %)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-5 space-y-1.5">
                      <label className="block text-[11px] text-sky-100 font-bold">
                        جرّب قيمة فاتورة العميل ({currencyLabel}):
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={calcInvoiceAmount}
                          onChange={(e) =>
                            setCalcInvoiceAmount(Math.max(1, Number(e.target.value) || 1))
                          }
                          className="w-24 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white font-black text-sm focus:outline-none focus:border-[#00C2FF]"
                        />
                        <input
                          type="range"
                          min={5}
                          max={500}
                          step={5}
                          value={Math.min(500, calcInvoiceAmount)}
                          onChange={(e) => setCalcInvoiceAmount(Number(e.target.value))}
                          className="flex-1 accent-[#FBBF24]"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-7 grid grid-cols-3 gap-2 text-center">
                      <div className="p-2.5 rounded-xl bg-white/10 border border-white/15">
                        <span className="block text-[10px] text-sky-200">يكسب العميل</span>
                        <strong className="text-base font-black text-[#FBBF24]">
                          +{simulatedEarnedPoints} نقطة
                        </strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white/10 border border-white/15">
                        <span className="block text-[10px] text-sky-200">التقدم للمكافأة</span>
                        <strong className="text-base font-black text-[#00C2FF]">
                          {simulatedProgressPct}%
                        </strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white/10 border border-white/15">
                        <span className="block text-[10px] text-sky-200">زيارات للمكافأة</span>
                        <strong className="text-base font-black text-emerald-300">
                          {visitsToReward}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. Card Color Library & Text Color Library */}
          <div className="glass-card p-6 rounded-3xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-electric text-white flex items-center justify-center">
                  <Palette className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-[#0B1F3A] dark:text-white">
                    2. مكتبة ألوان البطاقات وألوان النصوص الجاهزة
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    اختر ثيماً لونياً متناسقاً للبطاقة مع اختيار لون النص الملائم تلقائياً أو يدوياً
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(['الكل', 'داكن فاخر', 'حيوي مشرق', 'فاتح أنيق'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setColorCategory(cat)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                      colorCategory === cat
                        ? 'bg-[#0B1F3A] text-white dark:bg-[#00C2FF] dark:text-[#0B1F3A]'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Card Gradient Swatches Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredColorLibrary.map((preset) => {
                const selected = cardBg === preset.gradient;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      handleSelectColorPreset(preset.gradient, preset.recommendedTextColor)
                    }
                    className={`group rounded-2xl p-2 border text-right transition cursor-pointer ${
                      selected
                        ? 'border-[#0284C7] ring-2 ring-[#00C2FF]/40 bg-sky-50/70 dark:bg-slate-800 shadow-md'
                        : 'border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 hover:border-sky-300'
                    }`}
                  >
                    <div
                      className={`h-12 w-full rounded-xl bg-gradient-to-br ${preset.gradient} border border-black/10 relative flex items-center justify-between px-2.5`}
                      style={{ backgroundImage: preset.cssGradient }}
                    >
                      <span className={`text-[10px] font-black ${preset.recommendedTextColor}`}>
                        أب 123
                      </span>
                      {selected && (
                        <CheckCircle2
                          className={`w-4 h-4 ${
                            isLightCardTextColor(preset.recommendedTextColor)
                              ? 'text-[#0B1F3A]'
                              : 'text-white'
                          }`}
                        />
                      )}
                    </div>
                    <div className="pt-2 px-1">
                      <div className="font-black text-[11px] text-[#0B1F3A] dark:text-white truncate">
                        {preset.name}
                      </div>
                      <div className="text-[10px] text-slate-400">{preset.category}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom Brand Gradient Color Picker */}
            <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="font-black text-xs text-[#0B1F3A] dark:text-white">
                  تخصيص لون البطاقة يدوياً (لون البداية والنهاية)
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  اختر أي درجتين لونيّتين مطابقتين لهوية متجرك وستتحدّث المعاينة فوراً
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                  <span>لون 1</span>
                  <input
                    type="color"
                    value={customGradientStops.fromHex}
                    onChange={(e) =>
                      setCardBg(`custom:${e.target.value}:${customGradientStops.toHex}`)
                    }
                    className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer bg-transparent p-0.5"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                  <span>لون 2</span>
                  <input
                    type="color"
                    value={customGradientStops.toHex}
                    onChange={(e) =>
                      setCardBg(`custom:${customGradientStops.fromHex}:${e.target.value}`)
                    }
                    className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer bg-transparent p-0.5"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                  <span>لون النص</span>
                  <input
                    type="color"
                    value={cardTextResolved.style?.color || '#FFFFFF'}
                    onChange={(e) => setCardTextColor(e.target.value)}
                    className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer bg-transparent p-0.5"
                  />
                </label>
              </div>
            </div>

            {/* Ready-made Text Colors Library */}
            <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700/70 space-y-3">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-[#0284C7] dark:text-[#00C2FF]" />
                <span className="font-black text-[#0B1F3A] dark:text-white text-xs">
                  مكتبة ألوان النصوص الجاهزة على البطاقة
                </span>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {CARD_TEXT_COLOR_LIBRARY.map((txt) => {
                  const selected = cardTextColor === txt.className;
                  return (
                    <button
                      key={txt.id}
                      type="button"
                      onClick={() => setCardTextColor(txt.className)}
                      className={`px-3 py-2 rounded-2xl border flex items-center gap-2 transition cursor-pointer ${
                        selected
                          ? 'border-[#0284C7] bg-sky-50 dark:bg-sky-950/60 ring-2 ring-[#00C2FF]/30 font-black'
                          : 'border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/70 hover:border-sky-300 font-bold'
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded-full border border-slate-300 shadow-xs flex items-center justify-center text-[9px] font-black"
                        style={{
                          backgroundColor: txt.forLightBg ? '#FFFFFF' : '#0B1F3A',
                          color: txt.swatchHex,
                        }}
                      >
                        أ
                      </span>
                      <span className="text-[11px] text-[#0B1F3A] dark:text-slate-100">
                        {txt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. Card Texts, Spacing, Patterns & Back-of-Card Details */}
          <div className="glass-card p-6 rounded-3xl space-y-5">
            <h4 className="text-sm font-black text-[#0B1F3A] dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              3. مكتبة التباعد والهوامش والنقوش الهندسية وتوزيع العناصر
            </h4>

            {/* Spacing Library */}
            <div className="space-y-2">
              <label className="font-black text-[#0B1F3A] dark:text-white text-xs block">
                مكتبة التباعد والمسافات الداخلية للبطاقة (Card Spacing):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                {CARD_SPACING_PRESETS.map((sp) => {
                  const active = cardSpacing === sp.id;
                  return (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => setCardSpacing(sp.id)}
                      className={`p-3 rounded-2xl border text-right transition cursor-pointer ${
                        active
                          ? 'border-[#0284C7] bg-sky-50 dark:bg-sky-950/60 ring-2 ring-[#00C2FF]/30'
                          : 'border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 hover:border-sky-300'
                      }`}
                    >
                      <div className="font-black text-xs text-[#0B1F3A] dark:text-white">
                        {sp.label}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                        {sp.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pattern Overlay Library */}
            <div className="space-y-2">
              <label className="font-black text-[#0B1F3A] dark:text-white text-xs block">
                مكتبة الأنماط والنقوش الخلفية للبطاقة (Pattern Overlay):
              </label>
              <div className="flex flex-wrap gap-2">
                {CARD_PATTERN_PRESETS.map((pat) => {
                  const active = cardPatternStyle === pat.id;
                  return (
                    <button
                      key={pat.id}
                      type="button"
                      onClick={() => setCardPatternStyle(pat.id)}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-black transition cursor-pointer ${
                        active
                          ? 'border-[#0284C7] bg-[#0B1F3A] text-[#FACC15]'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {pat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300">مكان الشعار</label>
                <select
                  value={cardLogoPos}
                  onChange={(e) => setCardLogoPos(e.target.value as 'right' | 'center' | 'left')}
                  className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-bold"
                >
                  <option value="right">أعلى اليمين</option>
                  <option value="center">المنتصف</option>
                  <option value="left">أعلى اليسار</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300">أبعاد البطاقة</label>
                <select
                  value={cardSizeMode}
                  onChange={(e) =>
                    setCardSizeMode(e.target.value as 'compact' | 'standard' | 'tall')
                  }
                  className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-bold"
                >
                  <option value="compact">مضغوط</option>
                  <option value="standard">قياسي</option>
                  <option value="tall">موسّع</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300">
                  موضع الأختام / النقاط
                </label>
                <select
                  value={cardElementsPos}
                  onChange={(e) => setCardElementsPos(e.target.value as 'top' | 'bottom')}
                  className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-bold"
                >
                  <option value="top">أعلى رمز المسح</option>
                  <option value="bottom">أسفل رمز المسح</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300">
                  اسم المتجر على البطاقة
                </label>
                <input
                  type="text"
                  value={cardTitle}
                  onChange={(e) => setCardTitle(e.target.value)}
                  className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300">
                  شعار إضافي (رابط اختياري)
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={cardSecondaryLogo}
                  onChange={(e) => setCardSecondaryLogo(e.target.value)}
                  className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-600 dark:text-slate-300">
                وصف المكافأة الظاهر للعميل
              </label>
              <input
                type="text"
                value={cardSubtitle}
                onChange={(e) => setCardSubtitle(e.target.value)}
                className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 font-bold"
              />
            </div>

            <div className="bg-sky-50/70 dark:bg-slate-800/70 p-4 rounded-2xl border border-sky-100 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-sky-600" /> كلمة مرور Wi-Fi
                  </span>
                  <input
                    type="checkbox"
                    checked={showPassWifi}
                    onChange={(e) => setShowPassWifi(e.target.checked)}
                    className="accent-sky-600"
                  />
                </label>
                <input
                  type="text"
                  value={passWifi}
                  onChange={(e) => setPassWifi(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    <Instagram className="w-3.5 h-3.5 text-pink-600" /> حساب إنستغرام
                  </span>
                  <input
                    type="checkbox"
                    checked={showPassInstagram}
                    onChange={(e) => setShowPassInstagram(e.target.checked)}
                    className="accent-pink-600"
                  />
                </label>
                <input
                  type="text"
                  value={passInstagram}
                  onChange={(e) => setPassInstagram(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(false)}
                className="bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] font-black px-6 py-3 rounded-xl shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-60"
              >
                {saving ? 'جاري الحفظ...' : editingCard ? 'حفظ تعديلات البطاقة' : 'حفظ وتفعيل تصميم البطاقة'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(true)}
                className="bg-[#0B1F3A] dark:bg-emerald-600 text-white font-black px-5 py-3 rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Plus className="w-4 h-4 text-[#FBBF24]" />
                <span>حفظ كبطاقة جديدة</span>
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold px-4 py-3 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة للافتراضي</span>
              </button>
              <button
                type="button"
                onClick={onOpenQrPoster}
                className="bg-gradient-navy text-white font-bold px-5 py-3 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-[#FBBF24]" />
                <span>طباعة ملصق QR للانضمام</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Phone Preview Column */}
        <div className="lg:col-span-5 flex flex-col items-center gap-4 lg:sticky lg:top-24">
          <div className="w-80 bg-[#0B1F3A] rounded-[2.8rem] p-3 shadow-2xl border-4 border-[#10325E]">
            <div className="bg-slate-50 rounded-[2.2rem] overflow-hidden p-4 space-y-3.5 text-slate-900">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 px-1">
                <span>9:41</span>
                <span>معاينة بطاقة الويب الرقمية</span>
              </div>

              {/* Actual Dynamic Loyalty Card */}
              <div
                className={`bg-gradient-to-br ${resolveCardGradientClass(cardBg)} ${
                  cardTextResolved.className
                } rounded-2xl shadow-lg transition-all relative overflow-hidden ${
                  CARD_SPACING_PRESETS.find((s) => s.id === cardSpacing)?.paddingClass || 'p-5'
                } ${
                  cardSizeMode === 'tall'
                    ? 'min-h-[310px] flex flex-col justify-between'
                    : cardSizeMode === 'compact'
                    ? 'text-[11px]'
                    : ''
                }`}
                style={{
                  backgroundImage: resolveCardCssGradient(cardBg),
                  ...cardTextResolved.style,
                }}
              >
                {/* Pattern Overlay (isolated so it never overwrites the card gradient) */}
                {cardPatternStyle !== 'none' && (
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={activePatternConfig.overlayStyle}
                  />
                )}
                <div className="relative z-10 space-y-3">
                  {/* Header with Logo & Balance */}
                  <div
                    className={`flex items-center gap-2 ${
                      cardLogoPos === 'center'
                        ? 'flex-col text-center'
                        : cardLogoPos === 'left'
                        ? 'flex-row-reverse justify-between'
                        : 'justify-between'
                    }`}
                  >
                  <div className="flex items-center gap-2">
                    <img
                      src={store.logo}
                      alt={store.name}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-xl object-cover bg-white shrink-0 shadow-xs"
                    />
                    <div>
                      <h4 className="font-black text-sm leading-tight">{cardTitle}</h4>
                      <span className="text-[11px] opacity-90 font-bold">
                        {cardPattern === 'stamps'
                          ? `${previewFilledStamps} / ${stampCount} أختام`
                          : `${previewCustomerPoints} / ${previewTargetPoints} نقطة`}
                      </span>
                    </div>
                  </div>
                  {cardSecondaryLogo && (
                    <img
                      src={cardSecondaryLogo}
                      alt="شعار ثانوي"
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-lg object-cover bg-white"
                    />
                  )}
                </div>

                {/* Pattern Progress Area (Top position) */}
                {cardElementsPos === 'top' && (
                  <>
                    {cardPattern === 'stamps' ? (
                      <div
                        className={`grid ${
                          CARD_SPACING_PRESETS.find((s) => s.id === cardSpacing)?.gapClass || 'gap-2'
                        } ${
                          stampCount <= 4
                            ? 'grid-cols-4'
                            : stampCount <= 6
                            ? 'grid-cols-6'
                            : stampCount <= 8
                            ? 'grid-cols-4'
                            : 'grid-cols-5'
                        }`}
                      >
                        {Array.from({ length: stampCount }).map((_, i) => {
                          const filled = i < previewFilledStamps;
                          const stampH =
                            CARD_SPACING_PRESETS.find((s) => s.id === cardSpacing)?.stampSizeClass ||
                            'h-9';
                          return (
                            <div
                              key={i}
                              className={`${stampH} rounded-xl flex items-center justify-center border transition ${
                                filled
                                  ? 'bg-white text-[#0B1F3A] border-white shadow-sm'
                                  : isDarkText
                                  ? 'bg-[#0B1F3A]/10 border-[#0B1F3A]/25 border-dashed'
                                  : 'bg-white/15 border-white/35 border-dashed'
                              }`}
                            >
                              <StampShapeIcon
                                shape={stampShape}
                                className={`w-4 h-4 ${filled ? 'opacity-100' : 'opacity-45'}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-2 py-1">
                        <div className="flex items-center justify-between text-[11px] font-black">
                          <span className="flex items-center gap-1">
                            <Award className="w-3.5 h-3.5" />
                            رصيد النقاط
                          </span>
                          <span>{previewPointsPct}%</span>
                        </div>
                        <div
                          className={`w-full h-2.5 rounded-full overflow-hidden ${
                            isDarkText ? 'bg-[#0B1F3A]/15' : 'bg-white/25'
                          }`}
                        >
                          <div
                            className="h-full bg-[#FBBF24] rounded-full transition-all"
                            style={{ width: `${previewPointsPct}%` }}
                          />
                        </div>
                        <div className="text-[10px] opacity-90 font-bold flex items-center justify-between">
                          <span>
                            {pointsCalcMode === 'per_amount'
                              ? `كل ${currencyUnitAmount} ${currencyLabel} = ${pointsPerUnit} نقطة`
                              : `${pointTiers.length} شرائح نقاط نشطة`}
                          </span>
                          <span>الهدف: {previewTargetPoints} نقطة</span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <p
                  className={`text-[11px] font-bold pt-2 border-t ${
                    isDarkText ? 'border-[#0B1F3A]/15' : 'border-white/20'
                  }`}
                >
                  🎁 {cardSubtitle}
                </p>

                <div className="bg-white p-2 rounded-xl w-20 h-20 mx-auto flex items-center justify-center shadow-sm">
                  <QrCode className="w-14 h-14 text-[#0B1F3A]" />
                </div>

                {/* Pattern Progress Area (Bottom position) */}
                {cardElementsPos === 'bottom' && (
                  <>
                    {cardPattern === 'stamps' ? (
                      <div
                        className={`grid gap-1.5 ${
                          stampCount <= 4
                            ? 'grid-cols-4'
                            : stampCount <= 6
                            ? 'grid-cols-6'
                            : stampCount <= 8
                            ? 'grid-cols-4'
                            : 'grid-cols-5'
                        }`}
                      >
                        {Array.from({ length: stampCount }).map((_, i) => {
                          const filled = i < previewFilledStamps;
                          return (
                            <div
                              key={i}
                              className={`h-8 rounded-xl flex items-center justify-center border transition ${
                                filled
                                  ? 'bg-white text-[#0B1F3A] border-white shadow-sm'
                                  : isDarkText
                                  ? 'bg-[#0B1F3A]/10 border-[#0B1F3A]/25 border-dashed'
                                  : 'bg-white/15 border-white/35 border-dashed'
                              }`}
                            >
                              <StampShapeIcon
                                shape={stampShape}
                                className={`w-4 h-4 ${filled ? 'opacity-100' : 'opacity-45'}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-2 py-1">
                        <div className="flex items-center justify-between text-[11px] font-black">
                          <span>رصيد النقاط</span>
                          <span>{previewPointsPct}%</span>
                        </div>
                        <div
                          className={`w-full h-2.5 rounded-full overflow-hidden ${
                            isDarkText ? 'bg-[#0B1F3A]/15' : 'bg-white/25'
                          }`}
                        >
                          <div
                            className="h-full bg-[#FBBF24] rounded-full transition-all"
                            style={{ width: `${previewPointsPct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
                </div>
              </div>

              {(showPassWifi || showPassInstagram) && (
                <div className="bg-white border border-slate-200 rounded-2xl p-2.5 space-y-1.5 text-[10px]">
                  {showPassWifi && (
                    <div className="flex items-center justify-between text-slate-700 font-bold">
                      <span className="flex items-center gap-1">
                        <Wifi className="w-3 h-3 text-sky-600" /> Wi-Fi
                      </span>
                      <span className="font-mono">{passWifi}</span>
                    </div>
                  )}
                  {showPassInstagram && (
                    <div className="flex items-center justify-between text-slate-700 font-bold">
                      <span className="flex items-center gap-1">
                        <Instagram className="w-3 h-3 text-pink-600" /> Instagram
                      </span>
                      <span className="font-mono text-pink-700 truncate max-w-[140px]" dir="ltr">
                        {passInstagram.replace('https://', '')}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Fast High-Res Phone Pass Saver */}
          <button
            type="button"
            disabled={downloadingPass}
            onClick={handleDownloadStudioPass}
            className="w-80 py-3 px-4 rounded-2xl bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] text-xs font-black flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            <span>
              {downloadingPass
                ? 'جاري تجهيز البطاقة للهاتف...'
                : 'تجهيز وحفظ البطاقة كصورة للهاتف (PNG)'}
            </span>
          </button>

          {/* Interactive Preview Balance Control */}
          <div className="w-80 glass-card p-3.5 rounded-2xl space-y-2 text-xs">
            <div className="flex items-center justify-between font-bold text-[#0B1F3A] dark:text-slate-200">
              <span>
                {cardPattern === 'stamps'
                  ? 'معاينة الأختام المكتملة:'
                  : 'معاينة رصيد النقاط:'}
              </span>
              <span className="text-[#0284C7] dark:text-[#00C2FF] font-black">
                {cardPattern === 'stamps'
                  ? `${previewFilledStamps} من ${stampCount}`
                  : `${previewCustomerPoints} من ${previewTargetPoints}`}
              </span>
            </div>
            {cardPattern === 'stamps' ? (
              <input
                type="range"
                min={0}
                max={stampCount}
                value={previewFilledStamps}
                onChange={(e) => setPreviewFilledStamps(Number(e.target.value))}
                className="w-full accent-[#0284C7]"
              />
            ) : (
              <input
                type="range"
                min={0}
                max={previewTargetPoints}
                step={5}
                value={Math.min(previewCustomerPoints, previewTargetPoints)}
                onChange={(e) => setPreviewCustomerPoints(Number(e.target.value))}
                className="w-full accent-[#F59E0B]"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
