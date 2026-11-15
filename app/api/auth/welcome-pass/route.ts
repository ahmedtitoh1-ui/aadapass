import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb, ServerUserRecord } from '@/lib/server/db';
import { hashPassword, signQrPayload } from '@/lib/server/crypto';
import {
  attachSessionCookies,
  enforcePolicy,
  issueSessionTokens,
  toSessionUser,
} from '@/lib/server/policy';
import { CustomerProfile } from '@/lib/types';

export async function POST(req: NextRequest) {
  const guard = enforcePolicy(req, 'auth.welcomePass');
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const fullName = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();

  if (!fullName || !phone || phone.length < 8) {
    return NextResponse.json(
      { error: 'يرجى إدخال الاسم ورقم الجوال بصيغة +966 صحيحة.' },
      { status: 400 }
    );
  }

  const normalizedPhone = phone.startsWith('+') ? phone : `+966${phone.replace(/^0/, '')}`;
  const db = getDb();

  let user = db.users.find((u) => u.phone === normalizedPhone && u.role === 'CUSTOMER');
  const firstStore = db.stores.find((s) => s.status === 'active' && s.subscriptionPlan !== 'Viewer') || db.stores[0];

  if (!user) {
    const parts = fullName.split(/\s+/);
    const firstName = parts[0] || fullName;
    const lastName = parts.slice(1).join(' ') || 'العتيبي';
    const id = `cust-${crypto.randomUUID().slice(0, 8)}`;
    const username = `guest_${crypto.randomUUID().slice(0, 6)}`;
    const qrKeyId = crypto.randomBytes(4).toString('hex').toUpperCase();
    const { issueEd25519QrToken } = await import('@/lib/server/crypto');
    const qr = issueEd25519QrToken({ qrKeyId, ttlSeconds: 90 });

    const newCustomer: CustomerProfile = {
      id,
      firstName,
      lastName,
      username,
      email: `${username}@aadapass.sa`,
      phone: normalizedPhone,
      phoneVerified: true,
      marketingConsent: true,
      geoProximityConsent: true,
      totalPointsAcrossAllStores: 50,
      qrKeyId,
      qrCodeToken: qr.token,
      qrSignature: qr.signature,
      qrIssuedAt: qr.issuedAt,
      qrExpiresAt: qr.expiresAt,
      qrExpiresInSeconds: qr.ttlSeconds,
      referralCode: `AADA-${id.slice(-4).toUpperCase()}`,
      referralsCount: 0,
      followedStoreIds: firstStore ? [firstStore.id] : [],
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
      cards: firstStore
        ? [
            {
              id: `card-${crypto.randomUUID().slice(0, 6)}`,
              customerId: id,
              merchantId: firstStore.merchantId,
              storeId: firstStore.id,
              storeName: firstStore.name,
              storeLogo: firstStore.logo,
              cardColor: firstStore.cardColor,
              cardTextColor: firstStore.cardTextColor,
              currency: firstStore.currency,
              rule: firstStore.loyaltyRule,
              currentBalance: 50,
              totalEarned: 50,
              isActive: true,
            },
          ]
        : [],
    };
    db.customers.set(id, newCustomer);

    const record: ServerUserRecord = {
      id,
      username,
      firstName,
      lastName,
      email: newCustomer.email,
      phone: normalizedPhone,
      role: 'CUSTOMER',
      passwordHash: hashPassword('demo1234'),
      failedAttempts: 0,
      lockedUntil: null,
      tokenVersion: 1,
    };
    db.users.push(record);
    user = record;
  }

  const profile = db.customers.get(user.id);
  const { accessToken, rawRefresh } = issueSessionTokens(user);
  const res = NextResponse.json({
    user: toSessionUser(user),
    customer: profile,
    accessToken,
  });
  return attachSessionCookies(res, accessToken, rawRefresh, req);
}
