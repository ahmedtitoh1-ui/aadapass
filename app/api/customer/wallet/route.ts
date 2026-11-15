import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { computeDerivedCustomerTotalPoints, getDb } from '@/lib/server/db';
import { appendAuditLog, clearSessionCookies, enforcePolicy } from '@/lib/server/policy';
import { issueEd25519QrToken } from '@/lib/server/crypto';
import { isStoreSubscriptionPaused, SMART_PAUSE_NOTICE } from '@/lib/subscriptionStatus';

export async function GET(req: NextRequest) {
  const guard = enforcePolicy(req, 'customer.wallet.get');
  if (!guard.ok) return guard.response;

  const db = getDb();
  const profile = db.customers.get(guard.ctx.user!.id);
  if (!profile) {
    return NextResponse.json({ error: 'ملف العميل غير موجود.' }, { status: 404 });
  }
  profile.totalPointsAcrossAllStores = computeDerivedCustomerTotalPoints(profile.cards);
  return NextResponse.json({ customer: profile });
}

export async function POST(req: NextRequest) {
  const guard = enforcePolicy(req, 'customer.wallet.join');
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const storeId = String(body.storeId || '');
  const requestedType = body.cardType === 'stamps' || body.cardType === 'points' ? body.cardType : undefined;
  const db = getDb();
  const store = db.stores.find((s) => s.id === storeId || s.merchantId === storeId);
  if (!store || store.subscriptionPlan === 'Viewer') {
    return NextResponse.json({ error: 'بطاقة الولاء غير متاحة لهذا المتجر.' }, { status: 400 });
  }
  if (isStoreSubscriptionPaused(store)) {
    return NextResponse.json({ error: SMART_PAUSE_NOTICE }, { status: 400 });
  }

  const profile = db.customers.get(guard.ctx.user!.id);
  if (!profile) {
    return NextResponse.json({ error: 'ملف العميل غير موجود.' }, { status: 404 });
  }

  const matchedDesign = requestedType
    ? (store.cardDesigns || []).find((d) => d.loyaltyRule.type === requestedType)
    : (store.cardDesigns || []).find((d) => d.isDefault) || (store.cardDesigns || [])[0];

  const effectiveRule = matchedDesign?.loyaltyRule || store.loyaltyRule;
  const alreadyHasSameType = profile.cards.some(
    (c) => c.storeId === store.id && c.rule.type === effectiveRule.type
  );

  if (!alreadyHasSameType) {
    profile.cards.push({
      id: `card-${crypto.randomUUID().slice(0, 6)}`,
      customerId: profile.id,
      merchantId: store.merchantId,
      storeId: store.id,
      storeName: store.name,
      storeLogo: store.logo,
      cardName:
        matchedDesign?.name ||
        (effectiveRule.type === 'stamps' ? `بطاقة أختام ${store.name}` : `بطاقة نقاط ${store.name}`),
      badgeText:
        matchedDesign?.badgeText ||
        (effectiveRule.type === 'stamps' ? 'بطاقة أختام متجر ☕' : 'بطاقة نقاط متجر ⭐'),
      cardColor: matchedDesign?.cardColor || store.cardColor,
      cardTextColor: matchedDesign?.cardTextColor || store.cardTextColor,
      cardSpacing: matchedDesign?.cardSpacing || 'normal',
      cardPattern: matchedDesign?.cardPattern || 'luxury',
      cardCategory: effectiveRule.type === 'stamps' ? 'store_stamps' : 'store_points',
      currency: store.currency,
      rule: effectiveRule,
      currentBalance: 0,
      totalEarned: 0,
      isActive: true,
    });
  }
  if (!profile.followedStoreIds.includes(store.id)) {
    profile.followedStoreIds.push(store.id);
  }
  profile.totalPointsAcrossAllStores = computeDerivedCustomerTotalPoints(profile.cards);

  return NextResponse.json({ customer: profile });
}

