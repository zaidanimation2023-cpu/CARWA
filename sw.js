// ===================================================
//  كروة PWA - Service Worker
//  الإصدار: 2.0  |  يدعم الكاش + الإشعارات + الخلفية
// ===================================================

const CACHE_NAME = 'carwa-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/customer.html',
  '/driver.html',
  '/admin.html',
  '/manifest.json',
  '/assets/logo.png',
  // Bootstrap RTL
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css',
  // Fonts
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap',
  // FontAwesome
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
];

// ---- تثبيت وتحميل الكاش ----
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { mode: 'no-cors' })));
    }).then(() => self.skipWaiting())
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

  // تجاهل Firebase و Google APIs (دائماً تحتاج شبكة)
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
        // احفظ في الكاش إذا نجح الطلب
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // إذا انقطع الإنترنت، استخدم الكاش
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // صفحة بديلة عند انقطاع الإنترنت
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// ---- استقبال الإشعارات (Push Notifications) ----
self.addEventListener('push', event => {
  let data = { title: 'كروة', body: 'لديك تحديث جديد', icon: '/assets/logo.png' };
  try { data = { ...data, ...event.data.json() }; } catch(e) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/assets/logo.png',
      badge: '/assets/icon-72.png',
      vibrate: [200, 100, 200],
      dir: 'rtl',
      lang: 'ar',
      tag: data.tag || 'carwa-notification',
      renotify: true,
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
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) return client.focus();
      }
      return clients.openWindow(targetUrl);
    })
  );
});

// ---- مزامنة في الخلفية (Background Sync) ----
self.addEventListener('sync', event => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncPendingOrders());
  }
});

async function syncPendingOrders() {
  // يمكن تطويره لاحقاً لرفع الطلبات المعلقة عند عودة الإنترنت
  console.log('[SW] Background sync triggered');
}
