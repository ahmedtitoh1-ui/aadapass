import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { AuditLog, SessionUser, UserRole } from '@/lib/types';
import { getDb, ServerUserRecord } from './db';
import {
  generateRefreshToken,
  hashToken,
  REFRESH_TOKEN_TTL_SECONDS,
  signAccessToken,
  verifyAccessToken,
} from './crypto';
import { ROUTE_POLICIES } from './routePolicies';
import { checkRateLimit } from './rateLimit';
import { rlsCanAccessMerchant } from './rls';
import { AR_TRANSLATIONS } from '@/lib/i18n/ar';

export const REFRESH_COOKIE_NAME = 'aada_refresh';
export const ACCESS_COOKIE_NAME = 'aada_access';

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const raw = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || '127.0.0.1';
  return raw.replace(/^::ffff:/i, '');
}

export function toSessionUser(record: ServerUserRecord): SessionUser {
  return {
    id: record.id,
    username: record.username,
    firstName: record.firstName,
    lastName: record.lastName,
    email: record.email,
    phone: record.phone,
    role: record.role,
    merchantId: record.merchantId,
    branchId: record.branchId,
    branchIds: record.branchIds || (record.branchId ? [record.branchId] : undefined),
    mustChangePassword: Boolean(record.mustChangePassword),
    tokenVersion: record.tokenVersion,
  };
}

export function authenticateRequest(req: NextRequest): SessionUser | null {
  const authHeader = req.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const cookieAccessToken = req.cookies.get(ACCESS_COOKIE_NAME)?.value || null;
  const token = bearerToken || cookieAccessToken;

  if (!token) return null;
  const payload = verifyAccessToken(token);
  if (!payload) return null;

  const db = getDb();
  const user = db.users.find((u) => u.id === payload.sub);
  if (!user) return null;

  // Enforce global session revocation ("logout all devices")
  if (user.tokenVersion !== payload.tv) {
    return null;
  }

  return toSessionUser(user);
}

export function requireRole(user: SessionUser | null, allowedRoles: UserRole[] | 'PUBLIC' | 'AUTHENTICATED'): NextResponse | null {
  if (allowedRoles === 'PUBLIC') return null;
  if (!user) {
    return NextResponse.json({ error: AR_TRANSLATIONS.security.unauthorized }, { status: 401 });
  }
  if (allowedRoles === 'AUTHENTICATED') return null;
  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json(
      { error: AR_TRANSLATIONS.security.forbiddenRole, requiredRoles: allowedRoles, actualRole: user.role },
      { status: 403 }
    );
  }
  return null;
}

export function requireScope(
  user: SessionUser | null,
  merchantId?: string | null,
  branchId?: string | null
): NextResponse | null {
  if (!user) {
    return NextResponse.json({ error: AR_TRANSLATIONS.security.unauthorized }, { status: 401 });
  }
  if (user.role === 'PLATFORM_ADMIN' || user.role === 'SUPPORT_AGENT') {
    return null;
  }
  if (merchantId && !rlsCanAccessMerchant(user, merchantId, branchId || undefined)) {
    return NextResponse.json(
      { error: AR_TRANSLATIONS.security.forbiddenScope, merchantId, branchId },
      { status: 403 }
    );
  }
  return null;
}

export interface PolicyContext {
  user: SessionUser | null;
  ip: string;
  policyKey: string;
}

export type EnforcePolicyResult =
  | { ok: true; ctx: PolicyContext }
  | { ok: false; response: NextResponse };

