const CACHE_NAME = 'aivisualpro-v2'
const STATIC_ASSETS = [
  '/favicon.ico',
  '/logo-192.png',
  '/logo-512.png',
  '/manifest.json',
]

// Install: cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    }),
  )
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name)),
      )
    }).then(() => self.clients.claim()),
  )
})

// Fetch: network-first strategy
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET')
    return

  // Let the browser handle page loads / redirects natively
  if (event.request.mode === 'navigate')
    return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache clean 200 responses (no redirects, no opaque redirects)
        if (
          response.status === 200
          && response.type !== 'opaqueredirect'
          && !response.redirected
        ) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone)
          })
        }
        return response
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request)
      }),
  )
})
