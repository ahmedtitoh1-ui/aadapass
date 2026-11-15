import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { computeDerivedCustomerTotalPoints, getDb } from '@/lib/server/db';
import { appendAuditLog, enforcePolicy } from '@/lib/server/policy';
import { rlsFilterTransactions } from '@/lib/server/rls';
import { resolveCustomerForCashier } from '@/lib/server/resolveCustomer';
import { calculatePointsForAmount } from '@/lib/cardDesignLibrary';
import { isStoreSubscriptionPaused } from '@/lib/subscriptionStatus';
import { FraudAlert, Transaction } from '@/lib/types';

export async function GET(req: NextRequest) {
  const guard = enforcePolicy(req, 'transactions.list');
  if (!guard.ok) return guard.response;

  const db = getDb();
  return NextResponse.json({
    transactions: rlsFilterTransactions(db.transactions, guard.ctx.user),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const requestedMerchantId = typeof body.merchantId === 'string' ? body.merchantId : undefined;
  const requestedBranchId = typeof body.branchId === 'string' ? body.branchId : undefined;

  const guard = enforcePolicy(req, 'transactions.create', {
    merchantId: requestedMerchantId,
    branchId: requestedBranchId,
  });
  if (!guard.ok) return guard.response;

  const user = guard.ctx.user!;
  const db = getDb();

  const targetMerchantId = user.role === 'PLATFORM_ADMIN' && requestedMerchantId ? requestedMerchantId : user.merchantId;
  const store = db.stores.find((s) => s.merchantId === targetMerchantId);
  if (!store) {
    return NextResponse.json({ error: 'تعذر العثور على المتجر المرتبط بهذه العملية.' }, { status: 404 });
  }

  const activePkg = db.packages.find((p) => p.name === store.subscriptionPlan);
  if (
    db.adminSecurity?.viewerModeEnforced !== false &&
    (store.subscriptionPlan === 'Viewer' || (activePkg && !activePkg.loyaltyEnabled))
  ) {
    return NextResponse.json(
      {
        error: 'وضع المتجر Viewer للعرض في الدليل فقط ولا يُسمح له بتسجيل النقاط أو صرف المكافآت.',
        needsReview: true,
        reviewCode: 'VIEWER_LOYALTY_DISABLED',
      },
      { status: 403 }
    );
  }

  if (isStoreSubscriptionPaused(store)) {
    return NextResponse.json(
      {
        error: 'برنامج الولاء متوقف مؤقتاً لانتهاء باقة المتجر لحين تجديدها عبر مدير النظام.',
        needsReview: true,
        reviewCode: 'SUBSCRIPTION_PAUSED',
      },
      { status: 403 }
    );
  }

  // Multi-branch cashier resolution & strict branch enforcement
  const allowedCashierBranches =
    user.branchIds && user.branchIds.length > 0 ? user.branchIds : user.branchId ? [user.branchId] : [];
  let targetBranchId = requestedBranchId || allowedCashierBranches[0] || store.branches[0]?.id || 'b-1';
  if (user.role === 'CASHIER' && allowedCashierBranches.length > 0) {
    if (!allowedCashierBranches.includes(targetBranchId)) {
      return NextResponse.json(
        { error: 'هذا الفرع غير مصرح لحساب الكاشير الحالي.', needsReview: true, reviewCode: 'BRANCH_FORBIDDEN' },
        { status: 403 }
      );
    }
  }
  const branch = store.branches.find((b) => b.id === targetBranchId) || store.branches[0];
  targetBranchId = branch?.id || targetBranchId;

  const clientTxId = typeof body.clientTxId === 'string' && body.clientTxId.trim() ? body.clientTxId.trim() : undefined;
  const isOfflineSync = body.isOfflineSync === true;

  // Idempotent replay check for offline sync queue (clientTxId)
  if (clientTxId) {
    const existingByClientTxId = db.transactions.find(
      (t) => t.merchantId === store.merchantId && t.clientTxId === clientTxId
    );
    if (existingByClientTxId) {
      return NextResponse.json(
        {
          transaction: existingByClientTxId,
          idempotent: true,
        },
        { status: 200 }
      );
    }
  }

  const invoiceNumber = String(body.invoiceNumber || '').trim();
  const amount = Math.max(0, Number(body.amount || 0));
  const type = (body.type as Transaction['type']) || 'purchase';
  const qrToken = String(body.qrToken || body.customerCode || '').trim();
  const entryMode = body.entryMode === 'points' ? 'points' : 'amount';
  const manualPoints = Math.floor(Math.max(0, Number(body.manualPoints || 0)));
  const voucherCode = typeof body.voucherCode === 'string' ? body.voucherCode.trim() : '';

  if (isOfflineSync && type === 'redemption') {
    return NextResponse.json(
      {
        error: 'صرف المكافآت متاح أونلاين فقط ولا يُقبل ضمن طابور المزامنة.',
        needsReview: true,
        reviewCode: 'OFFLINE_REDEMPTION_BLOCKED',
      },
      { status: 400 }
    );
  }

  if (!invoiceNumber) {
    return NextResponse.json({ error: 'رقم الفاتورة مطلوب.', needsReview: true, reviewCode: 'MISSING_INVOICE' }, { status: 400 });
  }
  if (!qrToken) {
    return NextResponse.json(
      { error: 'يجب مسح باركود العميل أو إدخال رمز العميل أولاً.', needsReview: true, reviewCode: 'MISSING_QR' },
      { status: 400 }
    );
  }

  // Unique invoice numbers per (merchant_id, branch_id)
  const duplicate = db.transactions.some(
    (t) =>
      t.merchantId === store.merchantId &&
      t.branchId === targetBranchId &&
      t.invoiceNumber.toLowerCase() === invoiceNumber.toLowerCase()
  );
  if (duplicate) {
    return NextResponse.json(
      {
        error: `رقم الفاتورة (${invoiceNumber}) مسجل مسبقاً في فرع (${branch?.name || targetBranchId}).`,
        needsReview: true,
        reviewCode: 'DUPLICATE_INVOICE',
      },
      { status: 409 }
    );
  }

  // Enforce transaction amount limit
  const maxTxAmount = store.maxTxAmount ?? 5000;
  if (type !== 'redemption') {
    if (entryMode === 'points') {
      if (manualPoints <= 0) {
        return NextResponse.json(
          {
            error: 'يرجى إدخال عدد النقاط أو الأختام المطلوب إضافتها بشكل صحيح.',
            needsReview: true,
            reviewCode: 'INVALID_MANUAL_POINTS',
          },
          { status: 400 }
        );
      }
      if (amount > maxTxAmount) {
        return NextResponse.json(
          {
            error: `مبلغ الفاتورة يجب ألا يتجاوز ${maxTxAmount} ${store.currency}.`,
            needsReview: true,
            reviewCode: 'AMOUNT_OUT_OF_RANGE',
          },
          { status: 400 }
        );
      }
    } else if (amount <= 0 || amount > maxTxAmount) {
      return NextResponse.json(
        {
          error: `مبلغ الفاتورة يجب أن يكون بين 1 و ${maxTxAmount} ${store.currency}.`,
          needsReview: true,
          reviewCode: 'AMOUNT_OUT_OF_RANGE',
        },
        { status: 400 }
      );
    }
  }

  const resolvedCustomer = resolveCustomerForCashier(qrToken, {
    consumeNonce: true,
    allowOfflineGrace: isOfflineSync,
  });
  if (!resolvedCustomer.ok) {
    return NextResponse.json(
      {
        error: resolvedCustomer.error,
        needsReview: true,
        reviewCode: resolvedCustomer.reviewCode,
      },
      { status: resolvedCustomer.status }
    );
  }
  const customerProfile = resolvedCustomer.customer;

  const targetCardType: 'points' | 'stamps' | 'account' =
    body.targetCardType === 'stamps' || body.targetCardType === 'points' || body.targetCardType === 'account'
      ? body.targetCardType
      : store.loyaltyRule.type === 'stamps'
        ? 'stamps'
        : 'points';

  const stampsDesign = (store.cardDesigns || []).find((d) => d.loyaltyRule.type === 'stamps');
  const pointsDesign = (store.cardDesigns || []).find((d) => d.loyaltyRule.type === 'points');
  const effectiveRule =
    targetCardType === 'stamps'
      ? stampsDesign?.loyaltyRule || {
          type: 'stamps' as const,
          stampsRequired: store.loyaltyRule.stampsRequired || 6,
          stampShape: store.loyaltyRule.stampShape || 'coffee',
          rewardDescription: store.loyaltyRule.rewardDescription || 'مكافأة مجانية عند إكمال الأختام',
        }
      : pointsDesign?.loyaltyRule || store.loyaltyRule;

  let pointsDelta = 0;
  if (type === 'redemption') {
    if (!customerProfile.phoneVerified) {
      return NextResponse.json(
        { error: 'يتطلب صرف المكافأة توثيق رقم جوال العميل عبر OTP أولاً.' },
        { status: 403 }
      );
    }

    if (targetCardType === 'account') {
      const ptsSpent = Math.abs(Number(body.pointsSpent || 100));
      const accBal = customerProfile.accountPointsBalance ?? 350;
      if (ptsSpent <= 0 || accBal < ptsSpent) {
        return NextResponse.json(
          { error: `رصيد بطاقة الحساب الشاملة للعميل (${accBal} نقطة) غير كافٍ لصرف المكافأة.` },
          { status: 400 }
        );
      }
      pointsDelta = -ptsSpent;
    } else if (targetCardType === 'stamps') {
      const reqStamps = effectiveRule.stampsRequired || 6;
      const stampsSpent = Math.abs(Number(body.pointsSpent || reqStamps));
      const costToUse = stampsSpent > 20 ? reqStamps : stampsSpent;
      const card =
        customerProfile.cards.find(
          (c) =>
            (c.merchantId === store.merchantId || c.storeId === store.id) &&
            c.rule.type === 'stamps'
        ) || customerProfile.cards.find((c) => c.merchantId === store.merchantId);
      if ((card?.currentBalance || 0) < costToUse) {
        return NextResponse.json(
          {
            error: `رصيد أختام العميل (${card?.currentBalance || 0}/${reqStamps}) غير كافٍ لصرف المكافأة.`,
          },
          { status: 400 }
        );
      }
      pointsDelta = -costToUse;
    } else {
      const ptsSpent = Math.abs(Number(body.pointsSpent || 100));
      if (ptsSpent <= 0) {
        return NextResponse.json({ error: 'عدد النقاط المراد صرفها يجب أن يكون أكبر من صفر.' }, { status: 400 });
      }
      const card =
        customerProfile.cards.find(
          (c) =>
            (c.merchantId === store.merchantId || c.storeId === store.id) &&
            c.rule.type === 'points'
        ) || customerProfile.cards.find((c) => c.merchantId === store.merchantId);
      if ((card?.currentBalance || 0) < ptsSpent) {
        return NextResponse.json({ error: 'رصيد نقاط العميل في هذا المتجر غير كافٍ لصرف المكافأة.' }, { status: 400 });
      }
      pointsDelta = -ptsSpent;
    }

    if (voucherCode) {
      const targetVoucher = customerProfile.vouchers.find(
        (v) => v.code.toLowerCase() === voucherCode.toLowerCase() && v.status === 'active'
      );
      if (targetVoucher) {
        targetVoucher.status = 'used';
      }
    }
  } else if (entryMode === 'points' && manualPoints > 0) {
    pointsDelta = manualPoints;
  } else if (targetCardType === 'stamps') {
    pointsDelta = 1;
  } else {
    pointsDelta = calculatePointsForAmount(effectiveRule, amount);
  }

  // Daily velocity limits (24h rolling window)
  const nowMs = Date.now();
  const oneDayAgoMs = nowMs - 24 * 60 * 60 * 1000;
  const recentStoreTxs = db.transactions.filter(
    (t) => t.merchantId === store.merchantId && (t.createdAtMs || 0) >= oneDayAgoMs
  );

  if (pointsDelta > 0) {
    const customerDailyPoints = recentStoreTxs
      .filter((t) => t.customerId === customerProfile.id && t.pointsEarned > 0)
      .reduce((sum, t) => sum + t.pointsEarned, 0);
    const dailyCustomerCap = store.dailyCustomerCap ?? 1500;
    if (customerDailyPoints + pointsDelta > dailyCustomerCap) {
      return NextResponse.json(
        {
          error: `تجاوز العميل الحد اليومي الأقصى للنقاط في هذا المتجر (${dailyCustomerCap} نقطة/يوم).`,
          needsReview: true,
          reviewCode: 'DAILY_CUSTOMER_CAP',
        },
        { status: 429 }
      );
    }
  }

  const cashierDailyAmount = recentStoreTxs
    .filter((t) => t.cashierId === user.id && t.type !== 'redemption')
    .reduce((sum, t) => sum + t.amount, 0);
  const dailyCashierCap = store.dailyCashierCap ?? 20000;
  if (type !== 'redemption' && cashierDailyAmount + amount > dailyCashierCap) {
    return NextResponse.json(
      {
        error: `تجاوز الكاشير الحد اليومي المالي للعمليات (${dailyCashierCap} ${store.currency}/يوم).`,
        needsReview: true,
        reviewCode: 'DAILY_CASHIER_CAP',
      },
      { status: 429 }
    );
  }

  // Suspicious pattern detector -> alert Merchant Owner + AuditLog
  const thirtyMinsAgoMs = nowMs - 30 * 60 * 1000;
  const twoMinsAgoMs = nowMs - 2 * 60 * 1000;
  const recent30m = db.transactions.filter(
    (t) => t.merchantId === store.merchantId && (t.createdAtMs || 0) >= thirtyMinsAgoMs
  );
  const fraudFlags: string[] = [];

  const sameCustScans = recent30m.filter((t) => t.customerId === customerProfile.id).length;
  if (sameCustScans >= 2) {
    fraudFlags.push('تكرار مسح لنفس العميل خلال 30 دقيقة');
  }
  if (amount >= 100 && amount % 50 === 0) {
    const identicalRound = recent30m.filter(
      (t) => t.cashierId === user.id && t.amount === amount
    ).length;
    if (identicalRound >= 2) {
      fraudFlags.push(`تكرار مبالغ دائرية متطابقة (${amount} ${store.currency})`);
    }
  }
  const burstCount = recent30m.filter(
    (t) => t.cashierId === user.id && (t.createdAtMs || 0) >= twoMinsAgoMs
  ).length;
  if (burstCount >= 3) {
    fraudFlags.push('وتيرة عمليات سريعة غير معتادة للكاشير خلال دقيقتين');
  }

  const newTx: Transaction = {
    id: `tx-${crypto.randomUUID().slice(0, 6)}`,
    merchantId: store.merchantId,
    branchId: targetBranchId,
    storeId: store.id,
    storeName: store.name,
    customerId: customerProfile.id,
    customerName: `${customerProfile.firstName} ${customerProfile.lastName}`,
    cashierId: user.id,
    cashierName: `${user.firstName} ${user.lastName}`,
    branchName: branch?.name || 'الفرع الرئيسي',
    invoiceNumber,
    amount,
    currency: store.currency,
    pointsEarned: pointsDelta,
    pointsSpent: type === 'redemption' ? Math.abs(pointsDelta) : undefined,
    discountGiven: type === 'redemption' ? Number(body.discountGiven || 0) || undefined : undefined,
    type: targetCardType === 'stamps' && type !== 'redemption' ? 'stamp' : type,
    ruleVersion: 'v2.0',
    timestamp: isOfflineSync ? `الآن (مزامن أوفلاين)` : 'الآن',
    createdAtMs: nowMs,
    notes: typeof body.notes === 'string' ? body.notes : undefined,
    clientTxId,
    offlineQueued: isOfflineSync || undefined,
    fraudFlags: fraudFlags.length > 0 ? fraudFlags : undefined,
  };

  db.transactions.unshift(newTx);

  if (fraudFlags.length > 0) {
    const alert: FraudAlert = {
      id: `fa-${crypto.randomUUID().slice(0, 8)}`,
      merchantId: store.merchantId,
      branchId: targetBranchId,
      branchName: branch?.name || 'الفرع الرئيسي',
      cashierId: user.id,
      cashierName: `${user.firstName} ${user.lastName}`,
      customerName: `${customerProfile.firstName} ${customerProfile.lastName}`,
      invoiceNumber,
      reason: fraudFlags.join(' • '),
      timestamp: new Date().toLocaleString('ar-SA', { hour12: true }),
      resolved: false,
    };
    store.fraudAlerts = [alert, ...(store.fraudAlerts || [])];
    appendAuditLog({
      actorName: `${user.firstName} ${user.lastName}`,
      actorRole: user.role,
      action: 'تنبيه نمط عمليات مشبوه عند الكاشير',
      target: `${store.name} — فاتورة ${invoiceNumber}`,
      oldValue: 'سلوك طبيعي',
      newValue: alert.reason,
      ip: guard.ctx.ip,
    });
  }

  // Update the appropriate card in the 3-card system
  let updatedBalance = 0;
  if (targetCardType === 'account') {
    const prevAcc = customerProfile.accountPointsBalance ?? 350;
    customerProfile.accountPointsBalance = Math.max(0, prevAcc + pointsDelta);
    updatedBalance = customerProfile.accountPointsBalance;
    if (!Array.isArray(customerProfile.accountTransfers)) {
      customerProfile.accountTransfers = [];
    }
    customerProfile.accountTransfers.unshift({
      id: `trf-${crypto.randomUUID().slice(0, 6)}`,
      type: pointsDelta >= 0 ? 'share_to_store' : 'convert_to_voucher',
      points: Math.abs(pointsDelta),
      targetName: `${store.name} (${invoiceNumber})`,
      targetId: store.id,
      timestamp: new Date().toLocaleString('ar-SA', { hour12: true }),
      note:
        pointsDelta >= 0
          ? `إضافة نقاط إلى بطاقة الحساب من فاتورة ${invoiceNumber}`
          : `خصم نقاط من بطاقة الحساب عند الكاشير (${invoiceNumber})`,
    });
  } else {
    const existingCard = customerProfile.cards.find(
      (c) =>
        (c.merchantId === store.merchantId || c.storeId === store.id) &&
        c.rule.type === targetCardType
    );

    if (existingCard) {
      existingCard.currentBalance = Math.max(0, existingCard.currentBalance + pointsDelta);
      if (pointsDelta > 0) existingCard.totalEarned += pointsDelta;
      updatedBalance = existingCard.currentBalance;
    } else {
      const cardRule =
        targetCardType === 'stamps'
          ? {
              ...effectiveRule,
              type: 'stamps' as const,
              stampsRequired: effectiveRule.stampsRequired || 6,
              stampShape: effectiveRule.stampShape || 'coffee',
              rewardDescription:
                effectiveRule.rewardDescription || 'مشروب أو منتج مجاني عند إكمال 6 أختام',
            }
          : {
              ...effectiveRule,
              type: 'points' as const,
              pointsCalcMode: effectiveRule.pointsCalcMode || ('per_amount' as const),
              pointsPerUnit: effectiveRule.pointsPerUnit || 10,
              currencyUnitAmount: effectiveRule.currencyUnitAmount || 10,
              rewardTargetPoints: effectiveRule.rewardTargetPoints || 100,
              rewardDescription:
                effectiveRule.rewardDescription || 'خصم فوري عند الوصول لهدف النقاط',
            };
      const createdCard = {
        id: `card-${crypto.randomUUID().slice(0, 6)}`,
        customerId: customerProfile.id,
        merchantId: store.merchantId,
        storeId: store.id,
        storeName: store.name,
        storeLogo: store.logo,
        cardName:
          targetCardType === 'stamps' ? `بطاقة أختام ${store.name}` : `بطاقة نقاط ${store.name}`,
        badgeText:
          targetCardType === 'stamps' ? 'بطاقة أختام متجر ☕' : 'بطاقة نقاط متجر ⭐',
        cardColor: store.cardColor,
        cardTextColor: store.cardTextColor,
        cardCategory: (targetCardType === 'stamps' ? 'store_stamps' : 'store_points') as
          | 'store_stamps'
          | 'store_points',
        currency: store.currency,
        rule: cardRule,
        currentBalance: Math.max(0, pointsDelta),
        totalEarned: Math.max(0, pointsDelta),
        isActive: true,
      };
      customerProfile.cards.push(createdCard);
      updatedBalance = createdCard.currentBalance;
    }

    // Bonus: every store purchase also grants +15% bonus to the Customer's Master Account Card!
    if (pointsDelta > 0) {
      const accountBonus =
        targetCardType === 'stamps'
          ? Math.max(5, pointsDelta * 5)
          : Math.max(2, Math.round(pointsDelta * 0.15));
      customerProfile.accountPointsBalance =
        (customerProfile.accountPointsBalance ?? 350) + accountBonus;
    }
  }

  customerProfile.totalPointsAcrossAllStores = computeDerivedCustomerTotalPoints(customerProfile.cards);

  if (type === 'redemption') {
    appendAuditLog({
      actorName: `${user.firstName} ${user.lastName}`,
      actorRole: user.role,
      action: 'صرف مكافأة وخصم نقاط/أختام',
      target: `${customerProfile.firstName} ${customerProfile.lastName} — ${invoiceNumber}`,
      oldValue: `${Math.max(0, updatedBalance - pointsDelta)}`,
      newValue: `${updatedBalance}`,
      ip: guard.ctx.ip,
    });
  }

  const latestPointsCard = customerProfile.cards.find(
    (c) => (c.merchantId === store.merchantId || c.storeId === store.id) && c.rule.type === 'points'
  );
  const latestStampsCard = customerProfile.cards.find(
    (c) => (c.merchantId === store.merchantId || c.storeId === store.id) && c.rule.type === 'stamps'
  );

  // Strict privacy: Cashiers never receive cross-merchant customer cards or global balances
  if (user.role === 'CASHIER') {
    return NextResponse.json(
      {
        transaction: newTx,
        storeBalance: updatedBalance,
        storePointsBalance: latestPointsCard?.currentBalance ?? 0,
        storeStampsBalance: latestStampsCard?.currentBalance ?? 0,
        accountPointsBalance: customerProfile.accountPointsBalance ?? 350,
        customerDisplayName: `${customerProfile.firstName} ${customerProfile.lastName}`,
        fraudFlags: fraudFlags.length > 0 ? fraudFlags : undefined,
      },
      { status: 201 }
    );
  }

  return NextResponse.json(
    {
      transaction: newTx,
      storeBalance: updatedBalance,
      storePointsBalance: latestPointsCard?.currentBalance ?? 0,
      storeStampsBalance: latestStampsCard?.currentBalance ?? 0,
      accountPointsBalance: customerProfile.accountPointsBalance ?? 350,
      customer: customerProfile,
    },
    { status: 201 }
  );
}
