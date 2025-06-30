const CACHE_NAME = "warper-v1";
const STATIC_CACHE_NAME = "warper-static-v1";
const DYNAMIC_CACHE_NAME = "warper-dynamic-v1";

// Assets to cache immediately
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("Service Worker installing...");
  event.waitUntil(
    caches
      .open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log("Caching static assets");
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log("Static assets cached");
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error("Failed to cache static assets:", error);
      }),
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("Service Worker activating...");
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (
              cacheName !== STATIC_CACHE_NAME &&
              cacheName !== DYNAMIC_CACHE_NAME
            ) {
              console.log("Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          }),
        );
      })
      .then(() => {
        console.log("Service Worker activated");
        return self.clients.claim();
      }),
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // Handle different types of requests
  if (isStaticAsset(request)) {
    // Static assets: Cache first, then network
    event.respondWith(cacheFirst(request));
  } else if (isJavaScriptOrCSS(request)) {
    // JS/CSS: Stale while revalidate
    event.respondWith(staleWhileRevalidate(request));
  } else {
    // Everything else: Network first, fallback to cache
    event.respondWith(networkFirst(request));
  }
});

// Cache strategies
async function cacheFirst(request) {
  try {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error("Cache first failed:", error);
    // Return offline fallback if available
    return caches.match("/index.html");
  }
}

async function staleWhileRevalidate(request) {
  try {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const cached = await cache.match(request);

    // Fetch in background to update cache
    const fetchPromise = fetch(request)
      .then((response) => {
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      })
      .catch(() => cached); // Fallback to cached if network fails

    // Return cached immediately if available, otherwise wait for network
    return cached || (await fetchPromise);
  } catch (error) {
    console.error("Stale while revalidate failed:", error);
    return fetch(request);
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error("Network first failed, trying cache:", error);
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // Ultimate fallback for navigation requests
    if (request.mode === "navigate") {
      return caches.match("/index.html");
    }

    throw error;
  }
}

// Helper functions
function isStaticAsset(request) {
  const url = new URL(request.url);
  return (
    STATIC_ASSETS.some((asset) => url.pathname === asset) ||
    url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp)$/)
  );
}

function isJavaScriptOrCSS(request) {
  const url = new URL(request.url);
  return (
    url.pathname.match(/\.(js|css|ts|tsx)$/) ||
    url.pathname.includes("/assets/") ||
    url.pathname.includes("/@")
  );
}

// Handle background sync for failed operations
self.addEventListener("sync", (event) => {
  if (event.tag === "background-export") {
    event.waitUntil(handleBackgroundExport());
  }
});

async function handleBackgroundExport() {
  // Handle any queued export operations when connection is restored
  console.log("Background sync: handling queued exports");
}

// Handle push notifications (for future features)
self.addEventListener("push", (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      vibrate: [100, 50, 100],
      data: data.data || {},
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
  }
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      // If app is already open, focus it
      for (const client of clients) {
        if (client.url === self.location.origin && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow("/");
      }
    }),
  );
});

console.log("Service Worker loaded");
