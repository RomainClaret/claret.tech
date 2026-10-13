// Service worker for claret.tech: retired, and kept only to remove itself.
//
// It served /images, /fonts and /animations cache-first, which the HTTP
// cache already keeps for a year as immutable, and the page registered it
// only when hydration beat the window "load" event (the listener was added
// from an effect): on the static homepage, never. Browsers that did
// register it still run it and fetch this file on their next update check.
// This version takes over at once, deletes the site's own caches and
// unregisters itself. The page removes it too, on any visit with scripts
// (service-worker-cleanup.tsx).

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Only this site's own caches. Cache Storage belongs to the whole origin:
  // WebLLM keeps the AI terminal's model in it (webllm/model, about 1 GB,
  // with webllm/config and webllm/wasm).
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith("claret-tech-"))
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.registration.unregister()),
  );
});
