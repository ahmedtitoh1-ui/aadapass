import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { appendAuditLog, enforcePolicy } from '@/lib/server/policy';
import type { AdminSecurityConfig } from '@/lib/types';

export async function GET(req: NextRequest) {
  const auth = enforcePolicy(req, 'admin.settings.get');
  if (!auth.ok) return auth.response;

  const db = getDb();
  return NextResponse.json({
    adminSecurity: db.adminSecurity,
    requesterIp: auth.ctx.ip,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = enforcePolicy(req, 'admin.settings.update');
  if (!auth.ok) return auth.response;
  const { user, ip } = auth.ctx;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Partial<AdminSecurityConfig> | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'بيانات الإعدادات غير صالحة.' }, { status: 400 });
  }

  const db = getDb();
  const prev = { ...db.adminSecurity, ipAllowlist: [...db.adminSecurity.ipAllowlist] };

  const sanitizedAllowlist = Array.isArray(body.ipAllowlist)
    ? body.ipAllowlist.map((v) => String(v).trim()).filter(Boolean)
    : prev.ipAllowlist;

  // Prevent admin from locking themselves out by adding an IP allowlist that omits their current IP
  if (sanitizedAllowlist.length > 0 && !sanitizedAllowlist.includes(ip)) {
    return NextResponse.json(
      {
        error: `للحماية من الحظر الذاتي، يجب تضمين عنوان IP الحالي (${ip}) داخل قائمة السماح.`,
      },
      { status: 400 }
    );
  }

  const next: AdminSecurityConfig = {
    mfaEnabled: typeof body.mfaEnabled === 'boolean' ? body.mfaEnabled : prev.mfaEnabled,
    ipAllowlist: sanitizedAllowlist,
    platformName:
      typeof body.platformName === 'string' && body.platformName.trim()
        ? body.platformName.trim()
        : prev.platformName,
    defaultCurrency:
      body.defaultCurrency === 'SAR' || body.defaultCurrency === 'EGP' || body.defaultCurrency === 'AED'
        ? body.defaultCurrency
        : prev.defaultCurrency,
    viewerModeEnforced:
      typeof body.viewerModeEnforced === 'boolean' ? body.viewerModeEnforced : prev.viewerModeEnforced,
  };

  db.adminSecurity = next;

  const auditLog = appendAuditLog({
    actorName: `${user.firstName} ${user.lastName}`,
    actorRole: user.role,
    action: 'تحديث إعدادات المنصة وأمان مدير النظام',
    target: 'Platform Security & Settings',
    oldValue: `MFA=${prev.mfaEnabled ? 'مفعل' : 'معطل'} | IP Allowlist=[${prev.ipAllowlist.join(', ') || 'الكل'}] | Currency=${prev.defaultCurrency}`,
    newValue: `MFA=${next.mfaEnabled ? 'مفعل' : 'معطل'} | IP Allowlist=[${next.ipAllowlist.join(', ') || 'الكل'}] | Currency=${next.defaultCurrency}`,
    ip,
  });

  return NextResponse.json({
    adminSecurity: db.adminSecurity,
    requesterIp: ip,
    auditLog,
  });
}
