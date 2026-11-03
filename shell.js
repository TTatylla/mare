/* Casca do app Maré: guarda o endereço do servidor, carrega o app e cuida das notificações.
   Nenhum dado pessoal fica aqui: rotina, tarefas e anotações ficam no Google Drive da dona do app. */
(function () {
  "use strict";
  var CFG = "mare-cfg", APP = "mare-app";
  var msg = function (t) { var el = document.getElementById("splashMsg"); if (el) el.textContent = t; };

  function ler(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function grava(k, v) { try { localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v)); } catch (e) {} }

  /* 1. endereço e chave chegam pelo link de instalação (#k=...&u=...) */
  var cfg = ler(CFG);
  var h = new URLSearchParams(location.hash.slice(1));
  if (h.get("k") && h.get("u")) {
    cfg = { k: h.get("k"), u: h.get("u") };
    grava(CFG, cfg);
    history.replaceState(null, "", location.pathname);
  }

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
  if (cfg && "caches" in window) {
    caches.open("mare-cfg").then(function (c) { return c.put("./__cfg", new Response(JSON.stringify(cfg))); }).catch(function () {});
  }

  if (!cfg) {
    msg("Para começar, abra o Maré do Google, toque na engrenagem ⚙️ e depois em “Instalar o Maré como app”.");
    return;
  }

  /* 2. conversa com o servidor (Apps Script) */
  function chamar(fn, args) {
    return fetch(cfg.u, { method: "POST", body: JSON.stringify({ k: cfg.k, fn: fn, args: args || [] }) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!j.ok) throw new Error(j.err || "erro"); return j.r; });
  }
  function corrente() {
    var ok = function () {}, falha = function () {};
    var p = new Proxy({}, {
      get: function (_, n) {
        if (n === "withSuccessHandler") return function (f) { if (f) ok = f; return p; };
        if (n === "withFailureHandler") return function (f) { if (f) falha = f; return p; };
        if (n === "withUserObject") return function () { return p; };
        return function () { var a = Array.prototype.slice.call(arguments); chamar(n, a).then(function (r) { ok(r); }, function (e) { falha(e); }); };
      }
    });
    return p;
  }
  window.google = { script: { run: new Proxy({}, { get: function (_, n) { return corrente()[n]; } }) } };

  /* 3. notificações */
  function b64(s) {
    var p = "=".repeat((4 - (s.length % 4)) % 4), b = atob((s + p).replace(/-/g, "+").replace(/_/g, "/"));
    var u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u;
  }
  window.MARE_PWA = {
    estado: function () {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) return "sem";
      if (Notification.permission === "denied") return "negado";
      if (Notification.permission === "granted" && localStorage.getItem("mare-sub")) return "ativo";
      return "desligado";
    },
    ativar: function () {
      return Notification.requestPermission().then(function (perm) {
        if (perm !== "granted") throw new Error("o celular não deixou");
        return Promise.all([navigator.serviceWorker.ready, chamar("vapid")]);
      }).then(function (r) {
        var reg = r[0], chave = b64(r[1]);
        return reg.pushManager.getSubscription().then(function (s) {
          return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave });
        });
      }).then(function (sub) {
        return chamar("inscrever", [sub.toJSON()]);
      }).then(function () { grava("mare-sub", "1"); return true; });
    },
    guardarAvisos: function (lista) {
      if (!("caches" in window)) return;
      caches.open("mare-dados").then(function (c) { return c.put("./__avisos", new Response(JSON.stringify(lista))); }).catch(function () {});
    }
  };

  /* 4. monta o app */
  function montar(html) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    Array.prototype.forEach.call(doc.head.querySelectorAll("style, link[rel=stylesheet], link[rel=preconnect]"), function (n) {
      document.head.appendChild(document.importNode(n, true));
    });
    var splash = document.getElementById("splash"); if (splash) splash.remove();
    var scripts = [];
    Array.prototype.forEach.call(doc.body.childNodes, function (n) {
      if (n.nodeName === "SCRIPT") scripts.push(n.textContent);
      else document.body.appendChild(document.importNode(n, true));
    });
    scripts.forEach(function (code) { var s = document.createElement("script"); s.textContent = code; document.body.appendChild(s); });
  }

  var guardado = null;
  try { guardado = localStorage.getItem(APP); } catch (e) {}
  if (guardado) montar(guardado);
  chamar("app").then(function (html) {
    if (html && html !== guardado) {
      grava(APP, html);
      if (!guardado) montar(html);
      else {
        /* chegou versão nova do Maré: recarrega uma vez para já mostrar */
        var ja = false; try { ja = sessionStorage.getItem("mare-recarregou") === "1"; } catch (e) {}
        if (!ja) { try { sessionStorage.setItem("mare-recarregou", "1"); } catch (e) {} location.reload(); }
      }
    }
  }).catch(function (e) {
    if (!guardado) msg("Não consegui abrir o Maré agora. Confira a internet e tente de novo. (" + (e && e.message ? e.message : e) + ")");
  });
})();
