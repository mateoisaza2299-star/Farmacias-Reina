import { negocio, categorias, AVISO_CERRADO } from "./config.js";
import { aplicarLegal } from "./legal.js";
import { leerConfig } from "./datos.js";
import { contarCarrito, fijarCantidad, quitarProducto, resumenCarrito, vaciarCarrito } from "./cart.js";
import { dinero, estadoHorario, marcaVisible } from "./format.js";
import { enlaceWhatsapp, numeroWhatsapp } from "./pago.js";
import { el } from "./dom.js";
import { icono } from "./icons.js";
import { animarDinero, lineaEsqueleto, marcarEsqueleto, prepararImagen, reducido } from "./motion.js";
import { iniciarMicro } from "./micro.js";
import { iniciarTilt } from "./tilt.js";
import { iniciarBusqueda } from "./buscar.js";
import { supabase } from "./supabase.js";
import { cambiosDeEstado, esActivo, fusionarEstados, interpretarPedido, leerPedidosLocal, pedidoActivoReciente, reemplazarPedidosLocal, textoFranja } from "./pedidos.js";
import { COLUMNAS, estadoVacio, tarjetaCorta } from "./ui-producto.js";
import { iniciarPwa } from "./pwa.js";

let configActual = { domicilio: 0, pedido_minimo: 0, abierto: true };
let soltarFoco = null;

export function obtenerConfig() {
  return configActual;
}

export function avisar(texto) {
  let pila = document.querySelector(".toast-stack");
  if (!pila) {
    pila = el("div", { class: "toast-stack", role: "status", "aria-live": "polite" });
    document.body.append(pila);
  }
  const toast = el("div", { class: "toast" }, texto);
  pila.append(toast);
  requestAnimationFrame(() => toast.classList.add("is-on"));
  setTimeout(() => {
    toast.classList.remove("is-on");
    toast.classList.add("is-out");
    setTimeout(() => toast.remove(), 220);
  }, 2400);
}

export function volarAlCarrito(imagen) {
  if (!imagen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    rebotarContador();
    return;
  }
  const destino = document.querySelector(window.matchMedia("(max-width: 899px)").matches ? ".tabbar [data-open-cart]" : ".header [data-open-cart]");
  if (!destino) return;
  const desde = imagen.getBoundingClientRect();
  const hacia = destino.getBoundingClientRect();
  const clon = imagen.cloneNode(true);
  clon.className = "fly-img";
  clon.alt = "";
  const dx = hacia.left + hacia.width / 2 - (desde.left + desde.width / 2);
  const dy = hacia.top + hacia.height / 2 - (desde.top + desde.height / 2);
  clon.style.setProperty("--l", `${desde.left}px`);
  clon.style.setProperty("--t", `${desde.top}px`);
  clon.style.setProperty("--w", `${Math.max(desde.width, 48)}px`);
  clon.style.setProperty("--h", `${Math.max(desde.height, 48)}px`);
  clon.style.setProperty("--x", `${dx}px`);
  clon.style.setProperty("--y", `${dy}px`);
  document.body.append(clon);
  requestAnimationFrame(() => clon.classList.add("is-go"));
  const limpiar = () => clon.remove();
  clon.addEventListener("transitionend", limpiar, { once: true });
  setTimeout(limpiar, 520);
  rebotarContador();
}

function rebotarContador() {
  document.querySelectorAll("[data-cart-count]").forEach((badge) => {
    badge.classList.remove("is-bounce");
    void badge.offsetWidth;
    badge.classList.add("is-bounce");
  });
}

function medirHeader() {
  const header = document.querySelector("[data-header]");
  if (!header) return;
  const aplicar = () => document.documentElement.style.setProperty("--header-h", `${header.offsetHeight}px`);
  aplicar();
  if ("ResizeObserver" in window) new ResizeObserver(aplicar).observe(header);
  else window.addEventListener("resize", aplicar);
}

function ponerTexto(nodo, texto) {
  nodo.textContent = texto;
  nodo.classList.toggle("pendiente", texto.includes("Por confirmar"));
}

