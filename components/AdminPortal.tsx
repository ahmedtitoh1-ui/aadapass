'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AdminSidebar from './AdminSidebar';
import AdminEnvironmentsPanel from './AdminEnvironmentsPanel';
import AdminLandingDesigner from './AdminLandingDesigner';
import AdminVisitorsPanel from './AdminVisitorsPanel';
import AdminReportsPanel from './AdminReportsPanel';
import AdminSupportDeskPanel from './AdminSupportDeskPanel';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Headphones,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  Moon,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Shield,
  Sparkles,
  Store as StoreIcon,
  Sun,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from 'lucide-react';
import { INITIAL_SITE_SETTINGS } from '@/lib/mockData';
import { authFetch, clearStoredAccessToken, setStoredAccessToken } from '@/lib/clientAuth';
import type {
  AdminOverviewDTO,
  AdminSecurityConfig,
  AuditLog,
  CannedResponse,
  CustomerProfile,
  FinancialAdjustmentRequest,
  ManagedUserRecord,
  MarketCurrency,
  NetworkAgreement,
  NetworkDispute,
  NetworkRules,
  NetworkRuleVersion,
  NetworkSettlement,
  PlatformEnvironment,
  PlatformFeatureFlags,
  SessionUser,
  SiteSettings,
  Store,
  StoreAdditionRequest,
  SubscriptionPackage,
  SubscriptionPlanName,
  SupportTicket,
  Transaction,
  UserRole,
  VisitorLog,
} from '@/lib/types';

type AdminTab =
  | 'overview'
  | 'environments'
  | 'visitors'
  | 'reports'
  | 'landing-settings'
  | 'packages'
  | 'support'
  | 'stores'
  | 'users'
  | 'network'
  | 'security';

