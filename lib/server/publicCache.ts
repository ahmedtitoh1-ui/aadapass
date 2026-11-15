import { NextRequest, NextResponse } from 'next/server';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const publicCache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 45_000; // Short 45s cache for public directory queries

export function getPublicCached<T>(key: string): T | null {
  const entry = publicCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    publicCache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setPublicCached<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): void {
  publicCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

export function invalidatePublicStoreCache(): void {
  publicCache.clear();
}

const BLOCKED_SCRAPER_PATTERNS = [
  /scrapy/i,
  /httrack/i,
  /wget/i,
  /libwww-perl/i,
  /masscan/i,
  /sqlmap/i,
  /nikto/i,
];

/**
 * Lightweight anti-scraping protection for anonymous public endpoints:
 * - Blocks known automated bulk scrapers by User-Agent signature
 * - Rejects excessive pagination offsets or page sizes
 */
export function antiScrapingGuard(
  req: NextRequest,
  options: { maxLimit?: number; maxPage?: number } = {}
): { ok: true; limit: number; page: number } | { ok: false; response: NextResponse } {
  const ua = req.headers.get('user-agent') || '';
  if (BLOCKED_SCRAPER_PATTERNS.some((rx) => rx.test(ua))) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'تم حظر الطلب الآلي لحماية بيانات الدليل.' },
        { status: 403 }
      ),
    };
  }

  const maxLimit = options.maxLimit ?? 24;
  const maxPage = options.maxPage ?? 10;
  const rawLimit = Number(req.nextUrl.searchParams.get('limit') || 12);
  const rawPage = Number(req.nextUrl.searchParams.get('page') || 1);

  if (Number.isNaN(rawLimit) || Number.isNaN(rawPage) || rawPage < 1 || rawPage > maxPage) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'نطاق التصفح المطلوب غير مسموح.' },
        { status: 400 }
      ),
    };
  }

  const limit = Math.min(maxLimit, Math.max(1, Math.floor(rawLimit)));
  const page = Math.floor(rawPage);
  return { ok: true, limit, page };
}