function paginaPublica() {
  const nombre = decodeURIComponent((location.pathname.split("/").pop() || "index.html")).split("?")[0];
  if (!nombre || nombre === "index.html") return negocio.sitio;
  return `${negocio.sitio}${nombre}`;
}

function llenarNegocio() {
  const anio = document.querySelector("[data-year]");
  if (anio) anio.textContent = String(new Date().getFullYear());
  const mapa = {
    slogan: negocio.slogan,
    razon: negocio.razonSocial,
    nit: `NIT ${negocio.nit}`,
    regente: `Regente de farmacia: ${negocio.regente}`,
    direccion: negocio.direccion,
    horario: negocio.horario,
    cobertura: negocio.cobertura
  };
  document.querySelectorAll("[data-field]").forEach((nodo) => {
    const campo = nodo.dataset.field;
    if (mapa[campo]) ponerTexto(nodo, mapa[campo]);
  });
  const tel = document.querySelector("[data-field='telefono']");
  if (tel) {
    const visible = `Celular ${negocio.telefono}`;
    tel.classList.remove("pendiente");
    tel.replaceChildren(el("a", { href: `tel:${negocio.telefonoE164}` }, visible));
  }
  const wa = document.querySelector("[data-field='whatsapp']");
  if (wa) {
    const visible = `WhatsApp ${negocio.whatsappVisible}`;
    wa.classList.remove("pendiente");
    const destino = numeroWhatsapp();
    wa.replaceChildren();
    if (destino) wa.append(el("a", { href: enlaceWhatsapp("Hola. Quiero información de Droguerías Reina."), target: "_blank", rel: "noopener noreferrer" }, visible));
    else wa.textContent = visible;
  }
  const ig = document.querySelector("[data-field='instagram']");
  if (ig) {
    ig.classList.remove("pendiente");
    ig.replaceChildren(el("a", { href: negocio.instagram, target: "_blank", rel: "noopener noreferrer" }, negocio.instagramUsuario));
  }
  document.querySelectorAll("[data-nombre]").forEach((nodo) => {
    nodo.textContent = negocio.nombre;
  });
  document.querySelectorAll("[data-maps]").forEach((nodo) => {
    nodo.href = negocio.maps;
  });
}

function esquema() {
  const pagina = paginaPublica();
  const datos = {
    "@context": "https://schema.org",
    "@type": "Pharmacy",
    name: negocio.nombre,
    url: negocio.sitio,
    logo: `${negocio.sitio}assets/logo/logo-512.png`,
    image: `${negocio.sitio}assets/og/og-droguerias-reina-v2.jpg`,
    telephone: negocio.telefonoE164,
    address: {
      "@type": "PostalAddress",
      streetAddress: "Calle 13 No. 11-06",
      addressLocality: negocio.ciudad,
      addressRegion: negocio.departamento,
      addressCountry: "CO"
    },
    openingHours: negocio.horarioSchema,
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      opens: "08:00",
      closes: "20:00"
    },
    areaServed: [
      { "@type": "City", name: "Funza" },
      { "@type": "City", name: "Mosquera" }
    ],
    sameAs: [negocio.instagram],
    currenciesAccepted: "COP"
  };
  let script = document.getElementById("datos-farmacia");
  if (!script) {
    script = document.createElement("script");
    script.id = "datos-farmacia";
    script.type = "application/ld+json";
    document.head.append(script);
  }
  script.textContent = JSON.stringify(datos);
  const canon = document.querySelector("link[rel='canonical']");
  if (canon) canon.href = pagina;
  const og = document.querySelector("meta[property='og:url']");
  if (og) og.content = pagina;
  const titulo = "Droguería en Funza · Droguerías Reina";
  const descripcion = "Pide tus medicamentos en línea y recíbelos en casa en Funza y Mosquera. Pagas al recibir.";
  const imagenUrl = `${negocio.sitio}assets/og/og-droguerias-reina-v2.jpg`;
  const poner = (selector, valor) => {
    const nodo = document.querySelector(selector);
    if (nodo) nodo.content = valor;
  };
  poner("meta[property='og:title']", titulo);
  poner("meta[property='og:description']", descripcion);
  poner("meta[property='og:image']", imagenUrl);
  poner("meta[property='og:image:secure_url']", imagenUrl);
  poner("meta[property='og:image:alt']", "Logo de Droguerías Reina, droguería en Funza");
  poner("meta[name='twitter:title']", titulo);
  poner("meta[name='twitter:description']", descripcion);
  poner("meta[name='twitter:image']", imagenUrl);
}