export default function AdminPortal() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [overview, setOverview] = useState<AdminOverviewDTO | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [users, setUsers] = useState<ManagedUserRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  const [financialAdjustments, setFinancialAdjustments] = useState<FinancialAdjustmentRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [environments, setEnvironments] = useState<PlatformEnvironment[]>([]);
  const [visitorLogs, setVisitorLogs] = useState<VisitorLog[]>([]);
  const [, setNetworkRules] = useState<NetworkRules>({
    sameStore100PtsSar: 10,
    crossStore100PtsSar: 8,
    pointSharingEnabled: true,
    pointSharingStartDate: '2026-11-01',
    pointSharingEndDate: '2026-12-31',
    pointSharingAllowedMerchantIds: [],
  });
  const [networkRuleVersions, setNetworkRuleVersions] = useState<NetworkRuleVersion[]>([]);
  const [networkAgreements, setNetworkAgreements] = useState<NetworkAgreement[]>([]);
  const [networkSettlements, setNetworkSettlements] = useState<NetworkSettlement[]>([]);
  const [networkDisputes, setNetworkDisputes] = useState<NetworkDispute[]>([]);
  const [storeRequests, setStoreRequests] = useState<StoreAdditionRequest[]>([]);
  const [featureFlags, setFeatureFlags] = useState<PlatformFeatureFlags>({
    webPass: true,
    socialAuth: true,
    onlinePayments: true,
    sharedNetwork: true,
    geoProximity: false,
  });
  const [adminSecurity, setAdminSecurity] = useState<AdminSecurityConfig>({
    mfaEnabled: true,
    ipAllowlist: [],
    platformName: 'عادة باس — Aada Pass',
    defaultCurrency: 'EGP',
    viewerModeEnforced: true,
  });
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(INITIAL_SITE_SETTINGS);

  const [storeFilter, setStoreFilter] = useState('');
  const [storeStatusFilter, setStoreStatusFilter] = useState<'all' | 'pending' | 'active' | 'suspended'>('all');
  const [userSearch, setUserSearch] = useState('');
  const [sameStoreRate, setSameStoreRate] = useState('10');
  const [crossStoreRate, setCrossStoreRate] = useState('8');
  const [pointSharingEnabled, setPointSharingEnabled] = useState(true);
  const [pointSharingStartDate, setPointSharingStartDate] = useState('2026-11-01');
  const [pointSharingEndDate, setPointSharingEndDate] = useState('2026-12-31');
  const [pointSharingAllowedMerchantIds, setPointSharingAllowedMerchantIds] = useState<string[]>([]);

  const [adminWhatsappInput, setAdminWhatsappInput] = useState(
    INITIAL_SITE_SETTINGS.adminWhatsappNumber || '966500000000'
  );
  const [trialDaysInput, setTrialDaysInput] = useState(
    String(INITIAL_SITE_SETTINGS.trialDays ?? 14)
  );
  const [savingTrialWhatsapp, setSavingTrialWhatsapp] = useState(false);

  const [newPkgTitle, setNewPkgTitle] = useState('');
  const [newPkgSubtitle, setNewPkgSubtitle] = useState('');
  const [newPkgCtaText, setNewPkgCtaText] = useState('ابدأ تجربتك المجانية');
  const [newPkgName, setNewPkgName] = useState<SubscriptionPlanName>('Starter');
  const [newPkgPriceEgp, setNewPkgPriceEgp] = useState('400');
  const [newPkgPriceSar, setNewPkgPriceSar] = useState('39');
  const [newPkgBranches, setNewPkgBranches] = useState('1');
  const [newPkgStaff, setNewPkgStaff] = useState('3');
  const [newPkgMaxCustomers, setNewPkgMaxCustomers] = useState('500');
  const [newPkgLoyaltyEnabled, setNewPkgLoyaltyEnabled] = useState(true);
  const [newPkgHighlighted, setNewPkgHighlighted] = useState(false);
  const [newPkgHasOnlineOrdering, setNewPkgHasOnlineOrdering] = useState(false);
  const [newPkgVisibleOnLanding, setNewPkgVisibleOnLanding] = useState(true);
  const [newPkgVisibleForStores, setNewPkgVisibleForStores] = useState(true);
  const [newPkgDisplayOrder, setNewPkgDisplayOrder] = useState('4');
  const [newPkgAnnualDiscountPct, setNewPkgAnnualDiscountPct] = useState('20');
  const [newPkgFeaturesText, setNewPkgFeaturesText] = useState(
    'إصدار بطاقة ويب رقمية ذكية (تُضاف مباشرة للشاشة الرئيسية بدون تطبيقات).\nتفعيل نظام الكاشير الذكي لجمع النقاط.\nدعم العمل الكامل حتى عند انقطاع الإنترنت.'
  );

  const [editingPkgId, setEditingPkgId] = useState<string | null>(null);
  const [editPkgTitle, setEditPkgTitle] = useState('');
  const [editPkgSubtitle, setEditPkgSubtitle] = useState('');
  const [editPkgCtaText, setEditPkgCtaText] = useState('');
  const [editPkgPriceEgp, setEditPkgPriceEgp] = useState('');
  const [editPkgPriceSar, setEditPkgPriceSar] = useState('');
  const [editPkgBranches, setEditPkgBranches] = useState('1');
  const [editPkgStaff, setEditPkgStaff] = useState('3');
  const [editPkgMaxCustomers, setEditPkgMaxCustomers] = useState('0');
  const [editPkgLoyaltyEnabled, setEditPkgLoyaltyEnabled] = useState(true);
  const [editPkgHasOnlineOrdering, setEditPkgHasOnlineOrdering] = useState(false);
  const [editPkgHighlighted, setEditPkgHighlighted] = useState(false);
  const [editPkgVisibleOnLanding, setEditPkgVisibleOnLanding] = useState(true);
  const [editPkgVisibleForStores, setEditPkgVisibleForStores] = useState(true);
  const [editPkgDisplayOrder, setEditPkgDisplayOrder] = useState('1');
  const [editPkgPromoText, setEditPkgPromoText] = useState('');
  const [editPkgPromoPct, setEditPkgPromoPct] = useState('0');
  const [editPkgAnnualDiscountPct, setEditPkgAnnualDiscountPct] = useState('20');
  const [editPkgFeaturesText, setEditPkgFeaturesText] = useState('');

  const [globalAnnualDiscountInput, setGlobalAnnualDiscountInput] = useState('20');
  const [applyAnnualToAllPackages, setApplyAnnualToAllPackages] = useState(true);
  const [savingAnnualDiscount, setSavingAnnualDiscount] = useState(false);

  const [ipAllowlistInput, setIpAllowlistInput] = useState('');

  // Proactive Problem Predictor & Manual Resolution Center states
  const [manualCustId, setManualCustId] = useState('cust-1');
  const [manualStoreId, setManualStoreId] = useState('store-1');
  const [manualCardType, setManualCardType] = useState<'account' | 'points' | 'stamps'>('account');
  const [manualDelta, setManualDelta] = useState('50');
  const [manualReason, setManualReason] = useState('تعويض يدوي فوري من مدير النظام');
  const [runningManualAction, setRunningManualAction] = useState<string | null>(null);

  const notify = (text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleExecuteManualAdminAction = async (
    action: string,
    extraPayload: Record<string, unknown> = {}
  ) => {
    setRunningManualAction(action);
    try {
      const res = await authFetch('/api/admin/overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extraPayload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || 'تعذر تنفيذ الحل اليدوي', 'err');
        return;
      }
      if (data.overview) setOverview(data.overview);
      if (Array.isArray(data.customers)) setCustomers(data.customers);
      if (Array.isArray(data.stores)) setStores(data.stores);
      if (Array.isArray(data.users)) setUsers(data.users);
      if (Array.isArray(data.transactions)) setTransactions(data.transactions);
      if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs);
      notify(data.message || 'تم تنفيذ الحل اليدوي وتحديث النظام بنجاح!');
    } finally {
      setRunningManualAction(null);
    }
  };

  const applyMePayload = useCallback((data: Record<string, unknown>) => {
    if (data.user) setCurrentUser(data.user as SessionUser);
    if (data.overview) setOverview(data.overview as AdminOverviewDTO);
    if (Array.isArray(data.stores)) setStores(data.stores as Store[]);
    if (Array.isArray(data.users)) setUsers(data.users as ManagedUserRecord[]);
    if (Array.isArray(data.customers)) setCustomers(data.customers as CustomerProfile[]);
    if (Array.isArray(data.packages)) setPackages(data.packages as SubscriptionPackage[]);
    if (Array.isArray(data.transactions)) setTransactions(data.transactions as Transaction[]);
    if (Array.isArray(data.tickets)) setTickets(data.tickets as SupportTicket[]);
    if (Array.isArray(data.cannedResponses)) {
      setCannedResponses(data.cannedResponses as CannedResponse[]);
    }
    if (Array.isArray(data.financialAdjustments)) {
      setFinancialAdjustments(data.financialAdjustments as FinancialAdjustmentRequest[]);
    }
    if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs as AuditLog[]);
    if (Array.isArray(data.environments)) setEnvironments(data.environments as PlatformEnvironment[]);
    if (Array.isArray(data.visitorLogs)) setVisitorLogs(data.visitorLogs as VisitorLog[]);
    if (data.networkRules) {
      const rules = data.networkRules as NetworkRules;
      setNetworkRules(rules);
      setSameStoreRate(String(rules.sameStore100PtsSar));
      setCrossStoreRate(String(rules.crossStore100PtsSar));
      setPointSharingEnabled(rules.pointSharingEnabled ?? true);
      setPointSharingStartDate(rules.pointSharingStartDate || '2026-11-01');
      setPointSharingEndDate(rules.pointSharingEndDate || '2026-12-31');
      setPointSharingAllowedMerchantIds(rules.pointSharingAllowedMerchantIds || []);
    }
    if (Array.isArray(data.networkRuleVersions)) {
      setNetworkRuleVersions(data.networkRuleVersions as NetworkRuleVersion[]);
    }
    if (Array.isArray(data.networkAgreements)) {
      setNetworkAgreements(data.networkAgreements as NetworkAgreement[]);
    }
    if (Array.isArray(data.networkSettlements)) {
      setNetworkSettlements(data.networkSettlements as NetworkSettlement[]);
    }
    if (Array.isArray(data.networkDisputes)) {
      setNetworkDisputes(data.networkDisputes as NetworkDispute[]);
    }
    if (Array.isArray(data.storeRequests)) {
      setStoreRequests(data.storeRequests as StoreAdditionRequest[]);
    }
    if (data.featureFlags) setFeatureFlags(data.featureFlags as PlatformFeatureFlags);
    if (data.siteSettings) {
      const nextSite = data.siteSettings as SiteSettings;
      setSiteSettings(nextSite);
      const nextAnnual = String(nextSite.annualDiscountPct ?? 20);
      setGlobalAnnualDiscountInput(nextAnnual);
      setNewPkgAnnualDiscountPct(nextAnnual);
      if (nextSite.adminWhatsappNumber !== undefined) {
        setAdminWhatsappInput(nextSite.adminWhatsappNumber || '');
      }
      if (nextSite.trialDays !== undefined) {
        setTrialDaysInput(String(nextSite.trialDays));
      }
    }
    if (data.adminSecurity) {
      const sec = data.adminSecurity as AdminSecurityConfig;
      setAdminSecurity(sec);
      setIpAllowlistInput(sec.ipAllowlist.join(', '));
    }
  }, []);

  const loadAdminSession = useCallback(async () => {
    setLoading(true);
    setSessionError(null);
    try {
      const sessionRes = await authFetch('/api/auth/session', { cache: 'no-store' });
      const sessionData = await sessionRes.json().catch(() => ({}));
      const sessionRole = sessionData?.user?.role as string | undefined;

      let meRes: Response | null = null;
      let meData: Record<string, unknown> = {};

      if (sessionRole === 'PLATFORM_ADMIN' || sessionRole === 'SUPPORT_AGENT') {
        meRes = await authFetch('/api/me');
        meData = await meRes.json().catch(() => ({}));
      }

      if (
        !meRes ||
        !meRes.ok ||
        (sessionRole !== 'PLATFORM_ADMIN' && sessionRole !== 'SUPPORT_AGENT')
      ) {
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            demoRole: 'PLATFORM_ADMIN',
            demoQuickSignIn: true,
            mfaCode: '123456',
          }),
        });
        const loginData = await loginRes.json().catch(() => ({}));
        if (!loginRes.ok) {
          setSessionError(loginData?.error || 'تعذر توثيق جلسة مدير النظام تلقائياً.');
          return;
        }
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

      if (meRes.ok && meData?.user) {
        applyMePayload(meData);
      } else {
        setSessionError(
          typeof meData?.error === 'string' && meData.error
            ? meData.error
            : 'تعذر تحميل بيانات لوحة مدير النظام.'
        );
      }
    } catch {
      setSessionError('تعذر الاتصال بالخادم أثناء تحميل بيانات مدير النظام.');
    } finally {
      setLoading(false);
    }
  }, [applyMePayload]);

  useEffect(() => {
    loadAdminSession();
  }, [loadAdminSession]);

  // Unified Admin + Support experience: SUPPORT_AGENT also receives full workspace visibility unless restricted on sensitive infra routes
  const isSuperAdmin = currentUser?.role !== 'SUPPORT_AGENT';

  useEffect(() => {
    if (!isSuperAdmin && (activeTab === 'landing-settings' || activeTab === 'security' || activeTab === 'environments')) {
      setActiveTab('overview');
    }
  }, [isSuperAdmin, activeTab]);

  const handleAdminLogout = async () => {
    await authFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    clearStoredAccessToken();
    router.push('/');
  };

  const handleUpdateStore = async (
    merchantId: string,
    patch: {
      status?: Store['status'];
      subscriptionPlan?: SubscriptionPlanName;
      verifiedOwnership?: boolean;
      subscriptionExpiry?: string;
      subscriptionState?: 'active' | 'grace' | 'readonly';
    }
  ) => {
    const res = await authFetch(`/api/stores/${merchantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify(data.error || 'تعذر تحديث المتجر', 'err');
      return;
    }
    if (data.store) {
      setStores((prev) => prev.map((s) => (s.merchantId === merchantId ? data.store : s)));
    }
    if (data.auditLog) setAuditLogs((prev) => [data.auditLog, ...prev]);
    notify('تم تحديث بيانات المتجر وتسجيل العملية في سجل التدقيق');
  };

  const handleChangeUserRole = async (userId: string, role: UserRole) => {
    const res = await authFetch(`/api/admin/users/${userId}/role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify(data.error || 'تعذر تحديث الدور', 'err');
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role, tokenVersion: u.tokenVersion + 1 } : u))
    );
    if (data.auditLog) setAuditLogs((prev) => [data.auditLog, ...prev]);
    notify('تم تحديث صلاحيات المستخدم وإبطال الجلسات السابقة فوراً');
  };

  const handleResetUserPassword = async (userId: string) => {
    const res = await authFetch(`/api/admin/users/${userId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unlockAccount: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify(data.error || 'تعذر إعادة التعيين', 'err');
      return;
    }
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, failedAttempts: 0, lockedUntil: null, mustChangePassword: true }
          : u
      )
    );
    if (data.auditLog) setAuditLogs((prev) => [data.auditLog, ...prev]);
    notify(`تم فتح القفل وإصدار كلمة مرور مؤقتة: ${data.tempPassword || 'Temp#2026'}`);
  };

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPkgTitle.trim()) return;
    const egp = Number(newPkgPriceEgp) || 400;
    const sar = Number(newPkgPriceSar) || 39;
    const maxBranches = Math.max(1, Number(newPkgBranches) || 1);
    const maxStaff = Math.max(1, Number(newPkgStaff) || 1);
    const maxCustomersPerMonth = Math.max(0, Number(newPkgMaxCustomers) || 0);
    const parsedFeatures = newPkgFeaturesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const res = await authFetch('/api/admin/packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newPkgName,
        title: newPkgTitle.trim(),
        subtitle: newPkgSubtitle.trim() || '(باقة مخصصة من مدير النظام)',
        ctaText: newPkgCtaText.trim() || 'ابدأ تجربتك المجانية',
        priceText: `${egp} جنيه / شهرياً (أو ${sar} ريال سعودي)`,
        monthlyPrice: sar,
        monthlyPriceEgp: egp,
        currency: 'EGP' as MarketCurrency,
        maxBranches,
        maxStaff,
        maxCustomersPerMonth,
        loyaltyEnabled: newPkgLoyaltyEnabled,
        hasOnlineOrdering: newPkgHasOnlineOrdering,
        highlighted: newPkgHighlighted,
        visibleOnLanding: newPkgVisibleOnLanding,
        visibleForStores: newPkgVisibleForStores,
        annualDiscountPct: Math.max(0, Math.min(90, Number(newPkgAnnualDiscountPct) || 0)),
        displayOrder: Number(newPkgDisplayOrder) || packages.length + 1,
        features:
          parsedFeatures.length > 0
            ? parsedFeatures
            : [
                'تصميم بطاقة الويب الرقمية الذكية بدون تطبيقات',
                `إدارة حتى ${maxBranches} فرع`,
                newPkgLoyaltyEnabled
                  ? 'تفعيل نظام الكاشير الذكي والعمل بدون إنترنت'
                  : 'عرض المتجر والمنيو الرقمي بدون نقاط',
              ],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify(data.error || 'تعذر إضافة الباقة', 'err');
      return;
    }
    if (Array.isArray(data.packages)) setPackages(data.packages);
    if (data.auditLog) setAuditLogs((prev) => [data.auditLog, ...prev]);
    setNewPkgTitle('');
    setNewPkgSubtitle('');
    notify('تمت إضافة الباقة الجديدة وضبط ظهورها بنجاح');
  };

  const handleSaveGlobalAnnualDiscount = async () => {
    const pct = Math.max(0, Math.min(90, Math.round(Number(globalAnnualDiscountInput) || 0)));
    setSavingAnnualDiscount(true);
    try {
      const res = await authFetch('/api/admin/packages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_global_annual_discount',
          annualDiscountPct: pct,
          applyToAllPackages: applyAnnualToAllPackages,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || 'تعذر تحديث خصم الدفع السنوي', 'err');
        return;
      }
      if (Array.isArray(data.packages)) setPackages(data.packages);
      if (data.siteSettings) setSiteSettings(data.siteSettings);
      if (data.auditLog) setAuditLogs((prev) => [data.auditLog, ...prev]);
      setGlobalAnnualDiscountInput(String(pct));
      setNewPkgAnnualDiscountPct(String(pct));
      notify(`تم حفظ نسبة خصم الدفع السنوي (${pct}%) وتحديث الأسعار فوراً`);
    } finally {
      setSavingAnnualDiscount(false);
    }
  };

  const handleTogglePackageVisibility = async (
    pkg: SubscriptionPackage,
    field: 'visibleOnLanding' | 'visibleForStores'
  ) => {
    const nextVal = !(pkg[field] ?? true);
    const res = await authFetch('/api/admin/packages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: pkg.id,
        [field]: nextVal,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify(data.error || 'تعذر تحديث ظهور الباقة', 'err');
      return;
    }
    if (Array.isArray(data.packages)) setPackages(data.packages);
    if (data.auditLog) setAuditLogs((prev) => [data.auditLog, ...prev]);
    notify(
      field === 'visibleOnLanding'
        ? nextVal
          ? 'تم إظهار الباقة في الصفحة الرئيسية'
          : 'تم إخفاء الباقة من الصفحة الرئيسية'
        : nextVal
        ? 'تم إظهار الباقة للمتاجر عند الترقية'
        : 'تم إخفاء الباقة عن المتاجر'
    );
  };

  const handleStartEditPackage = (pkg: SubscriptionPackage) => {
    setEditingPkgId(pkg.id);
    setEditPkgTitle(pkg.title);
    setEditPkgSubtitle(pkg.subtitle || '');
    setEditPkgCtaText(pkg.ctaText || 'ابدأ تجربتك المجانية');
    setEditPkgPriceEgp(String(pkg.monthlyPriceEgp ?? pkg.monthlyPrice));
    setEditPkgPriceSar(String(pkg.monthlyPrice));
    setEditPkgBranches(String(pkg.maxBranches ?? 1));
    setEditPkgStaff(String(pkg.maxStaff ?? 1));
    setEditPkgMaxCustomers(String(pkg.maxCustomersPerMonth ?? 0));
    setEditPkgLoyaltyEnabled(pkg.loyaltyEnabled ?? true);
    setEditPkgHasOnlineOrdering(Boolean(pkg.hasOnlineOrdering));
    setEditPkgHighlighted(Boolean(pkg.highlighted));
    setEditPkgVisibleOnLanding(pkg.visibleOnLanding ?? true);
    setEditPkgVisibleForStores(pkg.visibleForStores ?? true);
    setEditPkgDisplayOrder(String(pkg.displayOrder ?? 1));
    setEditPkgPromoText(pkg.promoText || '');
    setEditPkgPromoPct(String(pkg.promoDiscountPct ?? 0));
    setEditPkgAnnualDiscountPct(
      String(pkg.annualDiscountPct ?? siteSettings.annualDiscountPct ?? 20)
    );
    setEditPkgFeaturesText((pkg.features || []).join('\n'));
  };

  const handleSavePackageUpdate = async (pkg: SubscriptionPackage) => {
    const egp = Number(editPkgPriceEgp) || 0;
    const sar = Number(editPkgPriceSar) || 0;
    const maxBranches = Math.max(1, Number(editPkgBranches) || 1);
    const maxStaff = Math.max(1, Number(editPkgStaff) || 1);
    const maxCustomersPerMonth = Math.max(0, Number(editPkgMaxCustomers) || 0);
    const promoPct = Math.max(0, Math.min(90, Number(editPkgPromoPct) || 0));
    const annualPct = Math.max(0, Math.min(90, Math.round(Number(editPkgAnnualDiscountPct) || 0)));
    const parsedFeatures = editPkgFeaturesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const res = await authFetch('/api/admin/packages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: pkg.id,
        title: editPkgTitle.trim() || pkg.title,
        subtitle: editPkgSubtitle.trim(),
        ctaText: editPkgCtaText.trim() || 'ابدأ تجربتك المجانية',
        monthlyPrice: sar,
        monthlyPriceEgp: egp,
        maxBranches,
        maxStaff,
        maxCustomersPerMonth,
        loyaltyEnabled: editPkgLoyaltyEnabled,
        hasOnlineOrdering: editPkgHasOnlineOrdering,
        highlighted: editPkgHighlighted,
        visibleOnLanding: editPkgVisibleOnLanding,
        visibleForStores: editPkgVisibleForStores,
        displayOrder: Number(editPkgDisplayOrder) || 1,
        priceText: `${egp} جنيه / شهرياً (أو ${sar} ريال سعودي)`,
        promoText: editPkgPromoText.trim(),
        promoDiscountPct: promoPct,
        annualDiscountPct: annualPct,
        features: parsedFeatures.length > 0 ? parsedFeatures : pkg.features,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify(data.error || 'تعذر تحديث الباقة', 'err');
      return;
    }
    if (Array.isArray(data.packages)) setPackages(data.packages);
    if (data.auditLog) setAuditLogs((prev) => [data.auditLog, ...prev]);
    setEditingPkgId(null);
    notify('تم تحديث بيانات وحدود وظهور الباقة بنجاح');
  };

  const handleDeletePackage = async (id: string) => {
    const res = await authFetch(`/api/admin/packages?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify(data.error || 'تعذر حذف الباقة', 'err');
      return;
    }
    if (Array.isArray(data.packages)) setPackages(data.packages);
    if (data.auditLog) setAuditLogs((prev) => [data.auditLog, ...prev]);
    notify('تم حذف الباقة بنجاح');
  };

  const handleSaveNetworkRules = async () => {
    const res = await authFetch('/api/admin/network-rules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sameStore100PtsSar: Number(sameStoreRate) || 10,
        crossStore100PtsSar: Number(crossStoreRate) || 8,
        pointSharingEnabled,
        pointSharingStartDate,
        pointSharingEndDate,
        pointSharingAllowedMerchantIds,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify(data.error || 'تعذر تحديث قواعد الشبكة', 'err');
      return;
    }
    if (data.networkRules) {
      const r = data.networkRules as NetworkRules;
      setNetworkRules(r);
      setPointSharingEnabled(r.pointSharingEnabled ?? true);
      setPointSharingStartDate(r.pointSharingStartDate || '2026-11-01');
      setPointSharingEndDate(r.pointSharingEndDate || '2026-12-31');
      setPointSharingAllowedMerchantIds(r.pointSharingAllowedMerchantIds || []);
    }
    if (Array.isArray(data.networkRuleVersions)) setNetworkRuleVersions(data.networkRuleVersions);
    if (data.auditLog) setAuditLogs((prev) => [data.auditLog, ...prev]);
    notify('تم حفظ قواعد وإعدادات شبكة مشاركة النقاط بنجاح');
  };

  const handleNetworkAction = async (payload: Record<string, unknown>, successMsg: string) => {
    const res = await authFetch('/api/admin/network', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify(data.error || 'تعذر تنفيذ إجراء الشبكة', 'err');
      return;
    }
    if (Array.isArray(data.networkAgreements)) setNetworkAgreements(data.networkAgreements);
    if (Array.isArray(data.networkSettlements)) setNetworkSettlements(data.networkSettlements);
    if (Array.isArray(data.networkDisputes)) setNetworkDisputes(data.networkDisputes);
    if (data.auditLog) setAuditLogs((prev) => [data.auditLog, ...prev]);
    notify(successMsg);
  };

  const handleToggleFeatureFlag = async (key: keyof PlatformFeatureFlags) => {
    const nextVal = !featureFlags[key];
    const res = await authFetch('/api/admin/feature-flags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: nextVal }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify(data.error || 'تعذر تحديث الميزة', 'err');
      return;
    }
    if (data.featureFlags) setFeatureFlags(data.featureFlags);
    if (data.auditLog) setAuditLogs((prev) => [data.auditLog, ...prev]);
    notify('تم تحديث إعدادات الميزة الفورية');
  };

  const handleSaveSecurity = async () => {
    const allowlist = ipAllowlistInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await authFetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mfaEnabled: adminSecurity.mfaEnabled,
        viewerModeEnforced: adminSecurity.viewerModeEnforced,
        defaultCurrency: adminSecurity.defaultCurrency,
        ipAllowlist: allowlist,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify(data.error || 'تعذر حفظ إعدادات الأمان', 'err');
      return;
    }
    if (data.adminSecurity) setAdminSecurity(data.adminSecurity);
    if (data.auditLog) setAuditLogs((prev) => [data.auditLog, ...prev]);
    notify('تم حفظ سياسات الأمان والتحقق الثنائي وقائمة العناوين المسموحة');
  };

  const handleSaveWhatsappAndTrial = async () => {
    const cleanPhone = adminWhatsappInput.replace(/[^\d]/g, '').trim();
    const parsedDays = Math.max(1, Math.min(90, Math.round(Number(trialDaysInput) || 14)));
    if (!cleanPhone || cleanPhone.length < 8) {
      notify('يرجى إدخال رقم واتساب صحيح مع رمز الدولة (مثال: 966500000000 أو 201000000000)', 'err');
      return;
    }
    setSavingTrialWhatsapp(true);
    try {
      const res = await authFetch('/api/admin/site-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminWhatsappNumber: cleanPhone,
          trialDays: parsedDays,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || 'تعذر حفظ إعدادات الواتساب ومدة التجربة', 'err');
        return;
      }
      if (data.siteSettings) {
        setSiteSettings(data.siteSettings);
        setAdminWhatsappInput(data.siteSettings.adminWhatsappNumber || cleanPhone);
        setTrialDaysInput(String(data.siteSettings.trialDays ?? parsedDays));
      }
      if (data.auditLog) setAuditLogs((prev) => [data.auditLog, ...prev]);
      notify(`تم حفظ رقم واتساب الإدارة (${cleanPhone}) ومدة التجربة (${parsedDays} يوم) بنجاح`);
    } finally {
      setSavingTrialWhatsapp(false);
    }
  };

  const pendingStores = useMemo(
    () => stores.filter((s) => s.status === 'pending'),
    [stores]
  );

  const filteredStores = useMemo(() => {
    const q = storeFilter.trim().toLowerCase();
    return stores.filter((s) => {
      if (storeStatusFilter !== 'all' && s.status !== storeStatusFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        (s.ownerName || '').toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q)
      );
    });
  }, [stores, storeFilter, storeStatusFilter]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const pendingAdjustmentsCount = useMemo(
    () => financialAdjustments.filter((a) => a.status === 'pending_admin').length,
    [financialAdjustments]
  );

  const inputClass =
    'w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white focus:outline-none focus:border-[#0284C7]';

  if (loading) {
    return (
      <div
        dir="rtl"
        className={`min-h-screen bg-light-canvas text-[#0B1F3A] dark:text-white flex items-center justify-center p-6 ${isDark ? 'dark' : ''}`}
      >
        <div className="glass-card rounded-3xl px-8 py-6 flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#0284C7] dark:text-[#00C2FF] animate-spin" />
          <p className="text-sm font-black text-[#0B1F3A] dark:text-slate-200">
            جاري تحميل لوحة الإدارة المركزية...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className={`min-h-screen bg-light-canvas text-[#0B1F3A] dark:text-slate-100 flex flex-col lg:flex-row ${isDark ? 'dark' : ''}`}
    >
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={(tab) => setActiveTab(tab as AdminTab)}
        role={isSuperAdmin ? 'SUPER_ADMIN' : 'SUPPORT_AGENT'}
        adminName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'المدير العام'}
        onLogout={handleAdminLogout}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 glass-card border-b border-sky-100 dark:border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-gold-cta text-[#0B1F3A] flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base sm:text-lg font-black text-[#0B1F3A] dark:text-white">
                    لوحة مدير النظام والدعم الشامل
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-400/30">
                    صلاحيات موحدة: إدارة + دعم + تقارير
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {currentUser
                    ? `المشرف النشط: ${currentUser.firstName} ${currentUser.lastName} · تحكم موحد بالبيئات والواجهة والتذاكر`
                    : 'إدارة البيئات، مصمم الواجهة، المتاجر، الباقات، والتقارير'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsDark((prev) => !prev)}
                aria-label={isDark ? 'الوضع الفاتح' : 'الوضع الليلي'}
                className="bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-amber-300 border border-slate-200 dark:border-slate-700 p-2 rounded-xl transition-all cursor-pointer"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('support')}
                className="px-3.5 py-2 rounded-xl bg-sky-50 dark:bg-sky-500/15 hover:bg-sky-100 dark:hover:bg-sky-500/25 text-[#0284C7] dark:text-[#00C2FF] border border-sky-200 dark:border-sky-500/30 text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
              >
                <Headphones className="w-4 h-4" />
                مركز الدعم والتذاكر ({tickets.length})
              </button>
              <Link
                href="/stores"
                className="px-3.5 py-2 rounded-xl bg-white/80 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 text-[#0B1F3A] dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
              >
                <StoreIcon className="w-4 h-4 text-amber-500" />
                دليل المتاجر
              </Link>
              <Link
                href="/"
                className="px-3.5 py-2 rounded-xl bg-gradient-navy hover:opacity-95 text-white text-xs font-black flex items-center gap-1.5 transition"
              >
                <LogOut className="w-4 h-4" />
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

        <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
          {sessionError && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-black text-rose-800 dark:text-rose-200">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{sessionError}</span>
              </div>
              <button
                type="button"
                onClick={loadAdminSession}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>إعادة تحميل البيانات</span>
              </button>
            </div>
          )}
          {isSuperAdmin && activeTab === 'environments' && (
            <AdminEnvironmentsPanel
              environments={environments}
              setEnvironments={setEnvironments}
              onStoreCreated={(store) => setStores((prev) => [store, ...prev.filter((s) => s.id !== store.id)])}
              onAuditLog={(log) => setAuditLogs((prev) => [log, ...prev])}
              notify={notify}
            />
          )}

          {activeTab === 'visitors' && (
            <AdminVisitorsPanel
              visitorLogs={visitorLogs}
              customers={customers}
              transactions={transactions}
              storeRequests={storeRequests}
            />
          )}

          {activeTab === 'reports' && (
            <AdminReportsPanel
              stores={stores}
              packages={packages}
              transactions={transactions}
              visitorLogs={visitorLogs}
              customers={customers}
              tickets={tickets}
              notify={notify}
            />
          )}

          {isSuperAdmin && activeTab === 'landing-settings' && (
            <AdminLandingDesigner
              siteSettings={siteSettings}
              setSiteSettings={setSiteSettings}
              onAuditLog={(log) => setAuditLogs((prev) => [log, ...prev])}
              notify={notify}
            />
          )}

          {activeTab === 'support' && (
            <AdminSupportDeskPanel
              tickets={tickets}
              setTickets={setTickets}
              cannedResponses={cannedResponses}
              setCannedResponses={setCannedResponses}
              financialAdjustments={financialAdjustments}
              setFinancialAdjustments={setFinancialAdjustments}
              setTransactions={setTransactions}
              onAuditLog={(log) => setAuditLogs((prev) => [log, ...prev])}
              notify={notify}
            />
          )}

          {activeTab === 'overview' && (
            <div className="space-y-6">
              {pendingStores.length > 0 && (
                <div className="p-4 sm:p-5 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-600/50 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-400/25 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white">
                        يوجد {pendingStores.length} طلب انضمام متجر جديد في الفترة التجريبية بانتظار التفعيل اليدوي
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        يمكنك مراجعة بيانات المالك والمتجر والموافقة والتفعيل اليدوي فوراً من قسم إدارة المتاجر.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStoreStatusFilter('pending');
                      setActiveTab('stores');
                    }}
                    className="px-4 py-2.5 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] text-xs font-black shadow-sm cursor-pointer"
                  >
                    مراجعة وتفعيل الطلبات ({pendingStores.length})
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-3xl glass-card">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-2">
                    <span>إجمالي المتاجر المسجلة</span>
                    <Building2 className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-3xl font-black text-[#0B1F3A] dark:text-white">
                    {overview?.totalStores ?? stores.length}
                  </div>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                    نشط: {overview?.activeStores ?? stores.filter((s) => s.status === 'active').length} · بانتظار التفعيل:{' '}
                    {overview?.pendingStores ?? stores.filter((s) => s.status === 'pending').length}
                  </p>
                </div>

                <div className="p-5 rounded-3xl glass-card">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-2">
                    <span>إجمالي النقاط المصدرة</span>
                    <Activity className="w-4 h-4 text-[#0284C7] dark:text-[#00C2FF]" />
                  </div>
                  <div className="text-3xl font-black text-[#0B1F3A] dark:text-white">
                    {(overview?.totalPointsIssued ?? 18450).toLocaleString('en-US')}
                  </div>
                  <p className="text-xs text-[#0284C7] dark:text-[#00C2FF] font-bold mt-1">
                    مستبدلة: {(overview?.totalPointsRedeemed ?? 6420).toLocaleString('en-US')} نقطة
                  </p>
                </div>

                <div className="p-5 rounded-3xl glass-card">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-2">
                    <span>إجمالي الاشتراكات الشهرية</span>
                    <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-3xl font-black text-[#0B1F3A] dark:text-white">
                    {(overview?.monthlyPlatformRevenueSar ?? 14850).toLocaleString('en-US')}{' '}
                    <span className="text-sm font-bold text-slate-500 dark:text-slate-400">ر.س</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">
                    اشتراكات نشطة: {overview?.activeSubscriptionsCount ?? stores.length}
                  </p>
                </div>

                <div className="p-5 rounded-3xl glass-card">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-2">
                    <span>طلبات التسوية العكسية المعلقة</span>
                    <RotateCcw className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="text-3xl font-black text-[#0B1F3A] dark:text-white">
                    {pendingAdjustmentsCount}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('support')}
                    className="text-xs text-[#0284C7] dark:text-[#FBBF24] hover:underline mt-1 flex items-center gap-1 font-black cursor-pointer"
                  >
                    مراجعة واعتماد القيود العكسية والتذاكر
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {overview?.periodComparison && (
                <div className="p-6 rounded-3xl glass-card">
                  <h2 className="text-base font-black text-[#0B1F3A] dark:text-white mb-4">
                    مقارنة أداء المنصة (الفترة الحالية مقابل السابقة)
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                          <th className="py-3 px-4">الفترة</th>
                          <th className="py-3 px-4">عدد المتاجر</th>
                          <th className="py-3 px-4">النقاط المصدرة</th>
                          <th className="py-3 px-4">النقاط المستبدلة</th>
                          <th className="py-3 px-4">الإيرادات (ر.س)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                        {overview.periodComparison.map((row) => (
                          <tr key={row.period} className="hover:bg-sky-50/50 dark:hover:bg-slate-800/40">
                            <td className="py-3 px-4 font-bold text-[#0B1F3A] dark:text-white">
                              {row.period}
                            </td>
                            <td className="py-3 px-4">{row.storesCount}</td>
                            <td className="py-3 px-4 text-[#0284C7] dark:text-[#00C2FF] font-bold">
                              {row.pointsIssued.toLocaleString('en-US')}
                            </td>
                            <td className="py-3 px-4 text-amber-700 dark:text-[#FBBF24] font-bold">
                              {row.pointsRedeemed.toLocaleString('en-US')}
                            </td>
                            <td className="py-3 px-4 font-black text-emerald-600 dark:text-emerald-400">
                              {row.revenueSar.toLocaleString('en-US')} ر.س
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* PROACTIVE PROBLEM PREDICTOR & MANUAL RESOLUTION CENTER (توقع المشكلات المستقبلية وحلها يدوياً) */}
              <div className="p-6 sm:p-7 rounded-3xl glass-card border-2 border-sky-200 dark:border-sky-500/30 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 text-xs font-black">
                      <Shield className="w-3.5 h-3.5" />
                      <span>مركز التنبؤ بالمشكلات المستقبلية والحلول اليدوية الفورية</span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-black text-[#0B1F3A] dark:text-white">
                      أدوات التدخل اليدوي الذكي لمدير النظام (One-Click Manual Resolution)
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      توقّع مسبق لأبرز 4 مشكلات تقنية وتشغيلية قد تواجه العملاء أو الكاشير أو المتاجر مستقبلاً، مع أزرار حل يدوي فوري بضغطة واحدة.
                    </p>
                  </div>
                </div>

                {/* 4 Predicted Scenarios & 1-Click Manual Fixes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Scenario 1: Balance / Sync Discrepancy */}
                  <div className="p-4 rounded-2xl bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-sky-700 dark:text-[#00C2FF]">
                          1. احتمال عدم تطابق رصيد البطاقات الثلاثية أو تعطل OTP
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 text-[10px] font-black">
                          وقائي محاسبي
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        <strong>المشكلة المتوقعة:</strong> اختلاف إجمالي النقاط المحسوب عن مجموع البطاقات بعد مزامنة الكاشير Offline أو تأخر رسالة OTP للعميل عند الصرف.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={runningManualAction === 'reconcile_ledgers'}
                      onClick={() => handleExecuteManualAdminAction('reconcile_ledgers')}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-electric text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${runningManualAction === 'reconcile_ledgers' ? 'animate-spin' : ''}`}
                      />
                      <span>مزامنة وتصحيح أرصدة جميع البطاقات وتوثيق OTP يدوياً</span>
                    </button>
                  </div>

                  {/* Scenario 2: Locked Accounts / QR Token Conflict */}
                  <div className="p-4 rounded-2xl bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-amber-700 dark:text-amber-300">
                          2. قفل حساب كاشير/تاجر أو تعارض مفتاح باركود QR
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-black">
                          أمان وجلسات
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        <strong>المشكلة المتوقعة:</strong> حظر مؤقت لحساب الكاشير بسبب إدخال كلمة مرور خاطئة عدة مرات أو توقف باركود عميل بعد بلاغ فقدان الهاتف.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={runningManualAction === 'unlock_accounts_and_caps'}
                      onClick={() =>
                        handleExecuteManualAdminAction('unlock_accounts_and_caps', {
                          customerId: manualCustId,
                        })
                      }
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>فك قفل كافة الحسابات وتجديد مفاتيح باركود QR فوراً</span>
                    </button>
                  </div>

                  {/* Scenario 3: Store Subscription Expiry / Voucher Expiry */}
                  <div className="p-4 rounded-2xl bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                          3. توقف متجر مؤقتاً أو انتهاء قسيمة عميل أمام الكاشير
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[10px] font-black">
                          استمرارية الخدمة
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        <strong>المشكلة المتوقعة:</strong> انتهاء باقة المتجر أثناء ذروة العمل أو انتهاء صلاحية قسيمة العميل لحظة وقوفه عند الكاشير.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={runningManualAction === 'extend_paused_stores_and_vouchers'}
                      onClick={() =>
                        handleExecuteManualAdminAction('extend_paused_stores_and_vouchers', {
                          extraDays: 15,
                        })
                      }
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Clock className="w-4 h-4" />
                      <span>منح مهلة +15 يوماً للمتاجر وإعادة تفعيل القسائم المنتهية</span>
                    </button>
                  </div>

                  {/* Scenario 4: False-Positive Fraud Alert / Stuck Refund */}
                  <div className="p-4 rounded-2xl bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-rose-700 dark:text-rose-300">
                          4. تعليق معاملة كبيرة كـ «نشاط مشتبه» أو استرجاع معلق
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 text-[10px] font-black">
                          مكافحة الاحتيال
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        <strong>المشكلة المتوقعة:</strong> تصنيف فاتورة ضيافة كبيرة أو مناسبة خاصة على أنها عملية مشبوهة أو بقاء طلبات استرجاع معلقة.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={runningManualAction === 'resolve_suspicious_transactions'}
                      onClick={() => handleExecuteManualAdminAction('resolve_suspicious_transactions')}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#0B1F3A] hover:bg-[#14325C] text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>اعتماد المعاملات المشتبهة وإغلاق التنبيهات المعلقة يدوياً</span>
                    </button>
                  </div>

                  {/* Scenario 5: Stuck Online Orders & WhatsApp Sync */}
                  <div className="p-4 rounded-2xl bg-white/95 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 space-y-3 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 text-[10px] font-black">
                          سيناريو متوقع 5 • طلبات المتجر الإلكتروني والواتساب
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">Online Orders</span>
                      </div>
                      <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white">
                        تأخر تحديث حالة طلبات التوصيل أو الاستلام وعدم احتساب نقاطها
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        <strong>المشكلة المتوقعة:</strong> انشغال الكاشير في أوقات الذروة وبقاء طلبات المتجر الإلكتروني في حالة معلقة دون منح نقاط المكافأة للعميل.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={runningManualAction === 'resolve_stuck_online_orders'}
                      onClick={() => handleExecuteManualAdminAction('resolve_stuck_online_orders')}
                      className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${
                          runningManualAction === 'resolve_stuck_online_orders' ? 'animate-spin' : ''
                        }`}
                      />
                      <span>تأكيد الطلبات المعلقة ومنح نقاط المكافأة للعملاء يدوياً</span>
                    </button>
                  </div>

                  {/* Scenario 6: Missing 3-Card Wallet Ecosystem */}
                  <div className="p-4 rounded-2xl bg-white/95 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 space-y-3 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-800 dark:text-teal-300 text-[10px] font-black">
                          سيناريو متوقع 6 • تكامل منظومة الـ 3 بطاقات
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">3-Card Auto-Issue</span>
                      </div>
                      <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white">
                        عملاء جدد تنقصهم بطاقة الأختام أو النقاط أو بطاقة الحساب الشاملة
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        <strong>المشكلة المتوقعة:</strong> تسجيل عميل سريع دون إصدار بطاقة أختام وبطاقة نقاط منفصلة لكل متجر بجانب بطاقة الحساب VIP.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={runningManualAction === 'repair_missing_customer_cards'}
                      onClick={() => handleExecuteManualAdminAction('repair_missing_customer_cards')}
                      className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>إصدار واستكمال البطاقات الثلاثية لجميع العملاء فوراً</span>
                    </button>
                  </div>

                  {/* Scenario 7: Store Media, Menu & Geofence GPS Integrity */}
                  <div className="p-4 rounded-2xl bg-white/95 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 space-y-3 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300 text-[10px] font-black">
                          سيناريو متوقع 7 • جاهزية الصور والرادار الجغرافي
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">Geo & Media Healer</span>
                      </div>
                      <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white">
                        نقص صور المعرض أو المنيو أو إحداثيات GPS في بعض فروع المتاجر
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        <strong>المشكلة المتوقعة:</strong> إضافة متجر جديد أو فرع دون ضبط إحداثيات الرادار الجغرافي أو صور المكان والمنيو الكامل.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={runningManualAction === 'heal_stores_media_and_geo'}
                      onClick={() => handleExecuteManualAdminAction('heal_stores_media_and_geo')}
                      className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>فحص واستكمال صور المتاجر وإحداثيات الرادار الجغرافي</span>
                    </button>
                  </div>

                  {/* Scenario 8: Instant Customer Compensation Voucher + VIP Points */}
                  <div className="p-4 rounded-2xl bg-white/95 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 space-y-3 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-black">
                          سيناريو متوقع 8 • ترضية وتعويض العميل الفوري
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">Instant Goodwill</span>
                      </div>
                      <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white">
                        شكوى عميل من تأخر طلب أو خطأ كاشير تتطلب تعويضاً فورياً
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        <strong>المشكلة المتوقعة:</strong> استياء عميل بسبب خطأ تشغيلي في الفرع وحاجته لقسيمة خصم فورية ونقاط اعتذار في بطاقة الحساب.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={runningManualAction === 'issue_emergency_compensation_voucher'}
                      onClick={() =>
                        handleExecuteManualAdminAction('issue_emergency_compensation_voucher', {
                          customerId: manualCustId,
                          storeId: manualStoreId,
                          valueAmount: 50,
                          bonusPoints: 50,
                          reason: 'قسيمة تعويض وترضية فورية من مدير النظام',
                        })
                      }
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>إصدار قسيمة تعويض (50 ر.س) + 50 نقطة VIP للعميل المحدد</span>
                    </button>
                  </div>
                </div>

                {/* Manual Balance Adjustment Tool for the 3-Card System */}
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>التعديل اليدوي المباشر لأرصدة البطاقات الثلاثية (نقاط المتجر • أختام المتجر • بطاقة الحساب VIP)</span>
                    </h3>
                    <span className="text-[11px] font-bold text-slate-500">
                      يُقيد فوراً في سجل التدقيق AuditLog
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1">
                        حساب العميل
                      </label>
                      <select
                        value={manualCustId}
                        onChange={(e) => setManualCustId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                      >
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.firstName} {c.lastName} ({c.username || c.phone}) — VIP: {c.accountPointsBalance ?? 350}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1">
                        نوع البطاقة المستهدفة
                      </label>
                      <select
                        value={manualCardType}
                        onChange={(e) =>
                          setManualCardType(e.target.value as 'account' | 'points' | 'stamps')
                        }
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                      >
                        <option value="account">1. بطاقة الحساب الشاملة (VIP)</option>
                        <option value="points">2. بطاقة نقاط المتجر</option>
                        <option value="stamps">3. بطاقة أختام المتجر</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1">
                        المتجر (لبطاقات المتاجر)
                      </label>
                      <select
                        value={manualStoreId}
                        onChange={(e) => setManualStoreId(e.target.value)}
                        disabled={manualCardType === 'account'}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:opacity-50"
                      >
                        {stores.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1">
                        المقدار (+ إضافة / - خصم)
                      </label>
                      <input
                        type="number"
                        value={manualDelta}
                        onChange={(e) => setManualDelta(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black tabular-nums"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1">
                        سبب التعديل اليدوي
                      </label>
                      <input
                        type="text"
                        value={manualReason}
                        onChange={(e) => setManualReason(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={runningManualAction === 'manual_card_adjust'}
                      onClick={() =>
                        handleExecuteManualAdminAction('manual_card_adjust', {
                          customerId: manualCustId,
                          storeId: manualStoreId,
                          cardCategory:
                            manualCardType === 'account'
                              ? 'account_master'
                              : manualCardType === 'stamps'
                              ? 'store_stamps'
                              : 'store_points',
                          delta: Number(manualDelta) || 0,
                          reason: manualReason,
                        })
                      }
                      className="px-5 py-2.5 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] text-xs font-black shadow-sm cursor-pointer flex items-center gap-2 min-h-[42px]"
                    >
                      <Plus className="w-4 h-4" />
                      <span>تنفيذ التعديل اليدوي على البطاقة الآن</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'stores' && (
            <div className="space-y-6">
              {/* Dedicated Pending Self-Registered Trial Stores Queue */}
              {pendingStores.length > 0 && (
                <div className="p-5 sm:p-6 rounded-3xl glass-card border-2 border-amber-300 dark:border-amber-500/40 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 flex items-center justify-center">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-black text-[#0B1F3A] dark:text-white">
                          طلبات المتاجر الجديدة بانتظار الموافقة والتفعيل اليدوي ({pendingStores.length})
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          هذه المتاجر سجلت ذاتياً وتعمل حالياً بالفترة التجريبية ({siteSettings.trialDays ?? 14} يوم افتراضياً) لحين اعتمادك اليدوي.
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 text-xs font-black">
                      مدة التجربة الحالية: {siteSettings.trialDays ?? 14} يوم
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {pendingStores.map((ps) => {
                      const waPhone = (ps.phone || '').replace(/[^\d]/g, '');
                      const oneYearExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
                        .toISOString()
                        .slice(0, 10);
                      return (
                        <div
                          key={ps.id}
                          className="p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-amber-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4"
                        >
                          <div className="space-y-1.5 text-xs">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-black text-[#0B1F3A] dark:text-white">
                                {ps.name}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 font-bold text-[11px]">
                                {ps.category} · {ps.city} ({ps.currency})
                              </span>
                              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-black text-[11px]">
                                تجربة {ps.trialDaysGranted ?? 14} يوم (ينتهي: {ps.trialEndsAt || ps.subscriptionExpiry})
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-slate-600 dark:text-slate-300">
                              {ps.ownerName && (
                                <span>
                                  المالك: <strong className="text-[#0B1F3A] dark:text-white">{ps.ownerName}</strong>
                                </span>
                              )}
                              {ps.ownerEmail && (
                                <span className="inline-flex items-center gap-1" dir="ltr">
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  {ps.ownerEmail}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 font-mono" dir="ltr">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {ps.phone}
                              </span>
                              <span>
                                الباقة المطلوبة:{' '}
                                <strong className="text-amber-700 dark:text-[#FBBF24]">
                                  {ps.requestedPlan || ps.subscriptionPlan}
                                </strong>
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {waPhone.length >= 8 && (
                              <a
                                href={`https://wa.me/${waPhone}?text=${encodeURIComponent(
                                  `مرحباً ${ps.ownerName || ''}، معكم إدارة منصة عادة باس بخصوص تفعيل متجر "${ps.name}".`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-black flex items-center gap-1.5"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>واتساب المالك</span>
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateStore(ps.merchantId, {
                                  status: 'active',
                                  verifiedOwnership: true,
                                  subscriptionState: 'active',
                                  subscriptionPlan: ps.requestedPlan || ps.subscriptionPlan,
                                  subscriptionExpiry: oneYearExpiry,
                                })
                              }
                              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm cursor-pointer flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>موافقة وتفعيل يدوي ✓</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateStore(ps.merchantId, { status: 'suspended' })}
                              className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer"
                            >
                              رفض / إيقاف
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4 glass-card p-4 rounded-2xl">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={storeFilter}
                    onChange={(e) => setStoreFilter(e.target.value)}
                    placeholder="ابحث باسم المتجر، المالك، المدينة، أو التصنيف..."
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white focus:outline-none focus:border-[#0284C7]"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'all', label: `الكل (${stores.length})` },
                      { id: 'pending', label: `بانتظار التفعيل (${pendingStores.length})` },
                      { id: 'active', label: `نشط (${stores.filter((s) => s.status === 'active').length})` },
                      { id: 'suspended', label: `موقوف (${stores.filter((s) => s.status === 'suspended').length})` },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setStoreStatusFilter(st.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer transition ${
                        storeStatusFilter === st.id
                          ? 'bg-[#0B1F3A] text-white'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {filteredStores.map((store) => (
                  <div
                    key={store.id}
                    className="p-5 rounded-3xl glass-card flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white">
                          {store.name}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {store.category} · {store.city} ({store.currency})
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                            store.status === 'active'
                              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                              : store.status === 'pending'
                              ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300'
                              : 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300'
                          }`}
                        >
                          {store.status === 'active'
                            ? 'نشط'
                            : store.status === 'pending'
                            ? `تجربة (${store.trialDaysGranted ?? 14} يوم) — بانتظار التفعيل`
                            : 'موقوف'}
                        </span>
                        {store.verifiedOwnership && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 dark:bg-sky-500/20 text-[#0284C7] dark:text-[#00C2FF]">
                            ملكية موثقة ✓
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        المعرف: {store.merchantId} · السجل التجاري: {store.commercialReg || 'غير مضاف'} · الفروع:{' '}
                        {store.branches.length} · الباقة الحالية:{' '}
                        <strong className="text-amber-700 dark:text-[#FBBF24]">
                          {store.subscriptionPlan === 'Viewer'
                            ? 'باقة التواجد الرقمي'
                            : store.subscriptionPlan === 'Starter'
                            ? 'باقة الانطلاق'
                            : 'باقة النمو'}
                        </strong>
                        {store.ownerName ? ` · المالك: ${store.ownerName}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={store.subscriptionPlan}
                        onChange={(e) =>
                          handleUpdateStore(store.merchantId, {
                            subscriptionPlan: e.target.value as SubscriptionPlanName,
                          })
                        }
                        className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#0B1F3A] dark:text-white"
                      >
                        <option value="Viewer">باقة التواجد الرقمي</option>
                        <option value="Starter">باقة الانطلاق</option>
                        <option value="Growth">باقة النمو</option>
                      </select>

                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateStore(store.merchantId, {
                            verifiedOwnership: !store.verifiedOwnership,
                          })
                        }
                        className="px-3 py-2 rounded-xl bg-sky-50 dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-slate-700 text-xs font-bold text-[#0284C7] dark:text-[#00C2FF] border border-sky-200 dark:border-slate-700 cursor-pointer"
                      >
                        {store.verifiedOwnership ? 'إلغاء التوثيق' : 'توثيق الملكية'}
                      </button>

                      {store.status !== 'active' ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateStore(store.merchantId, {
                              status: 'active',
                              verifiedOwnership: true,
                              subscriptionState: 'active',
                              subscriptionExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
                                .toISOString()
                                .slice(0, 10),
                            })
                          }
                          className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black cursor-pointer"
                        >
                          تفعيل يدوي الآن ✓
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUpdateStore(store.merchantId, { status: 'suspended' })}
                          className="px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 text-xs font-bold cursor-pointer"
                        >
                          إيقاف مؤقت
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {storeRequests.length > 0 && (
                <div className="p-5 rounded-3xl glass-card">
                  <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white mb-3">
                    طلبات العملاء لإضافة متاجر جديدة للدليل ({storeRequests.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {storeRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-black text-[#0B1F3A] dark:text-white">
                            {req.storeName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {req.category} · {req.city}
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-black">
                          {req.count} طلب
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 glass-card p-4 rounded-2xl">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="ابحث باسم المستخدم، الاسم، أو الدور..."
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white focus:outline-none focus:border-[#0284C7]"
                  />
                </div>
              </div>

              <div className="rounded-3xl glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 bg-sky-50/70 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 font-black">
                        <th className="py-3.5 px-4">المستخدم</th>
                        <th className="py-3.5 px-4">بيانات التواصل</th>
                        <th className="py-3.5 px-4">الدور والصلاحية</th>
                        <th className="py-3.5 px-4">إصدار الجلسة</th>
                        <th className="py-3.5 px-4">الإجراءات الأمنية</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-sky-50/40 dark:hover:bg-slate-800/30">
                          <td className="py-3.5 px-4">
                            <div className="font-black text-[#0B1F3A] dark:text-white">
                              {u.firstName} {u.lastName}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              @{u.username}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                            <div>{u.phone}</div>
                            <div className="text-[11px] text-slate-500">{u.email}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <select
                              value={u.role}
                              onChange={(e) => handleChangeUserRole(u.id, e.target.value as UserRole)}
                              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#0B1F3A] dark:text-amber-300"
                            >
                              <option value="CUSTOMER">العميل</option>
                              <option value="CASHIER">الكاشير</option>
                              <option value="MERCHANT_MANAGER">مدير الفرع</option>
                              <option value="MERCHANT_OWNER">مالك المتجر</option>
                              <option value="SUPPORT_AGENT">وكيل الدعم الفني</option>
                              <option value="PLATFORM_ADMIN">المدير العام للمنصة</option>
                            </select>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-bold">
                              v{u.tokenVersion}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <button
                              type="button"
                              onClick={() => handleResetUserPassword(u.id)}
                              className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-slate-700 text-amber-900 dark:text-slate-200 border border-amber-200 dark:border-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <KeyRound className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                              إعادة تعيين كلمة المرور / فك القفل
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'packages' && (
            <div className="space-y-6">
              <div className="p-5 rounded-3xl glass-card border border-amber-200 dark:border-amber-400/30 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-[#0B1F3A] dark:text-white">
                    إدارة الباقات والأسعار (مصر 🇪🇬 / السعودية 🇸🇦) وحدود الاستخدام
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    يمكنك تعديل أسعار أي باقة، ضبط نسبة خصم الدفع السنوي، تحديد الحدود، أو إنشاء باقة جديدة.
                  </p>
                </div>
                <span className="px-3.5 py-1.5 rounded-full bg-amber-100 dark:bg-amber-400/15 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-400/30 text-xs font-black">
                  إجمالي الباقات النشطة: {packages.length}
                </span>
              </div>

              {/* Admin WhatsApp & Free Trial Duration Settings */}
              <div className="p-5 rounded-3xl glass-card border border-emerald-200 dark:border-emerald-500/30 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-emerald-600" />
                      <span>إعدادات واتساب استقبال الطلبات ومدة التجربة المجانية للمتاجر</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      الرقم المسجل هنا يستقبل جميع طلبات الخدمات والباقات من المتاجر والزوار، ومدة التجربة تُمنح تلقائياً لأي متجر جديد يسجل لحين التفعيل اليدوي.
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-black">
                    التجربة الحالية: {siteSettings.trialDays ?? 14} يوم
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-5">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      رقم واتساب الإدارة (مع رمز الدولة بدون +، مثال: 966500000000 أو 201000000000)
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={adminWhatsappInput}
                      onChange={(e) => setAdminWhatsappInput(e.target.value)}
                      placeholder="966500000000"
                      className={`${inputClass} font-mono`}
                    />
                  </div>

                  <div className="md:col-span-4 space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      مدة الفترة التجريبية للمتاجر الجديدة (بالأيام)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={90}
                        value={trialDaysInput}
                        onChange={(e) => setTrialDaysInput(e.target.value)}
                        className="w-24 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-black text-[#0B1F3A] dark:text-white"
                      />
                      <div className="flex flex-wrap gap-1">
                        {[7, 14, 21, 30].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setTrialDaysInput(String(d))}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black border cursor-pointer ${
                              Number(trialDaysInput) === d
                                ? 'bg-[#0B1F3A] text-[#FBBF24] border-[#0B1F3A]'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {d} ي
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-3">
                    <button
                      type="button"
                      disabled={savingTrialWhatsapp}
                      onClick={handleSaveWhatsappAndTrial}
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md cursor-pointer disabled:opacity-60"
                    >
                      {savingTrialWhatsapp ? 'جاري الحفظ...' : 'حفظ الواتساب ومدة التجربة'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Annual Payment Discount Control Bar */}
              <div className="p-5 rounded-3xl glass-card border border-sky-200 dark:border-sky-500/30 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white flex items-center gap-2">
                      <span>التحكم في خصم الدفع السنوي (Annual Billing Discount)</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      حدد نسبة الخصم عند اختيار التاجر للدفع السنوي في الصفحة الرئيسية (يمكنك أيضاً تخصيص نسبة مختلفة لكل باقة منفردة).
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-black">
                    الخصم الافتراضي الحالي: {siteSettings.annualDiscountPct ?? 20}%
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      نسبة الخصم السنوي (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={globalAnnualDiscountInput}
                      onChange={(e) => setGlobalAnnualDiscountInput(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div className="md:col-span-5 space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[0, 10, 15, 20, 25, 30].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setGlobalAnnualDiscountInput(String(preset))}
                          className={`px-3 py-1 rounded-xl text-[11px] font-black border cursor-pointer transition ${
                            Number(globalAnnualDiscountInput) === preset
                              ? 'bg-[#0B1F3A] text-[#FBBF24] border-[#0B1F3A]'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-sky-400'
                          }`}
                        >
                          {preset === 0 ? 'بدون خصم (0%)' : `${preset}%`}
                        </button>
                      ))}
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-[#0B1F3A] dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyAnnualToAllPackages}
                        onChange={(e) => setApplyAnnualToAllPackages(e.target.checked)}
                        className="rounded accent-sky-600"
                      />
                      <span>تطبيق هذه النسبة على جميع الباقات الحالية فوراً</span>
                    </label>
                  </div>

                  <div className="md:col-span-4 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={savingAnnualDiscount}
                      onClick={handleSaveGlobalAnnualDiscount}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] text-xs font-black shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-60"
                    >
                      {savingAnnualDiscount ? 'جاري الحفظ...' : 'حفظ وتطبيق خصم الدفع السنوي'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {packages.map((pkg) => {
                  const isEditing = editingPkgId === pkg.id;
                  const pkgAnnualPct = pkg.annualDiscountPct ?? siteSettings.annualDiscountPct ?? 20;
                  const annualEgp = Math.floor(
                    (pkg.monthlyPriceEgp ?? pkg.monthlyPrice) * ((100 - pkgAnnualPct) / 100)
                  );
                  const annualSar = Math.floor(pkg.monthlyPrice * ((100 - pkgAnnualPct) / 100));
                  return (
                    <div
                      key={pkg.id}
                      className={`p-5 rounded-3xl glass-card flex flex-col justify-between ${
                        pkg.highlighted
                          ? 'border-2 border-[#FBBF24] shadow-lg shadow-amber-500/10'
                          : ''
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white">
                            {pkg.title}
                          </h3>
                          {pkg.highlighted && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gradient-gold-cta text-[#0B1F3A]">
                              الأكثر طلباً
                            </span>
                          )}
                        </div>

                        {pkg.subtitle && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                            {pkg.subtitle}
                          </p>
                        )}

                        <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 mb-3 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 dark:text-slate-400">🇪🇬 السعر في مصر:</span>
                            <span className="font-black text-amber-700 dark:text-[#FBBF24]">
                              {pkg.monthlyPriceEgp ?? pkg.monthlyPrice} جنيه / شهرياً
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 dark:text-slate-400">🇸🇦 السعر في السعودية:</span>
                            <span className="font-black text-[#0284C7] dark:text-[#00C2FF]">
                              {pkg.monthlyPrice} ريال / شهرياً
                            </span>
                          </div>
                          <div className="pt-1.5 mt-1.5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-600 dark:text-slate-300">
                              خصم الدفع السنوي ({pkgAnnualPct}%):
                            </span>
                            <span className="font-black text-emerald-700 dark:text-emerald-400">
                              {annualEgp} ج.م · {annualSar} ر.س / شهر
                            </span>
                          </div>
                          {(pkg.promoDiscountPct ?? 0) > 0 && (
                            <div className="pt-1.5 mt-1.5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-black">
                              <span>🔥 {pkg.promoText || 'عرض خاص نشط'}</span>
                              <span>خصم {pkg.promoDiscountPct}%</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <button
                            type="button"
                            onClick={() => handleTogglePackageVisibility(pkg, 'visibleOnLanding')}
                            className={`flex-1 px-2.5 py-1.5 rounded-xl text-[11px] font-black border inline-flex items-center justify-center gap-1 cursor-pointer transition ${
                              pkg.visibleOnLanding !== false
                                ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {pkg.visibleOnLanding !== false ? (
                              <Eye className="w-3.5 h-3.5" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5" />
                            )}
                            <span>الرئيسية: {pkg.visibleOnLanding !== false ? 'ظاهرة' : 'مخفية'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleTogglePackageVisibility(pkg, 'visibleForStores')}
                            className={`flex-1 px-2.5 py-1.5 rounded-xl text-[11px] font-black border inline-flex items-center justify-center gap-1 cursor-pointer transition ${
                              pkg.visibleForStores !== false
                                ? 'bg-sky-50 dark:bg-sky-500/15 text-[#0284C7] dark:text-[#00C2FF] border-sky-200 dark:border-sky-500/30'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {pkg.visibleForStores !== false ? (
                              <Eye className="w-3.5 h-3.5" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5" />
                            )}
                            <span>المتاجر: {pkg.visibleForStores !== false ? 'ظاهرة' : 'مخفية'}</span>
                          </button>
                        </div>

                        <div className="p-3 rounded-2xl bg-sky-50/60 dark:bg-slate-900/60 border border-sky-100 dark:border-slate-800 mb-3 grid grid-cols-2 gap-2 text-[11px]">
                          <div className="p-2 rounded-xl bg-white/90 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                            <span className="text-slate-500 dark:text-slate-400 block text-[10px]">
                              حد الفروع
                            </span>
                            <span className="font-black text-[#0B1F3A] dark:text-white">
                              {pkg.maxBranches} فرع
                            </span>
                          </div>
                          <div className="p-2 rounded-xl bg-white/90 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                            <span className="text-slate-500 dark:text-slate-400 block text-[10px]">
                              حد الموظفين
                            </span>
                            <span className="font-black text-[#0284C7] dark:text-[#00C2FF]">
                              {pkg.maxStaff} حساب
                            </span>
                          </div>
                          <div className="p-2 rounded-xl bg-white/90 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                            <span className="text-slate-500 dark:text-slate-400 block text-[10px]">
                              العملاء شهرياً
                            </span>
                            <span className="font-black text-amber-700 dark:text-[#FBBF24]">
                              {!pkg.loyaltyEnabled
                                ? 'عرض فقط'
                                : (pkg.maxCustomersPerMonth ?? 0) > 0
                                ? `حتى ${pkg.maxCustomersPerMonth} عميل`
                                : 'غير محدود'}
                            </span>
                          </div>
                          <div className="p-2 rounded-xl bg-white/90 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                            <span className="text-slate-500 dark:text-slate-400 block text-[10px]">
                              الكاشير والولاء
                            </span>
                            <span
                              className={`font-black ${
                                pkg.loyaltyEnabled
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-slate-500'
                              }`}
                            >
                              {pkg.loyaltyEnabled ? 'نقاط البيع الذكية' : 'عرض المتجر فقط'}
                            </span>
                          </div>
                          <div className="p-2 rounded-xl bg-white/90 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 col-span-2">
                            <span className="text-slate-500 dark:text-slate-400 block text-[10px]">
                              متجر أونلاين وطلبات واتساب 🛵
                            </span>
                            <span
                              className={`font-black flex items-center gap-1 ${
                                pkg.hasOnlineOrdering
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-slate-400 dark:text-slate-500'
                              }`}
                            >
                              {pkg.hasOnlineOrdering
                                ? '✅ متجر أونلاين وسلة مشتريات مع واتساب'
                                : '❌ غير مفعل في هذه الباقة'}
                            </span>
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="p-4 rounded-2xl bg-white/90 dark:bg-slate-950 border border-amber-300 dark:border-amber-400/50 space-y-3 mb-4">
                            <div className="text-xs font-black text-amber-800 dark:text-amber-300 border-b border-slate-200 dark:border-slate-800 pb-2">
                              تعديل شامل للباقة وحدودها وأسعارها
                            </div>

                            <div>
                              <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                                اسم الباقة
                              </label>
                              <input
                                type="text"
                                value={editPkgTitle}
                                onChange={(e) => setEditPkgTitle(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                                الوصف الفرعي
                              </label>
                              <input
                                type="text"
                                value={editPkgSubtitle}
                                onChange={(e) => setEditPkgSubtitle(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                                  السعر بالجنيه 🇪🇬
                                </label>
                                <input
                                  type="number"
                                  value={editPkgPriceEgp}
                                  onChange={(e) => setEditPkgPriceEgp(e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                                  السعر بالريال 🇸🇦
                                </label>
                                <input
                                  type="number"
                                  value={editPkgPriceSar}
                                  onChange={(e) => setEditPkgPriceSar(e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
                                />
                              </div>
                            </div>

                            <div className="p-2.5 rounded-xl bg-sky-50/70 dark:bg-slate-900/90 border border-sky-100 dark:border-slate-800 space-y-2">
                              <div className="text-[11px] font-black text-[#0284C7] dark:text-[#00C2FF]">
                                حدود الباقة والاستخدام
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                                    أقصى فروع
                                  </label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={editPkgBranches}
                                    onChange={(e) => setEditPkgBranches(e.target.value)}
                                    className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                                    أقصى موظفين
                                  </label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={editPkgStaff}
                                    onChange={(e) => setEditPkgStaff(e.target.value)}
                                    className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                                    عملاء/شهر (0=مفتوح)
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={editPkgMaxCustomers}
                                    onChange={(e) => setEditPkgMaxCustomers(e.target.value)}
                                    className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
                                  />
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-4 pt-1">
                                <label className="inline-flex items-center gap-1.5 text-[11px] text-[#0B1F3A] dark:text-slate-200 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={editPkgLoyaltyEnabled}
                                    onChange={(e) => setEditPkgLoyaltyEnabled(e.target.checked)}
                                    className="rounded accent-amber-500"
                                  />
                                  <span>تفعيل الكاشير ونظام الولاء</span>
                                </label>
                                <label className="inline-flex items-center gap-1.5 text-[11px] text-amber-800 dark:text-amber-300 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={editPkgHighlighted}
                                    onChange={(e) => setEditPkgHighlighted(e.target.checked)}
                                    className="rounded accent-amber-500"
                                  />
                                  <span>تمييز كـ «الأكثر طلباً»</span>
                                </label>
                                <label className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={editPkgVisibleOnLanding}
                                    onChange={(e) => setEditPkgVisibleOnLanding(e.target.checked)}
                                    className="rounded accent-emerald-500"
                                  />
                                  <span>إظهار في الصفحة الرئيسية</span>
                                </label>
                                <label className="inline-flex items-center gap-1.5 text-[11px] text-sky-700 dark:text-sky-300 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={editPkgVisibleForStores}
                                    onChange={(e) => setEditPkgVisibleForStores(e.target.checked)}
                                    className="rounded accent-sky-500"
                                  />
                                  <span>إظهار في لوحة المتاجر</span>
                                </label>
                                <label className="inline-flex items-center gap-1.5 text-[11px] text-emerald-800 dark:text-emerald-300 font-bold cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={editPkgHasOnlineOrdering}
                                    onChange={(e) => setEditPkgHasOnlineOrdering(e.target.checked)}
                                    className="rounded accent-emerald-500"
                                  />
                                  <span>ميزة المتجر الإلكتروني وطلبات واتساب 🛵</span>
                                </label>
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                                  ترتيب العرض (Display Order)
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  value={editPkgDisplayOrder}
                                  onChange={(e) => setEditPkgDisplayOrder(e.target.value)}
                                  className="w-24 px-2 py-1 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                                  شارة العرض الترويجي
                                </label>
                                <input
                                  type="text"
                                  value={editPkgPromoText}
                                  onChange={(e) => setEditPkgPromoText(e.target.value)}
                                  placeholder="مثال: عرض خاص"
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                                  خصم العرض (%)
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  max={90}
                                  value={editPkgPromoPct}
                                  onChange={(e) => setEditPkgPromoPct(e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-emerald-700 dark:text-emerald-300 font-bold mb-1">
                                  خصم الدفع السنوي (%)
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  max={90}
                                  value={editPkgAnnualDiscountPct}
                                  onChange={(e) => setEditPkgAnnualDiscountPct(e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-[#0B1F3A] dark:text-white"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                                نص زر الاشتراك
                              </label>
                              <input
                                type="text"
                                value={editPkgCtaText}
                                onChange={(e) => setEditPkgCtaText(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                                مميزات الباقة (ميزة في كل سطر)
                              </label>
                              <textarea
                                rows={4}
                                value={editPkgFeaturesText}
                                onChange={(e) => setEditPkgFeaturesText(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-[#0B1F3A] dark:text-white leading-relaxed"
                              />
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleSavePackageUpdate(pkg)}
                                className="flex-1 py-2 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] text-xs font-black cursor-pointer"
                              >
                                حفظ التعديلات والحدود
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingPkgId(null)}
                                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                              >
                                إلغاء
                              </button>
                            </div>
                          </div>
                        ) : (
                          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 mb-5">
                            {pkg.features.map((f, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="space-y-2 pt-3 border-t border-slate-200/80 dark:border-slate-800/80">
                        {!isEditing && (
                          <button
                            type="button"
                            onClick={() => handleStartEditPackage(pkg)}
                            className="w-full py-2.5 rounded-xl bg-amber-50 dark:bg-amber-400/15 hover:bg-amber-100 dark:hover:bg-amber-400/25 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-400/30 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Settings className="w-3.5 h-3.5" />
                            تعديل الباقة وحدودها والأسعار
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeletePackage(pkg.id)}
                          className="w-full py-2 rounded-xl bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          حذف الباقة نهائياً
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form
                onSubmit={handleCreatePackage}
                className="p-6 rounded-3xl glass-card space-y-5"
              >
                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700/70 pb-3">
                  <h3 className="text-sm font-black text-[#0B1F3A] dark:text-white flex items-center gap-2">
                    <Plus className="w-4 h-4 text-[#0284C7] dark:text-[#00C2FF]" />
                    إنشاء باقة اشتراك جديدة وتحديد حدودها (تظهر فوراً في الصفحة الرئيسية)
                  </h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    يدعم تسعير مصر (ج.م) والسعودية (ر.س)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      اسم الباقة الظاهر
                    </label>
                    <input
                      type="text"
                      required
                      value={newPkgTitle}
                      onChange={(e) => setNewPkgTitle(e.target.value)}
                      placeholder="مثال: 🚀 باقة التوسع (5 فروع)"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      نوع الباقة الأساسي
                    </label>
                    <select
                      value={newPkgName}
                      onChange={(e) => setNewPkgName(e.target.value as SubscriptionPlanName)}
                      className={inputClass}
                    >
                      <option value="Viewer">التواجد الرقمي (عرض فقط)</option>
                      <option value="Starter">باقة الانطلاق</option>
                      <option value="Growth">باقة النمو والفروع</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      السعر الشهري بالجنيه 🇪🇬
                    </label>
                    <input
                      type="number"
                      required
                      value={newPkgPriceEgp}
                      onChange={(e) => setNewPkgPriceEgp(e.target.value)}
                      placeholder="400"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      السعر الشهري بالريال 🇸🇦
                    </label>
                    <input
                      type="number"
                      required
                      value={newPkgPriceSar}
                      onChange={(e) => setNewPkgPriceSar(e.target.value)}
                      placeholder="39"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      الحد الأقصى للفروع
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={newPkgBranches}
                      onChange={(e) => setNewPkgBranches(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      الحد الأقصى للموظفين
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={newPkgStaff}
                      onChange={(e) => setNewPkgStaff(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      حد العملاء شهرياً (0 = مفتوح)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newPkgMaxCustomers}
                      onChange={(e) => setNewPkgMaxCustomers(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      الوصف الفرعي للباقة
                    </label>
                    <input
                      type="text"
                      value={newPkgSubtitle}
                      onChange={(e) => setNewPkgSubtitle(e.target.value)}
                      placeholder="(للمتاجر النشطة...)"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      نص زر الاشتراك
                    </label>
                    <input
                      type="text"
                      value={newPkgCtaText}
                      onChange={(e) => setNewPkgCtaText(e.target.value)}
                      placeholder="ابدأ تجربتك المجانية"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                  <div className="lg:col-span-8">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      مميزات الباقة (اكتب كل ميزة في سطر مستقل)
                    </label>
                    <textarea
                      rows={3}
                      value={newPkgFeaturesText}
                      onChange={(e) => setNewPkgFeaturesText(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div className="lg:col-span-4 space-y-3">
                    <div className="flex flex-col gap-2 p-3 rounded-2xl bg-white/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <label className="inline-flex items-center gap-2 text-xs text-[#0B1F3A] dark:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newPkgLoyaltyEnabled}
                          onChange={(e) => setNewPkgLoyaltyEnabled(e.target.checked)}
                          className="rounded accent-amber-500"
                        />
                        <span>تفعيل نظام الولاء والكاشير الذكي</span>
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newPkgHighlighted}
                          onChange={(e) => setNewPkgHighlighted(e.target.checked)}
                          className="rounded accent-amber-500"
                        />
                        <span>تمييز الباقة بشارة «الأكثر طلباً»</span>
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newPkgVisibleOnLanding}
                          onChange={(e) => setNewPkgVisibleOnLanding(e.target.checked)}
                          className="rounded accent-emerald-500"
                        />
                        <span>إظهار في الصفحة الرئيسية</span>
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs text-sky-700 dark:text-sky-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newPkgVisibleForStores}
                          onChange={(e) => setNewPkgVisibleForStores(e.target.checked)}
                          className="rounded accent-sky-500"
                        />
                        <span>إظهار للمتاجر عند الترقية</span>
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newPkgHasOnlineOrdering}
                          onChange={(e) => setNewPkgHasOnlineOrdering(e.target.checked)}
                          className="rounded accent-emerald-500"
                        />
                        <span>تضمين ميزة المتجر الإلكتروني وطلبات واتساب 🛵</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-slate-500">ترتيب العرض:</span>
                          <input
                            type="number"
                            min={1}
                            value={newPkgDisplayOrder}
                            onChange={(e) => setNewPkgDisplayOrder(e.target.value)}
                            className="w-16 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">خصم سنوي %:</span>
                          <input
                            type="number"
                            min={0}
                            max={90}
                            value={newPkgAnnualDiscountPct}
                            onChange={(e) => setNewPkgAnnualDiscountPct(e.target.value)}
                            className="w-16 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-xs font-bold"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] text-xs font-black shadow-lg shadow-amber-500/20 cursor-pointer"
                    >
                      + حفظ ونشر الباقة الجديدة
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'network' && (
            <div className="space-y-6">
              <div className="p-6 rounded-3xl glass-card space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-black text-[#0B1F3A] dark:text-white">
                      قواعد تسعير النقاط في الشبكة المشتركة
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      تحديد قيمة كل 100 نقطة عند الاستبدال داخل نفس المتجر أو عبر متاجر الشبكة
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleNetworkAction(
                        { action: 'run_bullmq_settlement' },
                        'تم تشغيل دورة التسوية الشهرية بنجاح'
                      )
                    }
                    className="px-4 py-2 rounded-xl bg-gradient-electric hover:opacity-95 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    تشغيل التسوية الشهرية للشبكة
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      قيمة 100 نقطة داخل نفس المتجر (ر.س)
                    </label>
                    <input
                      type="number"
                      value={sameStoreRate}
                      onChange={(e) => setSameStoreRate(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      قيمة 100 نقطة عبر متاجر الشبكة (ر.س)
                    </label>
                    <input
                      type="number"
                      value={crossStoreRate}
                      onChange={(e) => setCrossStoreRate(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleSaveNetworkRules}
                      className="w-full py-2.5 rounded-xl bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] text-xs font-black cursor-pointer"
                    >
                      حفظ قواعد الشبكة ({networkRuleVersions.length} نسخ)
                    </button>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-[#0B1F3A] dark:text-white">
                        تفعيل وإدارة مشاركة النقاط بين المتاجر
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        التحكم العام في ميزة تحويل ومشاركة النقاط بين بطاقات العملاء في متاجر الشبكة
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pointSharingEnabled}
                        onChange={(e) => setPointSharingEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                      <span className="mr-3 text-xs font-bold text-slate-700 dark:text-slate-300">
                        {pointSharingEnabled ? 'مفعلة' : 'معطلة'}
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                        تاريخ بداية تفعيل مشاركة النقاط
                      </label>
                      <input
                        type="date"
                        value={pointSharingStartDate}
                        onChange={(e) => setPointSharingStartDate(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                        تاريخ نهاية تفعيل مشاركة النقاط
                      </label>
                      <input
                        type="date"
                        value={pointSharingEndDate}
                        onChange={(e) => setPointSharingEndDate(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
                      تحديد المتاجر المسموح لها بالمشاركة (فارغ يعني السماح لجميع المتاجر النشطة)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-3 rounded-2xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                      {stores.map((s) => {
                        const isAllowed =
                          pointSharingAllowedMerchantIds.length === 0 ||
                          pointSharingAllowedMerchantIds.includes(s.merchantId) ||
                          pointSharingAllowedMerchantIds.includes(s.id);
                        return (
                          <label
                            key={s.id}
                            className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                          >
                            <input
                              type="checkbox"
                              checked={isAllowed}
                              onChange={(e) => {
                                const targetId = s.merchantId;
                                let nextList = [...pointSharingAllowedMerchantIds];
                                if (nextList.length === 0) {
                                  // if currently all allowed, initializing list with all stores except toggled one
                                  nextList = stores.map((st) => st.merchantId);
                                }
                                if (e.target.checked) {
                                  if (!nextList.includes(targetId)) nextList.push(targetId);
                                } else {
                                  nextList = nextList.filter((id) => id !== targetId && id !== s.id);
                                }
                                setPointSharingAllowedMerchantIds(nextList);
                              }}
                              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            />
                            <span className="truncate text-slate-800 dark:text-slate-200">{s.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    {pointSharingAllowedMerchantIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setPointSharingAllowedMerchantIds([])}
                        className="mt-2 text-[11px] text-sky-600 hover:underline font-bold cursor-pointer"
                      >
                        إلغاء التخصيص والسماح لجميع المتاجر
                      </button>
                    )}
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleSaveNetworkRules}
                      className="px-6 py-3 rounded-xl bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] text-xs font-black shadow-md cursor-pointer flex items-center gap-2"
                    >
                      حفظ إعدادات شبكة مشاركة النقاط ({networkRuleVersions.length} إصدارات)
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-5 rounded-3xl glass-card space-y-3">
                  <h4 className="text-sm font-black text-[#0B1F3A] dark:text-white">
                    اتفاقيات المتاجر في الشبكة
                  </h4>
                  {networkAgreements.map((agr) => (
                    <div
                      key={agr.id}
                      className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-black text-[#0B1F3A] dark:text-white">
                          {agr.storeName}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          نسبة المشاركة: {agr.revenueSharePct}% · منذ {agr.signedAt}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleNetworkAction(
                            { action: 'toggle_agreement', agreementId: agr.id },
                            'تم تحديث حالة اتفاقية الشبكة'
                          )
                        }
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                          agr.status === 'active'
                            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                            : 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300'
                        }`}
                      >
                        {agr.status === 'active' ? 'نشطة (إيقاف)' : 'معلقة (تفعيل)'}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="p-5 rounded-3xl glass-card space-y-3">
                  <h4 className="text-sm font-black text-[#0B1F3A] dark:text-white">
                    التسويات المالية الشهرية
                  </h4>
                  {networkSettlements.map((stl) => (
                    <div
                      key={stl.id}
                      className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="text-xs font-black text-[#0B1F3A] dark:text-white">
                          {stl.storeName} ({stl.month})
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          صافي التسوية:{' '}
                          <strong className="text-amber-700 dark:text-[#FBBF24]">
                            {stl.netAmountSar} ر.س
                          </strong>
                        </div>
                      </div>
                      {stl.status === 'pending' ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleNetworkAction(
                              {
                                action: 'mark_settlement_paid',
                                settlementId: stl.id,
                                attachmentName: `bank-transfer-${stl.id}.pdf`,
                              },
                              'تم توثيق سداد التسوية المالية'
                            )
                          }
                          className="px-3 py-1.5 rounded-xl bg-gradient-gold-cta text-[#0B1F3A] text-xs font-black cursor-pointer"
                        >
                          توثيق السداد
                        </button>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold">
                          مدفوعة ✓
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {networkDisputes.length > 0 && (
                <div className="p-5 rounded-3xl glass-card space-y-3">
                  <h4 className="text-sm font-black text-[#0B1F3A] dark:text-white">
                    نزاعات الشبكة المشتركة
                  </h4>
                  {networkDisputes.map((dsp) => (
                    <div
                      key={dsp.id}
                      className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-black text-[#0B1F3A] dark:text-white">
                          {dsp.merchantName} — {dsp.amountSar} ر.س
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {dsp.reason}
                        </div>
                      </div>
                      {dsp.status !== 'تمت التسوية' ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleNetworkAction(
                              { action: 'resolve_dispute', disputeId: dsp.id },
                              'تم إغلاق وتسوية النزاع'
                            )
                          }
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-black cursor-pointer"
                        >
                          اعتماد التسوية
                        </button>
                      ) : (
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          تمت التسوية ✓
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}



          {isSuperAdmin && activeTab === 'security' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-6 rounded-3xl glass-card space-y-4">
                  <h3 className="text-base font-black text-[#0B1F3A] dark:text-white flex items-center gap-2">
                    <Settings className="w-4 h-4 text-[#0284C7] dark:text-[#00C2FF]" />
                    إعدادات تشغيل ميزات المنصة الفورية
                  </h3>
                  {(
                    [
                      { key: 'webPass', label: 'بطاقات الويب الرقمية الذكية بدون تطبيقات' },
                      { key: 'socialAuth', label: 'الدخول السريع بدون كلمات مرور معقدة' },
                      { key: 'onlinePayments', label: 'بوابات الدفع الإلكتروني (مدى / إنستا باي / إيزي كاش)' },
                      { key: 'sharedNetwork', label: 'شبكة الولاء المشتركة بين المتاجر' },
                      { key: 'geoProximity', label: 'تنبيهات القرب الجغرافي للعملاء' },
                    ] as const
                  ).map((item) => {
                    const enabled = featureFlags[item.key];
                    return (
                      <div
                        key={item.key}
                        className="flex items-center justify-between p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700"
                      >
                        <span className="text-xs font-bold text-[#0B1F3A] dark:text-slate-200">
                          {item.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleFeatureFlag(item.key)}
                          className="flex items-center gap-1.5 text-xs font-black cursor-pointer"
                        >
                          {enabled ? (
                            <ToggleRight className="w-7 h-7 text-emerald-500" />
                          ) : (
                            <ToggleLeft className="w-7 h-7 text-slate-400 dark:text-slate-600" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="p-6 rounded-3xl glass-card space-y-4">
                  <h3 className="text-base font-black text-[#0B1F3A] dark:text-white flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-500" />
                    حماية حسابات الإدارة والتحقق الثنائي
                  </h3>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-bold text-[#0B1F3A] dark:text-slate-200">
                      إلزام التحقق الثنائي لدخول المشرفين والمدير العام
                    </span>
                    <input
                      type="checkbox"
                      checked={adminSecurity.mfaEnabled}
                      onChange={(e) =>
                        setAdminSecurity((prev) => ({ ...prev, mfaEnabled: e.target.checked }))
                      }
                      className="w-4 h-4 accent-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                      عناوين الشبكة المسموحة للوصول الإداري (مفصولة بفاصلة)
                    </label>
                    <input
                      type="text"
                      value={ipAllowlistInput}
                      onChange={(e) => setIpAllowlistInput(e.target.value)}
                      className={`${inputClass} font-mono`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveSecurity}
                    className="w-full py-3 rounded-xl bg-gradient-gold-cta hover:opacity-95 text-[#0B1F3A] text-xs font-black cursor-pointer"
                  >
                    حفظ سياسات الأمان
                  </button>
                </div>
              </div>

              <div className="p-6 rounded-3xl glass-card border border-emerald-200 dark:border-emerald-500/30 space-y-4">
                <h3 className="text-base font-black text-[#0B1F3A] dark:text-white flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  رقم واتساب الإدارة ومدة التجربة المجانية للمتاجر
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      رقم واتساب الإدارة الرسمي
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={adminWhatsappInput}
                      onChange={(e) => setAdminWhatsappInput(e.target.value)}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      مدة التجربة المجانية للمتاجر الجديدة (أيام)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={trialDaysInput}
                      onChange={(e) => setTrialDaysInput(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={savingTrialWhatsapp}
                    onClick={handleSaveWhatsappAndTrial}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer disabled:opacity-60"
                  >
                    {savingTrialWhatsapp ? 'جاري الحفظ...' : 'حفظ إعدادات الواتساب والتجربة'}
                  </button>
                </div>
              </div>

              <div className="p-6 rounded-3xl glass-card space-y-4">
                <h3 className="text-base font-black text-[#0B1F3A] dark:text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-[#0284C7] dark:text-[#00C2FF]" />
                  سجل الرقابة والتدقيق الموحد ({auditLogs.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                        <th className="py-3 px-3">التوقيت</th>
                        <th className="py-3 px-3">المنفذ</th>
                        <th className="py-3 px-3">الدور</th>
                        <th className="py-3 px-3">العملية</th>
                        <th className="py-3 px-3">الهدف</th>
                        <th className="py-3 px-3">القيمة السابقة ← الجديدة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                      {auditLogs.slice(0, 25).map((log) => (
                        <tr key={log.id} className="hover:bg-sky-50/40 dark:hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {log.timestamp}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-[#0B1F3A] dark:text-white">
                            {log.user}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-slate-800 text-amber-900 dark:text-amber-300 text-[10px] font-bold">
                              {log.actorRole}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 dark:text-slate-200">
                            {log.action}
                          </td>
                          <td className="py-2.5 px-3 text-[#0284C7] dark:text-[#00C2FF] font-bold">
                            {log.target}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-500 dark:text-slate-400">
                            {log.oldValue || '-'} ←{' '}
                            <strong className="text-emerald-600 dark:text-emerald-400">
                              {log.newValue || '-'}
                            </strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
