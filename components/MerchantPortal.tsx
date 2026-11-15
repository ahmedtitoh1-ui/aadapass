'use client';

import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import * as XLSX from 'xlsx';
import {
  Branch,
  CashierStaff,
  LoyaltyProgram,
  MarketCurrency,
  MenuItem,
  MerchantCrmCustomerDTO,
  MerchantVoucher,
  PartnerPointShare,
  PointTier,
  PointsCalcMode,
  SessionUser,
  Store,
  StoreCardDesign,
  SubscriptionPackage,
  SupportTicket,
  Transaction,
} from '@/lib/types';
import { AR_TRANSLATIONS, formatCurrency } from '@/lib/i18n/ar';
import {
  calculatePointsForAmount,
  getCardPatternConfig,
  resolveCardCssGradient,
  resolveCardGradientClass,
  resolveCardTextStyle,
} from '@/lib/cardDesignLibrary';
import {
  SMART_PAUSE_NOTICE,
  getEffectiveSubscriptionState,
  isStoreSubscriptionPaused,
} from '@/lib/subscriptionStatus';
import Link from 'next/link';
import { authFetch } from '@/lib/clientAuth';
import LoyaltyCardStudio from './LoyaltyCardStudio';
import WhatsappRequestModal from './WhatsappRequestModal';
import LiveOrdersManager from './LiveOrdersManager';
import {
  AlertTriangle,
  Award,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Download,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  Gift,
  Handshake,
  History,
  Image as ImageIcon,
  KeyRound,
  Layers,
  Lock,
  LogOut,
  MapPin,
  MessageCircle,
  Percent,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Settings,
  Share2,
  Shield,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Store as StoreIcon,
  Ticket,
  Trash2,
  TrendingUp,
  Upload,
  UserCheck,
  Users,
  Radio,
  Navigation,
  Truck,
  Zap,
  X,
} from 'lucide-react';

export interface StaffMutationPayload {
  active?: boolean;
  tempPassword?: string;
  permissions?: string[];
}

interface MerchantPortalProps {
  sessionUser: SessionUser;
  store: Store;
  packages: SubscriptionPackage[];
  transactions: Transaction[];
  tickets: SupportTicket[];
  crmCustomers?: MerchantCrmCustomerDTO[];
  staffActivity?: Record<string, { txCount: number; totalAmount: number }>;
  onUpdateStore: (updated: Store) => Promise<void>;
  onCreateStaff?: (payload: {
    merchantId: string;
    name: string;
    username: string;
    tempPassword: string;
    role: 'CASHIER' | 'MERCHANT_MANAGER';
    branchIds: string[];
  }) => Promise<{ ok: boolean; error?: string }>;
  onMutateStaff?: (
    merchantId: string,
    staffId: string,
    payload: StaffMutationPayload
  ) => Promise<{ ok: boolean; error?: string }>;
  onDeleteStaff?: (merchantId: string, staffId: string) => Promise<{ ok: boolean; error?: string }>;
  onApproveRefund?: (txId: string) => Promise<void>;
  onChangePassword?: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ ok: boolean; error?: string }>;
  onRefreshDashboard?: () => Promise<void>;
  onAddTicket: (payload: { subject: string; invoiceRef?: string; message: string }) => Promise<void>;
  onLogoutAll: () => Promise<void>;
  adminWhatsappNumber?: string;
}

type MerchantTab =
  | 'dashboard'
  | 'card-designer'
  | 'card-review'
  | 'menu'
  | 'offers'
  | 'online-orders'
  | 'programs'
  | 'branches'
  | 'staff'
  | 'customers'
  | 'reports'
  | 'point-sharing'
  | 'subscription'
  | 'settings';

let merchantIdSeq = 6000;
const nextId = (prefix: string) => `${prefix}-${++merchantIdSeq}`;

