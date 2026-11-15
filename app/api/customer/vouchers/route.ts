import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { computeDerivedCustomerTotalPoints, getDb } from '@/lib/server/db';
import { appendAuditLog, enforcePolicy } from '@/lib/server/policy';
import { DigitalVoucher, Transaction } from '@/lib/types';
import { isStoreSubscriptionPaused, SMART_PAUSE_NOTICE } from '@/lib/subscriptionStatus';

const HIGH_VALUE_CONFIRMATION_POINTS = 100;

export async function POST(req: NextRequest) {
  const guard = enforcePolicy(req, 'customer.vouchers.redeem');
  if (!guard.ok) return guard.response;

  const db = getDb();
  const userId = guard.ctx.user!.id;
  const profile = db.customers.get(userId);
  if (!profile) {
    return NextResponse.json({ error: 'ملف العميل غير موجود.' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const storeId = String(body.storeId || '');
  const cardId = typeof body.cardId === 'string' ? body.cardId : '';
  const pointsCost = Math.abs(Number(body.pointsCost || 0));
  const valueAmount = Math.max(0, Number(body.valueAmount || 0));
  const rewardTitle = String(body.title || 'قسيمة استبدال مكافأة');
  const confirmedSecondStep = body.confirmedSecondStep === true;

  const store = db.stores.find((s) => s.id === storeId || s.merchantId === storeId);
  const card = cardId
    ? profile.cards.find((c) => c.id === cardId)
    : profile.cards.find((c) => c.storeId === storeId || c.merchantId === storeId);

  if (!store || !card) {
    return NextResponse.json({ error: 'بطاقة المتجر غير موجودة في محفظتك.' }, { status: 404 });
  }
  if (isStoreSubscriptionPaused(store)) {
    return NextResponse.json({ error: SMART_PAUSE_NOTICE }, { status: 403 });
  }

  const merchantVoucherId = typeof body.merchantVoucherId === 'string' ? body.merchantVoucherId : '';
  if (merchantVoucherId) {
    const mv = (store.vouchers || []).find((v) => v.id === merchantVoucherId);
    if (!mv || !mv.active) {
      return NextResponse.json({ error: 'هذه القسيمة غير متاحة حالياً.' }, { status: 404 });
    }
    if (
      mv.audienceType === 'specific' &&
      !(mv.targetCustomerIds || []).includes(profile.id)
    ) {
      return NextResponse.json(
        { error: 'هذه القسيمة مخصصة لعملاء محددين من قِبل المتجر.' },
        { status: 403 }
      );
    }
  }

  const effectiveCost =
    card.rule.type === 'stamps' && !merchantVoucherId
      ? Math.min(pointsCost || card.rule.stampsRequired || 6, card.rule.stampsRequired || 6)
      : pointsCost;

  if (effectiveCost <= 0 || card.currentBalance < effectiveCost) {
    return NextResponse.json(
      {
        error:
          card.rule.type === 'stamps'
            ? `رصيد الأختام في هذه البطاقة (${card.currentBalance}) غير كافٍ لإصدار المكافأة (مطلوب ${effectiveCost} أختام).`
            : 'رصيدك في هذا المتجر غير كافٍ لإصدار القسيمة.',
      },
      { status: 400 }
    );
  }

  // Progressive phone verification enforced on first redemption
  if (!profile.phoneVerified) {
    return NextResponse.json(
      {
        error: 'يتطلب استبدال المكافآت توثيق رقم الجوال عبر رمز OTP أولاً.',
        requiresPhoneVerification: true,
      },
      { status: 403 }
    );
  }

  // 2nd explicit confirmation required above threshold for points cards
  if (card.rule.type !== 'stamps' && effectiveCost >= HIGH_VALUE_CONFIRMATION_POINTS && !confirmedSecondStep) {
    return NextResponse.json(
      {
        error: 'مطلوب تأكيد إضافي داخل التطبيق لصرف المكافآت ذات القيمة المرتفعة.',
        requiresSecondConfirmation: true,
      },
      { status: 409 }
    );
  }

  const oldBalance = card.currentBalance;
  card.currentBalance = Math.max(0, card.currentBalance - effectiveCost);
  profile.totalPointsAcrossAllStores = computeDerivedCustomerTotalPoints(profile.cards);

  const voucher: DigitalVoucher = {
    id: `vch-${crypto.randomUUID().slice(0, 6)}`,
    customerId: profile.id,
    merchantId: store.merchantId,
    storeId: store.id,
    storeName: store.name,
    code: `AADA-${crypto.randomBytes(2).toString('hex').toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
    title: rewardTitle,
    pointsCost,
    valueAmount,
    currency: store.currency,
    status: 'active',
    createdAt: new Date().toISOString().slice(0, 10),
    expiresAt: new Date(Date.now() + 30 * 86400 * 1000).toISOString().slice(0, 10),
  };
  profile.vouchers.unshift(voucher);

  const branch = store.branches[0];
  const tx: Transaction = {
    id: `tx-${crypto.randomUUID().slice(0, 6)}`,
    merchantId: store.merchantId,
    branchId: branch?.id || 'b-1',
    storeId: store.id,
    storeName: store.name,
    customerId: profile.id,
    customerName: `${profile.firstName} ${profile.lastName}`,
    branchName: branch?.name || 'الفرع الرئيسي',
    invoiceNumber: voucher.code,
    amount: valueAmount,
    currency: store.currency,
    pointsEarned: -pointsCost,
    pointsSpent: pointsCost,
    discountGiven: valueAmount,
    type: 'redemption',
    ruleVersion: 'v2.0',
    timestamp: 'الآن',
    notes: `إصدار قسيمة رقمية (${voucher.title})`,
  };
  db.transactions.unshift(tx);

  appendAuditLog({
    actorName: `${profile.firstName} ${profile.lastName}`,
    actorRole: 'CUSTOMER',
    action: 'استبدال نقاط وإصدار قسيمة رقمية',
    target: `${store.name} (${voucher.code})`,
    oldValue: `${oldBalance} نقطة`,
    newValue: `${card.currentBalance} نقطة`,
    ip: guard.ctx.ip,
  });

  return NextResponse.json({ customer: profile, voucher, transaction: tx }, { status: 201 });
}
