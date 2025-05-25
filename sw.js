const CACHE_NAME = 'playset-v100';

// A list of local resources we always want to be cached.
const CACHE_FILES = [
    '/index.html',
    '/',
    '/css/main.css',
    '/css/widgets.css',
    '/js/timer.js',
    '/sw.js',
    '/js/game.js',
  ];

  // The install handler takes care of precaching the resources we always need.
self.addEventListener('install', event => {
    console.log('installing service worker...');
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then(cache => cache.addAll(CACHE_FILES))
        .then(self.skipWaiting())
    );
  });

  // The activate handler takes care of cleaning up old caches.
  self.addEventListener("activate", event => {
    event.waitUntil((async () => {
      // Get a list of all your caches in your app
      const keyList = await caches.keys();
      await Promise.all(
        keyList.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })());
    event.waitUntil(self.clients.claim());
  });
  
  // The fetch handler serves responses for same-origin resources from a cache.
  // If no response is found, it populates the runtime cache with the response
  // from the network before returning it to the page.
  
  self.addEventListener('fetch', event => {
      // ignore requests to chrome-extension:// URLs (e.g. for the DevTools etc).
      if (!event.request.url.startsWith(self.location.origin)) return;

      event.respondWith(        
        caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
  
          return caches.open(CACHE_NAME).then(cache => {
            return fetch(event.request).then(response => {
              // Put a copy of the response in the runtime cache.
              console.log(`Updating cache: ${event.request.url}`);
              return cache.put(event.request, response.clone()).then(() => {
                return response;
              });
            });
          });
        })
      );

  });
  