/* Service worker do Maré: deixa o app abrir sem internet e mostra as notificações. */
var VERSAO = "mare-v1";
var ARQUIVOS = ["./", "index.html", "shell.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "badge-96.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSAO).then(function (c) { return c.addAll(ARQUIVOS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf("mare-v") === 0 && k !== VERSAO; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(function (r) {
    var copia = r.clone();
    caches.open(VERSAO).then(function (c) { c.put(req, copia); });
    return r;
  }).catch(function () {
    return caches.match(req).then(function (r) { return r || caches.match("index.html"); });
  }));
});

function comPrazo(p, ms) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error("tempo")); }, ms); })]); }

function itensDoServidor() {
  return caches.open("mare-cfg").then(function (c) { return c.match("./__cfg"); }).then(function (r) {
    if (!r) return [];
    return r.json().then(function (cfg) {
      return comPrazo(fetch(cfg.u, { method: "POST", body: JSON.stringify({ k: cfg.k, fn: "ultimos", args: [] }) }).then(function (x) { return x.json(); }), 7000)
        .then(function (j) { return (j.ok && j.r && Date.now() - j.r.em < 5 * 60000) ? (j.r.itens || []) : []; });
    });
  }).catch(function () { return []; });
}

function itensGuardados() {
  return caches.open("mare-dados").then(function (c) { return c.match("./__avisos"); }).then(function (r) {
    if (!r) return [];
    return r.json().then(function (l) {
      var agora = Date.now() / 1000;
      return l.filter(function (a) { return Math.abs(a[0] - agora) < 240; }).map(function (a) { return [a[1], a[2], a[0]]; });
    });
  }).catch(function () { return []; });
}

self.addEventListener("push", function (e) {
  e.waitUntil(itensDoServidor().then(function (itens) {
    return itens.length ? itens : itensGuardados();
  }).then(function (itens) {
    if (!itens.length) itens = [["🌊 Maré", "Toque para ver o que vem agora.", 0]];
    return Promise.all(itens.map(function (it) {
      return self.registration.showNotification(it[0], {
        body: it[1], icon: "icon-192.png", badge: "badge-96.png", lang: "pt-BR",
        tag: "mare-" + Math.round(it[2] || Date.now() / 1000), renotify: true, vibrate: [180, 90, 180],
        data: { url: "./" }
      });
    }));
  }));
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (ws) {
    for (var i = 0; i < ws.length; i++) { if ("focus" in ws[i]) return ws[i].focus(); }
    return self.clients.openWindow("./");
  }));
});
