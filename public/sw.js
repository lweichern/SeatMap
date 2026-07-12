// Greeter PWA service worker: cache-first for everything same-origin so the
// check-in app keeps working (and reloading) with zero bars.
const CACHE = 'seatmap-greeter-v1'

self.addEventListener('install', (e) => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request)
      // network-first for navigations when online (fresh app), cache fallback offline
      if (e.request.mode === 'navigate') {
        try {
          const fresh = await fetch(e.request)
          cache.put(e.request, fresh.clone())
          return fresh
        } catch {
          return cached ?? Response.error()
        }
      }
      // static assets: cache-first, backfill from network
      if (cached) return cached
      try {
        const fresh = await fetch(e.request)
        if (fresh.ok) cache.put(e.request, fresh.clone())
        return fresh
      } catch {
        return Response.error()
      }
    }),
  )
})
