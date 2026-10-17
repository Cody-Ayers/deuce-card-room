// Deuce Card Room: keeps the app playable offline.
const CACHE='deuce-v24';
const SHELL=['./','index.html','cloud.js','privacy.html','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png','icons/favicon-32.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const url=new URL(req.url);
  // fonts: cache after first load
  if(url.hostname.endsWith('fonts.googleapis.com')||url.hostname.endsWith('fonts.gstatic.com')){
    e.respondWith(caches.open(CACHE).then(async c=>{const hit=await c.match(req);if(hit)return hit;try{const r=await fetch(req);if(r.ok||r.type==='opaque')c.put(req,r.clone());return r}catch(err){return hit||Response.error()}}));return;
  }
  if(url.origin!==location.origin)return;
  // app files: always check GitHub for a newer copy (skips the browser's 10-minute cache), saved copy only when offline
  e.respondWith(fetch(req,{cache:'no-cache'}).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp))}return r}).catch(()=>caches.match(req).then(h=>h||caches.match('index.html'))));
});
