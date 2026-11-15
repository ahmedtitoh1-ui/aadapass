export type UserRole =
  | 'CUSTOMER'
  | 'CASHIER'
  | 'MERCHANT_MANAGER'
  | 'MERCHANT_OWNER'
  | 'PLATFORM_ADMIN'
  | 'SUPPORT_AGENT';

export type MarketCurrency = 'SAR' | 'EGP' | 'AED';

export type SubscriptionPlanName =
  | 'Free'
  | 'Starter'
  | 'Growth'
  | 'Business'
  | 'Enterprise'
  | 'Viewer';

export type TicketWorkflowStatus =
  | 'جديدة'
  | 'قيد المعالجة'
  | 'بانتظار العميل'
  | 'محلولة'
  | 'مفتوحة'
  | 'قيد المراجعة'
  | 'تم الحل';

export type DisputeCategory = 'نقاط' | 'فواتير' | 'مكافآت';

export interface SessionUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  merchantId?: string;
  branchId?: string;
  branchIds?: string[];
  mustChangePassword?: boolean;
  tokenVersion: number;
}

export interface ManagedUserRecord {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  merchantId?: string;
  branchId?: string;
  branchIds?: string[];
  mustChangePassword?: boolean;
  failedAttempts: number;
  lockedUntil: number | null;
  tokenVersion: number;
}

export interface PointTier {
  minAmount: number;
  maxAmount: number;
  points: number;
  tierCalcMode?: 'points' | 'percentage';
  rewardType?: 'points' | 'percentage';
  percentageRate?: number;
}

export type StampShape =
  | 'coffee'
  | 'star'
  | 'heart'
  | 'check'
  | 'crown'
  | 'gift'
  | 'sparkles'
  | 'flame'
  | 'diamond'
  | 'utensils'
  | 'scissors'
  | 'shopping-bag'
  | 'zap'
  | 'award'
  | 'moon'
  | 'shield'
  | 'smile'
  | 'leaf';

export type CardSpacingPreset = 'compact' | 'normal' | 'relaxed' | 'spacious' | 'ultra';

export type CardPatternStyle =
  | 'none'
  | 'dots'
  | 'grid'
  | 'waves'
  | 'luxury'
  | 'diamonds'
  | 'arabesque'
  | 'prism'
  | 'rings'
  | 'aurora';

export type LoyaltySystemCardCategory = 'store_stamps' | 'store_points' | 'account_master';

export interface AccountPointTransfer {
  id: string;
  type: 'share_to_store' | 'gift_to_user' | 'convert_to_voucher' | 'admin_grant';
  points: number;
  targetName: string;
  targetId?: string;
  timestamp: string;
  note?: string;
}

export type PointsCalcMode = 'per_amount' | 'percentage' | 'tiers';

export interface LoyaltyRule {
  type: 'points' | 'stamps';
  rewardDescription?: string;
  stampsRequired?: number;
  stampShape?: StampShape;
  pointsCalcMode?: PointsCalcMode;
  pointsPerUnit?: number;
  currencyUnitAmount?: number;
  percentageRate?: number;
  rewardTargetPoints?: number;
  pointRules?: PointTier[];
  maxRedemption?: number;
}

export interface Branch {
  id: string;
  merchantId: string;
  name: string;
  city: string;
  area: string;
  address: string;
  phone: string;
  lat?: number;
  lng?: number;
  crowdLevel?: 'هادئ' | 'متوسط' | 'مزدحم';
  visitorsCount?: number;
  branchRule?: LoyaltyRule;
  geofenceRadiusMeters?: number;
  proximityAlertMessage?: string;
  activeOfferBadge?: string;
}

export interface MenuItem {
  id: string;
  merchantId: string;
  name: string;
  type: 'product' | 'service' | 'offer';
  category: string;
  price: number;
  currency: MarketCurrency;
  image: string;
  description: string;
  available: boolean;
  branches: string[];
  expiryDate?: string;
}

