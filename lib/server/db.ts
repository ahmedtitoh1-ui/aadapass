import {
  INITIAL_ADMIN_SECURITY,
  INITIAL_AUDIT_LOGS,
  INITIAL_CANNED_RESPONSES,
  INITIAL_CUSTOMER,
  INITIAL_ENVIRONMENTS,
  INITIAL_FEATURE_FLAGS,
  INITIAL_FINANCIAL_ADJUSTMENTS,
  INITIAL_NETWORK_AGREEMENTS,
  INITIAL_NETWORK_DISPUTES,
  INITIAL_NETWORK_RULES,
  INITIAL_NETWORK_RULE_VERSIONS,
  INITIAL_NETWORK_SETTLEMENTS,
  INITIAL_PACKAGES,
  INITIAL_SITE_SETTINGS,
  INITIAL_STORES,
  INITIAL_STORE_REQUESTS,
  INITIAL_TICKETS,
  INITIAL_TRANSACTIONS,
  INITIAL_VISITOR_LOGS,
  INITIAL_ORDERS,
} from '@/lib/mockData';
import { hashPassword } from './crypto';
import type {
  AdminOverviewDTO,
  AdminSecurityConfig,
  AuditLog,
  CannedResponse,
  CustomerCard,
  CustomerProfile,
  FinancialAdjustmentRequest,
  NetworkAgreement,
  NetworkDispute,
  NetworkRules,
  NetworkRuleVersion,
  NetworkSettlement,
  PlatformEnvironment,
  PlatformFeatureFlags,
  SiteSettings,
  Store,
  StoreAdditionRequest,
  SubscriptionPackage,
  SupportTicket,
  Transaction,
  UserRole,
  VisitorLog,
  OnlineOrder,
} from '@/lib/types';

export interface ServerUserRecord {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: UserRole;
  merchantId?: string;
  environmentId?: string;
  branchId?: string;
  branchIds?: string[];
  mustChangePassword?: boolean;
  failedAttempts: number;
  lockedUntil: number | null;
  tokenVersion: number;
}

export interface RefreshTokenRecord {
  tokenHash: string;
  userId: string;
  tokenVersion: number;
  expiresAt: number;
  revoked: boolean;
  familyId: string;
}

export interface OtpChallengeRecord {
  phone: string;
  code: string;
  expiresAt: number;
  attempts: number;
}

export interface InMemoryDb {
  users: ServerUserRecord[];
  refreshTokens: Map<string, RefreshTokenRecord>;
  otpChallenges: Map<string, OtpChallengeRecord>;
  stores: Store[];
  customers: Map<string, CustomerProfile>;
  packages: SubscriptionPackage[];
  transactions: Transaction[];
  tickets: SupportTicket[];
  financialAdjustments: FinancialAdjustmentRequest[];
  cannedResponses: CannedResponse[];
  auditLogs: AuditLog[];
  networkRules: NetworkRules;
  networkRuleVersions: NetworkRuleVersion[];
  networkAgreements: NetworkAgreement[];
  networkSettlements: NetworkSettlement[];
  networkDisputes: NetworkDispute[];
  storeRequests: StoreAdditionRequest[];
  featureFlags: PlatformFeatureFlags;
  siteSettings: SiteSettings;
  adminSecurity: AdminSecurityConfig;
  environments: PlatformEnvironment[];
  visitorLogs: VisitorLog[];
  usedQrNonces: Set<string>;
  revokedQrKeyIds: Set<string>;
  orders: OnlineOrder[];
}

declare global {
  var __AADA_CANONICAL_DB__: InMemoryDb | undefined;
}

export function computeDerivedCustomerTotalPoints(cards: CustomerCard[]): number {
  return cards.reduce(
    (sum, c) => sum + (c.isActive && c.rule?.type !== 'stamps' ? c.currentBalance : 0),
    0
  );
}

