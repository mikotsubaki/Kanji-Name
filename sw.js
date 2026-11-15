/* 椿堂 JAPANESE NAME MAKER — オフライン用サービスワーカー
   アプリの中身を更新したら CACHE の番号を上げてください。 */
const CACHE = "tsubakido-v4";
const ASSETS = [
  "./", "./index.html", "./css/style.css", "./manifest.webmanifest",
  "./js/config.js", "./js/kana.js", "./js/engine.js", "./js/i18n.js", "./js/countries.js", "./js/ai.js", "./js/app.js",
  "./data/kanji-db.js", "./data/names-db.js", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png", "./icons/favicon.ico", "./icons/favicon-32.png"
];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin")) return;
  /* 同じサイトのファイル: ネット優先・失敗したらキャッシュ。Google Fonts: キャッシュ優先 */
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; }).catch(() => caches.match(req)));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })));
  }
});
