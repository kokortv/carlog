// CarLog Service Worker v3
const CACHE = "carlog-v5";
const SHELL = ["./index.html", "./manifest.json"];

// ── Установка ────────────────────────────────────────────────────
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(url => c.add(url))))
      .then(() => self.skipWaiting())
  );
});

// ── Активация: чистим старые кеши ────────────────────────────────
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────
self.addEventListener("fetch", e => {
  const url = e.request.url;

  // Пропускаем всё что не http/https
  // (chrome-extension://, data:, blob: и т.д.)
  if (!url.startsWith("http://") && !url.startsWith("https://")) return;

  // Google APIs и OAuth — только сеть, не кешируем
  if (
    url.includes("googleapis.com") ||
    url.includes("accounts.google.com") ||
    url.includes("openstreetmap.org") ||
    url.includes("tile.openstreetmap") ||
    e.request.method !== "GET"
  ) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ ok: false, msg: "offline" }), {
          headers: { "Content-Type": "application/json" }
        })
      )
    );
    return;
  }

  // Остальные GET — cache-first, fallback network → index.html
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;

      return fetch(e.request).then(resp => {
        // Кешируем только валидные ответы с нашего origin
        if (
          resp &&
          resp.status === 200 &&
          (resp.type === "basic" || resp.type === "cors")
        ) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => {
            // Дополнительная проверка — только http(s) URL
            if (e.request.url.startsWith("http")) {
              c.put(e.request, clone).catch(() => {});
            }
          });
        }
        return resp;
      }).catch(() =>
        caches.match("./index.html").then(r => r || new Response("Offline"))
      );
    })
  );
});
