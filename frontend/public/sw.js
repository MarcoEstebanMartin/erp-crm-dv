const SHELL_CACHE = 'dv-pwa-shell-v1';
const MEDIA_CACHE = 'dv-pwa-media-v1';
const MAX_MEDIA_ENTRIES = 260;

const CORE_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/logo-don-venancio.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(CORE_SHELL_URLS))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== MEDIA_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const overflow = keys.length - maxEntries;
  for (let i = 0; i < overflow; i++) {
    await cache.delete(keys[i]);
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Seguridad estricta: jamás cachear endpoints autenticados /api/* ni módulos HMR de Vite
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname === '/api' ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/')
  ) {
    return;
  }

  // 1. Navegaciones SPA: Network-First con fallback instantáneo a index.html local
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const copy = networkRes.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put('/index.html', copy));
          }
          return networkRes;
        })
        .catch(async () => {
          const cachedShell =
            (await caches.match('/index.html')) || (await caches.match('/'));
          return cachedShell || Response.error();
        }),
    );
    return;
  }

  // 2. Fotos de productos y logos: Stale-While-Revalidate con tope de memoria
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/uploads/products/') || url.pathname.startsWith('/brands/'))
  ) {
    event.respondWith(
      caches.open(MEDIA_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then((res) => {
            if (res && res.ok) {
              cache.put(request, res.clone()).then(() => trimCache(MEDIA_CACHE, MAX_MEDIA_ENTRIES));
            }
            return res;
          })
          .catch(() => cached);
        return cached || networkPromise;
      }),
    );
    return;
  }

  // 3. Bundles JS/CSS con hash de Vite e íconos del mismo origen: Cache-First con actualización
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const res = await fetch(request);
        if (res && res.ok) {
          cache.put(request, res.clone());
        }
        return res;
      }),
    );
  }
});