function llenarBarrios() {
  const guardado = localStorage.getItem("barrio_reina") || "";
  document.querySelectorAll("[data-barrio]").forEach((campo) => {
    if ("value" in campo && !campo.value && guardado) campo.value = guardado;
    if (campo.dataset.listo) return;
    campo.dataset.listo = "true";
    campo.addEventListener("input", () => {
      localStorage.setItem("barrio_reina", campo.value);
      document.querySelectorAll("[data-barrio]").forEach((otro) => {
        if (otro !== campo && otro.value !== campo.value) otro.value = campo.value;
      });
      document.dispatchEvent(new CustomEvent("reina:barrio", { detail: campo.value }));
    });
  });
}

export function barrioActual() {
  return localStorage.getItem("barrio_reina") || "";
}

function actualizarContador() {
  const total = contarCarrito();
  document.querySelectorAll("[data-cart-count]").forEach((badge) => {
    badge.textContent = String(total);
    badge.hidden = total < 1;
  });
  document.querySelectorAll("[data-open-cart]").forEach((boton) => {
    boton.setAttribute("aria-label", total ? `Abrir carrito, ${total} productos` : "Abrir carrito");
  });
}

const cantidades = new Map();
const preciosLinea = new Map();

function lineaCarrito(item) {
  const media = el("div", { class: "line-media" });
  if (item.imagen) {
    const img = prepararImagen(el("img", { src: item.imagen, alt: "", width: "64", height: "64" }));
    img.addEventListener("error", () => img.remove());
    media.append(img);
  }
  const previa = cantidades.get(item.id);
  const dir = previa == null || previa === item.cantidad ? "" : item.cantidad > previa ? "is-up" : "is-down";
  cantidades.set(item.id, item.cantidad);
  const importe = item.precio * item.cantidad;
  const precioPrevio = preciosLinea.get(item.id);
  preciosLinea.set(item.id, importe);
  const flash = precioPrevio != null && precioPrevio !== importe && !reducido() ? " is-flash" : "";
  const meta = [marcaVisible(item.marca), item.presentacion].filter(Boolean).join(" · ");
  const info = el("div", { class: "line-info" },
    el("p", { class: "line-name" }, item.nombre),
    meta ? el("p", { class: "line-meta" }, meta) : null,
    item.requiere_formula ? el("p", { class: "tag tag-rx" }, "Requiere fórmula médica") : null,
    el("p", { class: `line-price${flash}` }, dinero(importe))
  );
  const menos = el("button", { type: "button", class: "qty-btn", "aria-label": `Disminuir ${item.nombre}`, onclick: () => fijarCantidad(item.id, item.cantidad - 1) }, icono("minus"));
  const mas = el("button", {
    type: "button",
    class: "qty-btn is-plus",
    "aria-label": `Aumentar ${item.nombre}`,
    disabled: item.stock > 0 && item.cantidad >= item.stock,
    onclick: () => {
      const resultado = fijarCantidad(item.id, item.cantidad + 1);
      if (resultado && resultado.ok === false) avisar(resultado.mensaje);
    }
  }, icono("plus"));
  const quitar = el("button", { type: "button", class: "text-btn", onclick: () => quitarProducto(item.id) }, `Quitar ${item.nombre}`);
  return el("article", { class: "cart-line" },
    media,
    info,
    el("div", { class: "qty" }, menos, el("span", { class: `qty-n ${dir}`.trim() }, String(item.cantidad)), mas),
    quitar
  );
}

