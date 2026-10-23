const SHELL = "reina-shell-v1";
const IMG = "reina-img-v1";
const TOPE = 80;

const CASCO = [
  "./index.html",
  "./mis-pedidos.html",
  "./pagar.html",
  "./seguimiento.html",
  "./offline.html",
  "./css/styles.css",
  "./js/buscar.js",
  "./js/cart.js",
  "./js/categoria.js",
  "./js/checkout.js",
  "./js/config.js",
  "./js/datos.js",
  "./js/dom.js",
  "./js/favoritos-pagina.js",
  "./js/format.js",
  "./js/home.js",
  "./js/icons.js",
  "./js/layout.js",
  "./js/legal.js",
  "./js/memoria.js",
  "./js/mis-pedidos.js",
  "./js/motion.js",
  "./js/offline.js",
  "./js/pagina.js",
  "./js/pago.js",
  "./js/pedido-acciones.js",
  "./js/pedidos.js",
  "./js/producto.js",
  "./js/pwa.js",
  "./js/seguimiento.js",
  "./js/store.js",
  "./js/supabase.js",
  "./js/ui-producto.js"
];

const MEDIOS = [
  "./fonts/inter-latin.woff2",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/shortcut-pedidos.png",
  "./assets/icons/shortcut-buscar.png"
];

function nombre(url) {
  return url.pathname.split("/").pop() || "";
}

function esAdmin(url) {
  const archivo = nombre(url);
  return archivo === "admin.html" || archivo === "admin-login.html" || archivo === "admin.js" || archivo === "login.js" || archivo === "acceso.js";
}

function sensible(url) {
  const params = url.searchParams;
  return params.has("pedido") || params.has("token") || params.has("q") || params.has("apikey");
}

function bloqueada(request, url) {
  if (request.headers.has("apikey") || request.headers.has("authorization")) return true;
  if (esAdmin(url)) return true;
  return false;
}

function esCodigo(request, url) {
  if (request.destination === "script" || request.destination === "style") return true;
  return /\.(css|js|mjs)$/i.test(nombre(url));
}

function esMedio(request, url) {
  if (request.destination === "image" || request.destination === "font") return true;
  return /\.(png|jpe?g|webp|gif|svg|ico|woff2?)$/i.test(nombre(url));
}

async function guardar(nombreCache, request, respuesta) {
  try {
    if (!respuesta || !respuesta.ok || respuesta.type !== "basic") return;
    const cache = await caches.open(nombreCache);
    await cache.put(request.url, respuesta.clone());
  } catch {
    return;
  }
}

async function buscarCasco(url) {
  const cache = await caches.open(SHELL);
  const limpia = new URL(url.pathname, self.location.origin).href;
  const candidatos = [limpia];
  if (url.pathname.endsWith("/")) candidatos.push(`${limpia}index.html`);
  const archivo = nombre(url);
  if (archivo) candidatos.push(new URL(`./${archivo}`, self.location.href).href);
  for (const clave of candidatos) {
    const hallado = await cache.match(clave);
    if (hallado) return hallado;
  }
  return null;
}

async function desdeRed(event, request) {
  try {
    const precarga = await event.preloadResponse;
    if (precarga) return precarga;
  } catch {
    return fetch(request);
  }
  return fetch(request);
}

async function navegacion(event, request, url) {
  const guardarRespuesta = !sensible(url);
  try {
    const respuesta = await desdeRed(event, request);
    if (guardarRespuesta) await guardar(SHELL, request, respuesta);
    return respuesta;
  } catch {
    const casco = await buscarCasco(url);
    if (casco) return casco;
    const offline = await caches.match("./offline.html");
    if (offline) return offline;
    return new Response("Sin conexión", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

async function redPrimero(request, nombreCache) {
  try {
    const respuesta = await fetch(request);
    await guardar(nombreCache, request, respuesta);
    return respuesta;
  } catch {
    const hallado = await caches.match(request);
    if (hallado) return hallado;
    return new Response("", { status: 504 });
  }
}

async function cachePrimero(request) {
  const cache = await caches.open(IMG);
  const hallado = await cache.match(request);
  if (hallado) return hallado;
  try {
    const respuesta = await fetch(request);
    if (respuesta && respuesta.ok && respuesta.type === "basic") {
      await cache.put(request, respuesta.clone());
      const claves = await cache.keys();
      if (claves.length > TOPE) await cache.delete(claves[0]);
    }
    return respuesta;
  } catch {
    return new Response("", { status: 504 });
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const casco = await caches.open(SHELL);
    await casco.addAll(CASCO);
    const medios = await caches.open(IMG);
    await medios.addAll(MEDIOS);
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    const vigentes = new Set([SHELL, IMG]);
    const claves = await caches.keys();
    await Promise.all(claves.filter((clave) => clave.startsWith("reina-") && !vigentes.has(clave)).map((clave) => caches.delete(clave)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (esAdmin(url)) {
    if (request.mode !== "navigate") return;
    event.respondWith((async () => {
      try {
        const precarga = await event.preloadResponse;
        if (precarga) return precarga;
      } catch {
        return fetch(request, { cache: "no-store" });
      }
      return fetch(request, { cache: "no-store" });
    })());
    return;
  }
  if (bloqueada(request, url)) return;
  if (request.mode === "navigate") {
    event.respondWith(navegacion(event, request, url));
    return;
  }
  if (sensible(url)) return;
  if (esCodigo(request, url)) {
    event.respondWith(redPrimero(request, SHELL));
    return;
  }
  if (esMedio(request, url)) event.respondWith(cachePrimero(request));
});
