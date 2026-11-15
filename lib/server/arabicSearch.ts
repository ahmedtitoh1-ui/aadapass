import { Store } from '@/lib/types';
import { isStoreSubscriptionPaused } from '@/lib/subscriptionStatus';

/**
 * Arabic & Latin text normalization equivalent to PostgreSQL `unaccent` + Arabic normalization:
 * - Unifies Alef variants (أ إ آ ٱ -> ا), Teh Marbuta (ة -> ه), Alef Maksura (ى -> ي), Hamza (ؤ/ئ -> و/ي)
 * - Strips Arabic tashkeel/diacritics and tatweel
 * - Strips Latin accents via NFD
 */
export function normalizeArabicText(input: string): string {
  if (!input) return '';
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Latin unaccent
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // Arabic tashkeel & tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generates character trigrams (matching PostgreSQL pg_trgm padding behavior).
 */
export function generateTrigrams(normalized: string): Set<string> {
  const padded = `  ${normalized} `;
  const set = new Set<string>();
  if (padded.length < 3) {
    if (normalized) set.add(normalized);
    return set;
  }
  for (let i = 0; i <= padded.length - 3; i += 1) {
    set.add(padded.slice(i, i + 3));
  }
  return set;
}

/**
 * Computes trigram similarity (0..1) + direct substring boost for normalized query against target.
 */
export function trigramSimilarity(query: string, target: string): number {
  const nq = normalizeArabicText(query);
  const nt = normalizeArabicText(target);
  if (!nq || !nt) return 0;
  if (nt === nq) return 1;
  if (nt.includes(nq)) {
    return 0.72 + Math.min(0.27, nq.length / Math.max(1, nt.length) * 0.27);
  }

  const qGrams = generateTrigrams(nq);
  const tGrams = generateTrigrams(nt);
  if (qGrams.size === 0 || tGrams.size === 0) return 0;

  let intersection = 0;
  for (const gram of qGrams) {
    if (tGrams.has(gram)) intersection += 1;
  }
  const union = qGrams.size + tGrams.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function buildStoreSlug(store: Pick<Store, 'id' | 'slug' | 'name'>): string {
  if (store.slug) return store.slug;
  const ascii = store.name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  if (ascii.length >= 3) return ascii;
  return store.id;
}

export function normalizeStoreRequestKey(storeName: string, city: string): string {
  return `${normalizeArabicText(storeName)}::${normalizeArabicText(city || 'الرياض')}`;
}

export interface StoreSearchQuery {
  q?: string;
  category?: string;
  city?: string;
  area?: string;
  onlyOffers?: boolean;
}

export function searchStoresWithTrigram(
  stores: Store[],
  params: StoreSearchQuery
): {
  results: Store[];
  alternatives: Store[];
  inferredCategory?: string;
} {
  const activeStores = stores.filter((s) => s.status === 'active' && !isStoreSubscriptionPaused(s));
  const qNorm = normalizeArabicText(params.q || '');
  const categoryFilter = params.category && params.category !== 'الكل' ? normalizeArabicText(params.category) : '';
  const cityFilter = params.city && params.city !== 'الكل' ? normalizeArabicText(params.city) : '';
  const areaFilter = params.area && params.area !== 'الكل' ? normalizeArabicText(params.area) : '';

  const scored = activeStores
    .map((store) => {
      if (categoryFilter && normalizeArabicText(store.category) !== categoryFilter) {
        return null;
      }
      if (cityFilter && normalizeArabicText(store.city) !== cityFilter) {
        return null;
      }
      if (
        areaFilter &&
        normalizeArabicText(store.area) !== areaFilter &&
        !store.branches.some((b) => normalizeArabicText(b.area) === areaFilter)
      ) {
        return null;
      }
      if (params.onlyOffers && !store.menu.some((m) => m.type === 'offer' && m.available)) {
        return null;
      }

      if (!qNorm) {
        return { store, score: 1 };
      }

      const branchText = store.branches.map((b) => `${b.name} ${b.area} ${b.city}`).join(' ');
      const menuText = store.menu.map((m) => `${m.name} ${m.category}`).join(' ');

      const nameScore = trigramSimilarity(qNorm, store.name) * 1.4;
      const metaScore = trigramSimilarity(qNorm, `${store.category} ${store.city} ${store.area} ${store.description}`);
      const branchScore = trigramSimilarity(qNorm, branchText) * 0.9;
      const menuScore = trigramSimilarity(qNorm, menuText) * 0.85;
      const bestScore = Math.max(nameScore, metaScore, branchScore, menuScore);

      // Token fallback for partial Arabic words
      const tokens = qNorm.split(' ').filter((t) => t.length >= 2);
      const fullHaystack = normalizeArabicText(
        `${store.name} ${store.category} ${store.city} ${store.area} ${store.description} ${branchText} ${menuText}`
      );
      const tokenMatch = tokens.length > 0 && tokens.every((tok) => fullHaystack.includes(tok));

      if (!tokenMatch && bestScore < 0.24) {
        return null;
      }

      return { store, score: tokenMatch ? Math.max(bestScore, 0.78) : bestScore };
    })
    .filter((item): item is { store: Store; score: number } => item !== null)
    .sort((a, b) => b.score - a.score);

  const results = scored.map((item) => item.store);

  // Infer category for alternative suggestions when unregistered store is searched
  let inferredCategory = params.category && params.category !== 'الكل' ? params.category : undefined;
  if (!inferredCategory && qNorm) {
    if (/(قهو|كاف|مقه|لاتي|اسبريسو|coffee|cafe)/.test(qNorm)) inferredCategory = 'كافيه';
    else if (/(مطعم|برجر|شاورما|بيتزا|food|burger|restaurant)/.test(qNorm)) inferredCategory = 'مطعم';
    else if (/(صالون|تجميل|حلاق|سبا|salon|spa)/.test(qNorm)) inferredCategory = 'صالون';
    else if (/(مكتب|متجر|ملابس|عطور|book|store|shop)/.test(qNorm)) inferredCategory = 'متجر';
  }

  let alternatives: Store[] = [];
  if (results.length === 0) {
    const sameCategory = inferredCategory
      ? activeStores.filter((s) => s.category === inferredCategory)
      : [];
    alternatives = (sameCategory.length > 0 ? sameCategory : activeStores).slice(0, 3);
  }

  return { results, alternatives, inferredCategory };
}
