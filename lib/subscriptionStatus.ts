import type { Store } from './types';

export const SMART_PAUSE_NOTICE = {
  badgeLabel: 'تحديثات موسمية ✨',
  customerTitle: 'نقوم حالياً بتحديث عروض ومكافآت المتجر',
  customerSubtitle:
    'يقوم المتجر حالياً بتحديث برنامجه وعروضه — يمكنكم تصفح بيانات المتجر وساعات العمل وسيتم استئناف برنامج النقاط قريباً.',
};

function parseExpiryEndOfDayMs(dateStr?: string): number {
  if (!dateStr) return Number.NaN;
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return Date.parse(`${trimmed}T23:59:59.999Z`);
  }
  return Date.parse(trimmed);
}

/**
 * Computes effective subscription lifecycle state from store status & expiry.
 */
export function getEffectiveSubscriptionState(
  store: Pick<Store, 'subscriptionState' | 'subscriptionExpiry' | 'trialEndsAt' | 'status'>,
  nowMs: number = Date.now()
): 'active' | 'grace' | 'readonly' {
  if (store.status === 'suspended' || store.subscriptionState === 'readonly') {
    return 'readonly';
  }
  if (store.subscriptionState === 'grace') {
    return 'grace';
  }
  const expiryStr =
    store.status === 'pending' && store.trialEndsAt
      ? store.trialEndsAt
      : store.subscriptionExpiry;
  const expMs = parseExpiryEndOfDayMs(expiryStr);
  if (!Number.isNaN(expMs) && nowMs > expMs) {
    const diffDays = (nowMs - expMs) / (1000 * 60 * 60 * 24);
    if (diffDays > 7) return 'readonly';
    return 'grace';
  }
  return 'active';
}

/**
 * True when a store's package expired without renewal or is temporarily paused/readonly.
 * Customer-facing views should smartly and politely hide packages/loyalty claims without
 * revealing any embarrassing billing or non-payment details.
 */
export function isStoreSubscriptionPaused(
  store: Pick<Store, 'subscriptionState' | 'subscriptionExpiry' | 'trialEndsAt' | 'status'>,
  nowMs: number = Date.now()
): boolean {
  if (store.status === 'suspended' || store.subscriptionState === 'readonly') {
    return true;
  }
  const expiryStr =
    store.status === 'pending' && store.trialEndsAt
      ? store.trialEndsAt
      : store.subscriptionExpiry;
  const expMs = parseExpiryEndOfDayMs(expiryStr);
  if (!Number.isNaN(expMs) && nowMs > expMs) {
    return true;
  }
  return false;
}