let complementoSeq = 0;

async function complementosDe(items) {
  const ids = new Set(items.map((item) => String(item.id)));
  let grupos = [...new Set(items.map((item) => item.categoria).filter(Boolean))];
  if (!grupos.length) {
    const { data } = await supabase.from("productos").select("categoria").in("id", [...ids]);
    grupos = [...new Set((data || []).map((row) => row.categoria).filter(Boolean))];
  }
  if (!grupos.length) return [];
  const { data, error } = await supabase
    .from("productos")
    .select(COLUMNAS)
    .eq("activo", true)
    .eq("requiere_formula", false)
    .gt("stock", 0)
    .in("categoria", grupos)
    .limit(12);
  if (error || !data) return [];
  return data.filter((producto) => !ids.has(String(producto.id))).slice(0, 3);
}

async function cargarComplementos(cuerpo, items) {
  const id = ++complementoSeq;
  const bloque = el("section", { class: "complements" }, el("h3", {}, "Completa tu pedido"));
  cuerpo.append(bloque);
  const lista = await complementosDe(items);
  if (id !== complementoSeq || !bloque.isConnected) return;
  if (!lista.length) {
    bloque.remove();
    return;
  }
  bloque.append(...lista.map(tarjetaCorta));
}

export function pintarProgreso(raiz, resumen) {
  if (!raiz) return;
  const barra = raiz.querySelector("[data-progreso]");
  if (!barra) return;
  const activo = resumen.items.length > 0 && resumen.minimo > 0;
  barra.hidden = !activo;
  const n = activo ? Math.max(0, Math.min(1, resumen.subtotal / resumen.minimo)) : 0;
  barra.querySelector("[data-progreso-barra]")?.style.setProperty("--n", String(n));
  const completo = activo && n >= 1;
  barra.classList.toggle("is-full", completo);
  if (completo && !barra.querySelector(".progreso-ok")) {
    barra.querySelector(".progreso-pista")?.append(el("span", { class: "progreso-ok", "aria-hidden": "true" }));
  }
  const texto = barra.querySelector("[data-progreso-texto]");
  if (texto) texto.textContent = !activo ? "" : resumen.falta > 0 ? `Te faltan ${dinero(resumen.falta)}` : "Alcanzaste el pedido mínimo";
}

function solicitarVaciado(raiz) {
  if (raiz.querySelector("[data-confirma-vaciar]")) return;
  const caja = el("div", { class: "confirma", "data-confirma-vaciar": "true" },
    el("p", {}, "¿Vaciar el carrito?"),
    el("button", { type: "button", class: "btn btn-primary", onclick: () => vaciarCarrito() }, "Vaciar"),
    el("button", { type: "button", class: "btn btn-ghost", onclick: () => caja.remove() }, "Cancelar")
  );
  raiz.querySelector(".drawer-foot")?.append(caja);
}