export function computeAdminOverview(db: InMemoryDb): AdminOverviewDTO {
  const totalStores = db.stores.length;
  const activeStores = db.stores.filter((s) => s.status === 'active').length;
  const pendingStores = db.stores.filter((s) => s.status === 'pending').length;
  const suspendedStores = db.stores.filter((s) => s.status === 'suspended').length;
  const viewerStores = db.stores.filter((s) => s.subscriptionPlan === 'Viewer').length;
  const totalCustomers = db.customers.size;

  const totalPointsIssued = db.transactions
    .filter((t) => t.pointsEarned > 0)
    .reduce((acc, t) => acc + t.pointsEarned, 0);
  const totalPointsRedeemed = db.transactions
    .filter((t) => t.pointsEarned < 0 || (t.pointsSpent ?? 0) > 0)
    .reduce((acc, t) => acc + Math.abs(t.pointsSpent || t.pointsEarned), 0);

  const monthlyPlatformRevenueSar = db.stores.reduce((sum, s) => {
    const pkg = db.packages.find((p) => p.name === s.subscriptionPlan);
    return sum + (pkg?.monthlyPrice || 0);
  }, 0);

  return {
    totalStores,
    activeStores,
    pendingStores,
    suspendedStores,
    viewerStores,
    totalCustomers,
    totalPointsIssued: totalPointsIssued || 18450,
    totalPointsRedeemed: totalPointsRedeemed || 6420,
    monthlyPlatformRevenueSar: monthlyPlatformRevenueSar || 14850,
    activeSubscriptionsCount: activeStores,
    overdueSubscriptionsCount: suspendedStores,
    periodComparison: [
      {
        period: 'الربع الحالي (Q4 2026)',
        storesCount: totalStores,
        pointsIssued: totalPointsIssued || 18450,
        pointsRedeemed: totalPointsRedeemed || 6420,
        revenueSar: monthlyPlatformRevenueSar * 3 || 44550,
      },
      {
        period: 'الربع السابق (Q3 2026)',
        storesCount: Math.max(1, totalStores - 1),
        pointsIssued: 12900,
        pointsRedeemed: 4100,
        revenueSar: 31200,
      },
    ],
  };
}

