'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Barcode,
  Calculator,
  Camera,
  CheckCircle2,
  CloudOff,
  Coins,
  Gift,
  History,
  Moon,
  PlusCircle,
  QrCode,
  Receipt,
  RefreshCw,
  RotateCcw,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Ticket,
  UserCheck,
  Wifi,
  WifiOff,
  Truck,
  X,
} from 'lucide-react';
import LiveOrdersManager from '@/components/LiveOrdersManager';
import { calculatePointsForAmount } from '@/lib/cardDesignLibrary';
import { authFetch, setStoredAccessToken } from '@/lib/clientAuth';
import type { LoyaltyRule, SessionUser, Store, Transaction } from '@/lib/types';

type CashierActionMode = 'add_points' | 'redeem_points' | 'inquire';

interface StoreVoucherSummary {
  id: string;
  code: string;
  title: string;
  pointsCost: number;
  valueAmount: number;
  currency: string;
  expiresAt: string;
}

interface LookupPreview {
  customerDisplayName: string;
  customerCode?: string;
  currentStoreBalance: number;
  storePointsBalance?: number;
  storeStampsBalance?: number;
  stampsRequired?: number;
  accountPointsBalance?: number;
  accountCardCode?: string;
  totalEarnedAtStore?: number;
  currency: string;
  unitType: 'points' | 'stamps';
  minThreshold: number;
  eligibleForReward: boolean;
  remainingNeeded: number;
  estimatedDiscountValue: number;
  sameStore100PtsSar?: number;
  phoneVerified: boolean;
  rewardDescription: string;
  activeStoreVouchers?: StoreVoucherSummary[];
  loyaltyRule?: LoyaltyRule;
}

interface OfflineQueuedTx {
  clientTxId: string;
  invoiceNumber: string;
  amount: number;
  entryMode: 'amount' | 'points';
  manualPoints?: number;
  qrToken: string;
  branchId: string;
  merchantId: string;
  createdAt: string;
}

interface PendingConfirmationDetails {
  actionMode: 'add_points' | 'redeem_points';
  targetCardType: 'points' | 'stamps' | 'account';
  customerName: string;
  customerCode: string;
  invoiceNumber: string;
  branchName: string;
  entryMode: 'amount' | 'points';
  invoiceAmount: number;
  pointsDelta: number;
  discountValue: number;
  netInvoiceAmount: number;
  currentBalance: number;
  projectedBalance: number;
  unitLabel: string;
  currency: string;
  voucherCode?: string;
  voucherTitle?: string;
  eligibleAfter: boolean;
}