export function pintarDrawer() {
  const cuerpo = document.querySelector("[data-cart-body]");
  if (!cuerpo) return;
  if (cuerpo.dataset.visto !== "1") {
    if (cuerpo.dataset.espera === "1") return;
    const falta = 250 - (performance.now() - Number(cuerpo.dataset.sk || performance.now()));
    if (falta > 0 && cuerpo.querySelector(".skeleton")) {
      cuerpo.dataset.espera = "1";
      setTimeout(() => {
        cuerpo.dataset.visto = "1";
        pintarDrawer();
      }, falta);
      return;
    }
    cuerpo.dataset.visto = "1";
  }
  const resumen = resumenCarrito(configActual.domicilio, configActual.pedido_minimo);
  cuerpo.replaceChildren();
  if (!resumen.items.length) {
    cuerpo.append(estadoVacio("bag", "Tu carrito está vacío", "Elige productos del catálogo para armar tu pedido.", el("a", { class: "btn btn-primary", href: "index.html#catalogo" }, "Ver catálogo")));
  } else {
    cuerpo.append(...resumen.items.map(lineaCarrito));
    cargarComplementos(cuerpo, resumen.items);
  }
  const raiz = document.getElementById("carrito");
  const subtotal = raiz.querySelector("[data-subtotal]");
  const domicilio = raiz.querySelector("[data-domicilio]");
  const total = raiz.querySelector("[data-total]");
  const minimo = raiz.querySelector("[data-minimo]");
  const pago = raiz.querySelector("[data-checkout]");
  animarDinero(subtotal, resumen.subtotal);
  animarDinero(domicilio, resumen.domicilio);
  animarDinero(total, resumen.total);
  pintarProgreso(raiz, resumen);
  if (minimo) minimo.hidden = true;
  const vaciar = raiz.querySelector("[data-vaciar]");
  if (vaciar) vaciar.hidden = !resumen.items.length;
  if (!resumen.items.length) raiz.querySelector("[data-confirma-vaciar]")?.remove();
  if (pago) {
    const cerrado = configActual.abierto === false;
    const bloqueado = !resumen.items.length || resumen.falta > 0 || cerrado;
    pago.setAttribute("aria-disabled", bloqueado ? "true" : "false");
    pago.tabIndex = bloqueado ? -1 : 0;
    pago.textContent = cerrado ? "Pago no disponible" : "Continuar al pago";
  }
  actualizarContador();
}

function focoEn(contenedor) {
  const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const lista = () => [...contenedor.querySelectorAll(selector)].filter((nodo) => !nodo.closest("[hidden]"));
  function tecla(evento) {
    if (evento.key === "Escape") {
      evento.preventDefault();
      cerrarCarrito();
      return;
    }
    if (evento.key !== "Tab") return;
    const nodos = lista();
    if (!nodos.length) return;
    const primero = nodos[0];
    const ultimo = nodos[nodos.length - 1];
    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }
  contenedor.addEventListener("keydown", tecla);
  const nodos = lista();
  (nodos.find((nodo) => nodo.hasAttribute("data-close-cart")) || nodos[0] || contenedor).focus();
  return () => contenedor.removeEventListener("keydown", tecla);
}

function asegurarDrawer() {
  if (document.getElementById("carrito")) return;
  const overlay = el("div", { class: "overlay", "data-overlay": "carrito", hidden: true });
  const drawer = el("aside", {
    class: "drawer",
    id: "carrito",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "carrito-titulo",
    tabindex: "-1",
    hidden: true
  });
  drawer.append(
    el("div", { class: "drawer-head" },
      el("h2", { id: "carrito-titulo" }, "Tu carrito"),
      el("button", { type: "button", class: "icon-btn", "data-close-cart": "true", "aria-label": "Cerrar carrito" }, icono("close"))
    ),
    el("div", { class: "drawer-body", "data-cart-body": "true" }, lineaEsqueleto(), lineaEsqueleto(), lineaEsqueleto()),
    el("div", { class: "drawer-foot" },
      el("div", { class: "progreso", "data-progreso": "true", hidden: true },
        el("div", { class: "progreso-pista", "aria-hidden": "true" }, el("span", { class: "progreso-barra", "data-progreso-barra": "true" })),
        el("p", { "data-progreso-texto": "true", role: "status" })
      ),
      el("div", { class: "sum-row" }, el("span", {}, "Subtotal estimado"), el("strong", { "data-subtotal": "true" }, dinero(0))),
      el("div", { class: "sum-row" }, el("span", {}, "Domicilio"), el("strong", { "data-domicilio": "true" }, dinero(0))),
      el("div", { class: "sum-row sum-total" }, el("span", {}, "Total estimado"), el("strong", { "data-total": "true" }, dinero(0))),
      el("p", { class: "hint", "data-minimo": "true", hidden: true }),
      el("p", { class: "fine" }, "El total definitivo lo calcula la droguería al confirmar el pedido."),
      el("button", { type: "button", class: "btn btn-ghost", "data-vaciar": "true", hidden: true }, "Vaciar carrito"),
      el("a", { class: "btn btn-primary", href: "pagar.html", "data-checkout": "true" }, "Continuar al pago")
    )
  );
  overlay.addEventListener("click", cerrarCarrito);
  drawer.addEventListener("click", (evento) => {
    if (evento.target.closest("[data-close-cart]")) cerrarCarrito();
  });
  const pago = drawer.querySelector("[data-checkout]");
  pago.addEventListener("click", (evento) => {
    if (pago.getAttribute("aria-disabled") === "true") evento.preventDefault();
  });
  drawer.querySelector("[data-vaciar]")?.addEventListener("click", () => solicitarVaciado(drawer));
  document.body.append(overlay, drawer);
  const cuerpo = drawer.querySelector("[data-cart-body]");
  marcarEsqueleto(cuerpo);
}

