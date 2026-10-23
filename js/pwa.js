import { negocio } from "./config.js";
import { el } from "./dom.js";
import { icono } from "./icons.js";

const QUINCENA = 14 * 24 * 60 * 60 * 1000;
const NS = "http://www.w3.org/2000/svg";

let diferido = null;
let controlesVisibles = false;
let hojaDescarta = false;
let cerrarHoja = null;
let recargar = false;

function instalada() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function esIos() {
  const agente = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/i.test(agente)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function esInterno() {
  return /Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|BytedanceWebview|Snapchat|Pinterest|Twitter|LinkedInApp/i.test(navigator.userAgent || "");
}

function esperaEvento() {
  if (esIos() || esInterno()) return false;
  const agente = navigator.userAgent || "";
  if (/Firefox|FxiOS|SamsungBrowser/i.test(agente)) return false;
  return /Chrome|Chromium|Edg\//i.test(agente);
}

function aplazarAviso() {
  localStorage.setItem("reina_aviso_hasta", String(Date.now() + QUINCENA));
}

function campoActivo(nodo) {
  return Boolean(nodo && (nodo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(nodo.tagName)));
}

function puedeAbrirAviso() {
  if (negocio.instalable !== true || instalada() || !controlesVisibles) return false;
  if (document.body?.dataset.page === "pagar" || document.body?.dataset.page === "offline") return false;
  if (campoActivo(document.activeElement)) return false;
  if (sessionStorage.getItem("reina_aviso_sesion") === "1") return false;
  const hasta = Number(localStorage.getItem("reina_aviso_hasta") || "0");
  if (hasta > Date.now()) return false;
  return Number(localStorage.getItem("reina_aviso_descartes") || "0") < 2;
}

function disparador() {
  return Number(localStorage.getItem("reina_visitas") || "0") >= 2 || localStorage.getItem("reina_primer_producto") === "1";
}

function mostrarControles(visible) {
  controlesVisibles = visible && negocio.instalable === true && !instalada();
  document.querySelectorAll("[data-instalar-tarjeta], [data-instalar-pedido]").forEach((nodo) => {
    nodo.hidden = !controlesVisibles;
  });
  document.querySelectorAll("[data-instalar]").forEach((nodo) => {
    if (nodo.closest("[data-instalar-tarjeta], [data-instalar-pedido], [data-instalar-hoja]")) return;
    nodo.hidden = !controlesVisibles;
  });
  if (controlesVisibles) programarAviso();
}

function focos(raiz) {
  return [...raiz.querySelectorAll("button, a[href], input, select, textarea")].filter((nodo) => !nodo.hidden);
}

function atrapar(hoja) {
  const tecla = (evento) => {
    if (evento.key === "Escape") {
      evento.preventDefault();
      if (hojaDescarta) descartarAviso();
      else if (cerrarHoja) cerrarHoja();
      return;
    }
    if (evento.key !== "Tab") return;
    const lista = focos(hoja);
    if (!lista.length) {
      evento.preventDefault();
      return;
    }
    const primero = lista[0];
    const ultimo = lista[lista.length - 1];
    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  };
  hoja.addEventListener("keydown", tecla);
  return () => hoja.removeEventListener("keydown", tecla);
}

function abrirHoja(nodos, descarta) {
  if (cerrarHoja) cerrarHoja();
  hojaDescarta = descarta;
  const previo = document.activeElement;
  const teniaBloqueo = document.documentElement.classList.contains("scroll-lock");
  const overlay = el("div", { class: "instalar-overlay is-open", "data-instalar-overlay": "true" });
  const hoja = el("div", {
    class: "instalar-sheet is-open",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "instalar-titulo",
    "data-instalar-hoja": "true",
    tabindex: "-1"
  });
  const cerrar = el("button", {
    type: "button",
    class: "icon-btn instalar-cerrar",
    "data-instalar-cerrar": "true",
    "aria-label": "Cerrar"
  }, icono("close"));
  hoja.append(cerrar, ...nodos);
  overlay.append(hoja);
  document.body.append(overlay);
  document.documentElement.classList.add("scroll-lock");
  const soltar = atrapar(hoja);
  cerrarHoja = () => {
    hojaDescarta = false;
    soltar();
    overlay.remove();
    cerrarHoja = null;
    if (!teniaBloqueo && !document.querySelector(".drawer.is-open, .sheet.is-open")) {
      document.documentElement.classList.remove("scroll-lock");
    }
    if (previo && previo.focus) previo.focus();
  };
  cerrar.focus();
}

function iconoGuia(caminos) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  caminos.forEach((dato) => {
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", dato);
    svg.append(path);
  });
  return svg;
}

