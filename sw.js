// ===================================================
//  كروة PWA - Service Worker v3.0
//  الإصدار: 3.0 | كاش + إشعارات خلفية كاملة
// ===================================================

const CACHE_NAME = 'carwa-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/customer.html',
  '/driver.html',
  '/admin.html',
  '/manifest.json',
  '/assets/logo.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
];

// ---- أيقونات لكل نوع إشعار ----
const NOTIF_ICONS = {
  newOrder:      '/assets/logo.png',
  accepted:      '/assets/logo.png',
  cancelled:     '/assets/logo.png',
  driverArrived: '/assets/logo.png',
  chat:          '/assets/logo.png',
  completed:     '/assets/logo.png',
  orderSent:     '/assets/logo.png',
  tripStarted:   '/assets/logo.png',
  alert:         '/assets/logo.png',
};

// ---- أنماط الاهتزاز لكل نوع ----
const VIBRATIONS = {
  newOrder:      [500,150,500,150,500,150,700],
  accepted:      [200,100,200,100,300],
  cancelled:     [400,150,400],
  driverArrived: [300,100,300,100,400],
  chat:          [100,50,100],
  completed:     [200,100,200,100,400],
  orderSent:     [150,80,150],
  tripStarted:   [200,100,300],
  alert:         [200],
};

// ---- تثبيت وتحميل الكاش ----
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(STATIC_ASSETS.map(url => new Request(url, { mode: 'no-cors' })))
    ).then(() => self.skipWaiting())
  );
});

// ---- تنشيط وحذف الكاش القديم ----
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ---- استراتيجية الشبكة أولاً ثم الكاش ----
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('google.com') ||
    event.request.method !== 'GET'
  ) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.destination === 'document') return caches.match('/index.html');
        })
      )
  );
});

// ---- استقبال رسائل من الصفحة (للإشعارات الداخلية) ----
self.addEventListener('message', event => {
  const data = event.data;
  if (!data || data.type !== 'SHOW_NOTIFICATION') return;

  const { title, body, notifType = 'alert', url = '/' } = data;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:    NOTIF_ICONS[notifType] || '/assets/logo.png',
      badge:   '/assets/logo.png',
      vibrate: VIBRATIONS[notifType] || [200],
      dir:     'rtl',
      lang:    'ar',
      tag:     notifType,
      renotify: true,
      requireInteraction: ['newOrder', 'accepted', 'driverArrived', 'cancelled'].includes(notifType),
      data: { url, notifType }
    })
  );
});

// ---- استقبال Push من السيرفر ----
self.addEventListener('push', event => {
  let data = { title: 'كروة 🚕', body: 'لديك تحديث جديد', notifType: 'alert', url: '/' };
  try { Object.assign(data, event.data.json()); } catch(e) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:     data.body,
      icon:     NOTIF_ICONS[data.notifType] || '/assets/logo.png',
      badge:    '/assets/logo.png',
      vibrate:  VIBRATIONS[data.notifType] || [200],
      dir:      'rtl',
      lang:     'ar',
      tag:      data.notifType || 'carwa',
      renotify: true,
      requireInteraction: ['newOrder','accepted','driverArrived','cancelled'].includes(data.notifType),
      data: { url: data.url || '/' }
    })
  );
});

// ---- الضغط على الإشعار يفتح التطبيق ----
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // إذا التطبيق مفتوح، ركّز عليه
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      // إذا كان مغلقاً، افتحه
      return clients.openWindow(targetUrl);
    })
  );
});

// ---- مزامنة في الخلفية ----
self.addEventListener('sync', event => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncPendingOrders());
  }
});

async function syncPendingOrders() {
  console.log('[SW] Background sync triggered');
}

