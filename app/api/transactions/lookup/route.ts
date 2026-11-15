import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { enforcePolicy } from '@/lib/server/policy';
import { verifyEd25519QrToken } from '@/lib/server/crypto';

export async function POST(req: NextRequest) {
  const guard = enforcePolicy(req, 'transactions.lookup');
  if (!guard.ok) return guard.response;
  const user = guard.ctx.user;

  const body = await req.json().catch(() => ({}));
  const qrToken = String(body.qrToken || '').trim();
  const merchantId = String(body.merchantId || user?.merchantId || 'merch-1').trim();
  const branchId = String(body.branchId || user?.branchId || 'b-1').trim();

  if (!qrToken) {
    return NextResponse.json({ error: 'يرجى مسح رمز العميل أولاً' }, { status: 400 });
  }

  const db = getDb();
  const store = db.stores.find((s) => s.merchantId === merchantId) || db.stores[0];
  const branch = store.branches.find((b) => b.id === branchId);
  const activeRule = branch?.branchRule || store.loyaltyRule;

  let customerId = '';
  const verified = verifyEd25519QrToken(qrToken, { allowOfflineGrace: true });
  if (verified.valid && verified.qrKeyId) {
    for (const c of db.customers.values()) {
      if (c.qrKeyId === verified.qrKeyId) {
        customerId = c.id;
        break;
      }
    }
  }
  if (!customerId) {
    const cleanInput = qrToken.replace(/^@/, '').toLowerCase();
    for (const c of db.customers.values()) {
      const codeMatch = (c.referralCode || '').toLowerCase() === cleanInput;
      const acctMatch = (c.accountCardCode || '').toLowerCase() === cleanInput;
      const userMatch = c.username.toLowerCase() === cleanInput;
      const phoneMatch = c.phone.replace(/\s+/g, '').endsWith(cleanInput);
      const tokenMatch = c.qrCodeToken === qrToken;
      if (codeMatch || acctMatch || userMatch || (cleanInput.length >= 4 && phoneMatch) || tokenMatch) {
        customerId = c.id;
        break;
      }
    }
  }

  const customer = db.customers.get(customerId);
  if (!customer) {
    return NextResponse.json(
      {
        error:
          verified.reason ||
          'لم يتم العثور على العميل؛ تأكد من مسح الباركود أو إدخال رمز العميل الصحيح (مثل: fahad أو FAHAD2026 أو sara)',
      },
      { status: 404 }
    );
  }

  // Locate both Store Points Card and Store Stamps Card if available
  const storeCards = customer.cards.filter(
    (c) => c.storeId === store.id || c.merchantId === store.merchantId
  );
  const pointsCard = storeCards.find((c) => c.rule.type === 'points');
  const stampsCard = storeCards.find((c) => c.rule.type === 'stamps');
  const primaryCard =
    (activeRule.type === 'stamps' ? stampsCard : pointsCard) || storeCards[0];

  const currentStoreBalance = primaryCard?.currentBalance ?? 0;
  const storePointsBalance =
    pointsCard?.currentBalance ?? (activeRule.type === 'points' ? currentStoreBalance : 0);
  const storeStampsBalance =
    stampsCard?.currentBalance ?? (activeRule.type === 'stamps' ? currentStoreBalance : 0);
  const accountPointsBalance = customer.accountPointsBalance ?? 350;

  const isStamps = activeRule.type === 'stamps';
  const stampsRequired =
    stampsCard?.rule.stampsRequired || activeRule.stampsRequired || 6;
  const rewardTargetPoints =
    pointsCard?.rule.rewardTargetPoints || activeRule.rewardTargetPoints || 100;
  const threshold = isStamps ? stampsRequired : rewardTargetPoints;

  const eligibleForReward = currentStoreBalance >= threshold;
  const remainingNeeded = Math.max(0, threshold - currentStoreBalance);

  // Currency-aware rate for 100 points
  const baseSameStore100Pts = db.networkRules.sameStore100PtsSar || 10;
  const sameStoreRate =
    store.currency === 'EGP' ? Math.max(50, baseSameStore100Pts * 5) : baseSameStore100Pts;

  const redeemableUnits = isStamps
    ? Math.floor(storeStampsBalance / stampsRequired)
    : Math.floor(storePointsBalance / 100);

  const estimatedDiscountValue = isStamps
    ? redeemableUnits > 0
      ? store.currency === 'EGP'
        ? 120 * redeemableUnits
        : 25 * redeemableUnits
      : store.currency === 'EGP'
      ? 120
      : 25
    : storePointsBalance >= 100
    ? Math.round((storePointsBalance / 100) * sameStoreRate)
    : sameStoreRate;

  const activeStoreVouchers = (customer.vouchers || [])
    .filter(
      (v) =>
        v.status === 'active' &&
        (v.storeId === store.id || v.merchantId === store.merchantId)
    )
    .map((v) => ({
      id: v.id,
      code: v.code,
      title: v.title,
      pointsCost: v.pointsCost,
      valueAmount: v.valueAmount,
      currency: v.currency,
      expiresAt: v.expiresAt,
    }));

  return NextResponse.json({
    customerDisplayName: `${customer.firstName} ${customer.lastName ? `${customer.lastName.charAt(0)}.` : ''}`.trim(),
    customerCode: customer.referralCode || customer.username.toUpperCase(),
    currentStoreBalance,
    storePointsBalance,
    storeStampsBalance,
    stampsRequired,
    accountPointsBalance,
    accountCardCode:
      customer.accountCardCode || `AADA-VIP-${customer.referralCode || customer.username.toUpperCase()}`,
    totalEarnedAtStore: primaryCard?.totalEarned ?? currentStoreBalance,
    currency: store.currency,
    unitType: isStamps ? 'stamps' : 'points',
    minThreshold: threshold,
    redeemableRewards: redeemableUnits,
    eligibleForReward,
    remainingNeeded,
    estimatedDiscountValue,
    sameStore100PtsSar: sameStoreRate,
    phoneVerified: customer.phoneVerified,
    rewardDescription:
      primaryCard?.rule.rewardDescription ||
      activeRule.rewardDescription ||
      (isStamps ? 'مشروب أو منتج مجاني عند إكمال الأختام' : 'خصم فوري عند الوصول لهدف النقاط'),
    activeStoreVouchers,
    loyaltyRule: activeRule,
  });
}