export function abrirCarrito() {
  const overlay = document.querySelector("[data-overlay='carrito']");
  const drawer = document.getElementById("carrito");
  if (!drawer || drawer.classList.contains("is-open")) return;
  abrirCarrito.previo = document.activeElement;
  overlay.hidden = false;
  drawer.hidden = false;
  document.documentElement.classList.add("scroll-lock");
  requestAnimationFrame(() => {
    overlay.classList.add("is-open");
    drawer.classList.add("is-open");
  });
  document.querySelectorAll("[data-open-cart]").forEach((boton) => boton.setAttribute("aria-expanded", "true"));
  soltarFoco = focoEn(drawer);
  leerConfig(true).then((cfg) => {
    configActual = cfg;
    mostrarCierre(cfg.abierto);
    pintarDrawer();
  });
}

export function cerrarCarrito() {
  const overlay = document.querySelector("[data-overlay='carrito']");
  const drawer = document.getElementById("carrito");
  if (!drawer || !drawer.classList.contains("is-open")) return;
  overlay.classList.remove("is-open");
  drawer.classList.remove("is-open");
  document.documentElement.classList.remove("scroll-lock");
  document.querySelectorAll("[data-open-cart]").forEach((boton) => boton.setAttribute("aria-expanded", "false"));
  if (soltarFoco) soltarFoco();
  soltarFoco = null;
  const ocultar = () => {
    if (drawer.classList.contains("is-open")) return;
    overlay.hidden = true;
    drawer.hidden = true;
  };
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) ocultar();
  else drawer.addEventListener("transitionend", ocultar, { once: true });
  if (abrirCarrito.previo && abrirCarrito.previo.focus) abrirCarrito.previo.focus();
}

function mostrarCierre(abierto) {
  const banner = document.querySelector("[data-cerrado]");
  if (!banner) return;
  if (!banner.textContent.trim()) banner.textContent = AVISO_CERRADO;
  const visible = abierto === false;
  banner.hidden = !visible;
  document.body.classList.toggle("is-closed", visible);
  if (visible) document.documentElement.style.setProperty("--cerrado-h", `${banner.offsetHeight}px`);
}

function accesosCuenta() {
  const cart = document.querySelector(".header .cart-button");
  if (cart && !document.querySelector("[data-favoritos-nav]")) {
    const caja = el("div", { class: "nav-acciones" });
    const fav = el("a", {
      class: "fav-nav",
      href: "favoritos.html",
      "data-favoritos-nav": "true",
      "aria-label": "Favoritos"
    }, icono("heart"));
    if (document.body.dataset.page === "favoritos") fav.setAttribute("aria-current", "page");
    cart.replaceWith(caja);
    caja.append(fav, cart);
  }
  const info = [...document.querySelectorAll(".footer-grid section")].find((seccion) => seccion.querySelector("h2")?.textContent === "Información");
  if (info && !info.querySelector("a[href='favoritos.html']")) {
    const enlace = el("a", { href: "favoritos.html" }, "Favoritos");
    const seguir = [...info.querySelectorAll("a")].find((nodo) => nodo.getAttribute("href") === "seguimiento.html");
    if (seguir) seguir.before(enlace);
    else info.append(enlace);
  }
}