function paso(dibujo, texto) {
  return el("li", {}, el("span", { class: "instalar-ico", "aria-hidden": "true" }, dibujo), el("span", {}, texto));
}

function abrirGuia() {
  const nodos = [el("h2", { id: "instalar-titulo" }, "Instalar app")];
  if (esInterno()) nodos.push(el("p", {}, "Abre esta página en tu navegador (Safari o Chrome) para poder instalarla"));
  if (esIos()) {
    nodos.push(el("ol", { class: "instalar-pasos" },
      paso(iconoGuia(["M12 3v11", "M8.5 6.5 12 3l3.5 3.5", "M6 11.5V20h12v-8.5"]), "Toca el botón Compartir"),
      paso(iconoGuia(["M4.5 4.5h15v15h-15z", "M12 8v8", "M8 12h8"]), "Elige “Agregar a pantalla de inicio”"),
      paso(iconoGuia(["M5 12.5l4.2 4.2L19 7.5"]), "Toca “Agregar”")
    ));
  } else {
    nodos.push(el("p", {}, "En el menú de tu navegador elige Instalar aplicación o Agregar a pantalla de inicio"));
  }
  abrirHoja(nodos, false);
}

function abrirAviso() {
  if (!puedeAbrirAviso() || document.querySelector("[data-instalar-hoja]")) return;
  sessionStorage.setItem("reina_aviso_sesion", "1");
  abrirHoja([
    el("img", { class: "instalar-logo", src: "assets/icons/icon-192.png", width: "64", height: "64", alt: "" }),
    el("h2", { id: "instalar-titulo" }, "Instala Droguerías Reina"),
    el("ul", { class: "instalar-ventajas" },
      el("li", {}, "Acceso directo desde tu pantalla de inicio"),
      el("li", {}, "Sigue tus pedidos más rápido"),
      el("li", {}, "Se abre a pantalla completa")
    ),
    el("button", { type: "button", class: "btn btn-primary", "data-instalar-confirmar": "true" }, "Instalar"),
    el("a", { href: "#contenido", class: "instalar-luego", "data-instalar-luego": "true" }, "Ahora no")
  ], true);
}

function programarAviso() {
  const intentar = () => {
    if (!disparador() || !puedeAbrirAviso()) {
      if (document.body?.dataset.page === "pagar" || document.body?.dataset.page === "offline") return;
      const activo = document.activeElement;
      if (campoActivo(activo)) activo.addEventListener("blur", () => setTimeout(intentar, 400), { once: true });
      return;
    }
    setTimeout(() => {
      if (puedeAbrirAviso()) {
        abrirAviso();
        return;
      }
      const activo = document.activeElement;
      if (campoActivo(activo)) activo.addEventListener("blur", () => setTimeout(intentar, 400), { once: true });
    }, 700);
  };
  intentar();
}

function descartarAviso() {
  const veces = Number(localStorage.getItem("reina_aviso_descartes") || "0") + 1;
  localStorage.setItem("reina_aviso_descartes", String(veces));
  aplazarAviso();
  hojaDescarta = false;
  if (cerrarHoja) cerrarHoja();
}

async function instalar() {
  if (instalada() || negocio.instalable !== true) return;
  if (esInterno() || !diferido) {
    abrirGuia();
    return;
  }
  const pendiente = diferido;
  diferido = null;
  hojaDescarta = false;
  if (cerrarHoja) cerrarHoja();
  try {
    pendiente.prompt();
    const eleccion = await pendiente.userChoice;
    if (!eleccion || eleccion.outcome !== "accepted") {
      aplazarAviso();
      return;
    }
    mostrarControles(false);
  } catch {
    aplazarAviso();
  }
}

function colocarBotones() {
  const menu = document.querySelector(".section-nav");
  if (menu && !menu.querySelector(".instalar-nav")) {
    const boton = el("button", { type: "button", class: "instalar-nav", "data-instalar": "true", hidden: true }, "Instalar app");
    const marca = menu.querySelector(".nav-indicator");
    if (marca) marca.before(boton);
    else menu.append(boton);
  }
  const info = [...document.querySelectorAll(".footer-grid section")].find((seccion) => seccion.querySelector("h2")?.textContent === "Información");
  if (info && !info.querySelector(".instalar-pie")) info.append(el("button", { type: "button", class: "btn btn-ghost instalar-pie", "data-instalar": "true", hidden: true }, "Instalar app"));
}

