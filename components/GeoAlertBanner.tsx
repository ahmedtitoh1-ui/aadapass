'use client';

import React, { useEffect, useState } from 'react';
import {
  Bell,
  Compass,
  ExternalLink,
  MapPin,
  Navigation,
  Sparkles,
  Tag,
  Volume2,
  X,
  CreditCard,
  Gift,
} from 'lucide-react';
import { GeofenceAlert } from '@/lib/types';
import { playGeofenceAlertChime, triggerHapticFeedback } from '@/lib/geolocationAlerts';

interface GeoAlertBannerProps {
  alert: GeofenceAlert | null;
  onDismiss: () => void;
  onOpenStoreCard?: (storeId: string) => void;
  onViewAllAlerts?: () => void;
  soundEnabled?: boolean;
}

export default function GeoAlertBanner({
  alert,
  onDismiss,
  onOpenStoreCard,
  onViewAllAlerts,
  soundEnabled = true,
}: GeoAlertBannerProps) {
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (!alert) return;

    if (soundEnabled) {
      playGeofenceAlertChime();
    }
    triggerHapticFeedback();

    const timer = setTimeout(() => {
      onDismiss();
    }, 11000);

    return () => clearTimeout(timer);
  }, [alert, soundEnabled, onDismiss]);

  if (!alert) return null;

  const handleCopyCode = (code: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const getAlertIcon = () => {
    switch (alert.alertType) {
      case 'ready_reward':
        return <Gift className="w-5 h-5 text-emerald-400" />;
      case 'double_points':
        return <Sparkles className="w-5 h-5 text-amber-300" />;
      case 'offer':
        return <Tag className="w-5 h-5 text-rose-400" />;
      default:
        return <MapPin className="w-5 h-5 text-sky-400" />;
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed top-4 inset-x-3 sm:inset-x-auto sm:right-6 sm:max-w-md z-50 animate-slideDown shadow-2xl rounded-3xl overflow-hidden border border-amber-400/50 bg-[#0B1F3A]/95 text-white backdrop-blur-xl"
    >
      {/* Top ambient highlight gradient */}
      <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-sky-400 to-emerald-400" />

      <div className="p-4 sm:p-5 space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={alert.storeLogo || '/icon-192.png'}
                alt={alert.storeName}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-2xl object-cover border-2 border-amber-400/60 shadow-md shrink-0 bg-white"
              />
              <span className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full bg-slate-900 border border-amber-400 flex items-center justify-center shadow-xs">
                {getAlertIcon()}
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  <MapPin className="w-3 h-3" />
                  {alert.distanceText}
                </span>
                <span className="text-[10px] font-bold text-slate-300">
                  {alert.branchName}
                </span>
              </div>
              <h4 className="text-sm font-black text-white truncate mt-0.5">
                {alert.title}
              </h4>
            </div>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="إغلاق التنبيه"
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-200 leading-relaxed bg-white/5 p-3 rounded-2xl border border-white/10">
          {alert.message}
        </p>

        {alert.offerPrice !== undefined && (
          <div className="flex items-center justify-between text-xs bg-amber-500/10 border border-amber-400/20 px-3 py-2 rounded-xl font-bold">
            <span className="text-amber-300">السعر ضمن العرض:</span>
            <span className="text-sm font-black text-[#FBBF24]">
              {alert.offerPrice} {alert.currency || 'ر.س'}
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-bold">
          {onOpenStoreCard && (
            <button
              type="button"
              onClick={() => {
                onOpenStoreCard(alert.storeId);
                onDismiss();
              }}
              className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] font-black flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 hover:opacity-95 transition cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              <span>إظهار بطاقتي للكاشير</span>
            </button>
          )}

          {alert.googleMapLink && (
            <a
              href={alert.googleMapLink}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Navigation className="w-4 h-4 text-sky-400" />
              <span>الاتجاهات</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          )}

          {onViewAllAlerts && (
            <button
              type="button"
              onClick={() => {
                onViewAllAlerts();
                onDismiss();
              }}
              className="py-2.5 px-3 rounded-xl bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 border border-sky-400/30 flex items-center justify-center gap-1 transition cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>رادار العروض</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