function navegacion() {
  document.querySelectorAll("[data-open-cart]").forEach((boton) => {
    boton.addEventListener("click", abrirCarrito);
  });
  const buscar = document.querySelector("[data-tab='buscar']");
  if (buscar && document.body.dataset.page === "inicio") {
    buscar.addEventListener("click", (evento) => {
      evento.preventDefault();
      const input = document.getElementById("buscar");
      document.getElementById("catalogo")?.scrollIntoView({ block: "start", behavior: "auto" });
      input?.focus();
    });
  }
  if (location.hash === "#carrito") abrirCarrito();
  window.addEventListener("hashchange", () => {
    if (location.hash === "#carrito") abrirCarrito();
  });
}

function cabeceraFija() {
  const header = document.querySelector("[data-header]");
  if (!header) return;
  const aplicar = () => header.classList.toggle("is-stuck", window.scrollY > 4);
  aplicar();
  window.addEventListener("scroll", aplicar, { passive: true });
}

function aplicarRobots() {
  const meta = document.querySelector("meta[name='robots']");
  if (!meta) return;
  const pagina = document.body?.dataset.page || "";
  const privado = pagina === "admin" || pagina === "login" || pagina === "ausente";
  meta.content = privado || negocio.modoPrueba ? "noindex, nofollow" : "index, follow";
}

function pintarHorario() {
  const estado = estadoHorario();
  document.querySelectorAll("[data-horario]").forEach((nodo) => {
    nodo.textContent = estado.texto;
    nodo.classList.toggle("is-open", estado.abierto);
    nodo.classList.toggle("is-closed", !estado.abierto);
  });
}

function prepararWhatsapp() {
  document.querySelectorAll("[data-wa]").forEach((nodo) => {
    const accion = nodo.dataset.wa === "pedido" ? "Enviar pedido por WhatsApp" : nodo.dataset.wa === "consultar" ? "Consultar" : "Atención";
    const textos = {
      atencion: `Hola. Quiero atención en ${negocio.nombre}.`,
      pedido: `Hola. Quiero información de mi pedido en ${negocio.nombre}.`,
      consultar: `Hola. Quiero consultar un producto en ${negocio.nombre}.`
    };
    const url = enlaceWhatsapp(textos[nodo.dataset.wa] || textos.atencion);
    nodo.disabled = false;
    nodo.textContent = accion;
    nodo.setAttribute("aria-label", accion);
    nodo.addEventListener("click", (evento) => {
      evento.preventDefault();
      if (url) window.open(url, "_blank", "noopener");
    });
  });
}

function cargarMapas() {
  const mapas = document.querySelectorAll("[data-mapa]");
  if (!mapas.length) return;
  const montar = (nodo) => {
    if (nodo.dataset.listo) return;
    nodo.dataset.listo = "1";
    nodo.replaceChildren(el("iframe", {
      src: nodo.dataset.src || negocio.mapsEmbed,
      title: "Mapa de Droguerías Reina en la Calle 13 No. 11-06, Funza",
      loading: "lazy",
      referrerpolicy: "no-referrer-when-downgrade"
    }));
  };
  if (!("IntersectionObserver" in window)) {
    mapas.forEach(montar);
    return;
  }
  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => {
      if (!entrada.isIntersecting) return;
      montar(entrada.target);
      observador.unobserve(entrada.target);
    });
  }, { rootMargin: "160px 0px" });
  mapas.forEach((nodo) => observador.observe(nodo));
}

const TEXTOS_PAGO = {
  distintivo: {
    pronto: "Pagas al recibir: efectivo o transferencia. Pronto, pago en línea.",
    activo: "Paga en línea con tarjeta, PSE y Nequi, o al recibir en efectivo o transferencia."
  },
  medios: {
    pronto: "Efectivo y transferencia al recibir. Próximamente: tarjetas, PSE y Nequi.",
    activo: "Efectivo, transferencia y pago en línea con tarjeta, PSE y Nequi."
  },
  faq: {
    pronto: "Muy pronto vas a poder pagar en línea con tarjeta, PSE y Nequi. Por ahora pagas al recibir tu pedido, en efectivo o por transferencia.",
    activo: "Puedes pagar en línea con tarjeta, PSE y Nequi, o al recibir tu pedido en efectivo o por transferencia."
  }
};