export function enforcePolicy(
  req: NextRequest,
  policyKey: keyof typeof ROUTE_POLICIES,
  scopeTargets?: { merchantId?: string | null; branchId?: string | null }
): EnforcePolicyResult {
  const policy = ROUTE_POLICIES[policyKey];
  if (!policy) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Route policy configuration missing on server.' }, { status: 500 }),
    };
  }

  const ip = getClientIp(req);
  const rate = checkRateLimit(`${ip}:${policyKey}`, policy.rateLimitMax ?? 100, 60_000);
  if (!rate.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: AR_TRANSLATIONS.security.rateLimited, retryAfterSeconds: rate.retryAfterSeconds },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
      ),
    };
  }

  const user = authenticateRequest(req);
  const roleError = requireRole(user, policy.allowedRoles);
  if (roleError) {
    return { ok: false, response: roleError };
  }

  // Optional IP Allowlist enforcement for PLATFORM_ADMIN when configured in Admin Security settings
  if (user?.role === 'PLATFORM_ADMIN' && policyKey.startsWith('admin.')) {
    const db = getDb();
    const allowlist = db.adminSecurity?.ipAllowlist || [];
    if (allowlist.length > 0 && !allowlist.includes(ip)) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: `تم رفض وصول مدير المنصة: عنوان IP (${ip}) غير مدرج في قائمة السماح.`,
            clientIp: ip,
          },
          { status: 403 }
        ),
      };
    }
  }

  if (scopeTargets?.merchantId || scopeTargets?.branchId) {
    const scopeError = requireScope(user, scopeTargets.merchantId, scopeTargets.branchId);
    if (scopeError) {
      return { ok: false, response: scopeError };
    }
  }

  return { ok: true, ctx: { user, ip, policyKey } };
}

export function issueSessionTokens(user: ServerUserRecord, familyId?: string) {
  const db = getDb();
  const accessToken = signAccessToken({
    sub: user.id,
    username: user.username,
    role: user.role,
    merchantId: user.merchantId,
    branchId: user.branchId,
    branchIds: user.branchIds,
    tv: user.tokenVersion,
  });

  const rawRefresh = generateRefreshToken();
  const tokenHash = hashToken(rawRefresh);
  db.refreshTokens.set(tokenHash, {
    tokenHash,
    userId: user.id,
    tokenVersion: user.tokenVersion,
    expiresAt: Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000,
    revoked: false,
    familyId: familyId || crypto.randomUUID(),
  });

  return { accessToken, rawRefresh };
}

export function isHttpsRequest(req?: NextRequest): boolean {
  if (req) {
    const forwardedProto = req.headers.get('x-forwarded-proto');
    if (forwardedProto) {
      return forwardedProto.split(',')[0].trim().toLowerCase() === 'https';
    }
    if (req.nextUrl?.protocol === 'https:') return true;
  }
  return process.env.NODE_ENV === 'production';
}

export function attachSessionCookies(
  res: NextResponse,
  accessToken: string,
  rawRefresh: string,
  req?: NextRequest
): NextResponse {
  const secure = isHttpsRequest(req);
  const sameSite = secure ? 'none' : 'lax';
  res.cookies.set(REFRESH_COOKIE_NAME, rawRefresh, {
    httpOnly: true,
    sameSite,
    secure,
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
  res.cookies.set(ACCESS_COOKIE_NAME, accessToken, {
    httpOnly: true,
    sameSite,
    secure,
    path: '/',
    maxAge: 15 * 60,
  });
  return res;
}

export function clearSessionCookies(res: NextResponse): NextResponse {
  res.cookies.delete(REFRESH_COOKIE_NAME);
  res.cookies.delete(ACCESS_COOKIE_NAME);
  return res;
}

export function appendAuditLog(params: {
  actorName: string;
  actorRole: UserRole | 'SYSTEM';
  action: string;
  target: string;
  oldValue?: string;
  newValue?: string;
  ip: string;
}): AuditLog {
  const db = getDb();
  const entry: AuditLog = {
    id: `log-${crypto.randomUUID().slice(0, 8)}`,
    user: params.actorName,
    actorRole: params.actorRole,
    action: params.action,
    target: params.target,
    oldValue: params.oldValue,
    newValue: params.newValue,
    ip: params.ip,
    timestamp: new Date().toLocaleString('ar-SA', { hour12: true }),
  };
  db.auditLogs.unshift(entry);
  return entry;
}