export default function CashierPortal() {
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('b-1');

  // 3 main buttons apart from History: add_points | redeem_points | inquire
  const [actionMode, setActionMode] = useState<CashierActionMode>('add_points');
  const [targetCardType, setTargetCardType] = useState<'points' | 'stamps' | 'account'>('points');
  const [mobileSection, setMobileSection] = useState<'terminal' | 'orders' | 'history'>('terminal');

  // Shared customer identification state (Barcode/QR or Customer Code)
  const [customerIdentifier, setCustomerIdentifier] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupPreview | null>(null);

  // Transaction inputs
  const [invoiceNumber, setInvoiceNumber] = useState('INV-2026-901');
  const [earnInputMode, setEarnInputMode] = useState<'amount' | 'points'>('amount');
  const [amount, setAmount] = useState('85');
  const [manualPoints, setManualPoints] = useState('50');
  const [pointsSpent, setPointsSpent] = useState('100');
  const [redeemInvoiceAmount, setRedeemInvoiceAmount] = useState('120');
  const [selectedVoucherCode, setSelectedVoucherCode] = useState('');

  // Mandatory confirmation preview modal before final execution
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmationDetails | null>(null);
  const [submittingTx, setSubmittingTx] = useState(false);

  // Camera barcode scanner modal
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Offline support
  const [offlineMode, setOfflineMode] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueuedTx[]>([]);

  // History filter
  const [historySearch, setHistorySearch] = useState('');

  const notify = useCallback((text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ text, type });
    setTimeout(() => setToast((prev) => (prev?.text === text ? null : prev)), 4000);
  }, []);

  const loadCashierSession = useCallback(async () => {
    setLoading(true);
    try {
      const sessionRes = await authFetch('/api/auth/session', { cache: 'no-store' });
      const sessionData = await sessionRes.json().catch(() => ({}));
      const sessionRole = (sessionData?.user?.role as string | undefined) || '';

      let meRes: Response | null = null;
      let meData: {
        user?: SessionUser;
        stores?: Store[];
        transactions?: Transaction[];
      } = {};

      if (['CASHIER', 'MERCHANT_MANAGER', 'MERCHANT_OWNER', 'PLATFORM_ADMIN'].includes(sessionRole)) {
        meRes = await authFetch('/api/me');
        meData = await meRes.json().catch(() => ({}));
      }

      if (
        !meRes ||
        !meRes.ok ||
        !['CASHIER', 'MERCHANT_MANAGER', 'MERCHANT_OWNER', 'PLATFORM_ADMIN'].includes(sessionRole)
      ) {
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            demoRole: 'CASHIER',
            demoQuickSignIn: true,
          }),
        });
        const loginData = await loginRes.json().catch(() => ({}));
        if (loginData?.accessToken) {
          setStoredAccessToken(loginData.accessToken);
        }
        meRes = await authFetch('/api/me', {
          headers: loginData?.accessToken
            ? { Authorization: `Bearer ${loginData.accessToken}` }
            : undefined,
        });
        meData = await meRes.json().catch(() => ({}));
      }

      if (meRes.ok) {
        if (meData.user) setCurrentUser(meData.user);
        if (Array.isArray(meData.stores) && meData.stores.length > 0) {
          const activeStore = meData.stores[0] as Store;
          setStore(activeStore);
          setSelectedBranchId(
            meData.user?.branchId || activeStore.branches[0]?.id || 'b-1'
          );
          if (activeStore.loyaltyRule?.type === 'stamps') {
            setTargetCardType('stamps');
          }
        }
        if (Array.isArray(meData.transactions)) {
          setTransactions(meData.transactions);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCashierSession();
  }, [loadCashierSession]);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopCameraStream();
  }, [stopCameraStream]);

  const verifyCustomerCode = useCallback(
    async (codeToLookup: string) => {
      const clean = codeToLookup.trim();
      if (!clean) {
        setLookupError('يرجى مسح باركود العميل أو إدخال رمز العميل أولاً.');
        return null;
      }
      setLookupLoading(true);
      setLookupError('');
      try {
        const res = await authFetch('/api/transactions/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            qrToken: clean,
            merchantId: store?.merchantId,
            branchId: selectedBranchId,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) {
          const msg = data?.error || 'لم يتم العثور على العميل أو الرمز غير صالح.';
          setLookupError(msg);
          setLookupResult(null);
          notify(msg, 'err');
          return null;
        }
        const preview = data as LookupPreview;
        setLookupResult(preview);
        setSelectedVoucherCode('');
        if (preview.unitType === 'stamps') {
          setTargetCardType('stamps');
          setPointsSpent(String(preview.stampsRequired || 6));
        } else {
          setTargetCardType('points');
          setPointsSpent('100');
        }
        notify(`تم التحقق من العميل: ${preview.customerDisplayName}`);
        return preview;
      } finally {
        setLookupLoading(false);
      }
    },
    [store?.merchantId, selectedBranchId, notify]
  );

  const handleSimulateQrScan = async () => {
    setLookupError('');
    const res = await authFetch(
      `/api/transactions/demo-scan?merchantId=${encodeURIComponent(
        store?.merchantId || 'merch-1'
      )}&branchId=${encodeURIComponent(selectedBranchId)}`
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.qrToken) {
      notify(data.error || 'تعذر محاكاة مسح الباركود', 'err');
      return;
    }
    setCustomerIdentifier(data.qrToken);
    setScannerOpen(false);
    stopCameraStream();
    await verifyCustomerCode(data.qrToken);
  };

  const handleOpenCameraScanner = async () => {
    setScannerOpen(true);
    setScannerError('');
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setScannerError('المتصفح الحالي لا يدعم تشغيل الكاميرا مباشرة؛ يمكنك استخدام المحاكاة الفورية أو إدخال الرمز يدوياً.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // Try native BarcodeDetector if available
      const win = window as unknown as {
        BarcodeDetector?: new (opts?: { formats: string[] }) => {
          detect: (src: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
        };
      };
      if (win.BarcodeDetector && videoRef.current) {
        const detector = new win.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] });
        const scanTick = async () => {
          if (!streamRef.current || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0 && codes[0].rawValue) {
              const scannedVal = codes[0].rawValue;
              setCustomerIdentifier(scannedVal);
              setScannerOpen(false);
              stopCameraStream();
              await verifyCustomerCode(scannedVal);
              return;
            }
          } catch {
            // Continue scanning frames
          }
          if (streamRef.current) {
            requestAnimationFrame(scanTick);
          }
        };
        requestAnimationFrame(scanTick);
      }
    } catch {
      setScannerError('تعذر الوصول إلى الكاميرا (ربما تم رفض الإذن أو لا توجد كاميرا متصلة). يمكنك استخدام «محاكاة مسح الباركود» أو إدخال الرمز يدوياً.');
    }
  };

  const handleCloseScanner = () => {
    setScannerOpen(false);
    stopCameraStream();
  };

  const activeLoyaltyRule = lookupResult?.loyaltyRule || store?.loyaltyRule;
  const isStampsStore = targetCardType === 'stamps';
  const unitLabel =
    targetCardType === 'stamps'
      ? 'ختم'
      : targetCardType === 'account'
      ? 'نقطة حساب VIP'
      : 'نقطة';
  const sameStoreRate = lookupResult?.sameStore100PtsSar || 10;

  const activeCardBalance = useMemo(() => {
    if (!lookupResult) return 0;
    if (targetCardType === 'stamps') {
      return lookupResult.storeStampsBalance ?? (lookupResult.unitType === 'stamps' ? lookupResult.currentStoreBalance : 0);
    }
    if (targetCardType === 'account') {
      return lookupResult.accountPointsBalance ?? 350;
    }
    return lookupResult.storePointsBalance ?? lookupResult.currentStoreBalance;
  }, [lookupResult, targetCardType]);

  const activeCardThreshold = useMemo(() => {
    if (targetCardType === 'stamps') {
      return lookupResult?.stampsRequired || activeLoyaltyRule?.stampsRequired || 6;
    }
    if (targetCardType === 'account') {
      return 100;
    }
    return lookupResult?.minThreshold || activeLoyaltyRule?.rewardTargetPoints || 100;
  }, [targetCardType, lookupResult, activeLoyaltyRule]);

  const computedEarnedPoints = useMemo(() => {
    if (earnInputMode === 'points') {
      return Math.max(0, Math.floor(Number(manualPoints) || 0));
    }
    if (targetCardType === 'stamps') {
      const inv = Math.max(0, Number(amount) || 0);
      return inv > 0 ? Math.max(1, Math.floor(inv / 25)) : 0;
    }
    if (targetCardType === 'account') {
      const inv = Math.max(0, Number(amount) || 0);
      return Math.max(1, Math.round(inv * 0.25));
    }
    if (!activeLoyaltyRule) return Math.max(0, Math.floor((Number(amount) || 0) / 10));
    return calculatePointsForAmount(activeLoyaltyRule, Number(amount) || 0);
  }, [earnInputMode, manualPoints, targetCardType, activeLoyaltyRule, amount]);

  const activeVoucherSelected = useMemo(() => {
    if (!selectedVoucherCode || !lookupResult?.activeStoreVouchers) return null;
    return lookupResult.activeStoreVouchers.find((v) => v.code === selectedVoucherCode) || null;
  }, [selectedVoucherCode, lookupResult?.activeStoreVouchers]);

  const computedRedeemDiscount = useMemo(() => {
    if (activeVoucherSelected) return activeVoucherSelected.valueAmount;
    const pts = Math.max(0, Math.floor(Number(pointsSpent) || 0));
    if (targetCardType === 'stamps') return 25;
    if (targetCardType === 'account') return Math.max(5, Math.round(pts * 0.25));
    return Math.round(((pts / 100) * sameStoreRate) * 100) / 100;
  }, [activeVoucherSelected, pointsSpent, targetCardType, sameStoreRate]);

  const handlePreparePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actionMode === 'inquire') {
      await verifyCustomerCode(customerIdentifier);
      return;
    }

    if (!customerIdentifier.trim()) {
      notify('يجب مسح باركود العميل أو إدخال رمز العميل أولاً.', 'err');
      return;
    }
    if (!invoiceNumber.trim()) {
      notify('يرجى إدخال رقم الفاتورة قبل المتابعة.', 'err');
      return;
    }

    let customer = lookupResult;
    if (!customer) {
      customer = await verifyCustomerCode(customerIdentifier);
      if (!customer) return;
    }

    const activeBranch =
      store?.branches.find((b) => b.id === selectedBranchId)?.name || 'الفرع الرئيسي';
    const currency = store?.currency || customer.currency || 'SAR';
    const currentBal =
      targetCardType === 'stamps'
        ? customer.storeStampsBalance ?? (customer.unitType === 'stamps' ? customer.currentStoreBalance : 0)
        : targetCardType === 'account'
        ? customer.accountPointsBalance ?? 350
        : customer.storePointsBalance ?? customer.currentStoreBalance;

    if (actionMode === 'add_points') {
      const invAmt = Math.max(0, Number(amount) || 0);
      if (earnInputMode === 'amount' && invAmt <= 0) {
        notify('يرجى إدخال قيمة الفاتورة لحساب النقاط.', 'err');
        return;
      }
      if (earnInputMode === 'points' && computedEarnedPoints <= 0) {
        notify(`يرجى إدخال عدد ${isStampsStore ? 'الأختام' : 'النقاط'} المراد إضافتها.`, 'err');
        return;
      }
      const projected = currentBal + computedEarnedPoints;
      setPendingConfirmation({
        actionMode: 'add_points',
        targetCardType,
        customerName: customer.customerDisplayName,
        customerCode: customer.customerCode || customerIdentifier.slice(0, 14),
        invoiceNumber: invoiceNumber.trim(),
        branchName: activeBranch,
        entryMode: earnInputMode,
        invoiceAmount: invAmt,
        pointsDelta: computedEarnedPoints,
        discountValue: 0,
        netInvoiceAmount: invAmt,
        currentBalance: currentBal,
        projectedBalance: projected,
        unitLabel,
        currency,
        eligibleAfter: projected >= activeCardThreshold,
      });
      return;
    }

    // redeem_points
    if (offlineMode) {
      notify('صرف النقاط والمكافآت يتطلب اتصالاً بالإنترنت لمنع الاحتيال.', 'err');
      return;
    }

    const ptsToSpend = Math.max(0, Math.floor(Number(pointsSpent) || 0));
    if (ptsToSpend <= 0) {
      notify('يرجى تحديد عدد النقاط أو الأختام المراد صرفها.', 'err');
      return;
    }
    if (currentBal < ptsToSpend) {
      notify(
        `رصيد العميل في هذه البطاقة (${currentBal} ${unitLabel}) غير كافٍ لصرف ${ptsToSpend} ${unitLabel}.`,
        'err'
      );
      return;
    }

    const invTotal = Math.max(0, Number(redeemInvoiceAmount) || 0);
    const projected = Math.max(0, currentBal - ptsToSpend);
    setPendingConfirmation({
      actionMode: 'redeem_points',
      targetCardType,
      customerName: customer.customerDisplayName,
      customerCode: customer.customerCode || customerIdentifier.slice(0, 14),
      invoiceNumber: invoiceNumber.trim(),
      branchName: activeBranch,
      entryMode: 'points',
      invoiceAmount: invTotal,
      pointsDelta: -ptsToSpend,
      discountValue: computedRedeemDiscount,
      netInvoiceAmount: Math.max(0, invTotal - computedRedeemDiscount),
      currentBalance: currentBal,
      projectedBalance: projected,
      unitLabel,
      currency,
      voucherCode: activeVoucherSelected?.code,
      voucherTitle: activeVoucherSelected?.title,
      eligibleAfter: projected >= activeCardThreshold,
    });
  };

  const handleConfirmExecute = async () => {
    if (!pendingConfirmation) return;

    if (offlineMode && pendingConfirmation.actionMode === 'add_points') {
      const queued: OfflineQueuedTx = {
        clientTxId: `offline-${Date.now()}`,
        invoiceNumber: pendingConfirmation.invoiceNumber,
        amount: pendingConfirmation.invoiceAmount,
        entryMode: pendingConfirmation.entryMode,
        manualPoints:
          pendingConfirmation.entryMode === 'points'
            ? pendingConfirmation.pointsDelta
            : undefined,
        qrToken: customerIdentifier.trim(),
        branchId: selectedBranchId,
        merchantId: store?.merchantId || 'merch-1',
        createdAt: new Date().toLocaleTimeString('ar-SA'),
      };
      setOfflineQueue((prev) => [queued, ...prev]);
      setPendingConfirmation(null);
      setInvoiceNumber(`INV-2026-${Math.floor(100 + Math.random() * 899)}`);
      notify('تم حفظ العملية محلياً دون اتصال وستُزامن تلقائياً فور عودة الشبكة');
      return;
    }

    setSubmittingTx(true);
    try {
      const isRedeem = pendingConfirmation.actionMode === 'redeem_points';
      const res = await authFetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: store?.merchantId,
          branchId: selectedBranchId,
          qrToken: customerIdentifier.trim(),
          invoiceNumber: pendingConfirmation.invoiceNumber,
          amount: pendingConfirmation.invoiceAmount,
          type: isRedeem ? 'redemption' : 'purchase',
          targetCardType: pendingConfirmation.targetCardType,
          entryMode: pendingConfirmation.entryMode,
          manualPoints:
            !isRedeem && pendingConfirmation.entryMode === 'points'
              ? pendingConfirmation.pointsDelta
              : undefined,
          pointsSpent: isRedeem ? Math.abs(pendingConfirmation.pointsDelta) : undefined,
          discountGiven: isRedeem ? pendingConfirmation.discountValue : undefined,
          voucherCode: pendingConfirmation.voucherCode,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || 'تعذر تنفيذ العملية', 'err');
        return;
      }

      if (data.transaction) {
        setTransactions((prev) => [data.transaction, ...prev]);
      }
      if (typeof data.storeBalance === 'number' && lookupResult) {
        const updatedBal = data.storeBalance;
        setLookupResult({
          ...lookupResult,
          currentStoreBalance:
            pendingConfirmation.targetCardType === 'account'
              ? lookupResult.currentStoreBalance
              : updatedBal,
          storePointsBalance:
            pendingConfirmation.targetCardType === 'points'
              ? updatedBal
              : lookupResult.storePointsBalance,
          storeStampsBalance:
            pendingConfirmation.targetCardType === 'stamps'
              ? updatedBal
              : lookupResult.storeStampsBalance,
          accountPointsBalance:
            typeof data.accountPointsBalance === 'number'
              ? data.accountPointsBalance
              : lookupResult.accountPointsBalance,
          eligibleForReward: updatedBal >= activeCardThreshold,
          remainingNeeded: Math.max(0, activeCardThreshold - updatedBal),
          activeStoreVouchers: pendingConfirmation.voucherCode
            ? lookupResult.activeStoreVouchers?.filter(
                (v) => v.code !== pendingConfirmation.voucherCode
              )
            : lookupResult.activeStoreVouchers,
        });
      }

      setPendingConfirmation(null);
      setSelectedVoucherCode('');
      setInvoiceNumber(`INV-2026-${Math.floor(100 + Math.random() * 899)}`);
      notify(
        isRedeem
          ? `تم خصم ${Math.abs(pendingConfirmation.pointsDelta)} ${unitLabel} وتطبيق خصم ${pendingConfirmation.discountValue} ${pendingConfirmation.currency} بنجاح`
          : `تم تسجيل الفاتورة (${pendingConfirmation.invoiceNumber}) وإضافة +${data.transaction?.pointsEarned ?? pendingConfirmation.pointsDelta} ${unitLabel}`
      );
    } finally {
      setSubmittingTx(false);
    }
  };

  const handleSyncOfflineQueue = async () => {
    if (offlineQueue.length === 0) return;
    let syncedCount = 0;
    for (const item of offlineQueue) {
      const res = await authFetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: item.merchantId,
          branchId: item.branchId,
          qrToken: item.qrToken,
          invoiceNumber: item.invoiceNumber,
          amount: item.amount,
          entryMode: item.entryMode,
          manualPoints: item.manualPoints,
          type: 'purchase',
          clientTxId: item.clientTxId,
          isOfflineSync: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.transaction) {
        syncedCount++;
        setTransactions((prev) => [data.transaction, ...prev]);
      }
    }
    setOfflineQueue([]);
    setOfflineMode(false);
    notify(`تمت مزامنة ${syncedCount} عمليات محفوظة بنجاح`);
  };

  const handleRequestRefund = async (txId: string) => {
    const res = await authFetch(`/api/transactions/${txId}/request-refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'طلب استرجاع فاتورة من الكاشير' }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify(data.error || 'تعذر رفع طلب الاسترجاع', 'err');
      return;
    }
    if (data.transaction) {
      setTransactions((prev) => prev.map((t) => (t.id === txId ? data.transaction : t)));
    }
    notify('تم رفع طلب استرجاع الفاتورة لمالك المتجر');
  };

  const filteredTransactions = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(
      (tx) =>
        tx.invoiceNumber.toLowerCase().includes(q) ||
        tx.customerName.toLowerCase().includes(q) ||
        tx.branchName.toLowerCase().includes(q)
    );
  }, [transactions, historySearch]);

  if (loading) {
    return (
      <div
        dir="rtl"
        className={`min-h-screen bg-light-canvas text-[#0B1F3A] dark:text-white flex items-center justify-center p-6 ${isDark ? 'dark' : ''}`}
      >
        <div className="glass-card rounded-3xl px-8 py-6 flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#0284C7] dark:text-[#00C2FF] animate-spin" />
          <p className="text-sm font-black text-[#0B1F3A] dark:text-slate-200">
            جاري تشغيل نقطة بيع الكاشير...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className={`min-h-screen bg-light-canvas text-[#0B1F3A] dark:text-slate-100 ${isDark ? 'dark' : ''}`}
    >
      {/* Header */}
      <header className="sticky top-0 z-30 glass-card border-b border-sky-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo-color.png"
              alt="عادة باس | Aada Pass"
              className="h-9 w-auto object-contain dark:hidden shrink-0"
            />
            <img
              src="/logo-white.png"
              alt="عادة باس | Aada Pass"
              className="h-9 w-auto object-contain hidden dark:block shrink-0"
            />
            <div className="border-r border-slate-200 dark:border-slate-700 pr-3">
              <h1 className="text-base sm:text-lg font-black text-[#0B1F3A] dark:text-white">
                نقطة بيع الكاشير — عادة باس
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                {store?.name || 'محمصة كيان المختصة'} · الكاشير:{' '}
                {currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'سعد الدوسري'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {store && store.branches.length > 0 && (
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                aria-label="الفرع النشط"
                className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#0B1F3A] dark:text-white"
              >
                {store.branches.map((br) => (
                  <option key={br.id} value={br.id}>
                    {br.name}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => setOfflineMode((prev) => !prev)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 border transition cursor-pointer ${
                offlineMode
                  ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-400/40'
                  : 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-400/40'
              }`}
            >
              {offlineMode ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
              {offlineMode ? 'وضع بدون إنترنت' : 'متصل بالشبكة'}
            </button>

            <button
              type="button"
              onClick={() => setIsDark((prev) => !prev)}
              aria-label={isDark ? 'الوضع الفاتح' : 'الوضع الليلي'}
              className="bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-amber-300 border border-slate-200 dark:border-slate-700 p-2 rounded-xl transition-all cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {currentUser?.role === 'MERCHANT_OWNER' && (
              <Link
                href="/?portal=1"
                className="px-3.5 py-2 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] text-xs font-black flex items-center gap-1 shadow-sm hover:opacity-95 transition"
              >
                <span>العودة لبوابة المالك ↩️</span>
              </Link>
            )}

            <Link
              href="/"
              className="px-4 py-2 rounded-xl bg-gradient-navy hover:opacity-95 text-white text-xs font-black"
            >
              الصفحة الرئيسية
            </Link>
          </div>
        </div>
      </header>

      {toast && (
        <div className="fixed bottom-5 left-5 z-50 max-w-md px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-2.5 bg-[#0B1F3A] border-[#00C2FF]/40 text-white">
          {toast.type === 'ok' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="text-xs font-bold">{toast.text}</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Navigation Switcher: POS Terminal vs Live Orders vs History */}
        <div className="flex flex-wrap gap-2 bg-white/90 dark:bg-slate-900/90 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm max-w-xl mx-auto">
          <button
            type="button"
            onClick={() => setMobileSection('terminal')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition ${
              mobileSection === 'terminal'
                ? 'bg-[#0B1F3A] text-white shadow-xs dark:bg-sky-500'
                : 'text-slate-600 dark:text-slate-300 hover:text-sky-600'
            }`}
          >
            <ScanLine className="w-4 h-4" />
            <span>نقطة البيع (POS)</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileSection('orders')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition ${
              mobileSection === 'orders'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-emerald-600'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>طلبات الأونلاين والتوصيل 🛵</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileSection('history')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition ${
              mobileSection === 'history'
                ? 'bg-gradient-navy text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-sky-600'
            }`}
          >
            <History className="w-4 h-4" />
            <span>السجل ({transactions.length})</span>
          </button>
        </div>

        {mobileSection === 'orders' ? (
          <LiveOrdersManager
            sessionUser={currentUser!}
            storeId={store?.id}
            merchantId={store?.merchantId}
            branchId={selectedBranchId}
            isOwner={currentUser?.role === 'MERCHANT_OWNER'}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT / MAIN TERMINAL: 3 Primary Action Buttons + Shared Barcode/Code + Inputs + Preview */}
          <div
            className={`lg:col-span-7 space-y-5 ${
              mobileSection === 'history' ? 'hidden lg:block' : 'block'
            }`}
          >
            {/* 3 Primary Operation Buttons (غير السجل) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => {
                  setActionMode('add_points');
                  setPendingConfirmation(null);
                }}
                className={`p-4 rounded-2xl border text-right transition-all flex items-center gap-3 cursor-pointer ${
                  actionMode === 'add_points'
                    ? 'bg-gradient-electric text-white border-transparent shadow-lg shadow-sky-500/25'
                    : 'glass-card text-[#0B1F3A] dark:text-slate-200 hover:border-sky-400'
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    actionMode === 'add_points'
                      ? 'bg-white/20 text-white'
                      : 'bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300'
                  }`}
                >
                  <PlusCircle className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-sm font-black block">إضافة نقاط</span>
                  <span
                    className={`text-[11px] font-bold ${
                      actionMode === 'add_points'
                        ? 'text-sky-50'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    منح نقاط أو أختام فاتورة
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActionMode('redeem_points');
                  setPendingConfirmation(null);
                }}
                className={`p-4 rounded-2xl border text-right transition-all flex items-center gap-3 cursor-pointer ${
                  actionMode === 'redeem_points'
                    ? 'bg-gradient-gold-cta text-[#0B1F3A] border-transparent shadow-lg shadow-amber-500/25'
                    : 'glass-card text-[#0B1F3A] dark:text-slate-200 hover:border-amber-400'
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    actionMode === 'redeem_points'
                      ? 'bg-[#0B1F3A]/15 text-[#0B1F3A]'
                      : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  <Gift className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-sm font-black block">صرف نقاط</span>
                  <span
                    className={`text-[11px] font-bold ${
                      actionMode === 'redeem_points'
                        ? 'text-[#0B1F3A]/80'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    خصم نقاط أو صرف قسيمة
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActionMode('inquire');
                  setPendingConfirmation(null);
                }}
                className={`p-4 rounded-2xl border text-right transition-all flex items-center gap-3 cursor-pointer ${
                  actionMode === 'inquire'
                    ? 'bg-gradient-navy text-white border-[#00C2FF]/40 shadow-lg shadow-slate-900/20'
                    : 'glass-card text-[#0B1F3A] dark:text-slate-200 hover:border-emerald-400'
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    actionMode === 'inquire'
                      ? 'bg-[#00C2FF]/20 text-[#00C2FF]'
                      : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  <Search className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-sm font-black block">استعلام عن نقاط أو مكافأة</span>
                  <span
                    className={`text-[11px] font-bold ${
                      actionMode === 'inquire'
                        ? 'text-sky-200'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    فحص الرصيد والأهلية والقسائم
                  </span>
                </div>
              </button>
            </div>

            {/* Active Workspace Card */}
            <form onSubmit={handlePreparePreview} className="p-6 rounded-3xl glass-card space-y-5">
              {/* Step 1: Mandatory Barcode Scan or Customer Code Input (Required in ALL 3 buttons) */}
              <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#0B1F3A] dark:bg-[#00C2FF] text-white dark:text-[#0B1F3A] text-xs font-black flex items-center justify-center">
                      1
                    </span>
                    <h2 className="text-sm font-black text-[#0B1F3A] dark:text-white">
                      مسح باركود العميل أو إدخال رمز العميل
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleOpenCameraScanner}
                      className="px-3 py-2 rounded-xl bg-gradient-navy hover:opacity-95 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-[#00C2FF]" />
                      <span>مسح بالكاميرا</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSimulateQrScan}
                      className="px-3 py-2 rounded-xl bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>محاكاة مسح الباركود</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Barcode className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                    <input
                      type="text"
                      value={customerIdentifier}
                      onChange={(e) => {
                        setCustomerIdentifier(e.target.value);
                        setLookupError('');
                      }}
                      placeholder="امسح الباركود أو أدخل رمز العميل (مثل: fahad أو FAHAD2026 أو 0551234567 أو رمز QR)..."
                      className="w-full pr-9 pl-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white font-mono min-h-[42px]"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={lookupLoading}
                    onClick={() => verifyCustomerCode(customerIdentifier)}
                    className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-1.5 shrink-0 cursor-pointer min-h-[42px]"
                  >
                    {lookupLoading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5" />
                    )}
                    <span>تحقق من العميل</span>
                  </button>
                </div>

                {/* Quick 1-Click Demo Customer Selector for Rapid Cashier Testing */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    اختيار سريع للتجربة:
                  </span>
                  {[
                    { code: 'FAHAD2026', label: 'فهد العتيبي (FAHAD2026)' },
                    { code: 'SARA2026', label: 'سارة الدوسري (SARA2026)' },
                    { code: '0551234567', label: 'بحث بالجوال (0551234567)' },
                  ].map((demo) => (
                    <button
                      key={demo.code}
                      type="button"
                      onClick={() => {
                        setCustomerIdentifier(demo.code);
                        verifyCustomerCode(demo.code);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-[#0B1F3A] dark:text-slate-200 transition cursor-pointer"
                    >
                      {demo.label}
                    </button>
                  ))}
                </div>

                {lookupError && (
                  <p className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{lookupError}</span>
                  </p>
                )}

                {lookupResult && (
                  <div className="p-4 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-700/50 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <BadgeCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-sm font-black text-[#0B1F3A] dark:text-white">
                          {lookupResult.customerDisplayName}
                        </span>
                        {lookupResult.customerCode && (
                          <span className="text-[11px] font-mono bg-white/80 dark:bg-slate-900/70 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800 text-slate-600 dark:text-slate-300">
                            {lookupResult.customerCode}
                          </span>
                        )}
                      </div>
                      <span className="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-black tabular-nums">
                        الرصيد المحدد: {activeCardBalance} {unitLabel}
                      </span>
                    </div>

                    {/* 3-Card System Selector for Cashier */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 block">
                        اختر نوع البطاقة المراد التعامل معها (منظومة الـ 3 بطاقات):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setTargetCardType('points');
                            setPointsSpent('100');
                          }}
                          className={`p-2.5 rounded-xl border text-right transition flex items-center justify-between cursor-pointer ${
                            targetCardType === 'points'
                              ? 'bg-[#0B1F3A] text-white border-sky-400 shadow-sm'
                              : 'bg-white/90 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <div>
                            <span className="text-[11px] font-black block">1. بطاقة نقاط المتجر</span>
                            <span className="text-[10px] opacity-80">نقاط خاصة بالمتجر</span>
                          </div>
                          <span className="text-sm font-black tabular-nums">
                            {lookupResult.storePointsBalance ?? lookupResult.currentStoreBalance} نقطة
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setTargetCardType('stamps');
                            setPointsSpent(String(lookupResult.stampsRequired || 6));
                          }}
                          className={`p-2.5 rounded-xl border text-right transition flex items-center justify-between cursor-pointer ${
                            targetCardType === 'stamps'
                              ? 'bg-[#0B1F3A] text-white border-amber-400 shadow-sm'
                              : 'bg-white/90 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <div>
                            <span className="text-[11px] font-black block">2. بطاقة أختام المتجر</span>
                            <span className="text-[10px] opacity-80">
                              الهدف: {lookupResult.stampsRequired || 6} أختام
                            </span>
                          </div>
                          <span className="text-sm font-black tabular-nums">
                            {lookupResult.storeStampsBalance ?? 0} ختم
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setTargetCardType('account');
                            setPointsSpent('60');
                          }}
                          className={`p-2.5 rounded-xl border text-right transition flex items-center justify-between cursor-pointer ${
                            targetCardType === 'account'
                              ? 'bg-gradient-gold-cta text-[#0B1F3A] border-amber-500 shadow-sm'
                              : 'bg-white/90 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <div>
                            <span className="text-[11px] font-black block">3. بطاقة الحساب VIP</span>
                            <span className="text-[10px] opacity-80">نقاط للمشاركة والخصم</span>
                          </div>
                          <span className="text-sm font-black tabular-nums">
                            {lookupResult.accountPointsBalance ?? 350} نقطة
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      <span>
                        {activeCardBalance >= activeCardThreshold
                          ? `مؤهل للمكافأة في هذه البطاقة: ${lookupResult.rewardDescription}`
                          : `متبقي ${Math.max(0, activeCardThreshold - activeCardBalance)} ${unitLabel} للوصول إلى المكافأة (${lookupResult.rewardDescription})`}
                      </span>
                      <span className="text-sky-700 dark:text-sky-300 tabular-nums">
                        القيمة التقديرية للخصم: {lookupResult.estimatedDiscountValue}{' '}
                        {lookupResult.currency}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-2 rounded-full bg-emerald-200/70 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-[#00C2FF] rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (activeCardBalance / Math.max(1, activeCardThreshold)) * 100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* MODE 3: INQUIRY RESULT & VOUCHERS */}
              {actionMode === 'inquire' && (
                <div className="space-y-4">
                  {!lookupResult ? (
                    <div className="p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
                      <Search className="w-8 h-8 text-sky-600 dark:text-[#00C2FF] mx-auto" />
                      <p className="text-sm font-black text-[#0B1F3A] dark:text-white">
                        الاستعلام الفوري عن رصيد ومكافآت العميل
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        امسح باركود العميل أو أدخل رمز العميل بالأعلى ثم اضغط «تحقق من العميل» لعرض النقاط والأختام والقسائم الصالحة في متجرك.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700">
                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                            الرصيد المتاح في البطاقة المختارة
                          </span>
                          <span className="text-2xl font-black text-[#0B1F3A] dark:text-white tabular-nums">
                            {activeCardBalance} {unitLabel}
                          </span>
                        </div>
                        <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700">
                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                            حالة المكافأة
                          </span>
                          <span
                            className={`text-sm font-black block mt-1 ${
                              activeCardBalance >= activeCardThreshold
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {activeCardBalance >= activeCardThreshold
                              ? 'مؤهل للاستبدال الآن ✓'
                              : `متبقي ${Math.max(0, activeCardThreshold - activeCardBalance)} ${unitLabel}`}
                          </span>
                        </div>
                        <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700">
                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                            توثيق الجوال لصرف المكافآت
                          </span>
                          <span
                            className={`text-sm font-black block mt-1 ${
                              lookupResult.phoneVerified
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {lookupResult.phoneVerified ? 'موثق ✓ جاهز للصرف' : 'غير موثق OTP'}
                          </span>
                        </div>
                      </div>

                      {/* Customer Active Vouchers at this store */}
                      <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 space-y-2.5">
                        <h3 className="text-xs font-black text-[#0B1F3A] dark:text-white flex items-center gap-1.5">
                          <Ticket className="w-4 h-4 text-sky-600 dark:text-[#00C2FF]" />
                          <span>
                            قسائم العميل النشطة في هذا المتجر (
                            {lookupResult.activeStoreVouchers?.length || 0})
                          </span>
                        </h3>
                        {!lookupResult.activeStoreVouchers ||
                        lookupResult.activeStoreVouchers.length === 0 ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            لا توجد قسائم مصدرة حالياً لهذا العميل في المتجر؛ يمكنه صرف النقاط مباشرة عند الأهلية.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {lookupResult.activeStoreVouchers.map((v) => (
                              <div
                                key={v.id}
                                className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex flex-wrap items-center justify-between gap-2 text-xs"
                              >
                                <div>
                                  <p className="font-black text-[#0B1F3A] dark:text-white">
                                    {v.title}
                                  </p>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                    {v.code} · القيمة: {v.valueAmount} {v.currency} · ينتهي:{' '}
                                    {v.expiresAt}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedVoucherCode(v.code);
                                    setPointsSpent(String(v.pointsCost || 100));
                                    setActionMode('redeem_points');
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] text-xs font-black cursor-pointer"
                                >
                                  صرف هذه القسيمة
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setActionMode('add_points')}
                          className="py-3 rounded-xl bg-gradient-electric text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <PlusCircle className="w-4 h-4" />
                          <span>الانتقال لإضافة نقاط للعميل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActionMode('redeem_points')}
                          className="py-3 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Gift className="w-4 h-4" />
                          <span>الانتقال لصرف مكافأة للعميل</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* MODE 1: ADD POINTS */}
              {actionMode === 'add_points' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-sky-600 text-white text-xs font-black flex items-center justify-center">
                        2
                      </span>
                      <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white">
                        تفاصيل الفاتورة و{isStampsStore ? 'الأختام' : 'النقاط'} المضافة
                      </h3>
                    </div>

                    <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-black">
                      <button
                        type="button"
                        onClick={() => setEarnInputMode('amount')}
                        className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer ${
                          earnInputMode === 'amount'
                            ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-[#00C2FF] shadow-xs'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <Calculator className="w-3.5 h-3.5" />
                        <span>حسب قيمة الفاتورة</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEarnInputMode('points')}
                        className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer ${
                          earnInputMode === 'points'
                            ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-[#00C2FF] shadow-xs'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span>تحديد عدد {isStampsStore ? 'الأختام' : 'النقاط'} مباشرة</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                        رقم الفاتورة *
                      </label>
                      <input
                        type="text"
                        required
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white font-mono"
                      />
                    </div>

                    {earnInputMode === 'amount' ? (
                      <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                          قيمة الفاتورة ({store?.currency || 'SAR'}) *
                        </label>
                        <input
                          type="number"
                          min={1}
                          required
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white font-bold tabular-nums"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                          عدد {isStampsStore ? 'الأختام' : 'النقاط'} المراد إضافتها *
                        </label>
                        <input
                          type="number"
                          min={1}
                          required
                          value={manualPoints}
                          onChange={(e) => setManualPoints(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white font-bold tabular-nums"
                        />
                      </div>
                    )}
                  </div>

                  {earnInputMode === 'amount' && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        مبالغ فواتير سريعة:
                      </span>
                      {[35, 75, 120, 250, 450].map((presetAmt) => (
                        <button
                          key={presetAmt}
                          type="button"
                          onClick={() => setAmount(String(presetAmt))}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-black border transition cursor-pointer tabular-nums ${
                            Number(amount) === presetAmt
                              ? 'bg-sky-600 text-white border-sky-600'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-sky-400'
                          }`}
                        >
                          {presetAmt} {store?.currency || 'SAR'}
                        </button>
                      ))}
                    </div>
                  )}

                  {earnInputMode === 'points' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                        مبلغ الفاتورة المرجعي ({store?.currency || 'SAR'}) — اختياري
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white font-bold tabular-nums"
                      />
                    </div>
                  )}

                  {/* Live calculation strip + Math Formula Audit */}
                  <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 space-y-1.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        سيحصل العميل على:
                      </span>
                      <span className="font-black text-sky-700 dark:text-[#00C2FF] text-sm tabular-nums">
                        +{computedEarnedPoints} {unitLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                      {targetCardType === 'stamps'
                        ? `المعادلة: ختم واحد لكل 25 ${store?.currency || 'SAR'} من قيمة الفاتورة (+${Math.max(5, computedEarnedPoints * 5)} نقطة هدية في بطاقة الحساب VIP)`
                        : targetCardType === 'account'
                        ? `المعادلة: 25% من قيمة الفاتورة تُضاف مباشرة لرصيد بطاقة الحساب الشاملة VIP`
                        : `المعادلة: احتساب دقيق حسب قاعدة المتجر (+${Math.max(2, Math.round(computedEarnedPoints * 0.15))} نقطة مكافأة إضافية لبطاقة الحساب VIP)`}
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl bg-gradient-electric hover:opacity-95 text-white text-xs font-black shadow-md shadow-sky-500/20 flex items-center justify-center gap-2 cursor-pointer min-h-[46px]"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>مراجعة تفاصيل الإضافة قبل التأكيد</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* MODE 2: REDEEM POINTS */}
              {actionMode === 'redeem_points' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-amber-500 text-[#0B1F3A] text-xs font-black flex items-center justify-center">
                      2
                    </span>
                    <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white">
                      تفاصيل صرف النقاط أو القسيمة والخصم
                    </h3>
                  </div>

                  {/* Quick voucher select if customer has vouchers in this store */}
                  {lookupResult?.activeStoreVouchers &&
                    lookupResult.activeStoreVouchers.length > 0 && (
                      <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-2">
                        <label className="block text-xs font-black text-amber-900 dark:text-amber-300">
                          أو اختر قسيمة جاهزة لدى العميل لتطبيق خصمها:
                        </label>
                        <select
                          value={selectedVoucherCode}
                          onChange={(e) => {
                            const code = e.target.value;
                            setSelectedVoucherCode(code);
                            const v = lookupResult.activeStoreVouchers?.find(
                              (item) => item.code === code
                            );
                            if (v) {
                              setPointsSpent(String(v.pointsCost || 100));
                            }
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-xs font-bold"
                        >
                          <option value="">-- خصم نقاط مباشر بدون قسيمة --</option>
                          {lookupResult.activeStoreVouchers.map((v) => (
                            <option key={v.id} value={v.code}>
                              {v.title} ({v.code}) — خصم {v.valueAmount} {v.currency}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                        رقم الفاتورة *
                      </label>
                      <input
                        type="text"
                        required
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                        عدد {isStampsStore ? 'الأختام' : 'النقاط'} المخصومة *
                      </label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={pointsSpent}
                        onChange={(e) => setPointsSpent(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white font-bold tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                        قيمة الفاتورة قبل الخصم ({store?.currency || 'SAR'})
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={redeemInvoiceAmount}
                        onChange={(e) => setRedeemInvoiceAmount(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white font-bold tabular-nums"
                      />
                    </div>
                  </div>

                  {/* Quick redemption unit presets */}
                  {lookupResult && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        تحديد سريع للصرف:
                      </span>
                      {(targetCardType === 'stamps'
                        ? [lookupResult.stampsRequired || 6]
                        : [50, 100, 150, Math.max(10, activeCardBalance)]
                      ).map((val, idx) => (
                        <button
                          key={`${val}-${idx}`}
                          type="button"
                          onClick={() => setPointsSpent(String(val))}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-amber-50 border border-slate-200 dark:border-slate-700 text-[11px] font-black text-[#0B1F3A] dark:text-slate-200 tabular-nums cursor-pointer"
                        >
                          {idx === 3 ? `الرصيد الكامل (${val})` : `${val} ${unitLabel}`}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-1 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-amber-900 dark:text-amber-200">
                        قيمة الخصم التقديرية على الفاتورة:
                      </span>
                      <span className="font-black text-amber-800 dark:text-[#FBBF24] text-sm tabular-nums">
                        -{computedRedeemDiscount} {store?.currency || 'SAR'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-amber-800/80 dark:text-amber-300/80 font-bold">
                      <span>الصافي المطلوب دفعه بعد الخصم:</span>
                      <span className="tabular-nums font-black">
                        {Math.max(0, (Number(redeemInvoiceAmount) || 0) - computedRedeemDiscount)}{' '}
                        {store?.currency || 'SAR'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] text-xs font-black shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer min-h-[46px]"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>مراجعة تفاصيل الخصم قبل التأكيد</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
              )}
            </form>

            {/* Offline queue banner */}
            {offlineQueue.length > 0 && (
              <div className="p-5 rounded-3xl glass-card border-amber-300 dark:border-amber-500/40 bg-amber-50/70 dark:bg-amber-950/30 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 text-xs font-black">
                    <CloudOff className="w-4 h-4" />
                    <span>العمليات المحفوظة دون اتصال ({offlineQueue.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSyncOfflineQueue}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] text-xs font-black cursor-pointer"
                  >
                    مزامنة الكل الآن
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Branch History (السجل) */}
          <div
            className={`lg:col-span-5 ${
              mobileSection === 'terminal' ? 'hidden lg:block' : 'block'
            }`}
          >
            <div className="p-6 rounded-3xl glass-card space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-base font-black text-[#0B1F3A] dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#0284C7] dark:text-[#00C2FF]" />
                  سجل عمليات الفرع ({transactions.length})
                </h2>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="بحث برقم الفاتورة أو اسم العميل..."
                  className="w-full pr-9 pl-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>

              <div className="space-y-3 max-h-[540px] overflow-y-auto pl-1">
                {filteredTransactions.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    لا توجد عمليات مطابقة للبحث.
                  </p>
                ) : (
                  filteredTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-[#0284C7] dark:text-[#00C2FF] font-black">
                            {tx.invoiceNumber}
                          </span>
                          <span className="text-xs font-black text-[#0B1F3A] dark:text-white truncate">
                            {tx.customerName}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium tabular-nums">
                          {tx.amount > 0 ? `الفاتورة: ${tx.amount} ${tx.currency} · ` : ''}
                          {tx.discountGiven ? `خصم: ${tx.discountGiven} ${tx.currency} · ` : ''}
                          النقاط:{' '}
                          <strong
                            className={
                              tx.pointsEarned >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }
                          >
                            {tx.pointsEarned > 0 ? `+${tx.pointsEarned}` : tx.pointsEarned}
                          </strong>
                        </div>
                      </div>

                      {!tx.refundRequested ? (
                        <button
                          type="button"
                          onClick={() => handleRequestRefund(tx.id)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[#0B1F3A] dark:text-slate-200 text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          طلب استرجاع
                        </button>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] font-black shrink-0">
                          قيد المراجعة
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
        )}
      </main>

      {/* Pre-Confirmation Preview Modal (يظهر تفاصيل الخصم أو الإضافة قبل التأكيد النهائي) */}
      {pendingConfirmation && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0f1b30] rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-sky-200 dark:border-slate-700 text-right">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    pendingConfirmation.actionMode === 'redeem_points'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                      : 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-[#00C2FF]'
                  }`}
                >
                  {pendingConfirmation.actionMode === 'redeem_points' ? (
                    <Gift className="w-5 h-5" />
                  ) : (
                    <PlusCircle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0B1F3A] dark:text-white">
                    {pendingConfirmation.actionMode === 'redeem_points'
                      ? 'معاينة تفاصيل الخصم وصرف النقاط'
                      : 'معاينة تفاصيل الفاتورة وإضافة النقاط'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                    راجع كافة البيانات التالية بعناية قبل التأكيد النهائي
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingConfirmation(null)}
                className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 p-4 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-bold">العميل:</span>
                <span className="font-black text-[#0B1F3A] dark:text-white">
                  {pendingConfirmation.customerName} ({pendingConfirmation.customerCode})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-bold">الفرع:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {pendingConfirmation.branchName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-bold">رقم الفاتورة:</span>
                <span className="font-mono font-black text-sky-700 dark:text-[#00C2FF]">
                  {pendingConfirmation.invoiceNumber}
                </span>
              </div>
              {pendingConfirmation.invoiceAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-bold">
                    قيمة الفاتورة:
                  </span>
                  <span className="font-black tabular-nums">
                    {pendingConfirmation.invoiceAmount} {pendingConfirmation.currency}
                  </span>
                </div>
              )}

              {pendingConfirmation.actionMode === 'redeem_points' && (
                <>
                  {pendingConfirmation.voucherTitle && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400 font-bold">
                        القسيمة المستخدمة:
                      </span>
                      <span className="font-black text-emerald-700 dark:text-emerald-400">
                        {pendingConfirmation.voucherTitle} ({pendingConfirmation.voucherCode})
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-bold">
                      قيمة الخصم الممنوح:
                    </span>
                    <span className="font-black text-rose-600 dark:text-rose-400 tabular-nums">
                      -{pendingConfirmation.discountValue} {pendingConfirmation.currency}
                    </span>
                  </div>
                  {pendingConfirmation.invoiceAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400 font-bold">
                        صافي الفاتورة المطلوب سداده:
                      </span>
                      <span className="font-black text-emerald-700 dark:text-emerald-300 text-sm tabular-nums">
                        {pendingConfirmation.netInvoiceAmount} {pendingConfirmation.currency}
                      </span>
                    </div>
                  )}
                </>
              )}

              <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700 grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                    الرصيد الحالي
                  </span>
                  <span className="font-black text-sm tabular-nums">
                    {pendingConfirmation.currentBalance}
                  </span>
                </div>
                <div
                  className={`p-2.5 rounded-xl border ${
                    pendingConfirmation.pointsDelta >= 0
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-700 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  <span className="text-[10px] block font-bold">
                    {pendingConfirmation.pointsDelta >= 0 ? 'المضاف' : 'المخصوم'}
                  </span>
                  <span className="font-black text-sm tabular-nums">
                    {pendingConfirmation.pointsDelta > 0
                      ? `+${pendingConfirmation.pointsDelta}`
                      : pendingConfirmation.pointsDelta}{' '}
                    {pendingConfirmation.unitLabel}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-[#00C2FF]">
                  <span className="text-[10px] block font-bold">الرصيد بعد العملية</span>
                  <span className="font-black text-sm tabular-nums">
                    {pendingConfirmation.projectedBalance}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={submittingTx}
                onClick={handleConfirmExecute}
                className={`flex-1 py-3.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 ${
                  pendingConfirmation.actionMode === 'redeem_points'
                    ? 'bg-gradient-gold-cta text-[#0B1F3A] shadow-md shadow-amber-500/20'
                    : 'bg-gradient-electric text-white shadow-md shadow-sky-500/20'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {submittingTx
                    ? 'جاري التنفيذ...'
                    : offlineMode
                    ? 'تأكيد الحفظ بدون اتصال'
                    : 'تأكيد نهائي وتنفيذ العملية'}
                </span>
              </button>
              <button
                type="button"
                disabled={submittingTx}
                onClick={() => setPendingConfirmation(null)}
                className="px-4 py-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                تعديل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Barcode Scanner Modal */}
      {scannerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0f1b30] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-sky-200 dark:border-slate-700 text-right">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-[#0B1F3A] dark:text-white flex items-center gap-2">
                <ScanLine className="w-5 h-5 text-[#0284C7] dark:text-[#00C2FF]" />
                <span>ماسح باركود و QR العميل</span>
              </h3>
              <button
                type="button"
                onClick={handleCloseScanner}
                className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-700 flex items-center justify-center">
              <video
                ref={videoRef}
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              {scannerError && (
                <div className="absolute inset-0 bg-slate-900/90 p-4 flex flex-col items-center justify-center text-center gap-2">
                  <Camera className="w-8 h-8 text-amber-400" />
                  <p className="text-xs text-slate-200 leading-relaxed">{scannerError}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSimulateQrScan}
                className="flex-1 py-3 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                <span>محاكاة مسح فوري الآن</span>
              </button>
              <button
                type="button"
                onClick={handleCloseScanner}
                className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
