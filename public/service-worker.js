// Service Worker for claret.tech PWA
// Version: 1.1.0 - Added offline page support

// const CACHE_NAME = "claret-tech-v1"; // Not used in current implementation
const STATIC_CACHE_NAME = "claret-tech-static-v2";
const DYNAMIC_CACHE_NAME = "claret-tech-dynamic-v2";
const API_CACHE_NAME = "claret-tech-api-v2";

// Static assets to cache on install
const STATIC_ASSETS = [
  "/",
  "/offline.html",
  "/manifest.json",
  "/favicon.ico",
  "/images/logo.webp",
  "/fonts/Agustina.woff",
  "/fonts/Montserrat-Regular.ttf",
  // Commented out animations that don't add value
  // "/animations/codingPerson.json",
  // "/animations/softwarePerson.json",
  // "/animations/studyingPerson.json",
  "/animations/graphNetworkWhiteAnimation.json",
  "/animations/graphNetworkBlueAnimation.json",
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((error) => {
        // Only log in development
        if (
          typeof process !== "undefined" &&
          process.env?.NODE_ENV === "development"
        ) {
          console.error(
            "[Service Worker] Failed to cache static assets:",
            error,
          );
        }
        // Continue installation even if some assets fail to cache
        return Promise.resolve();
      });
    }),
  );

  // Force the new service worker to activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return (
              cacheName.startsWith("claret-tech-") &&
              cacheName !== STATIC_CACHE_NAME &&
              cacheName !== DYNAMIC_CACHE_NAME &&
              cacheName !== API_CACHE_NAME
            );
          })
          .map((cacheName) => {
            // Deleting old cache
            return caches.delete(cacheName);
          }),
      );
    }),
  );

  // Take control of all pages immediately
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  const { request } = event;
  // const url = new URL(request.url); // Not used in current implementation

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!request.url.startsWith("http")) {
    return;
  }

  // Skip WebLLM model files (they have their own caching)
  if (
    request.url.includes("huggingface.co") ||
    request.url.includes("mlc.ai")
  ) {
    return;
  }

  // API requests - Network first, cache fallback
  if (request.url.includes("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone the response before caching
          const responseToCache = response.clone();

          if (response.ok) {
            caches.open(API_CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }

          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // For failed API requests, return a proper error response
            return new Response(
              JSON.stringify({
                error: "Offline",
                message: "No internet connection",
              }),
              {
                status: 503,
                headers: { "Content-Type": "application/json" },
              },
            );
          });
        }),
    );
    return;
  }

  // For navigation requests (HTML pages), use network-first strategy
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseToCache = response.clone();

          if (response.ok) {
            caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }

          return response;
        })
        .catch(() => {
          // Offline - return cached page if available
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Return offline page
            return caches.match("/offline.html");
          });
        }),
    );
    return;
  }

  // For static assets, use cache-first strategy
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return from cache, but also update cache in background
        event.waitUntil(
          fetch(request)
            .then((response) => {
              if (response.ok) {
                return caches.open(STATIC_CACHE_NAME).then((cache) => {
                  cache.put(request, response);
                });
              }
            })
            .catch(() => {
              // Network failed, but we already returned from cache
            }),
        );
        return cachedResponse;
      }

      // Not in cache, fetch from network
      return fetch(request)
        .then((response) => {
          // Clone the response before caching
          const responseToCache = response.clone();

          if (response.ok) {
            // Determine which cache to use based on content type
            const contentType = response.headers.get("content-type") || "";
            const cacheName =
              contentType.includes("image") ||
              contentType.includes("font") ||
              request.url.includes(".woff") ||
              request.url.includes(".ttf") ||
              request.url.includes(".json")
                ? STATIC_CACHE_NAME
                : DYNAMIC_CACHE_NAME;

            caches.open(cacheName).then((cache) => {
              cache.put(request, responseToCache);
            });
          }

          return response;
        })
        .catch(() => {
          // Network failed and not in cache
          // For images, return a placeholder
          if (request.destination === "image") {
            return new Response("", {
              status: 200,
              headers: { "Content-Type": "image/svg+xml" },
            });
          }
          // For other resources, return appropriate error
          return new Response("Network error", { status: 503 });
        });
    }),
  );
});

// Handle messages from the app
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data && event.data.type === "CLEAR_CACHE") {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith("claret-tech-"))
            .map((cacheName) => caches.delete(cacheName)),
        );
      }),
    );
  }
});

// Background sync for offline functionality
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-data") {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  // Placeholder for future background sync functionality
  // Background sync triggered
}
