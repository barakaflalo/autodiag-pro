/* Cloudflare Pages redirects *.html -> pretty URL (308); a cached "redirected" copy is refused for page loads. Hand navigations a clean copy. */
function cleanNav(r){ if(!r||!r.redirected) return r; return r.blob().then(b=>new Response(b,{status:r.status,statusText:r.statusText,headers:r.headers})); }
const _respondWith=FetchEvent.prototype.respondWith;
FetchEvent.prototype.respondWith=function(p){ const nav=this.request.mode==='navigate'; return _respondWith.call(this, nav?Promise.resolve(p).then(cleanNav):p); };
const CACHE='autodiag-v2';
const ASSETS=['./','./index.html'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('autodiag-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{if(res.status===200){const c=res.clone();caches.open(CACHE).then(cache=>cache.put(e.request,c))}return res}).catch(()=>caches.match('./index.html'))))});
