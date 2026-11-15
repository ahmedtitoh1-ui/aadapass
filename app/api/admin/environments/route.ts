import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getDb, ServerUserRecord } from '@/lib/server/db';
import { hashPassword } from '@/lib/server/crypto';
import { buildStoreSlug } from '@/lib/server/arabicSearch';
import { invalidatePublicStoreCache } from '@/lib/server/publicCache';
import { appendAuditLog, enforcePolicy } from '@/lib/server/policy';
import type { EnvironmentType, MarketCurrency, PlatformEnvironment, Store } from '@/lib/types';

function buildLoginUrl(slug: string, username?: string): string {
  const base = `/?login=merchant&env=${encodeURIComponent(slug)}`;
  return username ? `${base}&user=${encodeURIComponent(username)}` : base;
}

function defaultExpiryDate(): string {
  return new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const auth = enforcePolicy(req, 'admin.environments.list');
  if (!auth.ok) return auth.response;

  const db = getDb();
  return NextResponse.json({ environments: db.environments });
}

export async function POST(req: NextRequest) {
  const auth = enforcePolicy(req, 'admin.environments.mutate');
  if (!auth.ok) return auth.response;
  const { user, ip } = auth.ctx;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | (Partial<PlatformEnvironment> & { password?: string })
    | null;

  const name = String(body?.name || '').trim();
  const rawSlug = String(body?.slug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!name) {
    return NextResponse.json({ error: 'اسم البيئة مطلوب.' }, { status: 400 });
  }

  const cleanUsername = String(body?.username || '').trim();
  if (cleanUsername.length < 3) {
    return NextResponse.json(
      { error: 'اسم المستخدم للدخول مطلوب ويجب ألا يقل عن 3 أحرف.' },
      { status: 400 }
    );
  }
  if (!/^[a-zA-Z0-9._@-]+$/.test(cleanUsername)) {
    return NextResponse.json(
      { error: 'اسم المستخدم يجب أن يحتوي على أحرف إنجليزية أو أرقام فقط بدون مسافات.' },
      { status: 400 }
    );
  }

  const password = String(body?.password || '');
  if (password.length < 6) {
    return NextResponse.json(
      { error: 'كلمة المرور مطلوبة ويجب أن تتكون من 6 أحرف على الأقل.' },
      { status: 400 }
    );
  }

  const storeCategory = String(body?.storeCategory || 'كافيه').trim() || 'كافيه';
  const storeName = String(body?.storeName || name).trim() || name;
  const rawAmount = Number(body?.subscriptionAmount ?? 0);
  if (!Number.isFinite(rawAmount) || rawAmount < 0) {
    return NextResponse.json({ error: 'قيمة المبلغ يجب أن تكون رقماً موجباً أو صفراً.' }, { status: 400 });
  }
  const subscriptionAmount = Math.round(rawAmount * 100) / 100;

  const rawExpiresAt = String(body?.expiresAt || '').trim();
  const expiresAt = rawExpiresAt || defaultExpiryDate();
  if (Number.isNaN(Date.parse(expiresAt))) {
    return NextResponse.json({ error: 'صيغة تاريخ الانتهاء غير صالحة.' }, { status: 400 });
  }

  const db = getDb();
  const slug = rawSlug || `env-${Date.now().toString(36)}`;
  if (db.environments.some((e) => e.slug === slug)) {
    return NextResponse.json({ error: 'المعرف (Slug) مستخدم لبيئة أخرى بالفعل.' }, { status: 409 });
  }
  if (db.users.some((u) => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
    return NextResponse.json(
      { error: `اسم المستخدم (@${cleanUsername}) مسجل بالفعل، يرجى اختيار اسم مستخدم آخر.` },
      { status: 409 }
    );
  }

  const now = new Date().toLocaleString('sv-SE').slice(0, 16);
  const envType: EnvironmentType =
    body?.type === 'production' ||
    body?.type === 'staging' ||
    body?.type === 'sandbox' ||
    body?.type === 'development'
      ? body.type
      : 'sandbox';
  const currencyScope: 'ALL' | 'EGP' | 'SAR' =
    body?.currencyScope === 'EGP' || body?.currencyScope === 'SAR' ? body.currencyScope : 'ALL';
  const storeCurrency: MarketCurrency = currencyScope === 'EGP' ? 'EGP' : 'SAR';
  const isActive = body?.isActive ?? true;
  const maintenanceMode = body?.maintenanceMode ?? !isActive;

  const envId = `env-${slug}-${Date.now().toString(36)}`;
  const merchantId = `merch-${crypto.randomUUID().slice(0, 6)}`;
  const storeId = `store-${crypto.randomUUID().slice(0, 6)}`;
  const branchId = `b-${crypto.randomUUID().slice(0, 6)}`;
  const userId = `usr-${crypto.randomUUID().slice(0, 8)}`;
  const loginUrl = buildLoginUrl(slug, cleanUsername);

  const cityDefault = storeCurrency === 'EGP' ? 'القاهرة' : 'الرياض';
  const newStore: Store = {
    id: storeId,
    slug: buildStoreSlug({ id: storeId, name: storeName }),
    merchantId,
    name: storeName,
    logo: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=200',
    cover: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&q=80&w=1200',
    category: storeCategory,
    description:
      String(body?.description || '').trim() ||
      `متجر ${storeName} (${storeCategory}) — بيئة تشغيل مخصصة على منصة عادة باس.`,
    city: cityDefault,
    area: storeCurrency === 'EGP' ? 'المعادي' : 'العليا',
    address: 'الشارع الرئيسي',
    phone: storeCurrency === 'EGP' ? '+201000000000' : '+966500000000',
    workingHours: 'يومياً 8:00 ص - 11:00 م',
    wifiPassword: 'AadaGuestWifi',
    instagramUrl: 'https://instagram.com/aadapass.sa',
    googleMapLink: 'https://maps.google.com',
    subscriptionPlan: 'Growth',
    requestedPlan: 'Growth',
    subscriptionExpiry: expiresAt,
    subscriptionState: isActive ? 'active' : 'readonly',
    status: isActive ? 'active' : 'pending',
    verifiedOwnership: true,
    createdAt: new Date().toISOString(),
    ownerName: storeName,
    ownerEmail: `${cleanUsername}@${slug}.aadapass.com`,
    currency: storeCurrency,
    branches: [
      {
        id: branchId,
        merchantId,
        name: 'الفرع الرئيسي',
        city: cityDefault,
        area: storeCurrency === 'EGP' ? 'المعادي' : 'العليا',
        address: 'الشارع الرئيسي',
        phone: storeCurrency === 'EGP' ? '+201000000000' : '+966500000000',
        crowdLevel: 'هادئ',
        visitorsCount: 0,
      },
    ],
    menu: [],
    programs: [],
    programVersions: [],
    vouchers: [],
    campaigns: [],
    cashiers: [],
    loyaltyRule: {
      type: 'points',
      pointsCalcMode: 'per_amount',
      currencyUnitAmount: 10,
      pointsPerUnit: 10,
      rewardTargetPoints: 100,
      rewardDescription:
        storeCurrency === 'SAR' ? '100 نقطة = خصم 15 ر.س' : '100 نقطة = خصم 25 ج.م',
      maxRedemption: 1000,
    },
    cardColor: 'from-[#0B1F3A] via-[#10325E] to-[#007BFF]',
    cardTextColor: 'text-white',
    visitorSeries: [
      { label: 'السبت', digitalVisitors: 0, verifiedPurchases: 0 },
      { label: 'الأحد', digitalVisitors: 0, verifiedPurchases: 0 },
      { label: 'الإثنين', digitalVisitors: 0, verifiedPurchases: 0 },
      { label: 'الثلاثاء', digitalVisitors: 0, verifiedPurchases: 0 },
      { label: 'الأربعاء', digitalVisitors: 0, verifiedPurchases: 0 },
      { label: 'الخميس', digitalVisitors: 0, verifiedPurchases: 0 },
      { label: 'الجمعة', digitalVisitors: 0, verifiedPurchases: 0 },
    ],
    metrics: {
      digitalVisitors: 0,
      verifiedPurchases: 0,
      activeCards: 0,
      monthlySales: 0,
      pointsGranted: 0,
      rewardsRedeemed: 0,
      refundLossTotal: 0,
      retentionRate: 0,
      newCustomers: 0,
      returningCustomers: 0,
      inactiveCustomers: 0,
      avgVisits: 0,
      redemptionRate: 0,
      repeatPurchaseRate: 0,
    },
  };

  const provisionedUser: ServerUserRecord = {
    id: userId,
    username: cleanUsername,
    firstName: storeName,
    lastName: '(مدير البيئة)',
    email: `${cleanUsername}@${slug}.aadapass.com`,
    phone: storeCurrency === 'EGP' ? '+201000000000' : '+966500000000',
    passwordHash: hashPassword(password),
    role: 'MERCHANT_OWNER',
    merchantId,
    environmentId: envId,
    branchId,
    branchIds: [branchId],
    failedAttempts: 0,
    lockedUntil: null,
    tokenVersion: 1,
  };

  const created: PlatformEnvironment = {
    id: envId,
    name,
    slug,
    type: envType,
    domainUrl: String(body?.domainUrl || `https://${slug}.aadapass.com`).trim(),
    description: String(body?.description || `بيئة تشغيل مخصصة لنشاط ${storeCategory}`).trim(),
    isActive,
    maintenanceMode,
    allowPublicRegistration: body?.allowPublicRegistration ?? true,
    allowStoreOnboarding: body?.allowStoreOnboarding ?? true,
    apiEnabled: body?.apiEnabled ?? true,
    currencyScope,
    storeCategory,
    storeName,
    merchantId,
    username: cleanUsername,
    subscriptionAmount,
    expiresAt,
    loginUrl,
    createdAt: now,
    updatedAt: now,
  };

  db.stores.unshift(newStore);
  db.users.push(provisionedUser);
  db.environments.unshift(created);
  invalidatePublicStoreCache();

  const auditLog = appendAuditLog({
    actorName: `${user.firstName} ${user.lastName}`,
    actorRole: user.role,
    action: 'إنشاء بيئة تشغيل وحساب دخول جديد',
    target: `${created.name} (@${cleanUsername})`,
    oldValue: 'غير موجودة',
    newValue: `${storeCategory} · المبلغ: ${subscriptionAmount} · الانتهاء: ${expiresAt} · ${isActive ? 'مفعلة' : 'مغلقة'}`,
    ip,
  });

  return NextResponse.json(
    {
      environment: created,
      environments: db.environments,
      store: newStore,
      loginUrl,
      auditLog,
    },
    { status: 201 }
  );
}

export async function PATCH(req: NextRequest) {
  const auth = enforcePolicy(req, 'admin.environments.mutate');
  if (!auth.ok) return auth.response;
  const { user, ip } = auth.ctx;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | (Partial<PlatformEnvironment> & { id?: string; newPassword?: string })
    | null;
  if (!body?.id) {
    return NextResponse.json({ error: 'معرف البيئة مطلوب.' }, { status: 400 });
  }

  const db = getDb();
  const idx = db.environments.findIndex((e) => e.id === body.id);
  if (idx === -1) {
    return NextResponse.json({ error: 'البيئة غير موجودة.' }, { status: 404 });
  }

  const prev = db.environments[idx];
  const now = new Date().toLocaleString('sv-SE').slice(0, 16);

  if (typeof body.newPassword === 'string' && body.newPassword.length > 0 && body.newPassword.length < 6) {
    return NextResponse.json(
      { error: 'كلمة المرور الجديدة يجب أن تتكون من 6 أحرف على الأقل.' },
      { status: 400 }
    );
  }

  if (body.subscriptionAmount !== undefined) {
    const amt = Number(body.subscriptionAmount);
    if (!Number.isFinite(amt) || amt < 0) {
      return NextResponse.json({ error: 'قيمة المبلغ يجب أن تكون رقماً موجباً أو صفراً.' }, { status: 400 });
    }
  }

  if (typeof body.expiresAt === 'string' && body.expiresAt.trim() && Number.isNaN(Date.parse(body.expiresAt.trim()))) {
    return NextResponse.json({ error: 'صيغة تاريخ الانتهاء غير صالحة.' }, { status: 400 });
  }

  const nextActive = typeof body.isActive === 'boolean' ? body.isActive : prev.isActive;
  const nextMaintenance =
    typeof body.maintenanceMode === 'boolean'
      ? body.maintenanceMode
      : typeof body.isActive === 'boolean'
      ? !body.isActive
      : prev.maintenanceMode;

  const nextStoreCategory =
    typeof body.storeCategory === 'string' && body.storeCategory.trim()
      ? body.storeCategory.trim()
      : prev.storeCategory;
  const nextStoreName =
    typeof body.storeName === 'string' && body.storeName.trim()
      ? body.storeName.trim()
      : prev.storeName;
  const nextAmount =
    body.subscriptionAmount !== undefined
      ? Math.round(Number(body.subscriptionAmount) * 100) / 100
      : prev.subscriptionAmount;
  const nextExpiresAt =
    typeof body.expiresAt === 'string' && body.expiresAt.trim()
      ? body.expiresAt.trim()
      : prev.expiresAt;

  const updated: PlatformEnvironment = {
    ...prev,
    name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : prev.name,
    domainUrl:
      typeof body.domainUrl === 'string' && body.domainUrl.trim() ? body.domainUrl.trim() : prev.domainUrl,
    description: typeof body.description === 'string' ? body.description.trim() : prev.description,
    type:
      body.type === 'production' ||
      body.type === 'staging' ||
      body.type === 'sandbox' ||
      body.type === 'development'
        ? body.type
        : prev.type,
    isActive: nextActive,
    maintenanceMode: nextMaintenance,
    allowPublicRegistration:
      typeof body.allowPublicRegistration === 'boolean'
        ? body.allowPublicRegistration
        : prev.allowPublicRegistration,
    allowStoreOnboarding:
      typeof body.allowStoreOnboarding === 'boolean'
        ? body.allowStoreOnboarding
        : prev.allowStoreOnboarding,
    apiEnabled: typeof body.apiEnabled === 'boolean' ? body.apiEnabled : prev.apiEnabled,
    currencyScope:
      body.currencyScope === 'ALL' || body.currencyScope === 'EGP' || body.currencyScope === 'SAR'
        ? body.currencyScope
        : prev.currencyScope,
    storeCategory: nextStoreCategory,
    storeName: nextStoreName,
    subscriptionAmount: nextAmount,
    expiresAt: nextExpiresAt,
    loginUrl: prev.loginUrl || buildLoginUrl(prev.slug, prev.username),
    updatedAt: now,
  };

  db.environments[idx] = updated;

  // Sync linked provisioned merchant store if present
  if (updated.merchantId) {
    const linkedStore = db.stores.find((s) => s.merchantId === updated.merchantId);
    if (linkedStore) {
      if (nextStoreCategory) linkedStore.category = nextStoreCategory;
      if (nextStoreName) linkedStore.name = nextStoreName;
      if (nextExpiresAt) linkedStore.subscriptionExpiry = nextExpiresAt;
      linkedStore.status = updated.isActive ? 'active' : 'suspended';
      linkedStore.subscriptionState = updated.isActive ? 'active' : 'readonly';
      invalidatePublicStoreCache();
    }
  }

  // Optional password update for the linked environment user
  let passwordUpdated = false;
  if (typeof body.newPassword === 'string' && body.newPassword.length >= 6) {
    const linkedUser = db.users.find(
      (u) =>
        u.environmentId === prev.id ||
        (prev.merchantId && u.merchantId === prev.merchantId && u.role === 'MERCHANT_OWNER')
    );
    if (linkedUser) {
      linkedUser.passwordHash = hashPassword(body.newPassword);
      linkedUser.tokenVersion += 1;
      linkedUser.failedAttempts = 0;
      linkedUser.lockedUntil = null;
      passwordUpdated = true;
    }
  }

  const auditLog = appendAuditLog({
    actorName: `${user.firstName} ${user.lastName}`,
    actorRole: user.role,
    action: passwordUpdated
      ? 'تحديث كلمة مرور وبيانات بيئة التشغيل'
      : prev.isActive !== updated.isActive
      ? updated.isActive
        ? 'تفعيل بيئة تشغيل'
        : 'قفل وتعطيل بيئة تشغيل'
      : 'تحديث إعدادات بيئة التشغيل',
    target: `${updated.name} (${updated.slug})`,
    oldValue: `${prev.isActive ? 'مفعلة' : 'مغلقة'} | انتهاء=${prev.expiresAt || '-'} | مبلغ=${prev.subscriptionAmount ?? 0}`,
    newValue: `${updated.isActive ? 'مفعلة' : 'مغلقة'} | انتهاء=${updated.expiresAt || '-'} | مبلغ=${updated.subscriptionAmount ?? 0}${passwordUpdated ? ' | تم تغيير كلمة المرور' : ''}`,
    ip,
  });

  return NextResponse.json({
    environment: updated,
    environments: db.environments,
    passwordUpdated,
    auditLog,
  });
}

export async function DELETE(req: NextRequest) {
  const auth = enforcePolicy(req, 'admin.environments.mutate');
  if (!auth.ok) return auth.response;
  const { user, ip } = auth.ctx;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'معرف البيئة مطلوب.' }, { status: 400 });
  }
  if (id === 'env-prod') {
    return NextResponse.json({ error: 'لا يمكن حذف بيئة الإنتاج الأساسية (يمكنك قفلها فقط).' }, { status: 400 });
  }

  const db = getDb();
  const existing = db.environments.find((e) => e.id === id);
  if (!existing) {
    return NextResponse.json({ error: 'البيئة غير موجودة.' }, { status: 404 });
  }

  db.environments = db.environments.filter((e) => e.id !== id);
  db.users = db.users.filter((u) => u.environmentId !== id);
  if (existing.merchantId) {
    db.stores = db.stores.filter((s) => s.merchantId !== existing.merchantId);
    invalidatePublicStoreCache();
  }

  const auditLog = appendAuditLog({
    actorName: `${user.firstName} ${user.lastName}`,
    actorRole: user.role,
    action: 'حذف بيئة تشغيل',
    target: `${existing.name} (${existing.slug})`,
    oldValue: existing.type,
    newValue: 'محذوفة',
    ip,
  });

  return NextResponse.json({ environments: db.environments, auditLog });
}
