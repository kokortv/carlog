// CarLog Service Worker v2
const CACHE = "carlog-v3";
const SHELL = ["./", "./index.html", "./manifest.json"];

// Установка: кешируем оболочку приложения
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

// Активация: удаляем старые кеши
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch стратегия:
// - Google Apps Script → только сеть (не кешируем POST-запросы к API)
// - Google Fonts → network-first, fallback cache
// - Всё остальное → cache-first, fallback network
self.addEventListener("fetch", e => {
  const url = e.request.url;

  // Apps Script и Google APIs — только сеть
  if (url.includes("script.google.com") || url.includes("googleapis.com")) {
    e.respondWith(fetch(e.request).catch(() => new Response(
      JSON.stringify({ok: false, msg: "offline"}),
      {headers: {"Content-Type": "application/json"}}
    )));
    return;
  }

  // Для GET-запросов — cache-first
  if (e.request.method === "GET") {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(resp => {
          // Кешируем только успешные ответы из нашего origin + шрифты
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return resp;
        }).catch(() => caches.match("./index.html")); // fallback на главную
      })
    );
  }
});
