import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { enforcePolicy } from '@/lib/server/policy';
import type { ManagedUserRecord } from '@/lib/types';

export async function GET(req: NextRequest) {
  const auth = enforcePolicy(req, 'admin.users.list');
  if (!auth.ok) return auth.response;

  const db = getDb();
  const safeUsers: ManagedUserRecord[] = db.users.map((u) => ({
    id: u.id,
    username: u.username,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    phone: u.phone,
    role: u.role,
    merchantId: u.merchantId,
    branchId: u.branchId,
    failedAttempts: u.failedAttempts,
    lockedUntil: u.lockedUntil,
    tokenVersion: u.tokenVersion,
  }));

  return NextResponse.json({ users: safeUsers });
}
