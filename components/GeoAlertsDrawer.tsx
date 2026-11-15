'use client';

import React, { useState } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  Compass,
  CreditCard,
  ExternalLink,
  Gift,
  MapPin,
  Navigation,
  Sparkles,
  Tag,
  Trash2,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { GeofenceAlert, GeofenceAlertType } from '@/lib/types';
import { formatDistanceArabic } from '@/lib/geolocationAlerts';

interface GeoAlertsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: GeofenceAlert[];
  onMarkAsRead: (alertId: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onOpenStoreCard?: (storeId: string) => void;
  onGoToRadarTab?: () => void;
  onSimulateWalkIn?: () => void;
  currentLocationName?: string;
  isGpsActive?: boolean;
  soundEnabled?: boolean;
  onToggleSound?: (enabled: boolean) => void;
}

export default function GeoAlertsDrawer({
  isOpen,
  onClose,
  alerts,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onOpenStoreCard,
  onGoToRadarTab,
  onSimulateWalkIn,
  currentLocationName = 'الرياض — العليا',
  isGpsActive = false,
  soundEnabled = true,
  onToggleSound,
}: GeoAlertsDrawerProps) {
  const [filterType, setFilterType] = useState<string>('all');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredAlerts = alerts.filter((a) => {
    if (filterType === 'all') return true;
    if (filterType === 'offers') return a.alertType === 'offer' || a.alertType === 'flash_deal';
    if (filterType === 'rewards') return a.alertType === 'ready_reward';
    if (filterType === 'points') return a.alertType === 'double_points';
    if (filterType === 'nearby') return a.alertType === 'branch_nearby';
    return true;
  });

  const unreadCount = alerts.filter((a) => !a.isRead).length;

  const handleCopyCode = (id: string, code: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCodeId(id);
      setTimeout(() => setCopiedCodeId(null), 2500);
    }
  };

  const getAlertIcon = (type: GeofenceAlertType) => {
    switch (type) {
      case 'ready_reward':
        return <Gift className="w-4 h-4 text-emerald-500" />;
      case 'double_points':
        return <Sparkles className="w-4 h-4 text-amber-500" />;
      case 'offer':
      case 'flash_deal':
        return <Tag className="w-4 h-4 text-rose-500" />;
      default:
        return <MapPin className="w-4 h-4 text-sky-500" />;
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-sm flex justify-start"
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#0B1F3A] text-slate-800 dark:text-slate-100 h-full shadow-2xl flex flex-col animate-slideLeft border-l border-slate-200 dark:border-slate-800"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="relative w-10 h-10 rounded-2xl bg-gradient-navy flex items-center justify-center text-[#FBBF24] shadow-md">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-xs">
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <h3 className="font-black text-sm text-[#0B1F3A] dark:text-white">
                تنبيهات المواقع والعروض
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                إشعارات حية حسب نطاق تواجدك الجغرافي
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onToggleSound && (
              <button
                type="button"
                onClick={() => onToggleSound(!soundEnabled)}
                title={soundEnabled ? 'كتم صوت التنبيهات' : 'تفعيل صوت التنبيهات'}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-400" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق المركز"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Current Location & Simulation Strip */}
        <div className="px-5 py-3 bg-sky-50/70 dark:bg-sky-950/20 border-b border-sky-100 dark:border-sky-900/30 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-[11px] font-bold text-sky-800 dark:text-sky-300 truncate">
              {isGpsActive ? 'نظام GPS مباشر: ' : 'موقعك التقديري: '}
              <strong className="font-black text-[#0B1F3A] dark:text-white">
                {currentLocationName}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onSimulateWalkIn && (
              <button
                type="button"
                onClick={onSimulateWalkIn}
                className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-400/40 font-black text-[10px] flex items-center gap-1 cursor-pointer transition"
              >
                <Zap className="w-3 h-3 text-amber-500" />
                <span>تجربة تنبيه اقتراب</span>
              </button>
            )}

            {onGoToRadarTab && (
              <button
                type="button"
                onClick={() => {
                  onGoToRadarTab();
                  onClose();
                }}
                className="px-2.5 py-1 rounded-lg bg-sky-600 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer hover:bg-sky-700 transition"
              >
                <Compass className="w-3 h-3" />
                <span>خريطة الرادار</span>
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="px-5 py-2.5 border-b border-slate-200/70 dark:border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
          {[
            { id: 'all', label: 'الكل', count: alerts.length },
            {
              id: 'offers',
              label: 'العروض',
              count: alerts.filter((a) => a.alertType === 'offer' || a.alertType === 'flash_deal').length,
            },
            {
              id: 'rewards',
              label: 'مكافآت جاهزة',
              count: alerts.filter((a) => a.alertType === 'ready_reward').length,
            },
            {
              id: 'points',
              label: 'نقاط مضاعفة',
              count: alerts.filter((a) => a.alertType === 'double_points').length,
            },
            {
              id: 'nearby',
              label: 'فروع قريبة',
              count: alerts.filter((a) => a.alertType === 'branch_nearby').length,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 rounded-full font-bold text-[11px] whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                filterType === tab.id
                  ? 'bg-[#0B1F3A] dark:bg-white text-white dark:text-[#0B1F3A] shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className="text-[10px] opacity-80 bg-black/10 dark:bg-white/15 px-1.5 py-0.2 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Action Controls: Mark all read / Clear */}
        <div className="px-5 py-2 flex items-center justify-between text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800/50">
          <span>{filteredAlerts.length} تنبيه متاح في نطاقك</span>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="text-sky-600 dark:text-sky-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>تعيين الكل كمقروء</span>
              </button>
            )}
            {alerts.length > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                className="text-slate-400 hover:text-rose-500 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>مسح الكل</span>
              </button>
            )}
          </div>
        </div>

        {/* Alerts Feed */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
          {filteredAlerts.length === 0 ? (
            <div className="py-16 text-center space-y-3 text-slate-400">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800/80 mx-auto flex items-center justify-center text-slate-400">
                <Compass className="w-8 h-8 opacity-60" />
              </div>
              <p className="font-black text-sm text-slate-700 dark:text-slate-300">
                لا توجد تنبيهات حالياً في هذا النطاق
              </p>
              <p className="text-xs max-w-xs mx-auto leading-relaxed">
                جرّب توسيع نطاق الرادار من الخريطة، أو اضغط زر &quot;تجربة تنبيه اقتراب&quot; بالأعلى لمعاينة النظام.
              </p>
              {onSimulateWalkIn && (
                <button
                  type="button"
                  onClick={onSimulateWalkIn}
                  className="mt-3 px-4 py-2 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] font-black text-xs inline-flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Zap className="w-4 h-4 text-[#0B1F3A]" />
                  <span>محاكاة تنبيه اقتراب من كافيه</span>
                </button>
              )}
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                onClick={() => onMarkAsRead(alert.id)}
                className={`p-4 rounded-2xl border transition-all space-y-3 ${
                  alert.isRead
                    ? 'bg-white/70 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800 opacity-90'
                    : 'bg-white dark:bg-slate-800/90 border-amber-300 dark:border-amber-500/40 shadow-sm shadow-amber-500/5 ring-1 ring-amber-400/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={alert.storeLogo || '/icon-192.png'}
                      alt={alert.storeName}
                      referrerPolicy="no-referrer"
                      className="w-11 h-11 rounded-xl object-cover border border-slate-200 dark:border-slate-700 bg-white"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
                          {getAlertIcon(alert.alertType)}
                          {alert.distanceText}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {alert.branchName}
                        </span>
                      </div>
                      <h4 className="font-black text-xs text-[#0B1F3A] dark:text-white mt-1">
                        {alert.title}
                      </h4>
                    </div>
                  </div>

                  {!alert.isRead && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  )}
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  {alert.message}
                </p>

                {alert.offerPrice !== undefined && (
                  <div className="flex items-center justify-between text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 px-3 py-1.5 rounded-xl font-bold">
                    <span className="text-amber-800 dark:text-amber-300">قيمة العرض الحصري:</span>
                    <span className="text-sm font-black text-amber-600 dark:text-[#FBBF24]">
                      {alert.offerPrice} {alert.currency || 'ر.س'}
                    </span>
                  </div>
                )}

                {alert.offerPromoCode && (
                  <div className="flex items-center justify-between text-xs bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 px-3 py-1.5 rounded-xl">
                    <span className="text-emerald-800 dark:text-emerald-300 font-bold">كود الخصم الفوري:</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyCode(alert.id, alert.offerPromoCode!);
                      }}
                      className="font-mono font-black text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedCodeId === alert.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>تم النسخ</span>
                        </>
                      ) : (
                        <span>{alert.offerPromoCode}</span>
                      )}
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-bold">
                  {onOpenStoreCard && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenStoreCard(alert.storeId);
                        onClose();
                      }}
                      className="flex-1 py-2 px-3 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] font-black flex items-center justify-center gap-1.5 shadow-xs hover:opacity-95 transition cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>إظهار بطاقتي للكاشير</span>
                    </button>
                  )}

                  {alert.googleMapLink && (
                    <a
                      href={alert.googleMapLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1 transition cursor-pointer"
                    >
                      <Navigation className="w-3.5 h-3.5 text-sky-500" />
                      <span>الاتجاهات</span>
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
