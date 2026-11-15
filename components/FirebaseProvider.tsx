'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  auth,
  FIREBASE_VAPID_KEY,
  requestFcmWebPushToken,
  subscribeToForegroundMessages,
  testFirestoreConnection,
} from '@/lib/firebase';

interface FirebaseContextValue {
  firebaseUser: User | null;
  isAuthReady: boolean;
  fcmToken: string | null;
  fcmPermission: NotificationPermission | 'unsupported';
  vapidKey: string;
  enableWebPush: () => Promise<{
    token: string | null;
    permission: NotificationPermission | 'unsupported';
    error?: string;
  }>;
}

const FirebaseContext = createContext<FirebaseContextValue>({
  firebaseUser: null,
  isAuthReady: false,
  fcmToken: null,
  fcmPermission: 'default',
  vapidKey: FIREBASE_VAPID_KEY,
  enableWebPush: async () => ({ token: null, permission: 'default' }),
});

export function useFirebase() {
  return useContext(FirebaseContext);
}

export default function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [fcmPermission, setFcmPermission] = useState<NotificationPermission | 'unsupported'>('default');

  const enableWebPush = useCallback(async () => {
    const res = await requestFcmWebPushToken();
    setFcmPermission(res.permission);
    if (res.token) {
      setFcmToken(res.token);
    }
    return res;
  }, []);

  useEffect(() => {
    void testFirestoreConnection();

    if (typeof window !== 'undefined') {
      if (!('Notification' in window)) {
        setFcmPermission('unsupported');
      } else {
        setFcmPermission(Notification.permission);
        try {
          const cached = window.localStorage.getItem('aada_fcm_token');
          if (cached) setFcmToken(cached);
        } catch {
          // ignore
        }
      }

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker
          .register('/firebase-messaging-sw.js', { scope: '/' })
          .catch(() => {
            // silent fallback in restricted iframe
          });
      }
    }

    let unsubscribeMessaging: (() => void) | null = null;
    void subscribeToForegroundMessages((payload) => {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const title = payload.notification?.title || payload.data?.title || 'تنبيه فوري — عادة باس';
        const body = payload.notification?.body || payload.data?.body || 'لديك عرض جغرافي جديد بالقرب منك!';
        try {
          new Notification(title, {
            body,
            icon: '/pwa-192x192.png',
          });
        } catch {
          // ignore
        }
      }
    }).then((unsub) => {
      unsubscribeMessaging = unsub;
    });

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setIsAuthReady(true);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeMessaging) unsubscribeMessaging();
    };
  }, []);

  return (
    <FirebaseContext.Provider
      value={{
        firebaseUser,
        isAuthReady,
        fcmToken,
        fcmPermission,
        vapidKey: FIREBASE_VAPID_KEY,
        enableWebPush,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
}
