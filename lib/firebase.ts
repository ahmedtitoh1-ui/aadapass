import { getApps, getApp, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  getMessaging,
  getToken,
  isSupported as isMessagingSupported,
  onMessage,
  type MessagePayload,
} from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

export const FIREBASE_VAPID_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ||
  'BC3P26Q4w9TI75LJlQVMaG4YTngdikwimVAP7IxZf-7y0_vi_YGIBjiS6cOd-AmNiHR3erwHJc1RogMXB3Uu3Lo';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let connectionTested = false;

export async function testFirestoreConnection(): Promise<void> {
  if (typeof window === 'undefined' || connectionTested) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

export async function signInWithGoogleFirebase() {
  const credential = await signInWithPopup(auth, googleProvider);
  const user = credential.user;
  if (user && user.emailVerified) {
    const cleanUsername = (user.email?.split('@')[0] || `user_${user.uid.slice(0, 6)}`)
      .replace(/[^a-zA-Z0-9_\-.]/g, '')
      .slice(0, 60);
    const displayName = (user.displayName || cleanUsername || 'عميل عادة باس').slice(0, 110);
    const userPath = `users/${user.uid}`;
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          uid: user.uid,
          username: cleanUsername.length >= 2 ? cleanUsername : `u_${user.uid.slice(0, 6)}`,
          displayName,
          role: 'CUSTOMER',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: false }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, userPath);
    }
  }
  return user;
}

export async function signOutFirebase() {
  await signOut(auth);
}

/**
 * Registers the Firebase Cloud Messaging Service Worker and retrieves a Web Push token
 * using the configured VAPID certificate key pair.
 */
export async function requestFcmWebPushToken(): Promise<{
  token: string | null;
  permission: NotificationPermission | 'unsupported';
  error?: string;
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { token: null, permission: 'unsupported', error: 'المتصفح لا يدعم الإشعارات.' };
  }

  try {
    const supported = await isMessagingSupported();
    if (!supported) {
      return {
        token: null,
        permission: Notification.permission,
        error: 'خدمة Firebase Cloud Messaging غير مدعومة في هذه البيئة.',
      };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        token: null,
        permission,
        error: 'لم يتم منح إذن الإشعارات في المتصفح.',
      };
    }

    let swReg: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/',
      });
      await navigator.serviceWorker.ready;
    }

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (token) {
      try {
        window.localStorage.setItem('aada_fcm_token', token);
      } catch {
        // ignore storage quota errors
      }

      // Persist push token in Firestore if user is authenticated and verified
      const currentUser = auth.currentUser;
      if (currentUser && currentUser.emailVerified) {
        const cleanTokenId = `fcm_${token.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48)}`;
        const tokenDocPath = `users/${currentUser.uid}/pushTokens/${cleanTokenId}`;
        try {
          await setDoc(
            doc(db, 'users', currentUser.uid, 'pushTokens', cleanTokenId),
            {
              tokenId: cleanTokenId,
              uid: currentUser.uid,
              token: token.slice(0, 512),
              vapidKeyPrefix: FIREBASE_VAPID_KEY.slice(0, 16),
              userAgent: (navigator.userAgent || 'web').slice(0, 180),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: false }
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, tokenDocPath);
        }
      }
    }

    return { token: token || null, permission };
  } catch (err) {
    return {
      token: null,
      permission: Notification.permission,
      error: err instanceof Error ? err.message : 'تعذر تفعيل رمز إشعارات الدفع.',
    };
  }
}

/**
 * Listens for live foreground Firebase Cloud Messaging push payloads.
 */
export async function subscribeToForegroundMessages(
  onPayload: (payload: MessagePayload) => void
): Promise<(() => void) | null> {
  if (typeof window === 'undefined') return null;
  try {
    const supported = await isMessagingSupported();
    if (!supported) return null;
    const messaging = getMessaging(app);
    return onMessage(messaging, onPayload);
  } catch {
    return null;
  }
}
