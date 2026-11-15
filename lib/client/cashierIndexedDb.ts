import { LoyaltyRule, MarketCurrency } from '@/lib/types';

export interface PassDirectoryRecord {
  merchantId: string;
  storeId: string;
  storeName: string;
  currency: MarketCurrency;
  publicKeyJwk: JsonWebKey;
  revokedQrKeyIds: string[];
  activeRuleVersion: number;
  loyaltyRule: LoyaltyRule;
  branches: Array<{ id: string; name: string; city: string }>;
  limits: {
    maxTxAmount: number;
    dailyCustomerCap: number;
    dailyCashierCap: number;
    offlineCustomerHourlyCapPoints: number;
    offlineCustomerHourlyMaxScans: number;
  };
  syncedAt: number;
}

export interface QueuedOfflineTx {
  clientTxId: string;
  merchantId: string;
  branchId: string;
  branchName: string;
  qrToken: string;
  qrKeyId: string;
  nonce: string;
  invoiceNumber: string;
  amount: number;
  type: 'purchase' | 'stamp';
  estimatedPoints: number;
  currency: MarketCurrency;
  createdAt: number;
}

export interface NeedsReviewTx extends QueuedOfflineTx {
  reason: string;
  reviewCode?: string;
  failedAt: number;
}

interface OfflineEarnLogEntry {
  id: string;
  qrKeyId: string;
  points: number;
  createdAt: number;
}

const DB_NAME = 'aada_cashier_db';
const DB_VERSION = 1;

function openCashierDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('passDirectory')) {
        db.createObjectStore('passDirectory', { keyPath: 'merchantId' });
      }
      if (!db.objectStoreNames.contains('usedNonces')) {
        db.createObjectStore('usedNonces', { keyPath: 'nonce' });
      }
      if (!db.objectStoreNames.contains('offlineEarnLog')) {
        db.createObjectStore('offlineEarnLog', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'clientTxId' });
      }
      if (!db.objectStoreNames.contains('needsReview')) {
        db.createObjectStore('needsReview', { keyPath: 'clientTxId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

async function idbGetAll<T>(storeName: string): Promise<T[]> {
  try {
    const db = await openCashierDb();
    return await new Promise<T[]>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as T[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

async function idbGet<T>(storeName: string, key: string): Promise<T | null> {
  try {
    const db = await openCashierDb();
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbPut<T>(storeName: string, value: T): Promise<void> {
  try {
    const db = await openCashierDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Fallback silent ignore if quota/private mode blocks IDB
  }
}

async function idbDelete(storeName: string, key: string): Promise<void> {
  try {
    const db = await openCashierDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore
  }
}

export async function savePassDirectory(directory: PassDirectoryRecord): Promise<void> {
  await idbPut('passDirectory', directory);
}

export async function getPassDirectory(merchantId: string): Promise<PassDirectoryRecord | null> {
  return idbGet<PassDirectoryRecord>('passDirectory', merchantId);
}

export async function getSyncQueue(): Promise<QueuedOfflineTx[]> {
  const rows = await idbGetAll<QueuedOfflineTx>('syncQueue');
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getNeedsReviewList(): Promise<NeedsReviewTx[]> {
  const rows = await idbGetAll<NeedsReviewTx>('needsReview');
  return rows.sort((a, b) => b.failedAt - a.failedAt);
}

export async function removeFromSyncQueue(clientTxId: string): Promise<void> {
  await idbDelete('syncQueue', clientTxId);
}

export async function dismissNeedsReview(clientTxId: string): Promise<void> {
  await idbDelete('needsReview', clientTxId);
}

export async function moveToNeedsReview(
  tx: QueuedOfflineTx,
  reason: string,
  reviewCode?: string
): Promise<void> {
  await idbDelete('syncQueue', tx.clientTxId);
  const record: NeedsReviewTx = {
    ...tx,
    reason,
    reviewCode,
    failedAt: Date.now(),
  };
  await idbPut('needsReview', record);
}

export async function isNonceUsedOffline(nonce: string): Promise<boolean> {
  const existing = await idbGet<{ nonce: string }>('usedNonces', nonce);
  return Boolean(existing);
}

export async function checkOfflineHourlyCap(
  qrKeyId: string,
  pointsToAdd: number,
  directory: PassDirectoryRecord
): Promise<{ ok: boolean; reason?: string }> {
  const logs = await idbGetAll<OfflineEarnLogEntry>('offlineEarnLog');
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const recent = logs.filter((l) => l.qrKeyId === qrKeyId && l.createdAt >= oneHourAgo);

  const scanCount = recent.length;
  const totalPts = recent.reduce((sum, l) => sum + l.points, 0);

  if (scanCount >= directory.limits.offlineCustomerHourlyMaxScans) {
    return {
      ok: false,
      reason: `تم تجاوز حد مسح الأوفلاين لهذا العميل (${directory.limits.offlineCustomerHourlyMaxScans} عمليات/ساعة).`,
    };
  }
  if (totalPts + pointsToAdd > directory.limits.offlineCustomerHourlyCapPoints) {
    return {
      ok: false,
      reason: `تم تجاوز الحد الساعي للنقاط أوفلاين لهذا العميل (${directory.limits.offlineCustomerHourlyCapPoints} نقطة/ساعة).`,
    };
  }
  return { ok: true };
}

export async function enqueueOfflineEarn(tx: QueuedOfflineTx): Promise<void> {
  await idbPut('syncQueue', tx);
  if (tx.nonce) {
    await idbPut('usedNonces', { nonce: tx.nonce, usedAt: Date.now() });
  }
  await idbPut<OfflineEarnLogEntry>('offlineEarnLog', {
    id: tx.clientTxId,
    qrKeyId: tx.qrKeyId,
    points: tx.estimatedPoints,
    createdAt: tx.createdAt,
  });
}

function base64UrlToUint8Array(b64u: string): Uint8Array {
  const padded = b64u.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64u.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

export interface OfflineQrVerificationResult {
  valid: boolean;
  qrKeyId?: string;
  nonce?: string;
  exp?: number;
  cryptoVerified?: boolean;
  reason?: string;
}

export async function verifyOfflineAp1Token(
  token: string,
  directory: PassDirectoryRecord
): Promise<OfflineQrVerificationResult> {
  const parts = token.trim().split('.');
  if (parts.length !== 5) {
    return { valid: false, reason: 'صيغة رمز QR غير مطابقة لمعيار AP1.' };
  }
  const [prefix, customerRef, expStr, nonce, sig] = parts;
  if (prefix !== 'AP1' || !customerRef.startsWith('R_') || !nonce || !sig) {
    return { valid: false, reason: 'ترويسة رمز QR غير صالحة.' };
  }
  const qrKeyId = customerRef.slice(2);
  const exp = Number(expStr);
  if (!Number.isFinite(exp)) {
    return { valid: false, reason: 'توقيت انتهاء صلاحية الرمز غير صالح.' };
  }

  if (directory.revokedQrKeyIds.includes(qrKeyId)) {
    return { valid: false, reason: 'هذا الرمز ملغى ومُدرج في قائمة الإبطال المحلية (فقدت هاتفي).' };
  }

  const usedOffline = await isNonceUsedOffline(nonce);
  if (usedOffline) {
    return { valid: false, reason: 'تم مسح هذا الرمز (Nonce) مسبقاً أوفلاين — يرجى تحديث رمز العميل.' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (exp < nowSec) {
    return { valid: false, reason: 'انتهت صلاحية رمز QR المؤقت؛ يرجى تحديث الرمز من شاشة العميل.' };
  }

  let cryptoVerified = false;
  if (typeof window !== 'undefined' && window.crypto?.subtle && directory.publicKeyJwk) {
    try {
      const publicKey = await window.crypto.subtle.importKey(
        'jwk',
        directory.publicKeyJwk,
        { name: 'Ed25519' },
        false,
        ['verify']
      );
      const unsignedBytes = new TextEncoder().encode(`${prefix}.${customerRef}.${expStr}.${nonce}`);
      const sigBytes = base64UrlToUint8Array(sig);
      const ok = await window.crypto.subtle.verify(
        { name: 'Ed25519' },
        publicKey,
        sigBytes.buffer as ArrayBuffer,
        unsignedBytes
      );
      if (!ok) {
        return { valid: false, reason: 'توقيع Ed25519 غير مطابق لمفتاح Pass Directory المحلي.' };
      }
      cryptoVerified = true;
    } catch {
      // Some environments do not expose Ed25519 in WebCrypto; server performs full Ed25519 check on sync
      cryptoVerified = false;
    }
  }

  return {
    valid: true,
    qrKeyId,
    nonce,
    exp,
    cryptoVerified,
  };
}