const ALLOWED_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export default function MerchantPortal({
  sessionUser,
  store,
  packages,
  transactions,
  tickets,
  crmCustomers = [],
  staffActivity = {},
  onUpdateStore,
  onCreateStaff,
  onMutateStaff,
  onDeleteStaff,
  onApproveRefund,
  onChangePassword,
  onRefreshDashboard,
  onAddTicket,
  onLogoutAll,
  adminWhatsappNumber = '966500000000',
}: MerchantPortalProps) {
  const isOwner = sessionUser.role === 'MERCHANT_OWNER' || sessionUser.role === 'PLATFORM_ADMIN';
  const allowedBranchIds =
    sessionUser.branchIds && sessionUser.branchIds.length > 0
      ? sessionUser.branchIds
      : sessionUser.branchId
      ? [sessionUser.branchId]
      : [];

  const [activeTab, setActiveTab] = useState<MerchantTab>('dashboard');
  const [settingsSubTab, setSettingsSubTab] = useState<'store-profile' | 'security-caps' | 'disputes'>('store-profile');
  const [editingCardDesign, setEditingCardDesign] = useState<StoreCardDesign | null>(null);
  const [printingCardDesign, setPrintingCardDesign] = useState<StoreCardDesign | null>(null);
  const [loadedCrmCustomers, setLoadedCrmCustomers] = useState<MerchantCrmCustomerDTO[]>([]);
  const [partnerStoresList, setPartnerStoresList] = useState<
    { id: string; name: string; category: string; city: string }[]
  >([]);

  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [waModalState, setWaModalState] = useState<{
    isOpen: boolean;
    mode: 'package' | 'service';
    packageTitle?: string;
    priceSummary?: string;
  }>({ isOpen: false, mode: 'service' });
  const [posterOrigin, setPosterOrigin] = useState('https://aadapass.sa');
  const [posterQrDataUrl, setPosterQrDataUrl] = useState('');
  const [copiedPosterUrl, setCopiedPosterUrl] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // Load CRM customers & partner stores so targeted vouchers and point-sharing always have live lists
  useEffect(() => {
    let active = true;
    authFetch(`/api/merchant/${encodeURIComponent(store.merchantId)}/dashboard`, {
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data && Array.isArray(data.crmCustomers)) {
          setLoadedCrmCustomers(data.crmCustomers);
        }
      })
      .catch(() => {});

    fetch('/api/stores', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data && Array.isArray(data.stores)) {
          setPartnerStoresList(
            data.stores
              .filter((s: { id: string }) => s.id !== store.id)
              .map((s: { id: string; name: string; category: string; city: string }) => ({
                id: s.id,
                name: s.name,
                category: s.category,
                city: s.city,
              }))
          );
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [store.merchantId, store.id]);

  // Dashboard filters
  const [dashPeriod, setDashPeriod] = useState<'weekly' | 'monthly' | 'quarterly'>('monthly');
  const [dashBranchId, setDashBranchId] = useState<string>('all');

  // Profile fields (now inside Settings -> Store Profile)
  const [profName, setProfName] = useState(store.name);
  const [profCategory, setProfCategory] = useState<Store['category']>(store.category);
  const [profPhone, setProfPhone] = useState(store.phone);
  const [profCity, setProfCity] = useState(store.city);
  const [profArea, setProfArea] = useState(store.area);
  const [profAddress, setProfAddress] = useState(store.address);
  const [profMapLink, setProfMapLink] = useState(store.googleMapLink);
  const [profWorkingHours, setProfWorkingHours] = useState(
    store.workingHours || 'يومياً 8:00 ص - 12:00 ص'
  );
  const [profWifi, setProfWifi] = useState(store.wifiPassword || 'AadaPass_Guest');
  const [profInstagram, setProfInstagram] = useState(
    store.instagramUrl || 'https://instagram.com/aadapass.sa'
  );
  const [profDesc, setProfDesc] = useState(store.description);
  const [profLogo, setProfLogo] = useState(store.logo);
  const [profSecondaryLogo, setProfSecondaryLogo] = useState(store.secondaryLogo || '');
  const [profCover, setProfCover] = useState(store.cover);
  const [profMenuImages, setProfMenuImages] = useState<string[]>(store.menuImages || []);
  const [newGalleryUrl, setNewGalleryUrl] = useState('');
  const [profStoreGallery, setProfStoreGallery] = useState<string[]>(
    store.storeGallery && store.storeGallery.length > 0
      ? store.storeGallery
      : [
          'https://picsum.photos/seed/cafe-decor-1/900/600',
          'https://picsum.photos/seed/cafe-seating-2/900/600',
        ]
  );
  const [newDecorUrl, setNewDecorUrl] = useState('');

  // Menu form
  const [newItemName, setNewItemName] = useState('');
  const [newItemType, setNewItemType] = useState<'product' | 'service' | 'offer'>('product');
  const [newItemPrice, setNewItemPrice] = useState('25');
  const [newItemCategory, setNewItemCategory] = useState('مشروبات ساخنة');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemImage, setNewItemImage] = useState('');
  const [newItemExpiry, setNewItemExpiry] = useState('');
  const [newItemAvailable, setNewItemAvailable] = useState(true);
  const [newItemBranches, setNewItemBranches] = useState<string[]>(
    store.branches.map((b) => b.id)
  );

  // Vouchers & Offers form (with All vs Specific Customers)
  const [vchTitle, setVchTitle] = useState('');
  const [vchCode, setVchCode] = useState('');
  const [vchDiscount, setVchDiscount] = useState('خصم 15 ر.س');
  const [vchPointsCost, setVchPointsCost] = useState('100');
  const [vchLimit, setVchLimit] = useState('200');
  const [vchExpiry, setVchExpiry] = useState('2026-12-31');
  const [vchAudienceType, setVchAudienceType] = useState<'all' | 'specific'>('all');
  const [vchTargetCustomerIds, setVchTargetCustomerIds] = useState<string[]>([]);
  const [vchCustomerSearch, setVchCustomerSearch] = useState('');

  // Partner Point Sharing form (replacing Campaigns)
  const [sharePartnerStoreId, setSharePartnerStoreId] = useState('');
  const [sharePartnerName, setSharePartnerName] = useState('');
  const [sharePartnerCategory, setSharePartnerCategory] = useState('متجر شريك');
  const [shareDirection, setShareDirection] = useState<'outgoing' | 'incoming' | 'bidirectional'>(
    'bidirectional'
  );
  const [sharePointsAmount, setSharePointsAmount] = useState('25');
  const [shareMaxPerTx, setShareMaxPerTx] = useState('50');
  const [shareMonthlyCap, setShareMonthlyCap] = useState('1500');
  const [shareMinInvoice, setShareMinInvoice] = useState('40');
  const [shareExpiresAt, setShareExpiresAt] = useState('2027-06-30');
  const [shareNotes, setShareNotes] = useState('');

  // Program form + 3-Mode Points Calculation Bar + Interactive Simulator
  const [progName, setProgName] = useState('');
  const [progType, setProgType] = useState<LoyaltyProgram['type']>('points');
  const [progCurrency, setProgCurrency] = useState<MarketCurrency>(store.currency);
  const [progStartDate, setProgStartDate] = useState('2026-11-12');
  const [progEndDate, setProgEndDate] = useState('2027-11-12');
  const [progIncludedItems, setProgIncludedItems] = useState('جميع المنتجات والخدمات');
  const [progMinInvoice, setProgMinInvoice] = useState('20');
  const [progRewardVal, setProgRewardVal] = useState('100 نقطة = خصم 15 ر.س');
  const [progStampsReq, setProgStampsReq] = useState('6');
  const [progExpiryDays, setProgExpiryDays] = useState('180');
  const [progMaxRedemption, setProgMaxRedemption] = useState('1000');
  const [progAllowStacking, setProgAllowStacking] = useState(false);
  const [progBranches, setProgBranches] = useState<string[]>(store.branches.map((b) => b.id));
  const [progCalcMode, setProgCalcMode] = useState<PointsCalcMode>(
    store.loyaltyRule.pointsCalcMode || 'per_amount'
  );
  const [progUnitAmount, setProgUnitAmount] = useState<number>(
    store.loyaltyRule.currencyUnitAmount || 10
  );
  const [progPointsPerUnit, setProgPointsPerUnit] = useState<number>(
    store.loyaltyRule.pointsPerUnit || 10
  );
  const [progPercentageRate, setProgPercentageRate] = useState<number>(
    store.loyaltyRule.percentageRate ?? 10
  );
  const [progTiers, setProgTiers] = useState<PointTier[]>(
    store.loyaltyRule.pointRules && store.loyaltyRule.pointRules.length > 0
      ? store.loyaltyRule.pointRules
      : [
          { minAmount: 1, maxAmount: 50, points: 10, tierCalcMode: 'points', percentageRate: 10 },
          { minAmount: 51, maxAmount: 150, points: 30, tierCalcMode: 'points', percentageRate: 15 },
          { minAmount: 151, maxAmount: 500, points: 75, tierCalcMode: 'percentage', percentageRate: 20 },
        ]
  );
  const [simInvoiceAmount, setSimInvoiceAmount] = useState('80');

  const [showQrPosterModal, setShowQrPosterModal] = useState(false);

  const storeSlugOrId = store.slug || store.id;
  const storePublicUrl = `${posterOrigin}/stores/${encodeURIComponent(storeSlugOrId)}`;

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      setPosterOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(storePublicUrl, {
      width: 520,
      margin: 2,
      color: { dark: '#0B1F3A', light: '#FFFFFF' },
    })
      .then((url) => {
        if (active) setPosterQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [storePublicUrl]);

  const handlePrintPoster = () => {
    if (typeof window === 'undefined') return;
    document.body.classList.add('printing-qr-poster');
    const cleanup = () => {
      document.body.classList.remove('printing-qr-poster');
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    setTimeout(cleanup, 1200);
  };

  // Branch & Staff forms
  const [branchName, setBranchName] = useState('');
  const [branchArea, setBranchArea] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [branchLat, setBranchLat] = useState('24.7136');
  const [branchLng, setBranchLng] = useState('46.6753');
  const [editingBranchRuleId, setEditingBranchRuleId] = useState<string | null>(null);
  const [branchRuleReward, setBranchRuleReward] = useState('مضاعفة النقاط بالفرع');
  const [editingBranchGeoId, setEditingBranchGeoId] = useState<string | null>(null);
  const [branchGeoRadius, setBranchGeoRadius] = useState<number>(1000);
  const [branchGeoAlertMsg, setBranchGeoAlertMsg] = useState('');
  const [branchGeoBadge, setBranchGeoBadge] = useState('');

  const [staffName, setStaffName] = useState('');
  const [staffUser, setStaffUser] = useState('');
  const [staffTempPass, setStaffTempPass] = useState('');
  const [staffRole, setStaffRole] = useState<'CASHIER' | 'MERCHANT_MANAGER'>('CASHIER');
  const [staffBranchIds, setStaffBranchIds] = useState<string[]>(
    allowedBranchIds.length > 0
      ? allowedBranchIds
      : store.branches[0]?.id
      ? [store.branches[0].id]
      : []
  );
  const [staffCreating, setStaffCreating] = useState(false);
  const [resetPassModalStaff, setResetPassModalStaff] = useState<CashierStaff | null>(null);
  const [resetPassValue, setResetPassValue] = useState('');

  // CRM filters
  const [crmSegmentFilter, setCrmSegmentFilter] = useState<
    'الكل' | MerchantCrmCustomerDTO['segment']
  >('الكل');
  const [crmSearch, setCrmSearch] = useState('');
  const [selectedCrmCustomerId, setSelectedCrmCustomerId] = useState<string | null>(null);

  // Subscription invoices
  const [subscriptionInvoices] = useState([
    {
      id: 'SUB-2026-11',
      plan: store.subscriptionPlan,
      amount: packages.find((p) => p.name === store.subscriptionPlan)?.monthlyPrice ?? 299,
      date: '2026-11-01',
      status: 'مدفوعة',
    },
    {
      id: 'SUB-2026-10',
      plan: store.subscriptionPlan,
      amount: packages.find((p) => p.name === store.subscriptionPlan)?.monthlyPrice ?? 299,
      date: '2026-10-01',
      status: 'مدفوعة',
    },
  ]);

  // Settings & Caps
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [capMaxTx, setCapMaxTx] = useState(String(store.maxTxAmount ?? 5000));
  const [capDailyCust, setCapDailyCust] = useState(String(store.dailyCustomerCap ?? 300));
  const [capDailyCashier, setCapDailyCashier] = useState(String(store.dailyCashierCap ?? 5000));
  const [absenceDays, setAbsenceDays] = useState(String(store.absenceReminderDays ?? 30));
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMsg, setTicketMsg] = useState('');

  // Derived data & package limits
  const activePkg =
    packages.find((p) => p.name === store.subscriptionPlan) ||
    packages.find((p) => p.name === 'Starter');

  const effectiveSubState = getEffectiveSubscriptionState(store);
  const isPausedSub = isStoreSubscriptionPaused(store);
  const isReadOnlySub = effectiveSubState === 'readonly' || isPausedSub;
  const isGraceSub = effectiveSubState === 'grace';
  const isStorePaused = store.status === 'suspended';

  const visibleBranches =
    !isOwner && allowedBranchIds.length > 0
      ? store.branches.filter((b) => allowedBranchIds.includes(b.id))
      : store.branches;

  const storeTransactions = useMemo(
    () =>
      transactions.filter(
        (t) =>
          t.merchantId === store.merchantId &&
          (dashBranchId === 'all' || t.branchId === dashBranchId)
      ),
    [transactions, store.merchantId, dashBranchId]
  );

  // Unified CRM customer list (prop -> API loaded -> derived from transactions)
  const effectiveCrmCustomers: MerchantCrmCustomerDTO[] = useMemo(() => {
    if (crmCustomers && crmCustomers.length > 0) return crmCustomers;
    if (loadedCrmCustomers.length > 0) return loadedCrmCustomers;
    const map = new Map<string, MerchantCrmCustomerDTO>();
    storeTransactions.forEach((tx) => {
      if (!map.has(tx.customerId)) {
        map.set(tx.customerId, {
          id: tx.customerId,
          displayName: tx.customerName,
          maskedPhone: '+966 5* *** **42',
          segment: 'عائدون',
          visitsCount: 3,
          storeBalance: Math.max(0, tx.pointsEarned),
          totalEarnedInStore: Math.max(0, tx.pointsEarned),
          lastVisit: tx.timestamp.slice(0, 10),
          currency: store.currency,
        });
      }
    });
    if (!map.has('cust-1')) {
      map.set('cust-1', {
        id: 'cust-1',
        displayName: 'سارة العتيبي',
        maskedPhone: '+966 55 *** **88',
        segment: 'VIP',
        visitsCount: 8,
        storeBalance: 320,
        totalEarnedInStore: 540,
        lastVisit: '2026-11-12',
        currency: store.currency,
      });
    }
    return Array.from(map.values());
  }, [crmCustomers, loadedCrmCustomers, storeTransactions, store.currency]);

  // Ensure cardDesigns always has at least one card
  const storeCardsList: StoreCardDesign[] = useMemo(() => {
    if (store.cardDesigns && store.cardDesigns.length > 0) {
      return store.cardDesigns;
    }
    return [
      {
        id: `cd-default-${store.id}`,
        name: `بطاقة ولاء ${store.name} الأساسية`,
        cardColor: store.cardColor || 'from-[#0B1F3A] via-[#10325E] to-[#007BFF]',
        cardTextColor: store.cardTextColor || 'text-white',
        secondaryLogo: store.secondaryLogo,
        loyaltyRule: store.loyaltyRule,
        isActive: true,
        isDefault: true,
        createdAt: '2026-11-01',
        printedCount: 1,
      },
    ];
  }, [store]);

  const storePointShares: PartnerPointShare[] = useMemo(
    () => store.partnerPointShares || [],
    [store.partnerPointShares]
  );

  const periodFactor = dashPeriod === 'weekly' ? 0.25 : dashPeriod === 'quarterly' ? 3 : 1;

  const chartData = useMemo(() => {
    const base =
      store.visitorSeries && store.visitorSeries.length > 0
        ? store.visitorSeries
        : [
            { label: 'السبت', digitalVisitors: 210, verifiedPurchases: 78 },
            { label: 'الأحد', digitalVisitors: 265, verifiedPurchases: 96 },
            { label: 'الإثنين', digitalVisitors: 240, verifiedPurchases: 92 },
            { label: 'الثلاثاء', digitalVisitors: 320, verifiedPurchases: 128 },
            { label: 'الأربعاء', digitalVisitors: 380, verifiedPurchases: 145 },
            { label: 'الخميس', digitalVisitors: 440, verifiedPurchases: 182 },
            { label: 'الجمعة', digitalVisitors: 490, verifiedPurchases: 204 },
          ];
    return base.map((p) => ({
      label: p.label,
      الزوار: Math.round(p.digitalVisitors * periodFactor),
      المشتريات: Math.round(p.verifiedPurchases * periodFactor),
    }));
  }, [store.visitorSeries, periodFactor]);

  const branchChartData = useMemo(
    () =>
      visibleBranches.map((b) => ({
        name: b.name.replace('فرع ', ''),
        الزوار: b.visitorsCount || 0,
      })),
    [visibleBranches]
  );

  // Image upload helper (MIME + 2MB validation -> DataURL)
  const handleImageFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    onResult: (dataUrl: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_MIME.includes(file.type)) {
      showToast('صيغة الصورة غير مدعومة. المسموح: PNG, JPG, WEBP فقط.', 'error');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showToast('حجم الصورة يتجاوز الحد الأقصى (2 ميجابايت).', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onResult(reader.result);
        showToast('تم تحميل الصورة والتحقق من جودتها بنجاح.');
      }
    };
    reader.readAsDataURL(file);
  };

  // Interactive Rules Simulator calculation (supports all 3 modes: per_amount | percentage | tiers)
  const simResult = useMemo(() => {
    const amt = parseFloat(simInvoiceAmount) || 0;
    const minInv = parseFloat(progMinInvoice) || 0;
    if (amt < minInv) {
      return {
        eligible: false,
        earned: 0,
        note: `الفاتورة أقل من الحد الأدنى (${minInv} ${progCurrency})`,
      };
    }
    if (progType === 'stamps') {
      return {
        eligible: true,
        earned: 1,
        note: `يُمنح ختم واحد (${parseInt(progStampsReq, 10) || 6} أختام للمكافأة)`,
      };
    }
    const pts = calculatePointsForAmount(
      {
        type: 'points',
        pointsCalcMode: progCalcMode,
        currencyUnitAmount: progUnitAmount,
        pointsPerUnit: progPointsPerUnit,
        percentageRate: progPercentageRate,
        pointRules: progTiers,
        rewardDescription: progRewardVal,
      },
      amt
    );
    const note =
      progCalcMode === 'per_amount'
        ? `معادلة: كل ${progUnitAmount} ${progCurrency} = ${progPointsPerUnit} نقطة`
        : progCalcMode === 'percentage'
        ? `نسبة ${progPercentageRate}% من قيمة الفاتورة (${amt} ${progCurrency})`
        : 'احتساب حسب شرائح الإنفاق (من وإلى مبلغ — عدد أو نسبة %)';
    return {
      eligible: true,
      earned: pts,
      note,
    };
  }, [
    simInvoiceAmount,
    progMinInvoice,
    progCurrency,
    progType,
    progStampsReq,
    progCalcMode,
    progUnitAmount,
    progPointsPerUnit,
    progPercentageRate,
    progTiers,
    progRewardVal,
  ]);

  // Excel (.xlsx) & CSV exports
  const handleExportExcel = () => {
    const rows = storeTransactions.map((t) => ({
      'رقم الفاتورة': t.invoiceNumber,
      العميل: t.customerName,
      الفرع: t.branchName,
      النوع: t.type,
      المبلغ: t.amount,
      العملة: t.currency,
      النقاط: t.pointsEarned,
      'نسخة القاعدة': t.ruleVersion,
      الوقت: t.timestamp,
      ملاحظات: t.notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AadaPass Report');
    XLSX.writeFile(wb, `aada-pass-${store.slug || store.id}-report.xlsx`);
    showToast('تم تصدير تقرير Excel (.xlsx) بنجاح!');
  };

  const handleExportCsv = () => {
    const headers = 'Invoice,Store,Branch,Customer,Type,Amount,Currency,Points,RuleVersion,Timestamp\n';
    const rows = storeTransactions
      .map(
        (t) =>
          `"${t.invoiceNumber}","${t.storeName}","${t.branchName}","${t.customerName}","${t.type}",${t.amount},"${t.currency}",${t.pointsEarned},"${t.ruleVersion}","${t.timestamp}"`
      )
      .join('\n');
    const blob = new Blob(['\ufeff' + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aada-pass-${store.slug || store.id}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('تم تصدير ملف CSV (UTF-8) بنجاح!');
  };

  // Suspended account gate (pending accounts enjoy full free-trial access until manual admin approval)
  if (store.status === 'suspended') {
    return (
      <div className="min-h-[82vh] bg-light-canvas flex items-center justify-center p-6">
        <div className="max-w-xl w-full glass-card rounded-3xl p-8 space-y-5 border-2 border-rose-200 dark:border-rose-800/50 text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-700 mx-auto flex items-center justify-center">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">
            حساب المتجر «{store.name}» موقوف مؤقتاً
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            يرجى التواصل مع إدارة منصة عادة باس عبر الواتساب لإعادة تفعيل الاشتراك والمتجر.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() =>
                setWaModalState({
                  isOpen: true,
                  mode: 'service',
                })
              }
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>التواصل مع الإدارة عبر واتساب</span>
            </button>
            <button
              type="button"
              onClick={onLogoutAll}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
        <WhatsappRequestModal
          isOpen={waModalState.isOpen}
          onClose={() => setWaModalState((prev) => ({ ...prev, isOpen: false }))}
          adminWhatsappNumber={adminWhatsappNumber}
          mode={waModalState.mode}
          defaultStoreName={store.name}
          defaultRequesterName={`${sessionUser.firstName} ${sessionUser.lastName}`}
          defaultPhone={store.phone}
          defaultCurrency={store.currency}
        />
      </div>
    );
  }

  const trialEndMs = Date.parse(store.trialEndsAt || store.subscriptionExpiry);
  const trialDaysLeft = !Number.isNaN(trialEndMs)
    ? Math.max(0, Math.ceil((trialEndMs - Date.now()) / (1000 * 60 * 60 * 24)))
    : store.trialDaysGranted || 14;

  // Action handlers
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateStore({
      ...store,
      name: profName.trim() || store.name,
      category: profCategory,
      phone: profPhone.trim() || store.phone,
      city: profCity.trim() || store.city,
      area: profArea.trim() || store.area,
      address: profAddress.trim() || store.address,
      googleMapLink: profMapLink.trim() || store.googleMapLink,
      workingHours: profWorkingHours.trim(),
      wifiPassword: profWifi.trim(),
      instagramUrl: profInstagram.trim(),
      description: profDesc.trim(),
      logo: profLogo.trim() || store.logo,
      secondaryLogo: profSecondaryLogo.trim() || undefined,
      cover: profCover.trim() || store.cover,
      menuImages: profMenuImages,
      fullMenuImage: profMenuImages[0] || store.fullMenuImage,
      storeGallery: profStoreGallery,
    });
    showToast('تم حفظ ملف المتجر وصور وديكور المكان والعملة وساعات العمل بنجاح!');
  };

  const handleAddMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    const item: MenuItem = {
      id: nextId('m'),
      merchantId: store.merchantId,
      name: newItemName,
      type: newItemType,
      category: newItemCategory,
      price: parseFloat(newItemPrice) || 20,
      currency: store.currency,
      image:
        newItemImage.trim() ||
        'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&q=80&w=400',
      description: newItemDesc || 'عنصر تعريفي في كتالوج المتجر',
      available: newItemAvailable,
      branches: newItemBranches.length > 0 ? newItemBranches : store.branches.map((b) => b.id),
      expiryDate: newItemType === 'offer' ? newItemExpiry || '2026-12-31' : undefined,
    };
    await onUpdateStore({ ...store, menu: [item, ...store.menu] });
    setNewItemName('');
    setNewItemDesc('');
    setNewItemImage('');
    showToast('تم إضافة العنصر إلى الكتالوج التعريفي!');
  };

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vchTitle.trim()) return;
    if (vchAudienceType === 'specific' && vchTargetCustomerIds.length === 0) {
      showToast('يرجى اختيار عميل واحد على الأقل عند تخصيص القسيمة لعملاء محددين.', 'error');
      return;
    }
    const code =
      vchCode.trim().toUpperCase() ||
      `AADA-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const targetNames =
      vchAudienceType === 'specific'
        ? effectiveCrmCustomers
            .filter((c) => vchTargetCustomerIds.includes(c.id))
            .map((c) => c.displayName)
        : undefined;
    const newVoucher: MerchantVoucher = {
      id: nextId('mv'),
      merchantId: store.merchantId,
      code,
      title: vchTitle.trim(),
      discountText: vchDiscount.trim() || 'خصم خاص',
      pointsCost: parseInt(vchPointsCost, 10) || 100,
      usageLimit: parseInt(vchLimit, 10) || 100,
      usedCount: 0,
      branches: visibleBranches.map((b) => b.id),
      expiryDate: vchExpiry || '2026-12-31',
      active: true,
      audienceType: vchAudienceType,
      targetCustomerIds: vchAudienceType === 'specific' ? vchTargetCustomerIds : undefined,
      targetCustomerNames: targetNames,
    };
    await onUpdateStore({ ...store, vouchers: [newVoucher, ...(store.vouchers || [])] });
    setVchTitle('');
    setVchCode('');
    setVchTargetCustomerIds([]);
    showToast(
      vchAudienceType === 'specific'
        ? `تم إنشاء القسيمة المخصصة (${code}) لـ ${targetNames?.length || 1} عميل بنجاح!`
        : `تم إنشاء القسيمة العامة (${code}) لكل العملاء بنجاح!`
    );
  };

  const handleAddPointShare = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenStore = partnerStoresList.find((s) => s.id === sharePartnerStoreId);
    const targetName = sharePartnerName.trim() || chosenStore?.name || '';
    if (!targetName) {
      showToast('يرجى اختيار المتجر الشريك أو كتابة اسمه.', 'error');
      return;
    }
    const newShare: PartnerPointShare = {
      id: nextId('pps'),
      merchantId: store.merchantId,
      partnerStoreId: chosenStore?.id || `partner-${Date.now().toString(36)}`,
      partnerStoreName: targetName,
      partnerStoreCategory: chosenStore?.category || sharePartnerCategory || 'متجر شريك',
      partnerCategory: chosenStore?.category || sharePartnerCategory || 'متجر شريك',
      pointsToShare: Math.max(1, parseInt(sharePointsAmount, 10) || 25),
      maxPointsPerTransaction: Math.max(1, parseInt(shareMaxPerTx, 10) || 50),
      monthlyPointsCap: Math.max(10, parseInt(shareMonthlyCap, 10) || 1000),
      usedPointsThisMonth: 0,
      minInvoiceAmount: Math.max(0, parseFloat(shareMinInvoice) || 0),
      direction: shareDirection,
      active: true,
      createdAt: new Date().toISOString().slice(0, 10),
      expiresAt: shareExpiresAt || '2027-06-30',
      notes: shareNotes.trim() || undefined,
    };
    await onUpdateStore({
      ...store,
      partnerPointShares: [newShare, ...storePointShares],
    });
    setSharePartnerName('');
    setShareNotes('');
    showToast(`تم تفعيل اتفاقية مشاركة النقاط مع «${targetName}» بنجاح!`);
  };

  const handleAddProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!progName.trim()) return;
    const prog: LoyaltyProgram = {
      id: nextId('prog'),
      merchantId: store.merchantId,
      name: progName,
      type: progType,
      currency: progCurrency,
      startDate: progStartDate,
      endDate: progEndDate,
      branches: progBranches.length > 0 ? progBranches : store.branches.map((b) => b.id),
      includedItems: progIncludedItems || 'جميع المنتجات والخدمات',
      minInvoiceAmount: parseFloat(progMinInvoice) || 10,
      pointRules: progType === 'points' ? progTiers : undefined,
      stampsRequired: progType === 'stamps' ? parseInt(progStampsReq, 10) || 6 : undefined,
      rewardValue: progRewardVal,
      pointsExpiryDays: parseInt(progExpiryDays, 10) || 180,
      maxRedemption: parseInt(progMaxRedemption, 10) || 1000,
      allowStacking: progAllowStacking,
      status: 'فعال',
      version: 1,
    };
    const updatedLoyaltyRule =
      progType === 'stamps'
        ? {
            ...store.loyaltyRule,
            type: 'stamps' as const,
            stampsRequired: parseInt(progStampsReq, 10) || 6,
            rewardDescription: progRewardVal,
          }
        : progType === 'points'
        ? {
            ...store.loyaltyRule,
            type: 'points' as const,
            pointsCalcMode: progCalcMode,
            currencyUnitAmount: progUnitAmount,
            pointsPerUnit: progPointsPerUnit,
            percentageRate: progPercentageRate,
            pointRules: progTiers,
            rewardDescription: progRewardVal,
            maxRedemption: parseInt(progMaxRedemption, 10) || 1000,
          }
        : store.loyaltyRule;

    await onUpdateStore({
      ...store,
      programs: [prog, ...store.programs],
      loyaltyRule: updatedLoyaltyRule,
    });
    setProgName('');
    showToast('تم حفظ برنامج الولاء وشريط احتساب النقاط بنجاح!');
  };

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) return;
    const newBranch: Branch = {
      id: nextId('b'),
      merchantId: store.merchantId,
      name: branchName.trim(),
      city: store.city,
      area: branchArea.trim() || store.area,
      address: branchAddress.trim() || `${branchArea || store.area} - طريق رئيسي`,
      phone: branchPhone.trim() || store.phone,
      lat: parseFloat(branchLat) || 24.7136,
      lng: parseFloat(branchLng) || 46.6753,
      geofenceRadiusMeters: 1000,
      proximityAlertMessage: `أهلاً بك بالقرب من فرع ${branchName.trim()}! تفضل واستمتع بعروضنا اليومية`,
      activeOfferBadge: 'خصم وعروض حصرية',
      crowdLevel: 'هادئ',
      visitorsCount: 0,
    };
    await onUpdateStore({ ...store, branches: [...store.branches, newBranch] });
    setBranchName('');
    setBranchArea('');
    setBranchAddress('');
    setBranchPhone('');
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || !staffUser.trim() || staffTempPass.trim().length < 6) {
      showToast('يرجى إدخال الاسم واسم المستخدم وكلمة مرور مؤقتة (6 أحرف على الأقل)', 'error');
      return;
    }
    const chosenIds =
      staffBranchIds.length > 0
        ? staffBranchIds
        : visibleBranches[0]?.id
        ? [visibleBranches[0].id]
        : [];

    if (onCreateStaff) {
      setStaffCreating(true);
      const res = await onCreateStaff({
        merchantId: store.merchantId,
        name: staffName.trim(),
        username: staffUser.trim(),
        tempPassword: staffTempPass,
        role: isOwner ? staffRole : 'CASHIER',
        branchIds: chosenIds,
      });
      setStaffCreating(false);
      if (res.ok) {
        setStaffName('');
        setStaffUser('');
        setStaffTempPass('');
      }
    }
  };

  const handleSaveSettingsPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateStore({
      ...store,
      maxTxAmount: parseFloat(capMaxTx) || 5000,
      dailyCustomerCap: parseInt(capDailyCust, 10) || 300,
      dailyCashierCap: parseInt(capDailyCashier, 10) || 5000,
      absenceReminderDays: parseInt(absenceDays, 10) || 30,
    });
    showToast('تم حفظ سياسات الأمان وسقوف العمليات!');
  };

  // Store owners cannot self-switch packages; requesting a package records requestedPlan, logs a ticket, and opens Admin WhatsApp flow
  const handleRequestPlanChangeFromAdmin = async (pkg: SubscriptionPackage) => {
    if (!isOwner) return;
    await onUpdateStore({
      ...store,
      requestedPlan: pkg.name,
    });
    await onAddTicket({
      subject: `طلب تغيير / تجديد باقة المتجر إلى (${pkg.title})`,
      message: `يرغب مالك متجر «${store.name}» في الترقية أو التبديل من باقة (${store.subscriptionPlan}) إلى باقة (${pkg.name} - ${pkg.title}) بسعر ${pkg.priceText}. بانتظار موافقة وتفعيل مدير النظام.`,
    }).catch(() => {});
    setWaModalState({
      isOpen: true,
      mode: 'package',
      packageTitle: `${pkg.title} (${pkg.name})`,
      priceSummary: pkg.priceText,
    });
    showToast(
      `تم تسجيل طلب باقة «${pkg.title}» لدى مدير النظام؛ يرجى إرسال التأكيد عبر واتساب لإتمام التفعيل.`
    );
  };

  const navGroups: {
    groupTitle: string;
    items: { id: MerchantTab; label: string; icon: React.ComponentType<{ className?: string }> }[];
  }[] = [
    {
      groupTitle: 'نظرة عامة',
      items: [{ id: 'dashboard', label: 'لوحة الأداء والإحصائيات', icon: BarChart3 }],
    },
    {
      groupTitle: 'البطاقات والواجهة العامة',
      items: [
        { id: 'card-designer', label: 'تصميم البطاقات', icon: CreditCard },
        { id: 'card-review', label: 'مراجعة البطاقات وطباعتها وتعديلها', icon: Layers },
        { id: 'menu', label: 'قائمة المنتجات (المنيو)', icon: ShoppingBag },
        { id: 'online-orders' as MerchantTab, label: 'المتجر والطلبات 🛵', icon: Truck },
      ],
    },
    {
      groupTitle: 'الولاء والعملاء ومشاركة النقاط',
      items: [
        { id: 'programs', label: 'برامج الولاء وشريط النقاط', icon: Award },
        { id: 'offers', label: 'العروض والقسائم الرقمية', icon: Ticket },
        { id: 'customers', label: 'إدارة العملاء والولاء', icon: UserCheck },
        { id: 'point-sharing', label: 'مشاركة النقاط مع متاجر أخرى', icon: Share2 },
      ],
    },
    {
      groupTitle: 'التشغيل والاشتراكات والإعدادات',
      items: [
        { id: 'branches', label: 'الفروع وقواعد الفروع', icon: MapPin },
        { id: 'staff', label: 'الموظفون والاسترجاعات', icon: Users },
        { id: 'reports', label: 'التقارير وتصدير البيانات', icon: FileSpreadsheet },
        ...(isOwner
          ? [{ id: 'subscription' as MerchantTab, label: 'الاشتراكات وطلب باقة', icon: Shield }]
          : []),
        { id: 'settings', label: 'الإعدادات وملف المتجر', icon: Settings },
      ],
    },
  ];

  const activeTabLabel =
    navGroups.flatMap((g) => g.items).find((i) => i.id === activeTab)?.label ||
    'لوحة إدارة المتجر';

  // Filtered CRM customers
  const filteredCrm = effectiveCrmCustomers.filter((c) => {
    const matchSeg = crmSegmentFilter === 'الكل' || c.segment === crmSegmentFilter;
    const q = crmSearch.trim();
    const matchQ = !q || c.displayName.includes(q) || c.maskedPhone.includes(q);
    return matchSeg && matchQ;
  });

  // Fraud anomalies list
  const flaggedTxs = storeTransactions.filter((t) => t.fraudFlags && t.fraudFlags.length > 0);
  const refundRequests = storeTransactions.filter((t) => t.refundRequested && t.type !== 'refund');

  return (
    <div className="min-h-screen bg-light-canvas text-slate-800 dark:text-slate-100 flex flex-col md:flex-row">
      {/* Right Sidebar Menu (RTL) */}
      <aside className="w-full md:w-72 glass-card border-l border-sky-100 dark:border-slate-800 p-5 flex flex-col justify-between shrink-0 md:min-h-[calc(100vh-5rem)]">
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-200/70 dark:border-slate-700/60">
            <img
              src={store.logo}
              alt={store.name}
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-2xl object-cover border-2 border-white shadow-sm bg-white"
            />
            <div className="min-w-0">
              <h2 className="font-black text-slate-900 dark:text-white text-sm truncate">{store.name}</h2>
              <div className="flex flex-wrap items-center gap-1 mt-1">
                <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                  {AR_TRANSLATIONS.roles[sessionUser.role]} · {store.currency}
                </span>
                {store.status === 'pending' && (
                  <span className="text-[10px] bg-sky-100 text-sky-800 font-black px-2 py-0.5 rounded-full">
                    تجربة {trialDaysLeft} يوم
                  </span>
                )}
              </div>
            </div>
          </div>

          <nav className="space-y-4">
            {navGroups.map((group) => (
              <div key={group.groupTitle} className="space-y-1">
                <div className="px-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                  {group.groupTitle}
                </div>
                {group.items.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full text-right px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition-all cursor-pointer ${
                        activeTab === tab.id
                          ? 'bg-gradient-gold-cta text-[#0B1F3A] shadow-md font-black'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-800 hover:text-[#0284C7]'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            onClick={() => setWaModalState({ isOpen: true, mode: 'service' })}
            className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition"
          >
            <MessageCircle className="w-4 h-4" />
            <span>طلب خدمة / باقة على واتساب</span>
          </button>

          <div className="bg-gradient-navy text-white p-4 rounded-2xl text-center space-y-1.5 shadow-md">
            <img src="/logo-white.png" alt="Aada Pass" className="h-5 w-auto object-contain mx-auto opacity-90" />
            <p className="text-[11px] text-sky-100 font-bold">
              الباقة: <span className="text-[#FBBF24]">{store.subscriptionPlan}</span> · عزل {store.merchantId}
            </p>
          </div>
          <button
            type="button"
            onClick={onLogoutAll}
            className="w-full bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{AR_TRANSLATIONS.nav.logoutAllDevices}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-5 sm:p-8 lg:p-10 space-y-6 overflow-y-auto">
        {/* Top Workspace Header Strip */}
        <div className="max-w-6xl mx-auto glass-card p-4 sm:px-6 rounded-2xl flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-[11px] font-bold text-slate-400">
              بوابة مالك المتجر · {store.city} ({store.currency})
            </div>
            <h1 className="text-base sm:text-lg font-black text-[#0B1F3A] dark:text-white">
              {activeTabLabel}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Link
              href="/cashier"
              target="_blank"
              className="px-3.5 py-2 rounded-xl bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] font-black flex items-center gap-1.5 shadow-md shadow-amber-500/25 cursor-pointer transition"
            >
              <Zap className="w-3.5 h-3.5 text-[#0B1F3A]" />
              <span>⚡ شاشة الكاشير السريعة (POS)</span>
            </Link>
            <a
              href={`/stores/${encodeURIComponent(storeSlugOrId)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-[#0B1F3A] dark:text-slate-100 hover:border-sky-400 flex items-center gap-1.5 transition"
            >
              <ExternalLink className="w-3.5 h-3.5 text-sky-600" />
              <span>صفحة المتجر</span>
            </a>
            <button
              type="button"
              onClick={() => setShowQrPosterModal(true)}
              className="px-3.5 py-2 rounded-xl bg-[#0B1F3A] hover:bg-[#10325E] text-white font-black flex items-center gap-1.5 cursor-pointer transition"
            >
              <Printer className="w-3.5 h-3.5 text-[#FBBF24]" />
              <span>طباعة باركود بطاقتي</span>
            </button>
            <button
              type="button"
              onClick={() => setWaModalState({ isOpen: true, mode: 'service' })}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-1.5 cursor-pointer transition"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>طلب خدمة واتساب</span>
            </button>
          </div>
        </div>

        {/* Pending Free Trial Banner (Allows full portal usage during trial while awaiting manual Admin approval) */}
        {store.status === 'pending' && (
          <div className="max-w-6xl mx-auto bg-gradient-to-l from-amber-50 via-white to-sky-50 dark:from-amber-950/40 dark:via-slate-900 dark:to-sky-950/40 border-2 border-amber-300 dark:border-amber-600/50 p-4 sm:p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4 text-xs shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-black text-sm text-[#0B1F3A] dark:text-white">
                    حسابك في فترة التجربة المجانية ({trialDaysLeft} يوم متبقي) — بانتظار التفعيل اليدوي من الإدارة
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-black text-[10px]">
                    الباقة المطلوبة: {store.requestedPlan || store.subscriptionPlan}
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  يمكنك استخدام كافة أدوات المتجر وتصميم بطاقة الولاء وطباعة باركود صفحة متجرك الآن بحرية خلال التجربة المجانية ({store.trialDaysGranted || 14} يوم)، وقد ظهر طلبك لمدير النظام للمراجعة والتفعيل اليدوي.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {onRefreshDashboard && (
                <button
                  type="button"
                  onClick={async () => {
                    await onRefreshDashboard();
                    showToast('تم تحديث حالة مراجعة المتجر.');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-[#0B1F3A] dark:text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-sky-600" />
                  <span>تحديث الحالة</span>
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  setWaModalState({
                    isOpen: true,
                    mode: 'package',
                    packageTitle: `تفعيل حساب المتجر التجريبي (${store.requestedPlan || store.subscriptionPlan})`,
                    priceSummary: `فترة تجربة ${store.trialDaysGranted || 14} يوم`,
                  })
                }
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>طلب تسريع التفعيل عبر واتساب</span>
              </button>
            </div>
          </div>
        )}

        {/* Grace / Read-only Banners */}
        {isReadOnlySub && (
          <div className="max-w-6xl mx-auto bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-300 dark:border-rose-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-rose-900 dark:text-rose-200 font-bold">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>
                انتهت فترة التجربة / السماح لاشتراكك والمتجر حالياً في وضع القراءة فقط (Read-only). يرجى طلب التفعيل أو تجديد الباقة لاستئناف التعديلات.
              </span>
            </div>
            {isOwner && (
              <button
                type="button"
                onClick={() => setActiveTab('subscription')}
                className="bg-rose-600 hover:bg-rose-700 text-white font-black px-4 py-2 rounded-xl cursor-pointer"
              >
                تجديد الاشتراك الآن
              </button>
            )}
          </div>
        )}

        {isGraceSub && !isReadOnlySub && (
          <div className="max-w-6xl mx-auto bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold">
              <Clock className="w-5 h-5 text-amber-600 shrink-0" />
              <span>تنبيه فترة السماح (Grace Period): ينتهي اشتراك المتجر قريباً في {store.subscriptionExpiry}.</span>
            </div>
            {isOwner && (
              <button
                type="button"
                onClick={() => setActiveTab('subscription')}
                className="bg-amber-500 text-[#0B1F3A] font-black px-4 py-1.5 rounded-xl cursor-pointer"
              >
                عرض الباقات
              </button>
            )}
          </div>
        )}

        {toast && (
          <div
            className={`max-w-6xl mx-auto px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 border shadow-xs ${
              toast.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{toast.msg}</span>
          </div>
        )}

        {/* 1. Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                  {AR_TRANSLATIONS.dashboard.title}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  مؤشرات الأداء اللحظية، مقارنة الفترات، وزحمة الفروع ({store.currency})
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={dashBranchId}
                  onChange={(e) => setDashBranchId(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-bold"
                >
                  <option value="all">جميع الفروع</option>
                  {visibleBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <div className="flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-0.5 font-bold">
                  {[
                    { id: 'weekly', label: 'أسبوعي' },
                    { id: 'monthly', label: 'شهري' },
                    { id: 'quarterly', label: 'ربع سنوي' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setDashPeriod(p.id as typeof dashPeriod)}
                      className={`px-3 py-1.5 rounded-lg ${
                        dashPeriod === p.id ? 'bg-[#0B1F3A] text-white' : 'text-slate-500'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تصدير إكسل</span>
                </button>
              </div>
            </div>

            {/* 6 KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="glass-card p-4 rounded-2xl space-y-1">
                <span className="text-[11px] font-bold text-slate-500">الزوار الرقميون</span>
                <p className="text-2xl font-black text-sky-600">
                  {Math.round(store.metrics.digitalVisitors * periodFactor).toLocaleString('en-US')}
                </p>
                <span className="text-[10px] font-bold text-emerald-600">+14% مقارنة بالفترة السابقة</span>
              </div>
              <div className="glass-card p-4 rounded-2xl space-y-1">
                <span className="text-[11px] font-bold text-slate-500">بطاقات نشطة</span>
                <p className="text-2xl font-black text-slate-900 dark:text-white">
                  {store.metrics.activeCards.toLocaleString('en-US')}
                </p>
                <span className="text-[10px] font-bold text-emerald-600">
                  جدد {store.metrics.newCustomers} / عائدون {store.metrics.returningCustomers}
                </span>
              </div>
              <div className="glass-card p-4 rounded-2xl space-y-1">
                <span className="text-[11px] font-bold text-slate-500">مشتريات موثقة QR</span>
                <p className="text-2xl font-black text-emerald-600">
                  {Math.round(store.metrics.verifiedPurchases * periodFactor).toLocaleString('en-US')}
                </p>
                <span className="text-[10px] font-bold text-emerald-600">+9% معدل التحويل</span>
              </div>
              <div className="glass-card p-4 rounded-2xl space-y-1">
                <span className="text-[11px] font-bold text-slate-500">النقاط الممنوحة / المستبدلة</span>
                <p className="text-xl font-black text-sky-700 dark:text-sky-300">
                  {(store.metrics.pointsGranted ?? 0).toLocaleString('en-US')} / {store.metrics.rewardsRedeemed ?? 0}
                </p>
                <span className="text-[10px] font-bold text-slate-500">استبدال {store.metrics.redemptionRate}%</span>
              </div>
              <div className="glass-card p-4 rounded-2xl space-y-1">
                <span className="text-[11px] font-bold text-slate-500">مبيعات الفترة</span>
                <p className="text-xl font-black text-amber-600">
                  {formatCurrency(Math.round(store.metrics.monthlySales * periodFactor), store.currency)}
                </p>
                <span className="text-[10px] font-bold text-emerald-600">+18% نمو</span>
              </div>
              <div className="glass-card p-4 rounded-2xl space-y-1">
                <span className="text-[11px] font-bold text-slate-500">خسارة استرجاع</span>
                <p className="text-xl font-black text-rose-600">
                  {store.metrics.refundLossTotal ?? 0} نقطة
                </p>
                <span className="text-[10px] text-slate-400">نقاط أُنفقت قبل الاسترجاع</span>
              </div>
            </div>

            {/* Recharts Interactive Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 glass-card p-6 rounded-3xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-sky-600" />
                    <span>منحنى الزوار مقابل المشتريات الموثقة</span>
                  </h3>
                  <span className="text-[11px] font-bold text-slate-400">Recharts Interactive</span>
                </div>
                <div className="w-full h-64" dir="ltr">
                  <ResponsiveContainer width="100%" height={240} minWidth={0}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="visitFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0284C7" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#0284C7" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="الزوار"
                        stroke="#0284C7"
                        strokeWidth={2.5}
                        fill="url(#visitFill)"
                      />
                      <Area
                        type="monotone"
                        dataKey="المشتريات"
                        stroke="#F59E0B"
                        strokeWidth={2.5}
                        fillOpacity={0.12}
                        fill="#F59E0B"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="lg:col-span-4 glass-card p-6 rounded-3xl space-y-4">
                <h3 className="text-base font-black">زوار وزحمة الفروع</h3>
                <div className="w-full h-64" dir="ltr">
                  <ResponsiveContainer width="100%" height={240} minWidth={0}>
                    <BarChart data={branchChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="الزوار" fill="#0B1F3A" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Fraud Alerts & Refund Requests */}
            {((store.fraudAlerts && store.fraudAlerts.length > 0) || refundRequests.length > 0) && (
              <div className="glass-card p-6 rounded-3xl space-y-3 border-2 border-rose-200 dark:border-rose-900/50">
                <h3 className="text-base font-black text-rose-800 dark:text-rose-300">
                  تنبيهات الأمان وطلبات الاسترجاع المعلقة ({refundRequests.length})
                </h3>
                <div className="space-y-2 text-xs">
                  {(store.fraudAlerts || []).map((alert) => (
                    <div
                      key={alert.id}
                      className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 p-3 rounded-2xl flex flex-wrap justify-between gap-2"
                    >
                      <div>
                        <p className="font-black text-rose-900 dark:text-rose-200">
                          {alert.cashierName} ({alert.branchName}) · #{alert.invoiceNumber}
                        </p>
                        <p className="text-rose-700 dark:text-rose-300">{alert.reason}</p>
                      </div>
                      <span className="font-mono text-slate-500">{alert.timestamp}</span>
                    </div>
                  ))}
                  {refundRequests.map((tx) => (
                    <div
                      key={tx.id}
                      className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-black text-amber-950 dark:text-amber-200">
                          طلب استرجاع #{tx.invoiceNumber} — {tx.customerName} (
                          {formatCurrency(tx.amount, tx.currency)})
                        </p>
                        <p className="text-amber-800 dark:text-amber-300">
                          السبب: {tx.refundRequestReason} · مرفوع من: {tx.refundRequestedBy || tx.cashierName}
                        </p>
                      </div>
                      {onApproveRefund && (
                        <button
                          type="button"
                          onClick={() => void onApproveRefund(tx.id)}
                          className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-xl"
                        >
                          اعتماد قيد الاسترجاع العكسي
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Branch crowd details */}
            <div className="glass-card p-6 rounded-3xl space-y-4">
              <h3 className="text-base font-black">الازدحام المباشر بالفروع</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {visibleBranches.map((b) => (
                  <div
                    key={b.id}
                    className="bg-white/85 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-bold text-sm">{b.name}</h4>
                      <p className="text-xs text-slate-500">
                        {b.area} • {b.visitorsCount || 0} زائر
                      </p>
                    </div>
                    <select
                      value={b.crowdLevel || 'متوسط'}
                      onChange={(e) =>
                        onUpdateStore({
                          ...store,
                          branches: store.branches.map((br) =>
                            br.id === b.id
                              ? { ...br, crowdLevel: e.target.value as Branch['crowdLevel'] }
                              : br
                          ),
                        })
                      }
                      className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer ${
                        b.crowdLevel === 'مزدحم'
                          ? 'bg-amber-100 text-amber-800'
                          : b.crowdLevel === 'هادئ'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      <option value="هادئ">هادئ</option>
                      <option value="متوسط">متوسط</option>
                      <option value="مزدحم">مزدحم</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 3. Menu Catalog ONLY */}
        {activeTab === 'menu' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                  المنتجات والخدمات ({store.currency})
                </h3>
                <p className="text-xs text-slate-500">
                  أضف منتجات أو خدمات أو عروض مؤقتة واربطها بالفروع.
                </p>
              </div>
              <span className="bg-sky-50 border border-sky-200 text-sky-900 font-bold text-[11px] px-3 py-1.5 rounded-xl">
                كتالوج تعريفي فقط (عرض المنتجات والأسعار — بدون مخزون أو طلبات أو دفع)
              </span>
            </div>

            <form onSubmit={handleAddMenuItem} className="glass-card p-6 rounded-3xl space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="الاسم..."
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  required
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5"
                />
                <select
                  value={newItemType}
                  onChange={(e) => setNewItemType(e.target.value as MenuItem['type'])}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 font-bold"
                >
                  <option value="product">منتج</option>
                  <option value="service">خدمة</option>
                  <option value="offer">عرض مؤقت</option>
                </select>
                <input
                  type="text"
                  placeholder="التصنيف..."
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5"
                />
                <input
                  type="number"
                  placeholder={`السعر (${store.currency})`}
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  required
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                <input
                  type="text"
                  placeholder="التفاصيل..."
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="رابط صورة أو ارفع ملفاً..."
                    value={newItemImage}
                    onChange={(e) => setNewItemImage(e.target.value)}
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5"
                  />
                  <label className="bg-sky-50 border border-sky-200 text-sky-800 px-3 py-2.5 rounded-xl font-bold cursor-pointer shrink-0">
                    <Upload className="w-4 h-4" />
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => handleImageFileSelect(e, setNewItemImage)}
                    />
                  </label>
                </div>
                {newItemType === 'offer' ? (
                  <input
                    type="date"
                    value={newItemExpiry}
                    onChange={(e) => setNewItemExpiry(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5"
                  />
                ) : (
                  <label className="flex items-center gap-2 font-bold">
                    <input
                      type="checkbox"
                      checked={newItemAvailable}
                      onChange={(e) => setNewItemAvailable(e.target.checked)}
                      className="w-4 h-4 accent-sky-600"
                    />
                    <span>متاح للعرض</span>
                  </label>
                )}
              </div>

              <div className="bg-white/75 dark:bg-slate-800/70 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-wrap gap-3">
                <span className="font-bold">الفروع:</span>
                {visibleBranches.map((b) => {
                  const checked = newItemBranches.includes(b.id);
                  return (
                    <label key={b.id} className="flex items-center gap-1.5 cursor-pointer font-bold">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setNewItemBranches((prev) =>
                            checked ? prev.filter((id) => id !== b.id) : [...prev, b.id]
                          )
                        }
                        className="w-4 h-4 accent-sky-600"
                      />
                      <span>{b.name}</span>
                    </label>
                  );
                })}
              </div>

              <button
                type="submit"
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-6 py-2.5 rounded-xl flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة للكتالوج</span>
              </button>
            </form>

            {/* Menu items grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {store.menu.map((item) => (
                <div key={item.id} className="glass-card p-4 rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={item.image}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-xl object-cover"
                    />
                    <div>
                      <span className="text-[10px] font-bold bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full">
                        {item.type === 'offer' ? 'عرض مؤقت' : item.type === 'service' ? 'خدمة' : 'منتج'} •{' '}
                        {item.category}
                      </span>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">{item.name}</h4>
                      <p className="font-black text-amber-700 dark:text-amber-400 text-xs">
                        {formatCurrency(item.price, item.currency || store.currency)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateStore({ ...store, menu: store.menu.filter((m) => m.id !== item.id) })
                    }
                    className="text-rose-500 hover:bg-rose-50 p-2 rounded-xl"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Menu Images Gallery */}
            <div className="glass-card p-6 rounded-3xl space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-base flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-sky-600" />
                  <span>صور المينو الكاملة (Menu Gallery)</span>
                </h4>
                <label className="bg-sky-600 text-white font-bold px-4 py-2 rounded-xl cursor-pointer flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>رفع صفحة مينو</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) =>
                      handleImageFileSelect(e, (url) => {
                        const updated = [...profMenuImages, url];
                        setProfMenuImages(updated);
                        void onUpdateStore({ ...store, menuImages: updated, fullMenuImage: updated[0] });
                      })
                    }
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <input
                  type="url"
                  dir="ltr"
                  placeholder="https://... أضف رابط صورة مينو"
                  value={newGalleryUrl}
                  onChange={(e) => setNewGalleryUrl(e.target.value)}
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newGalleryUrl.trim()) return;
                    const updated = [...profMenuImages, newGalleryUrl.trim()];
                    setProfMenuImages(updated);
                    setNewGalleryUrl('');
                    void onUpdateStore({ ...store, menuImages: updated, fullMenuImage: updated[0] });
                  }}
                  className="bg-slate-900 text-white font-bold px-4 py-2 rounded-xl"
                >
                  إضافة للمينو
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {profMenuImages.map((imgUrl, idx) => (
                  <div key={idx} className="relative rounded-2xl overflow-hidden border border-slate-200">
                    <img src={imgUrl} alt={`مينو ${idx + 1}`} referrerPolicy="no-referrer" className="w-full h-32 object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        const updated = profMenuImages.filter((_, i) => i !== idx);
                        setProfMenuImages(updated);
                        void onUpdateStore({ ...store, menuImages: updated });
                      }}
                      className="absolute top-2 left-2 bg-rose-600 text-white p-1.5 rounded-full"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Online Store & Orders Management */}
        {activeTab === 'online-orders' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            {/* Store Owner Online Ordering Control Panel */}
            <div className="glass-card p-6 rounded-3xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">
                      إعدادات وتشغيل المتجر الإلكتروني 🛍️
                    </h3>
                    <span
                      className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                        store.onlineOrderingActive ?? true
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}
                    >
                      {store.onlineOrderingActive ?? true
                        ? 'استقبال الطلبات: نشط الآن ✅'
                        : 'استقبال الطلبات: متوقف مؤقتاً ⏸️'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    يمكنك تشغيل أو إيقاف استقبال الطلبات أونلاين فوراً، وتحديد رسوم التوصيل ورقم الواتساب المعتمد لاستلام الطلبات.
                  </p>
                </div>

                {isOwner && (
                  <button
                    type="button"
                    onClick={async () => {
                      const nextState = !(store.onlineOrderingActive ?? true);
                      await onUpdateStore({
                        ...store,
                        onlineOrderingActive: nextState,
                      });
                      showToast(
                        nextState
                          ? 'تم تشغيل استقبال طلبات الأونلاين بنجاح!'
                          : 'تم إيقاف استقبال طلبات الأونلاين مؤقتاً.'
                      );
                    }}
                    className={`px-4 py-2.5 rounded-xl font-black text-xs cursor-pointer shadow-sm transition ${
                      store.onlineOrderingActive ?? true
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {store.onlineOrderingActive ?? true
                      ? 'إيقاف استقبال الطلبات مؤقتاً ⏸️'
                      : 'تفعيل استقبال الطلبات الآن ▶️'}
                  </button>
                )}
              </div>

              {/* Delivery & Ordering Parameters */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-black text-slate-600 dark:text-slate-400 mb-1">
                    رسوم التوصيل ({store.currency}):
                  </label>
                  <input
                    type="number"
                    defaultValue={store.deliveryFee ?? 15}
                    onBlur={async (e) => {
                      const fee = parseFloat(e.target.value) || 0;
                      await onUpdateStore({ ...store, deliveryFee: fee });
                      showToast('تم تحديث رسوم التوصيل.');
                    }}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-600 dark:text-slate-400 mb-1">
                    الحد الأدنى للطلب ({store.currency}):
                  </label>
                  <input
                    type="number"
                    defaultValue={store.minOrderAmount ?? 30}
                    onBlur={async (e) => {
                      const min = parseFloat(e.target.value) || 0;
                      await onUpdateStore({ ...store, minOrderAmount: min });
                      showToast('تم تحديث الحد الأدنى للطلب.');
                    }}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-600 dark:text-slate-400 mb-1">
                    وقت التجهيز التقديري (بالدقائق):
                  </label>
                  <input
                    type="number"
                    defaultValue={store.estimatedDeliveryMinutes ?? 35}
                    onBlur={async (e) => {
                      const mins = parseInt(e.target.value, 10) || 30;
                      await onUpdateStore({ ...store, estimatedDeliveryMinutes: mins });
                      showToast('تم تحديث وقت التجهيز التقديري.');
                    }}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-600 dark:text-slate-400 mb-1">
                    رقم واتساب استلام الطلبات:
                  </label>
                  <input
                    type="tel"
                    dir="ltr"
                    defaultValue={store.whatsappOrdersNumber || store.phone}
                    onBlur={async (e) => {
                      const num = e.target.value.trim();
                      await onUpdateStore({ ...store, whatsappOrdersNumber: num });
                      showToast('تم تحديث رقم واتساب الطلبات.');
                    }}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Live Orders Tracker */}
            <LiveOrdersManager
              sessionUser={sessionUser}
              storeId={store.id}
              merchantId={store.merchantId}
              isOwner={isOwner}
            />
          </div>
        )}

        {/* 4. Offers & Digital Vouchers (For All or Specific Customers) */}
        {activeTab === 'offers' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                العروض المؤقتة والقسائم الرقمية (Vouchers)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                أصدر قسائم رقمية متاحة لكل العملاء أو مخصصة لعملاء محددين بالاسم مع كود و QR جاهز للصرف.
              </p>
            </div>

            <form onSubmit={handleCreateVoucher} className="glass-card p-6 rounded-3xl space-y-4 text-xs">
              <h4 className="font-black text-sm flex items-center gap-2">
                <Ticket className="w-4 h-4 text-amber-500" />
                <span>إنشاء قسيمة رقمية بكود و QR</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  placeholder="عنوان القسيمة (مثال: خصم 15 ر.س)"
                  value={vchTitle}
                  onChange={(e) => setVchTitle(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5"
                />
                <input
                  type="text"
                  placeholder="كود القسيمة (اختياري: AADA-15)"
                  value={vchCode}
                  onChange={(e) => setVchCode(e.target.value)}
                  dir="ltr"
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 font-mono"
                />
                <input
                  type="text"
                  placeholder="قيمة الخصم"
                  value={vchDiscount}
                  onChange={(e) => setVchDiscount(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold block mb-1">النقاط المطلوبة للاستبدال</label>
                  <input
                    type="number"
                    value={vchPointsCost}
                    onChange={(e) => setVchPointsCost(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">الحد الأقصى للاستخدام</label>
                  <input
                    type="number"
                    value={vchLimit}
                    onChange={(e) => setVchLimit(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">تاريخ الانتهاء</label>
                  <input
                    type="date"
                    value={vchExpiry}
                    onChange={(e) => setVchExpiry(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2"
                  />
                </div>
              </div>

              {/* Audience Selector: For All Customers vs Specific Customers */}
              <div className="bg-slate-50/90 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-sky-600" />
                    <span>تخصيص جمهور القسيمة:</span>
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setVchAudienceType('all')}
                      className={`px-3.5 py-1.5 rounded-xl font-black transition-all cursor-pointer ${
                        vchAudienceType === 'all'
                          ? 'bg-[#0B1F3A] text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      متاحة لكل العملاء
                    </button>
                    <button
                      type="button"
                      onClick={() => setVchAudienceType('specific')}
                      className={`px-3.5 py-1.5 rounded-xl font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                        vchAudienceType === 'specific'
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>مخصصة لعملاء محددين ({vchTargetCustomerIds.length})</span>
                    </button>
                  </div>
                </div>

                {vchAudienceType === 'specific' && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <input
                        type="text"
                        placeholder="ابحث باسم العميل أو الرقم لتحديده..."
                        value={vchCustomerSearch}
                        onChange={(e) => setVchCustomerSearch(e.target.value)}
                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setVchTargetCustomerIds(
                            vchTargetCustomerIds.length === effectiveCrmCustomers.length
                              ? []
                              : effectiveCrmCustomers.map((c) => c.id)
                          )
                        }
                        className="text-sky-700 dark:text-sky-400 font-bold hover:underline px-2 py-1"
                      >
                        {vchTargetCustomerIds.length === effectiveCrmCustomers.length
                          ? 'إلغاء تحديد الكل'
                          : 'تحديد كل العملاء'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-44 overflow-y-auto p-1">
                      {effectiveCrmCustomers
                        .filter(
                          (c) =>
                            !vchCustomerSearch.trim() ||
                            c.displayName.includes(vchCustomerSearch.trim()) ||
                            c.maskedPhone.includes(vchCustomerSearch.trim()) ||
                            c.id.includes(vchCustomerSearch.trim())
                        )
                        .map((c) => {
                          const isChecked = vchTargetCustomerIds.includes(c.id);
                          return (
                            <label
                              key={c.id}
                              className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                                isChecked
                                  ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-400 text-sky-950 dark:text-sky-100'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() =>
                                    setVchTargetCustomerIds((prev) =>
                                      isChecked ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                                    )
                                  }
                                  className="w-4 h-4 accent-sky-600"
                                />
                                <div>
                                  <div className="font-bold text-xs">{c.displayName}</div>
                                  <div className="text-[10px] text-slate-400 font-mono" dir="ltr">
                                    {c.maskedPhone}
                                  </div>
                                </div>
                              </div>
                              <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                                {c.storeBalance} نقطة
                              </span>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="bg-gradient-gold-cta text-[#0B1F3A] font-black px-6 py-2.5 rounded-xl cursor-pointer"
              >
                إصدار القسيمة الرقمية
              </button>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {(store.vouchers || []).map((v) => (
                <div
                  key={v.id}
                  className="glass-card p-5 rounded-2xl flex items-center justify-between gap-4 border-r-4 border-[#007BFF]"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono font-black text-xs bg-sky-100 text-sky-900 px-2.5 py-0.5 rounded-lg inline-block">
                        {v.code}
                      </span>
                      {v.audienceType === 'specific' ? (
                        <span className="bg-purple-100 text-purple-900 font-bold text-[10px] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                          <UserCheck className="w-3 h-3" />
                          <span>مخصصة لـ {v.targetCustomerIds?.length || 0} عميل</span>
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-900 font-bold text-[10px] px-2.5 py-0.5 rounded-full">
                          متاحة لكل العملاء
                        </span>
                      )}
                    </div>
                    <h5 className="font-black text-sm">{v.title}</h5>
                    <p className="text-slate-500">
                      {v.discountText} · مقابل {v.pointsCost} نقطة · حتى {v.expiryDate}
                    </p>
                    {v.audienceType === 'specific' && v.targetCustomerNames && v.targetCustomerNames.length > 0 && (
                      <p className="text-[11px] font-bold text-purple-800 dark:text-purple-300 bg-purple-50/80 dark:bg-purple-950/30 px-2.5 py-1 rounded-lg">
                        العملاء المشمولون: {v.targetCustomerNames.join('، ')}
                      </p>
                    )}
                    <p className="font-bold text-emerald-700">
                      المستخدم: {v.usedCount} / {v.usageLimit}
                    </p>
                  </div>
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <div className="p-2 bg-white rounded-xl border border-slate-200">
                      <QrCode className="w-10 h-10 text-[#0B1F3A]" />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateStore({
                          ...store,
                          vouchers: (store.vouchers || []).map((mv) =>
                            mv.id === v.id ? { ...mv, active: !mv.active } : mv
                          ),
                        })
                      }
                      className={`px-2.5 py-1 rounded-full font-bold ${
                        v.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {v.active ? 'مفعلة' : 'موقوفة'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Loyalty Programs + 3-Mode Points Calculation Bar + Interactive Simulator + Version History */}
        {activeTab === 'programs' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                برامج الولاء، شريط احتساب النقاط الذكي، وسجل الإصدارات
              </h3>
              <p className="text-xs text-slate-500">
                اختر طريقة احتساب النقاط (عدد نقاط مقابل مبلغ، أو نسبة مئوية %، أو شرائح من وإلى مبلغ بعدد أو نسبة) مع محاكي فوري.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <form
                onSubmit={handleAddProgram}
                className="lg:col-span-8 glass-card p-6 rounded-3xl space-y-4 text-xs"
              >
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="font-bold">اسم البرنامج</label>
                    <input
                      type="text"
                      placeholder="مثال: نقاط موسم الرياض"
                      value={progName}
                      onChange={(e) => setProgName(e.target.value)}
                      required
                      className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5"
                    />
                  </div>
                  <div>
                    <label className="font-bold">النوع</label>
                    <select
                      value={progType}
                      onChange={(e) => setProgType(e.target.value as LoyaltyProgram['type'])}
                      className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 font-bold"
                    >
                      <option value="points">نقاط</option>
                      <option value="stamps">أختام</option>
                      <option value="rewards">مكافآت</option>
                      <option value="offers">عروض</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold">عملة البرنامج</label>
                    <select
                      value={progCurrency}
                      onChange={(e) => setProgCurrency(e.target.value as MarketCurrency)}
                      className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 font-bold"
                    >
                      <option value="SAR">SAR</option>
                      <option value="EGP">EGP</option>
                      <option value="AED">AED</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="font-bold">تاريخ البداية</label>
                    <input
                      type="date"
                      value={progStartDate}
                      onChange={(e) => setProgStartDate(e.target.value)}
                      className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="font-bold">تاريخ النهاية</label>
                    <input
                      type="date"
                      value={progEndDate}
                      onChange={(e) => setProgEndDate(e.target.value)}
                      className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="font-bold">حد الفاتورة ({progCurrency})</label>
                    <input
                      type="number"
                      value={progMinInvoice}
                      onChange={(e) => setProgMinInvoice(e.target.value)}
                      className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="font-bold">صلاحية النقاط (أيام)</label>
                    <input
                      type="number"
                      value={progExpiryDays}
                      onChange={(e) => setProgExpiryDays(e.target.value)}
                      className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="font-bold">الأصناف المشمولة</label>
                    <input
                      type="text"
                      value={progIncludedItems}
                      onChange={(e) => setProgIncludedItems(e.target.value)}
                      className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="font-bold">وصف المكافأة</label>
                    <input
                      type="text"
                      value={progRewardVal}
                      onChange={(e) => setProgRewardVal(e.target.value)}
                      className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2"
                    />
                  </div>
                  {progType === 'stamps' ? (
                    <div>
                      <label className="font-bold">عدد الأختام</label>
                      <input
                        type="number"
                        min="2"
                        max="15"
                        value={progStampsReq}
                        onChange={(e) => setProgStampsReq(e.target.value)}
                        className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="font-bold">الحد الأقصى للاستبدال</label>
                      <input
                        type="number"
                        value={progMaxRedemption}
                        onChange={(e) => setProgMaxRedemption(e.target.value)}
                        className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2"
                      />
                    </div>
                  )}
                </div>

                {/* 3-Mode Points Calculation Bar */}
                {progType !== 'stamps' && (
                  <div className="bg-sky-50/70 dark:bg-slate-800/80 p-4 rounded-2xl border border-sky-200 dark:border-slate-700 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-black text-sky-950 dark:text-white flex items-center gap-1.5">
                        <SlidersHorizontal className="w-4 h-4 text-sky-600" />
                        <span>شريط احتساب النقاط (اختر نمط الاحتساب):</span>
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setProgCalcMode('per_amount')}
                          className={`px-3 py-1.5 rounded-xl font-black transition-all cursor-pointer ${
                            progCalcMode === 'per_amount'
                              ? 'bg-[#0B1F3A] text-white'
                              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          عدد النقاط والمبلغ
                        </button>
                        <button
                          type="button"
                          onClick={() => setProgCalcMode('percentage')}
                          className={`px-3 py-1.5 rounded-xl font-black transition-all cursor-pointer flex items-center gap-1 ${
                            progCalcMode === 'percentage'
                              ? 'bg-sky-600 text-white'
                              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <Percent className="w-3.5 h-3.5" />
                          <span>نسبة مئوية %</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setProgCalcMode('tiers')}
                          className={`px-3 py-1.5 rounded-xl font-black transition-all cursor-pointer ${
                            progCalcMode === 'tiers'
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          من وإلى مبلغ (عدد أو نسبة)
                        </button>
                      </div>
                    </div>

                    {/* Mode 1: Fixed Points per Amount */}
                    {progCalcMode === 'per_amount' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div>
                          <label className="font-bold block mb-1">لكل مبلغ مشتريات ({progCurrency})</label>
                          <input
                            type="number"
                            min="1"
                            value={progUnitAmount}
                            onChange={(e) => setProgUnitAmount(Math.max(1, Number(e.target.value) || 1))}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-black"
                          />
                        </div>
                        <div>
                          <label className="font-bold block mb-1">يحصل العميل على (عدد النقاط)</label>
                          <input
                            type="number"
                            min="1"
                            value={progPointsPerUnit}
                            onChange={(e) => setProgPointsPerUnit(Math.max(1, Number(e.target.value) || 1))}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-sky-300 dark:border-sky-700 rounded-xl px-3 py-2 font-mono font-black text-sky-700"
                          />
                        </div>
                      </div>
                    )}

                    {/* Mode 2: Percentage of Invoice */}
                    {progCalcMode === 'percentage' && (
                      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="font-bold">نسبة النقاط من إجمالي الفاتورة (%)</label>
                          <span className="font-mono font-black text-base text-sky-700 bg-sky-50 px-3 py-0.5 rounded-lg">
                            {progPercentageRate}%
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="1"
                            max="50"
                            value={progPercentageRate}
                            onChange={(e) => setProgPercentageRate(Math.max(1, Number(e.target.value) || 1))}
                            className="flex-1 accent-sky-600"
                          />
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={progPercentageRate}
                            onChange={(e) => setProgPercentageRate(Math.max(1, Number(e.target.value) || 1))}
                            className="w-20 bg-slate-50 dark:bg-slate-800 border border-slate-300 rounded-xl px-2.5 py-1.5 text-center font-mono font-black"
                          />
                        </div>
                      </div>
                    )}

                    {/* Mode 3: From-To Tiers with Fixed Points OR Percentage */}
                    {progCalcMode === 'tiers' && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-700 dark:text-slate-200">
                            جدول الشرائح (من مبلغ إلى مبلغ = نقاط ثابتة أو نسبة %):
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setProgTiers((prev) => [
                                ...prev,
                                {
                                  minAmount: (prev[prev.length - 1]?.maxAmount || 200) + 1,
                                  maxAmount: (prev[prev.length - 1]?.maxAmount || 200) + 300,
                                  tierCalcMode: 'points',
                                  rewardType: 'points',
                                  points: 50,
                                  percentageRate: 15,
                                },
                              ])
                            }
                            className="bg-sky-600 text-white font-bold px-3 py-1 rounded-lg hover:bg-sky-700 cursor-pointer"
                          >
                            + إضافة شريحة
                          </button>
                        </div>
                        <div className="space-y-2">
                          {progTiers.map((tier, idx) => {
                            const rType = tier.tierCalcMode || tier.rewardType || 'points';
                            return (
                              <div
                                key={idx}
                                className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700"
                              >
                                <span className="text-[11px] font-bold text-slate-500">من</span>
                                <input
                                  type="number"
                                  value={tier.minAmount}
                                  onChange={(e) =>
                                    setProgTiers((prev) =>
                                      prev.map((t, i) =>
                                        i === idx ? { ...t, minAmount: parseFloat(e.target.value) || 0 } : t
                                      )
                                    )
                                  }
                                  className="w-20 bg-slate-50 dark:bg-slate-800 border border-slate-300 rounded-lg px-2 py-1 text-center font-mono"
                                />
                                <span className="text-[11px] font-bold text-slate-500">إلى</span>
                                <input
                                  type="number"
                                  value={tier.maxAmount}
                                  onChange={(e) =>
                                    setProgTiers((prev) =>
                                      prev.map((t, i) =>
                                        i === idx ? { ...t, maxAmount: parseFloat(e.target.value) || 0 } : t
                                      )
                                    )
                                  }
                                  className="w-20 bg-slate-50 dark:bg-slate-800 border border-slate-300 rounded-lg px-2 py-1 text-center font-mono"
                                />
                                <select
                                  value={rType}
                                  onChange={(e) =>
                                    setProgTiers((prev) =>
                                      prev.map((t, i) =>
                                        i === idx
                                          ? {
                                              ...t,
                                              tierCalcMode: e.target.value as 'points' | 'percentage',
                                              rewardType: e.target.value as 'points' | 'percentage',
                                            }
                                          : t
                                      )
                                    )
                                  }
                                  className="bg-sky-50 dark:bg-slate-800 border border-sky-200 rounded-lg px-2 py-1 font-bold text-sky-900 dark:text-sky-200"
                                >
                                  <option value="points">عدد نقاط ثابت</option>
                                  <option value="percentage">نسبة مئوية %</option>
                                </select>
                                {rType === 'percentage' ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min="1"
                                      max="100"
                                      value={tier.percentageRate ?? 10}
                                      onChange={(e) =>
                                        setProgTiers((prev) =>
                                          prev.map((t, i) =>
                                            i === idx
                                              ? { ...t, percentageRate: parseFloat(e.target.value) || 1 }
                                              : t
                                          )
                                        )
                                      }
                                      className="w-16 bg-amber-50 border border-amber-300 rounded-lg px-2 py-1 text-center font-black text-amber-900 font-mono"
                                    />
                                    <span className="font-black text-amber-700">%</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min="1"
                                      value={tier.points}
                                      onChange={(e) =>
                                        setProgTiers((prev) =>
                                          prev.map((t, i) =>
                                            i === idx ? { ...t, points: parseInt(e.target.value, 10) || 1 } : t
                                          )
                                        )
                                      }
                                      className="w-16 bg-sky-50 border border-sky-300 rounded-lg px-2 py-1 text-center font-black text-sky-800 font-mono"
                                    />
                                    <span className="font-bold text-sky-700">نقطة</span>
                                  </div>
                                )}
                                {progTiers.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setProgTiers((prev) => prev.filter((_, i) => i !== idx))
                                    }
                                    className="text-rose-500 hover:bg-rose-50 p-1 rounded-lg mr-auto"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="font-bold">الفروع:</span>
                    {visibleBranches.map((b) => {
                      const checked = progBranches.includes(b.id);
                      return (
                        <label key={b.id} className="inline-flex items-center gap-1 cursor-pointer font-bold">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setProgBranches((prev) =>
                                checked ? prev.filter((id) => id !== b.id) : [...prev, b.id]
                              )
                            }
                          />
                          <span>{b.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  <label className="inline-flex items-center gap-1.5 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={progAllowStacking}
                      onChange={(e) => setProgAllowStacking(e.target.checked)}
                    />
                    <span>السماح بالجمع مع العروض (Stacking)</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-6 py-2.5 rounded-xl cursor-pointer"
                >
                  حفظ وإصدار نسخة جديدة وتحديث احتساب النقاط
                </button>
              </form>

              {/* Interactive Rules Simulator */}
              <div className="lg:col-span-4 glass-card p-6 rounded-3xl space-y-4 text-xs border-2 border-sky-200 dark:border-sky-800/50">
                <h4 className="font-black text-sm flex items-center gap-2 text-sky-800 dark:text-sky-300">
                  <SlidersHorizontal className="w-4 h-4" />
                  <span>محاكي قواعد النقاط والمكافآت</span>
                </h4>
                <p className="text-slate-500">جرّب مبلغ فاتورة افتراضي لمعاينة النقاط المحتسبة قبل النشر:</p>
                <div>
                  <label className="font-bold">قيمة الفاتورة ({progCurrency})</label>
                  <input
                    type="number"
                    value={simInvoiceAmount}
                    onChange={(e) => setSimInvoiceAmount(e.target.value)}
                    className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-lg font-black text-center font-mono"
                  />
                </div>
                <div
                  className={`p-4 rounded-2xl text-center space-y-1 ${
                    simResult.eligible
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border border-rose-200 text-rose-800'
                  }`}
                >
                  <span className="text-[11px] font-bold block">الناتج المتوقع للعميل</span>
                  <p className="text-3xl font-black">
                    {simResult.eligible
                      ? `+${simResult.earned} ${progType === 'stamps' ? 'ختم' : 'نقطة'}`
                      : '0'}
                  </p>
                  <p className="text-[11px] font-bold">{simResult.note}</p>
                </div>
              </div>
            </div>

            {/* Active Programs + Immutable Version Snapshots */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-black text-sm">البرامج النشطة والمسودات</h4>
                {store.programs.map((prog) => (
                  <div key={prog.id} className="glass-card p-4 rounded-2xl flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm">{prog.name}</span>
                        <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                          {prog.currency}
                        </span>
                        <span className="bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded-full">
                          v{prog.version}.0
                        </span>
                      </div>
                      <p className="text-slate-500 mt-1">{prog.rewardValue}</p>
                    </div>
                    <select
                      value={prog.status}
                      onChange={(e) =>
                        onUpdateStore({
                          ...store,
                          programs: store.programs.map((p) =>
                            p.id === prog.id
                              ? { ...p, status: e.target.value as LoyaltyProgram['status'] }
                              : p
                          ),
                        })
                      }
                      className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 font-bold"
                    >
                      <option value="مسودة">مسودة</option>
                      <option value="فعال">فعال</option>
                      <option value="متوقف">متوقف</option>
                      <option value="منتهي">منتهي</option>
                    </select>
                  </div>
                ))}
              </div>

              <div className="glass-card p-5 rounded-3xl space-y-3 text-xs">
                <h4 className="font-black text-sm flex items-center gap-2">
                  <History className="w-4 h-4 text-sky-600" />
                  <span>سجل الإصدارات غير القابل للتعديل (Program Versioning)</span>
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {(store.programVersions || []).map((ver, idx) => (
                    <div
                      key={`${ver.programId}-${ver.version}-${idx}`}
                      className="bg-white/80 dark:bg-slate-900/70 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-sky-700">
                          v{ver.version}.0 — {ver.programName}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">{ver.savedAt}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">{ver.summary}</p>
                      <p className="text-[10px] text-slate-400">بواسطة: {ver.savedBy}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 6A. Card Designer Studio (تصميم البطاقات) */}
        {activeTab === 'card-designer' && (
          <div className="space-y-4 max-w-6xl mx-auto">
            <div className="glass-card p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center font-black">
                  <Sparkles className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="font-black text-sm text-slate-900 dark:text-white">
                    استوديو تصميم البطاقات المتعددة ({storeCardsList.length} بطاقات مسجلة)
                  </h4>
                  <p className="text-slate-500">
                    صمّم بطاقة ولاء جديدة أو عدّل بطاقة حالية، ثم انتقل إلى قائمة المراجعة والطباعة.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {editingCardDesign && (
                  <button
                    type="button"
                    onClick={() => setEditingCardDesign(null)}
                    className="px-3.5 py-2 rounded-xl bg-amber-100 text-amber-900 font-black cursor-pointer"
                  >
                    + تصميم بطاقة جديدة مستقلة
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab('card-review')}
                  className="px-4 py-2 rounded-xl bg-[#0B1F3A] text-white font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <CreditCard className="w-4 h-4 text-[#00C2FF]" />
                  <span>مراجعة البطاقات وطباعتها ({storeCardsList.length})</span>
                </button>
              </div>
            </div>

            <LoyaltyCardStudio
              store={store}
              editingCard={editingCardDesign}
              onClearEditingCard={() => setEditingCardDesign(null)}
              onNavigateToCardReview={() => setActiveTab('card-review')}
              onSaveDesign={async (patch) => {
                await onUpdateStore({ ...store, ...patch });
              }}
              onOpenQrPoster={() => {
                setPrintingCardDesign(editingCardDesign || storeCardsList[0] || null);
                setShowQrPosterModal(true);
              }}
              showToast={showToast}
            />
          </div>
        )}

        {/* 6B. Card Review, Print & Edit (مراجعة البطاقات وطباعتها وتعديلها) */}
        {activeTab === 'card-review' && (
          <div className="space-y-6 max-w-5xl mx-auto text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                  مراجعة البطاقات وطباعتها وتعديلها ({storeCardsList.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  استعرض جميع بطاقات الولاء المصممة للمتجر، عدّل تصميم أي بطاقة، عيّن البطاقة الأساسية، أو اطبع بوستر الباركود الخاص بها فوراً.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingCardDesign(null);
                  setActiveTab('card-designer');
                }}
                className="bg-gradient-gold-cta text-[#0B1F3A] font-black px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>تصميم بطاقة جديدة</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {storeCardsList.map((card) => {
                const cardActive = card.active ?? card.isActive ?? true;
                const cardTextStyle = resolveCardTextStyle(card.cardTextColor);
                const cardPatternCfg = getCardPatternConfig(card.cardPattern);
                const cardCssBg = card.cardBackgroundImage
                  ? `linear-gradient(135deg, rgba(11,31,58,0.82), rgba(2,132,199,0.72)), url(${card.cardBackgroundImage}) center/cover`
                  : card.cardBgColor && card.cardAccentColor
                  ? `linear-gradient(135deg, ${card.cardBgColor}, ${card.cardAccentColor})`
                  : resolveCardCssGradient(card.cardColor);

                return (
                <div
                  key={card.id}
                  className="glass-card p-5 rounded-3xl space-y-4 flex flex-col justify-between border-2 border-slate-200/80 dark:border-slate-700"
                >
                  {/* Visual Card Preview */}
                  <div
                    className={`rounded-2xl p-5 shadow-lg relative overflow-hidden min-h-[180px] flex flex-col justify-between bg-gradient-to-br ${resolveCardGradientClass(
                      card.cardColor
                    )} ${cardTextStyle.className}`}
                    style={{
                      backgroundImage: cardCssBg,
                      ...cardTextStyle.style,
                    }}
                  >
                    {card.cardPattern && card.cardPattern !== 'none' && (
                      <div
                        className="pointer-events-none absolute inset-0"
                        style={cardPatternCfg.overlayStyle}
                      />
                    )}
                    <div className="relative z-10 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={store.logo}
                          alt={store.name}
                          referrerPolicy="no-referrer"
                          className="w-11 h-11 rounded-xl object-cover border border-white/30 bg-white/10"
                        />
                        <div>
                          <div className="text-[10px] font-bold opacity-80">
                            {card.cardTitle || store.name}
                          </div>
                          <h4 className="font-black text-base leading-tight">{card.name}</h4>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {card.isDefault && (
                          <span className="bg-amber-400 text-slate-950 font-black text-[10px] px-2.5 py-0.5 rounded-full">
                            البطاقة الأساسية
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                            cardActive
                              ? 'bg-emerald-400/25 text-white border border-white/30'
                              : 'bg-rose-900/60 text-rose-100'
                          }`}
                        >
                          {cardActive ? 'مفعّلة للعملاء' : 'موقوفة مؤقتاً'}
                        </span>
                      </div>
                    </div>

                    <div className="relative z-10 my-3 bg-black/20 backdrop-blur-xs rounded-xl p-3 border border-white/15">
                      <div className="text-[11px] font-black">
                        🎁 {card.loyaltyRule.rewardDescription}
                      </div>
                      <div className="text-[10px] opacity-85 mt-1">
                        {card.loyaltyRule.type === 'stamps'
                          ? `نظام الأختام: ${card.loyaltyRule.stampsRequired || 8} أختام للمكافأة`
                          : card.loyaltyRule.pointsCalcMode === 'percentage'
                          ? `احتساب نسبة مئوية: ${card.loyaltyRule.percentageRate || 10}% من قيمة الفاتورة`
                          : card.loyaltyRule.pointsCalcMode === 'per_amount'
                          ? `عدد ومبلغ: ${card.loyaltyRule.pointsPerUnit || 1} نقطة لكل ${card.loyaltyRule.currencyUnitAmount || 10} ${store.currency}`
                          : `شرائح متعدّدة (${card.loyaltyRule.pointRules?.length || 1} شريحة)`}
                      </div>
                    </div>

                    <div className="relative z-10 flex items-center justify-between text-[10px] opacity-85">
                      <span>النوع: {card.loyaltyRule.type === 'stamps' ? 'بطاقة أختام' : 'بطاقة نقاط'}</span>
                      <span>مرات الطباعة: {card.printedCount || 0}</span>
                    </div>
                  </div>

                  {/* Card Actions Toolbar */}
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCardDesign(card);
                          setActiveTab('card-designer');
                        }}
                        className="py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>تعديل البطاقة</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          setPrintingCardDesign(card);
                          setShowQrPosterModal(true);
                          const updatedCards = storeCardsList.map((c) =>
                            c.id === card.id ? { ...c, printedCount: (c.printedCount || 0) + 1 } : c
                          );
                          await onUpdateStore({ ...store, cardDesigns: updatedCards });
                        }}
                        className="py-2.5 px-3 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] font-black flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>طباعة البطاقة والباركود</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                      {!card.isDefault && (
                        <button
                          type="button"
                          onClick={async () => {
                            const updatedCards = storeCardsList.map((c) => ({
                              ...c,
                              isDefault: c.id === card.id,
                            }));
                            await onUpdateStore({
                              ...store,
                              cardDesigns: updatedCards,
                              cardColor: card.cardColor || store.cardColor,
                              cardTextColor: card.cardTextColor || store.cardTextColor,
                              secondaryLogo: card.secondaryLogo || store.secondaryLogo,
                              loyaltyRule: card.loyaltyRule,
                            });
                            showToast(`تم تعيين «${card.name}» كبطاقة المتجر الأساسية!`);
                          }}
                          className="text-sky-700 dark:text-sky-400 font-black hover:underline cursor-pointer"
                        >
                          تعيين كبطاقة أساسية
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={async () => {
                          const updatedCards = storeCardsList.map((c) =>
                            c.id === card.id
                              ? { ...c, active: !cardActive, isActive: !cardActive }
                              : c
                          );
                          await onUpdateStore({ ...store, cardDesigns: updatedCards });
                          showToast(cardActive ? 'تم إيقاف البطاقة مؤقتاً' : 'تم تفعيل البطاقة');
                        }}
                        className={`px-3 py-1 rounded-lg font-bold cursor-pointer ${
                          cardActive
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {cardActive ? 'إيقاف مؤقت' : 'تفعيل البطاقة'}
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          const duplicated: StoreCardDesign = {
                            ...card,
                            id: `card-${Date.now()}`,
                            name: `${card.name} (نسخة)`,
                            cardTitle: `${card.cardTitle || card.name} (نسخة)`,
                            isDefault: false,
                            createdAt: new Date().toISOString().split('T')[0],
                            printedCount: 0,
                          };
                          await onUpdateStore({
                            ...store,
                            cardDesigns: [...storeCardsList, duplicated],
                          });
                          showToast('تم نسخ البطاقة بنجاح!');
                        }}
                        className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>نسخ</span>
                      </button>

                      {storeCardsList.length > 1 && !card.isDefault && (
                        <button
                          type="button"
                          onClick={async () => {
                            const updatedCards = storeCardsList.filter((c) => c.id !== card.id);
                            await onUpdateStore({ ...store, cardDesigns: updatedCards });
                            showToast('تم حذف البطاقة');
                          }}
                          className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg cursor-pointer"
                          title="حذف البطاقة"
                        >
                          <Trash2 className="w-4 h-4" />
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

        {/* 7. Branches & Per-Branch Loyalty (Business) */}
        {activeTab === 'branches' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">إدارة الفروع والمواقع</h3>
                <p className="text-xs text-slate-500">
                  المستخدم: {store.branches.length} / {activePkg?.maxBranches ?? 5} فروع حسب باقة {store.subscriptionPlan}
                </p>
              </div>
            </div>

            {isOwner && (
              <form onSubmit={handleAddBranch} className="glass-card p-6 rounded-3xl space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="اسم الفرع..."
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    required
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5"
                  />
                  <input
                    type="text"
                    placeholder="الحي / المنطقة..."
                    value={branchArea}
                    onChange={(e) => setBranchArea(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5"
                  />
                  <input
                    type="text"
                    placeholder="العنوان التفصيلي..."
                    value={branchAddress}
                    onChange={(e) => setBranchAddress(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    type="text"
                    dir="ltr"
                    placeholder="جوال الفرع"
                    value={branchPhone}
                    onChange={(e) => setBranchPhone(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 font-mono"
                  />
                  <input
                    type="text"
                    dir="ltr"
                    placeholder="Lat (24.7136)"
                    value={branchLat}
                    onChange={(e) => setBranchLat(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 font-mono"
                  />
                  <input
                    type="text"
                    dir="ltr"
                    placeholder="Lng (46.6753)"
                    value={branchLng}
                    onChange={(e) => setBranchLng(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 font-mono"
                  />
                  <button
                    type="submit"
                    className="bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl py-2"
                  >
                    إضافة فرع جديد
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {visibleBranches.map((b) => {
                const boundStaff = store.cashiers.filter(
                  (c) => c.branchId === b.id || c.branchIds?.includes(b.id)
                );
                return (
                  <div key={b.id} className="glass-card p-5 rounded-2xl space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-black text-sm">{b.name}</h4>
                        <p className="text-slate-500">
                          {b.city} - {b.area} | {b.phone}
                        </p>
                        {b.lat && b.lng && (
                          <p className="font-mono text-[10px] text-slate-400">
                            GPS: {b.lat}, {b.lng}
                          </p>
                        )}
                      </div>
                      <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full">
                        نشط
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-slate-400 font-bold">الموظفون المرتبطون:</span>
                      {boundStaff.length > 0 ? (
                        boundStaff.map((s) => (
                          <span
                            key={s.id}
                            className="bg-sky-50 border border-sky-200 text-sky-900 px-2 py-0.5 rounded-lg font-bold"
                          >
                            {s.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400">لا يوجد</span>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between gap-2">
                      {store.subscriptionPlan === 'Business' ? (
                        editingBranchRuleId === b.id ? (
                          <div className="flex items-center gap-2 w-full">
                            <input
                              type="text"
                              value={branchRuleReward}
                              onChange={(e) => setBranchRuleReward(e.target.value)}
                              className="flex-1 bg-white border border-slate-300 rounded-lg px-2 py-1"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                await onUpdateStore({
                                  ...store,
                                  branches: store.branches.map((br) =>
                                    br.id === b.id
                                      ? {
                                          ...br,
                                          branchRule: {
                                            type: 'points',
                                            rewardDescription: branchRuleReward,
                                          },
                                        }
                                      : br
                                  ),
                                });
                                setEditingBranchRuleId(null);
                              }}
                              className="bg-sky-600 text-white font-bold px-3 py-1 rounded-lg"
                            >
                              حفظ
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="text-slate-500">
                              قاعدة الفرع: {b.branchRule?.rewardDescription || 'القواعد العامة للمتجر'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingBranchRuleId(b.id)}
                              className="text-sky-700 font-bold hover:underline"
                            >
                              تخصيص قاعدة الفرع
                            </button>
                          </>
                        )
                      ) : (
                        <span className="text-slate-400 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> تخصيص برنامج ولاء لكل فرع متاح في باقة Business فقط
                        </span>
                      )}
                    </div>

                    {/* Geofence & Proximity Alert configuration */}
                    <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                          <Radio className="w-3.5 h-3.5 text-sky-600 animate-pulse" />
                          <span>رادار التنبيه الجغرافي (Geofence):</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 font-mono">
                            {b.geofenceRadiusMeters || 1000} متر
                          </span>
                        </div>
                        {editingBranchGeoId !== b.id && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBranchGeoId(b.id);
                              setBranchGeoRadius(b.geofenceRadiusMeters || 1000);
                              setBranchGeoAlertMsg(
                                b.proximityAlertMessage ||
                                  `أهلاً بك بالقرب من فرعنا في ${b.area || b.city}! تفضل بالزيارة للاستفادة من عروض اليوم`
                              );
                              setBranchGeoBadge(b.activeOfferBadge || 'خصم 20%');
                            }}
                            className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                          >
                            تعديل التنبيه
                          </button>
                        )}
                      </div>

                      {editingBranchGeoId === b.id ? (
                        <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl space-y-2.5 border border-sky-200 dark:border-sky-800/40 text-xs">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                              نطاق الرادار الجغرافي (قطر التنبيه):
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {[300, 500, 1000, 2000, 5000].map((r) => (
                                <button
                                  key={r}
                                  type="button"
                                  onClick={() => setBranchGeoRadius(r)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    branchGeoRadius === r
                                      ? 'bg-sky-600 text-white shadow-xs'
                                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {r >= 1000 ? `${r / 1000} كم` : `${r} متر`}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                              رسالة الإشعار الترحيبي عند الاقتراب من الفرع:
                            </label>
                            <input
                              type="text"
                              value={branchGeoAlertMsg}
                              onChange={(e) => setBranchGeoAlertMsg(e.target.value)}
                              placeholder="أهلاً بك بالقرب من فرعنا..."
                              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                              شارة العرض النشط على الخريطة:
                            </label>
                            <input
                              type="text"
                              value={branchGeoBadge}
                              onChange={(e) => setBranchGeoBadge(e.target.value)}
                              placeholder="مثال: خصم 20% أو قهوة مجانية"
                              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100"
                            />
                          </div>

                          <div className="flex items-center gap-2 pt-1 justify-end">
                            <button
                              type="button"
                              onClick={() => setEditingBranchGeoId(null)}
                              className="px-3 py-1 text-slate-500 hover:text-slate-700 font-bold"
                            >
                              إلغاء
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await onUpdateStore({
                                  ...store,
                                  branches: store.branches.map((br) =>
                                    br.id === b.id
                                      ? {
                                          ...br,
                                          geofenceRadiusMeters: branchGeoRadius,
                                          proximityAlertMessage: branchGeoAlertMsg.trim() || undefined,
                                          activeOfferBadge: branchGeoBadge.trim() || undefined,
                                        }
                                      : br
                                  ),
                                });
                                setEditingBranchGeoId(null);
                                showToast('تم تحديث إعدادات التنبيه الجغرافي للفرع بنجاح!');
                              }}
                              className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-black cursor-pointer shadow-xs"
                            >
                              حفظ إعدادات الرادار
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500 space-y-1 bg-slate-50/60 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                          <p className="line-clamp-1">
                            <span className="font-bold text-slate-700 dark:text-slate-300">رسالة الاقتراب: </span>
                            {b.proximityAlertMessage || 'أهلاً بك بالقرب من فرعنا! تفضل واستمتع بعروض اليوم'}
                          </p>
                          {b.activeOfferBadge && (
                            <p>
                              <span className="font-bold text-slate-700 dark:text-slate-300">شارة العرض: </span>
                              <span className="text-amber-600 dark:text-amber-400 font-bold">{b.activeOfferBadge}</span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 8. Staff & Refund Requests */}
        {activeTab === 'staff' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                الموظفون والكاشير وطلبات الاسترجاع
              </h3>
              <span className="text-xs font-bold bg-sky-50 border border-sky-200 text-sky-900 px-3 py-1 rounded-full">
                الموظفون: {store.cashiers.length} / {activePkg?.maxStaff ?? 15}
              </span>
            </div>

            <form onSubmit={handleAddStaff} className="glass-card p-6 rounded-3xl space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="اسم الموظف..."
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  required
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5"
                />
                <input
                  type="text"
                  placeholder="اسم المستخدم..."
                  value={staffUser}
                  onChange={(e) => setStaffUser(e.target.value)}
                  required
                  dir="ltr"
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 font-mono"
                />
                <input
                  type="password"
                  placeholder="كلمة مرور مؤقتة (6+)"
                  value={staffTempPass}
                  onChange={(e) => setStaffTempPass(e.target.value)}
                  required
                  minLength={6}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5"
                />
                <select
                  value={isOwner ? staffRole : 'CASHIER'}
                  onChange={(e) => setStaffRole(e.target.value as 'CASHIER' | 'MERCHANT_MANAGER')}
                  disabled={!isOwner}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 font-bold disabled:opacity-70"
                >
                  <option value="CASHIER">كاشير (CASHIER)</option>
                  {isOwner && <option value="MERCHANT_MANAGER">مدير فرع (MERCHANT_MANAGER)</option>}
                </select>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">الفروع:</span>
                  {visibleBranches.map((b) => {
                    const checked = staffBranchIds.includes(b.id);
                    return (
                      <label key={b.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setStaffBranchIds((prev) =>
                              e.target.checked ? [...prev, b.id] : prev.filter((id) => id !== b.id)
                            )
                          }
                        />
                        <span>{b.name}</span>
                      </label>
                    );
                  })}
                </div>
                <button
                  type="submit"
                  disabled={staffCreating}
                  className="bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl px-5 py-2.5 disabled:opacity-60"
                >
                  {staffCreating ? 'جاري الإنشاء...' : 'إنشاء حساب الموظف'}
                </button>
              </div>
            </form>

            <div className="space-y-3 text-xs">
              {store.cashiers.map((c) => {
                const stats = staffActivity[c.id] || { txCount: 0, totalAmount: 0 };
                const canMutateTarget = isOwner || c.role === 'CASHIER';
                return (
                  <div
                    key={c.id}
                    className="glass-card p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <h4 className="font-bold text-sm">
                        {c.name} (@{c.username}) · <span className="text-sky-600">{c.role}</span>
                        {c.mustChangePassword && (
                          <span className="mr-2 bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full">
                            كلمة مرور مؤقتة
                          </span>
                        )}
                      </h4>
                      <p className="text-slate-500">
                        الفروع: {c.branchName} · نشاط العمليات: <span className="font-black text-slate-800 dark:text-white">{stats.txCount}</span> عملية (
                        {formatCurrency(stats.totalAmount, store.currency)})
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {canMutateTarget && onMutateStaff && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setResetPassModalStaff(c);
                              setResetPassValue('');
                            }}
                            className="bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 font-bold px-3 py-1.5 rounded-xl flex items-center gap-1"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>تعيين كلمة مرور</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void onMutateStaff(store.merchantId, c.id, { active: !c.active })
                            }
                            className={`font-bold px-3 py-1.5 rounded-xl ${
                              c.active
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {c.active ? 'مفعل (إيقاف مؤقت)' : 'معطل (تفعيل)'}
                          </button>
                        </>
                      )}
                      {isOwner && onDeleteStaff && (
                        <button
                          type="button"
                          onClick={() => void onDeleteStaff(store.merchantId, c.id)}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold p-2 rounded-xl"
                          title="حذف الموظف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {refundRequests.length > 0 && (
              <div className="glass-card p-5 rounded-3xl space-y-3 border border-amber-200 text-xs">
                <h4 className="font-black text-sm">صندوق طلبات الاسترجاع المرفوعة من الكاشير</h4>
                {refundRequests.map((tx) => (
                  <div key={tx.id} className="bg-amber-50 p-3 rounded-xl flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black text-amber-950">
                        #{tx.invoiceNumber} — {tx.customerName} ({formatCurrency(tx.amount, tx.currency)})
                      </p>
                      <p className="text-amber-800">{tx.refundRequestReason}</p>
                    </div>
                    {onApproveRefund && (
                      <button
                        type="button"
                        onClick={() => void onApproveRefund(tx.id)}
                        className="bg-rose-600 text-white font-bold px-4 py-2 rounded-xl"
                      >
                        اعتماد القيد العكسي
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 9. CRM (Masked Phone + Segments + History) */}
        {activeTab === 'customers' && (
          <div className="glass-card p-6 sm:p-8 rounded-3xl space-y-5 max-w-5xl mx-auto text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  إدارة علاقات العملاء — حماية الخصوصية مفعلة
                </h3>
                <p className="text-slate-500">عرض أرقام الجوال مقنّعة جزئياً لحماية خصوصية العميل.</p>
              </div>
              <input
                type="text"
                placeholder="بحث بالاسم أو الرقم المقنع..."
                value={crmSearch}
                onChange={(e) => setCrmSearch(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {(['الكل', 'جدد', 'عائدون', 'غير نشطين', 'VIP'] as const).map((seg) => (
                <button
                  key={seg}
                  type="button"
                  onClick={() => setCrmSegmentFilter(seg)}
                  className={`px-3.5 py-1.5 rounded-xl font-bold ${
                    crmSegmentFilter === seg
                      ? 'bg-[#0B1F3A] text-white'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {seg}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                    <th className="py-3 px-3">العميل</th>
                    <th className="py-3 px-3">رقم الجوال (مقنّع)</th>
                    <th className="py-3 px-3">الشريحة</th>
                    <th className="py-3 px-3">عدد الزيارات</th>
                    <th className="py-3 px-3">الرصيد بالمتجر</th>
                    <th className="py-3 px-3">آخر زيارة</th>
                    <th className="py-3 px-3">السجل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCrm.map((c) => (
                    <tr key={c.id}>
                      <td className="py-3 px-3 font-bold">{c.displayName}</td>
                      <td className="py-3 px-3 font-mono text-slate-600" dir="ltr">
                        {c.maskedPhone}
                      </td>
                      <td className="py-3 px-3">
                        <span className="bg-sky-100 text-sky-900 font-bold px-2.5 py-0.5 rounded-full">
                          {c.segment}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold">{c.visitsCount}</td>
                      <td className="py-3 px-3 font-black text-emerald-700">{c.storeBalance}</td>
                      <td className="py-3 px-3 text-slate-500">{c.lastVisit}</td>
                      <td className="py-3 px-3">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedCrmCustomerId(selectedCrmCustomerId === c.id ? null : c.id)
                          }
                          className="text-sky-700 font-bold hover:underline"
                        >
                          {selectedCrmCustomerId === c.id ? 'إخفاء' : 'عرض العمليات'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredCrm.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400">
                        لا توجد بيانات عملاء مطابقة للفلتر.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {selectedCrmCustomerId && (
              <div className="bg-sky-50/70 dark:bg-slate-900/70 p-4 rounded-2xl border border-sky-200 space-y-2">
                <h4 className="font-black">سجل عمليات العميل داخل المتجر</h4>
                {storeTransactions
                  .filter((t) => t.customerId === selectedCrmCustomerId)
                  .map((t) => (
                    <div key={t.id} className="flex justify-between border-b border-sky-100 py-1.5">
                      <span className="font-mono">{t.invoiceNumber}</span>
                      <span>{t.branchName}</span>
                      <span>{formatCurrency(t.amount, t.currency)}</span>
                      <span className="font-bold">
                        {t.pointsEarned >= 0 ? `+${t.pointsEarned}` : t.pointsEarned}
                      </span>
                      <span className="text-slate-500">{t.timestamp}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* 10. Reports & Fraud Anomalies & Excel/CSV Export */}
        {activeTab === 'reports' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                تقارير الاحتفاظ وكشف التلاعب وتصدير البيانات
              </h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>تصدير جدول بيانات إكسل</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="bg-slate-900 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير CSV</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
              <div className="glass-card p-4 rounded-2xl">
                <span className="text-[11px] text-slate-500 font-bold block">العملاء الجدد</span>
                <span className="text-xl font-black text-sky-700">{store.metrics.newCustomers}</span>
              </div>
              <div className="glass-card p-4 rounded-2xl">
                <span className="text-[11px] text-slate-500 font-bold block">العائدون</span>
                <span className="text-xl font-black text-emerald-700">{store.metrics.returningCustomers}</span>
              </div>
              <div className="glass-card p-4 rounded-2xl">
                <span className="text-[11px] text-slate-500 font-bold block">غير النشطين</span>
                <span className="text-xl font-black text-rose-600">{store.metrics.inactiveCustomers}</span>
              </div>
              <div className="glass-card p-4 rounded-2xl">
                <span className="text-[11px] text-slate-500 font-bold block">متوسط الزيارات</span>
                <span className="text-xl font-black">{store.metrics.avgVisits}</span>
              </div>
              <div className="glass-card p-4 rounded-2xl">
                <span className="text-[11px] text-slate-500 font-bold block">الاستبدال</span>
                <span className="text-xl font-black text-amber-600">{store.metrics.redemptionRate}%</span>
              </div>
              <div className="glass-card p-4 rounded-2xl">
                <span className="text-[11px] text-slate-500 font-bold block">تكرار الشراء</span>
                <span className="text-xl font-black text-[#0284C7]">{store.metrics.repeatPurchaseRate}%</span>
              </div>
            </div>

            {/* Fraud Anomalies */}
            <div className="glass-card p-6 rounded-3xl space-y-3 text-xs">
              <h4 className="font-black text-base text-rose-800 dark:text-rose-300">
                تقرير شذوذ الاحتيال وتنبيهات الكاشير ({(store.fraudAlerts?.length || 0) + flaggedTxs.length})
              </h4>
              {store.fraudAlerts?.length || flaggedTxs.length ? (
                <div className="space-y-2">
                  {(store.fraudAlerts || []).map((a) => (
                    <div key={a.id} className="bg-rose-50 border border-rose-200 p-3 rounded-xl flex justify-between">
                      <span className="font-bold text-rose-900">
                        {a.cashierName} — #{a.invoiceNumber}: {a.reason}
                      </span>
                      <span className="font-mono text-slate-500">{a.timestamp}</span>
                    </div>
                  ))}
                  {flaggedTxs.map((t) => (
                    <div key={t.id} className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex justify-between">
                      <span className="font-bold text-amber-900">
                        #{t.invoiceNumber}: {t.fraudFlags?.join('، ')}
                      </span>
                      <span className="font-mono text-slate-500">{t.timestamp}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500">لا توجد حالات شذوذ مسجلة حالياً.</p>
              )}
            </div>
          </div>
        )}

        {/* 11. Partner Store Point Sharing (مشاركة النقاط مع متاجر أخرى ووضع حدود ونقاط محددة) */}
        {activeTab === 'point-sharing' && (
          <div className="space-y-6 max-w-5xl mx-auto text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Handshake className="w-6 h-6 text-sky-600" />
                  <span>مشاركة النقاط مع متاجر أخرى (حدود ونقاط محددة)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  اربط متجرك مع متاجر أخرى شريكة لتبادل أو مشاركة عدد نقاط محدد لكل عملية مع سقف لكل فاتورة وسقف شهري واضح.
                </p>
              </div>
            </div>

            {/* Summary KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="glass-card p-4 rounded-2xl">
                <span className="text-slate-500 font-bold block">المتاجر الشريكة النشطة</span>
                <p className="text-2xl font-black text-sky-600 mt-1">
                  {storePointShares.filter((s) => s.active).length}
                </p>
              </div>
              <div className="glass-card p-4 rounded-2xl">
                <span className="text-slate-500 font-bold block">إجمالي النقاط المشتركة هذا الشهر</span>
                <p className="text-2xl font-black text-emerald-600 mt-1">
                  {storePointShares.reduce((acc, s) => acc + (s.usedPointsThisMonth || 0), 0).toLocaleString('en-US')}
                </p>
              </div>
              <div className="glass-card p-4 rounded-2xl">
                <span className="text-slate-500 font-bold block">إجمالي السقف الشهري المتاح</span>
                <p className="text-2xl font-black text-amber-600 mt-1">
                  {storePointShares.reduce((acc, s) => acc + s.monthlyPointsCap, 0).toLocaleString('en-US')}
                </p>
              </div>
              <div className="glass-card p-4 rounded-2xl">
                <span className="text-slate-500 font-bold block">الرصيد المتبقي للمشاركة</span>
                <p className="text-2xl font-black text-[#0284C7] mt-1">
                  {Math.max(
                    0,
                    storePointShares.reduce((acc, s) => acc + (s.monthlyPointsCap - (s.usedPointsThisMonth || 0)), 0)
                  ).toLocaleString('en-US')}
                </p>
              </div>
            </div>

            {/* Form to Add New Partner Store Point Share Agreement */}
            <form onSubmit={handleAddPointShare} className="glass-card p-6 rounded-3xl space-y-4">
              <h4 className="font-black text-sm flex items-center gap-2 text-slate-900 dark:text-white">
                <Plus className="w-4 h-4 text-sky-600" />
                <span>إضافة اتفاقية مشاركة نقاط مع متجر آخر</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold block mb-1">اختر متجراً من المنصة أو اكتب اسمه</label>
                  <select
                    value={sharePartnerStoreId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSharePartnerStoreId(val);
                      const found = partnerStoresList.find((ps) => ps.id === val);
                      if (found) {
                        setSharePartnerName(found.name);
                        setSharePartnerCategory(found.category);
                      }
                    }}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 font-bold"
                  >
                    <option value="">-- اختر متجراً أو أدخل يدوياً --</option>
                    {partnerStoresList.map((ps) => (
                      <option key={ps.id} value={ps.id}>
                        {ps.name} ({ps.category} — {ps.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold block mb-1">اسم المتجر الشريك</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: كافيه أرابيكا المختص"
                    value={sharePartnerName}
                    onChange={(e) => setSharePartnerName(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5"
                  />
                </div>

                <div>
                  <label className="font-bold block mb-1">اتجاه مشاركة النقاط</label>
                  <select
                    value={shareDirection}
                    onChange={(e) =>
                      setShareDirection(e.target.value as 'bidirectional' | 'outgoing' | 'incoming')
                    }
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 font-bold"
                  >
                    <option value="bidirectional">تبادل مشترك للطرفين (جمع واستبدال)</option>
                    <option value="outgoing">منح نقاط لعملاء المتجر الشريك</option>
                    <option value="incoming">قبول نقاط المتجر الشريك في متجرنا</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="font-bold block mb-1">النقاط المشتركة لكل عملية</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={sharePointsAmount}
                    onChange={(e) => setSharePointsAmount(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-sky-300 rounded-xl px-3 py-2 font-mono font-black text-sky-700"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">حد النقاط للفاتورة الواحدة</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={shareMaxPerTx}
                    onChange={(e) => setShareMaxPerTx(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">السقف الشهري للنقاط</label>
                  <input
                    type="number"
                    min="10"
                    required
                    value={shareMonthlyCap}
                    onChange={(e) => setShareMonthlyCap(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-amber-300 rounded-xl px-3 py-2 font-mono font-black text-amber-700"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">الحد الأدنى للفاتورة ({store.currency})</label>
                  <input
                    type="number"
                    min="0"
                    value={shareMinInvoice}
                    onChange={(e) => setShareMinInvoice(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">تاريخ انتهاء الاتفاقية</label>
                  <input
                    type="date"
                    value={shareExpiresAt}
                    onChange={(e) => setShareExpiresAt(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <input
                  type="text"
                  placeholder="ملاحظات أو شروط المشاركة (مثال: يُشترط إبراز بطاقة المتجر الشريك عند الكاشير)..."
                  value={shareNotes}
                  onChange={(e) => setShareNotes(e.target.value)}
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5"
                />
                <button
                  type="submit"
                  className="bg-gradient-gold-cta text-[#0B1F3A] font-black px-6 py-2.5 rounded-xl cursor-pointer"
                >
                  حفظ وتفعيل مشاركة النقاط
                </button>
              </div>
            </form>

            {/* Existing Partner Point Share Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {storePointShares.map((share) => {
                const usagePct = Math.min(
                  100,
                  Math.round(((share.usedPointsThisMonth || 0) / Math.max(1, share.monthlyPointsCap)) * 100)
                );
                return (
                  <div
                    key={share.id}
                    className="glass-card p-5 rounded-3xl space-y-3 border-r-4 border-sky-600"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold bg-sky-100 text-sky-900 px-2.5 py-0.5 rounded-full">
                          {share.direction === 'bidirectional'
                            ? 'تبادل مشترك للطرفين'
                            : share.direction === 'outgoing'
                            ? 'منح نقاط لعملاء الشريك'
                            : 'قبول نقاط الشريك'}
                        </span>
                        <h4 className="font-black text-base text-slate-900 dark:text-white mt-1">
                          {share.partnerStoreName}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          التصنيف: {share.partnerCategory || 'متجر شريك'} · تنتهي في {share.expiresAt || 'غير محدد'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const updated = storePointShares.map((s) =>
                            s.id === share.id ? { ...s, active: !s.active } : s
                          );
                          await onUpdateStore({ ...store, partnerPointShares: updated });
                        }}
                        className={`px-3 py-1 rounded-full font-black cursor-pointer ${
                          share.active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {share.active ? 'مفعّلة' : 'موقوفة'}
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700 text-center">
                      <div>
                        <span className="text-[10px] text-slate-500 block">النقاط لكل عملية</span>
                        <span className="font-black text-sm text-sky-700">{share.pointsToShare} نقطة</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">حد الفاتورة الواحدة</span>
                        <span className="font-black text-sm text-slate-800 dark:text-white">
                          {share.maxPointsPerTransaction} نقطة
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">أدنى فاتورة</span>
                        <span className="font-black text-sm text-amber-700">
                          {formatCurrency(share.minInvoiceAmount || 0, store.currency)}
                        </span>
                      </div>
                    </div>

                    {/* Monthly Cap Usage Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between font-bold text-[11px]">
                        <span>استهلاك السقف الشهري المسموح:</span>
                        <span>
                          {(share.usedPointsThisMonth || 0).toLocaleString('en-US')} /{' '}
                          {share.monthlyPointsCap.toLocaleString('en-US')} نقطة ({usagePct}%)
                        </span>
                      </div>
                      <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            usagePct >= 90 ? 'bg-rose-500' : usagePct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${usagePct}%` }}
                        />
                      </div>
                    </div>

                    {share.notes && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-800/50 p-2.5 rounded-xl">
                        {share.notes}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 dark:border-slate-700">
                      <button
                        type="button"
                        disabled={!share.active || (share.usedPointsThisMonth || 0) + share.pointsToShare > share.monthlyPointsCap}
                        onClick={async () => {
                          const nextUsed = Math.min(
                            share.monthlyPointsCap,
                            (share.usedPointsThisMonth || 0) + share.pointsToShare
                          );
                          const updated = storePointShares.map((s) =>
                            s.id === share.id ? { ...s, usedPointsThisMonth: nextUsed } : s
                          );
                          await onUpdateStore({ ...store, partnerPointShares: updated });
                          showToast(
                            `تم تسجيل مشاركة +${share.pointsToShare} نقطة مع «${share.partnerStoreName}» بنجاح!`
                          );
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 font-black disabled:opacity-40 cursor-pointer"
                      >
                        + تسجيل عملية مشاركة ({share.pointsToShare} نقطة)
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          const updated = storePointShares.filter((s) => s.id !== share.id);
                          await onUpdateStore({ ...store, partnerPointShares: updated });
                          showToast('تم إلغاء اتفاقية المشاركة');
                        }}
                        className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-xl cursor-pointer"
                        title="حذف الاتفاقية"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 12. Subscriptions (Owner Only — Must Contact Admin to Switch + Smart Non-Embarrassing Pause) */}
        {activeTab === 'subscription' && isOwner && (
          <div className="space-y-6 max-w-5xl mx-auto text-xs">
            {/* Smart Non-Embarrassing Pause Notice when Expired */}
            {(isReadOnlySub || isStorePaused) && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 p-5 rounded-3xl space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-sm text-amber-950 dark:text-amber-200 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>نظام التوقف المؤقت الذكي مفعّل لحين تجديد الباقة</span>
                  </span>
                  <span className="bg-amber-200 text-amber-950 font-black px-3 py-1 rounded-full text-[11px]">
                    إخفاء غير محرج أمام العملاء
                  </span>
                </div>
                <p className="text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
                  نظراً لانتهاء فترة الباقة بدون تجديد، تم إخفاء باقات الولاء والانضمام عن زوار المتجر تلقائياً بطريقة لبقة وغير محرجة دون إظهار أي إشعار مالي للعملاء. تظهر للزوار العبارة الذكية:{' '}
                  <strong className="underline">«{SMART_PAUSE_NOTICE.customerSubtitle}»</strong>.
                </p>
              </div>
            )}

            <div className="glass-card p-6 sm:p-8 rounded-3xl space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black">الاشتراك وحدود الباقة ({store.subscriptionPlan})</h3>
                  <p className="text-slate-500 mt-0.5">
                    تاريخ الانتهاء: {store.subscriptionExpiry} · تغيير أو ترقية الباقة يتم حصرياً بالتواصل مع مدير النظام
                  </p>
                </div>
                <span
                  className={`font-black px-3.5 py-1.5 rounded-full ${
                    isReadOnlySub || isStorePaused
                      ? 'bg-rose-100 text-rose-800'
                      : isGraceSub
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {isReadOnlySub || isStorePaused
                    ? 'متوقف مؤقتاً بانتظار التجديد'
                    : isGraceSub
                    ? 'فترة سماح'
                    : 'اشتراك نشط'}
                </span>
              </div>

              {/* Limits Consumption Bars */}
              {activePkg && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white/70 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-bold">
                      <span>استهلاك الفروع</span>
                      <span>
                        {store.branches.length} / {activePkg.maxBranches}
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-600"
                        style={{
                          width: `${Math.min(100, (store.branches.length / Math.max(1, activePkg.maxBranches)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-bold">
                      <span>استهلاك الموظفين</span>
                      <span>
                        {store.cashiers.length} / {activePkg.maxStaff}
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500"
                        style={{
                          width: `${Math.min(100, (store.cashiers.length / Math.max(1, activePkg.maxStaff)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-bold">
                      <span>نظام الولاء والنقاط</span>
                      <span>{activePkg.loyaltyEnabled ? 'مفعل' : 'عرض المتجر فقط'}</span>
                    </div>
                    <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${activePkg.loyaltyEnabled ? 'bg-emerald-500' : 'bg-slate-400'}`}
                        style={{ width: activePkg.loyaltyEnabled ? '100%' : '20%' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-sky-50/80 dark:bg-slate-900/60 border border-sky-200 dark:border-slate-700 p-3.5 rounded-2xl flex items-center justify-between gap-3">
                <span className="font-bold text-sky-950 dark:text-slate-200">
                  🔒 لا يمكن تبديل الباقة تلقائياً من حساب المتجر — عند اختيار أي باقة سيتم إرسال طلب الترقية أو التجديد مباشرة لمدير النظام لاعتماده وتفعيله.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                {packages
                  .filter((pkg) => pkg.visibleForStores !== false || pkg.name === store.subscriptionPlan)
                  .sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99))
                  .map((pkg) => {
                    const isCurrentActive =
                      store.subscriptionPlan === pkg.name && !isReadOnlySub && !isGraceSub && !isStorePaused && store.status === 'active';
                    return (
                      <div
                        key={pkg.id}
                        className={`bg-white/85 dark:bg-slate-800/80 p-4 rounded-2xl border flex flex-col justify-between space-y-3 ${
                          store.subscriptionPlan === pkg.name
                            ? 'border-2 border-sky-500 shadow-sm'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <h5 className="font-black text-sm">{pkg.title}</h5>
                            {store.subscriptionPlan === pkg.name && (
                              <span className="bg-sky-100 text-sky-900 text-[10px] font-black px-2 py-0.5 rounded-full">
                                باقتك الحالية
                              </span>
                            )}
                          </div>
                          <p className="text-sky-700 dark:text-[#00C2FF] font-black mt-1">{pkg.priceText}</p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            فروع: {pkg.maxBranches} · موظفون: {pkg.maxStaff}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <button
                            type="button"
                            disabled={isCurrentActive}
                            onClick={() => void handleRequestPlanChangeFromAdmin(pkg)}
                            className={`w-full py-2.5 px-3 rounded-xl font-black cursor-pointer ${
                              isCurrentActive
                                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                : 'bg-gradient-gold-cta text-[#0B1F3A]'
                            }`}
                          >
                            {store.subscriptionPlan === pkg.name && (isReadOnlySub || isGraceSub || isStorePaused)
                              ? 'طلب تجديد الباقة من مدير النظام'
                              : isCurrentActive
                              ? 'الباقة المفعلة حالياً'
                              : `طلب باقة ${pkg.name} من الإدارة`}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setWaModalState({
                                isOpen: true,
                                mode: 'package',
                                packageTitle: pkg.title,
                                priceSummary: pkg.priceText,
                              })
                            }
                            className="w-full py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-black flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>تواصل واتساب مع مدير النظام</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-black text-sm text-emerald-900 dark:text-emerald-200">
                    هل تحتاج خدمة مخصصة أو باقة سلاسل فروع؟
                  </div>
                  <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
                    أرسل طلبك مباشرة إلى واتساب مدير النظام المسجل ليتم تجهيز الباقة وتفعيلها يدوياً لمتجرك.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setWaModalState({ isOpen: true, mode: 'service' })}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>طلب خدمة عبر واتساب الإدارة</span>
                </button>
              </div>
            </div>

            <div className="glass-card p-6 rounded-3xl space-y-3">
              <h4 className="text-base font-black">فواتير الاشتراك</h4>
              <table className="w-full text-right">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 px-3">الفاتورة</th>
                    <th className="py-2 px-3">الباقة</th>
                    <th className="py-2 px-3">المبلغ</th>
                    <th className="py-2 px-3">التاريخ</th>
                    <th className="py-2 px-3">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subscriptionInvoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="py-2 px-3 font-mono font-bold text-sky-700">{inv.id}</td>
                      <td className="py-2 px-3 font-bold">{inv.plan}</td>
                      <td className="py-2 px-3">{formatCurrency(inv.amount, store.currency)}</td>
                      <td className="py-2 px-3 text-slate-500">{inv.date}</td>
                      <td className="py-2 px-3 text-emerald-700 font-bold">{inv.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 13. Settings (Includes Store Profile + Security/Caps + Disputes Inbox) */}
        {activeTab === 'settings' && (
          <div className="space-y-6 max-w-4xl mx-auto text-xs">
            {/* Settings Sub-Navigation Tabs */}
            <div className="glass-card p-2 rounded-2xl flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSettingsSubTab('store-profile')}
                className={`flex-1 py-2.5 px-4 rounded-xl font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  settingsSubTab === 'store-profile'
                    ? 'bg-[#0B1F3A] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <StoreIcon className="w-4 h-4 text-[#00C2FF]" />
                <span>ملف المتجر والهوية وساعات العمل</span>
              </button>
              <button
                type="button"
                onClick={() => setSettingsSubTab('security-caps')}
                className={`flex-1 py-2.5 px-4 rounded-xl font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  settingsSubTab === 'security-caps'
                    ? 'bg-[#0B1F3A] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Lock className="w-4 h-4 text-amber-400" />
                <span>كلمة المرور وسقوف العمليات</span>
              </button>
              <button
                type="button"
                onClick={() => setSettingsSubTab('disputes')}
                className={`flex-1 py-2.5 px-4 rounded-xl font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  settingsSubTab === 'disputes'
                    ? 'bg-[#0B1F3A] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Ticket className="w-4 h-4 text-emerald-400" />
                <span>صندوق الاعتراضات والدعم ({tickets.length})</span>
              </button>
            </div>

            {/* Sub-tab 1: Store Profile (Moved inside Settings as requested) */}
            {settingsSubTab === 'store-profile' && (
              <form
                onSubmit={handleSaveProfile}
                className="glass-card p-6 sm:p-8 rounded-3xl space-y-5"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    ملف المتجر والهوية والصور وساعات العمل
                  </h3>
                  <span className="bg-sky-50 text-sky-800 font-bold px-3 py-1 rounded-full text-[11px]">
                    ضمن إعدادات المتجر
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold">اسم المتجر</label>
                    <input
                      type="text"
                      value={profName}
                      onChange={(e) => setProfName(e.target.value)}
                      required
                      className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5"
                    />
                  </div>
                  <div>
                    <label className="font-bold">التصنيف</label>
                    <select
                      value={profCategory}
                      onChange={(e) => setProfCategory(e.target.value as Store['category'])}
                      className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 font-bold"
                    >
                      <option value="كافيه">كافيه</option>
                      <option value="مطعم">مطعم</option>
                      <option value="صالون">صالون</option>
                      <option value="متجر">متجر</option>
                      <option value="أخرى">أخرى</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold">رقم التواصل</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={profPhone}
                      onChange={(e) => setProfPhone(e.target.value)}
                      required
                      className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-bold">ساعات العمل</label>
                    <input
                      type="text"
                      value={profWorkingHours}
                      onChange={(e) => setProfWorkingHours(e.target.value)}
                      placeholder="يومياً 7:00 ص - 12:00 ص"
                      className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5"
                    />
                  </div>
                  <div>
                    <label className="font-bold">المدينة / الحي</label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <input
                        type="text"
                        value={profCity}
                        onChange={(e) => setProfCity(e.target.value)}
                        className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5"
                      />
                      <input
                        type="text"
                        value={profArea}
                        onChange={(e) => setProfArea(e.target.value)}
                        className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="font-bold">العنوان التفصيلي</label>
                    <input
                      type="text"
                      value={profAddress}
                      onChange={(e) => setProfAddress(e.target.value)}
                      className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5"
                    />
                  </div>
                  <div>
                    <label className="font-bold">رابط خرائط جوجل</label>
                    <input
                      type="url"
                      dir="ltr"
                      value={profMapLink}
                      onChange={(e) => setProfMapLink(e.target.value)}
                      className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-bold">العملة</label>
                    <select
                      value={store.currency}
                      onChange={(e) =>
                        onUpdateStore({ ...store, currency: e.target.value as MarketCurrency })
                      }
                      className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 font-bold"
                    >
                      <option value="SAR">{AR_TRANSLATIONS.markets.currencyLabels.SAR}</option>
                      <option value="EGP">{AR_TRANSLATIONS.markets.currencyLabels.EGP}</option>
                      <option value="AED">{AR_TRANSLATIONS.markets.currencyLabels.AED}</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold">Wi-Fi للزوار</label>
                    <input
                      type="text"
                      value={profWifi}
                      onChange={(e) => setProfWifi(e.target.value)}
                      className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5"
                    />
                  </div>
                  <div>
                    <label className="font-bold">حساب Instagram</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={profInstagram}
                      onChange={(e) => setProfInstagram(e.target.value)}
                      className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 font-mono"
                    />
                  </div>
                </div>

                {/* Validated Image Uploads (PNG/JPG/WEBP <= 2MB) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white/60 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="space-y-1.5">
                    <label className="font-bold block">شعار المتجر (PNG/JPG/WEBP)</label>
                    <input
                      type="text"
                      value={profLogo}
                      onChange={(e) => setProfLogo(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono"
                    />
                    <label className="inline-flex items-center gap-1.5 text-sky-700 font-bold cursor-pointer hover:underline">
                      <Upload className="w-3.5 h-3.5" />
                      <span>رفع شعار (حد 2MB)</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => handleImageFileSelect(e, setProfLogo)}
                      />
                    </label>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold block">شعار ثانوي (اختياري)</label>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={profSecondaryLogo}
                      onChange={(e) => setProfSecondaryLogo(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono"
                    />
                    <label className="inline-flex items-center gap-1.5 text-sky-700 font-bold cursor-pointer hover:underline">
                      <Upload className="w-3.5 h-3.5" />
                      <span>رفع شعار ثانوي</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => handleImageFileSelect(e, setProfSecondaryLogo)}
                      />
                    </label>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold block">صورة الغلاف</label>
                    <input
                      type="text"
                      value={profCover}
                      onChange={(e) => setProfCover(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono"
                    />
                    <label className="inline-flex items-center gap-1.5 text-sky-700 font-bold cursor-pointer hover:underline">
                      <Upload className="w-3.5 h-3.5" />
                      <span>رفع غلاف (حد 2MB)</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => handleImageFileSelect(e, setProfCover)}
                      />
                    </label>
                  </div>
                </div>

                {/* معرض صور المتجر وديكور المكان (إظهار شكل وأجواء الكافيه أو المطعم للزوار) */}
                <div className="bg-gradient-to-br from-sky-50/90 via-white to-amber-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/80 p-5 rounded-3xl border-2 border-sky-200 dark:border-sky-800/60 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-black text-[#0B1F3A] dark:text-white flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-sky-600" />
                        <span>صور المتجر وديكور المكان (تظهر للزوار في صفحة المتجر والدليل)</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        أضف صوراً لتصميم وديكور الكافيه أو المطعم، الجلسات الداخلية والخارجية، أو ركن القهوة لجذب الزوار ({profStoreGallery.length} صور مضافة).
                      </p>
                    </div>
                    <label className="px-4 py-2 rounded-xl bg-[#0B1F3A] hover:bg-[#10325E] text-white font-black flex items-center gap-1.5 cursor-pointer transition">
                      <Upload className="w-3.5 h-3.5 text-[#FBBF24]" />
                      <span>رفع صورة للمكان من جهازك</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) =>
                          handleImageFileSelect(e, (dataUrl) => {
                            setProfStoreGallery((prev) => [dataUrl, ...prev]);
                            showToast('تمت إضافة صورة ديكور المكان — اضغط حفظ لتأكيد التغييرات');
                          })
                        }
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="https://... أو الصق رابط صورة لديكور وجلسات المكان"
                      value={newDecorUrl}
                      onChange={(e) => setNewDecorUrl(e.target.value)}
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newDecorUrl.trim()) return;
                        setProfStoreGallery((prev) => [...prev, newDecorUrl.trim()]);
                        setNewDecorUrl('');
                      }}
                      className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة لمعرض المكان</span>
                    </button>
                  </div>

                  {profStoreGallery.length === 0 ? (
                    <p className="text-slate-400 text-center py-4">
                      لم تتم إضافة صور لديكور المكان بعد — ارفع صوراً لإبراز جمال وهوية مكانك للزوار.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {profStoreGallery.map((imgUrl, idx) => (
                        <div
                          key={`${imgUrl}-${idx}`}
                          className="relative group rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 aspect-[4/3] bg-slate-100"
                        >
                          <img
                            src={imgUrl}
                            alt={`ديكور المتجر ${idx + 1}`}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-2 right-2 bg-[#0B1F3A]/85 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg">
                            صورة المكان #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setProfStoreGallery((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="absolute top-2 left-2 w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-md cursor-pointer hover:bg-rose-700"
                            title="حذف الصورة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* صور المنيو الورقي الكامل (اختياري) */}
                <div className="bg-white/70 dark:bg-slate-900/50 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-black text-[#0B1F3A] dark:text-white flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-amber-500" />
                        <span>صور المنيو الورقي (اختياري — تظهر مع شارة «جديد» للمتاجر الحديثة)</span>
                      </h4>
                    </div>
                    <label className="px-3.5 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-black flex items-center gap-1.5 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>رفع صورة منيو</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) =>
                          handleImageFileSelect(e, (dataUrl) => {
                            setProfMenuImages((prev) => [dataUrl, ...prev]);
                          })
                        }
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="https://... رابط صورة منيو"
                      value={newGalleryUrl}
                      onChange={(e) => setNewGalleryUrl(e.target.value)}
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newGalleryUrl.trim()) return;
                        setProfMenuImages((prev) => [...prev, newGalleryUrl.trim()]);
                        setNewGalleryUrl('');
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-800 text-white font-black cursor-pointer"
                    >
                      + إضافة صورة منيو
                    </button>
                  </div>
                  {profMenuImages.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {profMenuImages.map((mUrl, idx) => (
                        <div
                          key={`${mUrl}-${idx}`}
                          className="relative rounded-2xl overflow-hidden border border-slate-200 aspect-[4/3]"
                        >
                          <img
                            src={mUrl}
                            alt={`منيو ${idx + 1}`}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setProfMenuImages((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="absolute top-2 left-2 w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-md cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="font-bold">وصف المتجر في الدليل</label>
                  <textarea
                    rows={3}
                    value={profDesc}
                    onChange={(e) => setProfDesc(e.target.value)}
                    className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-3"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-gradient-gold-cta text-[#0B1F3A] font-black px-6 py-2.5 rounded-xl cursor-pointer"
                >
                  حفظ بيانات ملف المتجر وصور المكان
                </button>
              </form>
            )}

            {/* Sub-tab 2: Password & Fraud/Daily Caps Policy */}
            {settingsSubTab === 'security-caps' && (
              <div className="space-y-6">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!onChangePassword || newPassword.length < 6) {
                      showToast('يرجى إدخال كلمة مرور جديدة (6 أحرف على الأقل)', 'error');
                      return;
                    }
                    const res = await onChangePassword(currentPassword, newPassword);
                    if (res.ok) {
                      setCurrentPassword('');
                      setNewPassword('');
                      showToast('تم تحديث كلمة مرور الحساب وتسجيله في سجل التدقيق!');
                    } else {
                      showToast(res.error || 'تعذر تغيير كلمة المرور', 'error');
                    }
                  }}
                  className="glass-card p-6 rounded-3xl space-y-4"
                >
                  <h3 className="text-lg font-black flex items-center gap-2">
                    <Lock className="w-5 h-5 text-sky-600" />
                    <span>تغيير كلمة مرور حسابك ({sessionUser.username})</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold">كلمة المرور الحالية</label>
                      <input
                        type="password"
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5"
                      />
                    </div>
                    <div>
                      <label className="font-bold">كلمة المرور الجديدة (6+)</label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5"
                      />
                    </div>
                  </div>
                  <button type="submit" className="bg-slate-900 text-white font-bold px-6 py-2.5 rounded-xl cursor-pointer">
                    حفظ كلمة المرور الجديدة
                  </button>
                </form>

                <form onSubmit={handleSaveSettingsPolicy} className="glass-card p-6 rounded-3xl space-y-4">
                  <h3 className="text-lg font-black flex items-center gap-2">
                    <Layers className="w-5 h-5 text-amber-500" />
                    <span>سقوف الفواتير والأمان اليومية</span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="font-bold">أقصى مبلغ فاتورة</label>
                      <input
                        type="number"
                        value={capMaxTx}
                        onChange={(e) => setCapMaxTx(e.target.value)}
                        className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="font-bold">حد العميل اليومي (نقاط)</label>
                      <input
                        type="number"
                        value={capDailyCust}
                        onChange={(e) => setCapDailyCust(e.target.value)}
                        className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="font-bold">حد الكاشير اليومي (نقاط)</label>
                      <input
                        type="number"
                        value={capDailyCashier}
                        onChange={(e) => setCapDailyCashier(e.target.value)}
                        className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="font-bold">تنبيه غياب العميل (يوم)</label>
                      <input
                        type="number"
                        value={absenceDays}
                        onChange={(e) => setAbsenceDays(e.target.value)}
                        className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2"
                      />
                    </div>
                  </div>
                  <button type="submit" className="bg-sky-600 text-white font-bold px-6 py-2.5 rounded-xl cursor-pointer">
                    تحديث سقوف العمليات
                  </button>
                </form>
              </div>
            )}

            {/* Sub-tab 3: Customer Disputes & Support Tickets Inbox */}
            {settingsSubTab === 'disputes' && (
              <div className="glass-card p-6 rounded-3xl space-y-4">
                <h3 className="text-lg font-black">صندوق الاعتراضات والنزاعات وتذاكر الدعم ({tickets.length})</h3>
                <div className="space-y-2">
                  {tickets.map((t) => (
                    <div
                      key={t.id}
                      className="bg-white/80 dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">{t.subject}</span>
                        <p className="text-slate-500 mt-0.5">
                          {t.userType}: {t.userName} · {t.message}
                        </p>
                      </div>
                      <span className="bg-sky-100 text-sky-900 font-bold px-3 py-1 rounded-full self-start sm:self-center">
                        {t.status}
                      </span>
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!ticketSubject.trim() || !ticketMsg.trim()) return;
                    await onAddTicket({ subject: ticketSubject, message: ticketMsg });
                    setTicketSubject('');
                    setTicketMsg('');
                    showToast('تم إرسال التذكرة لفريق دعم المنصة!');
                  }}
                  className="space-y-3 pt-2 border-t border-slate-200"
                >
                  <input
                    type="text"
                    placeholder="عنوان تذكرة جديدة لدعم المنصة..."
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5"
                  />
                  <textarea
                    rows={2}
                    placeholder="تفاصيل الاستفسار أو الاعتراض..."
                    value={ticketMsg}
                    onChange={(e) => setTicketMsg(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-3"
                  />
                  <button type="submit" className="bg-[#0B1F3A] text-white font-bold px-5 py-2 rounded-xl cursor-pointer">
                    إرسال تذكرة
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Reset Temp Password Modal */}
      {resetPassModalStaff && onMutateStaff && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await onMutateStaff(store.merchantId, resetPassModalStaff.id, {
                tempPassword: resetPassValue,
              });
              if (res.ok) setResetPassModalStaff(null);
            }}
            className="bg-white dark:bg-[#0f1b30] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-700 text-xs"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-black text-base">
                إعادة تعيين كلمة مرور @{resetPassModalStaff.username}
              </h4>
              <button type="button" onClick={() => setResetPassModalStaff(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-500">
              سيُجبر الموظف على تغيير كلمة المرور المؤقتة فوراً عند تسجيل الدخول القادم، وتُلغى جلساته الحالية.
            </p>
            <input
              type="password"
              required
              minLength={6}
              placeholder="كلمة مرور مؤقتة جديدة (6+)"
              value={resetPassValue}
              onChange={(e) => setResetPassValue(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5"
            />
            <button
              type="submit"
              className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-2.5 rounded-xl"
            >
              تأكيد تعيين كلمة المرور
            </button>
          </form>
        </div>
      )}

      {/* Printable Storefront Join QR Poster Modal (Clean A4 Sheet with Real Scannable QR & Store Link) */}
      {showQrPosterModal && (
        <div
          onClick={() => setShowQrPosterModal(false)}
          className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        >
          <div
            id="qr-printable-poster"
            onClick={(e) => e.stopPropagation()}
            className="bg-white text-slate-900 rounded-3xl max-w-md w-full p-7 sm:p-8 text-center space-y-5 shadow-2xl border-4 border-[#0B1F3A] my-auto"
          >
            <div className="flex justify-between items-center print:hidden">
              <span className="text-xs font-black text-sky-700">
                ورقة باركود ورابط متجرك التلقائية (جاهزة للطباعة)
              </span>
              <button
                type="button"
                aria-label="إغلاق"
                onClick={() => setShowQrPosterModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-center gap-3">
              <img
                src={store.logo}
                alt={store.name}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-200 shadow-sm"
              />
            </div>

            <div className="space-y-1">
              <h3 className="text-2xl font-black text-[#0B1F3A]">{store.name}</h3>
              {printingCardDesign && (
                <p className="text-xs font-black text-amber-700">
                  بطاقة: {printingCardDesign.cardTitle || printingCardDesign.name}
                </p>
              )}
              <p className="text-xs font-bold text-slate-500">
                {store.category} · {store.city} — {store.area}
              </p>
              <p className="text-sm font-black text-sky-700 pt-1">
                امسح الباركود لفتح صفحة المتجر والمنيو وبطاقة الولاء تلقائياً
              </p>
            </div>

            <div className="bg-slate-50 border-2 border-dashed border-slate-300 p-5 rounded-3xl mx-auto flex flex-col items-center justify-center gap-3">
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
                {posterQrDataUrl ? (
                  <img
                    src={posterQrDataUrl}
                    alt={`QR ${store.name}`}
                    className="w-48 h-48 object-contain"
                  />
                ) : (
                  <QrCode className="w-40 h-40 text-[#0B1F3A]" />
                )}
              </div>
              <div
                dir="ltr"
                className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 font-mono text-[11px] font-bold text-[#0B1F3A] break-all select-all"
              >
                {storePublicUrl}
              </div>
            </div>

            <div className="text-xs font-black bg-amber-100 text-amber-900 px-4 py-2.5 rounded-xl border border-amber-200">
              🎁{' '}
              {printingCardDesign?.loyaltyRule.rewardDescription ||
                store.loyaltyRule.rewardDescription ||
                'بطاقة الولاء الرسمية'}
            </div>

            <div className="text-[11px] font-bold text-slate-400">
              مدعوم بواسطة منصة عادة باس (Aada Pass) — بطاقة ويب ذكية بدون تطبيقات
            </div>

            <div className="grid grid-cols-2 gap-2 print:hidden">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(storePublicUrl);
                    setCopiedPosterUrl(true);
                    showToast('تم نسخ رابط صفحة المتجر!');
                    setTimeout(() => setCopiedPosterUrl(false), 2000);
                  } catch {
                    // ignore
                  }
                }}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedPosterUrl ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copiedPosterUrl ? 'تم النسخ' : 'نسخ الرابط'}</span>
              </button>

              {posterQrDataUrl && (
                <a
                  href={posterQrDataUrl}
                  download={`qr-${storeSlugOrId}.png`}
                  className="py-2.5 px-3 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>تحميل صورة QR</span>
                </a>
              )}
            </div>

            <div className="flex gap-2 print:hidden">
              <button
                type="button"
                onClick={handlePrintPoster}
                className="flex-1 bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] font-black py-3 rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الورقة الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <WhatsappRequestModal
        isOpen={waModalState.isOpen}
        onClose={() => setWaModalState((prev) => ({ ...prev, isOpen: false }))}
        adminWhatsappNumber={adminWhatsappNumber}
        mode={waModalState.mode}
        defaultStoreName={store.name}
        defaultRequesterName={`${sessionUser.firstName} ${sessionUser.lastName}`}
        defaultPhone={store.phone}
        defaultPackageTitle={waModalState.packageTitle}
        defaultCurrency={store.currency}
        defaultPriceSummary={waModalState.priceSummary}
      />
    </div>
  );
}
