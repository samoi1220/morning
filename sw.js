const CACHE='design-desk-v0.4.1';
const ASSETS=['/','/index.html','/styles.css','/core.js','/project-tools.js','/runtime.js','/integration.js','/app.js','/firebase-client.js','/jf-openhuninn-1.1.ttf','/manifest.json','/register-worker.js','/icon-180.png','/icon-192.png','/icon-512.png'];
self.addEventListener('install',event=>{self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if((key.startsWith('zaoke-')||key.startsWith('design-desk-'))&&key!==CACHE)await caches.delete(key);await self.clients.claim();})());});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||!ASSETS.includes(url.pathname))return;
 event.respondWith((async()=>{try{const response=await fetch(event.request);if(response.ok){const cache=await caches.open(CACHE);await cache.put(event.request,response.clone());}return response;}catch(error){const cached=await caches.match(event.request);if(cached)return cached;throw error;}})());
});
