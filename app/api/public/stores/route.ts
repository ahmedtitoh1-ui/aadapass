import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { enforcePolicy } from '@/lib/server/policy';
import { searchStoresWithTrigram } from '@/lib/server/arabicSearch';
import { toPublicStoreDto } from '@/lib/server/publicDto';
import {
  antiScrapingGuard,
  getPublicCached,
  setPublicCached,
} from '@/lib/server/publicCache';
import { PublicStoreDTO } from '@/lib/types';

interface PublicSearchPayload {
  stores: PublicStoreDTO[];
  alternatives: PublicStoreDTO[];
  total: number;
  page: number;
  limit: number;
  inferredCategory?: string;
}

export async function GET(req: NextRequest) {
  const guard = enforcePolicy(req, 'public.stores.search');
  if (!guard.ok) return guard.response;

  const scrapeCheck = antiScrapingGuard(req, { maxLimit: 24, maxPage: 10 });
  if (!scrapeCheck.ok) return scrapeCheck.response;

  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') || '').trim();
  const category = (sp.get('category') || '').trim();
  const city = (sp.get('city') || '').trim();
  const area = (sp.get('area') || '').trim();
  const onlyOffers = sp.get('nearby') === '1' || sp.get('offers') === '1';

  const cacheKey = `search:${q}:${category}:${city}:${area}:${onlyOffers}:${scrapeCheck.page}:${scrapeCheck.limit}`;
  const cached = getPublicCached<PublicSearchPayload>(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  }

  const db = getDb();
  const { results, alternatives, inferredCategory } = searchStoresWithTrigram(db.stores, {
    q,
    category,
    city,
    area,
    onlyOffers,
  });

  const start = (scrapeCheck.page - 1) * scrapeCheck.limit;
  const paged = results.slice(start, start + scrapeCheck.limit).map(toPublicStoreDto);

  const payload: PublicSearchPayload = {
    stores: paged,
    alternatives: alternatives.map(toPublicStoreDto),
    total: results.length,
    page: scrapeCheck.page,
    limit: scrapeCheck.limit,
    inferredCategory,
  };

  setPublicCached(cacheKey, payload, 45_000);

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
    },
  });
}
