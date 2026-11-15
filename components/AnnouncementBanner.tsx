'use client';

import React, { useState } from 'react';
import { AlertTriangle, BellRing, Megaphone, Sparkles, Wrench, X } from 'lucide-react';
import type { AnnouncementType, SiteAnnouncement } from '@/lib/types';
import { handleSectionHrefClick } from '@/lib/scrollToSection';

interface AnnouncementBannerProps {
  isBannerActive: boolean;
  bannerText?: string | null;
  bannerLinkUrl?: string | null;
  bannerColor?: string | null;
  announcements?: SiteAnnouncement[];
}

const COLOR_PRESET_STYLES: Record<SiteAnnouncement['colorPreset'], string> = {
  navy_gold: 'bg-gradient-to-r from-[#0B1F3A] via-[#10325E] to-[#0B1F3A] text-[#FBBF24]',
  sky: 'bg-gradient-to-r from-[#0284C7] via-[#0EA5E9] to-[#0284C7] text-white',
  amber: 'bg-gradient-to-r from-[#F59E0B] via-[#FBBF24] to-[#F59E0B] text-[#0B1F3A]',
  emerald: 'bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-700 text-white',
  rose: 'bg-gradient-to-r from-rose-700 via-rose-600 to-rose-700 text-white',
};

const TYPE_META: Record<AnnouncementType, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  announcement: { label: 'إعلان', Icon: Megaphone },
  alert: { label: 'تنبيه هام', Icon: AlertTriangle },
  offer: { label: 'عرض خاص', Icon: Sparkles },
  maintenance: { label: 'إشعار صيانة', Icon: Wrench },
};

export default function AnnouncementBanner({
  isBannerActive,
  bannerText,
  bannerLinkUrl,
  bannerColor,
  announcements = [],
}: AnnouncementBannerProps) {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const dismiss = (id: string) => {
    setDismissedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const activeTopBars = announcements.filter(
    (a) => a.isActive && a.placement === 'top_bar' && !dismissedIds.includes(a.id)
  );
  const activeFloatingToasts = announcements.filter(
    (a) => a.isActive && a.placement === 'floating_toast' && !dismissedIds.includes(a.id)
  );

  const showLegacyBanner = isBannerActive && Boolean(bannerText) && !dismissedIds.includes('legacy-banner');

  if (!showLegacyBanner && activeTopBars.length === 0 && activeFloatingToasts.length === 0) {
    return null;
  }

  const bgStyle =
    bannerColor || 'bg-gradient-to-r from-[#0B1F3A] via-[#10325E] to-[#0B1F3A] text-[#FBBF24]';

  return (
    <>
      <div className="relative z-50">
        {showLegacyBanner && bannerText && (
          <div className={`w-full py-2.5 px-4 text-center text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-md ${bgStyle}`}>
            <Megaphone className="w-4 h-4 shrink-0" />
            {bannerLinkUrl ? (
              <a
                href={bannerLinkUrl}
                onClick={(e) => handleSectionHrefClick(e, bannerLinkUrl)}
                className="hover:underline"
              >
                {bannerText}
              </a>
            ) : (
              <span>{bannerText}</span>
            )}
          </div>
        )}

        {activeTopBars.map((ann) => {
          const meta = TYPE_META[ann.type] || TYPE_META.announcement;
          const Icon = meta.Icon;
          const barClass = COLOR_PRESET_STYLES[ann.colorPreset] || COLOR_PRESET_STYLES.navy_gold;
          return (
            <div
              key={ann.id}
              dir="rtl"
              className={`w-full py-2.5 px-4 text-xs sm:text-sm font-black flex items-center justify-center gap-2.5 shadow-sm border-t border-white/10 ${barClass}`}
            >
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/20 text-[10px] font-black shrink-0">
                <Icon className="w-3 h-3" />
                <span>{meta.label}</span>
              </span>
              <span className="font-black">{ann.title}:</span>
              <span className="font-bold opacity-95">{ann.message}</span>
              {ann.linkUrl && (
                <a
                  href={ann.linkUrl}
                  onClick={(e) => handleSectionHrefClick(e, ann.linkUrl)}
                  className="px-2.5 py-0.5 rounded-full bg-white/20 hover:bg-white/30 text-[11px] font-black underline-offset-2 hover:underline shrink-0"
                >
                  {ann.linkText || 'التفاصيل'}
                </a>
              )}
              {ann.dismissible && (
                <button
                  type="button"
                  aria-label="إغلاق التنبيه"
                  onClick={() => dismiss(ann.id)}
                  className="mr-auto p-1 rounded-full hover:bg-black/20 transition cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Bottom Alerts / Offers */}
      {activeFloatingToasts.length > 0 && (
        <div
          dir="rtl"
          className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-[calc(100%-2.5rem)]"
        >
          {activeFloatingToasts.map((ann) => {
            const meta = TYPE_META[ann.type] || TYPE_META.alert;
            const Icon = meta.Icon || BellRing;
            const toastBg = COLOR_PRESET_STYLES[ann.colorPreset] || COLOR_PRESET_STYLES.navy_gold;
            return (
              <div
                key={ann.id}
                className={`rounded-2xl p-4 shadow-2xl border border-white/20 space-y-2 ${toastBg}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </span>
                    <div>
                      <span className="block text-[10px] font-black opacity-85">{meta.label}</span>
                      <h4 className="text-xs sm:text-sm font-black">{ann.title}</h4>
                    </div>
                  </div>
                  {ann.dismissible && (
                    <button
                      type="button"
                      aria-label="إغلاق التنبيه"
                      onClick={() => dismiss(ann.id)}
                      className="p-1 rounded-full hover:bg-black/20 transition cursor-pointer shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {ann.message && <p className="text-xs leading-relaxed opacity-95 font-medium">{ann.message}</p>}
                {ann.linkUrl && (
                  <a
                    href={ann.linkUrl}
                    onClick={(e) => handleSectionHrefClick(e, ann.linkUrl)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-[11px] font-black transition"
                  >
                    <span>{ann.linkText || 'عرض التفاصيل'}</span>
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
