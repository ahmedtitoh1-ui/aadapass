'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import {
  Bell,
  Check,
  Compass,
  Copy,
  CreditCard,
  ExternalLink,
  Flame,
  Gift,
  LocateFixed,
  MapPin,
  Navigation,
  Radio,
  Sliders,
  Sparkles,
  Tag,
  Users,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { CustomerProfile, GeofenceAlert, Store } from '@/lib/types';
import {
  calculateDistanceMeters,
  formatDistanceArabic,
  GEO_PRESET_LOCATIONS,
  GeoPresetLocation,
  playGeofenceAlertChime,
  scanGeofenceAlerts,
  triggerHapticFeedback,
  dispatchNativeGeofenceNotification,
} from '@/lib/geolocationAlerts';
import { useFirebase } from '@/components/FirebaseProvider';

interface CustomerGeoOffersTabProps {
  customer: CustomerProfile;
  stores: Store[];
  onOpenStoreCard?: (storeId: string) => void;
  onTriggerBannerAlert?: (alert: GeofenceAlert) => void;
}

export default function CustomerGeoOffersTab({
  customer,
  stores,
  onOpenStoreCard,
  onTriggerBannerAlert,
}: CustomerGeoOffersTabProps) {
  const { fcmToken, fcmPermission, vapidKey, enableWebPush } = useFirebase();
  const [pushActivating, setPushActivating] = useState(false);
  const [pushStatusMsg, setPushStatusMsg] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Preset default: Riyadh Olaya
  const defaultPreset = GEO_PRESET_LOCATIONS[0];

  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number }>({
    lat: defaultPreset.lat,
    lng: defaultPreset.lng,
  });
  const [selectedPresetId, setSelectedPresetId] = useState<string>(defaultPreset.id);
  const [isGpsLive, setIsGpsLive] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [radiusMeters, setRadiusMeters] = useState<number>(3000);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null);
  const circleLayerRef = useRef<import('leaflet').Circle | null>(null);

  // Compute live nearby alerts based on currentCoords & radiusMeters
  const liveAlerts = useMemo(() => {
    return scanGeofenceAlerts(currentCoords, stores, customer, radiusMeters);
  }, [currentCoords, stores, customer, radiusMeters]);

  const handleActivateWebPush = async () => {
    setPushActivating(true);
    setPushStatusMsg(null);
    const res = await enableWebPush();
    setPushActivating(false);
    if (res.token) {
      setPushStatusMsg('تم تفعيل شهادة إشعارات الدفع (Firebase Web Push) وربط جهازك بنجاح ✓');
      if (liveAlerts[0]) {
        void dispatchNativeGeofenceNotification(liveAlerts[0]);
      }
    } else if (res.error) {
      setPushStatusMsg(res.error);
    }
  };

  // Request actual GPS location from browser
  const handleRequestLiveGPS = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError('متصفحك لا يدعم تحديد الموقع الجغرافي.');
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setCurrentCoords(coords);
        setIsGpsLive(true);
        setSelectedPresetId('custom-gps');
        setGpsLoading(false);

        // Center map
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([coords.lat, coords.lng], 14, { duration: 0.8 });
        }
      },
      (err) => {
        setGpsLoading(false);
        setIsGpsLive(false);
        if (err.code === 1) {
          setGpsError('تم رفض إذن الموقع. يمكنك اختيار إحدى المدن يدوياً أدناه.');
        } else {
          setGpsError('تعذر الحصول على موقع GPS بدقة. تم الإبقاء على الموقع الحالي.');
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Switch to a preset city hub
  const handleSelectPreset = (preset: GeoPresetLocation) => {
    setSelectedPresetId(preset.id);
    setIsGpsLive(false);
    setGpsError(null);
    setCurrentCoords({ lat: preset.lat, lng: preset.lng });

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([preset.lat, preset.lng], 13.5, { duration: 0.8 });
    }
  };

  // Simulate walking directly into a store's geofence
  const handleSimulateWalkIn = (targetAlert?: GeofenceAlert) => {
    const alert = targetAlert || liveAlerts[0];
    if (!alert) return;

    // Shift coordinates slightly closer (within ~80 meters)
    const shifted = {
      lat: alert.lat + 0.0007,
      lng: alert.lng + 0.0006,
    };
    setCurrentCoords(shifted);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([alert.lat, alert.lng], 15.5, { duration: 0.6 });
    }

    if (soundEnabled) {
      playGeofenceAlertChime();
    }
    triggerHapticFeedback();

    if (onTriggerBannerAlert) {
      onTriggerBannerAlert({
        ...alert,
        distanceMeters: 85,
        distanceText: '85 متر',
        message: `أنت الآن على بعد 85 متر فقط من ${alert.branchName}! تم تفعيل العرض الفوري.`,
      });
    }
  };

  const handleCopyCode = (id: string, code: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCodeId(id);
      setTimeout(() => setCopiedCodeId(null), 2500);
    }
  };

  // Filter alerts by category tabs
  const filteredAlerts = useMemo(() => {
    return liveAlerts.filter((a) => {
      if (activeCategoryFilter === 'all') return true;
      if (activeCategoryFilter === 'offers') return a.alertType === 'offer' || a.alertType === 'flash_deal';
      if (activeCategoryFilter === 'rewards') return a.alertType === 'ready_reward';
      if (activeCategoryFilter === 'points') return a.alertType === 'double_points';
      return true;
    });
  }, [liveAlerts, activeCategoryFilter]);

  // Leaflet Map Initialization and Dynamic Update
  useEffect(() => {
    let cancelled = false;
    const container = mapContainerRef.current;
    if (!container) return;

    const initMap = async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapContainerRef.current) return;

      // Clean up previous instance
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: [currentCoords.lat, currentCoords.lng],
        zoom: radiusMeters > 5000 ? 12 : radiusMeters > 2000 ? 13 : 14,
        scrollWheelZoom: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // User location pulsing marker
      const userPin = L.divIcon({
        className: 'user-radar-pin',
        html: `
          <div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;inset:0;border-radius:9999px;background:#0284c7;opacity:0.35;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="position:relative;width:18px;height:18px;border-radius:9999px;background:#0284c7;border:3px solid #ffffff;box-shadow:0 0 14px rgba(2,132,199,0.7);"></div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const userMarker = L.marker([currentCoords.lat, currentCoords.lng], {
        icon: userPin,
        zIndexOffset: 1000,
      }).addTo(map);

      userMarker.bindPopup(
        `<div dir="rtl" style="font-family:Cairo,sans-serif;text-align:right;min-width:140px;">
          <strong style="color:#0B1F3A;font-size:12px;">📍 موقعك الحالي</strong><br/>
          <span style="font-size:10px;color:#64748b;">نطاق رادار العروض: ${formatDistanceArabic(radiusMeters)}</span>
        </div>`
      );

      // Geofence coverage circle
      const circle = L.circle([currentCoords.lat, currentCoords.lng], {
        radius: radiusMeters,
        color: '#0284c7',
        fillColor: '#38bdf8',
        fillOpacity: 0.12,
        weight: 1.5,
        dashArray: '5, 5',
      }).addTo(map);

      circleLayerRef.current = circle;

      // Add markers for all store branches
      stores.forEach((store) => {
        (store.branches || []).forEach((b) => {
          if (typeof b.lat !== 'number' || typeof b.lng !== 'number') return;

          const dist = calculateDistanceMeters(currentCoords.lat, currentCoords.lng, b.lat, b.lng);
          const isWithin = dist <= radiusMeters;

          // Check if this store has active offer or ready reward
          const hasOffer = (store.menu || []).some((m) => m.type === 'offer' && m.available);
          const hasReadyReward = customer.cards.some((c) => {
            if (c.storeId !== store.id) return false;
            if (c.rule.type === 'stamps' && c.rule.stampsRequired) {
              return (c.currentBalance || 0) >= c.rule.stampsRequired;
            }
            if (c.rule.type === 'points') {
              return (c.currentBalance || 0) >= (c.rule.rewardTargetPoints || 100);
            }
            return false;
          });

          const bgColor = hasReadyReward
            ? '#10B981'
            : hasOffer
            ? '#F59E0B'
            : '#0B1F3A';

          const badgeIconText = hasReadyReward ? '🎁' : hasOffer ? '🔥' : '📍';

          const storeIcon = L.divIcon({
            className: 'store-branch-pin',
            html: `
              <div style="width:34px;height:34px;border-radius:12px;background:${bgColor};border:2px solid #ffffff;box-shadow:0 4px 14px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;color:#ffffff;font-size:14px;font-weight:900;cursor:pointer;transition:transform 0.2s;" title="${store.name} - ${b.name}">
                ${badgeIconText}
              </div>
            `,
            iconSize: [34, 34],
            iconAnchor: [17, 34],
            popupAnchor: [0, -34],
          });

          const marker = L.marker([b.lat, b.lng], { icon: storeIcon }).addTo(map);

          marker.bindPopup(
            `<div dir="rtl" style="font-family:Cairo,sans-serif;text-align:right;min-width:180px;line-height:1.5;">
              <strong style="color:#0B1F3A;font-size:13px;display:block;">${store.name}</strong>
              <span style="font-size:11px;color:#475569;display:block;">${b.name} (${b.city} · ${b.area})</span>
              <span style="font-size:11px;font-weight:bold;color:${isWithin ? '#059669' : '#d97706'};display:block;margin-top:4px;">
                📍 المسافة: ${formatDistanceArabic(dist)} ${isWithin ? '✓ (ضمن النطاق)' : ''}
              </span>
              ${b.crowdLevel ? `<span style="font-size:10px;color:#64748b;display:block;">الزحام: ${b.crowdLevel}</span>` : ''}
              ${store.googleMapLink ? `<a href="${store.googleMapLink}" target="_blank" style="display:inline-block;margin-top:6px;font-size:11px;color:#0284c7;font-weight:bold;text-decoration:none;">الاتجاهات عبر خرائط Google ↗</a>` : ''}
            </div>`
          );
        });
      });

      mapInstanceRef.current = map;
    };

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [currentCoords, radiusMeters, stores, customer.cards]);

  return (
    <div className="space-y-6 animate-fadeIn max-w-5xl mx-auto">
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B1F3A] via-[#10325E] to-[#007BFF] text-white p-6 sm:p-8 shadow-xl">
        <div className="absolute top-0 left-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-amber-300 text-xs font-black">
              <Radio className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>نظام التنبيهات الجغرافية الفورية</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                {soundEnabled ? (
                  <>
                    <Volume2 className="w-4 h-4 text-emerald-300" />
                    <span>الصوت مفعل</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-4 h-4 text-slate-300" />
                    <span>الصوت مكتوم</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleRequestLiveGPS}
                disabled={gpsLoading}
                className="px-4 py-1.5 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] font-black text-xs flex items-center gap-1.5 shadow-md hover:opacity-95 transition cursor-pointer disabled:opacity-60"
              >
                <LocateFixed className={`w-4 h-4 ${gpsLoading ? 'animate-spin' : ''}`} />
                <span>{gpsLoading ? 'جاري تحديد موقعك...' : isGpsLive ? 'موقعي المباشر (GPS) ✓' : 'تفعيل موقعي المباشر'}</span>
              </button>
            </div>
          </div>

          <div className="max-w-2xl space-y-2">
            <h2 className="text-xl sm:text-2xl font-black text-white">
              رادار العروض وتنبيهات القرب الجغرافي 📍
            </h2>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              يقوم التطبيق برصد المتاجر والفروع في محيطك الجغرافي وتنبيهك تلقائياً عند الاقتراب من فرع متاح فيه عروض مضاعفة أو مكافآت جاهزة للصرف بمسح الباركود.
            </p>
          </div>

          {gpsError && (
            <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-bold flex items-center gap-2">
              <MapPin className="w-4 h-4 shrink-0 text-amber-300" />
              <span>{gpsError}</span>
            </div>
          )}

          {/* Quick Hub Switcher Bar */}
          <div className="pt-2 border-t border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-bold">اختر منطقة التجربة أو المحاكاة:</span>
              <span className="text-[11px] text-amber-300 font-bold">
                {liveAlerts.length} عرض وفرع في نطاق الرادار
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {GEO_PRESET_LOCATIONS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    selectedPresetId === preset.id
                      ? 'bg-white text-[#0B1F3A] font-black shadow-md'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5 opacity-80" />
                  <span>{preset.name.split('—')[0].trim()}</span>
                  <span className="text-[10px] opacity-70">
                    ({preset.city})
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Firebase Cloud Messaging Web Push Certificate Bar */}
      <div className="glass-card p-5 sm:p-6 rounded-3xl border border-sky-200 bg-white space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center text-[#007BFF]">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm text-[#0B1F3A]">
                  إشعارات الدفع الفورية (Firebase Web Push — FCM)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                  شهادة VAPID متصلة ✓
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 font-mono" dir="ltr">
                Key Pair: {vapidKey.slice(0, 18)}...{vapidKey.slice(-10)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {fcmToken && (
              <button
                type="button"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(fcmToken);
                    setCopiedToken(true);
                    setTimeout(() => setCopiedToken(false), 2500);
                  }
                }}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedToken ? 'تم نسخ رمز الجهاز' : 'نسخ FCM Token'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleActivateWebPush}
              disabled={pushActivating}
              className="px-4 py-2 rounded-xl bg-[#007BFF] hover:bg-sky-600 text-white font-black text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-60"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>
                {pushActivating
                  ? 'جاري ربط الشهادة...'
                  : fcmToken
                  ? 'إرسال إشعار تجريبي وتحديث الربط ✓'
                  : fcmPermission === 'granted'
                  ? 'تفعيل رمز FCM للجهاز'
                  : 'تفعيل إشعارات الدفع لهذا الجهاز'}
              </span>
            </button>
          </div>
        </div>

        {pushStatusMsg && (
          <div className="p-3 rounded-2xl bg-sky-50 border border-sky-200 text-sky-900 text-xs font-bold flex items-center justify-between gap-2">
            <span>{pushStatusMsg}</span>
            {fcmToken && (
              <span className="font-mono text-[10px] text-sky-700" dir="ltr">
                Token: {fcmToken.slice(0, 16)}...
              </span>
            )}
          </div>
        )}
      </div>

      {/* Interactive Controls Bar: Radius Slider + Walk-in Simulator */}
      <div className="glass-card p-5 sm:p-6 rounded-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#007BFF]" />
              <h3 className="font-black text-sm text-[#0B1F3A] dark:text-white">
                نطاق رادار التنبيهات الجغرافية
              </h3>
            </div>
            <p className="text-[11px] text-slate-500">
              اختر المسافة التي ترغب في استلام إشعارات العروض عند دخول محيطها
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-[#007BFF] dark:text-sky-300 font-black text-xs">
              {formatDistanceArabic(radiusMeters)}
            </span>

            <button
              type="button"
              onClick={() => handleSimulateWalkIn()}
              className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-400/40 font-black text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Zap className="w-4 h-4 text-amber-500" />
              <span>محاكاة الاقتراب من فرع (تجربة التنبيه الحي)</span>
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <input
            type="range"
            min="500"
            max="10000"
            step="500"
            value={radiusMeters}
            onChange={(e) => setRadiusMeters(Number(e.target.value))}
            className="w-full accent-[#007BFF] cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-bold px-1">
            <span>500 متر (محيط المشي المباشر)</span>
            <span>2 كم</span>
            <span>5 كم</span>
            <span>10 كم (محيط المدينة بالسيارة)</span>
          </div>
        </div>
      </div>

      {/* Interactive Leaflet Radar Map */}
      <div className="glass-card p-4 sm:p-5 rounded-3xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-emerald-600" />
            <h3 className="font-black text-sm text-[#0B1F3A] dark:text-white">
              الخريطة التفاعلية ونقاط التغطية
            </h3>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              عروض وتخفيضات
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              مكافأة جاهزة
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0B1F3A] inline-block" />
              فروع الشركاء
            </span>
          </div>
        </div>

        <div className="relative w-full h-80 sm:h-96 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-inner">
          <div ref={mapContainerRef} className="w-full h-full z-10" />
        </div>
      </div>

      {/* Nearby Geolocated Offers & Branches Feed */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-rose-500" />
            <h3 className="text-base font-black text-[#0B1F3A] dark:text-white">
              العروض والتنبيهات المتاحة في محيطك ({filteredAlerts.length})
            </h3>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'offers', label: 'عروض حصرية' },
              { id: 'rewards', label: 'مكافآت جاهزة' },
              { id: 'points', label: 'نقاط مضاعفة' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategoryFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition cursor-pointer ${
                  activeCategoryFilter === tab.id
                    ? 'bg-[#007BFF] text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredAlerts.length === 0 ? (
          <div className="glass-card p-12 text-center rounded-3xl space-y-3">
            <div className="w-16 h-16 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-600 mx-auto flex items-center justify-center">
              <Compass className="w-8 h-8 opacity-60" />
            </div>
            <h4 className="font-black text-sm text-[#0B1F3A] dark:text-white">
              لا توجد عروض في هذا النطاق المختار
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              يمكنك زيادة شريط نطاق الرادار بالأعلى لمسافة 5 كم أو تجربة اختيار منطقة أخرى.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className="glass-card p-5 rounded-3xl space-y-3 border-r-4 border-[#007BFF] hover:border-amber-400 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={alert.storeLogo || '/icon-192.png'}
                        alt={alert.storeName}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 bg-white"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/50 text-[#007BFF] dark:text-sky-300">
                            <MapPin className="w-3 h-3" />
                            {alert.distanceText}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500">
                            {alert.branchName}
                          </span>
                        </div>
                        <h4 className="font-black text-sm text-[#0B1F3A] dark:text-white mt-1">
                          {alert.title}
                        </h4>
                      </div>
                    </div>

                    <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/50">
                      {alert.badgeText}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50/70 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                    {alert.message}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    {alert.offerPrice !== undefined ? (
                      <div className="font-bold text-slate-700 dark:text-slate-200">
                        السعر: <strong className="text-amber-600 dark:text-[#FBBF24] font-black text-sm">{alert.offerPrice} {alert.currency || 'ر.س'}</strong>
                      </div>
                    ) : alert.offerDiscount ? (
                      <div className="font-bold text-emerald-600 dark:text-emerald-400">
                        الميزة: <strong>{alert.offerDiscount}</strong>
                      </div>
                    ) : null}

                    {alert.crowdLevel && (
                      <span className="text-[11px] text-slate-500 font-bold flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        حالة الفرع: {alert.crowdLevel}
                      </span>
                    )}
                  </div>

                  {alert.offerPromoCode && (
                    <div className="flex items-center justify-between text-xs bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 p-2.5 rounded-xl">
                      <span className="text-emerald-800 dark:text-emerald-300 font-bold">كود العرض:</span>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(alert.id, alert.offerPromoCode!)}
                        className="font-mono font-black text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedCodeId === alert.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>تم النسخ</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>{alert.offerPromoCode}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200/70 dark:border-slate-800">
                  {onOpenStoreCard && (
                    <button
                      type="button"
                      onClick={() => onOpenStoreCard(alert.storeId)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] font-black text-xs flex items-center justify-center gap-1.5 shadow-xs hover:opacity-95 transition cursor-pointer"
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
                      className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                    >
                      <Navigation className="w-3.5 h-3.5 text-sky-500" />
                      <span>الاتجاهات</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => handleSimulateWalkIn(alert)}
                    title="محاكاة الاقتراب من هذا الفرع لاختبار التنبيه الفوري"
                    className="p-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 transition cursor-pointer"
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
