import { CustomerProfile, GeofenceAlert, GeofenceAlertType, Store } from './types';

/**
 * Standard preset hubs in KSA and Egypt for rapid GPS testing,
 * simulator mode, and fallback if GPS permission is pending or denied.
 */
export interface GeoPresetLocation {
  id: string;
  name: string;
  city: string;
  country: 'SAR' | 'EGP';
  lat: number;
  lng: number;
  description: string;
}

export const GEO_PRESET_LOCATIONS: GeoPresetLocation[] = [
  {
    id: 'riyadh-olaya',
    name: 'الرياض — العليا (شارع التحلية / طريق الملك فهد)',
    city: 'الرياض',
    country: 'SAR',
    lat: 24.7136,
    lng: 46.6753,
    description: 'بالقرب من مقهى إكسير الشرق وبوتيك زهور الربيع',
  },
  {
    id: 'riyadh-hittin',
    name: 'الرياض — حطين والبوليفارد',
    city: 'الرياض',
    country: 'SAR',
    lat: 24.7742,
    lng: 46.6231,
    description: 'بالقرب من بيسترو الذواقة الفرنسي ومقهى البوليفارد',
  },
  {
    id: 'jeddah-corniche',
    name: 'جدة — الكورنيش وشارع التحلية',
    city: 'جدة',
    country: 'SAR',
    lat: 21.5433,
    lng: 39.1728,
    description: 'بالقرب من أرتيزان بيكري والحلويات وعطور أصالة',
  },
  {
    id: 'khobar-corniche',
    name: 'الخبر — الكورنيش الشمالي والراكة',
    city: 'الخبر',
    country: 'SAR',
    lat: 26.2172,
    lng: 50.1971,
    description: 'بالقرب من كافيهات الكورنيش ومجمعات التسوق',
  },
  {
    id: 'cairo-tagamoa',
    name: 'القاهرة — التجمع الخامس (شارع التسعين وداون تاون)',
    city: 'القاهرة',
    country: 'EGP',
    lat: 30.0131,
    lng: 31.4398,
    description: 'بالقرب من بيسترو كافيه، مخابز التجمع، وسلاسل المطاعم',
  },
  {
    id: 'cairo-zayed',
    name: 'الجيزة — الشيخ زايد (مجمع أركان ووصلة دهشور)',
    city: 'القاهرة',
    country: 'EGP',
    lat: 30.0489,
    lng: 30.9855,
    description: 'بالقرب من مقاهي زايد ومتاجر العطور الراقية',
  },
  {
    id: 'alex-stanley',
    name: 'الإسكندرية — كوبري ستانلي وسموحة',
    city: 'الإسكندرية',
    country: 'EGP',
    lat: 31.2325,
    lng: 29.9515,
    description: 'بالقرب من مقاهي الكورنيش ومطاعم البحر الأبيض',
  },
];

/**
 * High-precision Haversine distance in meters between two coordinates.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const R = 6371e3; // Earth radius in meters
  const rad = Math.PI / 180;
  const φ1 = lat1 * rad;
  const φ2 = lat2 * rad;
  const Δφ = (lat2 - lat1) * rad;
  const Δλ = (lon2 - lon1) * rad;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Format meters to friendly Arabic distance string: "250 متر" or "1.8 كم".
 */
export function formatDistanceArabic(meters: number): string {
  if (meters < 1000) {
    return `${Math.max(10, Math.round(meters))} متر`;
  }
  const km = (meters / 1000).toFixed(1).replace('.0', '');
  return `${km} كم`;
}

/**
 * Scans all stores, branches, campaigns, offers, and ready rewards
 * to construct targeted Geofence Alerts around user location.
 */