function createSeedDb(): InMemoryDb {
  const defaultPass = hashPassword('Demo@12345');
  const users: ServerUserRecord[] = [
    {
      id: 'cust-1',
      username: 'fahad',
      firstName: 'فهد',
      lastName: 'العتيبي',
      email: 'fahad@example.com',
      phone: '+966551234567',
      passwordHash: defaultPass,
      role: 'CUSTOMER',
      failedAttempts: 0,
      lockedUntil: null,
      tokenVersion: 1,
    },
    {
      id: 'cust-2',
      username: 'sara',
      firstName: 'سارة',
      lastName: 'الدوسري',
      email: 'sara@example.com',
      phone: '+966559876543',
      passwordHash: defaultPass,
      role: 'CUSTOMER',
      failedAttempts: 0,
      lockedUntil: null,
      tokenVersion: 1,
    },
    {
      id: 'usr-cashier-1',
      username: 'cashier1',
      firstName: 'سعد',
      lastName: 'الدوسري',
      email: 'cashier@kayan.sa',
      phone: '+966501112233',
      passwordHash: defaultPass,
      role: 'CASHIER',
      merchantId: 'merch-1',
      branchId: 'b-1',
      branchIds: ['b-1', 'b-2'],
      failedAttempts: 0,
      lockedUntil: null,
      tokenVersion: 1,
    },
    {
      id: 'usr-manager-1',
      username: 'manager1',
      firstName: 'خالد',
      lastName: 'الشهري',
      email: 'manager@kayan.sa',
      phone: '+966502223344',
      passwordHash: defaultPass,
      role: 'MERCHANT_MANAGER',
      merchantId: 'merch-1',
      branchId: 'b-1',
      branchIds: ['b-1', 'b-2'],
      failedAttempts: 0,
      lockedUntil: null,
      tokenVersion: 1,
    },
    {
      id: 'usr-merchant-1',
      username: 'merchant1',
      firstName: 'سلطان',
      lastName: 'القحطاني',
      email: 'owner@kayan.sa',
      phone: '+966503334455',
      passwordHash: defaultPass,
      role: 'MERCHANT_OWNER',
      merchantId: 'merch-1',
      branchId: 'b-1',
      branchIds: ['b-1', 'b-2'],
      failedAttempts: 0,
      lockedUntil: null,
      tokenVersion: 1,
    },
    {
      id: 'usr-support-1',
      username: 'support1',
      firstName: 'ريم',
      lastName: 'الحربي',
      email: 'support@aadapass.com',
      phone: '+966504445566',
      passwordHash: defaultPass,
      role: 'SUPPORT_AGENT',
      failedAttempts: 0,
      lockedUntil: null,
      tokenVersion: 1,
    },
    {
      id: 'usr-admin-1',
      username: 'admin',
      firstName: 'عبدالعزيز',
      lastName: 'المنصور',
      email: 'admin@aadapass.com',
      phone: '+966509998877',
      passwordHash: defaultPass,
      role: 'PLATFORM_ADMIN',
      failedAttempts: 0,
      lockedUntil: null,
      tokenVersion: 1,
    },
  ];

  const customers = new Map<string, CustomerProfile>();
  customers.set(INITIAL_CUSTOMER.id, structuredClone(INITIAL_CUSTOMER));
  customers.set('cust-2', {
    ...structuredClone(INITIAL_CUSTOMER),
    id: 'cust-2',
    firstName: 'سارة',
    lastName: 'الدوسري',
    username: 'sara',
    email: 'sara@example.com',
    phone: '+966559876543',
    qrKeyId: 'qrk-cust-2',
    referralCode: 'SARA2026',
    accountCardCode: 'AADA-VIP-9920',
    accountPointsBalance: 190,
    accountTransfers: [],
    cards: [],
    vouchers: [],
  });

  return {
    users,
    refreshTokens: new Map(),
    otpChallenges: new Map(),
    stores: structuredClone(INITIAL_STORES),
    customers,
    packages: structuredClone(INITIAL_PACKAGES),
    transactions: structuredClone(INITIAL_TRANSACTIONS),
    tickets: structuredClone(INITIAL_TICKETS),
    financialAdjustments: structuredClone(INITIAL_FINANCIAL_ADJUSTMENTS),
    cannedResponses: structuredClone(INITIAL_CANNED_RESPONSES),
    auditLogs: structuredClone(INITIAL_AUDIT_LOGS),
    networkRules: structuredClone(INITIAL_NETWORK_RULES),
    networkRuleVersions: structuredClone(INITIAL_NETWORK_RULE_VERSIONS),
    networkAgreements: structuredClone(INITIAL_NETWORK_AGREEMENTS),
    networkSettlements: structuredClone(INITIAL_NETWORK_SETTLEMENTS),
    networkDisputes: structuredClone(INITIAL_NETWORK_DISPUTES),
    storeRequests: structuredClone(INITIAL_STORE_REQUESTS),
    featureFlags: structuredClone(INITIAL_FEATURE_FLAGS),
    siteSettings: structuredClone(INITIAL_SITE_SETTINGS),
    adminSecurity: structuredClone(INITIAL_ADMIN_SECURITY),
    environments: structuredClone(INITIAL_ENVIRONMENTS),
    visitorLogs: structuredClone(INITIAL_VISITOR_LOGS),
    orders: structuredClone(INITIAL_ORDERS),
    usedQrNonces: new Set(),
    revokedQrKeyIds: new Set(),
  };
}

