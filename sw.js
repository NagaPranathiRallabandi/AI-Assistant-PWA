const CACHE_NAME = 'assistant-cache-v1';
const urlsToCache = ['/', 'index.html', 'style.css', 'script.js', 'icon-512.png'];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(urlsToCache))));
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));