function avisoVersion(worker) {
  if (document.querySelector("[data-actualizar]")) return;
  let pila = document.querySelector(".toast-stack");
  if (!pila) {
    pila = el("div", { class: "toast-stack", role: "status", "aria-live": "polite" });
    document.body.append(pila);
  }
  const boton = el("button", { type: "button", class: "btn btn-primary", "data-actualizar": "true" }, "Actualizar");
  boton.addEventListener("click", () => {
    recargar = true;
    worker.postMessage({ type: "SKIP_WAITING" });
  });
  pila.append(el("div", { class: "toast toast-actualizacion is-on" }, el("p", {}, "Hay una versión nueva"), boton));
}

async function retirar() {
  if (!("serviceWorker" in navigator)) return;
  const propio = new URL("./sw.js", location.href).href;
  const registros = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registros.map((registro) => {
    const script = registro.active?.scriptURL || registro.waiting?.scriptURL || registro.installing?.scriptURL || "";
    return script === propio ? registro.unregister() : undefined;
  }));
  if (!("caches" in window)) return;
  const claves = await caches.keys();
  await Promise.all(claves.filter((clave) => clave.startsWith("reina-")).map((clave) => caches.delete(clave)));
}

async function registrar() {
  if (!("serviceWorker" in navigator)) return;
  const registro = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
  const activarPrimero = () => {
    if (!navigator.serviceWorker.controller && registro.waiting) registro.waiting.postMessage({ type: "SKIP_WAITING" });
  };
  const vigilar = (worker) => {
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state !== "installed") return;
      if (navigator.serviceWorker.controller) avisoVersion(worker);
      else activarPrimero();
    });
  };
  if (registro.waiting && navigator.serviceWorker.controller) avisoVersion(registro.waiting);
  else activarPrimero();
  registro.addEventListener("updatefound", () => vigilar(registro.installing));
  await registro.update().catch(() => {});
  setInterval(() => {
    if (document.visibilityState !== "visible") return;
    registro.update().catch(() => {});
  }, 60 * 60 * 1000);
}

function contarVisita() {
  if (sessionStorage.getItem("reina_visita") === "1") return;
  sessionStorage.setItem("reina_visita", "1");
  const visitas = Number(localStorage.getItem("reina_visitas") || "0") + 1;
  localStorage.setItem("reina_visitas", String(Math.min(visitas, 99)));
}

function escuchar() {
  document.addEventListener("click", (evento) => {
    if (evento.target.closest("[data-instalar-luego]")) {
      evento.preventDefault();
      descartarAviso();
      return;
    }
    if (evento.target.closest("[data-instalar-cerrar]")) {
      evento.preventDefault();
      if (hojaDescarta) descartarAviso();
      else if (cerrarHoja) cerrarHoja();
      return;
    }
    if (evento.target.closest("[data-instalar], [data-instalar-confirmar]")) {
      evento.preventDefault();
      instalar();
    }
  });
  document.addEventListener("reina:agregado", () => {
    if (localStorage.getItem("reina_primer_producto") === "1") return;
    localStorage.setItem("reina_primer_producto", "1");
    programarAviso();
  });
  window.addEventListener("beforeinstallprompt", (evento) => {
    if (negocio.instalable !== true || instalada()) return;
    evento.preventDefault();
    if (esIos() || esInterno() || /Firefox|FxiOS|SamsungBrowser/i.test(navigator.userAgent || "")) return;
    diferido = evento;
    mostrarControles(true);
  });
  window.addEventListener("appinstalled", () => {
    diferido = null;
    document.documentElement.classList.add("app-instalada");
    if (cerrarHoja) cerrarHoja();
    mostrarControles(false);
  });
  const medio = window.matchMedia("(display-mode: standalone)");
  if (medio.addEventListener) {
    medio.addEventListener("change", () => {
      if (!instalada()) return;
      document.documentElement.classList.add("app-instalada");
      mostrarControles(false);
    });
  }
}

export function actualizarInsignia(cantidad) {
  if (!instalada()) return;
  const total = Math.max(0, Math.trunc(Number(cantidad) || 0));
  const accion = total > 0 && navigator.setAppBadge ? navigator.setAppBadge(total) : navigator.clearAppBadge ? navigator.clearAppBadge() : null;
  if (accion && accion.catch) accion.catch(() => {});
}

export function iniciarPwa() {
  if (instalada()) document.documentElement.classList.add("app-instalada");
  if (negocio.instalable !== true) {
    mostrarControles(false);
    retirar().catch(() => {});
    return;
  }
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (recargar) location.reload();
    });
  }
  escuchar();
  contarVisita();
  if (document.body?.dataset.page !== "offline") colocarBotones();
  if (!esperaEvento() && !instalada()) mostrarControles(true);
  else mostrarControles(false);
  registrar().catch(() => {});
}
