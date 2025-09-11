// Service Worker for claret.tech
const CACHE_NAME = "claret-tech-v1";
const urlsToCache = [
  "/",
  "/fonts/Agustina.woff",
  "/fonts/Montserrat-Regular.ttf",
  "/site.webmanifest",
];

// Install event - cache resources
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache resources individually with better error handling
      const cachePromises = urlsToCache.map(async (url) => {
        try {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response);
          } else {
            // Silently skip resources that don't exist or return errors
            // This prevents console spam for missing optional resources
          }
        } catch {
          // Silently skip network failures
          // This prevents console spam during offline installs
        }
      });

      await Promise.allSettled(cachePromises);
    }),
  );
});

// Fetch event - serve from cache when possible
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Cache hit - return response
      if (response) {
        return response;
      }

      // Clone the request
      const fetchRequest = event.request.clone();

      return fetch(fetchRequest).then((response) => {
        // Check if valid response
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        // Cache images, fonts, and animations
        if (
          event.request.url.includes("/images/") ||
          event.request.url.includes("/fonts/") ||
          event.request.url.includes("/animations/")
        ) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }

        return response;
      });
    }),
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  const cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
});
