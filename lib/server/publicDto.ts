import {
  PublicBranchDTO,
  PublicMenuItemDTO,
  PublicStoreDTO,
  Store,
} from '@/lib/types';
import { buildStoreSlug } from './arabicSearch';
import { isStoreNewWithinDays } from '@/lib/storeBadges';
import { isStoreSubscriptionPaused, SMART_PAUSE_NOTICE } from '@/lib/subscriptionStatus';

const DEFAULT_CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  الرياض: { lat: 24.7136, lng: 46.6753 },
  جدة: { lat: 21.5433, lng: 39.1728 },
  الخبر: { lat: 26.2172, lng: 50.1971 },
  القاهرة: { lat: 30.0444, lng: 31.2357 },
};

/**
 * Strictly projects public-safe store fields for Visitors (U0).
 * Never exposes merchantId, internal user/cashier accounts, metrics, or customer PII.
 */
export function toPublicStoreDto(store: Store): PublicStoreDTO {
  const isViewerOnly = store.subscriptionPlan === 'Viewer';
  const isTemporarilyPaused = isStoreSubscriptionPaused(store);
  const fallbackCoords = DEFAULT_CITY_COORDS[store.city] || { lat: 24.7136, lng: 46.6753 };

  const publicBranches: PublicBranchDTO[] = store.branches.map((b, idx) => ({
    name: b.name,
    city: b.city,
    area: b.area,
    address: b.address,
    phone: b.phone,
    lat: typeof b.lat === 'number' ? b.lat : fallbackCoords.lat + idx * 0.012,
    lng: typeof b.lng === 'number' ? b.lng : fallbackCoords.lng + idx * 0.014,
    crowdLevel: b.crowdLevel,
  }));

  const publicMenu: PublicMenuItemDTO[] = store.menu
    .filter((item) => item.available)
    .map((item) => ({
      name: item.name,
      type: item.type,
      category: item.category,
      price: item.price,
      currency: item.currency || store.currency,
      image: item.image,
      description: item.description,
      available: item.available,
      expiryDate: item.expiryDate,
    }));

  const activeOffers = isTemporarilyPaused ? [] : publicMenu.filter((item) => item.type === 'offer');

  const menuImages: string[] = Array.from(
    new Set(
      [
        ...(store.fullMenuImage ? [store.fullMenuImage] : []),
        ...(Array.isArray(store.menuImages) ? store.menuImages : []),
      ].filter(Boolean)
    )
  );

  const storeGallery: string[] = Array.from(
    new Set((Array.isArray(store.storeGallery) ? store.storeGallery : []).filter(Boolean))
  );

  return {
    slug: buildStoreSlug(store),
    name: store.name,
    logo: store.logo,
    cover: store.cover,
    fullMenuImage: store.fullMenuImage,
    menuImages,
    storeGallery,
    category: store.category,
    description: store.description,
    city: store.city,
    area: store.area,
    address: store.address,
    phone: store.phone,
    wifiPassword: store.wifiPassword,
    instagramUrl: store.instagramUrl,
    googleMapLink: store.googleMapLink,
    currency: store.currency,
    isViewerOnly,
    isTemporarilyPaused,
    pauseNotice: isTemporarilyPaused ? SMART_PAUSE_NOTICE : undefined,
    isTrial: store.status === 'pending',
    isNew: isStoreNewWithinDays(store, 30),
    createdAt: store.createdAt || store.trialStartedAt,
    verifiedOwnership: store.verifiedOwnership,
    cardColor: store.cardColor,
    cardTextColor: store.cardTextColor,
    loyaltySummary:
      isViewerOnly || isTemporarilyPaused
        ? null
        : {
            type: store.loyaltyRule.type,
            rewardDescription: store.loyaltyRule.rewardDescription || 'برنامج نقاط ومكافآت',
            stampsRequired: store.loyaltyRule.stampsRequired,
          },
    branches: publicBranches,
    menu: publicMenu,
    activeOffers,
    onlineOrderingActive: store.onlineOrderingActive ?? true,
    deliveryFee: store.deliveryFee ?? 15,
    minOrderAmount: store.minOrderAmount ?? 30,
    estimatedDeliveryMinutes: store.estimatedDeliveryMinutes ?? 35,
    whatsappOrdersNumber: store.whatsappOrdersNumber || store.phone,
  };
}

export function findStoreBySlugOrId(stores: Store[], slugOrId: string): Store | null {
  const target = decodeURIComponent(slugOrId).trim().toLowerCase();
  return (
    stores.find(
      (s) =>
        s.status !== 'suspended' &&
        (buildStoreSlug(s).toLowerCase() === target || s.id.toLowerCase() === target)
    ) || null
  );
}
