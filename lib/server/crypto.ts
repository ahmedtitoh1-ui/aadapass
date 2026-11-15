import crypto from 'crypto';
import { UserRole } from '@/lib/types';

// In production, load from process.env.JWT_SECRET; fallback is ephemeral process-wide secret
const JWT_SECRET =
  process.env.JWT_SECRET || crypto.createHmac('sha256', 'aada-pass-runtime').update(process.cwd()).digest('hex');

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // Short-lived 15m JWT
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7d rotating httpOnly refresh token

export interface AccessTokenPayload {
  sub: string;
  username: string;
  role: UserRole;
  merchantId?: string;
  branchId?: string;
  branchIds?: string[];
  tv: number; // tokenVersion for global logout-all invalidation
  iat: number;
  exp: number;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

export function signAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp'>): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: AccessTokenPayload = {
    ...payload,
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_SECONDS,
  };
  const body = base64UrlEncode(JSON.stringify(fullPayload));
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest();
  return `${header}.${body}.${base64UrlEncode(sig)}`;
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expectedSig = base64UrlEncode(crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest());
    if (sig.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return null;
    }
    const decoded = JSON.parse(base64UrlDecode(body)) as AccessTokenPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!decoded.exp || decoded.exp < now) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('base64url');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function hashPassword(password: string, salt?: string): string {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, usedSalt, 10000, 32, 'sha256').toString('hex');
  return `${usedSalt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, originalHash] = stored.split(':');
  if (!salt || !originalHash) return false;
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256').toString('hex');
  if (hash.length !== originalHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(originalHash));
}

export interface Ed25519QrVerification {
  valid: boolean;
  customerRef?: string;
  qrKeyId?: string;
  exp?: number;
  nonce?: string;
  reason?: string;
}

declare global {
  var __aadaEd25519Keys:
    | {
        publicKey: crypto.KeyObject;
        privateKey: crypto.KeyObject;
      }
    | undefined;
}

function getEd25519Keys() {
  if (!globalThis.__aadaEd25519Keys) {
    globalThis.__aadaEd25519Keys = crypto.generateKeyPairSync('ed25519');
  }
  return globalThis.__aadaEd25519Keys;
}

export function getEd25519PublicJwk(): JsonWebKey {
  const { publicKey } = getEd25519Keys();
  return publicKey.export({ format: 'jwk' }) as JsonWebKey;
}

export function issueEd25519QrToken(params: {
  qrKeyId: string;
  ttlSeconds?: number;
}): {
  token: string;
  signature: string;
  issuedAt: number;
  expiresAt: number;
  ttlSeconds: number;
} {
  const ttlSeconds = Math.max(60, Math.min(120, params.ttlSeconds ?? 90));
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + ttlSeconds;
  // Opaque reference contains ZERO customer PII and ZERO points balance
  const customerRef = `R_${params.qrKeyId}`;
  const nonce = crypto.randomBytes(6).toString('base64url');
  const unsigned = `AP1.${customerRef}.${expiresAt}.${nonce}`;
  const { privateKey } = getEd25519Keys();
  const sig = base64UrlEncode(crypto.sign(null, Buffer.from(unsigned, 'utf8'), privateKey));

  return {
    token: `${unsigned}.${sig}`,
    signature: sig,
    issuedAt,
    expiresAt,
    ttlSeconds,
  };
}

export function verifyEd25519QrToken(
  token: string,
  options?: { allowOfflineGrace?: boolean }
): Ed25519QrVerification {
  try {
    const parts = token.trim().split('.');
    if (parts.length !== 5) {
      return { valid: false, reason: 'صيغة رمز QR غير مطابقة لمعيار AP1.' };
    }
    const [prefix, customerRef, expStr, nonce, sig] = parts;
    if (prefix !== 'AP1' || !customerRef.startsWith('R_') || !nonce || !sig) {
      return { valid: false, reason: 'ترويسة رمز QR غير صالحة.' };
    }
    const exp = Number(expStr);
    if (!Number.isFinite(exp)) {
      return { valid: false, reason: 'توقيت انتهاء صلاحية رمز QR غير صالح.' };
    }

    const unsigned = `${prefix}.${customerRef}.${expStr}.${nonce}`;
    const { publicKey } = getEd25519Keys();
    const paddedSig = sig.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (sig.length % 4)) % 4);
    const ok = crypto.verify(
      null,
      Buffer.from(unsigned, 'utf8'),
      publicKey,
      Buffer.from(paddedSig, 'base64')
    );

    if (!ok) {
      return { valid: false, reason: 'فشل التحقق من توقيع Ed25519 لرمز QR.' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (options?.allowOfflineGrace) {
      // Allow up to 24h offline sync window after QR issuance/exp
      if (now - exp > 24 * 60 * 60) {
        return { valid: false, reason: 'تجاوز رمز QR المزامن أوفلاين الحد الأقصى (24 ساعة).' };
      }
    } else if (exp < now) {
      return { valid: false, reason: 'انتهت صلاحية رمز QR المؤقت؛ يرجى تحديثه من شاشة العميل.' };
    }

    return {
      valid: true,
      customerRef,
      qrKeyId: customerRef.slice(2),
      exp,
      nonce,
    };
  } catch {
    return { valid: false, reason: 'تعذر فك تشفير والتحقق من رمز QR.' };
  }
}

export function signQrPayload(token: string): string {
  const { privateKey } = getEd25519Keys();
  return `Ed25519:${base64UrlEncode(crypto.sign(null, Buffer.from(token, 'utf8'), privateKey)).slice(0, 22)}`;
}

