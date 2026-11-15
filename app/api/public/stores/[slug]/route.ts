import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { enforcePolicy } from '@/lib/server/policy';
import { findStoreBySlugOrId, toPublicStoreDto } from '@/lib/server/publicDto';
import {
  antiScrapingGuard,
  getPublicCached,
  setPublicCached,
} from '@/lib/server/publicCache';
import { PublicStoreDTO } from '@/lib/types';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const guard = enforcePolicy(req, 'public.stores.detail');
  if (!guard.ok) return guard.response;

  const scrapeCheck = antiScrapingGuard(req);
  if (!scrapeCheck.ok) return scrapeCheck.response;

  const { slug } = await context.params;
  const cacheKey = `store:${slug.toLowerCase()}`;
  const cached = getPublicCached<PublicStoreDTO>(cacheKey);
  if (cached) {
    return NextResponse.json(
      { store: cached },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } }
    );
  }

  const db = getDb();
  const found = findStoreBySlugOrId(db.stores, slug);
  if (!found) {
    return NextResponse.json({ error: 'المتجر غير مسجل في Aada Pass حالياً.' }, { status: 404 });
  }

  const dto = toPublicStoreDto(found);
  setPublicCached(cacheKey, dto, 45_000);

  return NextResponse.json(
    { store: dto },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } }
  );
}
