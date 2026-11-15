import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/server/db';
import { enforcePolicy } from '@/lib/server/policy';
import type { MarketCurrency, VisitorLog } from '@/lib/types';

export async function GET(req: NextRequest) {
  const auth = enforcePolicy(req, 'admin.visitors.list');
  if (!auth.ok) return auth.response;

  const db = getDb();
  return NextResponse.json({
    visitorLogs: db.visitorLogs,
    customers: Array.from(db.customers.values()),
  });
}

export async function POST(req: NextRequest) {
  const auth = enforcePolicy(req, 'public.analytics.track');
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => null)) as Partial<VisitorLog> | null;
  if (!body) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const db = getDb();
  const currency: MarketCurrency =
    body.currency === 'SAR' || body.currency === 'AED' || body.currency === 'EGP' ? body.currency : 'EGP';

  const entry: VisitorLog = {
    id: `vis-${crypto.randomUUID().slice(0, 8)}`,
    sessionKey: String(body.sessionKey || `sess-${crypto.randomUUID().slice(0, 6)}`).slice(0, 32),
    visitorType:
      body.visitorType === 'عميل مسجل' || body.visitorType === 'زائر عائد' ? body.visitorType : 'زائر جديد',
    customerId: typeof body.customerId === 'string' ? body.customerId : undefined,
    customerName: typeof body.customerName === 'string' ? body.customerName : undefined,
    pagePath: String(body.pagePath || '/').slice(0, 120),
    storeName: typeof body.storeName === 'string' ? body.storeName.slice(0, 80) : undefined,
    city: String(body.city || (currency === 'SAR' ? 'الرياض' : 'القاهرة')).slice(0, 40),
    device: body.device === 'كمبيوتر' ? 'كمبيوتر' : 'جوال',
    currency,
    source:
      body.source === 'بحث جوجل' || body.source === 'QR متجر' || body.source === 'وسائل التواصل'
        ? body.source
        : 'مباشر',
    timestamp: new Date().toLocaleString('sv-SE').slice(0, 16),
    createdAtMs: Date.now(),
  };

  db.visitorLogs.unshift(entry);
  if (db.visitorLogs.length > 200) {
    db.visitorLogs = db.visitorLogs.slice(0, 200);
  }

  return NextResponse.json({ ok: true, id: entry.id }, { status: 201 });
}
