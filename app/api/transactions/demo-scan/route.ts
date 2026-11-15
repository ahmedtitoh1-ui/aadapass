import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { enforcePolicy } from '@/lib/server/policy';
import { issueEd25519QrToken } from '@/lib/server/crypto';

export async function GET(req: NextRequest) {
  const merchantId = req.nextUrl.searchParams.get('merchantId') || undefined;
  const branchId = req.nextUrl.searchParams.get('branchId') || undefined;

  const guard = enforcePolicy(req, 'transactions.demoScan', { merchantId, branchId });
  if (!guard.ok) return guard.response;

  const db = getDb();
  const sampleCustomer =
    Array.from(db.customers.values()).find((c) => !c.anonymized) || db.customers.get('cust-1');

  if (!sampleCustomer || !sampleCustomer.qrKeyId || sampleCustomer.anonymized) {
    return NextResponse.json({ error: 'لا يوجد رمز QR نشط للمحاكاة حالياً.' }, { status: 404 });
  }

  const qr = issueEd25519QrToken({ qrKeyId: sampleCustomer.qrKeyId, ttlSeconds: 90 });

  return NextResponse.json({
    qrToken: qr.token,
    expiresAt: qr.expiresAt,
    customerName: `${sampleCustomer.firstName} ${sampleCustomer.lastName}`,
    username: sampleCustomer.username,
  });
}
