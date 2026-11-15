import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/server/db';
import { enforcePolicy } from '@/lib/server/policy';
import { rlsFilterStoresForUser } from '@/lib/server/rls';
import { normalizeStoreRequestKey } from '@/lib/server/arabicSearch';
import { antiScrapingGuard, invalidatePublicStoreCache } from '@/lib/server/publicCache';

export async function GET(req: NextRequest) {
  const guard = enforcePolicy(req, 'stores.list');
  if (!guard.ok) return guard.response;

  const scrapeCheck = antiScrapingGuard(req, { maxLimit: 50, maxPage: 10 });
  if (!scrapeCheck.ok) return scrapeCheck.response;

  const db = getDb();
  const visibleStores = rlsFilterStoresForUser(db.stores, guard.ctx.user);
  return NextResponse.json(
    { stores: visibleStores, packages: db.packages, siteSettings: db.siteSettings },
    {
      headers: guard.ctx.user
        ? { 'Cache-Control': 'private, no-store' }
        : { 'Cache-Control': 'no-store' },
    }
  );
}

export async function POST(req: NextRequest) {
  const guard = enforcePolicy(req, 'stores.request');
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const storeName = String(body.storeName || '').trim();
  const city = String(body.city || 'الرياض').trim() || 'الرياض';
  const category = String(body.category || 'مقترح من العملاء').trim();

  if (!storeName || storeName.length < 2) {
    return NextResponse.json({ error: 'يرجى كتابة اسم المتجر المقترح.' }, { status: 400 });
  }

  const db = getDb();
  const targetKey = normalizeStoreRequestKey(storeName, city);
  const existing = db.storeRequests.find(
    (r) => normalizeStoreRequestKey(r.storeName, r.city) === targetKey
  );

  if (existing) {
    existing.count += 1;
    existing.requestedAt = 'الآن';
    db.storeRequests.sort((a, b) => b.count - a.count);
    invalidatePublicStoreCache();
    return NextResponse.json({ request: existing, aggregated: true });
  }

  const created = {
    id: `req-${crypto.randomUUID().slice(0, 6)}`,
    storeName,
    category,
    city,
    requestedAt: 'الآن',
    count: 1,
  };
  db.storeRequests.push(created);
  db.storeRequests.sort((a, b) => b.count - a.count);
  invalidatePublicStoreCache();
  return NextResponse.json({ request: created, aggregated: false }, { status: 201 });
}