export function getDb(): InMemoryDb {
  if (!globalThis.__AADA_CANONICAL_DB__) {
    globalThis.__AADA_CANONICAL_DB__ = createSeedDb();
  } else {
    const db = globalThis.__AADA_CANONICAL_DB__;
    if (!db.orders) {
      db.orders = structuredClone(INITIAL_ORDERS);
    }
    if (db.packages.some((p) => p.id === 'pkg-enterprise')) {
      db.packages = db.packages.filter((p) => p.id !== 'pkg-enterprise');
    }
    // Sync newly added seed stores or enriched menus/galleries/cardDesigns if missing
    for (const seedStore of INITIAL_STORES) {
      const existing = db.stores.find((s) => s.id === seedStore.id);
      if (!existing) {
        db.stores.push(structuredClone(seedStore));
      } else {
        if (existing.menu.length < seedStore.menu.length) {
          existing.menu = structuredClone(seedStore.menu);
        }
        if (!existing.storeGallery || existing.storeGallery.length < (seedStore.storeGallery?.length || 0)) {
          existing.storeGallery = structuredClone(seedStore.storeGallery);
        }
        if (!existing.cardDesigns || existing.cardDesigns.length < (seedStore.cardDesigns?.length || 0)) {
          existing.cardDesigns = structuredClone(seedStore.cardDesigns);
        }
        if (!existing.vouchers || existing.vouchers.length < (seedStore.vouchers?.length || 0)) {
          existing.vouchers = structuredClone(seedStore.vouchers || []);
        }
        if (!existing.campaigns || existing.campaigns.length < (seedStore.campaigns?.length || 0)) {
          existing.campaigns = structuredClone(seedStore.campaigns || []);
        }
        if (!existing.cashiers || existing.cashiers.length < (seedStore.cashiers?.length || 0)) {
          existing.cashiers = structuredClone(seedStore.cashiers || []);
        }
        if (typeof existing.onlineOrderingActive !== 'boolean') {
          existing.onlineOrderingActive = seedStore.onlineOrderingActive ?? true;
          existing.deliveryFee = seedStore.deliveryFee ?? 15;
          existing.minOrderAmount = seedStore.minOrderAmount ?? 45;
          existing.estimatedDeliveryMinutes = seedStore.estimatedDeliveryMinutes ?? 35;
          existing.whatsappOrdersNumber = seedStore.whatsappOrdersNumber || seedStore.phone;
        }
      }
    }
    // Sync primary customer 3-Card System fields
    const cust1 = db.customers.get('cust-1');
    if (cust1) {
      if (typeof cust1.accountPointsBalance !== 'number') {
        cust1.accountPointsBalance = INITIAL_CUSTOMER.accountPointsBalance ?? 350;
      }
      if (!cust1.accountCardCode) {
        cust1.accountCardCode = INITIAL_CUSTOMER.accountCardCode || 'AADA-VIP-8841';
      }
      if (!Array.isArray(cust1.accountTransfers)) {
        cust1.accountTransfers = structuredClone(INITIAL_CUSTOMER.accountTransfers || []);
      }
      for (const initCard of INITIAL_CUSTOMER.cards) {
        const found = cust1.cards.find(
          (c) =>
            c.id === initCard.id ||
            (c.storeId === initCard.storeId && c.rule.type === initCard.rule.type)
        );
        if (!found) {
          cust1.cards.push(structuredClone(initCard));
        } else {
          if (!found.cardName) found.cardName = initCard.cardName;
          if (!found.badgeText) found.badgeText = initCard.badgeText;
          if (!found.cardSpacing) found.cardSpacing = initCard.cardSpacing;
          if (!found.cardPattern) found.cardPattern = initCard.cardPattern;
        }
      }
      cust1.totalPointsAcrossAllStores = computeDerivedCustomerTotalPoints(cust1.cards);
    }
    if (!db.customers.has('cust-2')) {
      db.customers.set('cust-2', {
        ...structuredClone(INITIAL_CUSTOMER),
        id: 'cust-2',
        firstName: 'سارة',
        lastName: 'الدوسري',
        username: 'sara',
        email: 'sara@example.com',
        phone: '+966559876543',
        qrKeyId: 'qrk-cust-2',
        referralCode: 'SARA2026',
        accountCardCode: 'AADA-VIP-9920',
        accountPointsBalance: 190,
        accountTransfers: [],
        cards: [],
        vouchers: [],
      });
    }
    if (!db.siteSettings) {
      db.siteSettings = structuredClone(INITIAL_SITE_SETTINGS);
    }
    if (!Array.isArray(db.environments)) {
      db.environments = structuredClone(INITIAL_ENVIRONMENTS);
    }
    if (!Array.isArray(db.visitorLogs)) {
      db.visitorLogs = structuredClone(INITIAL_VISITOR_LOGS);
    }
    if (!Array.isArray(db.orders)) {
      db.orders = structuredClone(INITIAL_ORDERS);
    }
  }
  return globalThis.__AADA_CANONICAL_DB__;
}

