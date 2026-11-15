import { NextRequest, NextResponse } from 'next/server';
import { computeAdminOverview, computeDerivedCustomerTotalPoints, getDb } from '@/lib/server/db';
import { enforcePolicy } from '@/lib/server/policy';
import {
  rlsFilterAuditLogs,
  rlsFilterStoresForUser,
  rlsFilterTickets,
  rlsFilterTransactions,
} from '@/lib/server/rls';
import { maskCommercialReg, maskEmail, maskPhone } from '@/lib/server/auth';
import type { ManagedUserRecord } from '@/lib/types';

export async function GET(req: NextRequest) {
  const guard = enforcePolicy(req, 'me.get');
  if (!guard.ok) return guard.response;

  const user = guard.ctx.user!;
  const db = getDb();

  const isSupport = user.role === 'SUPPORT_AGENT';
  const isAdmin = user.role === 'PLATFORM_ADMIN';

  const rawStores = rlsFilterStoresForUser(db.stores, user);
  const stores = isSupport
    ? rawStores.map((s) => ({
        ...s,
        phone: maskPhone(s.phone),
        commercialReg: maskCommercialReg(s.commercialReg),
      }))
    : rawStores;

  const customerProfile = user.role === 'CUSTOMER' ? db.customers.get(user.id) || null : null;
  if (customerProfile) {
    customerProfile.totalPointsAcrossAllStores = computeDerivedCustomerTotalPoints(
      customerProfile.cards
    );
  }

  const customersList =
    isAdmin || isSupport
      ? Array.from(db.customers.values()).map((c) => ({
          ...c,
          phone: isSupport ? maskPhone(c.phone) : c.phone,
          email: isSupport ? maskEmail(c.email) : c.email,
        }))
      : [];

  const safeUsers: ManagedUserRecord[] =
    isAdmin || isSupport
      ? db.users.map((u) => ({
          id: u.id,
          username: u.username,
          firstName: u.firstName,
          lastName: u.lastName,
          email: isSupport ? maskEmail(u.email) : u.email,
          phone: isSupport ? maskPhone(u.phone) : u.phone,
          role: u.role,
          merchantId: u.merchantId,
          branchId: u.branchId,
          branchIds: u.branchIds,
          mustChangePassword: Boolean(u.mustChangePassword),
          failedAttempts: u.failedAttempts,
          lockedUntil: u.lockedUntil,
          tokenVersion: u.tokenVersion,
        }))
      : [];

  return NextResponse.json({
    user,
    users: safeUsers,
    customer: customerProfile,
    customers: customersList,
    stores,
    packages: db.packages,
    transactions: rlsFilterTransactions(db.transactions, user),
    tickets: rlsFilterTickets(db.tickets, user),
    financialAdjustments: isAdmin || isSupport ? db.financialAdjustments : [],
    cannedResponses: isAdmin || isSupport ? db.cannedResponses : [],
    auditLogs: rlsFilterAuditLogs(db.auditLogs, user),
    networkRules: db.networkRules,
    networkRuleVersions: isAdmin || isSupport ? db.networkRuleVersions : [],
    networkAgreements: isAdmin || isSupport ? db.networkAgreements : [],
    networkSettlements: isAdmin || isSupport ? db.networkSettlements : [],
    networkDisputes: isAdmin || isSupport ? db.networkDisputes : [],
    storeRequests: isAdmin || isSupport ? db.storeRequests : [],
    featureFlags: db.featureFlags,
    siteSettings: db.siteSettings,
    adminSecurity: isAdmin || isSupport ? db.adminSecurity : undefined,
    environments: isAdmin || isSupport ? db.environments : [],
    visitorLogs: isAdmin || isSupport ? db.visitorLogs.slice(0, 120) : [],
    overview: isAdmin || isSupport ? computeAdminOverview(db) : undefined,
  });
}
