const DAY_MS = 24 * 60 * 60 * 1000;

export interface StoreRecencyInput {
  createdAt?: string;
  trialStartedAt?: string;
  isNew?: boolean;
}

/**
 * Checks whether a store was added within the last `days` days (default: 30).
 * Accepts an explicit `referenceNowMs` so callers can avoid SSR/client timestamp drift.
 */
export function isStoreNewWithinDays(
  store: StoreRecencyInput | null | undefined,
  days = 30,
  referenceNowMs?: number
): boolean {
  if (!store) return false;
  if (typeof store.isNew === 'boolean') return store.isNew;

  const rawDate = store.createdAt || store.trialStartedAt;
  if (!rawDate) return false;

  const createdMs = Date.parse(rawDate);
  if (Number.isNaN(createdMs)) return false;

  const nowMs = typeof referenceNowMs === 'number' ? referenceNowMs : Date.now();
  const diffMs = nowMs - createdMs;
  const maxAgeMs = days * DAY_MS;

  return diffMs >= -60_000 && diffMs <= maxAgeMs;
}
