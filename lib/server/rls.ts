import {
  AuditLog,
  SessionUser,
  Store,
  SupportTicket,
  Transaction,
} from '@/lib/types';
import { isStoreSubscriptionPaused } from '@/lib/subscriptionStatus';

/**
 * Row-Level Security (RLS) server predicates enforcing strict tenant & customer isolation.
 * Customers only read their own rows (and public active directory store summaries).
 * Cashiers and Merchant Managers/Owners only read/write rows carrying their own merchant_id.
 */
export function rlsCanAccessMerchant(user: SessionUser | null, merchantId: string, branchId?: string): boolean {
  if (!user) return false;
  if (user.role === 'PLATFORM_ADMIN' || user.role === 'SUPPORT_AGENT') return true;
  if (user.role === 'CUSTOMER') return false;
  if (!user.merchantId || user.merchantId !== merchantId) return false;

  if ((user.role === 'CASHIER' || user.role === 'MERCHANT_MANAGER') && branchId) {
    const allowedBranches =
      user.branchIds && user.branchIds.length > 0 ? user.branchIds : user.branchId ? [user.branchId] : [];
    if (allowedBranches.length > 0 && !allowedBranches.includes(branchId)) {
      return false;
    }
  }
  return true;
}

/**
 * Explicit withTenant guard enforcing merchant_id (and optional branch_id) isolation for route handlers.
 */
export function withTenant<T>(
  user: SessionUser | null,
  merchantId: string,
  fn: (scope: { user: SessionUser; merchantId: string; allowedBranchIds: string[] }) => T,
  branchId?: string
): { ok: true; data: T } | { ok: false; status: number; error: string } {
  if (!user) {
    return { ok: false, status: 401, error: 'يجب تسجيل الدخول أولاً.' };
  }
  if (!rlsCanAccessMerchant(user, merchantId, branchId)) {
    return { ok: false, status: 403, error: 'صلاحيات العزل (Tenant RLS) لا تسمح بالوصول إلى هذا المتجر أو الفرع.' };
  }
  const allowedBranchIds =
    user.branchIds && user.branchIds.length > 0 ? user.branchIds : user.branchId ? [user.branchId] : [];
  return { ok: true, data: fn({ user, merchantId, allowedBranchIds }) };
}

export function rlsFilterStoresForUser(stores: Store[], user: SessionUser | null): Store[] {
  if (!user || user.role === 'CUSTOMER') {
    // Visitors & Customers see active, unpaused stores; targeted vouchers are scoped to recipient customers
    return stores
      .filter((s) => s.status === 'active' && !isStoreSubscriptionPaused(s))
      .map((s) => ({
        ...s,
        cashiers: [],
        campaigns: s.campaigns.filter((c) => c.active),
        vouchers: (s.vouchers || []).filter(
          (v) =>
            v.active &&
            (v.audienceType !== 'specific' ||
              (user?.role === 'CUSTOMER' && (v.targetCustomerIds || []).includes(user.id)))
        ),
      }));
  }
  if (user.role === 'PLATFORM_ADMIN' || user.role === 'SUPPORT_AGENT') {
    return stores;
  }
  // Strict merchant_id isolation for CASHIER / MERCHANT_MANAGER / MERCHANT_OWNER
  return stores.filter((s) => s.merchantId === user.merchantId);
}

export function rlsFilterTransactions(transactions: Transaction[], user: SessionUser | null): Transaction[] {
  if (!user) return [];
  if (user.role === 'PLATFORM_ADMIN' || user.role === 'SUPPORT_AGENT') return transactions;
  if (user.role === 'CUSTOMER') {
    return transactions.filter((t) => t.customerId === user.id);
  }
  if (user.role === 'CASHIER') {
    const allowedBranches =
      user.branchIds && user.branchIds.length > 0 ? user.branchIds : user.branchId ? [user.branchId] : [];
    return transactions.filter(
      (t) =>
        t.merchantId === user.merchantId &&
        t.cashierId === user.id &&
        (allowedBranches.length === 0 || allowedBranches.includes(t.branchId))
    );
  }
  if (user.role === 'MERCHANT_MANAGER') {
    const allowedBranches =
      user.branchIds && user.branchIds.length > 0 ? user.branchIds : user.branchId ? [user.branchId] : [];
    return transactions.filter(
      (t) =>
        t.merchantId === user.merchantId &&
        (allowedBranches.length === 0 || allowedBranches.includes(t.branchId))
    );
  }
  return transactions.filter((t) => t.merchantId === user.merchantId);
}

export function rlsFilterTickets(tickets: SupportTicket[], user: SessionUser | null): SupportTicket[] {
  if (!user) return [];
  if (user.role === 'PLATFORM_ADMIN' || user.role === 'SUPPORT_AGENT') return tickets;
  if (user.role === 'CUSTOMER') {
    return tickets.filter((t) => t.customerId === user.id || t.userType === 'عميل');
  }
  return tickets.filter((t) => t.merchantId === user.merchantId);
}

export function rlsFilterAuditLogs(logs: AuditLog[], user: SessionUser | null): AuditLog[] {
  if (!user) return [];
  if (user.role === 'PLATFORM_ADMIN' || user.role === 'SUPPORT_AGENT') return logs;
  return [];
}
