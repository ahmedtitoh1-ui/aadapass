import { getDb } from '@/lib/server/db';
import { verifyEd25519QrToken } from '@/lib/server/crypto';
import type { CustomerProfile } from '@/lib/types';

export interface CustomerResolutionResult {
  ok: true;
  customer: CustomerProfile;
  viaSignedQr: boolean;
  nonce?: string;
}

export interface CustomerResolutionError {
  ok: false;
  status: number;
  error: string;
  reviewCode: string;
}

function normalizePhoneDigits(val: string): string {
  const digits = val.replace(/\D/g, '');
  if (digits.startsWith('966') && digits.length >= 12) return digits.slice(3);
  if (digits.startsWith('20') && digits.length >= 12) return digits.slice(2);
  if (digits.startsWith('0') && digits.length >= 10) return digits.slice(1);
  return digits;
}

export function resolveCustomerForCashier(
  rawIdentifier: string,
  options: { consumeNonce?: boolean; allowOfflineGrace?: boolean } = {}
): CustomerResolutionResult | CustomerResolutionError {
  const db = getDb();
  const token = rawIdentifier.trim();

  if (!token) {
    return {
      ok: false,
      status: 400,
      error: 'يرجى مسح باركود العميل أو إدخال رمز العميل أولاً.',
      reviewCode: 'MISSING_QR',
    };
  }

  if (token.startsWith('AP1.')) {
    const verified = verifyEd25519QrToken(token, {
      allowOfflineGrace: options.allowOfflineGrace,
    });
    if (!verified.valid || !verified.qrKeyId || !verified.nonce) {
      return {
        ok: false,
        status: 401,
        error: verified.reason || 'باركود العميل غير صالح أو منتهي الصلاحية.',
        reviewCode: 'INVALID_QR_SIGNATURE',
      };
    }
    if (db.revokedQrKeyIds.has(verified.qrKeyId)) {
      return {
        ok: false,
        status: 401,
        error: 'تم إبطال هذا الرمز عبر إجراء أمان (فقدت هاتفي) أو حذف الحساب.',
        reviewCode: 'REVOKED_KEY',
      };
    }
    if (db.usedQrNonces.has(verified.nonce)) {
      return {
        ok: false,
        status: 409,
        error: 'تم استخدام رمز QR هذا مسبقاً؛ يرجى تحديث الرمز من شاشة العميل.',
        reviewCode: 'REUSED_NONCE',
      };
    }
    const customer = Array.from(db.customers.values()).find(
      (c) => c.qrKeyId === verified.qrKeyId && !c.anonymized
    );
    if (!customer) {
      return {
        ok: false,
        status: 401,
        error: 'تم إبطال هذا الرمز أو الحساب غير متاح.',
        reviewCode: 'REVOKED_KEY',
      };
    }
    if (options.consumeNonce) {
      db.usedQrNonces.add(verified.nonce);
    }
    return { ok: true, customer, viaSignedQr: true, nonce: verified.nonce };
  }

  const normalizedCode = token.replace(/^@/, '').toLowerCase();
  const normalizedPhone = normalizePhoneDigits(token);

  const customer = Array.from(db.customers.values()).find((c) => {
    if (c.anonymized) return false;
    if (c.qrCodeToken === token) return true;
    if (c.id.toLowerCase() === normalizedCode) return true;
    if (c.username.toLowerCase() === normalizedCode) return true;
    if (c.referralCode && c.referralCode.toLowerCase() === normalizedCode) return true;
    if (normalizedPhone.length >= 8 && normalizePhoneDigits(c.phone) === normalizedPhone) {
      return true;
    }
    return false;
  });

  if (!customer) {
    return {
      ok: false,
      status: 404,
      error: 'لم يتم العثور على عميل مطابق لهذا الباركود أو الرمز. تأكد من الرمز أو اطلب مسح QR.',
      reviewCode: 'INVALID_QR',
    };
  }

  return { ok: true, customer, viaSignedQr: false };
}
