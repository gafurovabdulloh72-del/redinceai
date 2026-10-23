/*
 * Kasb Egalari service worker (F97) — faqat productionda ro'yxatdan o'tadi (components/layout/ServiceWorkerRegister).
 *
 * Strategiya:
 *  - /_next/static, ikonkalar, shriftlar, rasmlar          → cache-first (fayl nomlari hash'li — o'zgarmaydi)
 *  - ommaviy sahifalar (HTML navigatsiya)                   → network-first, tarmoq bo'lmasa — keshdagi nusxa yoki /offline
 *  - /api/*, RSC so'rovlari, POST va boshqa domenlar         → umuman tegilmaydi (brauzer o'zi)
 *  - /kabinet, /admin, /auth, /buyurtma, /tolov, /chek HTML → hech qachon keshlanmaydi (shaxsiy ma'lumot); oflaynda /offline
 *  - kirish/chiqish (/api/auth/*) bo'lganda sahifalar keshi tozalanadi — boshqa foydalanuvchining ismi oflayn nusxada qolmasin
 */
const VERSION = "v4";
const STATIC_CACHE = `kasbegalari-static-${VERSION}`;
const PAGES_CACHE = `kasbegalari-pages-${VERSION}`;
const OFFLINE_URL = "/offline";
const PAGES_LIMIT = 30;

const PRECACHE = [OFFLINE_URL, "/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png"];
const PRIVATE_PREFIXES = ["/kabinet", "/admin", "/auth", "/buyurtma", "/tolov", "/chek", "/u/"];
const STATIC_RE = /\.(?:js|css|woff2?|ttf|otf|svg|png|jpe?g|gif|webp|avif|ico)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(PRECACHE);
      // Oflayn sahifa uslublari: HTML ichidagi CSS fayllarini ham keshga olamiz (JS'siz ham chiroyli ko'rinsin)
      try {
        const res = await cache.match(OFFLINE_URL);
        const html = res ? await res.text() : "";
        const css = [...html.matchAll(/href="(\/_next\/static\/[^"]+\.css)"/g)].map((m) => m[1]);
        if (css.length) await cache.addAll([...new Set(css)]);
      } catch {
        /* e'tiborsiz — keyingi tashrifda cache-first baribir oladi */
      }
      // skipWaiting DARHOL EMAS: ochiq sahifa eski chunklar bilan ishlayotgan bo'lishi mumkin. Birinchi o'rnatishda
      // (controller yo'q) darhol faollashadi; yangilanishda sahifa «Yangilash» toastidan SKIP_WAITING xabarini yuboradi.
      const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
      if (clientsList.length === 0) await self.skipWaiting();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // Eski brend ("redince-*") keshlari ham tozalanadi — nomi o'zgargan keshlar diskda qolib ketmasin
      await Promise.all(keys.filter((k) => (k.startsWith("kasbegalari-") || k.startsWith("redince-")) && k !== STATIC_CACHE && k !== PAGES_CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

const isPrivate = (path) => PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(p.endsWith("/") ? p : `${p}/`) || path.startsWith(`${p}?`));

async function trimPages() {
  const cache = await caches.open(PAGES_CACHE);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - PAGES_LIMIT; i++) await cache.delete(keys[i]);
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.type === "basic") cache.put(request, res.clone()).catch(() => {});
  return res;
}

async function networkFirstPage(request, path) {
  try {
    const res = await fetch(request);
    if (res.ok && res.type === "basic" && !isPrivate(path)) {
      const cache = await caches.open(PAGES_CACHE);
      await cache.put(request, res.clone());
      trimPages().catch(() => {});
    }
    return res;
  } catch {
    if (!isPrivate(path)) {
      const cached = await caches.match(request, { cacheName: PAGES_CACHE });
      if (cached) return cached;
    }
    const offline = await caches.match(OFFLINE_URL, { cacheName: STATIC_CACHE });
    return offline || new Response("Internet aloqasi yo'q", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Kirish / chiqish / ro'yxatdan o'tish — oflayn sahifalar nusxasini tozalaymiz (so'rovning o'zi tarmoqqa ketadi)
  if (url.pathname.startsWith("/api/auth/") && request.method !== "GET") {
    event.waitUntil(caches.delete(PAGES_CACHE));
    return;
  }
  if (request.method !== "GET") return;
  if (url.pathname.startsWith("/api/")) return;
  // Next.js klient navigatsiyasi (RSC payload) — keshlanmaydi
  if (request.headers.get("RSC") || url.searchParams.has("_rsc") || request.headers.get("Next-Router-Prefetch")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request, url.pathname));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || (STATIC_RE.test(url.pathname) && !url.pathname.startsWith("/uploads/"))) {
    event.respondWith(cacheFirst(request));
  }
});

/* ------------------------------------------------------------------ */
/* Web Push: bildirishnoma ko'rsatish va bosilganda sahifani ochish    */
/* ------------------------------------------------------------------ */

self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = { title: "Kasb Egalari", body: event.data ? event.data.text() : "" };
  }
  const title = d.title || "Kasb Egalari";
  const href = d.href || "/kabinet/bildirishnomalar";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: d.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // Bir xil turdagi xabarlar bir-birini almashtiradi (chat xabarlari to'planib ketmasin)
      tag: d.tag || "kasbegalari",
      renotify: Boolean(d.tag),
      data: { href },
      lang: "uz",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || "/kabinet/bildirishnomalar";
  const target = new URL(href, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Sayt allaqachon ochiq bo'lsa shu oynani ishlatamiz
      for (const c of all) {
        if (new URL(c.url).origin === self.location.origin) {
          await c.focus();
          if ("navigate" in c) await c.navigate(target).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