function aplicarTextosPago() {
  const modo = negocio.pagoEnLinea ? "activo" : "pronto";
  document.querySelectorAll("[data-pago-texto]").forEach((nodo) => {
    const grupo = TEXTOS_PAGO[nodo.dataset.pagoTexto];
    if (!grupo) return;
    nodo.textContent = grupo[modo];
  });
}

let vigilando = false;

export function pintarConteoPedidos(cantidad) {
  const total = Math.max(0, Number(cantidad) || 0);
  document.querySelectorAll("[data-pedidos-aviso]").forEach((nodo) => {
    nodo.hidden = total < 1;
    nodo.textContent = total ? String(total) : "";
  });
  document.querySelectorAll("[data-mis-pedidos]").forEach((enlace) => {
    if (total > 0) enlace.setAttribute("aria-label", `Mis pedidos, ${total} en curso`);
    else enlace.removeAttribute("aria-label");
  });
}

function pintarFranja(pedido) {
  const franja = document.querySelector("[data-pedido-franja]");
  if (!franja) return;
  const texto = textoFranja(pedido);
  const nodo = franja.querySelector("[data-pedido-franja-texto]");
  if (!texto) {
    franja.hidden = true;
    if (nodo) nodo.textContent = "";
    return;
  }
  if (nodo && nodo.textContent !== texto) nodo.textContent = texto;
  franja.hidden = false;
}

async function vigilarPedidos() {
  if (vigilando) return;
  const locales = leerPedidosLocal();
  if (!locales.length) {
    pintarConteoPedidos(0);
    pintarFranja(null);
    return;
  }
  vigilando = true;
  try {
    const { data, error } = await supabase.rpc("estado_pedidos", { p_tokens: locales.map((row) => row.token) });
    if (error) return;
    const remotos = (Array.isArray(data) ? data : []).map((row) => interpretarPedido(row)).filter(Boolean);
    reemplazarPedidosLocal(fusionarEstados(leerPedidosLocal(), remotos));
    pintarConteoPedidos(remotos.filter((pedido) => esActivo(pedido.estado)).length);
    pintarFranja(pedidoActivoReciente(remotos));
    if (document.body.dataset.page === "inicio") cambiosDeEstado(remotos).forEach((texto) => avisar(texto));
  } catch {
    return;
  } finally {
    vigilando = false;
  }
}

export function iniciarLayout() {
  aplicarLegal();
  medirHeader();
  llenarNegocio();
  aplicarTextosPago();
  aplicarRobots();
  pintarHorario();
  prepararWhatsapp();
  cargarMapas();
  esquema();
  llenarBarrios();
  asegurarDrawer();
  pintarDrawer();
  accesosCuenta();
  iniciarBusqueda();
  iniciarMicro();
  iniciarTilt();
  navegacion();
  cabeceraFija();
  setInterval(pintarHorario, 60000);
  document.addEventListener("reina:carrito", pintarDrawer);
  document.addEventListener("reina:aviso", (evento) => avisar(evento.detail));
  if (document.body?.dataset.page === "pedidos") {
    document.querySelectorAll("[data-mis-pedidos]").forEach((nodo) => nodo.setAttribute("aria-current", "page"));
  } else {
    vigilarPedidos();
  }
  if (document.body?.dataset.page === "inicio") {
    setInterval(() => {
      if (document.visibilityState !== "visible") return;
      vigilarPedidos();
    }, 30000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") vigilarPedidos();
    });
  }
  iniciarPwa();
  leerConfig().then((cfg) => {
    configActual = cfg;
    mostrarCierre(cfg.abierto);
    pintarDrawer();
    document.dispatchEvent(new CustomEvent("reina:config", { detail: cfg }));
  });
}

export function categoriasTienda() {
  return categorias;
}