export async function PATCH(req: NextRequest) {
  const guard = enforcePolicy(req, 'customer.wallet.update');
  if (!guard.ok) return guard.response;

  const db = getDb();
  const userId = guard.ctx.user!.id;
  const profile = db.customers.get(userId);
  const userRecord = db.users.find((u) => u.id === userId);
  if (!profile || !userRecord) {
    return NextResponse.json({ error: 'ملف العميل غير موجود.' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));

  // Account Master Card Actions: share_to_store | gift_to_user | convert_to_voucher
  if (typeof body.accountAction === 'string') {
    const actionType = body.accountAction as 'share_to_store' | 'gift_to_user' | 'convert_to_voucher';
    const pointsAmount = Math.max(0, Math.round(Number(body.points || 0)));
    const currentAccountPts = profile.accountPointsBalance ?? 350;

    if (pointsAmount <= 0) {
      return NextResponse.json({ error: 'يرجى تحديد عدد نقاط صحيح أكبر من الصفر.' }, { status: 400 });
    }
    if (pointsAmount > currentAccountPts) {
      return NextResponse.json(
        { error: `رصيد بطاقة الحساب الحالي (${currentAccountPts} نقطة) غير كافٍ لإتمام العملية.` },
        { status: 400 }
      );
    }

    if (!Array.isArray(profile.accountTransfers)) {
      profile.accountTransfers = [];
    }

    if (actionType === 'share_to_store') {
      const targetStoreId = String(body.targetStoreId || '');
      const store = db.stores.find((s) => s.id === targetStoreId || s.merchantId === targetStoreId);
      if (!store) {
        return NextResponse.json({ error: 'المتجر المحدد غير موجود.' }, { status: 404 });
      }

      if (!db.networkRules.pointSharingEnabled) {
        return NextResponse.json(
          { error: 'خاصية مشاركة النقاط بين المتاجر معطلة حالياً من قبل مدير النظام.' },
          { status: 400 }
        );
      }
      const todayStr = new Date().toISOString().slice(0, 10);
      if (db.networkRules.pointSharingStartDate && todayStr < db.networkRules.pointSharingStartDate) {
        return NextResponse.json(
          { error: `فترة مشاركة النقاط لم تبدأ بعد (تبدأ في ${db.networkRules.pointSharingStartDate}).` },
          { status: 400 }
        );
      }
      if (db.networkRules.pointSharingEndDate && todayStr > db.networkRules.pointSharingEndDate) {
        return NextResponse.json(
          { error: `انتهت فترة مشاركة النقاط في الشبكة (${db.networkRules.pointSharingEndDate}).` },
          { status: 400 }
        );
      }
      if (
        Array.isArray(db.networkRules.pointSharingAllowedMerchantIds) &&
        db.networkRules.pointSharingAllowedMerchantIds.length > 0 &&
        !db.networkRules.pointSharingAllowedMerchantIds.includes(store.merchantId) &&
        !db.networkRules.pointSharingAllowedMerchantIds.includes(store.id)
      ) {
        return NextResponse.json(
          { error: 'هذا المتجر غير مُدرج ضمن قائمة المتاجر المسموح لها بمشاركة النقاط من قبل إدارة المنصة.' },
          { status: 400 }
        );
      }
      // Find or create a points card for this store
      let targetCard = profile.cards.find(
        (c) => c.storeId === store.id && c.rule.type === 'points'
      );
      if (!targetCard) {
        targetCard = {
          id: `card-${crypto.randomUUID().slice(0, 6)}`,
          customerId: profile.id,
          merchantId: store.merchantId,
          storeId: store.id,
          storeName: store.name,
          storeLogo: store.logo,
          cardName: `بطاقة نقاط ${store.name}`,
          badgeText: 'بطاقة نقاط متجر ⭐',
          cardColor: store.cardColor || 'from-[#0B1F3A] via-[#13325B] to-[#0284C7]',
          cardTextColor: store.cardTextColor || '#FFFFFF',
          cardSpacing: 'normal',
          cardPattern: 'luxury',
          cardCategory: 'store_points',
          currency: store.currency,
          rule: {
            type: 'points',
            pointsCalcMode: 'per_amount',
            pointsPerUnit: 1,
            currencyUnitAmount: 10,
            rewardTargetPoints: 100,
            rewardDescription: store.loyaltyRule.rewardDescription || 'مكافأة ولاء خاصة من المتجر',
          },
          currentBalance: 0,
          totalEarned: 0,
          isActive: true,
        };
        profile.cards.push(targetCard);
      }

      profile.accountPointsBalance = currentAccountPts - pointsAmount;
      targetCard.currentBalance += pointsAmount;
      targetCard.totalEarned += pointsAmount;
      profile.totalPointsAcrossAllStores = computeDerivedCustomerTotalPoints(profile.cards);

      profile.accountTransfers.unshift({
        id: `trf-${crypto.randomUUID().slice(0, 6)}`,
        type: 'share_to_store',
        points: pointsAmount,
        targetName: store.name,
        targetId: store.id,
        timestamp: new Date().toLocaleString('ar-SA', { hour12: true }),
        note: String(body.note || `تحويل ومشاركة ${pointsAmount} نقطة إلى بطاقة ${store.name}`),
      });

      appendAuditLog({
        actorName: `${profile.firstName} ${profile.lastName}`,
        actorRole: 'CUSTOMER',
        action: 'مشاركة نقاط من بطاقة الحساب إلى بطاقة متجر',
        target: store.name,
        oldValue: `${currentAccountPts} نقطة حساب`,
        newValue: `${profile.accountPointsBalance} نقطة حساب (+${pointsAmount} لمتجر ${store.name})`,
        ip: guard.ctx.ip,
      });

      return NextResponse.json({
        customer: profile,
        message: `تمت مشاركة وتحويل ${pointsAmount} نقطة من بطاقة حسابك إلى بطاقة "${store.name}" بنجاح!`,
      });
    }

    if (actionType === 'gift_to_user') {
      const recipientQuery = String(body.recipient || '').trim();
      if (!recipientQuery) {
        return NextResponse.json(
          { error: 'يرجى إدخال اسم المستخدم أو رقم الجوال أو كود الإحالة للمستلم.' },
          { status: 400 }
        );
      }

      let foundRecipient: typeof profile | undefined;
      for (const candidate of db.customers.values()) {
        if (
          candidate.id !== profile.id &&
          (candidate.username.toLowerCase() === recipientQuery.replace(/^@/, '').toLowerCase() ||
            candidate.phone.includes(recipientQuery) ||
            candidate.referralCode.toLowerCase() === recipientQuery.toLowerCase() ||
            (candidate.accountCardCode || '').toLowerCase() === recipientQuery.toLowerCase())
        ) {
          foundRecipient = candidate;
          break;
        }
      }

      profile.accountPointsBalance = currentAccountPts - pointsAmount;
      const recipientDisplay = foundRecipient
        ? `${foundRecipient.firstName} ${foundRecipient.lastName} (@${foundRecipient.username})`
        : recipientQuery;

      if (foundRecipient) {
        foundRecipient.accountPointsBalance = (foundRecipient.accountPointsBalance ?? 100) + pointsAmount;
        if (!Array.isArray(foundRecipient.accountTransfers)) {
          foundRecipient.accountTransfers = [];
        }
        foundRecipient.accountTransfers.unshift({
          id: `trf-${crypto.randomUUID().slice(0, 6)}`,
          type: 'admin_grant',
          points: pointsAmount,
          targetName: `هدية واردة من ${profile.firstName} ${profile.lastName}`,
          timestamp: new Date().toLocaleString('ar-SA', { hour12: true }),
          note: String(body.note || 'هدية نقاط عبر بطاقة الحساب'),
        });
      }

      profile.accountTransfers.unshift({
        id: `trf-${crypto.randomUUID().slice(0, 6)}`,
        type: 'gift_to_user',
        points: pointsAmount,
        targetName: recipientDisplay,
        timestamp: new Date().toLocaleString('ar-SA', { hour12: true }),
        note: String(body.note || `إهداء ${pointsAmount} نقطة إلى ${recipientDisplay}`),
      });

      appendAuditLog({
        actorName: `${profile.firstName} ${profile.lastName}`,
        actorRole: 'CUSTOMER',
        action: 'إهداء نقاط من بطاقة الحساب إلى حساب آخر',
        target: recipientDisplay,
        oldValue: `${currentAccountPts} نقطة حساب`,
        newValue: `${profile.accountPointsBalance} نقطة حساب`,
        ip: guard.ctx.ip,
      });

      return NextResponse.json({
        customer: profile,
        message: `تم إرسال هدية (${pointsAmount} نقطة) من بطاقة حسابك إلى ${recipientDisplay} بنجاح!`,
      });
    }

    if (actionType === 'convert_to_voucher') {
      const targetStoreId = String(body.targetStoreId || '');
      const store =
        db.stores.find((s) => s.id === targetStoreId || s.merchantId === targetStoreId) ||
        db.stores[0];
      const discountValue = Math.max(5, Math.round(pointsAmount * 0.25));

      profile.accountPointsBalance = currentAccountPts - pointsAmount;
      const voucher = {
        id: `vch-acc-${crypto.randomUUID().slice(0, 6)}`,
        customerId: profile.id,
        merchantId: store.merchantId,
        storeId: store.id,
        storeName: `${store.name} (قسيمة بطاقة الحساب)`,
        code: `AADA-VIP-${crypto.randomBytes(2).toString('hex').toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
        title: `قسيمة خصم فوري بقيمة ${discountValue} ${store.currency} (من نقاط الحساب)`,
        pointsCost: pointsAmount,
        valueAmount: discountValue,
        currency: store.currency,
        status: 'active' as const,
        createdAt: new Date().toISOString().slice(0, 10),
        expiresAt: new Date(Date.now() + 45 * 86400 * 1000).toISOString().slice(0, 10),
      };
      profile.vouchers.unshift(voucher);

      profile.accountTransfers.unshift({
        id: `trf-${crypto.randomUUID().slice(0, 6)}`,
        type: 'convert_to_voucher',
        points: pointsAmount,
        targetName: `${store.name} (${voucher.code})`,
        targetId: voucher.id,
        timestamp: new Date().toLocaleString('ar-SA', { hour12: true }),
        note: `تحويل ${pointsAmount} نقطة حساب إلى قسيمة خصم بقيمة ${discountValue} ${store.currency}`,
      });

      appendAuditLog({
        actorName: `${profile.firstName} ${profile.lastName}`,
        actorRole: 'CUSTOMER',
        action: 'تحويل نقاط بطاقة الحساب إلى قسيمة خصم فورية',
        target: voucher.code,
        oldValue: `${currentAccountPts} نقطة حساب`,
        newValue: `${profile.accountPointsBalance} نقطة حساب`,
        ip: guard.ctx.ip,
      });

      return NextResponse.json({
        customer: profile,
        voucher,
        message: `تم تحويل ${pointsAmount} نقطة إلى قسيمة خصم فورية بكود (${voucher.code}) وجاهزة للحفظ على هاتفك!`,
      });
    }
  }

  // Emergency "فقدت هاتفي": revoke qrKeyId, terminate all active sessions, log audit, clear cookies
  if (body.lostPhone === true) {
    const oldKeyId = profile.qrKeyId;
    db.revokedQrKeyIds.add(oldKeyId);
    const nextKeyId = crypto.randomBytes(4).toString('hex').toUpperCase();
    profile.qrKeyId = nextKeyId;
    const qr = issueEd25519QrToken({ qrKeyId: nextKeyId, ttlSeconds: 90 });
    profile.qrCodeToken = qr.token;
    profile.qrSignature = qr.signature;
    profile.qrIssuedAt = qr.issuedAt;
    profile.qrExpiresAt = qr.expiresAt;
    profile.qrExpiresInSeconds = qr.ttlSeconds;

    userRecord.tokenVersion += 1;
    for (const rt of db.refreshTokens.values()) {
      if (rt.userId === userId) {
        rt.revoked = true;
      }
    }

    appendAuditLog({
      actorName: `${userRecord.firstName} ${userRecord.lastName}`,
      actorRole: 'CUSTOMER',
      action: 'بلاغ فقدان الهاتف — إبطال مفتاح QR وإنهاء جميع الجلسات',
      target: `@${userRecord.username}`,
      oldValue: `qrKeyId:${oldKeyId}`,
      newValue: `qrKeyId:${nextKeyId}`,
      ip: guard.ctx.ip,
    });

    const res = NextResponse.json({
      ok: true,
      sessionRevoked: true,
      message: 'تم إبطال جميع رموز QR السابقة وإنهاء كافة الجلسات النشطة فوراً لحماية نقاطك.',
    });
    return clearSessionCookies(res);
  }

  // Rotate Ed25519 signed QR token (AP1.<customerRef>.<exp>.<nonce>.<sig>)
  if (body.rotateQr === true) {
    const qr = issueEd25519QrToken({ qrKeyId: profile.qrKeyId, ttlSeconds: 90 });
    profile.qrCodeToken = qr.token;
    profile.qrSignature = qr.signature;
    profile.qrIssuedAt = qr.issuedAt;
    profile.qrExpiresAt = qr.expiresAt;
    profile.qrExpiresInSeconds = qr.ttlSeconds;
  }

  // Progressive phone OTP request/verification
  if (body.requestOtp === true) {
    return NextResponse.json({
      ok: true,
      customer: profile,
      message: 'تم إرسال رمز التحقق SMS إلى رقم جوالك المسجل (للتجربة: 1234).',
    });
  }

  if (typeof body.verifyOtpCode === 'string') {
    const code = body.verifyOtpCode.trim();
    if (code === '1234' || (code.length >= 4 && /^\d+$/.test(code))) {
      profile.phoneVerified = true;
    } else {
      return NextResponse.json({ error: 'رمز التحقق OTP غير صحيح.' }, { status: 400 });
    }
  }

  if (typeof body.followStoreId === 'string' && body.followStoreId) {
    if (!profile.followedStoreIds.includes(body.followStoreId)) {
      profile.followedStoreIds.push(body.followStoreId);
    }
  }
  if (typeof body.unfollowStoreId === 'string' && body.unfollowStoreId) {
    profile.followedStoreIds = profile.followedStoreIds.filter((id) => id !== body.unfollowStoreId);
  }

  // Explicitly ignore any `role` or `totalPointsAcrossAllStores` tampering
  if (typeof body.firstName === 'string' && body.firstName.trim()) {
    profile.firstName = body.firstName.trim();
    userRecord.firstName = profile.firstName;
  }
  if (typeof body.lastName === 'string' && body.lastName.trim()) {
    profile.lastName = body.lastName.trim();
    userRecord.lastName = profile.lastName;
  }
  if (typeof body.email === 'string' && body.email.trim()) {
    profile.email = body.email.trim();
    userRecord.email = profile.email;
  }
  if (typeof body.phone === 'string' && body.phone.trim()) {
    if (body.phone.trim() !== profile.phone) {
      profile.phoneVerified = false;
    }
    profile.phone = body.phone.trim();
    userRecord.phone = profile.phone;
  }
  if (typeof body.marketingConsent === 'boolean') {
    profile.marketingConsent = body.marketingConsent;
  }
  if (typeof body.geoProximityConsent === 'boolean') {
    profile.geoProximityConsent = body.geoProximityConsent;
  }
  if (body.notificationPrefs && typeof body.notificationPrefs === 'object') {
    const p = body.notificationPrefs as Partial<typeof profile.notificationPrefs>;
    const clampedDays =
      typeof p.absenceReminderDays === 'number'
        ? Math.max(7, Math.min(90, Math.round(p.absenceReminderDays)))
        : profile.notificationPrefs.absenceReminderDays;
    profile.notificationPrefs = {
      readyRewardAlert:
        typeof p.readyRewardAlert === 'boolean' ? p.readyRewardAlert : profile.notificationPrefs.readyRewardAlert,
      newOfferAlert:
        typeof p.newOfferAlert === 'boolean' ? p.newOfferAlert : profile.notificationPrefs.newOfferAlert,
      expiry14DayAlert:
        typeof p.expiry14DayAlert === 'boolean' ? p.expiry14DayAlert : profile.notificationPrefs.expiry14DayAlert,
      expiry3DayAlert:
        typeof p.expiry3DayAlert === 'boolean' ? p.expiry3DayAlert : profile.notificationPrefs.expiry3DayAlert,
      absenceReminderEnabled:
        typeof p.absenceReminderEnabled === 'boolean'
          ? p.absenceReminderEnabled
          : profile.notificationPrefs.absenceReminderEnabled,
      absenceReminderDays: clampedDays,
      pushSubscribed:
        typeof p.pushSubscribed === 'boolean' ? p.pushSubscribed : profile.notificationPrefs.pushSubscribed,
      geoProximityAlertsEnabled:
        typeof p.geoProximityAlertsEnabled === 'boolean'
          ? p.geoProximityAlertsEnabled
          : profile.notificationPrefs.geoProximityAlertsEnabled ?? true,
      geoRadiusMeters:
        typeof p.geoRadiusMeters === 'number'
          ? p.geoRadiusMeters
          : profile.notificationPrefs.geoRadiusMeters ?? 3000,
      geoSoundEnabled:
        typeof p.geoSoundEnabled === 'boolean'
          ? p.geoSoundEnabled
          : profile.notificationPrefs.geoSoundEnabled ?? true,
      geoVibrateEnabled:
        typeof p.geoVibrateEnabled === 'boolean'
          ? p.geoVibrateEnabled
          : profile.notificationPrefs.geoVibrateEnabled ?? true,
      geoOffersOnly:
        typeof p.geoOffersOnly === 'boolean'
          ? p.geoOffersOnly
          : profile.notificationPrefs.geoOffersOnly ?? false,
    };
  }

  profile.totalPointsAcrossAllStores = computeDerivedCustomerTotalPoints(profile.cards);
  return NextResponse.json({ customer: profile });
}
