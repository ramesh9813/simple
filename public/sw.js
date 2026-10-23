const SHARE_CACHE = 'editor-share-target-v1';
const SHELL_CACHE = 'editor-shell-v1';
const CACHE_PREFIX = 'editor-';
const SHARE_PATH = '/share-target';
const SHARE_REDIRECT = '?share-target=1';
const CACHEABLE_DESTINATIONS = new Set(['script', 'style', 'image', 'font', 'manifest']);

const shareKey = () => new URL('__share-target__', self.registration.scope).href;
const shareRedirect = () => new URL(SHARE_REDIRECT, self.registration.scope).href;
const toText = (value) => (typeof value === 'string' ? value : '');

async function storeShare(payload) {
  const cache = await caches.open(SHARE_CACHE);
  await cache.put(
    shareKey(),
    new Response(JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

function shareResponse() {
  return Response.redirect(shareRedirect(), 303);
}

async function handleSharePost(request) {
  try {
    const form = await request.formData();
    await storeShare({
      title: toText(form.get('title')),
      text: toText(form.get('text')),
      url: toText(form.get('url')),
    });
  } catch (error) {
    console.error('Unable to read shared content:', error);
  }
  return shareResponse();
}

async function handleShareGet(url) {
  try {
    await storeShare({
      title: toText(url.searchParams.get('title')),
      text: toText(url.searchParams.get('text')),
      url: toText(url.searchParams.get('url')),
    });
  } catch (error) {
    console.error('Unable to store shared content:', error);
  }
  return shareResponse();
}

function isCacheable(request) {
  return request.mode === 'navigate' || CACHEABLE_DESTINATIONS.has(request.destination);
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.status === 200 && response.type === 'basic' && isCacheable(request)) {
      try {
        await cache.put(request, response.clone());
      } catch (error) {
        console.error('Unable to cache response:', error);
      }
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const root = await cache.match(new URL('./', self.registration.scope).href);
      if (root) return root;
    }
    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith(CACHE_PREFIX) && name !== SHARE_CACHE && name !== SHELL_CACHE
          )
          .map((name) => caches.delete(name))
      );
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (request.method === 'POST' && url.pathname === SHARE_PATH) {
    event.respondWith(handleSharePost(request));
    return;
  }

  if (request.method === 'GET' && url.pathname === SHARE_PATH) {
    event.respondWith(handleShareGet(url));
    return;
  }

  if (request.method !== 'GET') return;

  event.respondWith(networkFirst(request));
});
