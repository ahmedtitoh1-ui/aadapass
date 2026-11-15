import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { appendAuditLog, enforcePolicy } from '@/lib/server/policy';
import type { PlatformFeatureFlags } from '@/lib/types';

const FLAG_LABELS: Record<keyof PlatformFeatureFlags, string> = {
  webPass: 'بطاقات الويب الرقمية الذكية (Web-Pass)',
  socialAuth: 'دخول Google / iCloud السريع',
  onlinePayments: 'الدفع الإلكتروني المباشر',
  sharedNetwork: 'شبكة المكافآت المشتركة',
  geoProximity: 'تنبيهات القرب الجغرافي',
};

export async function GET(req: NextRequest) {
  const auth = enforcePolicy(req, 'admin.featureFlags.get');
  if (!auth.ok) return auth.response;

  const db = getDb();
  return NextResponse.json({ featureFlags: db.featureFlags });
}

export async function PATCH(req: NextRequest) {
  const auth = enforcePolicy(req, 'admin.featureFlags.update');
  if (!auth.ok) return auth.response;
  const { user, ip } = auth.ctx;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Partial<PlatformFeatureFlags> | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'بيانات الميزات غير صالحة.' }, { status: 400 });
  }

  const db = getDb();
  const prev = { ...db.featureFlags };
  const next: PlatformFeatureFlags = { ...db.featureFlags };
  const changedLabels: string[] = [];
  const oldParts: string[] = [];
  const newParts: string[] = [];

  (Object.keys(FLAG_LABELS) as (keyof PlatformFeatureFlags)[]).forEach((key) => {
    if (typeof body[key] === 'boolean' && body[key] !== prev[key]) {
      next[key] = body[key] as boolean;
      changedLabels.push(FLAG_LABELS[key]);
      oldParts.push(`${FLAG_LABELS[key]}: ${prev[key] ? 'مفعل' : 'معطل'}`);
      newParts.push(`${FLAG_LABELS[key]}: ${next[key] ? 'مفعل' : 'معطل'}`);
    }
  });

  if (changedLabels.length === 0) {
    return NextResponse.json({ featureFlags: db.featureFlags });
  }

  db.featureFlags = next;
  const auditLog = appendAuditLog({
    actorName: `${user.firstName} ${user.lastName}`,
    actorRole: user.role,
    action: 'تغيير مفاتيح الميزات (Feature Flags)',
    target: changedLabels.join('، '),
    oldValue: oldParts.join(' | '),
    newValue: newParts.join(' | '),
    ip,
  });

  return NextResponse.json({ featureFlags: db.featureFlags, auditLog });
}