export function scanGeofenceAlerts(
  userCoords: { lat: number; lng: number },
  stores: Store[],
  customer: CustomerProfile,
  maxRadiusMeters: number = 3000
): GeofenceAlert[] {
  const alerts: GeofenceAlert[] = [];
  const nowStr = new Date().toISOString();

  // Map of stores where customer has cards & points/stamps
  const customerCardsByStore = new Map(
    customer.cards.map((c) => [c.storeId, c])
  );

  stores.forEach((store) => {
    // Skip suspended or purely inactive stores
    if (store.status === 'suspended') return;

    const storeCard = customerCardsByStore.get(store.id);

    (store.branches || []).forEach((branch) => {
      if (typeof branch.lat !== 'number' || typeof branch.lng !== 'number') return;

      const dist = calculateDistanceMeters(
        userCoords.lat,
        userCoords.lng,
        branch.lat,
        branch.lng
      );

      // Check against branch custom radius or general maxRadius
      const branchThreshold = branch.geofenceRadiusMeters || maxRadiusMeters;

      if (dist <= branchThreshold) {
        const distText = formatDistanceArabic(dist);
        const branchLat = branch.lat;
        const branchLng = branch.lng;

        // 1. Ready Reward Check (Customer has enough points or stamps to redeem right now)
        if (storeCard) {
          const rule = storeCard.rule;
          let isReady = false;
          let rewardDesc = '';

          if (rule.type === 'stamps' && rule.stampsRequired) {
            isReady = (storeCard.currentBalance || 0) >= rule.stampsRequired;
            rewardDesc = rule.rewardDescription || 'مكافأة أختام مجانية';
          } else if (rule.type === 'points') {
            const target = rule.rewardTargetPoints || 100;
            isReady = (storeCard.currentBalance || 0) >= target;
            rewardDesc = rule.rewardDescription || `مكافأة ${target} نقطة`;
          }

          if (isReady) {
            alerts.push({
              id: `geo-reward-${store.id}-${branch.id}`,
              storeId: store.id,
              storeName: store.name,
              storeLogo: store.logo,
              storeSlug: store.slug,
              branchId: branch.id,
              branchName: branch.name,
              branchAddress: branch.address,
              city: branch.city,
              area: branch.area,
              distanceMeters: dist,
              distanceText: distText,
              alertType: 'ready_reward',
              title: `🎁 مكافأتك جاهزة في ${store.name}!`,
              message: `أنت على بعد ${distText} من ${branch.name}. يمكنك الآن صرف "${rewardDesc}" بمسح الباركود مباشرة لدى الكاشير.`,
              badgeText: 'مكافأة جاهزة للصرف',
              offerDiscount: 'صرف مجاني 100%',
              googleMapLink: store.googleMapLink,
              phone: branch.phone || store.phone,
              crowdLevel: branch.crowdLevel,
              lat: branch.lat,
              lng: branch.lng,
              createdAt: nowStr,
              isRead: false,
            });
          }
        }

        // 2. Active Menu Offers for this branch
        const branchOffers = (store.menu || []).filter(
          (item) =>
            item.type === 'offer' &&
            item.available &&
            (!item.branches || item.branches.length === 0 || item.branches.includes(branch.id))
        );

        branchOffers.forEach((offer) => {
          alerts.push({
            id: `geo-offer-${offer.id}-${branch.id}`,
            storeId: store.id,
            storeName: store.name,
            storeLogo: store.logo,
            storeSlug: store.slug,
            branchId: branch.id,
            branchName: branch.name,
            branchAddress: branch.address,
            city: branch.city,
            area: branch.area,
            distanceMeters: dist,
            distanceText: distText,
            alertType: 'offer',
            title: `🔥 ${offer.name} بالقرب منك`,
            message: `${offer.description || 'عرض حصري متاح الآن لرواد هذا الفرع.'} متاح في ${branch.name} (${distText}).`,
            badgeText: 'عرض محلي حصري',
            offerPrice: offer.price,
            currency: offer.currency || store.currency,
            offerExpiry: offer.expiryDate,
            googleMapLink: store.googleMapLink,
            phone: branch.phone || store.phone,
            crowdLevel: branch.crowdLevel,
            lat: branchLat,
            lng: branchLng,
            createdAt: nowStr,
            isRead: false,
          });
        });

        // 3. Marketing Campaigns (Double Points, New Customer, Special Perks)
        (store.campaigns || []).forEach((campaign) => {
          alerts.push({
            id: `geo-camp-${campaign.id}-${branch.id}`,
            storeId: store.id,
            storeName: store.name,
            storeLogo: store.logo,
            storeSlug: store.slug,
            branchId: branch.id,
            branchName: branch.name,
            branchAddress: branch.address,
            city: branch.city,
            area: branch.area,
            distanceMeters: dist,
            distanceText: distText,
            alertType: campaign.discountOrBonus?.includes('نقاط') ? 'double_points' : 'flash_deal',
            title: `⚡ ${campaign.title} — ${store.name}`,
            message: `عرض ${campaign.discountOrBonus} مفعّل حالياً في ${branch.name}. اقترب من الفرع (${distText}) واكسب المزايا بمجرد المسح!`,
            badgeText: campaign.discountOrBonus,
            offerDiscount: campaign.discountOrBonus,
            googleMapLink: store.googleMapLink,
            phone: branch.phone || store.phone,
            crowdLevel: branch.crowdLevel,
            lat: branchLat,
            lng: branchLng,
            createdAt: nowStr,
            isRead: false,
          });
        });

        // 4. If no specific offers or rewards exist for this branch, emit a Nearby Branch Alert
        if (branchOffers.length === 0 && (store.campaigns || []).length === 0) {
          const customMsg =
            branch.proximityAlertMessage ||
            `أنت على بعد ${distText} من ${store.name} (${branch.name}). بطاقة ولائك جاهزة لتجميع النقاط!`;

          alerts.push({
            id: `geo-branch-${store.id}-${branch.id}`,
            storeId: store.id,
            storeName: store.name,
            storeLogo: store.logo,
            storeSlug: store.slug,
            branchId: branch.id,
            branchName: branch.name,
            branchAddress: branch.address,
            city: branch.city,
            area: branch.area,
            distanceMeters: dist,
            distanceText: distText,
            alertType: 'branch_nearby',
            title: `📍 أنت بالقرب من ${store.name}`,
            message: customMsg,
            badgeText: branch.activeOfferBadge || 'فرع قريب',
            googleMapLink: store.googleMapLink,
            phone: branch.phone || store.phone,
            crowdLevel: branch.crowdLevel,
            lat: branch.lat,
            lng: branch.lng,
            createdAt: nowStr,
            isRead: false,
          });
        }
      }
    });
  });

  // Sort by closest distance first
  return alerts.sort((a, b) => a.distanceMeters - b.distanceMeters);
}

