import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { verifyPassword } from '@/lib/server/crypto';
import {
  appendAuditLog,
  attachSessionCookies,
  enforcePolicy,
  isHttpsRequest,
  issueSessionTokens,
  toSessionUser,
} from '@/lib/server/policy';
import { AR_TRANSLATIONS } from '@/lib/i18n/ar';
import { UserRole } from '@/lib/types';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const guard = enforcePolicy(req, 'auth.login');
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const identifier = typeof body.identifier === 'string' ? body.identifier.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const demoRole = typeof body.demoRole === 'string' ? (body.demoRole as UserRole) : undefined;

  const db = getDb();

  // Allow signing into one of the 6 isolated demo accounts cleanly via explicit role selection or credentials
  let user = db.users.find(
    (u) =>
      u.username.toLowerCase() === identifier ||
      u.email.toLowerCase() === identifier ||
      u.phone.toLowerCase() === identifier
  );

  if (!user && demoRole && !identifier) {
    user = db.users.find((u) => u.role === demoRole);
  }

  if (!user) {
    return NextResponse.json({ error: 'بيانات الدخول غير صحيحة.' }, { status: 401 });
  }

  if (user.lockedUntil && user.lockedUntil > Date.now()) {
    const minutesLeft = Math.max(1, Math.ceil((user.lockedUntil - Date.now()) / 60000));
    return NextResponse.json(
      { error: `${AR_TRANSLATIONS.security.accountLocked} (${minutesLeft} دقيقة متبقية)` },
      { status: 423 }
    );
  }

  // Verify password when password is provided; or allow demo quick sign-in ONLY when explicit demoQuickSignIn flag is passed without wrong password
  const isDemoQuick = body.demoQuickSignIn === true && !password;
  if (!isDemoQuick && !verifyPassword(password, user.passwordHash)) {
    user.failedAttempts += 1;
    if (user.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      user.lockedUntil = Date.now() + LOCK_DURATION_MS;
      user.failedAttempts = 0;
      appendAuditLog({
        actorName: user.username,
        actorRole: user.role,
        action: 'قفل حساب مؤقت (محاولات دخول فاشلة)',
        target: `@${user.username}`,
        oldValue: 'نشط',
        newValue: 'مقفل 15 دقيقة',
        ip: guard.ctx.ip,
      });
      return NextResponse.json({ error: AR_TRANSLATIONS.security.accountLocked }, { status: 423 });
    }
    return NextResponse.json(
      {
        error: `كلمة المرور غير صحيحة. المحاولات المتبقية قبل القفل: ${MAX_FAILED_ATTEMPTS - user.failedAttempts}`,
      },
      { status: 401 }
    );
  }

  // PLATFORM_ADMIN extra security: optional IP Allowlist & MFA check
  if (user.role === 'PLATFORM_ADMIN') {
    const allowlist = db.adminSecurity?.ipAllowlist || [];
    if (allowlist.length > 0 && !allowlist.includes(guard.ctx.ip)) {
      appendAuditLog({
        actorName: user.username,
        actorRole: user.role,
        action: 'رفض دخول مدير المنصة (IP Allowlist)',
        target: `@${user.username}`,
        oldValue: 'غير مدرج',
        newValue: `مرفوض (${guard.ctx.ip})`,
        ip: guard.ctx.ip,
      });
      return NextResponse.json(
        { error: `تم رفض الدخول: عنوان IP (${guard.ctx.ip}) غير مدرج في قائمة السماح الإدارية.` },
        { status: 403 }
      );
    }

    if (db.adminSecurity?.mfaEnabled) {
      const mfaCode = typeof body.mfaCode === 'string' ? body.mfaCode.trim() : '';
      if (!mfaCode) {
        return NextResponse.json(
          { error: 'حساب مدير المنصة محمي بالتحقق الثنائي (MFA). يرجى إدخال رمز التوثيق.', mfaRequired: true },
          { status: 401 }
        );
      }
      if (mfaCode !== '123456' && mfaCode !== '246810') {
        return NextResponse.json(
          { error: 'رمز التحقق الثنائي (MFA) غير صحيح.', mfaRequired: true },
          { status: 401 }
        );
      }
    }
  }

  // Enforce environment status and expiration date for environment-bound accounts
  let boundEnvironment: { id: string; name: string; slug: string; expiresAt?: string } | undefined;
  if (user.environmentId) {
    const env = db.environments.find((e) => e.id === user.environmentId);
    if (!env) {
      return NextResponse.json(
        { error: 'عذراً، لم تعد بيئة التشغيل المرتبطة بهذا الحساب متاحة.' },
        { status: 403 }
      );
    }
    if (!env.isActive || env.maintenanceMode) {
      return NextResponse.json(
        {
          error: `عذراً، تم قفل البيئة (${env.name}) أو وضعها في الصيانة حالياً من قِبل مدير النظام.`,
        },
        { status: 403 }
      );
    }
    if (env.expiresAt) {
      const normalized = env.expiresAt.includes('T')
        ? env.expiresAt
        : `${env.expiresAt}T23:59:59.999Z`;
      const expiryMs = Date.parse(normalized);
      if (!Number.isNaN(expiryMs) && expiryMs < Date.now()) {
        return NextResponse.json(
          {
            error: `عذراً، انتهت صلاحية اشتراك هذه البيئة بتاريخ ${env.expiresAt}. يرجى التواصل مع مدير النظام لتجديد الصلاحية.`,
          },
          { status: 403 }
        );
      }
    }
    boundEnvironment = {
      id: env.id,
      name: env.name,
      slug: env.slug,
      expiresAt: env.expiresAt,
    };
  }

  user.failedAttempts = 0;
  user.lockedUntil = null;

  const { accessToken, rawRefresh } = issueSessionTokens(user);
  const res = NextResponse.json({
    user: toSessionUser(user),
    accessToken,
    environment: boundEnvironment,
  });

  const secure = isHttpsRequest(req);
  const sameSite = secure ? 'none' : 'lax';

  if (user.role === 'PLATFORM_ADMIN') {
    res.cookies.set('admin_role', 'SUPER_ADMIN', {
      httpOnly: true,
      sameSite,
      secure,
      path: '/',
      maxAge: 60 * 60 * 24,
    });
  } else if (user.role === 'SUPPORT_AGENT') {
    res.cookies.set('admin_role', 'SUPPORT_AGENT', {
      httpOnly: true,
      sameSite,
      secure,
      path: '/',
      maxAge: 60 * 60 * 24,
    });
  } else {
    res.cookies.delete('admin_role');
  }

  return attachSessionCookies(res, accessToken, rawRefresh, req);
}
