import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb, ServerUserRecord } from '@/lib/server/db';
import { hashPassword, signQrPayload } from '@/lib/server/crypto';
import {
  appendAuditLog,
  attachSessionCookies,
  enforcePolicy,
  issueSessionTokens,
  toSessionUser,
} from '@/lib/server/policy';
import { CustomerCard, CustomerProfile, MarketCurrency, Store } from '@/lib/types';
import { buildStoreSlug } from '@/lib/server/arabicSearch';
import { invalidatePublicStoreCache } from '@/lib/server/publicCache';

export async function POST(req: NextRequest) {
  const guard = enforcePolicy(req, 'auth.register');
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const rawFullName = String(body.fullName || '').trim();
  const nameParts = rawFullName ? rawFullName.split(/\s+/) : [];
  const firstName = String(body.firstName || nameParts[0] || '').trim() || 'عميل';
  const lastName = String(body.lastName || nameParts.slice(1).join(' ') || '').trim() || 'مميز';
  const phone = String(body.phone || '').trim() || '+966500000000';
  const cleanDigits = phone.replace(/[^0-9]/g, '');
  const username =
    String(body.username || '').trim() ||
    `c_${cleanDigits ? cleanDigits.slice(-6) : crypto.randomUUID().slice(0, 6)}`;
  const email = String(body.email || '').trim() || `${username}@customer.aadapass.sa`;
  const password = String(body.password || 'demo1234');
  // Strict role isolation: registration ONLY permits CUSTOMER or MERCHANT_OWNER (never admin/support/cashier)
  const accountType = body.accountType === 'MERCHANT_OWNER' ? 'MERCHANT_OWNER' : 'CUSTOMER';

  const db = getDb();
  const explicitUsername = String(body.username || '').trim();
  const existingByUsername = explicitUsername
    ? db.users.find((u) => u.username.toLowerCase() === explicitUsername.toLowerCase())
    : undefined;

  if (existingByUsername) {
    // If same customer and password matches, log them right in; otherwise report username conflict
    if (
      accountType === 'CUSTOMER' &&
      existingByUsername.role === 'CUSTOMER' &&
      existingByUsername.passwordHash === hashPassword(password)
    ) {
      const { accessToken, rawRefresh } = issueSessionTokens(existingByUsername);
      const res = NextResponse.json(
        {
          user: toSessionUser(existingByUsername),
          accessToken,
          alreadyExisted: true,
          message: 'مرحباً بعودتك! تم تسجيل دخولك بنجاح.',
        },
        { status: 200 }
      );
      return attachSessionCookies(res, accessToken, rawRefresh, req);
    }
    return NextResponse.json(
      { error: 'اسم المستخدم هذا مستخدم بالفعل، يرجى اختيار اسم مستخدم آخر.' },
      { status: 409 }
    );
  }

  // Also check if already registered by phone or email
  const existingUser = db.users.find(
    (u) =>
      u.username.toLowerCase() === username.toLowerCase() ||
      (phone && u.phone && u.phone === phone) ||
      (body.email && u.email.toLowerCase() === email.toLowerCase())
  );
  if (existingUser) {
    if (accountType === 'CUSTOMER' && existingUser.role === 'CUSTOMER' && !explicitUsername) {
      const { accessToken, rawRefresh } = issueSessionTokens(existingUser);
      const res = NextResponse.json(
        {
          user: toSessionUser(existingUser),
          accessToken,
          alreadyExisted: true,
          message: 'مرحباً بعودتك! تم تسجيل دخولك بنجاح.',
        },
        { status: 200 }
      );
      return attachSessionCookies(res, accessToken, rawRefresh, req);
    }
    return NextResponse.json({ error: 'اسم المستخدم أو البريد الإلكتروني أو الهاتف مسجل بالفعل.' }, { status: 409 });
  }

  const userId = `usr-${crypto.randomUUID().slice(0, 8)}`;
  let merchantId: string | undefined;
  let createdStore: Store | undefined;
  const trialDays = Math.max(1, Math.min(90, Math.round(db.siteSettings.trialDays ?? 14)));

  if (accountType === 'MERCHANT_OWNER') {
    merchantId = `merch-${crypto.randomUUID().slice(0, 6)}`;
    const storeId = `store-${crypto.randomUUID().slice(0, 6)}`;
    const currency: MarketCurrency = body.currency === 'EGP' ? 'EGP' : 'SAR';
    const branchId = `b-${crypto.randomUUID().slice(0, 6)}`;
    const storeName = String(body.storeName || `${firstName} Store`).trim();
    const storePhone = String(body.storePhone || phone).trim();
    const cityDefault = currency === 'EGP' ? 'القاهرة' : 'الرياض';
    const storeCity = String(body.city || cityDefault).trim() || cityDefault;
    const storeArea = String(body.area || (currency === 'EGP' ? 'المعادي' : 'العليا')).trim();
    const storeAddress = String(body.address || 'الشارع الرئيسي').trim();
    const storeDescription =
      String(body.description || '').trim() ||
      `متجر ${storeName} في ${storeCity} — مشترك حديثاً في تجربة عادة باس المجانية (${trialDays} يوماً).`;
    const workingHours = String(body.workingHours || 'يومياً 8:00 ص - 11:00 م').trim();
    const commercialReg = String(body.commercialReg || '').trim() || undefined;
    const chosenPlan = (body.plan as Store['subscriptionPlan']) || 'Starter';
    const storeLogo =
      typeof body.logo === 'string' && body.logo.trim()
        ? body.logo.trim()
        : 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=200';
    const storeCover =
      typeof body.cover === 'string' && body.cover.trim()
        ? body.cover.trim()
        : 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&q=80&w=1200';
    const secondaryLogo =
      typeof body.secondaryLogo === 'string' && body.secondaryLogo.trim()
        ? body.secondaryLogo.trim()
        : undefined;
    const wifiPassword =
      typeof body.wifiPassword === 'string' && body.wifiPassword.trim()
        ? body.wifiPassword.trim()
        : 'AadaGuestWifi';
    const instagramUrl =
      typeof body.instagramUrl === 'string' && body.instagramUrl.trim()
        ? body.instagramUrl.trim()
        : 'https://instagram.com/aadapass.sa';
    const googleMapLink =
      typeof body.googleMapLink === 'string' && body.googleMapLink.trim()
        ? body.googleMapLink.trim()
        : 'https://maps.google.com';

    const trialStartedAt = new Date().toISOString();
    const trialEndStr = new Date(Date.now() + trialDays * 86_400_000).toISOString().slice(0, 10);
    const defaultLoyaltyRule: Store['loyaltyRule'] = {
      type: 'points',
      pointsCalcMode: 'per_amount',
      currencyUnitAmount: 10,
      pointsPerUnit: 10,
      rewardTargetPoints: 100,
      rewardDescription: currency === 'SAR' ? '100 نقطة = خصم 15 ر.س' : '100 نقطة = خصم 25 ج.م',
      maxRedemption: 1000,
    };

    const newStore: Store = {
      id: storeId,
      slug: buildStoreSlug({ id: storeId, name: storeName }),
      merchantId,
      name: storeName,
      logo: storeLogo,
      secondaryLogo,
      cover: storeCover,
      category: (body.category as Store['category']) || 'كافيه',
      description: storeDescription,
      city: storeCity,
      area: storeArea,
      address: storeAddress,
      phone: storePhone,
      workingHours,
      wifiPassword,
      instagramUrl,
      googleMapLink,
      commercialReg,
      subscriptionPlan: chosenPlan,
      requestedPlan: chosenPlan,
      subscriptionExpiry: trialEndStr,
      subscriptionState: 'active',
      status: 'pending',
      verifiedOwnership: false,
      createdAt: new Date().toISOString(),
      trialDaysGranted: trialDays,
      trialStartedAt,
      trialEndsAt: trialEndStr,
      ownerName: `${firstName} ${lastName}`,
      ownerEmail: email,
      currency,
      branches: [
        {
          id: branchId,
          merchantId,
          name: 'الفرع الرئيسي',
          city: storeCity,
          area: storeArea,
          address: storeAddress,
          phone: storePhone,
          crowdLevel: 'هادئ',
          visitorsCount: 0,
        },
      ],
      menu: [],
      programs: [],
      programVersions: [],
      vouchers: [],
      campaigns: [],
      partnerPointShares: [],
      cashiers: [],
      loyaltyRule: defaultLoyaltyRule,
      cardColor: 'from-[#0B1F3A] via-[#10325E] to-[#007BFF]',
      cardTextColor: 'text-white',
      cardDesigns: [
        {
          id: `cd-${crypto.randomUUID().slice(0, 6)}`,
          name: `بطاقة ولاء ${storeName} الأساسية`,
          description: `بطاقة الولاء الرقمية الرسمية لمتجر ${storeName}`,
          cardColor: 'from-[#0B1F3A] via-[#10325E] to-[#007BFF]',
          cardTextColor: 'text-white',
          secondaryLogo,
          loyaltyRule: defaultLoyaltyRule,
          active: true,
          isDefault: true,
          createdAt: new Date().toISOString().slice(0, 10),
          updatedAt: new Date().toISOString().slice(0, 10),
        },
      ],
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
    db.stores.unshift(newStore);
    createdStore = newStore;
    invalidatePublicStoreCache();

    db.tickets.unshift({
      id: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
      userType: 'تاجر',
      userName: `${firstName} ${lastName} (${storeName})`,
      merchantId,
      storeName,
      subject: `طلب تفعيل متجر جديد وباقة (${chosenPlan}) — ${storeName}`,
      message: `تم تسجيل متجر جديد: ${storeName} (${newStore.category}) | المالك: ${firstName} ${lastName} | الهاتف/واتساب: ${storePhone} | البريد: ${email} | الباقة المطلوبة: ${chosenPlan} | السوق: ${currency} - ${storeCity} (${storeArea}) | العنوان: ${storeAddress} | التجربة المجانية: ${trialDays} يوماً تنتهي في ${trialEndStr}. بانتظار المراجعة والتفعيل اليدوي.`,
      status: 'مفتوحة',
      priority: 'عالية',
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    });

    appendAuditLog({
      actorName: `${firstName} ${lastName}`,
      actorRole: 'MERCHANT_OWNER',
      action: `تسجيل متجر جديد بتجربة مجانية (${trialDays} يوم) بانتظار التفعيل اليدوي`,
      target: storeName,
      oldValue: '-',
      newValue: `PENDING · ${chosenPlan} · ينتهي ${trialEndStr} (${currency})`,
      ip: guard.ctx.ip,
    });
  } else {
    const qrKeyId = crypto.randomBytes(4).toString('hex').toUpperCase();
    const qr = (await import('@/lib/server/crypto')).issueEd25519QrToken({ qrKeyId, ttlSeconds: 90 });
    const stampsStore =
      db.stores.find((s) => s.status === 'active' && s.loyaltyRule.type === 'stamps') ||
      db.stores.find((s) => s.status === 'active') ||
      db.stores[0];
    const pointsStore =
      db.stores.find((s) => s.status === 'active' && s.loyaltyRule.type === 'points' && s.id !== stampsStore?.id) ||
      db.stores.find((s) => s.status === 'active' && s.id !== stampsStore?.id);

    const initialCards: CustomerCard[] = [];
    if (stampsStore) {
      initialCards.push({
        id: `c-init-${crypto.randomUUID().slice(0, 6)}`,
        customerId: userId,
        merchantId: stampsStore.merchantId,
        storeId: stampsStore.id,
        storeName: stampsStore.name,
        storeLogo: stampsStore.logo,
        currentBalance: stampsStore.loyaltyRule.type === 'stamps' ? 2 : 50,
        currency: stampsStore.currency || 'SAR',
        totalEarned: stampsStore.loyaltyRule.type === 'stamps' ? 2 : 50,
        cardColor: stampsStore.cardColor || 'from-sky-500 to-blue-700',
        cardTextColor: stampsStore.cardTextColor || '#FFFFFF',
        cardCategory: stampsStore.loyaltyRule.type === 'stamps' ? 'store_stamps' : 'store_points',
        rule: stampsStore.loyaltyRule,
        isActive: true,
      });
    }
    if (pointsStore) {
      initialCards.push({
        id: `c-init-${crypto.randomUUID().slice(0, 6)}`,
        customerId: userId,
        merchantId: pointsStore.merchantId,
        storeId: pointsStore.id,
        storeName: pointsStore.name,
        storeLogo: pointsStore.logo,
        currentBalance: 50,
        currency: pointsStore.currency || 'SAR',
        totalEarned: 50,
        cardColor: pointsStore.cardColor || 'from-emerald-500 to-teal-700',
        cardTextColor: pointsStore.cardTextColor || '#FFFFFF',
        cardCategory: 'store_points',
        rule: pointsStore.loyaltyRule,
        isActive: true,
      });
    }

    const customerProfile: CustomerProfile = {
      id: userId,
      firstName,
      lastName,
      username,
      email,
      phone,
      phoneVerified: true,
      marketingConsent: true,
      geoProximityConsent: true,
      totalPointsAcrossAllStores: 150,
      accountPointsBalance: 100,
      accountCardCode: `AADA-VIP-${qrKeyId.slice(0, 4)}`,
      cards: initialCards,
      qrKeyId,
      qrCodeToken: qr.token,
      qrSignature: qr.signature,
      qrIssuedAt: qr.issuedAt,
      qrExpiresAt: qr.expiresAt,
      qrExpiresInSeconds: qr.ttlSeconds,
      referralCode: `${username.toUpperCase()}-2026`,
      referralsCount: 0,
      followedStoreIds: initialCards.map((c) => c.storeId),
      vouchers: [],
      expiringPointsAlerts: [],
      notificationPrefs: {
        readyRewardAlert: true,
        newOfferAlert: true,
        expiry14DayAlert: true,
        expiry3DayAlert: true,
        absenceReminderEnabled: true,
        absenceReminderDays: 30,
        pushSubscribed: false,
      },
    };
    db.customers.set(userId, customerProfile);
  }

  const newUser: ServerUserRecord = {
    id: userId,
    username,
    firstName,
    lastName,
    email,
    phone,
    role: accountType,
    merchantId,
    passwordHash: hashPassword(password),
    failedAttempts: 0,
    lockedUntil: null,
    tokenVersion: 1,
  };
  db.users.push(newUser);

  const { accessToken, rawRefresh } = issueSessionTokens(newUser);
  const res = NextResponse.json(
    { user: toSessionUser(newUser), accessToken, store: createdStore, trialDays },
    { status: 201 }
  );
  return attachSessionCookies(res, accessToken, rawRefresh, req);
}