/**
 * Plays a pleasant, subtle dual-tone chime using Web Audio API.
 * Synthesized completely client-side with zero external assets needed.
 */
export function playGeofenceAlertChime() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // First note: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    gain1.gain.setValueAtTime(0.001, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.36);

    // Second note: 880 Hz (A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
    gain2.gain.setValueAtTime(0.001, ctx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.56);
  } catch {
    // AudioContext blocked by browser autoplay policy until user gesture
  }
}

/**
 * Haptic feedback vibration for mobile devices when entering a geofenced zone.
 */
export function triggerHapticFeedback() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  try {
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate([120, 80, 120]);
    }
  } catch {
    // Non-vibrating device
  }
}

/**
 * Dispatches a native browser notification if user gave permission.
 */
export async function dispatchNativeGeofenceNotification(alert: GeofenceAlert) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(alert.title, {
          body: alert.message,
          icon: alert.storeLogo || '/icon-192.png',
          badge: '/icon-192.png',
          tag: `geofence-${alert.storeId}-${alert.branchId}`,
          data: { url: `/stores?store=${alert.storeSlug || alert.storeId}` },
        });
        return;
      }
    }
    // Fallback standard desktop notification
    new Notification(alert.title, {
      body: alert.message,
      icon: alert.storeLogo || '/icon-192.png',
      tag: `geofence-${alert.storeId}-${alert.branchId}`,
    });
  } catch {
    // Notification error handled silently
  }
}
