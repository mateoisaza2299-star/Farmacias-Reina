import { el } from "./dom.js";
import { dinero } from "./format.js";
import { icono } from "./icons.js";

const CLAVE_VISITA = "reina-bienvenida";
const CLAVE_NAV = "reina-nav";
let listo = false;

export function reducido() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function esperar(ms) {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

export function marcarEsqueleto(nodo) {
  if (nodo) nodo.dataset.sk = String(performance.now());
}

export function desdeEsqueleto(nodo) {
  const inicio = Number(nodo?.dataset.sk || performance.now());
  return esperar(Math.max(0, 250 - (performance.now() - inicio)));
}

export function tarjetaEsqueleto() {
  return el("div", { class: "skeleton-card", "aria-hidden": "true" },
    el("div", { class: "skeleton sk-media" }),
    el("div", { class: "skeleton sk-line" }),
    el("div", { class: "skeleton sk-line short" }),
    el("div", { class: "skeleton sk-btn" })
  );
}

export function chipEsqueleto() {
  return el("span", { class: "sk-chip", "aria-hidden": "true" },
    el("span", { class: "skeleton chip-icon" }),
    el("span", { class: "skeleton sk-line" })
  );
}

export function lineaEsqueleto() {
  return el("div", { class: "sk-line-row", "aria-hidden": "true" },
    el("div", { class: "skeleton sk-thumb" }),
    el("div", { class: "sk-copy" },
      el("div", { class: "skeleton sk-line" }),
      el("div", { class: "skeleton sk-line short" })
    )
  );
}

export function bloqueEsqueleto() {
  return el("div", { class: "skeleton-card sk-block", "aria-hidden": "true" },
    el("div", { class: "skeleton sk-line" }),
    el("div", { class: "skeleton sk-line" }),
    el("div", { class: "skeleton sk-line short" }),
    el("div", { class: "skeleton sk-media sk-short" })
  );
}

export function estadoFallo(texto, reintentar) {
  return el("div", { class: "empty-state load-error", role: "alert" },
    icono("box"),
    el("p", {}, texto),
    el("button", { type: "button", class: "btn btn-primary", onclick: reintentar }, "Reintentar")
  );
}

export function prepararImagen(img, prioridad = false) {
  img.decoding = "async";
  if (!img.getAttribute("width")) img.width = 480;
  if (!img.getAttribute("height")) img.height = 480;
  if (prioridad) img.setAttribute("fetchpriority", "high");
  else if (!img.getAttribute("loading")) img.loading = "lazy";
  img.classList.add("media-img");
  const mostrar = () => img.classList.add("is-decoded");
  if (img.complete && img.naturalWidth > 0) mostrar();
  else img.addEventListener("load", mostrar, { once: true });
  return img;
}

export function entrar(nodos, maximo = 8) {
  const lista = [...nodos];
  lista.forEach((nodo, indice) => {
    nodo.style.setProperty("--i", String(indice < maximo ? indice : 0));
    nodo.classList.add("entra");
  });
  requestAnimationFrame(() => {
    lista.forEach((nodo) => nodo.classList.add("is-show"));
  });
  lista.forEach((nodo) => {
    const limpiar = () => {
      nodo.classList.remove("entra", "is-show");
      nodo.style.removeProperty("--i");
    };
    nodo.addEventListener("transitionend", limpiar, { once: true });
    setTimeout(limpiar, reducido() ? 180 : 800);
  });
}

export async function cruzar(contenedor, nodos) {
  if (!contenedor) return;
  await desdeEsqueleto(contenedor);
  const viejos = [...contenedor.children];
  const padre = contenedor.getBoundingClientRect();
  viejos.forEach((nodo) => {
    const rect = nodo.getBoundingClientRect();
    nodo.style.setProperty("--l", `${rect.left - padre.left}px`);
    nodo.style.setProperty("--t", `${rect.top - padre.top}px`);
    nodo.style.setProperty("--w", `${rect.width}px`);
    nodo.style.setProperty("--h", `${rect.height}px`);
  });
  contenedor.classList.add("is-cross");
  viejos.forEach((nodo) => nodo.classList.add("is-out"));
  const nuevos = [...nodos];
  nuevos.forEach((nodo, indice) => {
    nodo.style.setProperty("--i", String(indice < 12 ? indice : 0));
    nodo.classList.add("entra");
    contenedor.append(nodo);
  });
  requestAnimationFrame(() => nuevos.forEach((nodo) => nodo.classList.add("is-show")));
  await esperar(reducido() ? 120 : 200);
  viejos.forEach((nodo) => nodo.remove());
  contenedor.classList.remove("is-cross", "is-dim");
  nuevos.forEach((nodo) => {
    const limpiar = () => {
      nodo.classList.remove("entra", "is-show");
      nodo.style.removeProperty("--i");
    };
    nodo.addEventListener("transitionend", limpiar, { once: true });
    setTimeout(limpiar, reducido() ? 180 : 900);
  });
}

export async function atenuar(nodo) {
  if (!nodo || reducido()) return;
  nodo.classList.add("is-dim");
  await esperar(120);
  nodo.classList.remove("is-dim");
}

export function ocupar(boton, activo) {
  if (!boton) return;
  if (activo) {
    boton.style.setProperty("--btn-w", `${boton.offsetWidth}px`);
    boton.classList.add("is-busy");
    boton.setAttribute("aria-busy", "true");
    return;
  }
  boton.classList.remove("is-busy");
  boton.removeAttribute("aria-busy");
  boton.style.removeProperty("--btn-w");
}

export function animarDinero(nodo, valor) {
  if (!nodo) return;
  const destino = Math.round(Number(valor) || 0);
  const previo = nodo.dataset.valor;
  nodo.dataset.valor = String(destino);
  if (previo == null || previo === "" || reducido() || Number(previo) === destino) {
    nodo.textContent = dinero(destino);
    return;
  }
  const desde = Number(previo);
  const inicio = performance.now();
  const paso = (ahora) => {
    if (nodo.dataset.valor !== String(destino)) return;
    const t = Math.min(1, (ahora - inicio) / 300);
    const curva = 1 - (1 - t) * (1 - t);
    nodo.textContent = dinero(Math.round(desde + (destino - desde) * curva));
    if (t < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

export function transicionTexto(nodo, texto) {
  if (!nodo || nodo.textContent === texto) return;
  if (reducido()) {
    nodo.textContent = texto;
    return;
  }
  nodo.classList.add("is-swap");
  setTimeout(() => {
    nodo.textContent = texto;
    nodo.classList.remove("is-swap");
  }, 120);
}

export function moverIndicador(contenedor, activo) {
  if (!contenedor || !activo) return;
  const indicador = contenedor.querySelector(":scope > .nav-indicator");
  if (!indicador) return;
  const x = activo.offsetLeft + activo.offsetWidth / 2 - 24;
  indicador.style.setProperty("--x", `${Math.max(0, x)}px`);
  indicador.classList.add("is-on");
}

function barras() {
  let barra = document.querySelector(".carga-barra");
  if (!barra) {
    barra = el("div", { class: "carga-barra", "aria-hidden": "true" });
    document.body.prepend(barra);
  }
  return barra;
}

function ponerBarra(valor) {
  barras().style.setProperty("--n", String(valor));
}

function iniciarBarra() {
  const barra = barras();
  const sigue = sessionStorage.getItem(CLAVE_NAV) === "1";
  sessionStorage.removeItem(CLAVE_NAV);
  barra.classList.remove("is-done");
  barra.classList.add("is-on");
  ponerBarra(sigue ? 0.38 : 0.08);
  requestAnimationFrame(() => ponerBarra(sigue ? 0.74 : 0.46));
  const terminar = () => {
    ponerBarra(1);
    barra.classList.add("is-done");
  };
  if (document.readyState === "complete") setTimeout(terminar, 80);
  else window.addEventListener("load", () => setTimeout(terminar, 80), { once: true });
  document.addEventListener("click", (evento) => {
    const enlace = evento.target.closest("a[href]");
    if (!enlace || enlace.target === "_blank" || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey || evento.button !== 0) return;
    const url = new URL(enlace.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
    if (url.pathname === location.pathname && url.search === location.search) return;
    sessionStorage.setItem(CLAVE_NAV, "1");
    const nodo = barras();
    nodo.classList.add("is-on");
    nodo.classList.remove("is-done");
    ponerBarra(0.22);
  });
}

function primerBloque() {
  return document.querySelector("main .hero, main .section, main .prose, .login-card, [data-app], main");
}

function recursosListos() {
  const tareas = [];
  if (document.readyState === "loading") {
    tareas.push(new Promise((resolver) => document.addEventListener("DOMContentLoaded", resolver, { once: true })));
  }
  if (document.fonts?.ready) tareas.push(document.fonts.ready.catch(() => {}));
  return Promise.all(tareas).then(() => new Promise((resolver) => {
    requestAnimationFrame(() => requestAnimationFrame(resolver));
  }));
}

function iniciarBienvenida() {
  try {
    if (sessionStorage.getItem(CLAVE_VISITA) === "1") return;
  } catch {
    return;
  }
  let visible = false;
  let cerrada = false;
  const quitar = () => {
    document.documentElement.classList.remove("js-listo", "bienvenida-out");
    document.querySelector(".bienvenida")?.remove();
  };
  const cerrar = () => {
    if (cerrada) return;
    cerrada = true;
    if (!visible) return;
    document.documentElement.classList.add("bienvenida-out");
    setTimeout(quitar, reducido() ? 120 : 200);
  };
  requestAnimationFrame(() => {
    try { sessionStorage.setItem(CLAVE_VISITA, "1"); } catch {}
    const ya = document.fonts?.status === "loaded" && primerBloque();
    if (cerrada || ya) {
      cerrada = true;
      return;
    }
    visible = true;
    document.documentElement.classList.add("js-listo");
    document.body.append(el("div", { class: "bienvenida", "aria-hidden": "true" },
      el("img", {
        class: "bienvenida-logo",
        src: "assets/logo/logo-192.webp",
        alt: "",
        width: "72",
        height: "72",
        decoding: "async"
      }),
      el("span", { class: "bienvenida-linea" })
    ));
  });
  recursosListos().then(cerrar);
  setTimeout(cerrar, 700);
  setTimeout(() => {
    cerrada = true;
    quitar();
  }, 1500);
}

function secciones() {
  document.documentElement.classList.add("js-motion");
  const nodos = [...document.querySelectorAll("main > .section, main > .hero, body > .section")];
  const mostrar = (nodo) => nodo.classList.add("is-in");
  if (reducido() || !("IntersectionObserver" in window)) {
    nodos.forEach(mostrar);
    return;
  }
  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => {
      if (!entrada.isIntersecting) return;
      mostrar(entrada.target);
      observador.unobserve(entrada.target);
    });
  }, { threshold: 0.16, rootMargin: "0px 0px -10% 0px" });
  nodos.forEach((nodo) => {
    const arriba = nodo.getBoundingClientRect().top < window.innerHeight * 0.92;
    if (arriba) mostrar(nodo);
    else {
      nodo.classList.add("va-entrar");
      observador.observe(nodo);
    }
  });
}

function espia() {
  const menu = document.querySelector(".section-nav");
  const barra = document.querySelector(".tabbar");
  if (barra && !barra.querySelector(".nav-indicator")) {
    barra.append(el("span", { class: "nav-indicator", "aria-hidden": "true" }));
  }
  const pares = [
    ["inicio", "inicio"],
    ["categorias", "categorias"],
    ["ofertas", "inicio"],
    ["como-pedir", "inicio"],
    ["catalogo", "buscar"],
    ["preguntas", "buscar"],
    ["llegar", "buscar"]
  ];
  const ubicar = () => {
    const marca = window.scrollY + (document.querySelector("[data-header]")?.offsetHeight || 120) + 28;
    if (menu) {
      const enlaces = [...menu.querySelectorAll("[data-spy]")];
      let activo = enlaces[0];
      enlaces.forEach((enlace) => {
        const id = enlace.getAttribute("href")?.slice(1);
        const seccion = id ? document.getElementById(id) : null;
        if (seccion && seccion.offsetTop <= marca) activo = enlace;
      });
      enlaces.forEach((enlace) => enlace.classList.toggle("is-on", enlace === activo));
      if (activo) moverIndicador(menu, activo);
    }
    if (!barra || window.matchMedia("(min-width: 900px)").matches) return;
    const pagina = document.body.dataset.page;
    let tab = "inicio";
    if (pagina === "pagar") tab = "carrito";
    else if (pagina === "pedidos") tab = "pedidos";
    else if (pagina === "inicio") {
      pares.forEach(([id, destino]) => {
        const seccion = document.getElementById(id);
        if (seccion && seccion.offsetTop <= marca) tab = destino;
      });
    }
    const boton = barra.querySelector(`[data-tab="${tab}"]`);
    barra.querySelectorAll("[data-tab]").forEach((nodo) => nodo.classList.toggle("is-spy", nodo === boton));
    if (boton) moverIndicador(barra, boton);
  };
  ubicar();
  window.addEventListener("scroll", ubicar, { passive: true });
  window.addEventListener("resize", ubicar);
}

function pausa() {
  const aplicar = () => document.documentElement.classList.toggle("is-hidden", document.hidden);
  aplicar();
  document.addEventListener("visibilitychange", aplicar);
}

function respaldo() {
  const soporta = window.CSS?.supports?.("view-transition-name", "cabecera");
  if (!soporta) document.documentElement.classList.add("sin-vt");
}

export function iniciarMovimiento() {
  if (listo || !document.body) return;
  listo = true;
  respaldo();
  pausa();
  iniciarBienvenida();
  iniciarBarra();
  secciones();
  espia();
}

iniciarMovimiento();
