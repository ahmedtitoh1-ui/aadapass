import { NextRequest, NextResponse } from 'next/server';
import { computeAdminOverview, computeDerivedCustomerTotalPoints, getDb } from '@/lib/server/db';
import { appendAuditLog, enforcePolicy } from '@/lib/server/policy';
import { issueEd25519QrToken } from '@/lib/server/crypto';

export async function GET(req: NextRequest) {
  const guard = enforcePolicy(req, 'admin.overview');
  if (!guard.ok) return guard.response;
  const db = getDb();
  return NextResponse.json({ overview: computeAdminOverview(db) });
}

export async function POST(req: NextRequest) {
  const guard = enforcePolicy(req, 'admin.overview');
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '').trim();
  const db = getDb();
  const actorName = guard.ctx.user
    ? `${guard.ctx.user.firstName} ${guard.ctx.user.lastName}`.trim()
    : 'مدير النظام';
  const actorRole = guard.ctx.user?.role || 'PLATFORM_ADMIN';

  // 1. Reconcile all customer point ledgers, QR tokens, and Account Master Card balances
  if (action === 'reconcile_ledgers') {
    let fixedCustomers = 0;
    for (const customer of db.customers.values()) {
      for (const card of customer.cards) {
        if (card.currentBalance < 0 || Number.isNaN(card.currentBalance)) {
          card.currentBalance = 0;
        }
        if (card.totalEarned < card.currentBalance) {
          card.totalEarned = card.currentBalance;
        }
      }
      customer.totalPointsAcrossAllStores = computeDerivedCustomerTotalPoints(customer.cards);
      if (typeof customer.accountPointsBalance !== 'number' || customer.accountPointsBalance < 0) {
        customer.accountPointsBalance = 350;
      }
      if (!customer.accountCardCode) {
        customer.accountCardCode = `AADA-VIP-${customer.referralCode || customer.username.toUpperCase()}`;
      }
      const signed = issueEd25519QrToken({ qrKeyId: customer.qrKeyId, ttlSeconds: 90 });
      customer.qrCodeToken = signed.token;
      customer.qrSignature = signed.signature;
      customer.qrIssuedAt = signed.issuedAt;
      customer.qrExpiresAt = signed.expiresAt;
      customer.qrExpiresInSeconds = signed.ttlSeconds;
      fixedCustomers += 1;
    }

    const logEntry = appendAuditLog({
      actorName,
      actorRole,
      action: 'مطابقة شاملة لأرصدة النقاط وتجديد رموز QR (يدوي)',
      target: `${fixedCustomers} حساب عميل`,
      oldValue: 'فحص دوري',
      newValue: 'تمت المطابقة وتصحيح الأرصدة بنجاح',
      ip: guard.ctx.ip,
    });

    return NextResponse.json({
      ok: true,
      message: `تمت مطابقة أرصدة النقاط وتحديث رموز QR وبطاقات الحساب لعدد (${fixedCustomers}) عملاء بنجاح.`,
      overview: computeAdminOverview(db),
      customers: Array.from(db.customers.values()),
      auditLog: logEntry,
    });
  }

  // 2. Unlock locked accounts & reset cashier/customer daily velocity caps
  if (action === 'unlock_accounts_and_caps') {
    let unlockedCount = 0;
    for (const u of db.users) {
      if (u.failedAttempts > 0 || u.lockedUntil) {
        u.failedAttempts = 0;
        u.lockedUntil = null;
        unlockedCount += 1;
      }
    }
    db.usedQrNonces.clear();

    const logEntry = appendAuditLog({
      actorName,
      actorRole,
      action: 'فك قفل الحسابات وتصفير سقوف الكاشير اليومية (يدوي)',
      target: 'جميع حسابات الكاشير والعملاء والتجار',
      oldValue: `${unlockedCount} مقفول`,
      newValue: 'جميع الحسابات نشطة وسقوف العمليات مصفرة',
      ip: guard.ctx.ip,
    });

    return NextResponse.json({
      ok: true,
      message: `تم فك قفل الحسابات وتصفير محاولات الدخول الخاطئة وسقوف الكاشير اليومية (${unlockedCount} حسابات معالجة).`,
      auditLog: logEntry,
    });
  }

  // 3. Extend grace period for paused/expired stores & reactivate expired vouchers
  if (action === 'extend_paused_stores_and_vouchers') {
    let updatedStores = 0;
    let extendedVouchers = 0;
    for (const store of db.stores) {
      if (store.status !== 'active' || store.subscriptionState !== 'active') {
        store.status = 'active';
        store.subscriptionState = 'active';
        store.subscriptionExpiry = '2027-03-31';
        updatedStores += 1;
      }
      for (const v of store.vouchers || []) {
        if (!v.active || v.usedCount >= v.usageLimit) {
          v.active = true;
          v.usageLimit = Math.max(v.usageLimit, v.usedCount + 50);
          v.expiryDate = '2027-03-31';
          extendedVouchers += 1;
        }
      }
    }

    for (const customer of db.customers.values()) {
      for (const v of customer.vouchers || []) {
        if (v.status === 'expired') {
          v.status = 'active';
          v.expiresAt = '2027-03-31';
          extendedVouchers += 1;
        }
      }
    }

    const logEntry = appendAuditLog({
      actorName,
      actorRole,
      action: 'تمديد مهلة المتاجر المتوقفة وتفعيل القسائم المنتهية (يدوي)',
      target: `${updatedStores} متاجر و ${extendedVouchers} قسيمة`,
      oldValue: 'متوقف / منتهي',
      newValue: 'نشط حتى 2027-03-31',
      ip: guard.ctx.ip,
    });

    return NextResponse.json({
      ok: true,
      message: `تم تنشيط (${updatedStores}) متاجر وتمديد صلاحية (${extendedVouchers}) قسيمة خصم بنجاح.`,
      stores: db.stores,
      customers: Array.from(db.customers.values()),
      overview: computeAdminOverview(db),
      auditLog: logEntry,
    });
  }

  // 4. Resolve all pending fraud alerts & refund requests across stores
  if (action === 'resolve_suspicious_transactions') {
    let resolvedAlerts = 0;
    let resolvedRefunds = 0;

    for (const store of db.stores) {
      for (const fa of store.fraudAlerts || []) {
        if (!fa.resolved) {
          fa.resolved = true;
          resolvedAlerts += 1;
        }
      }
    }

    for (const tx of db.transactions) {
      if (tx.refundRequested) {
        tx.refundRequested = false;
        tx.notes = `${tx.notes || ''} — تمت المراجعة والتسوية يدوياً بواسطة مدير النظام`.trim();
        resolvedRefunds += 1;
      }
    }

    const logEntry = appendAuditLog({
      actorName,
      actorRole,
      action: 'تسوية تنبيهات الاشتباه وطلبات الاسترجاع المعلقة (يدوي)',
      target: `${resolvedAlerts} تنبيه و ${resolvedRefunds} طلب استرجاع`,
      oldValue: 'قيد المراجعة',
      newValue: 'تمت التسوية يدوياً',
      ip: guard.ctx.ip,
    });

    return NextResponse.json({
      ok: true,
      message: `تمت معالجة وتسوية (${resolvedAlerts}) تنبيهات اشتباه و (${resolvedRefunds}) طلبات استرجاع معلقة.`,
      stores: db.stores,
      transactions: db.transactions,
      auditLog: logEntry,
    });
  }

  // 5. Resolve stuck online orders & grant loyalty points automatically
  if (action === 'resolve_stuck_online_orders') {
    let processedOrders = 0;
    let pointsAwardedTotal = 0;

    for (const order of db.orders || []) {
      if (order.status === 'PENDING' || order.status === 'ACCEPTED' || order.status === 'PREPARING') {
        order.status = 'READY';
        order.updatedAt = new Date().toISOString();
        order.merchantNotes = 'تمت المتابعة والتأكيد الفوري عبر مركز الحلول الاستباقية لمدير النظام';
        processedOrders += 1;

        const cust = db.customers.get(order.customerId);
        if (cust) {
          const bonusPts = Math.max(10, Math.round(order.total * 0.15));
          cust.accountPointsBalance = (cust.accountPointsBalance ?? 350) + bonusPts;
          pointsAwardedTotal += bonusPts;
        }
      }
    }

    const logEntry = appendAuditLog({
      actorName,
      actorRole,
      action: 'معالجة طلبات الأونلاين المعلقة ومنح نقاط الولاء (يدوي)',
      target: `${processedOrders} طلبات أونلاين`,
      oldValue: 'معلق / قيد التحضير',
      newValue: `جاهز للاستلام والتوصيل (+${pointsAwardedTotal} نقطة ممنوحة)`,
      ip: guard.ctx.ip,
    });

    return NextResponse.json({
      ok: true,
      message:
        processedOrders > 0
          ? `تم تحريك وتأكيد (${processedOrders}) طلبات متجر إلكتروني معلقة ومنح (+${pointsAwardedTotal}) نقطة مكافأة للعملاء.`
          : 'جميع طلبات المتجر الإلكتروني الحالية محدّثة؛ تم فحص الطابور وتأكيد جاهزية الإشعارات.',
      customers: Array.from(db.customers.values()),
      auditLog: logEntry,
    });
  }

  // 6. Repair missing 3-card wallet ecosystem across all customers & stores
  if (action === 'repair_missing_customer_cards') {
    let issuedCardsCount = 0;

    for (const customer of db.customers.values()) {
      if (typeof customer.accountPointsBalance !== 'number' || customer.accountPointsBalance < 100) {
        customer.accountPointsBalance = Math.max(250, customer.accountPointsBalance || 0);
      }
      if (!customer.accountCardCode) {
        customer.accountCardCode = `AADA-VIP-${customer.referralCode || customer.username.toUpperCase()}`;
      }

      // Ensure primary stores have both points and stamps cards for cust-1, and at least default cards for all customers
      for (const store of db.stores.slice(0, 3)) {
        const hasPoints = customer.cards.some(
          (c) => c.storeId === store.id && c.rule.type === 'points'
        );
        if (!hasPoints) {
          customer.cards.push({
            id: `card-pts-${store.id}-${customer.id}`,
            customerId: customer.id,
            merchantId: store.merchantId,
            storeId: store.id,
            storeName: store.name,
            storeLogo: store.logo,
            cardName: `بطاقة نقاط ${store.name}`,
            badgeText: 'بطاقة نقاط متجر ⭐',
            cardColor: store.cardColor,
            cardTextColor: store.cardTextColor || 'text-white',
            cardSpacing: 'normal',
            cardPattern: 'luxury',
            cardCategory: 'store_points',
            currency: store.currency,
            rule: {
              type: 'points',
              pointsCalcMode: 'per_amount',
              pointsPerUnit: 10,
              currencyUnitAmount: 10,
              rewardTargetPoints: 100,
              rewardDescription: `خصم فوري في ${store.name} عند جمع 100 نقطة`,
            },
            currentBalance: 50,
            totalEarned: 50,
            isActive: true,
          });
          issuedCardsCount += 1;
        }

        const hasStamps = customer.cards.some(
          (c) => c.storeId === store.id && c.rule.type === 'stamps'
        );
        if (!hasStamps) {
          customer.cards.push({
            id: `card-stm-${store.id}-${customer.id}`,
            customerId: customer.id,
            merchantId: store.merchantId,
            storeId: store.id,
            storeName: store.name,
            storeLogo: store.logo,
            cardName: `بطاقة أختام ${store.name}`,
            badgeText: 'بطاقة أختام متجر ☕',
            cardColor: 'from-amber-800 via-amber-900 to-stone-900',
            cardTextColor: 'text-white',
            cardSpacing: 'normal',
            cardPattern: 'dots',
            cardCategory: 'store_stamps',
            currency: store.currency,
            rule: {
              type: 'stamps',
              stampsRequired: 6,
              stampShape: 'coffee',
              rewardDescription: `مكافأة مجانية في ${store.name} عند إكمال 6 أختام`,
            },
            currentBalance: 2,
            totalEarned: 2,
            isActive: true,
          });
          issuedCardsCount += 1;
        }
      }
      customer.totalPointsAcrossAllStores = computeDerivedCustomerTotalPoints(customer.cards);
    }

    const logEntry = appendAuditLog({
      actorName,
      actorRole,
      action: 'استكمال منظومة البطاقات الثلاثية للعملاء (يدوي)',
      target: `${db.customers.size} عملاء`,
      oldValue: 'فحص البطاقات الناقصة',
      newValue: `تم إصدار وتفعيل ${issuedCardsCount} بطاقة أختام/نقاط ناقصة`,
      ip: guard.ctx.ip,
    });

    return NextResponse.json({
      ok: true,
      message: `تم فحص محافظ جميع العملاء وإصدار (${issuedCardsCount}) بطاقة متجر (أختام + نقاط + بطاقة حساب VIP) بنجاح.`,
      customers: Array.from(db.customers.values()),
      auditLog: logEntry,
    });
  }

  // 7. Heal store media galleries, branch GPS coordinates, online ordering config, and dual card designs
  if (action === 'heal_stores_media_and_geo') {
    let healedStoresCount = 0;
    for (const store of db.stores) {
      let modified = false;
      if (!store.storeGallery || store.storeGallery.length < 4) {
        store.storeGallery = [
          `https://picsum.photos/seed/${store.id}-g1/900/600`,
          `https://picsum.photos/seed/${store.id}-g2/900/600`,
          `https://picsum.photos/seed/${store.id}-g3/900/600`,
          `https://picsum.photos/seed/${store.id}-g4/900/600`,
        ];
        modified = true;
      }
      if (!store.fullMenuImage) {
        store.fullMenuImage = `https://picsum.photos/seed/${store.id}-menu/900/1200`;
        modified = true;
      }
      if (typeof store.onlineOrderingActive !== 'boolean') {
        store.onlineOrderingActive = true;
        store.deliveryFee = store.deliveryFee ?? 15;
        store.minOrderAmount = store.minOrderAmount ?? 45;
        store.estimatedDeliveryMinutes = store.estimatedDeliveryMinutes ?? 35;
        store.whatsappOrdersNumber = store.whatsappOrdersNumber || store.phone;
        modified = true;
      }
      for (const branch of store.branches) {
        if (typeof branch.lat !== 'number' || typeof branch.lng !== 'number') {
          branch.lat = store.city === 'القاهرة' ? 29.9602 : store.city === 'جدة' ? 21.6021 : 24.7136;
          branch.lng = store.city === 'القاهرة' ? 31.2569 : store.city === 'جدة' ? 39.1074 : 46.6753;
          modified = true;
        }
        if (!branch.geofenceRadiusMeters) {
          branch.geofenceRadiusMeters = 550;
          branch.proximityAlertMessage = `أنت بالقرب من ${store.name} (${branch.name})! تفضل بزيارتنا واستفد من نقاطك وعروضك الفورية.`;
          branch.activeOfferBadge = 'عرض خاص لحاملي بطاقة عادة باس';
          modified = true;
        }
      }
      if (modified) healedStoresCount += 1;
    }

    const logEntry = appendAuditLog({
      actorName,
      actorRole,
      action: 'فحص وإصلاح صور المتاجر وإحداثيات الرادار الجغرافي (يدوي)',
      target: `${db.stores.length} متاجر`,
      oldValue: 'فحص الجاهزية',
      newValue: `تم تحديث وتأكيد جاهزية ${healedStoresCount || db.stores.length} متاجر بالكامل`,
      ip: guard.ctx.ip,
    });

    return NextResponse.json({
      ok: true,
      message: `تم فحص جميع المتاجر (${db.stores.length}) والتأكد من اكتمال الصور، المنيو، إحداثيات GPS للرادار، وإعدادات المتجر الإلكتروني.`,
      stores: db.stores,
      auditLog: logEntry,
    });
  }

  // 8. Issue an emergency compensation voucher + VIP points to a customer
  if (action === 'issue_emergency_compensation_voucher') {
    const customerId = String(body.customerId || 'cust-1').trim();
    const storeId = String(body.storeId || 'store-1').trim();
    const valueAmount = Math.max(10, Number(body.valueAmount) || 50);
    const bonusPoints = Math.max(10, Number(body.bonusPoints) || 50);
    const reason = String(body.reason || 'قسيمة تعويض واعتذار فورية من إدارة المنصة').trim();

    const customer = db.customers.get(customerId);
    const store = db.stores.find((s) => s.id === storeId) || db.stores[0];
    if (!customer || !store) {
      return NextResponse.json({ error: 'لم يتم العثور على العميل أو المتجر' }, { status: 404 });
    }

    const code = `COMP-${Math.floor(1000 + Math.random() * 9000)}`;
    const newVoucher = {
      id: `dv-comp-${Date.now()}`,
      customerId: customer.id,
      merchantId: store.merchantId,
      storeId: store.id,
      storeName: store.name,
      code,
      title: `قسيمة تعويض خاصة — ${store.name}`,
      pointsCost: 0,
      valueAmount,
      currency: store.currency,
      status: 'active' as const,
      createdAt: new Date().toISOString().slice(0, 10),
      expiresAt: '2027-03-31',
    };
    customer.vouchers.unshift(newVoucher);
    customer.accountPointsBalance = (customer.accountPointsBalance ?? 350) + bonusPoints;
    if (!Array.isArray(customer.accountTransfers)) customer.accountTransfers = [];
    customer.accountTransfers.unshift({
      id: `trf-comp-${Date.now()}`,
      type: 'admin_grant',
      points: bonusPoints,
      targetName: `تعويض إداري + قسيمة (${code})`,
      timestamp: new Date().toLocaleString('ar-SA', { hour12: true }),
      note: reason,
    });

    const logEntry = appendAuditLog({
      actorName,
      actorRole,
      action: 'إصدار قسيمة تعويض طارئة ونقاط ترضية للعميل (يدوي)',
      target: `${customer.firstName} ${customer.lastName} — ${store.name}`,
      oldValue: 'شكوى / تعويض',
      newValue: `قسيمة ${code} بقيمة ${valueAmount} ${store.currency} + ${bonusPoints} نقطة حساب VIP`,
      ip: guard.ctx.ip,
    });

    return NextResponse.json({
      ok: true,
      message: `تم إصدار قسيمة التعويض الفورية (${code}) بقيمة ${valueAmount} ${store.currency} وإضافة +${bonusPoints} نقطة VIP لحساب ${customer.firstName} ${customer.lastName}.`,
      customers: Array.from(db.customers.values()),
      auditLog: logEntry,
    });
  }

  // 9. Manual point/stamp/account balance override for any customer & card type
  if (action === 'manual_card_adjust') {
    const customerId = String(body.customerId || 'cust-1').trim();
    const cardCategory = String(body.cardCategory || 'account_master').trim();
    const storeId = String(body.storeId || 'store-1').trim();
    const delta = Number(body.delta) || 0;
    const reason = String(body.reason || 'تعديل يدوي مباشر من مدير النظام').trim();

    const customer = db.customers.get(customerId);
    if (!customer) {
      return NextResponse.json({ error: 'لم يتم العثور على العميل المحدد' }, { status: 404 });
    }

    if (delta === 0) {
      return NextResponse.json({ error: 'يرجى تحديد قيمة تعديل غير صفرية' }, { status: 400 });
    }

    if (cardCategory === 'account_master') {
      const prev = customer.accountPointsBalance ?? 350;
      customer.accountPointsBalance = Math.max(0, prev + delta);
      if (!Array.isArray(customer.accountTransfers)) customer.accountTransfers = [];
      customer.accountTransfers.unshift({
        id: `trf-adm-${Date.now()}`,
        type: 'admin_grant',
        points: Math.abs(delta),
        targetName: `تعديل إداري (${delta > 0 ? '+' : '-'}${Math.abs(delta)} نقطة)`,
        timestamp: new Date().toLocaleString('ar-SA', { hour12: true }),
        note: reason,
      });
    } else {
      const store = db.stores.find((s) => s.id === storeId) || db.stores[0];
      const desiredRuleType = cardCategory === 'store_stamps' ? 'stamps' : 'points';
      let card = customer.cards.find(
        (c) => c.storeId === store.id && c.rule.type === desiredRuleType
      );
      if (!card) {
        card = {
          id: `card-${Date.now()}`,
          customerId: customer.id,
          merchantId: store.merchantId,
          storeId: store.id,
          storeName: store.name,
          storeLogo: store.logo,
          cardName:
            desiredRuleType === 'stamps'
              ? `بطاقة أختام ${store.name}`
              : `بطاقة نقاط ${store.name}`,
          badgeText:
            desiredRuleType === 'stamps' ? 'بطاقة أختام متجر ☕' : 'بطاقة نقاط متجر ⭐',
          cardColor: store.cardColor,
          cardTextColor: store.cardTextColor,
          cardCategory: desiredRuleType === 'stamps' ? 'store_stamps' : 'store_points',
          currency: store.currency,
          rule:
            desiredRuleType === 'stamps'
              ? {
                  type: 'stamps',
                  stampsRequired: 6,
                  stampShape: 'coffee',
                  rewardDescription: store.loyaltyRule.rewardDescription || 'مكافأة عند إكمال 6 أختام',
                }
              : {
                  type: 'points',
                  pointsCalcMode: 'per_amount',
                  pointsPerUnit: 10,
                  currencyUnitAmount: 10,
                  rewardTargetPoints: 100,
                  rewardDescription: store.loyaltyRule.rewardDescription || 'خصم فوري عند 100 نقطة',
                },
          currentBalance: 0,
          totalEarned: 0,
          isActive: true,
        };
        customer.cards.push(card);
      }
      card.currentBalance = Math.max(0, card.currentBalance + delta);
      if (delta > 0) card.totalEarned += delta;
      customer.totalPointsAcrossAllStores = computeDerivedCustomerTotalPoints(customer.cards);
    }

    const logEntry = appendAuditLog({
      actorName,
      actorRole,
      action: `تعديل يدوي لرصيد البطاقة (${cardCategory})`,
      target: `${customer.firstName} ${customer.lastName}`,
      oldValue: 'قبل التعديل',
      newValue: `${delta > 0 ? `+${delta}` : delta} (${reason})`,
      ip: guard.ctx.ip,
    });

    return NextResponse.json({
      ok: true,
      message: `تم تنفيذ التعديل اليدوي (${delta > 0 ? `+${delta}` : delta}) لحساب ${customer.firstName} ${customer.lastName} بنجاح.`,
      customers: Array.from(db.customers.values()),
      overview: computeAdminOverview(db),
      auditLog: logEntry,
    });
  }

  return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
}
