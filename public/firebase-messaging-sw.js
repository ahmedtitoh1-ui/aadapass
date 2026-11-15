/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/11.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.4.0/firebase-messaging-compat.js');

firebase.initializeApp({
  projectId: 'gen-lang-client-0519701915',
  appId: '1:123196774522:web:cd30518c31e257eca603c3',
  apiKey: 'AIzaSyD0EmOpwCZHvlFzftAT02NeANtGoMj9F2M',
  authDomain: 'gen-lang-client-0519701915.firebaseapp.com',
  storageBucket: 'gen-lang-client-0519701915.firebasestorage.app',
  messagingSenderId: '123196774522',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle =
    (payload && payload.notification && payload.notification.title) ||
    (payload && payload.data && payload.data.title) ||
    'تنبيه جديد من عادة باس (Aada Pass)';
  const notificationOptions = {
    body:
      (payload && payload.notification && payload.notification.body) ||
      (payload && payload.data && payload.data.body) ||
      'لديك عرض جغرافي أو تحديث حالة طلب جديد بالقرب منك.',
    icon:
      (payload && payload.notification && payload.notification.icon) ||
      '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    dir: 'rtl',
    lang: 'ar',
    data: (payload && payload.data) || { url: '/customer' },
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification &&
      event.notification.data &&
      event.notification.data.url) ||
    '/customer';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if ('focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
