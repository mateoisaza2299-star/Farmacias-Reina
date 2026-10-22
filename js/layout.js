import { negocio, categorias, AVISO_CERRADO, AVISO_FORMULA } from "./config.js";
import { leerConfig } from "./datos.js";
import { contarCarrito, fijarCantidad, quitarProducto, resumenCarrito } from "./cart.js";
import { dinero, marcaVisible, sanearBusqueda } from "./format.js";
import { el, fragmento } from "./dom.js";
import { icono } from "./icons.js";
import { supabase } from "./supabase.js";
import { PORTADA, rutaImagen } from "./ilustraciones.js";

let configActual = { domicilio: 0, pedido_minimo: 0, abierto: true };
let soltarFoco = null;

export function obtenerConfig() {
  return configActual;
}

export function avisar(texto) {
  let pila = document.querySelector(".toasts");
  if (!pila) {
    pila = el("div", { class: "toasts", "aria-live": "polite" });
    document.body.append(pila);
  }
  const toast = el("div", { class: "toast", role: "status" }, texto);
  pila.append(toast);
  requestAnimationFrame(() => toast.classList.add("is-on"));
  setTimeout(() => {
    toast.classList.remove("is-on");
    setTimeout(() => toast.remove(), 400);
  }, 2800);
}

export function volarAlCarrito(imagen) {
  if (!imagen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    rebotarContador();
    return;
  }
  const destino = document.querySelector(window.matchMedia("(max-width: 767px)").matches ? ".tabbar [data-open-cart]" : ".header [data-open-cart]");
  if (!destino) return;
  const desde = imagen.getBoundingClientRect();
  const hacia = destino.getBoundingClientRect();
  const clon = imagen.cloneNode(true);
  clon.className = "fly-img";
  clon.alt = "";
  clon.style.left = `${desde.left}px`;
  clon.style.top = `${desde.top}px`;
  clon.style.width = `${Math.max(desde.width, 48)}px`;
  clon.style.height = `${Math.max(desde.height, 48)}px`;
  document.body.append(clon);
  const dx = hacia.left + hacia.width / 2 - (desde.left + desde.width / 2);
  const dy = hacia.top + hacia.height / 2 - (desde.top + desde.height / 2);
  requestAnimationFrame(() => {
    clon.style.transform = `translate(${dx}px, ${dy}px) scale(0.15)`;
    clon.style.opacity = "0.2";
  });
  const limpiar = () => clon.remove();
  clon.addEventListener("transitionend", limpiar, { once: true });
  setTimeout(limpiar, 700);
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

function ponerCampo(nodo, texto) {
  nodo.replaceChildren(fragmento(texto));
}

function llenarNegocio() {
  const anio = document.querySelector("[data-year]");
  if (anio) anio.textContent = String(new Date().getFullYear());
  const mapa = {
    razon: negocio.razonSocial,
    nit: `NIT ${negocio.nit}`,
    regente: `Regente de farmacia: ${negocio.regente}`,
    direccion: negocio.direccion,
    horario: negocio.horario,
    cobertura: `${negocio.coberturaNota}. Zonas: ${negocio.zonas.join(", ")}.`
  };
  document.querySelectorAll("[data-field]").forEach((nodo) => {
    const campo = nodo.dataset.field;
    if (mapa[campo]) ponerCampo(nodo, mapa[campo]);
  });
  const tel = document.querySelector("[data-field='telefono']");
  if (tel) {
    const digitos = negocio.telefono.replace(/\D/g, "");
    tel.replaceChildren();
    if (digitos) {
      const enlace = el("a", { href: `tel:+${digitos}` });
      enlace.append(fragmento(negocio.telefono));
      tel.append(enlace);
    } else tel.append(fragmento(negocio.telefono));
  }
  const wa = document.querySelector("[data-field='whatsapp']");
  if (wa) {
    const digitos = negocio.whatsapp.replace(/\D/g, "");
    wa.replaceChildren();
    if (digitos) {
      const enlace = el("a", { href: `https://wa.me/${digitos}`, target: "_blank", rel: "noopener noreferrer" }, "WhatsApp");
      wa.append(enlace);
    } else wa.append(fragmento(`WhatsApp ${negocio.whatsapp}`));
  }
  document.querySelectorAll("[data-nombre]").forEach((nodo) => {
    nodo.textContent = negocio.nombre;
  });
  document.querySelectorAll(".editar").forEach((nodo) => {
    nodo.className = "por-confirmar";
    nodo.textContent = "Por confirmar";
  });
}

function esquema() {
  const datos = {
    "@context": "https://schema.org",
    "@type": "Pharmacy",
    name: negocio.nombre,
    url: location.href,
    image: new URL("assets/og.png", location.href).href,
    address: {
      "@type": "PostalAddress",
      addressLocality: negocio.ciudad,
      addressRegion: negocio.departamento,
      addressCountry: "CO"
    },
    areaServed: negocio.zonas.map((zona) => ({ "@type": "Place", name: `${zona}, ${negocio.ciudad}` })),
    currenciesAccepted: "COP"
  };
  if (!negocio.direccion.includes("EDITAR")) datos.address.streetAddress = negocio.direccion;
  if (!negocio.telefono.includes("EDITAR")) datos.telephone = negocio.telefono;
  if (!negocio.horario.includes("EDITAR")) datos.openingHours = negocio.horario;
  let script = document.getElementById("datos-farmacia");
  if (!script) {
    script = document.createElement("script");
    script.id = "datos-farmacia";
    script.type = "application/ld+json";
    document.head.append(script);
  }
  script.textContent = JSON.stringify(datos);
  const canon = document.querySelector("link[rel='canonical']");
  if (canon && location.protocol.startsWith("http")) canon.href = `${location.origin}${location.pathname}`;
  const og = document.querySelector("meta[property='og:url']");
  if (og && location.protocol.startsWith("http")) og.content = location.href;
  const imagen = document.querySelector("meta[property='og:image']");
  if (imagen) imagen.content = new URL("assets/og.png", location.href).href;
}

function revelar() {
  const nodos = document.querySelectorAll(".reveal");
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    nodos.forEach((nodo) => nodo.classList.add("is-in"));
    return;
  }
  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => {
      if (!entrada.isIntersecting) return;
      entrada.target.classList.add("is-in");
      observador.unobserve(entrada.target);
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -8% 0px" });
  nodos.forEach((nodo) => observador.observe(nodo));
}

function llenarBarrios() {
  const guardado = localStorage.getItem("barrio_reina") || "";
  document.querySelectorAll("[data-barrio]").forEach((select) => {
    const actual = select.value || guardado;
    select.replaceChildren(el("option", { value: "" }, "Elige barrio"));
    const zonas = [...negocio.zonas];
    if (guardado && !zonas.includes(guardado)) zonas.push(guardado);
    zonas.forEach((zona) => select.append(el("option", { value: zona }, zona)));
    if (actual && [...select.options].some((opcion) => opcion.value === actual)) select.value = actual;
    if (!select.dataset.listo) {
      select.dataset.listo = "true";
      select.addEventListener("change", () => {
        localStorage.setItem("barrio_reina", select.value);
        document.querySelectorAll("[data-barrio]").forEach((otro) => {
          if (otro !== select) otro.value = select.value;
        });
        document.dispatchEvent(new CustomEvent("reina:barrio", { detail: select.value }));
      });
    }
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

function lineaCarrito(item) {
  const media = el("div", { class: "line-media" });
  if (item.imagen) {
    const img = el("img", { src: item.imagen, alt: "" });
    img.addEventListener("error", () => img.remove());
    media.append(img);
  }
  const meta = [marcaVisible(item.marca), item.presentacion].filter(Boolean).join(" · ");
  const info = el("div", { class: "line-info" },
    el("p", { class: "line-name" }, item.nombre),
    meta ? el("p", { class: "line-meta" }, meta) : null,
    item.requiere_formula ? el("p", { class: "tag tag-rx" }, "Requiere fórmula médica") : null,
    el("p", { class: "line-price" }, dinero(item.precio * item.cantidad))
  );
  const menos = el("button", { type: "button", class: "qty-btn", "aria-label": `Disminuir ${item.nombre}`, onclick: () => fijarCantidad(item.id, item.cantidad - 1) }, icono("minus"));
  const mas = el("button", {
    type: "button",
    class: "qty-btn",
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
    el("div", { class: "qty" }, menos, el("span", {}, String(item.cantidad)), mas),
    quitar
  );
}

export function pintarDrawer() {
  const cuerpo = document.querySelector("[data-cart-body]");
  if (!cuerpo) return;
  const resumen = resumenCarrito(configActual.domicilio, configActual.pedido_minimo);
  cuerpo.replaceChildren();
  if (!resumen.items.length) {
    cuerpo.append(el("div", { class: "empty-mini" },
      icono("bag"),
      el("p", {}, "Tu carrito está vacío."),
      el("a", { class: "btn btn-ghost", href: "index.html#catalogo" }, "Ver catálogo")
    ));
  } else cuerpo.append(...resumen.items.map(lineaCarrito));
  const raiz = document.getElementById("carrito");
  const subtotal = raiz.querySelector("[data-subtotal]");
  const domicilio = raiz.querySelector("[data-domicilio]");
  const total = raiz.querySelector("[data-total]");
  const minimo = raiz.querySelector("[data-minimo]");
  const pago = raiz.querySelector("[data-checkout]");
  if (subtotal) subtotal.textContent = dinero(resumen.subtotal);
  if (domicilio) domicilio.textContent = dinero(resumen.domicilio);
  if (total) total.textContent = dinero(resumen.total);
  if (minimo) {
    const corto = resumen.items.length > 0 && resumen.falta > 0;
    minimo.hidden = !corto;
    minimo.textContent = corto ? `El pedido mínimo es ${dinero(resumen.minimo)}. Te faltan ${dinero(resumen.falta)}.` : "";
  }
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
    el("div", { class: "drawer-body", "data-cart-body": "true" }),
    el("div", { class: "drawer-foot" },
      el("div", { class: "sum-row" }, el("span", {}, "Subtotal estimado"), el("strong", { "data-subtotal": "true" }, dinero(0))),
      el("div", { class: "sum-row" }, el("span", {}, "Domicilio"), el("strong", { "data-domicilio": "true" }, dinero(0))),
      el("div", { class: "sum-row sum-total" }, el("span", {}, "Total estimado"), el("strong", { "data-total": "true" }, dinero(0))),
      el("p", { class: "hint", "data-minimo": "true", hidden: true }),
      el("p", { class: "fine" }, "El total definitivo lo calcula la droguería al confirmar el pedido."),
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
  document.body.append(overlay, drawer);
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

const sugeridos = new Map();
let indiceSug = -1;
let buscarTimer = 0;
let sugToken = 0;

function listaSugerencias() {
  return document.getElementById("sugerencias");
}

function cerrarSugerencias() {
  const lista = listaSugerencias();
  if (!lista) return;
  lista.hidden = true;
  lista.replaceChildren();
  indiceSug = -1;
  document.getElementById("buscar")?.setAttribute("aria-expanded", "false");
  document.getElementById("buscar")?.removeAttribute("aria-activedescendant");
}

function marcarSugerencia() {
  const lista = listaSugerencias();
  if (!lista) return;
  [...lista.children].forEach((nodo, i) => {
    nodo.classList.toggle("is-on", i === indiceSug);
    if (i === indiceSug) nodo.scrollIntoView({ block: "nearest" });
  });
  const activo = lista.children[indiceSug];
  const input = document.getElementById("buscar");
  if (!input) return;
  if (activo) input.setAttribute("aria-activedescendant", activo.id);
  else input.removeAttribute("aria-activedescendant");
}

function elegirSugerencia(producto) {
  cerrarSugerencias();
  if (document.body.dataset.page === "inicio") {
    document.dispatchEvent(new CustomEvent("reina:producto", { detail: producto }));
    return;
  }
  location.href = `index.html?producto=${encodeURIComponent(producto.id)}`;
}

async function pedirSugerencias(texto) {
  const token = ++sugToken;
  const lista = listaSugerencias();
  const q = sanearBusqueda(texto);
  if (!lista || q.length < 2) {
    cerrarSugerencias();
    return;
  }
  const cat = document.querySelector("[data-search-cat]")?.value || "";
  let consulta = supabase
    .from("productos")
    .select("id,nombre,marca,presentacion,precio,imagen,categoria,stock,requiere_formula,activo,precio_anterior")
    .eq("activo", true);
  if (categorias.some((item) => item.id === cat)) consulta = consulta.eq("categoria", cat);
  const { data, error } = await consulta.or(`nombre.ilike.%${q}%,marca.ilike.%${q}%`).limit(6);
  if (token !== sugToken || texto !== document.getElementById("buscar")?.value) return;
  if (error || !data?.length) {
    cerrarSugerencias();
    return;
  }
  sugeridos.clear();
  lista.replaceChildren(...data.map((producto) => {
    sugeridos.set(String(producto.id), producto);
    const img = el("img", { src: rutaImagen(producto), alt: "", width: "40", height: "40" });
    img.addEventListener("error", () => {
      const reserva = rutaImagen({ ...producto, imagen: "" });
      if (img.getAttribute("src") !== reserva) img.src = reserva;
    });
    const opcion = el("li", { role: "option", id: `sug-${producto.id}`, "data-sug": producto.id },
      img,
      el("span", {}, producto.nombre),
      el("strong", {}, dinero(producto.precio))
    );
    opcion.addEventListener("mousedown", (evento) => evento.preventDefault());
    opcion.addEventListener("click", () => elegirSugerencia(producto));
    return opcion;
  }));
  lista.hidden = false;
  document.getElementById("buscar")?.setAttribute("aria-expanded", "true");
  indiceSug = -1;
}

function busqueda() {
  const params = new URLSearchParams(location.search);
  const inicial = params.get("q") || "";
  const categoria = params.get("categoria") || "";
  document.querySelectorAll("[data-search-cat]").forEach((select) => {
    if ([...select.options].some((opcion) => opcion.value === categoria)) select.value = categoria;
  });
  document.querySelectorAll("[data-search-input]").forEach((input) => {
    if (inicial) input.value = inicial;
    input.addEventListener("input", () => {
      clearTimeout(buscarTimer);
      buscarTimer = setTimeout(() => pedirSugerencias(input.value), 180);
    });
    input.addEventListener("keydown", (evento) => {
      const lista = listaSugerencias();
      const abierto = lista && !lista.hidden && lista.children.length;
      if (!abierto) return;
      if (evento.key === "ArrowDown") {
        evento.preventDefault();
        indiceSug = Math.min(lista.children.length - 1, indiceSug + 1);
        marcarSugerencia();
      } else if (evento.key === "ArrowUp") {
        evento.preventDefault();
        indiceSug = Math.max(0, indiceSug - 1);
        marcarSugerencia();
      } else if (evento.key === "Escape") {
        cerrarSugerencias();
      } else if (evento.key === "Enter" && indiceSug >= 0) {
        evento.preventDefault();
        const producto = sugeridos.get(lista.children[indiceSug].dataset.sug);
        if (producto) elegirSugerencia(producto);
      }
    });
  });
  document.addEventListener("click", (evento) => {
    if (!evento.target.closest(".search-wrap")) cerrarSugerencias();
  });
  document.querySelectorAll("[data-search-form]").forEach((form) => {
    form.addEventListener("submit", (evento) => {
      evento.preventDefault();
      const input = form.querySelector("[data-search-input]");
      const select = form.querySelector("[data-search-cat]");
      const q = input ? input.value.trim() : "";
      const cat = select ? select.value : "";
      cerrarSugerencias();
      if (document.body.dataset.page === "inicio") {
        document.dispatchEvent(new CustomEvent("reina:buscar", { detail: { q, categoria: cat } }));
        return;
      }
      const url = new URL("index.html", location.href);
      if (q) url.searchParams.set("q", q);
      if (cat) url.searchParams.set("categoria", cat);
      url.hash = "catalogo";
      location.href = `${url.pathname}${url.search}${url.hash}`;
    });
  });
}

let menuCats = null;

function asegurarMenu() {
  if (menuCats) return menuCats;
  const grid = el("div", { class: "mega-grid" });
  categorias.forEach((categoria) => {
    grid.append(el("a", {
      href: `index.html?categoria=${encodeURIComponent(categoria.id)}#catalogo`,
      "data-cat-link": "",
      "data-cat": categoria.id
    },
      el("img", { src: PORTADA[categoria.id] || PORTADA.Medicamentos, alt: "", width: "72", height: "72" }),
      el("span", {}, categoria.nombre)
    ));
  });
  menuCats = el("div", { class: "mega", id: "menu-categorias", hidden: true },
    el("div", { class: "mega-card" }, el("h2", {}, "Todas las categorías"), grid)
  );
  document.body.append(menuCats);
  return menuCats;
}

function cerrarMenu() {
  if (!menuCats || menuCats.hidden) return;
  menuCats.hidden = true;
  document.querySelectorAll("[data-open-cats]").forEach((boton) => boton.setAttribute("aria-expanded", "false"));
}

function abrirMenu() {
  const menu = asegurarMenu();
  menu.hidden = false;
  document.querySelectorAll("[data-open-cats]").forEach((boton) => boton.setAttribute("aria-expanded", "true"));
}

function marcarCategorias() {
  const params = new URLSearchParams(location.search);
  const cat = params.get("categoria") || "";
  const vista = params.get("vista") || "";
  const catalogo = Boolean(cat || params.get("q") || vista === "catalogo");
  document.querySelectorAll(".cat-bar [data-cat-link]").forEach((link) => {
    link.classList.toggle("is-on", catalogo && !vista.startsWith("oferta") && vista !== "nuevos" && (link.dataset.cat || "") === cat);
  });
}

function navegacion() {
  document.querySelectorAll("[data-open-cart]").forEach((boton) => {
    boton.addEventListener("click", abrirCarrito);
  });
  document.addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-open-cats]");
    if (boton) {
      evento.preventDefault();
      if (menuCats && !menuCats.hidden) cerrarMenu();
      else abrirMenu();
      return;
    }
    if (evento.target.closest("[data-cat-link]")) cerrarMenu();
    else if (menuCats && !menuCats.hidden && !evento.target.closest("#menu-categorias")) cerrarMenu();
  });
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && menuCats && !menuCats.hidden) {
      evento.preventDefault();
      cerrarMenu();
    }
  });
  const buscar = document.querySelector("[data-tab='buscar']");
  if (buscar && document.body.dataset.page === "inicio") {
    buscar.addEventListener("click", (evento) => {
      evento.preventDefault();
      document.getElementById("buscar")?.focus();
    });
  }
  if (location.hash === "#carrito") abrirCarrito();
  window.addEventListener("hashchange", () => {
    if (location.hash === "#carrito") abrirCarrito();
  });
  marcarCategorias();
  document.addEventListener("reina:filtros", marcarCategorias);
}

function cabeceraFija() {
  const header = document.querySelector("[data-header]");
  if (!header) return;
  let ultimo = window.scrollY;
  const aplicar = () => {
    const y = window.scrollY;
    header.classList.toggle("is-stuck", y > 4);
    if (y < 40) header.classList.remove("is-compact");
    else if (y > ultimo + 4) header.classList.add("is-compact");
    else if (y < ultimo - 4) header.classList.remove("is-compact");
    ultimo = y;
  };
  aplicar();
  window.addEventListener("scroll", aplicar, { passive: true });
}

function avisoLegal() {
  if (document.querySelector(".rx-legal")) return;
  const nota = el("p", { class: "rx-legal", title: AVISO_FORMULA }, AVISO_FORMULA);
  document.body.append(nota);
  const aplicar = () => document.documentElement.style.setProperty("--legal-h", `${nota.offsetHeight}px`);
  aplicar();
  if ("ResizeObserver" in window) new ResizeObserver(aplicar).observe(nota);
}

function prepararWhatsapp() {
  const digitos = String(negocio.whatsapp || "").replace(/\D/g, "");
  if (!digitos) return;
  document.querySelectorAll("[data-whatsapp]").forEach((nodo) => {
    nodo.href = `https://wa.me/${digitos}`;
    nodo.target = "_blank";
    nodo.rel = "noopener noreferrer";
  });
}

function pintarBeta() {
  if (negocio.beta !== true) return;
  const logo = document.querySelector(".header .logo");
  const place = logo?.querySelector(".logo-place");
  if (logo && place && !logo.querySelector(".beta-badge")) {
    const fila = el("span", { class: "logo-sub" });
    const aviso = el("span", {
      class: "beta-tip",
      id: "beta-aviso",
      role: "tooltip"
    }, "Versión de prueba: los productos, precios e imágenes son de ejemplo");
    place.replaceWith(fila);
    fila.append(place, el("span", { class: "beta-badge" }, "BETA", aviso));
    logo.setAttribute("aria-describedby", "beta-aviso");
  }
  const footer = document.querySelector(".footer");
  if (footer && !footer.querySelector(".footer-beta")) {
    const linea = el("p", { class: "footer-beta container" }, "Versión beta. Los productos y precios son de ejemplo.");
    const base = footer.querySelector(".footer-base");
    if (base) footer.insertBefore(linea, base);
    else footer.append(linea);
  }
}

export function iniciarLayout() {
  medirHeader();
  llenarNegocio();
  pintarBeta();
  esquema();
  revelar();
  llenarBarrios();
  asegurarDrawer();
  pintarDrawer();
  busqueda();
  navegacion();
  cabeceraFija();
  avisoLegal();
  prepararWhatsapp();
  document.addEventListener("reina:carrito", pintarDrawer);
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