export interface LoyaltyProgram {
  id: string;
  merchantId: string;
  name: string;
  type: 'points' | 'stamps';
  currency: MarketCurrency;
  startDate: string;
  endDate: string;
  branches: string[];
  includedItems: string;
  minInvoiceAmount: number;
  pointRules?: PointTier[];
  stampsRequired?: number;
  rewardValue: string;
  pointsExpiryDays: number;
  maxRedemption: number;
  allowStacking: boolean;
  status: 'فعال' | 'متوقف';
  version: number;
}

export interface ProgramVersionSnapshot {
  version: number;
  programId: string;
  programName: string;
  currency: MarketCurrency;
  summary: string;
  savedAt: string;
  savedBy: string;
}

export interface MerchantVoucher {
  id: string;
  merchantId: string;
  code: string;
  title: string;
  discountText: string;
  pointsCost: number;
  usageLimit: number;
  usedCount: number;
  branches: string[];
  expiryDate: string;
  active: boolean;
  audienceType?: 'all' | 'specific';
  targetCustomerIds?: string[];
  targetCustomerNames?: string[];
}

export interface StoreCardDesign {
  id: string;
  name: string;
  cardTitle?: string;
  description?: string;
  badgeText?: string;
  loyaltyRule: LoyaltyRule;
  cardColor: string;
  cardBgColor?: string;
  cardAccentColor?: string;
  cardBackgroundImage?: string;
  cardTextColor?: string;
  cardSpacing?: CardSpacingPreset;
  cardPattern?: CardPatternStyle;
  cardCategory?: LoyaltySystemCardCategory;
  cardLogoPos?: 'right' | 'center' | 'left';
  cardSizeMode?: 'compact' | 'standard' | 'tall';
  cardElementsPos?: 'top' | 'bottom';
  secondaryLogo?: string;
  wifiPassword?: string;
  instagramUrl?: string;
  showPassWifi?: boolean;
  showPassInstagram?: boolean;
  isDefault: boolean;
  active?: boolean;
  isActive?: boolean;
  printedCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface PartnerPointShare {
  id: string;
  merchantId?: string;
  partnerStoreId: string;
  partnerStoreName: string;
  partnerStoreCategory?: string;
  partnerCategory?: string;
  partnerCity?: string;
  pointsToShare: number;
  minCustomerPoints?: number;
  minInvoiceAmount?: number;
  maxPointsPerTransaction: number;
  monthlyPointsCap: number;
  sharedSoFar?: number;
  usedPointsThisMonth?: number;
  direction: 'both' | 'send_only' | 'receive_only' | 'bidirectional' | 'outgoing' | 'incoming';
  expiresAt: string;
  active: boolean;
  notes?: string;
  createdAt: string;
}

export interface MarketingCampaign {
  id: string;
  merchantId: string;
  title: string;
  targetAudience:
    | 'العملاء الجدد'
    | 'الزيارة الثالثة'
    | 'غير النشطين (+30 يوم)'
    | 'أيام محددة (نقاط مضاعفة)'
    | 'عرض مشترك شبكة عادة';
  discountOrBonus: string;
  budgetLimit: number;
  spentSoFar: number;
  endDate: string;
  customersAcquired: number;
  networkRedemptions: number;
  discountCost: number;
  networkReturnRate: number;
  scheduledMode: 'instant' | 'bullmq_daily';
  active: boolean;
}

export interface CashierStaff {
  id: string;
  userId?: string;
  merchantId: string;
  name: string;
  username: string;
  role: 'CASHIER' | 'MERCHANT_MANAGER';
  branchId: string;
  branchIds?: string[];
  branchName: string;
  permissions: string[];
  active: boolean;
  mustChangePassword?: boolean;
}

export interface FraudAlert {
  id: string;
  merchantId: string;
  branchId: string;
  branchName: string;
  cashierId: string;
  cashierName: string;
  customerName: string;
  invoiceNumber: string;
  reason: string;
  timestamp: string;
  resolved: boolean;
}

export interface VisitorSeriesPoint {
  label: string;
  digitalVisitors: number;
  verifiedPurchases: number;
}

export interface StoreMetrics {
  digitalVisitors: number;
  verifiedPurchases: number;
  activeCards: number;
  monthlySales: number;
  pointsGranted?: number;
  rewardsRedeemed?: number;
  refundLossTotal?: number;
  retentionRate: number;
  newCustomers: number;
  returningCustomers: number;
  inactiveCustomers: number;
  avgVisits: number;
  redemptionRate: number;
  repeatPurchaseRate: number;
}

export type StoreCategory = 'كافيه' | 'مطعم' | 'حلويات ومخبوزات' | 'عطور وتجميل' | 'أزياء' | 'لياقة وسبا' | 'تجزئة' | 'خدمات' | 'ترفيه' | string;

export interface Store {
  id: string;
  slug?: string;
  merchantId: string;
  name: string;
  logo: string;
  secondaryLogo?: string;
  cover: string;
  fullMenuImage?: string;
  menuImages?: string[];
  storeGallery?: string[];
  category: 'كافيه' | 'مطعم' | 'صالون' | 'متجر' | string;
  description: string;
  city: string;
  area: string;
  address: string;
  phone: string;
  workingHours?: string;
  wifiPassword?: string;
  instagramUrl?: string;
  googleMapLink: string;
  commercialReg?: string;
  subscriptionPlan: SubscriptionPlanName;
  subscriptionExpiry: string;
  subscriptionState?: 'active' | 'grace' | 'readonly';
  status: 'active' | 'pending' | 'suspended';
  verifiedOwnership: boolean;
  createdAt?: string;
  trialDaysGranted?: number;
  trialStartedAt?: string;
  trialEndsAt?: string;
  requestedPlan?: SubscriptionPlanName;
  ownerName?: string;
  ownerEmail?: string;
  currency: MarketCurrency;
  branches: Branch[];
  menu: MenuItem[];
  programs: LoyaltyProgram[];
  programVersions: ProgramVersionSnapshot[];
  vouchers: MerchantVoucher[];
  campaigns: MarketingCampaign[];
  cashiers: CashierStaff[];
  loyaltyRule: LoyaltyRule;
  maxTxAmount?: number;
  dailyCustomerCap?: number;
  dailyCashierCap?: number;
  absenceReminderDays?: number;
  fraudAlerts?: FraudAlert[];
  cardColor: string;
  cardTextColor?: string;
  cardDesigns?: StoreCardDesign[];
  partnerPointShares?: PartnerPointShare[];
  visitorSeries: VisitorSeriesPoint[];
  metrics: StoreMetrics;
  onlineOrderingActive?: boolean;
  deliveryFee?: number;
  minOrderAmount?: number;
  estimatedDeliveryMinutes?: number;
  whatsappOrdersNumber?: string;
}

export interface PublicBranchDTO {
  name: string;
  city: string;
  area: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  crowdLevel?: 'هادئ' | 'متوسط' | 'مزدحم';
  geofenceRadiusMeters?: number;
  proximityAlertMessage?: string;
}

export interface PublicMenuItemDTO {
  name: string;
  type: 'product' | 'service' | 'offer';
  category: string;
  price: number;
  currency: MarketCurrency;
  image: string;
  description: string;
  available: boolean;
  expiryDate?: string;
}

export interface PublicStoreDTO {
  slug: string;
  name: string;
  logo: string;
  cover: string;
  fullMenuImage?: string;
  menuImages: string[];
  storeGallery?: string[];
  category: string;
  description: string;
  city: string;
  area: string;
  address: string;
  phone: string;
  wifiPassword?: string;
  instagramUrl?: string;
  googleMapLink: string;
  currency: MarketCurrency;
  isViewerOnly: boolean;
  isTemporarilyPaused?: boolean;
  pauseNotice?: string | { badgeLabel: string; customerTitle: string; customerSubtitle: string; };
  isTrial?: boolean;
  isNew?: boolean;
  createdAt?: string;
  verifiedOwnership: boolean;
  cardColor: string;
  cardTextColor?: string;
  loyaltySummary: {
    type: 'points' | 'stamps';
    rewardDescription: string;
    stampsRequired?: number;
  } | null;
  branches: PublicBranchDTO[];
  menu: PublicMenuItemDTO[];
  activeOffers: PublicMenuItemDTO[];
  onlineOrderingActive?: boolean;
  deliveryFee?: number;
  minOrderAmount?: number;
  estimatedDeliveryMinutes?: number;
  whatsappOrdersNumber?: string;
}

export interface CustomerCard {
  id: string;
  customerId: string;
  merchantId: string;
  storeId: string;
  storeName: string;
  storeLogo: string;
  cardName?: string;
  badgeText?: string;
  cardColor: string;
  cardTextColor?: string;
  cardSpacing?: CardSpacingPreset;
  cardPattern?: CardPatternStyle;
  cardCategory?: LoyaltySystemCardCategory;
  currency: MarketCurrency;
  rule: LoyaltyRule;
  currentBalance: number;
  totalEarned: number;
  isActive: boolean;
}

export interface DigitalVoucher {
  id: string;
  customerId: string;
  merchantId: string;
  storeId: string;
  storeName: string;
  code: string;
  title: string;
  pointsCost: number;
  valueAmount: number;
  currency: MarketCurrency;
  status: 'active' | 'used' | 'expired';
  createdAt: string;
  expiresAt: string;
}

export interface ExpiringPointsAlert {
  id: string;
  storeId: string;
  storeName: string;
  points: number;
  daysLeft: number;
  expiresAt: string;
}

export interface CustomerNotificationPrefs {
  readyRewardAlert: boolean;
  newOfferAlert: boolean;
  expiry14DayAlert: boolean;
  expiry3DayAlert: boolean;
  absenceReminderEnabled: boolean;
  absenceReminderDays: number;
  pushSubscribed: boolean;
  // Geolocation & proximity alerts
  geoProximityAlertsEnabled?: boolean;
  geoRadiusMeters?: number;
  geoSoundEnabled?: boolean;
  geoVibrateEnabled?: boolean;
  geoOffersOnly?: boolean;
}

export type GeofenceAlertType =
  | 'offer'
  | 'double_points'
  | 'branch_nearby'
  | 'ready_reward'
  | 'flash_deal';

export interface GeofenceAlert {
  id: string;
  storeId: string;
  storeName: string;
  storeLogo: string;
  storeSlug?: string;
  branchId: string;
  branchName: string;
  branchAddress: string;
  city: string;
  area: string;
  distanceMeters: number;
  distanceText: string;
  alertType: GeofenceAlertType;
  title: string;
  message: string;
  badgeText: string;
  offerDiscount?: string;
  offerPromoCode?: string;
  offerExpiry?: string;
  originalPrice?: number;
  offerPrice?: number;
  currency?: MarketCurrency;
  googleMapLink?: string;
  phone?: string;
  crowdLevel?: 'هادئ' | 'متوسط' | 'مزدحم';
  lat: number;
  lng: number;
  createdAt: string;
  isRead: boolean;
}

export interface CustomerProfile {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
  phoneVerified: boolean;
  marketingConsent: boolean;
  geoProximityConsent: boolean;
  totalPointsAcrossAllStores: number;
  /** Account Master Card points balance for sharing with partner stores, gifting to other accounts, or instant discounts */
  accountPointsBalance?: number;
  accountCardCode?: string;
  accountTransfers?: AccountPointTransfer[];
  cards: CustomerCard[];
  qrKeyId: string;
  qrCodeToken: string;
  qrSignature: string;
  qrIssuedAt: number;
  qrExpiresAt: number;
  qrExpiresInSeconds: number;
  referralCode: string;
  referralsCount: number;
  followedStoreIds: string[];
  vouchers: DigitalVoucher[];
  expiringPointsAlerts: ExpiringPointsAlert[];
  notificationPrefs: CustomerNotificationPrefs;
  anonymized?: boolean;
}

export interface MerchantCrmCustomerDTO {
  id: string;
  displayName: string;
  maskedPhone: string;
  visitsCount: number;
  storeBalance: number;
  totalEarnedInStore: number;
  lastVisit: string;
  segment: 'VIP' | 'عائدون' | 'جدد' | 'غير نشطين';
  currency: MarketCurrency;
}

export interface Transaction {
  id: string;
  merchantId: string;
  branchId: string;
  storeId: string;
  storeName: string;
  customerId: string;
  customerName: string;
  cashierId?: string;
  cashierName?: string;
  branchName: string;
  invoiceNumber: string;
  amount: number;
  currency: MarketCurrency;
  pointsEarned: number;
  pointsSpent?: number;
  discountGiven?: number;
  type: 'purchase' | 'redemption' | 'stamp' | 'refund';
  ruleVersion: string;
  timestamp: string;
  createdAtMs?: number;
  notes?: string;
  clientTxId?: string;
  offlineQueued?: boolean;
  fraudFlags?: string[];
  refundRequested?: boolean;
  refundRequestReason?: string;
  refundRequestedBy?: string;
  refundedTxId?: string;
  refundLoss?: number;
}

export interface SubscriptionPackage {
  id: string;
  name: SubscriptionPlanName;
  nameEn?: string;
  title: string;
  subtitle?: string;
  ctaText?: string;
  priceText: string;
  monthlyPrice: number;
  monthlyPriceEgp?: number;
  currency: MarketCurrency;
  maxBranches: number;
  maxStaff: number;
  maxCustomersPerMonth?: number;
  loyaltyEnabled: boolean;
  features: string[];
  highlighted?: boolean;
  promoText?: string;
  promoDiscountPct?: number;
  annualDiscountPct?: number;
  customPricing?: boolean;
  visibleOnLanding?: boolean;
  visibleForStores?: boolean;
  hasOnlineOrdering?: boolean;
  displayOrder?: number;
}

export type EnvironmentType = 'production' | 'staging' | 'sandbox' | 'development';

export interface PlatformEnvironment {
  id: string;
  name: string;
  slug: string;
  type: EnvironmentType;
  domainUrl: string;
  description: string;
  isActive: boolean;
  maintenanceMode: boolean;
  allowPublicRegistration: boolean;
  allowStoreOnboarding: boolean;
  apiEnabled: boolean;
  currencyScope: 'ALL' | 'EGP' | 'SAR';
  storeCategory?: string;
  storeName?: string;
  merchantId?: string;
  username?: string;
  subscriptionAmount?: number;
  expiresAt?: string;
  loginUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VisitorLog {
  id: string;
  sessionKey: string;
  visitorType: 'زائر جديد' | 'زائر عائد' | 'عميل مسجل';
  customerId?: string;
  customerName?: string;
  pagePath: string;
  storeName?: string;
  city: string;
  device: 'جوال' | 'كمبيوتر';
  currency: MarketCurrency;
  source: 'مباشر' | 'بحث جوجل' | 'QR متجر' | 'وسائل التواصل';
  timestamp: string;
  createdAtMs: number;
}

export interface AdminSecurityConfig {
  mfaEnabled: boolean;
  ipAllowlist: string[];
  platformName: string;
  defaultCurrency: MarketCurrency;
  viewerModeEnforced: boolean;
}

export interface LandingFeatureItem {
  id: string;
  title: string;
  description: string;
  icon: 'wifi-off' | 'message' | 'smartphone' | 'shield' | 'sparkles' | 'zap';
}

export interface LandingStepItem {
  id: string;
  stepNumber: string;
  title: string;
  description: string;
}

export interface LandingFaqItem {
  id: string;
  q: string;
  a: string;
}

export interface LandingCustomSection {
  id: string;
  title: string;
  subtitle?: string;
  body: string;
  imageUrl?: string | null;
  ctaText?: string;
  ctaUrl?: string;
  theme: 'light' | 'navy' | 'gold';
  isActive: boolean;
}

export interface LandingSectionVisibility {
  showMarquee: boolean;
  showProblemSolution: boolean;
  showHowItWorks: boolean;
  showFeatures: boolean;
  showPricing: boolean;
  showDirectory: boolean;
  showFaq: boolean;
  showFinalCta: boolean;
}

export type AnnouncementType = 'announcement' | 'alert' | 'offer' | 'maintenance';
export type AnnouncementPlacement = 'top_bar' | 'hero_alert' | 'floating_toast';

export interface SiteAnnouncement {
  id: string;
  title: string;
  message: string;
  type: AnnouncementType;
  placement: AnnouncementPlacement;
  linkText?: string;
  linkUrl?: string;
  colorPreset: 'navy_gold' | 'sky' | 'amber' | 'emerald' | 'rose';
  isActive: boolean;
  dismissible: boolean;
}

export interface SiteSettings {
  id: string;
  heroTitle: string;
  heroSubtitle: string;
  heroBadgeText?: string;
  heroPrimaryCta?: string;
  heroPrimaryCtaUrl?: string;
  heroSecondaryCta?: string;
  heroImageUrl?: string | null;
  heroShowcaseMode?: 'mockups' | 'image';
  isBannerActive: boolean;
  bannerText?: string | null;
  bannerLinkUrl?: string | null;
  bannerColor: string;
  announcements?: SiteAnnouncement[];
  marqueeTitle?: string;
  partnerLogos?: Array<{ name: string; tag: string }>;
  problemTitle?: string;
  problemDesc?: string;
  problemImageUrl?: string | null;
  solutionTitle?: string;
  solutionDesc?: string;
  solutionImageUrl?: string | null;
  howItWorksTitle?: string;
  howItWorksSubtitle?: string;
  steps?: LandingStepItem[];
  featuresTitle?: string;
  featuresSubtitle?: string;
  features?: LandingFeatureItem[];
  pricingTitle?: string;
  pricingSubtitle?: string;
  annualDiscountPct?: number;
  directoryTitle?: string;
  directorySubtitle?: string;
  finalCtaTitle?: string;
  finalCtaSubtitle?: string;
  finalCtaButton?: string;
  faqTitle?: string;
  faqSubtitle?: string;
  faqItems?: LandingFaqItem[];
  footerTagline?: string;
  footerCopyright?: string;
  adminWhatsappNumber?: string;
  trialDays?: number;
  customSections?: LandingCustomSection[];
  sectionVisibility?: LandingSectionVisibility;
  updatedAt?: string;
}

export interface PlatformFeatureFlags {
  webPass: boolean;
  socialAuth: boolean;
  onlinePayments: boolean;
  sharedNetwork: boolean;
  geoProximity: boolean;
}

export interface AuditLog {
  id: string;
  user: string;
  actorRole: UserRole | 'SYSTEM';
  action: string;
  target: string;
  oldValue?: string;
  newValue?: string;
  ip: string;
  timestamp: string;
}

export interface NetworkRules {
  sameStore100PtsSar: number;
  crossStore100PtsSar: number;
  pointSharingEnabled: boolean;
  pointSharingStartDate?: string;
  pointSharingEndDate?: string;
  pointSharingAllowedMerchantIds: string[];
}

export interface NetworkRuleVersion {
  version: number;
  sameStore100PtsSar: number;
  crossStore100PtsSar: number;
  pointSharingEnabled: boolean;
  pointSharingStartDate?: string;
  pointSharingEndDate?: string;
  pointSharingAllowedMerchantIds: string[];
  updatedAt: string;
  updatedBy: string;
}

export interface NetworkAgreement {
  id: string;
  merchantId: string;
  storeName: string;
  status: 'active' | 'suspended';
  revenueSharePct: number;
  signedAt: string;
}

export interface NetworkSettlement {
  id: string;
  month: string;
  merchantId: string;
  storeName: string;
  issuedPointsValue: number;
  redeemedPointsValue: number;
  netAmountSar: number;
  status: 'pending' | 'paid';
  paidAt?: string;
  attachmentName?: string;
  attachmentNote?: string;
}

export interface NetworkDispute {
  id: string;
  merchantName: string;
  settlementId?: string;
  amountSar: number;
  reason: string;
  status: 'قيد المراجعة' | 'تمت التسوية';
  resolvedBy?: string;
  createdAt?: string;
}

export interface StoreAdditionRequest {
  id: string;
  storeName: string;
  category: string;
  city: string;
  requestedAt: string;
  count: number;
}

export interface SupportTicketNote {
  id: string;
  authorName: string;
  authorRole: UserRole;
  text: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  userType: 'عميل' | 'تاجر';
  userName: string;
  subject: string;
  message: string;
  status: TicketWorkflowStatus;
  createdAt: string;
  merchantId?: string;
  storeName?: string;
  customerId?: string;
  customerPhoneMasked?: string;
  invoiceRef?: string;
  relatedTransactionId?: string;
  disputeCategory?: DisputeCategory;
  priority?: 'عالية' | 'متوسطة' | 'عادية';
  slaHours?: number;
  slaDeadlineAt?: string;
  assignedToName?: string;
  escalatedToAdmin?: boolean;
  notes?: SupportTicketNote[];
}

export interface FinancialAdjustmentRequest {
  id: string;
  ticketId: string;
  storeId: string;
  storeName: string;
  customerId: string;
  customerName: string;
  originalTransactionId: string;
  requestedPointsDelta: number;
  requestedAmountSar: number;
  reason: string;
  requestedByAgentName: string;
  status: 'pending_admin' | 'approved' | 'rejected';
  createdAt: string;
  reviewedByAdminName?: string;
  reviewedAt?: string;
  reversalTransactionId?: string;
}

export interface CannedResponse {
  id: string;
  title: string;
  category: DisputeCategory | 'عام';
  body: string;
}

export interface AdminOverviewDTO {
  totalStores: number;
  activeStores: number;
  pendingStores: number;
  suspendedStores: number;
  viewerStores: number;
  totalCustomers: number;
  totalPointsIssued: number;
  totalPointsRedeemed: number;
  monthlyPlatformRevenueSar: number;
  activeSubscriptionsCount: number;
  overdueSubscriptionsCount: number;
  periodComparison: Array<{
    period: string;
    storesCount: number;
    pointsIssued: number;
    pointsRedeemed: number;
    revenueSar: number;
  }>;
}

export type OrderType = 'DELIVERY' | 'PICKUP';

export type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'COMPLETED'
  | 'REJECTED';

export interface OrderItem {
  menuItemId: string;
  title: string;
  quantity: number;
  price: number;
  selectedOption?: string;
  notes?: string;
}

export interface OnlineOrder {
  id: string;
  orderNumber: string;
  storeId: string;
  storeName: string;
  merchantId: string;
  branchId: string;
  branchName: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  orderType: OrderType;
  deliveryAddress?: string;
  pickupTime?: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  currency: MarketCurrency;
  status: OrderStatus;
  paymentMethod: 'CASH_ON_DELIVERY' | 'CARD_ON_DELIVERY' | 'PAY_AT_BRANCH';
  customerNotes?: string;
  merchantNotes?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  whatsappMessage?: string;
}

