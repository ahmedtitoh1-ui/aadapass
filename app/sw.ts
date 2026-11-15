import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';

declare global {
  interface Window {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

interface PushNotificationPayload {
  title?: string;
  body?: string;
  url?: string;
}

const swScope = self as unknown as {
  addEventListener: (type: string, listener: (event: unknown) => void) => void;
  registration: {
    showNotification: (title: string, options?: NotificationOptions) => Promise<void>;
  };
  clients: {
    openWindow: (url: string) => Promise<unknown>;
    matchAll: (options?: { type?: 'window' | 'all' }) => Promise<Array<{ focus?: () => Promise<unknown>; url: string }>>;
  };
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

// Web Push notification handler for ready rewards, new offers, and expiry reminders
swScope.addEventListener('push', (rawEvent: unknown) => {
  const event = rawEvent as {
    data?: { json: () => PushNotificationPayload; text: () => string };
    waitUntil: (promise: Promise<unknown>) => void;
  };
  let payload: PushNotificationPayload = {
    title: 'Aada Pass - عادة باس',
    body: 'لديك تحديث جديد في محفظة الولاء الخاصة بك!',
    url: '/',
  };
  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch {
    if (event.data) {
      payload.body = event.data.text() || payload.body;
    }
  }

  event.waitUntil(
    swScope.registration.showNotification(payload.title || 'Aada Pass', {
      body: payload.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      dir: 'rtl',
      lang: 'ar',
      data: { url: payload.url || '/' },
    })
  );
});

swScope.addEventListener('notificationclick', (rawEvent: unknown) => {
  const event = rawEvent as {
    notification: { close: () => void; data?: { url?: string } };
    waitUntil: (promise: Promise<unknown>) => void;
  };
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    swScope.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(targetUrl) && client.focus) {
          return client.focus();
        }
      }
      return swScope.clients.openWindow(targetUrl);
    })
  );
});

serwist.addEventListeners();
