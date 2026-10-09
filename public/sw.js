// Service Worker for claret.tech
// v6: drops the v5 cache and its cache-first copies. That alone does not
// deliver a file changed under the same name: a miss here fetches through
// the browser's HTTP cache, which keeps /images and /animations for a year
// as immutable. Changed content needs a new URL (docs/performance.md).
const CACHE_NAME = "claret-tech-v6";
// Nothing is precached: the worker serves only images, fonts and
// animations, cache-first as they are fetched. It used to precache the raw
// /fonts/ files (335 KB no CSS referenced any more) and then the web
// manifest, which it never serves: one dead entry and one wasted request on
// every install.

// The site's own images, fonts and animations, served cache-first. Nothing
// else is intercepted: pages, script chunks, the image optimizer, /api and
// the Pyodide runtime go straight to the network and the HTTP cache, which
// already caches the hashed assets for good. Routing them through this
// worker only added a round trip to each request, and its offline fallback
// for pages never had a page in its cache to fall back to.
const CACHED_PATHS = ["/images/", "/fonts/", "/animations/"];

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!CACHED_PATHS.some((path) => url.pathname.startsWith(path))) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  // Only this site's own old caches. Cache Storage belongs to the whole
  // origin: WebLLM keeps the AI terminal's model in it (webllm/model, about
  // 1 GB, with webllm/config and webllm/wasm), and deleting every name but
  // the current one made each new worker throw that away, so a returning
  // visitor downloaded the model again.
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName.startsWith("claret-tech-") &&
                cacheName !== CACHE_NAME,
            )
            .map((cacheName) => caches.delete(cacheName)),
        ),
      ),
  );
});
