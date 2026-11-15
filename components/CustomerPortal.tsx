'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  CustomerCard,
  CustomerNotificationPrefs,
  CustomerProfile,
  DigitalVoucher,
  GeofenceAlert,
  OnlineOrder,
  Store,
  SupportTicket,
  Transaction,
} from '@/lib/types';
import GeoAlertBanner from '@/components/GeoAlertBanner';
import GeoAlertsDrawer from '@/components/GeoAlertsDrawer';
import CustomerGeoOffersTab from '@/components/CustomerGeoOffersTab';
import OnlineOrderingModal from '@/components/OnlineOrderingModal';
import {
  calculateDistanceMeters,
  formatDistanceArabic,
  GEO_PRESET_LOCATIONS,
  playGeofenceAlertChime,
  scanGeofenceAlerts,
  triggerHapticFeedback,
} from '@/lib/geolocationAlerts';
import { AR_TRANSLATIONS, formatCurrency } from '@/lib/i18n/ar';
import {
  getCardPatternConfig,
  getCardSpacingConfig,
  isLightCardTextColor,
  resolveCardCssGradient,
  resolveCardGradientClass,
  resolveCardTextStyle,
} from '@/lib/cardDesignLibrary';
import {
  buildAccountCardPassOptions,
  buildCardPassOptions,
  buildVoucherPassOptions,
  generatePassDataUrl,
  PASS_THEME_PRESETS,
  type PassDownloadOptions,
  type PassVisualThemeId,
} from '@/lib/passImageGenerator';
import { isStoreSubscriptionPaused, SMART_PAUSE_NOTICE } from '@/lib/subscriptionStatus';
import { StampShapeIcon } from '@/components/StampShapeIcon';
import { OfflineIndicator, PWAInstallButton } from '@/components/PWAInstallBanner';
import {
  ArrowLeftRight,
  Award,
  Bell,
  CheckCircle2,
  Clock,
  Coins,
  Compass,
  Copy,
  CreditCard,
  Crown,
  Download,
  ExternalLink,
  Filter,
  Gift,
  Heart,
  Home,
  Lock,
  LogOut,
  MapPin,
  MessageSquareWarning,
  PhoneCall,
  QrCode,
  RefreshCw,
  Search,
  Send,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stamp,
  Ticket,
  Trash2,
  Truck,
  ShoppingBag,
  MessageCircle,
  User,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface NetworkRulesView {
  sameStore100PtsSar: number;
  crossStore100PtsSar: number;
}

export type CustomerPatchPayload = Omit<Partial<CustomerProfile>, 'notificationPrefs'> & {
  rotateQr?: boolean;
  lostPhone?: boolean;
  requestOtp?: boolean;
  verifyOtpCode?: string;
  followStoreId?: string;
  unfollowStoreId?: string;
  notificationPrefs?: Partial<CustomerNotificationPrefs>;
  accountAction?: 'share_to_store' | 'gift_to_user' | 'convert_to_voucher';
  points?: number;
  targetStoreId?: string;
  recipient?: string;
  note?: string;
};

interface CustomerPortalProps {
  customer: CustomerProfile;
  stores: Store[];
  transactions: Transaction[];
  tickets: SupportTicket[];
  networkRules: NetworkRulesView;
  onOpenStore: (storeId: string) => void;
  onUpdateCustomer: (patch: CustomerPatchPayload) => Promise<{ ok?: boolean; sessionRevoked?: boolean; error?: string }>;
  onRedeemVoucher: (payload: {
    storeId: string;
    pointsCost: number;
    valueAmount: number;
    title: string;
    merchantVoucherId?: string;
    confirmedSecondStep: boolean;
  }) => Promise<{
    ok: boolean;
    error?: string;
    requiresPhoneVerification?: boolean;
    requiresSecondConfirmation?: boolean;
    voucher?: DigitalVoucher;
  }>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  onAnonymizeAccount: () => Promise<{ ok: boolean; error?: string }>;
  onAddTicket: (payload: { subject: string; invoiceRef?: string; message: string }) => Promise<void>;
  onLogoutAll: () => Promise<void>;
}

const OFFLINE_QR_STORAGE_KEY = 'aada_last_valid_qr_v1';

interface CachedQrRecord {
  token: string;
  signature: string;
  expiresAt: number;
  savedAtLabel: string;
}

function normalizeArabicText(value: string): string {
  return value
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim()
    .toLowerCase();
}

export default function CustomerPortal({
  customer,
  stores,
  transactions,
  tickets,
  networkRules,
  onOpenStore,
  onUpdateCustomer,
  onRedeemVoucher,
  onChangePassword,
  onAnonymizeAccount,
  onAddTicket,
  onLogoutAll,
}: CustomerPortalProps) {
  const [activeTab, setActiveTab] = useState<
    'home' | 'cards' | 'vouchers' | 'explore' | 'rewards' | 'account' | 'geo_radar' | 'orders'
  >('home');
  const [cardsPointsStoreFilter, setCardsPointsStoreFilter] = useState<string>('الكل');
  const [walletSystemFilter, setWalletSystemFilter] = useState<
    'all' | 'account_master' | 'store_stamps' | 'store_points'
  >('all');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [walletAddedId, setWalletAddedId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [nearbyCityFilter, setNearbyCityFilter] = useState('الكل');
  const [categoryFilter, setCategoryFilter] = useState('الكل');
  const [toastMsg, setToastMsg] = useState('');
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');

  // Geolocation & Geofencing Alerts State
  const defaultGeoPreset = GEO_PRESET_LOCATIONS[0];
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>({
    lat: defaultGeoPreset.lat,
    lng: defaultGeoPreset.lng,
  });
  const [userLocationName, setUserLocationName] = useState(defaultGeoPreset.name.split('—')[0].trim());
  const [isGpsActive, setIsGpsActive] = useState(false);
  const [geoSoundEnabled, setGeoSoundEnabled] = useState(
    customer.notificationPrefs?.geoSoundEnabled ?? true
  );
  const [geoRadiusMeters, setGeoRadiusMeters] = useState(
    customer.notificationPrefs?.geoRadiusMeters || 3000
  );
  const [bannerAlert, setBannerAlert] = useState<GeofenceAlert | null>(null);
  const [isAlertsDrawerOpen, setIsAlertsDrawerOpen] = useState(false);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(new Set());
  const [readAlertIds, setReadAlertIds] = useState<Set<string>>(new Set());

  // 3-Card System: Account Master Card Modal & Fast Phone Pass Saver Modal
  const [accountModalMode, setAccountModalMode] = useState<
    'share_to_store' | 'gift_to_user' | 'convert_to_voucher' | null
  >(null);
  const [accountActionPoints, setAccountActionPoints] = useState<number>(50);
  const [accountTargetStoreId, setAccountTargetStoreId] = useState<string>(
    stores[0]?.id || 'store-1'
  );
  const [accountGiftRecipient, setAccountGiftRecipient] = useState<string>('');
  const [accountActionNote, setAccountActionNote] = useState<string>('');
  const [accountActionSubmitting, setAccountActionSubmitting] = useState<boolean>(false);

  const [phonePassPreview, setPhonePassPreview] = useState<{
    title: string;
    subtitle: string;
    code: string;
    dataUrl: string;
    fileName: string;
    baseOptions?: PassDownloadOptions;
    selectedTheme?: PassVisualThemeId;
  } | null>(null);
  const [generatingPass, setGeneratingPass] = useState<boolean>(false);

  // Offline QR cache & live countdown state
  const [cachedQr, setCachedQr] = useState<CachedQrRecord | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(customer.qrExpiresInSeconds || 90);
  const [isOffline, setIsOffline] = useState(false);
  const autoRotatingRef = useRef(false);

  // Personal info & real password change
  const [editFirstName, setEditFirstName] = useState(customer.firstName);
  const [editLastName, setEditLastName] = useState(customer.lastName);
  const [editEmail, setEditEmail] = useState(customer.email);
  const [editPhone, setEditPhone] = useState(customer.phone);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordStatusMsg, setPasswordStatusMsg] = useState('');

  // Progressive OTP modal & state
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpInput, setOtpInput] = useState('');

  // High-value 2nd confirmation modal for voucher redemption
  const [pendingRedemption, setPendingRedemption] = useState<{
    storeId: string;
    storeName: string;
    pointsCost: number;
    valueAmount: number;
    title: string;
    merchantVoucherId?: string;
  } | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  // Emergency Lost Phone & Account Anonymization Modals
  const [showLostPhoneModal, setShowLostPhoneModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Online Store & Orders State
  const [orderingStore, setOrderingStore] = useState<Store | null>(null);
  const [customerOrders, setCustomerOrders] = useState<OnlineOrder[]>([]);

  const loadCustomerOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.orders)) {
          setCustomerOrders(data.orders);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadCustomerOrders();
  }, [loadCustomerOrders]);

  // Filtered Transaction History in Account Tab
  const [txSearch, setTxSearch] = useState('');
  const [txStoreFilter, setTxStoreFilter] = useState('الكل');
  const [txTypeFilter, setTxTypeFilter] = useState<'الكل' | Transaction['type']>('الكل');

  // Support Dispute
  const disputeSectionRef = useRef<HTMLDivElement | null>(null);
  const [disputeSubject, setDisputeSubject] = useState('');
  const [disputeInvoice, setDisputeInvoice] = useState('');
  const [disputeMsg, setDisputeMsg] = useState('');

  const showToast = (msg: string, tone: 'success' | 'error' = 'success') => {
    setToastMsg(msg);
    setToastTone(tone);
    setTimeout(() => setToastMsg((prev) => (prev === msg ? '' : prev)), 4000);
  };

  // Derived total points calculated strictly from per-store point card ledgers
  const derivedTotalPoints = useMemo(() => {
    return customer.cards.reduce(
      (sum, c) => (c.rule.type === 'points' ? sum + c.currentBalance : sum),
      0
    );
  }, [customer.cards]);

  // Derived nearby geofenced alerts and offers
  const rawGeoAlerts = useMemo(() => {
    return scanGeofenceAlerts(userCoords, stores, customer, geoRadiusMeters);
  }, [userCoords, stores, customer, geoRadiusMeters]);

  const geoAlerts = useMemo(() => {
    return rawGeoAlerts
      .filter((a) => !dismissedAlertIds.has(a.id))
      .map((a) => ({ ...a, isRead: a.isRead || readAlertIds.has(a.id) }));
  }, [rawGeoAlerts, dismissedAlertIds, readAlertIds]);

  const unreadGeoAlertsCount = useMemo(() => {
    return geoAlerts.filter((a) => !a.isRead).length;
  }, [geoAlerts]);

  // Initial welcome proximity toast when customer opens portal
  const initialGeoAlertTriggered = useRef(false);
  useEffect(() => {
    if (initialGeoAlertTriggered.current) return;
    if (rawGeoAlerts.length > 0) {
      initialGeoAlertTriggered.current = true;
      const timer = setTimeout(() => {
        const top = rawGeoAlerts[0];
        if (top) {
          setBannerAlert(top);
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [rawGeoAlerts]);

  // Simulate entering a branch zone
  const handleSimulateWalkInNearStore = (storeId?: string) => {
    const target = storeId
      ? rawGeoAlerts.find((a) => a.storeId === storeId) || rawGeoAlerts[0]
      : rawGeoAlerts[0];
    if (!target) {
      showToast('لا توجد فروع قريبة حالياً للمحاكاة', 'error');
      return;
    }
    const simulated = {
      ...target,
      distanceMeters: 75,
      distanceText: '75 متر',
      title: `📍 اقتربت الآن من ${target.branchName}!`,
      message: `أنت في نطاق الدخول المباشر لمتجر ${target.storeName}. عروضك ونقاطك جاهزة للاستخدام الآن.`,
    };
    if (geoSoundEnabled) {
      playGeofenceAlertChime();
    }
    triggerHapticFeedback();
    setBannerAlert(simulated);
  };

  // Persist latest valid AP1 QR token into localStorage for offline cashier display
  useEffect(() => {
    if (typeof window === 'undefined' || !customer.qrCodeToken) return;
    const record: CachedQrRecord = {
      token: customer.qrCodeToken,
      signature: customer.qrSignature,
      expiresAt: customer.qrExpiresAt || Math.floor(Date.now() / 1000) + 90,
      savedAtLabel: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    };
    try {
      window.localStorage.setItem(OFFLINE_QR_STORAGE_KEY, JSON.stringify(record));
    } catch {
      // Ignore quota errors
    }
  }, [customer.qrCodeToken, customer.qrSignature, customer.qrExpiresAt]);

  // Sync offline status, load cached QR on mount, and run live auto-rotation countdown
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const loadOfflineState = () => {
      setIsOffline(!navigator.onLine);
      try {
        const raw = window.localStorage.getItem(OFFLINE_QR_STORAGE_KEY);
        if (raw) {
          setCachedQr(JSON.parse(raw) as CachedQrRecord);
        }
      } catch {
        // Ignore parse errors
      }
    };

    const initTimer = setTimeout(loadOfflineState, 0);
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const interval = setInterval(() => {
      const targetExp = customer.qrExpiresAt || 0;
      const nowSec = Math.floor(Date.now() / 1000);
      const remaining = targetExp > nowSec ? targetExp - nowSec : 0;
      setSecondsLeft(remaining);

      if (remaining <= 2 && navigator.onLine && !autoRotatingRef.current) {
        autoRotatingRef.current = true;
        onUpdateCustomer({ rotateQr: true }).finally(() => {
          setTimeout(() => {
            autoRotatingRef.current = false;
          }, 2500);
        });
      }
    }, 1000);

    return () => {
      clearTimeout(initTimer);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(interval);
    };
  }, [customer.qrExpiresAt, onUpdateCustomer]);

  const activeQrToken = isOffline
    ? cachedQr?.token || customer.qrCodeToken
    : customer.qrCodeToken || cachedQr?.token || '';

  const followedStores = useMemo(
    () => stores.filter((s) => customer.followedStoreIds?.includes(s.id)),
    [stores, customer.followedStoreIds]
  );

  const featuredOffers = useMemo(() => {
    return stores.flatMap((store) =>
      store.menu
        .filter((m) => m.type === 'offer' && m.available)
        .map((offer) => ({ store, offer }))
    );
  }, [stores]);

  const activeAlerts = useMemo(() => {
    const prefs = customer.notificationPrefs;
    return (customer.expiringPointsAlerts || []).filter((alert) => {
      if (alert.daysLeft <= 3 && !prefs?.expiry3DayAlert) return false;
      if (alert.daysLeft > 3 && !prefs?.expiry14DayAlert) return false;
      return true;
    });
  }, [customer.expiringPointsAlerts, customer.notificationPrefs]);

  const rewardCatalog = useMemo(() => {
    const ready: Array<{
      id: string;
      store: Store;
      title: string;
      pointsCost: number;
      valueAmount: number;
      currentBalance: number;
      unit: 'points' | 'stamps';
    }> = [];
    const locked: Array<{
      id: string;
      store: Store;
      title: string;
      pointsCost: number;
      valueAmount: number;
      currentBalance: number;
      unit: 'points' | 'stamps';
      progressPct: number;
    }> = [];

    for (const card of customer.cards) {
      const store = stores.find((s) => s.id === card.storeId || s.merchantId === card.merchantId);
      if (!store) continue;

      if (card.rule.type === 'points') {
        const discountTier = {
          id: `${card.id}-tier-100`,
          store,
          title: `خصم ${formatCurrency(networkRules.sameStore100PtsSar, store.currency)} — ${store.name}`,
          pointsCost: 100,
          valueAmount: networkRules.sameStore100PtsSar,
        };
        const premiumTier = {
          id: `${card.id}-tier-1000`,
          store,
          title: `مكافأة VIP كبرى (${formatCurrency(150, store.currency)}) — ${store.name}`,
          pointsCost: 1000,
          valueAmount: 150,
        };

        for (const tier of [discountTier, premiumTier]) {
          if (card.currentBalance >= tier.pointsCost) {
            ready.push({ ...tier, currentBalance: card.currentBalance, unit: 'points' });
          } else {
            locked.push({
              ...tier,
              currentBalance: card.currentBalance,
              unit: 'points',
              progressPct: Math.min(99, Math.round((card.currentBalance / tier.pointsCost) * 100)),
            });
          }
        }
      } else {
        const stampsReq = card.rule.stampsRequired || 6;
        if (card.currentBalance >= stampsReq) {
          ready.push({
            id: `${card.id}-stamp-reward`,
            store,
            title: `${card.rule.rewardDescription || 'مكافأة الأختام المجانية'} — ${store.name}`,
            pointsCost: stampsReq,
            valueAmount: 35,
            currentBalance: card.currentBalance,
            unit: 'stamps',
          });
        } else {
          locked.push({
            id: `${card.id}-stamp-locked`,
            store,
            title: `${card.rule.rewardDescription || 'مكافأة الأختام'} — ${store.name}`,
            pointsCost: stampsReq,
            valueAmount: 35,
            currentBalance: card.currentBalance,
            unit: 'stamps',
            progressPct: Math.min(99, Math.round((card.currentBalance / stampsReq) * 100)),
          });
        }
      }
    }

    // Sort locked rewards so the closest to completion (قرب يستلمها) appear first
    locked.sort((a, b) => b.progressPct - a.progressPct);

    return { ready, locked };
  }, [customer.cards, stores, networkRules.sameStore100PtsSar]);

  const receivedRewards = useMemo(() => {
    const redeemedTxIds = new Set<string>();
    const fromRedemptions = transactions
      .filter((t) => t.type === 'redemption')
      .map((t) => {
        redeemedTxIds.add(t.invoiceNumber);
        return {
          id: t.id,
          storeName: t.storeName,
          title: t.notes || `استبدال مكافأة (${t.invoiceNumber})`,
          code: t.invoiceNumber,
          pointsUsed: Math.abs(t.pointsSpent || t.pointsEarned),
          valueAmount: t.discountGiven || t.amount || 0,
          currency: t.currency,
          dateLabel: t.timestamp,
          statusLabel: 'تم الاستلام والصرف ✓',
        };
      });

    const fromVouchers = (customer.vouchers || [])
      .filter((v) => !redeemedTxIds.has(v.code))
      .map((v) => ({
        id: `vch-rec-${v.id}`,
        storeName: v.storeName,
        title: v.title,
        code: v.code,
        pointsUsed: v.pointsCost,
        valueAmount: v.valueAmount,
        currency: v.currency,
        dateLabel: v.createdAt,
        statusLabel: v.status === 'used' ? 'تم الاستخدام ✓' : 'قسيمة مستلمة (فعالة)',
      }));

    return [...fromVouchers, ...fromRedemptions];
  }, [transactions, customer.vouchers]);

  const availableMerchantVouchers = useMemo(() => {
    return stores.flatMap((store) => {
      if (isStoreSubscriptionPaused(store)) return [];
      return (store.vouchers || [])
        .filter(
          (v) =>
            v.active &&
            v.usedCount < v.usageLimit &&
            (v.audienceType !== 'specific' || (v.targetCustomerIds || []).includes(customer.id))
        )
        .map((voucher) => {
          const card = customer.cards.find(
            (c) => c.storeId === store.id || c.merchantId === store.merchantId
          );
          const currentBalance = card?.currentBalance ?? 0;
          const canRedeemNow = voucher.pointsCost <= 0 || currentBalance >= voucher.pointsCost;
          return {
            store,
            voucher,
            currentBalance,
            canRedeemNow,
          };
        });
    });
  }, [stores, customer.cards, customer.id]);

  const cardPointsLedger = useMemo(() => {
    if (cardsPointsStoreFilter === 'الكل') return transactions;
    return transactions.filter((tx) => tx.storeId === cardsPointsStoreFilter);
  }, [transactions, cardsPointsStoreFilter]);

  const filteredTransactions = useMemo(() => {
    const q = normalizeArabicText(txSearch);
    return transactions.filter((tx) => {
      if (txStoreFilter !== 'الكل' && tx.storeId !== txStoreFilter) return false;
      if (txTypeFilter !== 'الكل' && tx.type !== txTypeFilter) return false;
      if (!q) return true;
      return (
        normalizeArabicText(tx.invoiceNumber).includes(q) ||
        normalizeArabicText(tx.storeName).includes(q) ||
        normalizeArabicText(tx.branchName).includes(q)
      );
    });
  }, [transactions, txSearch, txStoreFilter, txTypeFilter]);

  const filteredExploreStores = useMemo(() => {
    const q = normalizeArabicText(searchFilter);
    return stores.filter((s) => {
      if (nearbyCityFilter !== 'الكل' && s.city !== nearbyCityFilter) return false;
      if (categoryFilter !== 'الكل' && s.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        normalizeArabicText(s.name).includes(q) ||
        normalizeArabicText(s.category).includes(q) ||
        normalizeArabicText(s.area).includes(q) ||
        normalizeArabicText(s.description).includes(q)
      );
    });
  }, [stores, nearbyCityFilter, categoryFilter, searchFilter]);

  const selectedCard = useMemo(
    () => customer.cards.find((c) => c.id === selectedCardId) || null,
    [customer.cards, selectedCardId]
  );
  const selectedCardStore = useMemo(
    () => (selectedCard ? stores.find((s) => s.id === selectedCard.storeId) || null : null),
    [selectedCard, stores]
  );

  const handleCopyText = async (val: string, label: string) => {
    try {
      await navigator.clipboard.writeText(val);
      showToast(`تم نسخ ${label} إلى الحافظة`);
    } catch {
      showToast(`يمكنك النسخ يدوياً: ${val}`, 'error');
    }
  };

  const handleToggleFollow = async (storeId: string) => {
    const isFollowed = customer.followedStoreIds?.includes(storeId);
    await onUpdateCustomer(isFollowed ? { unfollowStoreId: storeId } : { followStoreId: storeId });
    showToast(isFollowed ? 'تم إلغاء متابعة المتجر' : 'تمت متابعة المتجر لتصلك أحدث عروضه');
  };

  const handleOpenCardPhonePass = async (card: CustomerCard) => {
    setGeneratingPass(true);
    try {
      const storeObj = stores.find((s) => s.id === card.storeId);
      const holderName = `${customer.firstName} ${customer.lastName}`.trim() || customer.username;
      const opts: PassDownloadOptions = {
        ...buildCardPassOptions(
          card,
          holderName,
          customer.qrCodeToken || customer.referralCode,
          storeObj?.wifiPassword
        ),
        cityText: storeObj?.city,
      };
      const dataUrl = await generatePassDataUrl(opts);
      setWalletAddedId(card.id);
      confetti({ particleCount: 55, spread: 55, origin: { y: 0.6 } });
      setPhonePassPreview({
        title: card.cardName || `بطاقة ${card.storeName}`,
        subtitle:
          card.rule.type === 'stamps'
            ? `بطاقة أختام المتجر (${card.currentBalance} / ${card.rule.stampsRequired || 6} أختام)`
            : `بطاقة نقاط المتجر (${card.currentBalance} نقطة)`,
        dataUrl,
        fileName: `aadapass-card-${card.storeId}.png`,
        code: `${customer.referralCode}-${card.storeId.toUpperCase()}`,
        baseOptions: opts,
        selectedTheme: 'auto',
      });
    } catch {
      showToast('تعذر تجهيز البطاقة للهاتف حالياً', 'error');
    } finally {
      setGeneratingPass(false);
    }
  };

  const handleOpenAccountPhonePass = async () => {
    setGeneratingPass(true);
    try {
      const holderName = `${customer.firstName} ${customer.lastName}`.trim() || customer.username;
      const opts = buildAccountCardPassOptions({
        holderName,
        username: customer.username,
        accountPoints: customer.accountPointsBalance ?? 350,
        totalStorePoints: derivedTotalPoints,
        qrToken: customer.qrCodeToken || customer.referralCode,
        referralCode: customer.referralCode,
        themeId: 'gold_vip',
      });
      const dataUrl = await generatePassDataUrl(opts);
      confetti({ particleCount: 65, spread: 60, origin: { y: 0.6 } });
      setPhonePassPreview({
        title: 'بطاقة الحساب الشاملة (Aada Pass VIP)',
        subtitle: `رصيد الحساب القابل للمشاركة والإهداء: ${customer.accountPointsBalance ?? 350} نقطة`,
        dataUrl,
        fileName: `aadapass-account-${customer.referralCode}.png`,
        code: customer.accountCardCode || `AADA-VIP-${customer.referralCode}`,
        baseOptions: opts,
        selectedTheme: 'gold_vip',
      });
    } catch {
      showToast('تعذر تجهيز بطاقة الحساب حالياً', 'error');
    } finally {
      setGeneratingPass(false);
    }
  };

  const handleOpenVoucherPhonePass = async (voucher: DigitalVoucher) => {
    setGeneratingPass(true);
    try {
      const holderName = `${customer.firstName} ${customer.lastName}`.trim() || customer.username;
      const opts = buildVoucherPassOptions(voucher, holderName, 'emerald_luxury');
      const dataUrl = await generatePassDataUrl(opts);
      confetti({ particleCount: 60, spread: 55, origin: { y: 0.6 } });
      setPhonePassPreview({
        title: `قسيمة ${voucher.storeName}`,
        subtitle: `${voucher.title} — القيمة: ${formatCurrency(voucher.valueAmount, voucher.currency)}`,
        dataUrl,
        fileName: `aadapass-voucher-${voucher.code}.png`,
        code: voucher.code,
        baseOptions: opts,
        selectedTheme: 'emerald_luxury',
      });
    } catch {
      showToast('تعذر تجهيز القسيمة للهاتف حالياً', 'error');
    } finally {
      setGeneratingPass(false);
    }
  };

  const handleSwitchPassTheme = async (themeId: PassVisualThemeId) => {
    if (!phonePassPreview?.baseOptions) return;
    try {
      const nextOpts: PassDownloadOptions = {
        ...phonePassPreview.baseOptions,
        themeId,
      };
      const nextDataUrl = await generatePassDataUrl(nextOpts);
      setPhonePassPreview((prev) =>
        prev
          ? {
              ...prev,
              dataUrl: nextDataUrl,
              baseOptions: nextOpts,
              selectedTheme: themeId,
            }
          : null
      );
    } catch {
      showToast('تعذر تغيير نمط البطاقة', 'error');
    }
  };

  const handleDownloadPhonePass = () => {
    if (!phonePassPreview?.dataUrl) return;
    const link = document.createElement('a');
    link.href = phonePassPreview.dataUrl;
    link.download = phonePassPreview.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('تم حفظ البطاقة/القسيمة في جهازك بنجاح بجودة عالية!');
  };

  const handleSharePhonePass = async () => {
    if (!phonePassPreview?.dataUrl) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        const res = await fetch(phonePassPreview.dataUrl);
        const blob = await res.blob();
        const file = new File([blob], phonePassPreview.fileName, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: phonePassPreview.title,
            text: `${phonePassPreview.title} — ${phonePassPreview.subtitle}`,
            files: [file],
          });
          showToast('تمت مشاركة البطاقة بنجاح!');
          return;
        }
        await navigator.share({
          title: phonePassPreview.title,
          text: `${phonePassPreview.title} — كود: ${phonePassPreview.code}`,
        });
        return;
      }
      handleDownloadPhonePass();
    } catch {
      handleDownloadPhonePass();
    }
  };

  const handleSubmitAccountAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountModalMode) return;
    if (accountActionPoints <= 0) {
      showToast('يرجى تحديد عدد نقاط صحيح أكبر من الصفر', 'error');
      return;
    }
    setAccountActionSubmitting(true);
    const res = await onUpdateCustomer({
      accountAction: accountModalMode,
      points: accountActionPoints,
      targetStoreId: accountTargetStoreId,
      recipient: accountGiftRecipient.trim(),
      note: accountActionNote.trim(),
    });
    setAccountActionSubmitting(false);
    if (res.ok) {
      confetti({ particleCount: 75, spread: 65, origin: { y: 0.6 } });
      showToast('تم تنفيذ العملية على بطاقة الحساب بنجاح!');
      setAccountModalMode(null);
      setAccountActionNote('');
    } else {
      showToast(res.error || 'تعذر إتمام العملية على بطاقة الحساب', 'error');
    }
  };

  const handleTriggerRedeem = async (
    item: (typeof rewardCatalog.ready)[number] & { merchantVoucherId?: string }
  ) => {
    if (isStoreSubscriptionPaused(item.store)) {
      showToast(SMART_PAUSE_NOTICE.customerSubtitle, 'error');
      return;
    }
    if (!customer.phoneVerified) {
      setOtpRequested(true);
      await onUpdateCustomer({ requestOtp: true });
      setActiveTab('account');
      showToast('يجب توثيق رقم جوالك عبر رمز OTP قبل أول عملية استبدال مكافأة.', 'error');
      return;
    }

    if (item.pointsCost >= 100) {
      setPendingRedemption({
        storeId: item.store.id,
        storeName: item.store.name,
        pointsCost: item.pointsCost,
        valueAmount: item.valueAmount,
        title: item.title,
        merchantVoucherId: item.merchantVoucherId,
      });
      return;
    }

    setRedeeming(true);
    const res = await onRedeemVoucher({
      storeId: item.store.id,
      pointsCost: item.pointsCost,
      valueAmount: item.valueAmount,
      title: item.title,
      merchantVoucherId: item.merchantVoucherId,
      confirmedSecondStep: true,
    });
    setRedeeming(false);

    if (res.ok) {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      showToast(`تم إصدار القسيمة الرقمية (${res.voucher?.code}) بنجاح!`);
    } else {
      showToast(res.error || 'تعذر استبدال المكافأة', 'error');
    }
  };

  const handleConfirmHighValueRedeem = async () => {
    if (!pendingRedemption) return;
    setRedeeming(true);
    const res = await onRedeemVoucher({
      storeId: pendingRedemption.storeId,
      pointsCost: pendingRedemption.pointsCost,
      valueAmount: pendingRedemption.valueAmount,
      title: pendingRedemption.title,
      merchantVoucherId: pendingRedemption.merchantVoucherId,
      confirmedSecondStep: true,
    });
    setRedeeming(false);
    setPendingRedemption(null);

    if (res.ok) {
      confetti({ particleCount: 75, spread: 65, origin: { y: 0.6 } });
      showToast(`تم تأكيد الاستبدال وإصدار القسيمة (${res.voucher?.code})!`);
    } else if (res.requiresPhoneVerification) {
      setOtpRequested(true);
      setActiveTab('account');
      showToast(res.error || 'مطلوب توثيق الهاتف عبر OTP أولاً.', 'error');
    } else {
      showToast(res.error || 'تعذر إصدار القسيمة', 'error');
    }
  };

  const handleEnableWebPush = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showToast('متصفحك الحالي لا يدعم إشعارات Web Push.', 'error');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      showToast('لم يتم منح إذن الإشعارات من المتصفح.', 'error');
      return;
    }

    await onUpdateCustomer({ notificationPrefs: { pushSubscribed: true } });

    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification('Aada Pass - عادة باس', {
          body: 'تم تفعيل تنبيهات المكافآت الفورية وانتهاء النقاط بنجاح!',
          icon: '/pwa-192x192.png',
          dir: 'rtl',
          lang: 'ar',
        });
      } catch {
        new Notification('Aada Pass - عادة باس', {
          body: 'تم تفعيل تنبيهات المكافآت وانتهاء النقاط!',
          icon: '/pwa-192x192.png',
        });
      }
    }
    showToast('تم تفعيل إشعارات المتصفح (Web Push) وإرسال إشعار تجريبي!');
  };

  const handleDisputeFromTransaction = (tx: Transaction) => {
    setDisputeSubject(`اعتراض على عملية (${tx.storeName}) — فاتورة ${tx.invoiceNumber}`);
    setDisputeInvoice(tx.invoiceNumber);
    setDisputeMsg(
      `أرغب بمراجعة العملية بتاريخ (${tx.timestamp}) في فرع ${tx.branchName} بمبلغ ${formatCurrency(
        tx.amount,
        tx.currency
      )} والنقاط المسجلة (${tx.pointsEarned}).`
    );
    setActiveTab('account');
    setTimeout(() => {
      disputeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const phoneChanged = editPhone.trim() !== customer.phone.trim();
    await onUpdateCustomer({
      firstName: editFirstName.trim() || customer.firstName,
      lastName: editLastName.trim() || customer.lastName,
      email: editEmail.trim() || customer.email,
      phone: editPhone.trim() || customer.phone,
      phoneVerified: phoneChanged ? false : customer.phoneVerified,
    });
    showToast(phoneChanged ? 'تم الحفظ! يرجى توثيق رقم الجوال الجديد عبر OTP.' : 'تم حفظ بياناتك بنجاح');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatusMsg('');
    const res = await onChangePassword(currentPassword, newPassword);
    if (res.ok) {
      setCurrentPassword('');
      setNewPassword('');
      setPasswordStatusMsg('تم تحديث كلمة المرور وحفظها بأمان على الخادم ✓');
      showToast('تم تغيير كلمة المرور بنجاح');
    } else {
      setPasswordStatusMsg(res.error || 'تعذر تغيير كلمة المرور');
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpInput.trim()) return;
    await onUpdateCustomer({ verifyOtpCode: otpInput.trim() });
    setOtpRequested(false);
    setOtpInput('');
  };

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeSubject.trim() || !disputeMsg.trim()) return;
    await onAddTicket({
      subject: disputeSubject,
      invoiceRef: disputeInvoice || undefined,
      message: disputeMsg,
    });
    setDisputeSubject('');
    setDisputeInvoice('');
    setDisputeMsg('');
  };

  const navItems: Array<{
    id: typeof activeTab;
    label: string;
    mobileLabel: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'home', label: 'الرئيسية', mobileLabel: 'الرئيسية', icon: Home },
    { id: 'geo_radar', label: 'رادار العروض 📍', mobileLabel: 'الرادار 📍', icon: MapPin },
    { id: 'cards', label: 'بطاقاتي ونقاطي', mobileLabel: 'بطاقاتي', icon: CreditCard },
    { id: 'orders', label: 'طلباتي الأونلاين 🛵', mobileLabel: 'طلباتي', icon: Truck },
    { id: 'vouchers', label: 'القسائم المتاحة', mobileLabel: 'القسائم', icon: Ticket },
    { id: 'explore', label: 'اكتشف متاجر', mobileLabel: 'اكتشف', icon: Compass },
    { id: 'rewards', label: 'المكافآت', mobileLabel: 'المكافآت', icon: Gift },
    { id: 'account', label: 'حسابي', mobileLabel: 'حسابي', icon: User },
  ];

  const prefs = customer.notificationPrefs || {
    readyRewardAlert: true,
    newOfferAlert: true,
    expiry14DayAlert: true,
    expiry3DayAlert: true,
    absenceReminderEnabled: true,
    absenceReminderDays: 30,
    pushSubscribed: false,
  };

  return (
    <div className="min-h-screen bg-light-canvas text-slate-800 dark:text-slate-100 flex flex-col md:flex-row">
      {/* Desktop Right Sidebar Menu */}
      <aside className="hidden md:flex w-72 glass-card border-l border-sky-100 dark:border-slate-800 p-6 flex-col justify-between shrink-0 min-h-[calc(100vh-5rem)]">
        <div className="space-y-6">
          <div className="flex items-center gap-3 pb-5 border-b border-slate-200/70 dark:border-slate-700/60">
            <div className="w-12 h-12 rounded-2xl bg-gradient-navy flex items-center justify-center text-[#FBBF24] font-black text-xl shadow-md">
              {customer.firstName[0] || 'ع'}
            </div>
            <div className="min-w-0">
              <h2 className="font-black text-[#0B1F3A] dark:text-white text-sm truncate">
                {customer.firstName} {customer.lastName}
              </h2>
              <span className="text-[11px] bg-sky-100 dark:bg-sky-900/50 text-[#0284C7] dark:text-sky-300 font-bold px-2 py-0.5 rounded-full inline-block mt-0.5">
                @{customer.username}
              </span>
            </div>
          </div>

          <nav className="space-y-1.5">
            {navItems.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-right px-4 py-3.5 rounded-2xl font-bold text-xs flex items-center justify-between transition-all min-h-[44px] cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-gradient-gold-cta text-[#0B1F3A] shadow-md shadow-amber-500/20 font-black'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-800 hover:text-[#0284C7]'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{tab.label}</span>
                  </span>
                  {tab.id === 'cards' && (
                    <span className="bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded-full text-[10px]">
                      {customer.cards.length}
                    </span>
                  )}
                  {tab.id === 'vouchers' && (
                    <span className="bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded-full text-[10px]">
                      {(customer.vouchers?.filter((v) => v.status === 'active').length || 0) +
                        availableMerchantVouchers.length}
                    </span>
                  )}
                  {tab.id === 'rewards' && rewardCatalog.ready.length > 0 && (
                    <span className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full text-[10px]">
                      {rewardCatalog.ready.length}
                    </span>
                  )}
                  {tab.id === 'geo_radar' && geoAlerts.length > 0 && (
                    <span className="bg-amber-400 text-[#0B1F3A] font-black px-2 py-0.5 rounded-full text-[10px]">
                      {geoAlerts.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-6 space-y-3">
          <div className="bg-gradient-navy text-white p-4 rounded-2xl text-center space-y-2 shadow-md">
            <img src="/logo-white.png" alt="Aada Pass" className="h-5 w-auto object-contain mx-auto opacity-90" />
            <span className="text-[11px] text-sky-100 font-bold block">إجمالي النقاط المشتق من بطاقاتك</span>
            <span className="text-xl font-black text-[#FBBF24] block">
              {derivedTotalPoints.toLocaleString('en-US')} نقطة
            </span>
          </div>

          <div className="flex justify-center">
            <PWAInstallButton />
          </div>

          <button
            type="button"
            onClick={onLogoutAll}
            className="w-full bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 py-2.5 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all min-h-[44px]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{AR_TRANSLATIONS.nav.logoutAllDevices}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area (with extra bottom padding on mobile for fixed thumb bar) */}
      <main className="flex-1 p-4 sm:p-8 lg:p-10 space-y-6 overflow-y-auto pb-28 md:pb-10">
        {/* Mobile-first compact wallet strip + PWA install + Offline banner */}
        <div className="max-w-5xl mx-auto space-y-3">
          <OfflineIndicator />
          <div className="md:hidden glass-card rounded-2xl p-3.5 flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">محفظتي في Aada Pass</p>
              <p className="text-sm font-black text-[#0B1F3A] dark:text-white">
                {derivedTotalPoints.toLocaleString('en-US')} نقطة • {customer.cards.length} بطاقات
              </p>
            </div>
            <PWAInstallButton />
          </div>
        </div>

        {/* Top Floating Notification Bell & Location Strip */}
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3 bg-white/80 dark:bg-[#0B1F3A]/80 backdrop-blur-xl p-3 sm:p-4 rounded-3xl border border-sky-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setActiveTab('geo_radar')}
              className="px-3.5 py-2 rounded-2xl bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 text-[#007BFF] dark:text-sky-300 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-sky-200/60 dark:border-sky-800/40"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{userLocationName}</span>
              <span className="text-[10px] font-black bg-[#007BFF] text-white px-2 py-0.5 rounded-full">
                {geoAlerts.length} عروض
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSimulateWalkInNearStore()}
              title="محاكاة الاقتراب من فرع قريب لتجربة الإشعار الصوتي الفوري"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border border-amber-300/50 font-black text-xs cursor-pointer transition shadow-xs"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>تجربة تنبيه حي ⚡</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAlertsDrawerOpen(true)}
              className="relative p-2.5 sm:px-4 sm:py-2 rounded-2xl bg-gradient-navy text-white hover:opacity-90 shadow-md flex items-center gap-2 transition cursor-pointer"
              aria-label="مركز التنبيهات الجغرافية"
            >
              <Bell className="w-5 h-5 text-[#FBBF24]" />
              <span className="hidden sm:inline text-xs font-black text-[#FBBF24]">التنبيهات</span>
              {unreadGeoAlertsCount > 0 && (
                <span className="min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-xs animate-bounce">
                  {unreadGeoAlertsCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {toastMsg && (
          <div
            className={`max-w-5xl mx-auto px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-xs border ${
              toastTone === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* TAB 1: الرئيسية (Home) */}
        {activeTab === 'home' && (
          <div className="space-y-6 animate-fadeIn max-w-5xl mx-auto">
            {/* Expiring Points Alert Banner (14 / 3 days) */}
            {activeAlerts.length > 0 && (
              <div className="bg-amber-50/95 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-3xl p-4 sm:p-5 space-y-2.5">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-black text-sm">
                  <Bell className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>تنبيه نقاط ستنتهي قريباً</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {activeAlerts.map((al) => (
                    <div
                      key={al.id}
                      className="bg-white/90 dark:bg-slate-900/80 border border-amber-200 dark:border-amber-800/50 rounded-2xl px-4 py-3 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-black text-slate-900 dark:text-white">{al.storeName}</p>
                        <p className="text-amber-700 dark:text-amber-300 font-bold">{al.points} نقطة ستنتهي {al.expiresAt}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('rewards')}
                        className="bg-gradient-gold-cta text-[#0B1F3A] font-black px-3 py-2 rounded-xl text-[11px] min-h-[36px]"
                      >
                        استبدل الآن
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Summary Shortcuts */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <button
                type="button"
                onClick={() => setActiveTab('cards')}
                className="glass-card rounded-2xl p-4 text-right hover:border-sky-400 transition cursor-pointer"
              >
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                  بطاقاتي ونقاطي
                </span>
                <span className="text-xl font-black text-[#0B1F3A] dark:text-white mt-1 block tabular-nums">
                  {derivedTotalPoints.toLocaleString('en-US')} نقطة
                </span>
                <span className="text-[11px] text-sky-600 dark:text-sky-400 font-bold">
                  في {customer.cards.length} بطاقات نشطة
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('vouchers')}
                className="glass-card rounded-2xl p-4 text-right hover:border-amber-400 transition cursor-pointer"
              >
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                  القسائم المتاحة
                </span>
                <span className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 block tabular-nums">
                  {(customer.vouchers?.filter((v) => v.status === 'active').length || 0) +
                    availableMerchantVouchers.length}{' '}
                  قسائم
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                  جاهزة للاستخدام والاستبدال
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('rewards')}
                className="glass-card rounded-2xl p-4 text-right hover:border-emerald-400 transition cursor-pointer"
              >
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                  مكافآت جاهزة وقريبة
                </span>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block tabular-nums">
                  {rewardCatalog.ready.length} جاهزة · {rewardCatalog.locked.length} قريبة
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                  و {receivedRewards.length} مكافآت مستلمة
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('explore')}
                className="glass-card rounded-2xl p-4 text-right hover:border-sky-400 transition cursor-pointer"
              >
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                  اكتشف المتاجر
                </span>
                <span className="text-xl font-black text-sky-700 dark:text-[#00C2FF] mt-1 block tabular-nums">
                  {stores.length} متجر
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                  تصفح الدليل والبطاقات الجديدة
                </span>
              </button>
            </div>

            {/* Geofence Radar & Nearby Offers Spotlight Card */}
            <div className="glass-card p-5 sm:p-6 rounded-3xl border-r-4 border-amber-400 space-y-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-500 shadow-xs">
                    <MapPin className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-sm sm:text-base text-[#0B1F3A] dark:text-white">
                        رادار العروض وتنبيهات القرب الجغرافي
                      </h3>
                      <span className="text-[10px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        مباشر 📍
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      محيطك الحالي: <strong className="text-[#0B1F3A] dark:text-white">{userLocationName}</strong> ({formatDistanceArabic(geoRadiusMeters)})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('geo_radar')}
                    className="px-4 py-2 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 hover:opacity-95 transition cursor-pointer"
                  >
                    <Compass className="w-4 h-4" />
                    <span>فتح رادار العروض والخريطة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSimulateWalkInNearStore()}
                    title="تجربة محاكاة الاقتراب من فرع واستلام إشعار صوتي حي"
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-400 transition cursor-pointer"
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {geoAlerts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                  {geoAlerts.slice(0, 3).map((alert) => (
                    <div
                      key={alert.id}
                      onClick={() => {
                        setSelectedCardId(alert.storeId);
                      }}
                      className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-amber-400/60 transition cursor-pointer space-y-2 flex flex-col justify-between"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={alert.storeLogo || '/icon-192.png'}
                            alt={alert.storeName}
                            referrerPolicy="no-referrer"
                            className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 bg-white shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-slate-400 block truncate">
                              {alert.storeName} • {alert.branchName}
                            </span>
                            <h4 className="font-black text-xs text-[#0B1F3A] dark:text-white truncate">
                              {alert.title}
                            </h4>
                          </div>
                        </div>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 shrink-0">
                          {alert.distanceText}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                        {alert.message}
                      </p>

                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60 dark:border-slate-800 text-sky-600 dark:text-sky-400 font-bold">
                        <span>{alert.badgeText}</span>
                        <span className="text-[10px] text-slate-400">إظهار البطاقة ↗</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-slate-400">
                  لا توجد عروض في نطاق {formatDistanceArabic(geoRadiusMeters)}. افتح الرادار لتوسيع النطاق.
                </div>
              )}
            </div>

            {/* Quick QR Strip + Followed Stores */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="bg-gradient-navy text-white rounded-3xl p-5 flex flex-col justify-between gap-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-sky-200 font-bold block">بطاقة الكاشير السريعة</span>
                    <h3 className="font-black text-base">باركود ورمز العميل</h3>
                  </div>
                  <QrCode className="w-7 h-7 text-[#FBBF24]" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] bg-white/10 px-3 py-1.5 rounded-xl">
                    <span className="text-sky-200">رمز العميل:</span>
                    <span className="font-mono font-black text-[#FBBF24]">
                      {customer.referralCode || customer.username}
                    </span>
                  </div>
                  <p className="text-[11px] text-sky-100 font-mono truncate bg-white/10 px-3 py-2 rounded-xl" dir="ltr">
                    {activeQrToken}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-emerald-300 font-bold">
                    {isOffline ? 'وضع بدون إنترنت ✓' : `يتجدد تلقائياً: ${secondsLeft} ث`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('account')}
                    className="bg-gradient-gold-cta text-[#0B1F3A] font-black px-4 py-2 rounded-xl text-xs min-h-[40px] cursor-pointer"
                  >
                    تكبير رمز QR
                  </button>
                </div>
              </div>

              <div className="lg:col-span-2 glass-card rounded-3xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-slate-900 dark:text-white text-base">المتاجر التي تتابعها</h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('explore')}
                    className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    استكشف المزيد
                  </button>
                </div>
                {followedStores.length === 0 ? (
                  <p className="text-xs text-slate-500">لم تتابع أي متجر بعد. تصفح دليل المتاجر لمتابعة متاجرك المفضلة.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {followedStores.map((st) => {
                      const card = customer.cards.find((c) => c.storeId === st.id);
                      return (
                        <div
                          key={st.id}
                          className="bg-white/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-3.5 flex items-center justify-between gap-3"
                        >
                          <div
                            onClick={() => onOpenStore(st.id)}
                            className="flex items-center gap-3 cursor-pointer min-w-0"
                          >
                            <img
                              src={st.logo}
                              alt={st.name}
                              referrerPolicy="no-referrer"
                              className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0"
                            />
                            <div className="min-w-0">
                              <h4 className="font-black text-sm text-slate-900 dark:text-white truncate">{st.name}</h4>
                              <p className="text-[11px] text-sky-700 dark:text-sky-400 font-bold">
                                {card
                                  ? `${card.currentBalance} ${card.rule.type === 'points' ? 'نقطة' : 'أختام'}`
                                  : st.city}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleFollow(st.id)}
                            title="إلغاء المتابعة"
                            className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 min-h-[40px] min-w-[40px] flex items-center justify-center"
                          >
                            <Heart className="w-4 h-4 fill-current" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Featured / Nearby Offers */}
            <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-lg">عروض قريبة ومميزة</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">أحدث العروض النشطة في متاجر الشبكة</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {featuredOffers.slice(0, 4).map(({ store, offer }) => (
                  <div
                    key={offer.id}
                    onClick={() => onOpenStore(store.id)}
                    className="bg-white/90 dark:bg-slate-800/80 hover:bg-white p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 flex items-center gap-4 cursor-pointer transition-all hover:shadow-md"
                  >
                    <img
                      src={offer.image}
                      alt={offer.name}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-2xl object-cover shrink-0 border border-slate-200"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        {store.name} • {store.city}
                      </span>
                      <h4 className="font-black text-sm text-slate-900 dark:text-white mt-1 truncate">{offer.name}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{offer.description}</p>
                    </div>
                    <span className="font-black text-sm text-sky-700 dark:text-sky-400 shrink-0">
                      {formatCurrency(offer.price, offer.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Latest Activity */}
            <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-slate-900 dark:text-white text-lg">آخر النشاط</h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('account')}
                  className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline"
                >
                  السجل الكامل والفلاتر
                </button>
              </div>
              {transactions.length === 0 ? (
                <p className="text-xs text-slate-500">لا توجد عمليات مسجلة حتى الآن.</p>
              ) : (
                <div className="divide-y divide-slate-200/70 dark:divide-slate-700/70">
                  {transactions.slice(0, 4).map((tx) => (
                    <div key={tx.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <p className="font-black text-slate-900 dark:text-white">
                          {tx.storeName} — <span className="font-mono text-sky-700 dark:text-sky-400">{tx.invoiceNumber}</span>
                        </p>
                        <p className="text-slate-500 dark:text-slate-400">
                          {tx.branchName} • {tx.timestamp}
                        </p>
                      </div>
                      <div className="text-left">
                        <span className={`font-black text-sm block ${tx.pointsEarned >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {tx.pointsEarned >= 0 ? `+${tx.pointsEarned}` : tx.pointsEarned}{' '}
                          {tx.type === 'stamp' ? 'ختم' : 'نقطة'}
                        </span>
                        <span className="text-slate-500">{formatCurrency(tx.amount, tx.currency)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: بطاقاتي ونقاطي (3-Tier Loyalty Card System) */}
        {activeTab === 'cards' && (
          <div className="space-y-6 animate-fadeIn max-w-5xl mx-auto">
            {/* Header & 3-System Overview */}
            <div className="glass-card rounded-3xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 text-xs font-black mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>منظومة البطاقات الثلاثية الذكية (أختام المتاجر • نقاط المتاجر • بطاقة الحساب)</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">محفظتي في Aada Pass</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  3 أنواع متكاملة: بطاقات أختام خاصة بكل متجر، بطاقات نقاط خاصة بكل متجر، وبطاقة حسابك الشاملة للمشاركة والإهداء والخصومات.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 sm:gap-5 bg-slate-50/90 dark:bg-slate-800/70 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700">
                <div className="text-center px-2">
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-black block">نقاط بطاقة الحساب</span>
                  <span className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
                    {(customer.accountPointsBalance ?? 350).toLocaleString('en-US')}
                  </span>
                </div>
                <div className="text-center px-2 border-x border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-black block">نقاط المتاجر</span>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {derivedTotalPoints.toLocaleString('en-US')}
                  </span>
                </div>
                <div className="text-center px-2">
                  <span className="text-[11px] text-sky-600 dark:text-sky-400 font-black block">بطاقات المتاجر</span>
                  <span className="text-2xl sm:text-3xl font-black text-sky-600 dark:text-sky-400 tabular-nums">
                    {customer.cards.length}
                  </span>
                </div>
              </div>
            </div>

            {/* 3-Card System Filter Pills */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'all', label: 'الكل (النظام الثلاثي الكامل)', count: customer.cards.length + 1 },
                  { id: 'account_master', label: '1. بطاقة الحساب الشاملة (مشاركة وهدايا)', count: 1 },
                  {
                    id: 'store_stamps',
                    label: '2. بطاقات أختام المتاجر',
                    count: customer.cards.filter((c) => c.rule.type === 'stamps').length,
                  },
                  {
                    id: 'store_points',
                    label: '3. بطاقات نقاط المتاجر',
                    count: customer.cards.filter((c) => c.rule.type === 'points').length,
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setWalletSystemFilter(tab.id as typeof walletSystemFilter)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 min-h-[40px] ${
                      walletSystemFilter === tab.id
                        ? 'bg-[#0B1F3A] dark:bg-sky-500 text-white shadow-md'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-sky-400'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[10px]">{tab.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* TYPE 3: ACCOUNT MASTER CARD (بطاقة الحساب الشاملة للمشاركة والإهداء والخصومات) */}
            {(walletSystemFilter === 'all' || walletSystemFilter === 'account_master') && (
              <div className="rounded-3xl p-6 sm:p-7 bg-gradient-to-br from-amber-50 via-white to-sky-50 text-[#0B1F3A] shadow-lg border-2 border-amber-300 space-y-5 relative overflow-hidden">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  <div className="space-y-2 max-w-xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-xs font-black">
                      <Crown className="w-4 h-4 text-amber-600" />
                      <span>النوع الثالث: بطاقة الحساب الشاملة (Account Master Pass)</span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-[#0B1F3A]">
                      بطاقة حساب {customer.firstName} {customer.lastName} — نقاط حرة للمشاركة والإهداء والخصومات
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      رصيد موحد مرتبط بحسابك الشخصي، تحصل على <strong>+15% نقاط إضافية تلقائياً</strong> مع كل عملية شراء، ويمكنك مشاركته فوراً مع أي متجر شريك، أو إهداؤه لحساب صديق (مثل <code className="text-amber-700 font-bold">@sara</code>)، أو تحويله لقسيمة خصم فورية!
                    </p>
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                      <span className="bg-white border border-amber-200 px-3 py-1.5 rounded-xl font-mono font-bold text-amber-800 shadow-xs">
                        كود البطاقة: {customer.accountCardCode || `AADA-VIP-${customer.referralCode}`}
                      </span>
                      <span className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl font-bold text-emerald-700">
                        100 نقطة حساب = 25 ر.س خصم فوري
                      </span>
                    </div>
                  </div>

                  <div className="bg-white border-2 border-amber-200 rounded-2xl p-5 min-w-[230px] text-center space-y-2 shadow-sm">
                    <span className="text-xs font-bold text-amber-700 block">رصيد بطاقة الحساب الحر</span>
                    <div className="text-4xl font-black text-amber-600 tabular-nums">
                      {(customer.accountPointsBalance ?? 350).toLocaleString('en-US')}
                      <span className="text-sm font-bold text-[#0B1F3A] mr-1.5">نقطة VIP</span>
                    </div>
                    <button
                      type="button"
                      disabled={generatingPass}
                      onClick={handleOpenAccountPhonePass}
                      className="w-full bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-black py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 border border-amber-300 transition cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-amber-600" />
                      <span>تجهيز وحفظ البطاقة للهاتف</span>
                    </button>
                  </div>
                </div>

                {/* 3 Action Buttons on Account Master Card */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-amber-200/70">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountTargetStoreId(stores[0]?.id || 'store-1');
                      setAccountActionPoints(50);
                      setAccountModalMode('share_to_store');
                    }}
                    className="bg-amber-500 hover:bg-amber-600 text-white font-black py-3 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-sm transition min-h-[46px] cursor-pointer"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    <span>مشاركة نقاط مع متجر شريك</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountGiftRecipient('@sara');
                      setAccountActionPoints(40);
                      setAccountModalMode('gift_to_user');
                    }}
                    className="bg-sky-600 hover:bg-sky-700 text-white font-black py-3 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-sm transition min-h-[46px] cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>إهداء نقاط لحساب آخر</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountTargetStoreId(stores[0]?.id || 'store-1');
                      setAccountActionPoints(60);
                      setAccountModalMode('convert_to_voucher');
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-sm transition min-h-[46px] cursor-pointer"
                  >
                    <Ticket className="w-4 h-4" />
                    <span>تحويل لقسيمة خصم فورية</span>
                  </button>
                </div>

                {/* Recent Account Transfers Log */}
                {customer.accountTransfers && customer.accountTransfers.length > 0 && (
                  <div className="bg-white/90 rounded-2xl p-4 space-y-2 border border-amber-200">
                    <span className="text-[11px] font-black text-amber-800 block">
                      آخر عمليات المشاركة والإهداء من بطاقة الحساب:
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {customer.accountTransfers.slice(0, 4).map((tr) => (
                        <div
                          key={tr.id}
                          className="flex items-center justify-between gap-2 text-xs bg-slate-50 border border-slate-200/80 px-3 py-2 rounded-xl"
                        >
                          <div className="truncate">
                            <span className="font-black text-[#0B1F3A]">{tr.targetName}</span>
                            <span className="text-[11px] text-slate-500 block truncate">{tr.note}</span>
                          </div>
                          <div className="text-left shrink-0">
                            <span className="font-black text-amber-700 block tabular-nums">-{tr.points} نقطة</span>
                            <span className="text-[10px] text-slate-400">{tr.timestamp}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TYPES 1 & 2: STORE STAMP CARDS & STORE POINTS CARDS */}
            {walletSystemFilter !== 'account_master' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {customer.cards
                  .filter((card) => {
                    if (walletSystemFilter === 'store_stamps') return card.rule.type === 'stamps';
                    if (walletSystemFilter === 'store_points') return card.rule.type === 'points';
                    return true;
                  })
                  .map((card) => {
                    const targetVal =
                      card.rule.type === 'stamps'
                        ? card.rule.stampsRequired || 6
                        : card.rule.rewardTargetPoints || 100;
                    const pct = Math.min(100, Math.round((card.currentBalance / targetVal) * 100));
                    const cardTextStyle = resolveCardTextStyle(card.cardTextColor);
                    const isLightText = isLightCardTextColor(card.cardTextColor);
                    const stampTotal = card.rule.stampsRequired || 6;
                    const spacingCfg = getCardSpacingConfig(card.cardSpacing);
                    const patternCfg = getCardPatternConfig(card.cardPattern);
                    return (
                      <div key={card.id} className="glass-card rounded-3xl p-5 sm:p-6 space-y-5 flex flex-col justify-between">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={card.storeLogo}
                              alt={card.storeName}
                              referrerPolicy="no-referrer"
                              className="w-14 h-14 rounded-2xl object-cover border border-slate-200 bg-white shrink-0"
                            />
                            <div className="min-w-0">
                              <h4 className="font-black text-slate-900 dark:text-white text-base truncate">{card.storeName}</h4>
                              {card.cardName && (
                                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">
                                  {card.cardName}
                                </p>
                              )}
                              <span
                                className={`text-[11px] font-black px-2.5 py-0.5 rounded-full inline-block mt-1 ${
                                  card.rule.type === 'stamps'
                                    ? 'text-amber-800 bg-amber-100 dark:bg-amber-500/20 dark:text-amber-300'
                                    : 'text-sky-700 bg-sky-50 dark:bg-sky-500/20 dark:text-sky-300'
                                }`}
                              >
                                {card.badgeText ||
                                  (card.rule.type === 'points'
                                    ? `بطاقة نقاط المتجر (${card.currency})`
                                    : `بطاقة أختام المتجر · ${stampTotal} أختام`)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div
                          className={`relative overflow-hidden bg-gradient-to-br ${resolveCardGradientClass(
                            card.cardColor
                          )} ${cardTextStyle.className} ${spacingCfg.paddingClass} ${spacingCfg.gapClass} rounded-2xl shadow-md`}
                          style={{
                            backgroundImage: resolveCardCssGradient(card.cardColor),
                            ...cardTextStyle.style,
                          }}
                        >
                          {card.cardPattern && card.cardPattern !== 'none' && (
                            <div
                              className="absolute inset-0 pointer-events-none"
                              style={patternCfg.overlayStyle}
                            />
                          )}
                          <div className="relative z-10 flex items-center justify-between">
                            <span className="text-xs opacity-85 font-bold">
                              {card.rule.type === 'stamps' ? 'الأختام المكتسبة' : 'رصيد النقاط المتاح'}
                            </span>
                            <span className="text-2xl font-black tabular-nums">
                              {card.currentBalance}{' '}
                              {card.rule.type === 'points' ? `/ ${targetVal} نقطة` : `/ ${stampTotal}`}
                            </span>
                          </div>

                          {card.rule.type === 'stamps' ? (
                            <div
                              className={`relative z-10 grid ${spacingCfg.stampGridGapClass} pt-1 ${
                                stampTotal <= 4 ? 'grid-cols-4' : stampTotal <= 8 ? 'grid-cols-4' : 'grid-cols-6'
                              }`}
                            >
                              {Array.from({ length: stampTotal }).map((_, idx) => {
                                const filled = idx < card.currentBalance;
                                return (
                                  <div
                                    key={idx}
                                    className={`h-8 rounded-lg flex items-center justify-center text-xs font-black border ${
                                      filled
                                        ? isLightText
                                          ? 'bg-[#0B1F3A] text-white border-[#0B1F3A]'
                                          : 'bg-white text-[#0B1F3A] border-white'
                                        : isLightText
                                        ? 'bg-[#0B1F3A]/10 text-[#0B1F3A]/60 border-[#0B1F3A]/25 border-dashed'
                                        : 'bg-white/15 opacity-80 border-white/30 border-dashed'
                                    }`}
                                  >
                                    {filled ? (
                                      <StampShapeIcon shape={card.rule.stampShape} className="w-4 h-4" />
                                    ) : (
                                      idx + 1
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="relative z-10 space-y-1">
                              <div
                                className={`w-full h-2.5 rounded-full overflow-hidden ${
                                  isLightText ? 'bg-[#0B1F3A]/15' : 'bg-white/20'
                                }`}
                              >
                                <div className="h-full bg-[#FBBF24] rounded-full transition-all" style={{ width: `${pct}%` }} />
                              </div>
                              <div className="flex items-center justify-between text-[10px] opacity-85">
                                <span>التقدم للمكافأة: {pct}%</span>
                                <span>
                                  {card.rule.pointsCalcMode === 'per_amount'
                                    ? `${card.rule.pointsPerUnit || 10} نقاط / ${card.rule.currencyUnitAmount || 10} ${card.currency}`
                                    : card.rule.pointsCalcMode === 'percentage'
                                    ? `نسبة ${card.rule.percentageRate || 10}% من الفاتورة`
                                    : 'شرائح إنفاق تصاعدية'}
                                </span>
                              </div>
                            </div>
                          )}

                          <p
                            className={`relative z-10 text-[11px] opacity-90 pt-2 border-t ${
                              isLightText ? 'border-[#0B1F3A]/15' : 'border-white/20'
                            }`}
                          >
                            {card.rule.rewardDescription}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedCardId(card.id)}
                            className="text-xs font-black text-sky-700 dark:text-sky-400 hover:underline min-h-[40px]"
                          >
                            تفاصيل البطاقة والفروع
                          </button>
                          <button
                            type="button"
                            disabled={generatingPass}
                            onClick={() => handleOpenCardPhonePass(card)}
                            className="bg-[#0B1F3A] hover:bg-[#10325E] text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 min-h-[40px] cursor-pointer"
                          >
                            {walletAddedId === card.id ? (
                              <>
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                <span>جاهزة للهاتف ✓</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-4 h-4 text-[#FBBF24]" />
                                <span>تجهيز وحفظ للهاتف</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Points Review Section right inside My Cards Tab */}
            <div className="glass-card rounded-3xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Coins className="w-5 h-5 text-amber-500" />
                    <span>مراجعة النقاط الخاصة بكل بطاقة</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    متابعة تفصيلية لجميع النقاط والأختام المكتسبة والمخصومة في بطاقاتك المستخدمة.
                  </p>
                </div>
                <select
                  value={cardsPointsStoreFilter}
                  onChange={(e) => setCardsPointsStoreFilter(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold min-h-[40px]"
                >
                  <option value="الكل">كل البطاقات ({transactions.length})</option>
                  {customer.cards.map((c) => (
                    <option key={c.storeId} value={c.storeId}>
                      {c.storeName} ({c.currentBalance} {c.rule.type === 'points' ? 'نقطة' : 'ختم'})
                    </option>
                  ))}
                </select>
              </div>

              {cardPointsLedger.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">لا توجد حركات نقاط مسجلة لهذه البطاقة حتى الآن.</p>
              ) : (
                <div className="divide-y divide-slate-200/70 dark:divide-slate-700/70">
                  {cardPointsLedger.map((tx) => (
                    <div key={tx.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <p className="font-black text-slate-900 dark:text-white">
                          {tx.storeName} — <span className="font-mono text-sky-700 dark:text-sky-400">{tx.invoiceNumber}</span>
                        </p>
                        <p className="text-slate-500 dark:text-slate-400">
                          {tx.branchName} · {tx.timestamp}
                        </p>
                      </div>
                      <div className="text-left">
                        <span className={`font-black text-sm block tabular-nums ${tx.pointsEarned >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {tx.pointsEarned >= 0 ? `+${tx.pointsEarned}` : tx.pointsEarned}{' '}
                          {tx.type === 'stamp' ? 'ختم' : 'نقطة'}
                        </span>
                        {tx.amount > 0 && (
                          <span className="text-slate-500 text-[11px]">{formatCurrency(tx.amount, tx.currency)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: القسائم المتاحة له (Available Vouchers) */}
        {activeTab === 'vouchers' && (
          <div className="space-y-6 animate-fadeIn max-w-5xl mx-auto">
            <div className="glass-card rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Ticket className="w-6 h-6 text-[#0284C7] dark:text-[#00C2FF]" />
                  <span>القسائم المتاحة لك</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  قسائمك الرقمية الفعالة للاستخدام الفوري لدى الكاشير، وقسائم المتاجر المتاحة للاستبدال بنقاطك.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="px-4 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center">
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 block">
                    قسائم جاهزة معك
                  </span>
                  <span className="text-xl font-black text-emerald-800 dark:text-emerald-200 tabular-nums">
                    {customer.vouchers?.filter((v) => v.status === 'active').length || 0}
                  </span>
                </div>
                <div className="px-4 py-2 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-center">
                  <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 block">
                    قسائم متاجر متاحة
                  </span>
                  <span className="text-xl font-black text-amber-800 dark:text-amber-200 tabular-nums">
                    {availableMerchantVouchers.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Active Customer Digital Vouchers */}
            <div className="glass-card rounded-3xl p-6 space-y-4">
              <h3 className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <span>قسائمي الصادرة الجاهزة للصرف ({customer.vouchers?.filter((v) => v.status === 'active').length || 0})</span>
              </h3>
              {!customer.vouchers || customer.vouchers.length === 0 ? (
                <p className="text-xs text-slate-500">لا توجد قسائم صادرة في محفظتك حالياً. يمكنك إصدار قسيمة من قائمة عروض المتاجر بالأسفل أو من تبويب المكافآت.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customer.vouchers.map((v) => (
                    <div
                      key={v.id}
                      className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 ${
                        v.status === 'active'
                          ? 'bg-white/95 dark:bg-slate-800/80 border-emerald-200 dark:border-emerald-800/60'
                          : 'bg-slate-100/80 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-75'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[11px] font-bold text-sky-700 dark:text-sky-300">
                            {v.storeName}
                          </span>
                          <h4 className="font-black text-sm text-slate-900 dark:text-white mt-0.5">
                            {v.title}
                          </h4>
                        </div>
                        <span
                          className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                            v.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                              : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {v.status === 'active' ? 'فعالة ✓' : v.status === 'used' ? 'مستخدمة' : 'منتهية'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t border-slate-100 dark:border-slate-700/70">
                        <div className="text-slate-500 dark:text-slate-400">
                          <span className="block font-bold text-slate-800 dark:text-slate-200">
                            القيمة: {formatCurrency(v.valueAmount, v.currency)}
                          </span>
                          <span className="text-[11px]">صالحة حتى: {v.expiresAt}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={generatingPass}
                            onClick={() => handleOpenVoucherPhonePass(v)}
                            className="bg-[#0B1F3A] hover:bg-[#10325E] text-white text-[11px] font-black px-3 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-amber-300" />
                            <span>حفظ للهاتف</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyText(v.code, 'كود القسيمة')}
                            className="bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 font-mono font-black px-3 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>{v.code}</span>
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Available Store Vouchers Catalog */}
            <div className="glass-card rounded-3xl p-6 space-y-4">
              <h3 className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Gift className="w-5 h-5 text-sky-600" />
                <span>قسائم المتاجر المتاحة للاستبدال ({availableMerchantVouchers.length})</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableMerchantVouchers.map(({ store, voucher, currentBalance, canRedeemNow }) => (
                  <div
                    key={voucher.id}
                    className="p-4 rounded-2xl bg-white/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-black text-sky-700 dark:text-[#00C2FF]">
                          {store.name}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {voucher.audienceType === 'specific' && (
                            <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-900 dark:text-purple-200 text-[10px] font-black">
                              مخصصة لك ✨
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-black">
                            خصم {voucher.discountText}
                          </span>
                        </div>
                      </div>
                      <h4 className="font-black text-sm text-slate-900 dark:text-white">
                        {voucher.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        التكلفة: <strong>{voucher.pointsCost} نقطة</strong> · رصيدك الحالي بالمتجر:{' '}
                        <strong className="text-emerald-600 dark:text-emerald-400">{currentBalance}</strong>
                      </p>
                      <p className="text-[10px] text-slate-400">صالحة حتى {voucher.expiryDate}</p>
                    </div>

                    <button
                      type="button"
                      disabled={!canRedeemNow || redeeming}
                      onClick={() =>
                        handleTriggerRedeem({
                          id: voucher.id,
                          merchantVoucherId: voucher.id,
                          store,
                          title: voucher.title,
                          pointsCost: voucher.pointsCost || 100,
                          valueAmount: parseFloat(voucher.discountText) || 25,
                          currentBalance,
                          unit: 'points',
                        })
                      }
                      className={`w-full py-2.5 rounded-xl text-xs font-black min-h-[40px] cursor-pointer ${
                        canRedeemNow
                          ? 'bg-gradient-gold-cta text-[#0B1F3A] shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {canRedeemNow
                        ? 'إصدار القسيمة الآن'
                        : `تحتاج ${Math.max(0, voucher.pointsCost - currentBalance)} نقطة إضافية`}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: اكتشف (Explore Directory) */}
        {activeTab === 'explore' && (
          <div className="space-y-6 animate-fadeIn max-w-5xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">اكتشف المتاجر والعروض</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">بحث عربي ذكي في الدليل حسب الاسم والنشاط والمدينة والحي.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={nearbyCityFilter}
                  onChange={(e) => setNearbyCityFilter(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs font-bold min-h-[44px]"
                >
                  <option value="الكل">كل المدن</option>
                  <option value="الرياض">الرياض</option>
                  <option value="جدة">جدة</option>
                  <option value="القاهرة">القاهرة</option>
                </select>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs font-bold min-h-[44px]"
                >
                  <option value="الكل">كل الأنشطة</option>
                  <option value="كافيه">كافيه</option>
                  <option value="مطعم">مطعم</option>
                  <option value="صالون">صالون</option>
                  <option value="متجر">متجر</option>
                </select>
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="ابحث عن متجر أو حي..."
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl pr-9 pl-4 py-2.5 text-xs w-full sm:w-56 min-h-[44px]"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredExploreStores.map((store) => {
                const isFollowed = customer.followedStoreIds?.includes(store.id);
                const isJoined = customer.cards.some((c) => c.storeId === store.id);
                return (
                  <div key={store.id} className="glass-card rounded-3xl overflow-hidden flex flex-col justify-between">
                    <div onClick={() => onOpenStore(store.id)} className="cursor-pointer">
                      <div className="h-40 bg-slate-200 relative">
                        <img
                          src={store.cover}
                          alt={store.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute top-3 right-3 bg-white/95 text-slate-900 text-xs font-bold px-2.5 py-0.5 rounded-full">
                          {store.category}
                        </span>
                        {store.subscriptionPlan === 'Viewer' && (
                          <span className="absolute bottom-3 right-3 bg-slate-900/90 text-amber-300 text-[10px] font-bold px-2.5 py-1 rounded-full">
                            لا يشارك في برنامج النقاط
                          </span>
                        )}
                      </div>
                      <div className="p-5 space-y-2">
                        <h4 className="font-black text-slate-900 dark:text-white text-base">{store.name}</h4>
                        <p className="text-slate-500 dark:text-slate-400 text-xs flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-sky-600" />
                          <span>
                            {store.city} - {store.area}
                          </span>
                        </p>
                        <p className="text-sky-700 dark:text-sky-400 text-xs font-bold pt-1">
                          {store.loyaltyRule.rewardDescription}
                        </p>
                      </div>
                    </div>

                    <div className="px-5 pb-5 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                      <button
                        type="button"
                        onClick={() => handleToggleFollow(store.id)}
                        className={`text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 min-h-[40px] ${
                          isFollowed
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isFollowed ? 'fill-current' : ''}`} />
                        <span>{isFollowed ? 'متابَع' : 'متابعة'}</span>
                      </button>

                      <div className="flex items-center gap-2">
                        {(store.onlineOrderingActive ?? true) && (
                          <button
                            type="button"
                            onClick={() => setOrderingStore(store)}
                            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 shadow-sm min-h-[40px] cursor-pointer transition"
                            title="طلب قائمة الطعام أونلاين عبر واتساب"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>طلب أونلاين 🛵</span>
                          </button>
                        )}
                        {store.slug && (
                          <Link
                            href={`/stores/${store.slug}`}
                            className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 min-h-[40px] min-w-[40px] flex items-center justify-center"
                            title="صفحة المتجر الكاملة"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        )}
                        {store.subscriptionPlan !== 'Viewer' && !isJoined && (
                          <button
                            type="button"
                            onClick={() => onOpenStore(store.id)}
                            className="bg-gradient-gold-cta text-[#0B1F3A] font-black px-3.5 py-2 rounded-xl text-xs min-h-[40px]"
                          >
                            إضافة البطاقة
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 5: المكافآت (قائمة بالمكافآت المستلمة والقريبة من الاستلام) */}
        {activeTab === 'rewards' && (
          <div className="space-y-8 animate-fadeIn max-w-5xl mx-auto">
            {networkRules.crossStore100PtsSar > 0 && (
              <div className="bg-gradient-navy text-white p-6 sm:p-8 rounded-3xl shadow-xl space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <h3 className="text-xl sm:text-2xl font-black">شبكة المكافآت المشتركة — Aada Shared Network</h3>
                  <img src="/logo-white.png" alt="Aada Pass" className="h-7 w-auto object-contain" />
                </div>
                <p className="text-sky-50 text-xs sm:text-sm max-w-2xl leading-relaxed">
                  كل 100 نقطة داخل نفس المتجر تساوي{' '}
                  <strong className="text-[#FBBF24]">{networkRules.sameStore100PtsSar} ر.س</strong>، وفي أي متجر مشترك آخر عبر الشبكة تساوي{' '}
                  <strong className="text-[#00C2FF]">{networkRules.crossStore100PtsSar} ر.س</strong>.
                </p>
              </div>
            )}

            {/* Ready Rewards */}
            <div className="space-y-4">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Gift className="w-5 h-5 text-emerald-600" />
                <span>مكافآت جاهزة للاستلام الآن ({rewardCatalog.ready.length})</span>
              </h3>
              {rewardCatalog.ready.length === 0 ? (
                <p className="text-xs text-slate-500 glass-card p-5 rounded-2xl">
                  لا توجد مكافآت مكتملة حالياً — واصل الشراء لرفع شريط التقدم في المكافآت القريبة بالأسفل.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {rewardCatalog.ready.map((item) => (
                    <div key={item.id} className="glass-card p-5 rounded-3xl space-y-4 border-2 border-emerald-200/80 dark:border-emerald-800/40">
                      <div className="flex items-center justify-between">
                        <span className="bg-emerald-100 text-emerald-800 text-[11px] font-black px-2.5 py-1 rounded-full">
                          جاهزة للاستلام ✓
                        </span>
                        <span className="text-xs font-black text-sky-700 dark:text-sky-400">
                          {item.pointsCost} {item.unit === 'points' ? 'نقطة' : 'ختم'}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 dark:text-white text-base">{item.title}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          رصيدك المتاح في المتجر: {item.currentBalance}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={redeeming}
                        onClick={() => handleTriggerRedeem(item)}
                        className="w-full bg-gradient-gold-cta text-[#0B1F3A] font-black py-3 rounded-xl text-xs min-h-[44px] cursor-pointer"
                      >
                        استلام وإصدار قسيمة المكافأة
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Nearly Earned Rewards (قرب يستلمها) */}
            {rewardCatalog.locked.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                  <span>مكافآت قربت تستلمها (مرتبة حسب الأقرب للاكتمال — {rewardCatalog.locked.length})</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {rewardCatalog.locked.map((item) => (
                    <div key={item.id} className="glass-card p-5 rounded-3xl space-y-3">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <h4 className="font-black text-slate-900 dark:text-white">{item.title}</h4>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                            item.progressPct >= 60
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {item.progressPct >= 60 ? 'قريبة جداً 🔥' : `${item.progressPct}%`}
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#00C2FF] to-[#F59E0B] rounded-full"
                          style={{ width: `${item.progressPct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span>
                          متبقي <strong>{item.pointsCost - item.currentBalance}</strong>{' '}
                          {item.unit === 'points' ? 'نقطة' : 'أختام'} فقط للاستلام
                        </span>
                        <span className="font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                          {item.currentBalance} / {item.pointsCost}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Earned / Received Rewards History (المكافآت اللي استلمتها) */}
            <div className="glass-card p-6 rounded-3xl space-y-4">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-600" />
                <span>المكافآت التي استلمتها سابقاً ({receivedRewards.length})</span>
              </h3>
              {receivedRewards.length === 0 ? (
                <p className="text-xs text-slate-500">لم تستلم أي مكافآت أو قسائم بعد.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {receivedRewards.map((rw) => (
                    <div
                      key={rw.id}
                      className="p-4 rounded-2xl bg-white/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="text-[10px] font-black text-sky-700 dark:text-sky-300">
                          {rw.storeName} · {rw.dateLabel}
                        </span>
                        <h4 className="font-black text-slate-900 dark:text-white text-sm truncate mt-0.5">
                          {rw.title}
                        </h4>
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          المرجع: {rw.code}
                        </span>
                      </div>
                      <div className="text-left shrink-0 space-y-1">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[10px] font-black block">
                          {rw.statusLabel}
                        </span>
                        <span className="font-black text-slate-700 dark:text-slate-200 block tabular-nums">
                          {rw.valueAmount > 0 ? formatCurrency(rw.valueAmount, rw.currency) : `${rw.pointsUsed} نقطة`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Referral */}
            <div className="glass-card p-6 rounded-3xl space-y-4">
              <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1 w-fit">
                <Share2 className="w-3 h-3" /> الإحالة
              </span>
              <h4 className="font-black text-slate-900 dark:text-white text-lg">ادعُ صديقاً واكسب 100 نقطة</h4>
              <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                عند تسجيل صديقك بكود الإحالة وإتمام <strong>أول عملية شراء موثقة</strong> يحصل كل منكما على مكافأة نقاط فورية. الإحالات المكتملة: <strong>{customer.referralsCount}</strong>.
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-100 dark:bg-slate-800 p-3 rounded-xl font-mono text-xs text-center font-bold text-slate-800 dark:text-white select-all">
                  {customer.referralCode}
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyText(customer.referralCode, 'كود الإحالة')}
                  className="bg-[#0B1F3A] text-white font-bold px-4 py-3 rounded-xl text-xs flex items-center gap-1.5 min-h-[44px] cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  <span>نسخ</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB: رادار العروض والمواقع الجغرافية (Geo Radar & Proximity Offers) */}
        {activeTab === 'geo_radar' && (
          <CustomerGeoOffersTab
            customer={customer}
            stores={stores}
            onOpenStoreCard={(storeId) => setSelectedCardId(storeId)}
            onTriggerBannerAlert={(alert) => setBannerAlert(alert)}
          />
        )}

        {/* TAB 5: حسابي (Account, Ed25519 QR, Filtered Transactions, Notifications, Deletion) */}
        {activeTab === 'account' && (
          <div className="space-y-8 animate-fadeIn max-w-4xl mx-auto">
            {/* Ed25519 Short-lived Rotating QR Section */}
            <div className="glass-card p-6 sm:p-8 rounded-3xl text-center space-y-5">
              <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-1.5 rounded-full text-xs font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>رمز بطاقة رقمي مشفر وآمن (لا يتضمن الرصيد أو أي بيانات شخصية)</span>
              </div>

              <div className="w-64 bg-[#0B1F3A] text-white p-5 rounded-3xl mx-auto shadow-xl flex flex-col items-center justify-center font-mono border border-[#00C2FF]/30 space-y-2.5">
                <img src="/logo-white.png" alt="Aada Pass" className="h-5 w-auto object-contain" />
                <QrCode className="w-24 h-24 text-[#FBBF24]" />
                <span className="font-bold text-[10px] text-[#00C2FF] break-all leading-relaxed" dir="ltr">
                  {activeQrToken}
                </span>
                <div className="text-[10px] text-sky-200/80 flex items-center gap-2">
                  <span>{isOffline ? `نسخة محفوظة (${cachedQr?.savedAtLabel || 'محلي'})` : `ينتهي خلال ${secondsLeft} ث`}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={isOffline}
                  onClick={() => onUpdateCustomer({ rotateQr: true })}
                  className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 min-h-[44px]"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>توليد رمز جديد الآن</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyText(activeQrToken, 'رمز QR')}
                  className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 min-h-[44px]"
                >
                  <Copy className="w-4 h-4" />
                  <span>نسخ الرمز (للاختبار مع الكاشير)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowLostPhoneModal(true)}
                  className="bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 font-black px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 min-h-[44px]"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>فقدت هاتفي</span>
                </button>
              </div>
            </div>

            {/* Profile Info & Progressive OTP */}
            <form onSubmit={handleSaveProfile} className="glass-card p-6 sm:p-8 rounded-3xl space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-sky-600" />
                  <span>بيانات الحساب وتوثيق الجوال</span>
                </h3>
                <span
                  className={`text-[11px] font-bold px-3 py-1 rounded-full ${
                    customer.phoneVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {customer.phoneVerified ? 'رقم الجوال موثق ✓' : 'توثيق تدريجي مطلوب عند الاستبدال'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">الاسم الأول</label>
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    required
                    className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">الاسم الثاني</label>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    required
                    className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    required
                    className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">رقم الجوال</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="text"
                      dir="ltr"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      required
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 font-mono min-h-[44px]"
                    />
                    {!customer.phoneVerified && (
                      <button
                        type="button"
                        onClick={async () => {
                          setOtpRequested(true);
                          await onUpdateCustomer({ requestOtp: true });
                        }}
                        className="bg-gradient-gold-cta text-[#0B1F3A] font-black px-3 rounded-xl shrink-0 min-h-[44px]"
                      >
                        توثيق OTP
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {otpRequested && !customer.phoneVerified && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-3 text-xs">
                  <span className="font-bold text-amber-900">أدخل رمز التحقق المرسل لجوالك (للتجربة: 1234):</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value)}
                      placeholder="1234"
                      className="bg-white border border-amber-300 rounded-xl px-3 py-2 font-mono w-28 text-center min-h-[40px]"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl min-h-[40px]"
                    >
                      تأكيد الرمز
                    </button>
                  </div>
                </div>
              )}

              <button type="submit" className="bg-[#0B1F3A] hover:bg-[#10325E] text-white font-bold px-6 py-2.5 rounded-xl text-xs min-h-[44px]">
                حفظ البيانات الشخصية
              </button>
            </form>

            {/* Real Password Change Form */}
            <form onSubmit={handlePasswordSubmit} className="glass-card p-6 sm:p-8 rounded-3xl space-y-4">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-sky-600" />
                <span>تغيير كلمة المرور (موثق على الخادم)</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="كلمة المرور الحالية"
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 min-h-[44px]"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="كلمة المرور الجديدة (6 أحرف+)"
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 min-h-[44px]"
                />
                <button
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2.5 rounded-xl min-h-[44px]"
                >
                  تحديث كلمة المرور
                </button>
              </div>
              {passwordStatusMsg && <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{passwordStatusMsg}</p>}
            </form>

            {/* Filtered Transactions History + Dispute Action */}
            <div className="glass-card p-6 sm:p-8 rounded-3xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Filter className="w-5 h-5 text-sky-600" />
                  <span>سجل العمليات والفلاتر</span>
                </h3>
                <div className="flex flex-wrap gap-2 text-xs">
                  <input
                    type="text"
                    value={txSearch}
                    onChange={(e) => setTxSearch(e.target.value)}
                    placeholder="رقم الفاتورة / الفرع..."
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 min-h-[40px]"
                  />
                  <select
                    value={txStoreFilter}
                    onChange={(e) => setTxStoreFilter(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold min-h-[40px]"
                  >
                    <option value="الكل">كل المتاجر</option>
                    {customer.cards.map((c) => (
                      <option key={c.storeId} value={c.storeId}>
                        {c.storeName}
                      </option>
                    ))}
                  </select>
                  <select
                    value={txTypeFilter}
                    onChange={(e) => setTxTypeFilter(e.target.value as 'الكل' | Transaction['type'])}
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold min-h-[40px]"
                  >
                    <option value="الكل">كل الأنواع</option>
                    <option value="purchase">شراء ونقاط</option>
                    <option value="stamp">ختم</option>
                    <option value="redemption">صرف مكافأة</option>
                    <option value="refund">استرجاع</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                      <th className="py-3 px-3">الفاتورة</th>
                      <th className="py-3 px-3">المتجر والفرع</th>
                      <th className="py-3 px-3">النوع</th>
                      <th className="py-3 px-3">المبلغ</th>
                      <th className="py-3 px-3">النقاط</th>
                      <th className="py-3 px-3">التوقيت</th>
                      <th className="py-3 px-3">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredTransactions.map((tx) => (
                      <tr key={tx.id}>
                        <td className="py-3 px-3 font-mono font-bold text-sky-700 dark:text-sky-400">{tx.invoiceNumber}</td>
                        <td className="py-3 px-3">
                          {tx.storeName} ({tx.branchName})
                        </td>
                        <td className="py-3 px-3">
                          {tx.type === 'purchase'
                            ? 'شراء ونقاط'
                            : tx.type === 'stamp'
                              ? 'إضافة ختم'
                              : tx.type === 'redemption'
                                ? 'صرف مكافأة'
                                : 'استرجاع'}
                        </td>
                        <td className="py-3 px-3 font-bold">{formatCurrency(tx.amount, tx.currency)}</td>
                        <td className={`py-3 px-3 font-black ${tx.pointsEarned >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {tx.pointsEarned >= 0 ? `+${tx.pointsEarned}` : tx.pointsEarned}
                        </td>
                        <td className="py-3 px-3 text-slate-500">{tx.timestamp}</td>
                        <td className="py-3 px-3">
                          <button
                            type="button"
                            onClick={() => handleDisputeFromTransaction(tx)}
                            className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline whitespace-nowrap"
                          >
                            أعترض على عملية
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notification Preferences & Privacy & Anonymization Delete */}
            <div className="glass-card p-6 sm:p-8 rounded-3xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">تفضيلات الإشعارات، Web Push والخصوصية</h3>
                <button
                  type="button"
                  onClick={handleEnableWebPush}
                  className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 min-h-[40px]"
                >
                  <Bell className="w-4 h-4" />
                  <span>{prefs.pushSubscribed ? 'إشعارات المتصفح مفعلة ✓ (اختبار)' : 'تفعيل Web Push'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <label className="flex items-center justify-between bg-white/80 dark:bg-slate-800/70 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">تنبيه مكافأة جاهزة للصرف</p>
                    <p className="text-[11px] text-slate-500">إشعار فوري عند اكتمال نقاط أو أختام الجائزة.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.readyRewardAlert}
                    onChange={(e) => onUpdateCustomer({ notificationPrefs: { readyRewardAlert: e.target.checked } })}
                    className="w-5 h-5 accent-sky-600"
                  />
                </label>

                <label className="flex items-center justify-between bg-white/80 dark:bg-slate-800/70 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">تنبيه عروض المتاجر المتابعة</p>
                    <p className="text-[11px] text-slate-500">عروض ومضاعفة نقاط المتاجر التي تتابعها.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.newOfferAlert}
                    onChange={(e) => onUpdateCustomer({ notificationPrefs: { newOfferAlert: e.target.checked } })}
                    className="w-5 h-5 accent-sky-600"
                  />
                </label>

                <label className="flex items-center justify-between bg-white/80 dark:bg-slate-800/70 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">تحذير انتهاء النقاط (14 يوم و3 أيام)</p>
                    <p className="text-[11px] text-slate-500">تذكيرك قبل انتهاء صلاحية نقاطك.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.expiry14DayAlert && prefs.expiry3DayAlert}
                    onChange={(e) =>
                      onUpdateCustomer({
                        notificationPrefs: {
                          expiry14DayAlert: e.target.checked,
                          expiry3DayAlert: e.target.checked,
                        },
                      })
                    }
                    className="w-5 h-5 accent-sky-600"
                  />
                </label>

                <div className="flex items-center justify-between bg-white/80 dark:bg-slate-800/70 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 gap-2">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">تذكير بعد غياب ({prefs.absenceReminderDays} يوم)</p>
                    <p className="text-[11px] text-slate-500">عدد الأيام الافتراضي قابل للتعديل.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={prefs.absenceReminderDays}
                      onChange={(e) =>
                        onUpdateCustomer({
                          notificationPrefs: { absenceReminderDays: Number(e.target.value) },
                        })
                      }
                      className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 font-bold text-xs"
                    >
                      <option value={14}>14 يوم</option>
                      <option value={30}>30 يوم</option>
                      <option value={45}>45 يوم</option>
                      <option value={60}>60 يوم</option>
                    </select>
                    <input
                      type="checkbox"
                      checked={prefs.absenceReminderEnabled}
                      onChange={(e) =>
                        onUpdateCustomer({ notificationPrefs: { absenceReminderEnabled: e.target.checked } })
                      }
                      className="w-5 h-5 accent-sky-600"
                    />
                  </div>
                </div>

                <label className="flex items-center justify-between bg-white/80 dark:bg-slate-800/70 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">موافقة الرسائل التسويقية (Opt-in)</p>
                    <p className="text-[11px] text-slate-500">يمكنك سحب موافقتك في أي لحظة بضغطة واحدة.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={customer.marketingConsent}
                    onChange={(e) => onUpdateCustomer({ marketingConsent: e.target.checked })}
                    className="w-5 h-5 accent-sky-600"
                  />
                </label>

                <div className="md:col-span-2 bg-gradient-to-r from-sky-50 to-amber-50 dark:from-slate-800 dark:to-slate-800/80 p-4 rounded-2xl border border-sky-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black text-sm text-[#0B1F3A] dark:text-white flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-[#007BFF]" />
                        <span>نظام تنبيهات المواقع الجغرافية والعروض القريبة (Geofencing)</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        استلام إشعارات فورية وبانرات صوتية واهتزاز عند الاقتراب من فروع المتاجر التي تقدم عروضاً أو مضاعفة نقاط.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={customer.geoProximityConsent}
                      onChange={(e) => onUpdateCustomer({ geoProximityConsent: e.target.checked })}
                      className="w-5 h-5 accent-sky-600 cursor-pointer"
                    />
                  </div>

                  {customer.geoProximityConsent && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2.5 border-t border-slate-200/70 dark:border-slate-700/60 text-xs">
                      <div className="space-y-1">
                        <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                          نطاق الرادار المفضل:
                        </label>
                        <select
                          value={prefs.geoRadiusMeters || geoRadiusMeters}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setGeoRadiusMeters(val);
                            onUpdateCustomer({ notificationPrefs: { geoRadiusMeters: val } });
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 font-bold cursor-pointer"
                        >
                          <option value={500}>500 متر (مشياً على الأقدام)</option>
                          <option value={1500}>1.5 كم (المحيط المباشر)</option>
                          <option value={3000}>3 كم (المنطقة والحي)</option>
                          <option value={5000}>5 كم (المحافظة / المدينة)</option>
                          <option value={10000}>10 كم (كل المدينة)</option>
                        </select>
                      </div>

                      <label className="flex items-center justify-between p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                        <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300">
                          صوت التنبيه والاهتزاز
                        </span>
                        <input
                          type="checkbox"
                          checked={prefs.geoSoundEnabled ?? geoSoundEnabled}
                          onChange={(e) => {
                            setGeoSoundEnabled(e.target.checked);
                            onUpdateCustomer({ notificationPrefs: { geoSoundEnabled: e.target.checked } });
                          }}
                          className="w-4 h-4 accent-sky-600"
                        />
                      </label>

                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => handleSimulateWalkInNearStore()}
                          className="w-full py-2 px-3 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] font-black text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer hover:opacity-95 transition"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>تجربة تنبيه اقتراب حي ⚡</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 dark:border-slate-700">
                <Link
                  href="/privacy"
                  className="text-xs font-bold text-sky-700 dark:text-sky-400 hover:underline flex items-center gap-1"
                >
                  <span>سياسة الخصوصية وحماية البيانات</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => setShowDeleteAccountModal(true)}
                  className="text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-3.5 py-2 rounded-xl flex items-center gap-1.5 min-h-[40px]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف الحساب (إخفاء الهوية)</span>
                </button>
              </div>
            </div>

            {/* Support / Dispute Form */}
            <div ref={disputeSectionRef} className="glass-card p-6 sm:p-8 rounded-3xl space-y-4">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <MessageSquareWarning className="w-5 h-5 text-amber-600" />
                <span>الاعتراض على عملية أو إرسال تذكرة دعم</span>
              </h3>
              <form onSubmit={handleSubmitDispute} className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="عنوان الاعتراض..."
                    value={disputeSubject}
                    onChange={(e) => setDisputeSubject(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 min-h-[44px]"
                  />
                  <input
                    type="text"
                    placeholder="رقم الفاتورة المرجعي (اختياري)..."
                    value={disputeInvoice}
                    onChange={(e) => setDisputeInvoice(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 font-mono min-h-[44px]"
                  />
                </div>
                <textarea
                  rows={3}
                  placeholder="اشرح تفاصيل الاعتراض..."
                  value={disputeMsg}
                  onChange={(e) => setDisputeMsg(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-3"
                />
                <button type="submit" className="bg-gradient-gold-cta text-[#0B1F3A] font-black px-6 py-2.5 rounded-xl min-h-[44px]">
                  إرسال تذكرة الاعتراض
                </button>
              </form>

              {tickets.length > 0 && (
                <div className="pt-2 space-y-2">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">تذاكرك:</p>
                  {tickets.map((t) => (
                    <div
                      key={t.id}
                      className="bg-white/80 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                    >
                      <span className="font-bold text-slate-800 dark:text-white">{t.subject}</span>
                      <span className="bg-sky-50 text-sky-700 font-bold px-2.5 py-0.5 rounded-full">{t.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 8: طلباتي الأونلاين والتوصيل */}
        {activeTab === 'orders' && (
          <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Truck className="w-6 h-6 text-emerald-600" />
                  <span>طلباتي الأونلاين والتوصيل 🛵</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  تتبع مسار وحالة طلباتك للمطاعم والمتاجر مباشرة والتواصل السريع عبر واتساب
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('explore')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm min-h-[42px] cursor-pointer transition"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>طلب جديد من متجر</span>
                </button>
                <button
                  type="button"
                  onClick={loadCustomerOrders}
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 min-h-[42px] min-w-[42px] flex items-center justify-center transition"
                  title="تحديث قائمة الطلبات"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {customerOrders.length === 0 ? (
              <div className="glass-card rounded-3xl p-10 text-center space-y-4 border border-dashed border-slate-300 dark:border-slate-700">
                <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto text-2xl">
                  🛵
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  لم تقم بإجراء أي طلبات حتى الآن
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  تصفح المتاجر والمطاعم المشتركة، اختر وجباتك ومشترياتك وحدد التوصيل أو الاستلام، وسيتم إعداد الطلب ورسالة الواتساب فوراً.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('explore')}
                  className="bg-gradient-gold-cta text-[#0B1F3A] font-black px-6 py-3 rounded-xl text-xs sm:text-sm shadow-md hover:opacity-95 transition"
                >
                  استكشاف المتاجر والقوائم 👈
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {customerOrders.map((order) => {
                  const statusConfig: Record<string, { label: string; bg: string; text: string; icon: string }> = {
                    PENDING: { label: 'بانتظار موافقة الكاشير', bg: 'bg-amber-100 dark:bg-amber-950/60', text: 'text-amber-800 dark:text-amber-300', icon: '⏳' },
                    ACCEPTED: { label: 'تم قبول الطلب', bg: 'bg-blue-100 dark:bg-blue-950/60', text: 'text-blue-800 dark:text-blue-300', icon: '👍' },
                    PREPARING: { label: 'قيد التحضير والتجهيز', bg: 'bg-indigo-100 dark:bg-indigo-950/60', text: 'text-indigo-800 dark:text-indigo-300', icon: '👨‍🍳' },
                    READY: { label: 'جاهز للاستلام من الفرع', bg: 'bg-teal-100 dark:bg-teal-950/60', text: 'text-teal-800 dark:text-teal-300', icon: '📦' },
                    OUT_FOR_DELIVERY: { label: 'في الطريق مع مندوب التوصيل', bg: 'bg-purple-100 dark:bg-purple-950/60', text: 'text-purple-800 dark:text-purple-300', icon: '🛵' },
                    COMPLETED: { label: 'مكتمل بنجاح', bg: 'bg-emerald-100 dark:bg-emerald-950/60', text: 'text-emerald-800 dark:text-emerald-300', icon: '✅' },
                    REJECTED: { label: 'تم الاعتذار عن الطلب', bg: 'bg-rose-100 dark:bg-rose-950/60', text: 'text-rose-800 dark:text-rose-300', icon: '❌' },
                  };

                  const cfg = statusConfig[order.status] || {
                    label: order.status,
                    bg: 'bg-slate-100 dark:bg-slate-800',
                    text: 'text-slate-800 dark:text-slate-200',
                    icon: '📋',
                  };

                  return (
                    <div
                      key={order.id}
                      className="glass-card rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 space-y-4 hover:shadow-md transition"
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded">
                              {order.orderNumber}
                            </span>
                            <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                              {order.storeName}
                            </h3>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {new Date(order.createdAt).toLocaleString('ar-SA', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-black px-3 py-1 rounded-full flex items-center gap-1 ${cfg.bg} ${cfg.text}`}>
                            <span>{cfg.icon}</span>
                            <span>{cfg.label}</span>
                          </span>
                          <span className="text-xs font-bold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {order.orderType === 'DELIVERY' ? 'توصيل منزلي 🛵' : 'استلام من الفرع 🛍️'}
                          </span>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="space-y-1.5 text-xs">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                            <span>
                              {item.quantity} × {item.title}
                            </span>
                            <span className="font-bold">
                              {formatCurrency(item.price * item.quantity, order.currency)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Address or pickup note */}
                      {order.orderType === 'DELIVERY' && order.deliveryAddress && (
                        <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">عنوان التوصيل: </span>
                            <span>{order.deliveryAddress}</span>
                          </div>
                        </div>
                      )}

                      {order.rejectionReason && (
                        <div className="bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">سبب الاعتذار: </span>
                            <span>{order.rejectionReason}</span>
                          </div>
                        </div>
                      )}

                      {/* Totals & WhatsApp confirmation */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs text-slate-500">الإجمالي النهائي:</span>
                          <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(order.total, order.currency)}
                          </span>
                          {order.deliveryFee ? (
                            <span className="text-[10px] text-slate-400 font-medium">
                              (شامل التوصيل {formatCurrency(order.deliveryFee, order.currency)})
                            </span>
                          ) : null}
                        </div>

                        {(() => {
                          const targetStore = stores.find((s) => s.id === order.storeId);
                          const storeWaPhone = (
                            targetStore?.whatsappOrdersNumber ||
                            targetStore?.phone ||
                            '+966501112233'
                          ).replace(/[^0-9]/g, '');
                          const waHref = `https://wa.me/${storeWaPhone}?text=${encodeURIComponent(
                            order.whatsappMessage ||
                              `مرحباً ${order.storeName}، بخصوص طلبي رقم ${order.orderNumber}`
                          )}`;
                          return (
                            <a
                              href={waHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition"
                            >
                              <MessageCircle className="w-4 h-4" />
                              <span>مراسلة المتجر عبر واتساب 💬</span>
                            </a>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Mobile Bottom Thumb-Zone 7-Tab Navigation Bar (< md) */}
      <nav
        aria-label="تنقل العميل السريع"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#0B1F3A]/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 px-1 py-1.5 shadow-2xl"
      >
        <div className="grid grid-cols-8 gap-0.5">
          {navItems.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[50px] relative rounded-xl flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold transition-all ${
                  active
                    ? 'bg-gradient-gold-cta text-[#0B1F3A] font-black shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <div className="relative">
                  <Icon className="w-4 h-4" />
                  {tab.id === 'geo_radar' && unreadGeoAlertsCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
                  )}
                </div>
                <span className="truncate max-w-full px-0.5">{tab.mobileLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Card Detail Modal (Design, Stamps/Points, Progress, Rules, Branches, History, Vouchers) */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#0f1b30] rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl border border-sky-100 dark:border-slate-700 text-right">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={selectedCard.storeLogo}
                  alt={selectedCard.storeName}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-2xl object-cover border border-slate-200"
                />
                <div>
                  <h3 className="font-black text-lg text-slate-900 dark:text-white">{selectedCard.storeName}</h3>
                  <p className="text-xs text-slate-500">تفاصيل البطاقة والقواعد والفروع والسجل</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCardId(null)}
                className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div
              className={`relative overflow-hidden bg-gradient-to-br ${resolveCardGradientClass(
                selectedCard.cardColor
              )} ${resolveCardTextStyle(selectedCard.cardTextColor).className} p-6 rounded-2xl space-y-3 shadow-lg`}
              style={{
                backgroundImage: resolveCardCssGradient(selectedCard.cardColor),
                ...resolveCardTextStyle(selectedCard.cardTextColor).style,
              }}
            >
              {selectedCard.cardPattern && selectedCard.cardPattern !== 'none' && (
                <div
                  className="pointer-events-none absolute inset-0"
                  style={getCardPatternConfig(selectedCard.cardPattern).overlayStyle}
                />
              )}
              <div className="relative z-10 flex items-center justify-between">
                <span className="text-xs opacity-80">الرصيد المتاح ({selectedCard.currency})</span>
                <span className="text-3xl font-black">
                  {selectedCard.currentBalance}{' '}
                  {selectedCard.rule.type === 'points'
                    ? `/ ${selectedCard.rule.rewardTargetPoints || 100} نقطة`
                    : `/ ${selectedCard.rule.stampsRequired || 6} أختام`}
                </span>
              </div>
              <p
                className={`relative z-10 text-xs opacity-95 border-t pt-2 ${
                  isLightCardTextColor(selectedCard.cardTextColor) ? 'border-[#0B1F3A]/15' : 'border-white/20'
                }`}
              >
                <strong>القواعد:</strong> {selectedCard.rule.rewardDescription}
              </p>
            </div>

            {selectedCardStore && (
              <div className="space-y-2">
                <h4 className="font-black text-xs text-slate-700 dark:text-slate-200">الفروع المشاركة</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {selectedCardStore.branches.map((br) => (
                    <div
                      key={br.id}
                      className="bg-slate-50 dark:bg-slate-800/70 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1"
                    >
                      <p className="font-black text-slate-900 dark:text-white">{br.name}</p>
                      <p className="text-slate-500">
                        {br.city} — {br.area}
                      </p>
                      <p className="font-mono text-sky-700 dark:text-sky-400 flex items-center gap-1" dir="ltr">
                        <PhoneCall className="w-3 h-3" /> {br.phone}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="font-black text-xs text-slate-700 dark:text-slate-200">سجل عمليات هذا المتجر</h4>
              <div className="space-y-2 text-xs">
                {transactions.filter((tx) => tx.storeId === selectedCard.storeId).length === 0 ? (
                  <p className="text-slate-500">لا توجد عمليات مسجلة لهذه البطاقة بعد.</p>
                ) : (
                  transactions
                    .filter((tx) => tx.storeId === selectedCard.storeId)
                    .map((tx) => (
                      <div
                        key={tx.id}
                        className="bg-slate-50 dark:bg-slate-800/70 p-3 rounded-xl flex items-center justify-between"
                      >
                        <div>
                          <span className="font-mono font-bold text-sky-700 dark:text-sky-400">{tx.invoiceNumber}</span>
                          <span className="text-slate-500 mr-2">{tx.timestamp}</span>
                        </div>
                        <span className={`font-black ${tx.pointsEarned >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {tx.pointsEarned >= 0 ? `+${tx.pointsEarned}` : tx.pointsEarned}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>

            {customer.vouchers.some((v) => v.storeId === selectedCard.storeId) && (
              <div className="space-y-2">
                <h4 className="font-black text-xs text-slate-700 dark:text-slate-200">قسائمك الرقمية في هذا المتجر</h4>
                <div className="space-y-2 text-xs">
                  {customer.vouchers
                    .filter((v) => v.storeId === selectedCard.storeId)
                    .map((v) => (
                      <div
                        key={v.id}
                        className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3 rounded-xl flex items-center justify-between"
                      >
                        <span className="font-bold text-emerald-900 dark:text-emerald-200">{v.title}</span>
                        <span className="font-mono font-black text-emerald-700 dark:text-emerald-300">{v.code}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2nd In-App Confirmation Modal for High-Value Rewards */}
      {pendingRedemption && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0f1b30] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-amber-200 dark:border-amber-800/50 text-right">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-black text-lg text-slate-900 dark:text-white">تأكيد إضافي لصرف المكافأة</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              أنت على وشك خصم <strong>{pendingRedemption.pointsCost} نقطة</strong> من رصيدك لدى{' '}
              <strong>{pendingRedemption.storeName}</strong> لإصدار قسيمة <strong>{pendingRedemption.title}</strong>. لا يمكن التراجع بعد إصدار القسيمة.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={redeeming}
                onClick={handleConfirmHighValueRedeem}
                className="flex-1 bg-gradient-gold-cta text-[#0B1F3A] font-black py-3 rounded-xl text-xs min-h-[44px]"
              >
                {redeeming ? 'جاري التنفيذ...' : 'نعم، تأكيد الصرف الآن'}
              </button>
              <button
                type="button"
                onClick={() => setPendingRedemption(null)}
                className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs min-h-[44px]"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency "Lost Phone" Confirmation Modal */}
      {showLostPhoneModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0f1b30] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-rose-200 dark:border-rose-800/50 text-right">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <Smartphone className="w-6 h-6" />
            </div>
            <h3 className="font-black text-lg text-slate-900 dark:text-white">بلاغ «فقدت هاتفي» الفوري</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              سيقوم الخادم فوراً بإبطال مفتاح رمز QR الحالي (<code className="font-mono">{customer.qrKeyId}</code>) وإيقاف كافة رموز QR المخزنة مسبقاً وإنهاء كل الجلسات على جميع الأجهزة وتسجيل الحدث في AuditLog.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={async () => {
                  setShowLostPhoneModal(false);
                  await onUpdateCustomer({ lostPhone: true });
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-black py-3 rounded-xl text-xs min-h-[44px]"
              >
                إبطال المفاتيح وإنهاء الجلسات الآن
              </button>
              <button
                type="button"
                onClick={() => setShowLostPhoneModal(false)}
                className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs min-h-[44px]"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Deletion = Anonymization Confirmation Modal */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0f1b30] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-rose-200 dark:border-rose-800/50 text-right">
            <h3 className="font-black text-lg text-rose-700 dark:text-rose-400">حذف الحساب وإخفاء الهوية (Anonymization)</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              سيتم حذف اسمك وبريدك ورقم جوالك ورموز QR وإغلاق كافة الجلسات نهائياً، مع الإبقاء فقط على قيود المعاملات المالية مجهولة الهوية لحفظ حقوق المتاجر. اكتب <strong>حذف</strong> للتأكيد:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="اكتب: حذف"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-rose-300 dark:border-rose-700 rounded-xl px-3.5 py-2.5 text-sm"
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={deleteConfirmText.trim() !== 'حذف'}
                onClick={async () => {
                  setShowDeleteAccountModal(false);
                  await onAnonymizeAccount();
                }}
                className="flex-1 bg-rose-600 disabled:opacity-40 text-white font-black py-3 rounded-xl text-xs min-h-[44px]"
              >
                تأكيد حذف وإخفاء الهوية نهائياً
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteAccountModal(false);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs min-h-[44px]"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Master Card Action Modal (Share to Store / Gift to User / Convert to Voucher) */}
      {accountModalMode && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setAccountModalMode(null)}
        >
          <form
            onSubmit={handleSubmitAccountAction}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#0f1b30] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-amber-300/60 dark:border-amber-700 text-right"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    {accountModalMode === 'share_to_store'
                      ? 'مشاركة نقاط الحساب مع متجر شريك'
                      : accountModalMode === 'gift_to_user'
                      ? 'إهداء نقاط من بطاقة الحساب لصديق'
                      : 'تحويل نقاط الحساب إلى قسيمة خصم فورية'}
                  </h3>
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    رصيد بطاقة الحساب المتاح: {customer.accountPointsBalance ?? 350} نقطة
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAccountModalMode(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {(accountModalMode === 'share_to_store' || accountModalMode === 'convert_to_voucher') && (
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 dark:text-slate-200 block">
                  اختر المتجر المستفيد
                </label>
                <select
                  value={accountTargetStoreId}
                  onChange={(e) => setAccountTargetStoreId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold"
                >
                  {stores.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.city})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {accountModalMode === 'gift_to_user' && (
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 dark:text-slate-200 block">
                  معرّف المستلم (اسم المستخدم أو الجوال أو كود البطاقة)
                </label>
                <input
                  type="text"
                  required
                  value={accountGiftRecipient}
                  onChange={(e) => setAccountGiftRecipient(e.target.value)}
                  placeholder="مثال: @sara أو 0559876543 أو SARA2026"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold"
                />
                <span className="text-[10px] text-slate-500 block">
                  للتجربة الفورية يمكنك الإهداء إلى الحساب التجريبي: <code className="font-mono font-bold">@sara</code>
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 dark:text-slate-200 block">
                عدد النقاط المطلوب استخدامها
              </label>
              <input
                type="number"
                min={10}
                max={customer.accountPointsBalance ?? 350}
                value={accountActionPoints}
                onChange={(e) => setAccountActionPoints(Math.max(1, Number(e.target.value) || 0))}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-black tabular-nums"
              />
              {accountModalMode === 'convert_to_voucher' && (
                <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  قيمة قسيمة الخصم الفورية: {Math.max(5, Math.round(accountActionPoints * 0.25))} ر.س
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
                ملاحظة أو رسالة إهداء (اختياري)
              </label>
              <input
                type="text"
                value={accountActionNote}
                onChange={(e) => setAccountActionNote(e.target.value)}
                placeholder="مثال: هدية قهوة الصباح..."
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={accountActionSubmitting}
                className="flex-1 bg-gradient-gold-cta text-[#0B1F3A] font-black py-3 rounded-xl text-xs min-h-[44px] cursor-pointer"
              >
                {accountActionSubmitting ? 'جاري التنفيذ...' : 'تأكيد وتنفيذ العملية فوراً'}
              </button>
              <button
                type="button"
                onClick={() => setAccountModalMode(null)}
                className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs min-h-[44px]"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* High-Res Phone Pass Saver Modal (Cards & Vouchers) */}
      {phonePassPreview && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPhonePassPreview(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#0f1b30] rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-700 text-right max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">{phonePassPreview.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{phonePassPreview.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setPhonePassPreview(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Live Pass Visual Theme Selector */}
            {phonePassPreview.baseOptions && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-black text-slate-600 dark:text-slate-300 block">
                  تخصيص مظهر ولون البطاقة قبل الحفظ في الهاتف:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PASS_THEME_PRESETS.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => handleSwitchPassTheme(theme.id)}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                        phonePassPreview.selectedTheme === theme.id
                          ? 'bg-[#0B1F3A] text-white border-sky-400 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-white/40 shrink-0"
                        style={{ backgroundColor: theme.swatchHex }}
                      />
                      <span>{theme.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950 flex justify-center p-2">
              <img
                src={phonePassPreview.dataUrl}
                alt={phonePassPreview.title}
                className="w-full max-w-[295px] h-auto object-contain rounded-xl shadow-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleDownloadPhonePass}
                className="bg-gradient-gold-cta text-[#0B1F3A] font-black py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 min-h-[44px] cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>تنزيل وحفظ للهاتف (PNG)</span>
              </button>
              <button
                type="button"
                onClick={handleSharePhonePass}
                className="bg-[#0B1F3A] hover:bg-[#132E57] text-white font-black py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-[#00C2FF]" />
                <span>مشاركة سريعة للهاتف</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleCopyText(phonePassPreview.code, 'كود البطاقة/القسيمة')}
              className="w-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 min-h-[42px] cursor-pointer"
            >
              <Copy className="w-4 h-4" />
              <span>نسخ كود البطاقة/القسيمة ({phonePassPreview.code})</span>
            </button>
          </div>
        </div>
      )}

      {/* Real-time Geofence Proximity Alert Banner */}
      <GeoAlertBanner
        alert={bannerAlert}
        onDismiss={() => setBannerAlert(null)}
        onOpenStoreCard={(storeId) => setSelectedCardId(storeId)}
        onViewAllAlerts={() => setActiveTab('geo_radar')}
        soundEnabled={geoSoundEnabled}
      />

      {/* Geofence & Offers Notification Drawer */}
      <GeoAlertsDrawer
        isOpen={isAlertsDrawerOpen}
        onClose={() => setIsAlertsDrawerOpen(false)}
        alerts={geoAlerts}
        onMarkAsRead={(id) => setReadAlertIds((prev) => new Set(prev).add(id))}
        onMarkAllAsRead={() => setReadAlertIds(new Set(geoAlerts.map((a) => a.id)))}
        onClearAll={() => setDismissedAlertIds(new Set(rawGeoAlerts.map((a) => a.id)))}
        onOpenStoreCard={(storeId) => setSelectedCardId(storeId)}
        onGoToRadarTab={() => setActiveTab('geo_radar')}
        onSimulateWalkIn={() => handleSimulateWalkInNearStore()}
        currentLocationName={userLocationName}
        isGpsActive={isGpsActive}
        soundEnabled={geoSoundEnabled}
        onToggleSound={(enabled) => {
          setGeoSoundEnabled(enabled);
          onUpdateCustomer({ notificationPrefs: { geoSoundEnabled: enabled } });
        }}
      />

      {/* Online Store & WhatsApp Ordering Modal */}
      {orderingStore && (
        <OnlineOrderingModal
          isOpen={Boolean(orderingStore)}
          onClose={() => setOrderingStore(null)}
          store={orderingStore}
          customer={customer}
          onOrderSuccess={(order) => {
            setCustomerOrders((prev) => [order, ...prev]);
            setActiveTab('orders');
          }}
        />
      )}
    </div>
  );
}
