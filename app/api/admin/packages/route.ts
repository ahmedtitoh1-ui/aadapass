import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { appendAuditLog, enforcePolicy } from '@/lib/server/policy';
import type { SubscriptionPackage } from '@/lib/types';

export async function GET(req: NextRequest) {
  const auth = enforcePolicy(req, 'admin.packages.list');
  if (!auth.ok) return auth.response;

  const db = getDb();
  return NextResponse.json({ packages: db.packages });
}

export async function POST(req: NextRequest) {
  const auth = enforcePolicy(req, 'admin.packages.mutate');
  if (!auth.ok) return auth.response;
  const { user, ip } = auth.ctx;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Partial<SubscriptionPackage> | null;
  if (!body?.title || !body?.name) {
    return NextResponse.json({ error: 'بيانات الباقة غير مكتملة.' }, { status: 400 });
  }

  const db = getDb();
  const created: SubscriptionPackage = {
    id: body.id || `pkg-${Date.now()}`,
    name: body.name,
    title: body.title,
    subtitle: body.subtitle || '',
    ctaText: body.ctaText || 'ابدأ تجربتك المجانية',
    priceText:
      body.priceText ||
      `${body.monthlyPriceEgp ?? 400} جنيه / شهرياً (أو ${body.monthlyPrice ?? 39} ريال سعودي)`,
    monthlyPrice: Number(body.monthlyPrice ?? 39),
    monthlyPriceEgp: Number(body.monthlyPriceEgp ?? 400),
    currency: body.currency || 'EGP',
    maxBranches: Number(body.maxBranches ?? 1),
    maxStaff: Number(body.maxStaff ?? 2),
    maxCustomersPerMonth: Number(body.maxCustomersPerMonth ?? 0),
    loyaltyEnabled: body.loyaltyEnabled ?? true,
    features: Array.isArray(body.features) ? body.features : [],
    highlighted: Boolean(body.highlighted),
    promoText: body.promoText,
    promoDiscountPct: body.promoDiscountPct ? Number(body.promoDiscountPct) : undefined,
    annualDiscountPct:
      typeof body.annualDiscountPct === 'number' && Number.isFinite(body.annualDiscountPct)
        ? Math.max(0, Math.min(90, Math.round(body.annualDiscountPct)))
        : db.siteSettings.annualDiscountPct ?? 20,
    customPricing: Boolean(body.customPricing),
    hasOnlineOrdering: Boolean(body.hasOnlineOrdering),
    visibleOnLanding: body.visibleOnLanding ?? true,
    visibleForStores: body.visibleForStores ?? true,
    displayOrder: Number(body.displayOrder ?? db.packages.length + 1),
  };

  db.packages.push(created);
  db.packages.sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99));

  const auditLog = appendAuditLog({
    actorName: `${user.firstName} ${user.lastName}`,
    actorRole: user.role,
    action: 'إضافة باقة اشتراك جديدة',
    target: created.title,
    oldValue: 'غير موجودة',
    newValue: `${created.monthlyPriceEgp} EGP / ${created.monthlyPrice} SAR (Annual=${created.annualDiscountPct}%)`,
    ip,
  });

  return NextResponse.json({ package: created, packages: db.packages, auditLog }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = enforcePolicy(req, 'admin.packages.mutate');
  if (!auth.ok) return auth.response;
  const { user, ip } = auth.ctx;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | (Partial<SubscriptionPackage> & {
        id?: string;
        action?: 'set_global_annual_discount';
        applyToAllPackages?: boolean;
      })
    | null;

  const db = getDb();

  if (body?.action === 'set_global_annual_discount') {
    const pct = Math.max(0, Math.min(90, Math.round(Number(body.annualDiscountPct ?? 20))));
    const prevPct = db.siteSettings.annualDiscountPct ?? 20;
    db.siteSettings = {
      ...db.siteSettings,
      annualDiscountPct: pct,
      updatedAt: new Date().toISOString(),
    };
    if (body.applyToAllPackages !== false) {
      db.packages = db.packages.map((p) => ({
        ...p,
        annualDiscountPct: pct,
      }));
    }
    const auditLog = appendAuditLog({
      actorName: `${user.firstName} ${user.lastName}`,
      actorRole: user.role,
      action: 'تحديث نسبة خصم الدفع السنوي للباقات',
      target: 'Annual Billing Discount',
      oldValue: `${prevPct}%`,
      newValue: `${pct}% (تطبيق على الكل=${body.applyToAllPackages !== false})`,
      ip,
    });
    return NextResponse.json({
      packages: db.packages,
      siteSettings: db.siteSettings,
      auditLog,
    });
  }

  if (!body?.id) {
    return NextResponse.json({ error: 'معرف الباقة مطلوب.' }, { status: 400 });
  }

  const idx = db.packages.findIndex((p) => p.id === body.id);
  if (idx === -1) {
    return NextResponse.json({ error: 'الباقة غير موجودة.' }, { status: 404 });
  }

  const prev = db.packages[idx];
  const nextAnnualDiscount =
    typeof body.annualDiscountPct === 'number' && Number.isFinite(body.annualDiscountPct)
      ? Math.max(0, Math.min(90, Math.round(body.annualDiscountPct)))
      : prev.annualDiscountPct;

  const updated: SubscriptionPackage = {
    ...prev,
    ...body,
    annualDiscountPct: nextAnnualDiscount,
    id: prev.id,
  };
  db.packages[idx] = updated;
  db.packages.sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99));

  const auditLog = appendAuditLog({
    actorName: `${user.firstName} ${user.lastName}`,
    actorRole: user.role,
    action: 'تعديل باقة اشتراك وظهورها',
    target: updated.title,
    oldValue: `${prev.monthlyPriceEgp ?? prev.monthlyPrice} EGP | Annual=${prev.annualDiscountPct ?? 20}%`,
    newValue: `${updated.monthlyPriceEgp ?? updated.monthlyPrice} EGP | Annual=${updated.annualDiscountPct ?? 20}%`,
    ip,
  });

  return NextResponse.json({ package: updated, packages: db.packages, auditLog });
}

export async function DELETE(req: NextRequest) {
  const auth = enforcePolicy(req, 'admin.packages.mutate');
  if (!auth.ok) return auth.response;
  const { user, ip } = auth.ctx;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'معرف الباقة مطلوب.' }, { status: 400 });
  }

  const db = getDb();
  const existing = db.packages.find((p) => p.id === id);
  if (!existing) {
    return NextResponse.json({ error: 'الباقة غير موجودة.' }, { status: 404 });
  }

  db.packages = db.packages.filter((p) => p.id !== id);
  const auditLog = appendAuditLog({
    actorName: `${user.firstName} ${user.lastName}`,
    actorRole: user.role,
    action: 'حذف باقة اشتراك',
    target: existing.title,
    oldValue: `${existing.monthlyPrice} ${existing.currency}`,
    newValue: 'محذوفة',
    ip,
  });

  return NextResponse.json({ packages: db.packages, auditLog });
}
