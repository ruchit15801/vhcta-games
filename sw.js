/* ─── VHCTA Games — Performance Service Worker v8 ─── */
const CACHE_NAME    = 'vhcta-v8';
const FONT_CACHE    = 'vhcta-fonts-v8';
const IMG_CACHE     = 'vhcta-images-v8';

// Core shell — always cache-first
const SHELL_ASSETS = [
    '/',
    '/index.html',
    '/game-details.html',
    '/about.html',
    '/contact.html',
    '/privacy.html',
    '/terms.html',
    '/css/style.css',
    '/js/main.js',
    '/js/details.js',
    '/js/security.js',
    '/manifest.json',
];

// ── Install: pre-cache app shell ──
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(SHELL_ASSETS))
            .then(() => self.skipWaiting())  // activate immediately
    );
});

// ── Activate: purge old caches ──
self.addEventListener('activate', event => {
    const VALID = [CACHE_NAME, FONT_CACHE, IMG_CACHE];
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => !VALID.includes(k)).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())  // take control immediately
    );
});

// ── Fetch: smart routing ──
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // 1. Google Fonts — Cache-first (long-lived)
    if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
        event.respondWith(cacheFirst(event.request, FONT_CACHE));
        return;
    }

    // 2. Game thumbnails / images — Stale-while-revalidate
    if (
        event.request.destination === 'image' ||
        url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/i)
    ) {
        event.respondWith(staleWhileRevalidate(event.request, IMG_CACHE));
        return;
    }

    // 3. Game Data — Network-First (so new games show up instantly)
    if (url.pathname.endsWith('/js/games.js')) {
        event.respondWith(networkFirst(event.request, CACHE_NAME));
        return;
    }

    // 4. App shell (HTML/CSS/JS) — Cache-first
    if (
        event.request.destination === 'document' ||
        event.request.destination === 'script'   ||
        event.request.destination === 'style'
    ) {
        event.respondWith(cacheFirst(event.request, CACHE_NAME));
        return;
    }

    // 4. Everything else — Network with fallback to cache
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});

// ── Strategy: Cache-First ──
async function cacheFirst(request, cacheName) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const fresh = await fetch(request);
    if (fresh && fresh.status === 200) {
        const cache = await caches.open(cacheName);
        cache.put(request, fresh.clone());
    }
    return fresh;
}

// ── Strategy: Stale-While-Revalidate ──
async function staleWhileRevalidate(request, cacheName) {
    const cache  = await caches.open(cacheName);
    const cached = await cache.match(request);

    const fetchPromise = fetch(request).then(fresh => {
        if (fresh && fresh.status === 200) {
            cache.put(request, fresh.clone());
        }
        return fresh;
    }).catch(() => cached);

    return cached || fetchPromise;
}

// ── Strategy: Network-First ──
async function networkFirst(request, cacheName) {
    try {
        const fresh = await fetch(request);
        if (fresh && fresh.status === 200) {
            const cache = await caches.open(cacheName);
            cache.put(request, fresh.clone());
        }
        return fresh;
    } catch (e) {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw e;
    }
}
