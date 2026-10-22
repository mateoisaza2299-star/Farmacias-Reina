import { categorias, AVISO_FORMULA, ofertasFlashFin } from "./config.js";
import { supabase } from "./supabase.js";
import { el } from "./dom.js";
import { icono } from "./icons.js";
import { descuento, dinero, esFormula, marcaVisible, sanearBusqueda } from "./format.js";
import { agregarProducto, fijarCantidad, leerCarrito, quitarProducto, sincronizarCarrito } from "./cart.js";
import { avisar, cerrarCarrito, volarAlCarrito } from "./layout.js";
import { ilustracionDe, PORTADA, rutaImagen } from "./ilustraciones.js";
import { alternarFavorito, esFavorito } from "./favoritos.js";

export const COLUMNAS = "id,nombre,marca,presentacion,categoria,precio,precio_anterior,stock,requiere_formula,activo,imagen";
const POR_PAGINA = 24;
const ORDENES = new Set(["nombre.asc", "nombre.desc", "precio.asc", "precio.desc"]);

const estado = {
  categoria: "",
  orden: "nombre.asc",
  q: "",
  vista: "",
  pagina: 1,
  total: 0
};

const cache = new Map();
let secuencia = 0;
let fichaAbierta = null;
let soltarFicha = null;
let inicioListo = false;
let reloj = 0;
let carrusel = null;
let observadorArte = null;
let accionesListas = false;

function reducido() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function angosto() {
  return window.matchMedia("(max-width: 767px)").matches;
}

function recordar(producto) {
  if (producto && producto.id != null) cache.set(String(producto.id), producto);
  return producto;
}

function modoCatalogo() {
  return Boolean(estado.q || estado.categoria || estado.vista);
}

function leerUrl() {
  const params = new URLSearchParams(location.search);
  const categoria = params.get("categoria") || "";
  estado.categoria = categorias.some((item) => item.id === categoria) ? categoria : "";
  const orden = params.get("orden") || "nombre.asc";
  estado.orden = ORDENES.has(orden) ? orden : "nombre.asc";
  estado.q = params.get("q") || "";
  const vista = params.get("vista") || "";
  estado.vista = vista === "ofertas" || vista === "nuevos" || vista === "catalogo" ? vista : "";
  const pagina = Number(params.get("pagina"));
  estado.pagina = Number.isInteger(pagina) && pagina > 0 ? pagina : 1;
  if (!estado.q && !estado.categoria && !estado.vista && location.hash === "#catalogo") estado.vista = "catalogo";
  const ordenSelect = document.querySelector("[data-sort]");
  if (ordenSelect) ordenSelect.value = estado.orden;
  document.querySelectorAll("[data-search-input]").forEach((input) => {
    input.value = estado.q;
  });
  document.querySelectorAll("[data-search-cat]").forEach((select) => {
    if ([...select.options].some((opcion) => opcion.value === estado.categoria)) select.value = estado.categoria;
  });
}

function escribirUrl() {
  const url = new URL(location.href);
  const poner = (clave, valor, vacio) => {
    if (valor && valor !== vacio) url.searchParams.set(clave, valor);
    else url.searchParams.delete(clave);
  };
  poner("q", estado.q, "");
  poner("categoria", estado.categoria, "");
  poner("orden", estado.orden, "nombre.asc");
  poner("vista", estado.vista, "");
  if (estado.pagina > 1) url.searchParams.set("pagina", String(estado.pagina));
  else url.searchParams.delete("pagina");
  url.searchParams.delete("producto");
  const hash = modoCatalogo() ? "#catalogo" : "";
  history.replaceState(null, "", `${url.pathname}${url.search}${hash}`);
  document.dispatchEvent(new CustomEvent("reina:filtros"));
}

function foto(producto) {
  const caja = el("div", { class: "product-art" });
  const reserva = ilustracionDe(producto);
  const img = el("img", {
    src: rutaImagen(producto),
    alt: [producto.nombre, producto.presentacion].filter(Boolean).join(", "),
    width: "320",
    height: "320",
    loading: "lazy",
    decoding: "async"
  });
  img.addEventListener("error", () => {
    if (img.getAttribute("src") !== reserva) {
      img.setAttribute("src", reserva);
      return;
    }
    img.remove();
  });
  caja.append(img, el("span", { class: "product-glint", "aria-hidden": "true" }));
  return caja;
}

function precios(producto) {
  const formula = esFormula(producto.requiere_formula);
  const off = formula ? 0 : descuento(producto.precio, producto.precio_anterior);
  if (!off) return el("p", { class: "product-price" }, el("strong", {}, dinero(producto.precio)));
  return el("p", { class: "product-price" },
    el("strong", {}, dinero(producto.precio)),
    el("s", {}, dinero(producto.precio_anterior))
  );
}

function pintarAccion(caja, producto) {
  if (!caja) return;
  const agotado = Number(producto.stock) <= 0;
  const formula = esFormula(producto.requiere_formula);
  const item = leerCarrito().find((row) => row.id === String(producto.id));
  if (agotado) {
    caja.replaceChildren(el("button", { type: "button", class: "plus-btn is-off", disabled: true }, "Agotado"));
    return;
  }
  if (item) {
    const menos = el("button", { type: "button", class: "step-btn", "data-menos": producto.id, "aria-label": `Disminuir ${producto.nombre}` }, "−");
    const mas = el("button", {
      type: "button",
      class: "step-btn",
      "data-mas": producto.id,
      "aria-label": `Aumentar ${producto.nombre}`,
      disabled: item.stock > 0 && item.cantidad >= item.stock
    }, "+");
    caja.replaceChildren(el("div", { class: "stepper" }, menos, el("span", {}, String(item.cantidad)), mas));
    return;
  }
  if (formula) {
    caja.replaceChildren(el("button", { type: "button", class: "consult-btn", "data-abrir": producto.id }, "Consultar"));
    return;
  }
  caja.replaceChildren(el("button", { type: "button", class: "plus-btn", "data-plus": producto.id, "aria-label": `Agregar ${producto.nombre}` }, icono("plus")));
}

export function tarjeta(producto) {
  recordar(producto);
  const formula = esFormula(producto.requiere_formula);
  const off = formula ? 0 : descuento(producto.precio, producto.precio_anterior);
  const agotado = Number(producto.stock) <= 0;
  const bajas = !agotado && Number(producto.stock) <= 5;
  const fav = esFavorito(producto.id);
  const media = el("div", { class: "product-media" },
    el("button", { type: "button", class: "product-hit", "data-abrir": producto.id, "aria-label": `Ver ${producto.nombre}` }, foto(producto)),
    off ? el("span", { class: "badge-off" }, `-${off}%`) : null,
    agotado ? el("span", { class: "tag tag-out" }, "Agotado") : bajas ? el("span", { class: "tag tag-low" }, "Últimas unidades") : null,
    formula ? el("span", { class: "tag tag-rx" }, "Requiere fórmula médica") : null,
    el("button", {
      type: "button",
      class: fav ? "fav is-on" : "fav",
      "data-fav": producto.id,
      "aria-pressed": fav ? "true" : "false",
      "aria-label": fav ? `Quitar ${producto.nombre} de favoritos` : `Guardar ${producto.nombre} en favoritos`
    }, icono("heart"))
  );
  const accion = el("div", { class: "product-action", "data-accion": producto.id });
  pintarAccion(accion, producto);
  return el("article", { class: "product", "data-id": String(producto.id) },
    media,
    el("button", { type: "button", class: "product-hit product-copy", "data-abrir": producto.id },
      el("span", { class: "product-name" }, producto.nombre),
      producto.presentacion ? el("span", { class: "product-pres" }, producto.presentacion) : null
    ),
    el("div", { class: "product-foot" }, precios(producto), accion)
  );
}

function refrescarAcciones() {
  document.querySelectorAll("[data-accion]").forEach((caja) => {
    const producto = cache.get(String(caja.dataset.accion));
    if (producto) pintarAccion(caja, producto);
  });
  document.querySelectorAll("[data-fav]").forEach((boton) => {
    const activo = esFavorito(boton.dataset.fav);
    boton.classList.toggle("is-on", activo);
    boton.setAttribute("aria-pressed", activo ? "true" : "false");
  });
}

function agregar(producto, origen) {
  const resultado = agregarProducto(producto);
  if (!resultado.ok) {
    avisar(resultado.mensaje || "No pudimos agregar el producto.");
    return;
  }
  volarAlCarrito(origen);
  avisar(`Agregaste ${producto.nombre}`);
  refrescarAcciones();
}

function cambiarCantidad(id, delta) {
  const producto = cache.get(String(id));
  const item = leerCarrito().find((row) => row.id === String(id));
  if (!item) return;
  const resultado = fijarCantidad(id, item.cantidad + delta);
  if (resultado && resultado.ok === false) avisar(resultado.mensaje);
  else if (delta > 0 && producto) volarAlCarrito(document.querySelector(`[data-id="${CSS.escape(String(id))}"] img`));
  refrescarAcciones();
}

export function activarTarjetas() {
  if (accionesListas) return;
  accionesListas = true;
  document.addEventListener("click", (evento) => {
    const fav = evento.target.closest("[data-fav]");
    if (fav) {
      evento.preventDefault();
      evento.stopPropagation();
      const activo = alternarFavorito(fav.dataset.fav);
      avisar(activo ? "Guardado en favoritos" : "Quitado de favoritos");
      refrescarAcciones();
      return;
    }
    const plus = evento.target.closest("[data-plus]");
    if (plus) {
      evento.preventDefault();
      const producto = cache.get(String(plus.dataset.plus));
      if (producto) agregar(producto, plus.closest(".product")?.querySelector("img"));
      return;
    }
    const menos = evento.target.closest("[data-menos]");
    if (menos) {
      evento.preventDefault();
      cambiarCantidad(menos.dataset.menos, -1);
      return;
    }
    const mas = evento.target.closest("[data-mas]");
    if (mas) {
      evento.preventDefault();
      cambiarCantidad(mas.dataset.mas, 1);
      return;
    }
    const abrir = evento.target.closest("[data-abrir]");
    if (abrir && !evento.target.closest("[data-fav],[data-plus],[data-menos],[data-mas]")) {
      const producto = cache.get(String(abrir.dataset.abrir));
      if (producto) abrirFicha(producto);
    }
  });
  document.addEventListener("reina:carrito", refrescarAcciones);
  document.addEventListener("reina:favoritos", refrescarAcciones);
  document.addEventListener("reina:producto", (evento) => {
    if (evento.detail) abrirFicha(evento.detail);
  });
}

function esqueleto(grid, cantidad = 4) {
  if (!grid) return;
  grid.replaceChildren();
  for (let i = 0; i < cantidad; i += 1) {
    grid.append(el("div", { class: "skeleton-card", "aria-hidden": "true" },
      el("div", { class: "skeleton sk-media" }),
      el("div", { class: "skeleton sk-line" }),
      el("div", { class: "skeleton sk-line short" })
    ));
  }
}

function pintarLista(grid, lista) {
  if (!grid) return;
  if (!lista.length) {
    grid.replaceChildren(el("div", { class: "empty-state" },
      el("img", { src: "assets/iconos/pedidos.svg", alt: "", width: "96", height: "96" }),
      el("h3", {}, "No hay productos para mostrar"),
      el("p", {}, "Prueba otra categoría o vuelve en un momento.")
    ));
    return;
  }
  lista.forEach(recordar);
  grid.replaceChildren(...lista.map(tarjeta));
  vigilarArte(grid);
  const aviso = sincronizarCarrito(lista);
  if (aviso) avisar(aviso);
}

function vigilarArte(raiz) {
  const tarjetas = (raiz || document).querySelectorAll(".product");
  if (reducido()) return;
  if (!("IntersectionObserver" in window)) {
    tarjetas.forEach((tarjeta) => tarjeta.classList.add("is-live"));
    return;
  }
  if (!observadorArte) {
    observadorArte = new IntersectionObserver((entradas) => {
      entradas.forEach((entrada) => entrada.target.classList.toggle("is-live", entrada.isIntersecting));
    }, { rootMargin: angosto() ? "0px" : "40px", threshold: 0.2 });
  }
  tarjetas.forEach((tarjeta) => observadorArte.observe(tarjeta));
}

function alVer(nodo, fn) {
  if (!nodo) return;
  if (!("IntersectionObserver" in window)) {
    fn();
    return;
  }
  const observador = new IntersectionObserver((entradas) => {
    if (!entradas.some((entrada) => entrada.isIntersecting)) return;
    observador.disconnect();
    fn();
  }, { rootMargin: angosto() ? "80px" : "240px" });
  observador.observe(nodo);
}

function asegurarFicha() {
  let overlay = document.querySelector("[data-overlay='ficha']");
  let ficha = document.getElementById("ficha");
  if (ficha) return { overlay, ficha };
  overlay = el("div", { class: "overlay", "data-overlay": "ficha", hidden: true });
  ficha = el("section", {
    class: "sheet",
    id: "ficha",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "ficha-titulo",
    tabindex: "-1",
    hidden: true
  });
  ficha.append(
    el("div", { class: "sheet-head" },
      el("h2", { id: "ficha-titulo" }, "Producto"),
      el("button", { type: "button", class: "icon-btn", "data-close-ficha": "true", "aria-label": "Cerrar ficha" }, icono("close"))
    ),
    el("div", { class: "sheet-body", "data-ficha-body": "true" })
  );
  overlay.addEventListener("click", cerrarFicha);
  ficha.addEventListener("click", (evento) => {
    if (evento.target.closest("[data-close-ficha]")) cerrarFicha();
  });
  document.body.append(overlay, ficha);
  return { overlay, ficha };
}

function cerrarFicha() {
  const overlay = document.querySelector("[data-overlay='ficha']");
  const ficha = document.getElementById("ficha");
  if (!ficha || !ficha.classList.contains("is-open")) return;
  overlay.classList.remove("is-open");
  ficha.classList.remove("is-open");
  document.documentElement.classList.remove("scroll-lock");
  if (soltarFicha) soltarFicha();
  soltarFicha = null;
  const ocultar = () => {
    if (ficha.classList.contains("is-open")) return;
    overlay.hidden = true;
    ficha.hidden = true;
  };
  if (reducido()) ocultar();
  else ficha.addEventListener("transitionend", ocultar, { once: true });
  if (fichaAbierta && fichaAbierta.focus) fichaAbierta.focus();
}

function atrapar(contenedor) {
  const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function tecla(evento) {
    if (evento.key === "Escape") {
      evento.preventDefault();
      cerrarFicha();
      return;
    }
    if (evento.key !== "Tab") return;
    const nodos = [...contenedor.querySelectorAll(selector)].filter((nodo) => !nodo.closest("[hidden]"));
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
  const nodos = [...contenedor.querySelectorAll(selector)];
  (nodos.find((nodo) => nodo.hasAttribute("data-close-ficha")) || contenedor).focus();
  return () => contenedor.removeEventListener("keydown", tecla);
}

async function abrirFicha(producto) {
  recordar(producto);
  cerrarCarrito();
  const { overlay, ficha } = asegurarFicha();
  fichaAbierta = document.activeElement;
  ficha.querySelector("#ficha-titulo").textContent = producto.nombre;
  const cuerpo = ficha.querySelector("[data-ficha-body]");
  const formula = esFormula(producto.requiere_formula);
  const agotado = Number(producto.stock) <= 0;
  const marca = marcaVisible(producto.marca);
  const media = el("div", { class: "product-media sheet-media" }, foto(producto));
  const descripcion = el("p", { class: "sheet-copy", "data-desc": "true" }, "Cargando la descripción…");
  cuerpo.replaceChildren(
    media,
    marca ? el("p", { class: "product-brand" }, marca) : null,
    producto.presentacion ? el("p", { class: "product-pres" }, producto.presentacion) : null,
    precios(producto),
    el("p", { class: "stock-note" }, agotado ? "Agotado" : Number(producto.stock) <= 5 ? `Últimas unidades: ${Number(producto.stock)}` : `Disponibles: ${Number(producto.stock)}`),
    formula ? el("p", { class: "tag tag-rx" }, "Requiere fórmula médica") : null,
    formula ? el("p", { class: "rx-foot" }, AVISO_FORMULA) : null,
    descripcion,
    el("button", {
      type: "button",
      class: "btn btn-primary",
      disabled: agotado,
      onclick: () => agregar(producto, media.querySelector("img"))
    }, agotado ? "Agotado" : "Agregar")
  );
  overlay.hidden = false;
  ficha.hidden = false;
  document.documentElement.classList.add("scroll-lock");
  requestAnimationFrame(() => {
    overlay.classList.add("is-open");
    ficha.classList.add("is-open");
  });
  soltarFicha = atrapar(ficha);
  const { data } = await supabase.from("productos").select("descripcion").eq("id", producto.id).maybeSingle();
  const nodo = ficha.querySelector("[data-desc]");
  if (!nodo) return;
  const texto = data && data.descripcion ? String(data.descripcion).trim() : "";
  nodo.textContent = texto || "Este producto no tiene una descripción adicional.";
}

async function abrirPorId(id) {
  if (!id) return;
  const guardado = cache.get(String(id));
  if (guardado) {
    abrirFicha(guardado);
    return;
  }
  const { data } = await supabase.from("productos").select(`${COLUMNAS},descripcion`).eq("id", id).maybeSingle();
  if (data) abrirFicha(data);
}

function pintarVacio() {
  const grid = document.querySelector("[data-grid]");
  if (!grid) return;
  grid.setAttribute("aria-busy", "false");
  const cuenta = document.querySelector("[data-count]");
  if (cuenta) cuenta.textContent = "0 productos";
  grid.replaceChildren(el("div", { class: "empty-state" },
    el("img", { src: "assets/iconos/pedidos.svg", alt: "", width: "96", height: "96" }),
    el("h3", {}, "No encontramos productos"),
    el("p", {}, "Prueba con otro nombre o quita los filtros."),
    el("button", { type: "button", class: "btn btn-ghost", onclick: () => limpiarFiltros() }, "Limpiar filtros")
  ));
  const pager = document.querySelector("[data-pager]");
  if (pager) pager.hidden = true;
}

function pintarError() {
  const grid = document.querySelector("[data-grid]");
  if (!grid) return;
  grid.setAttribute("aria-busy", "false");
  grid.replaceChildren(el("div", { class: "empty-state" },
    el("h3", {}, "No pudimos cargar el catálogo"),
    el("p", {}, "Revisa tu conexión e intenta de nuevo."),
    el("button", { type: "button", class: "btn btn-primary", onclick: () => cargarCatalogo() }, "Reintentar")
  ));
}

function pintarProductos(lista) {
  const grid = document.querySelector("[data-grid]");
  if (!grid) return;
  grid.setAttribute("aria-busy", "false");
  if (!lista.length) {
    pintarVacio();
    return;
  }
  pintarLista(grid, lista);
  const inicio = (estado.pagina - 1) * POR_PAGINA + 1;
  const fin = inicio + lista.length - 1;
  const cuenta = document.querySelector("[data-count]");
  if (cuenta) cuenta.textContent = estado.total ? `Mostrando ${inicio}–${fin} de ${estado.total}` : `${lista.length} productos`;
  const paginas = Math.max(1, Math.ceil(estado.total / POR_PAGINA));
  const pager = document.querySelector("[data-pager]");
  if (!pager) return;
  pager.hidden = paginas < 2;
  const label = pager.querySelector("[data-page-label]");
  if (label) label.textContent = `Página ${estado.pagina} de ${paginas}`;
  pager.querySelector("[data-prev]").disabled = estado.pagina <= 1;
  pager.querySelector("[data-next]").disabled = estado.pagina >= paginas;
}

async function cargarCatalogo() {
  const id = ++secuencia;
  const grid = document.querySelector("[data-grid]");
  if (grid) {
    grid.setAttribute("aria-busy", "true");
    esqueleto(grid, 8);
  }
  const desde = (estado.pagina - 1) * POR_PAGINA;
  const hasta = desde + POR_PAGINA - 1;
  let consulta = supabase.from("productos").select(COLUMNAS, { count: "exact" }).eq("activo", true);
  if (estado.categoria) consulta = consulta.eq("categoria", estado.categoria);
  if (estado.vista === "ofertas") consulta = consulta.eq("requiere_formula", false).not("precio_anterior", "is", null);
  const q = sanearBusqueda(estado.q);
  if (q) consulta = consulta.or(`nombre.ilike.%${q}%,marca.ilike.%${q}%`);
  if (estado.vista === "nuevos") consulta = consulta.order("creado_en", { ascending: false });
  else {
    const [campo, direccion] = estado.orden.split(".");
    consulta = consulta.order(campo, { ascending: direccion !== "desc" });
  }
  let { data, error, count } = await consulta.range(desde, hasta);
  if (error && estado.vista === "nuevos") {
    const reintento = await supabase.from("productos").select(COLUMNAS, { count: "exact" }).eq("activo", true).order("nombre", { ascending: true }).range(desde, hasta);
    data = reintento.data;
    error = reintento.error;
    count = reintento.count;
  }
  if (id !== secuencia) return;
  if (error) {
    pintarError();
    return;
  }
  let lista = data || [];
  if (estado.vista === "ofertas") lista = lista.filter((producto) => !esFormula(producto.requiere_formula) && descuento(producto.precio, producto.precio_anterior) > 0);
  estado.total = estado.vista === "ofertas" ? lista.length : count || 0;
  const paginas = Math.max(1, Math.ceil((count || 0) / POR_PAGINA));
  if (estado.vista !== "ofertas" && estado.pagina > paginas) {
    estado.pagina = paginas;
    escribirUrl();
    cargarCatalogo();
    return;
  }
  pintarProductos(lista);
}

function limpiarFiltros() {
  estado.q = "";
  estado.categoria = "";
  estado.vista = "";
  estado.pagina = 1;
  document.querySelectorAll("[data-search-input]").forEach((input) => { input.value = ""; });
  document.querySelectorAll("[data-search-cat]").forEach((select) => { select.value = ""; });
  aplicarModo();
}

function aplicarModo() {
  const catalogo = modoCatalogo();
  document.querySelectorAll("[data-home]").forEach((nodo) => { nodo.hidden = catalogo; });
  const panel = document.getElementById("catalogo");
  if (panel) panel.hidden = !catalogo;
  escribirUrl();
  if (catalogo) {
    cargarCatalogo();
    panel?.scrollIntoView({ block: "start", behavior: "auto" });
  } else prepararInicio();
}

function finConteo(ahora = new Date()) {
  const fijo = ofertasFlashFin ? Date.parse(ofertasFlashFin) : NaN;
  if (Number.isFinite(fijo) && fijo > ahora.getTime()) return fijo;
  const dia = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(ahora);
  return Date.parse(`${dia}T23:59:59-05:00`);
}

function pintarReloj() {
  const raiz = document.querySelector("[data-reloj]");
  if (!raiz) return;
  let falta = Math.max(0, finConteo() - Date.now());
  const dias = Math.floor(falta / 86400000);
  falta -= dias * 86400000;
  const horas = Math.floor(falta / 3600000);
  falta -= horas * 3600000;
  const minutos = Math.floor(falta / 60000);
  const segundos = Math.floor((falta - minutos * 60000) / 1000);
  const valores = [dias, horas, minutos, segundos];
  raiz.querySelectorAll("b").forEach((nodo, indice) => {
    nodo.textContent = String(valores[indice]).padStart(2, "0");
  });
}

async function cargarFlash() {
  const seccion = document.getElementById("ofertas");
  if (!seccion) return;
  const { data, error } = await supabase.from("productos").select(COLUMNAS).eq("activo", true).eq("requiere_formula", false).not("precio_anterior", "is", null).limit(24);
  const ofertas = error ? [] : (data || []).filter((producto) => !esFormula(producto.requiere_formula) && descuento(producto.precio, producto.precio_anterior) > 0);
  seccion.classList.remove("is-pending");
  if (!ofertas.length) {
    seccion.hidden = true;
    return;
  }
  seccion.hidden = false;
  const riel = seccion.querySelector("[data-flash]");
  pintarLista(riel, ofertas);
  pintarReloj();
  clearInterval(reloj);
  reloj = setInterval(pintarReloj, 1000);
}

async function cargarNuevos() {
  const grid = document.querySelector("[data-nuevos]");
  if (!grid) return;
  esqueleto(grid, 4);
  let respuesta = await supabase.from("productos").select(COLUMNAS).eq("activo", true).order("creado_en", { ascending: false }).limit(12);
  if (respuesta.error) respuesta = await supabase.from("productos").select(COLUMNAS).eq("activo", true).limit(12);
  pintarLista(grid, respuesta.data || []);
}

async function cargarPopulares() {
  const grid = document.querySelector("[data-populares]");
  if (!grid) return;
  esqueleto(grid, 4);
  const pedidos = await import("./pedidos.js");
  const tokens = pedidos.leerPedidosLocal().slice(0, 6);
  const conteo = new Map();
  for (const row of tokens) {
    const { data, error } = await supabase.rpc("estado_pedido", { p_token: row.token });
    if (error) continue;
    const pedido = pedidos.interpretarPedido(data);
    (pedido?.items || []).forEach((item) => {
      const clave = `${String(item.nombre || "").trim().toLowerCase()}|${String(item.presentacion || "").trim().toLowerCase()}`;
      conteo.set(clave, (conteo.get(clave) || 0) + (Number(item.cantidad) || 1));
    });
  }
  const { data } = await supabase.from("productos").select(COLUMNAS).eq("activo", true).limit(80);
  const lista = data || [];
  let elegidos = [];
  if (conteo.size) {
    elegidos = lista.filter((producto) => conteo.has(`${String(producto.nombre || "").trim().toLowerCase()}|${String(producto.presentacion || "").trim().toLowerCase()}`));
    const clave = (producto) => `${String(producto.nombre || "").trim().toLowerCase()}|${String(producto.presentacion || "").trim().toLowerCase()}`;
    elegidos.sort((a, b) => (conteo.get(clave(b)) || 0) - (conteo.get(clave(a)) || 0));
  }
  if (!elegidos.length) {
    const vistos = new Set();
    lista.forEach((producto) => {
      if (vistos.has(producto.categoria)) return;
      vistos.add(producto.categoria);
      elegidos.push(producto);
    });
  }
  pintarLista(grid, elegidos.slice(0, 8));
}

function cargarBloques() {
  const raiz = document.getElementById("bloques");
  if (!raiz || raiz.childElementCount) return;
  raiz.replaceChildren(...categorias.map((categoria) => {
    const grid = el("div", { class: "grid", "data-bloque": categoria.id });
    esqueleto(grid, 2);
    const seccion = el("section", { class: "panel cat-block" },
      el("div", { class: "panel-title" },
        el("img", { src: PORTADA[categoria.id] || PORTADA.Medicamentos, alt: "", width: "64", height: "64", loading: "lazy" }),
        el("h2", {}, categoria.nombre),
        el("a", { href: `index.html?categoria=${encodeURIComponent(categoria.id)}#catalogo`, "data-cat-link": "", "data-cat": categoria.id }, "Ver todo")
      ),
      grid
    );
    alVer(seccion, async () => {
      const { data } = await supabase.from("productos").select(COLUMNAS).eq("activo", true).eq("categoria", categoria.id).order("nombre", { ascending: true }).limit(8);
      pintarLista(grid, data || []);
    });
    return seccion;
  }));
}

function riel(selector, direccion) {
  const nodo = document.querySelector(selector);
  if (!nodo) return;
  nodo.scrollBy({ left: direccion * Math.max(220, nodo.clientWidth * 0.8), behavior: reducido() ? "auto" : "smooth" });
}

function iniciarCarrusel() {
  const raiz = document.querySelector("[data-banner]");
  if (!raiz || carrusel) return;
  const pista = raiz.querySelector("[data-banner-track]");
  const slides = [...pista.querySelectorAll("[data-banner-slide]")];
  const puntos = raiz.querySelector("[data-banner-dots]");
  let indice = 0;
  let timer = 0;
  let pausa = false;
  let toque = false;
  raiz.classList.add("is-ready");
  slides.forEach((_, i) => {
    const boton = el("button", { type: "button", class: i === 0 ? "is-on" : "", "aria-label": `Banner ${i + 1}` });
    boton.addEventListener("click", () => ir(i));
    puntos.append(boton);
  });
  function ir(siguiente) {
    indice = (siguiente + slides.length) % slides.length;
    pista.style.transform = `translateX(-${indice * 100}%)`;
    [...puntos.children].forEach((punto, i) => punto.classList.toggle("is-on", i === indice));
    slides.forEach((slide, i) => slide.setAttribute("aria-hidden", i === indice ? "false" : "true"));
  }
  function programar() {
    clearInterval(timer);
    if (reducido() || pausa || toque || document.hidden) return;
    timer = setInterval(() => ir(indice + 1), 6000);
  }
  raiz.querySelector("[data-banner-prev]").addEventListener("click", () => ir(indice - 1));
  raiz.querySelector("[data-banner-next]").addEventListener("click", () => ir(indice + 1));
  raiz.addEventListener("mouseenter", () => { pausa = true; programar(); });
  raiz.addEventListener("mouseleave", () => { pausa = false; programar(); });
  raiz.addEventListener("pointerdown", (evento) => {
    toque = true;
    carrusel.x = evento.clientX;
    programar();
  });
  raiz.addEventListener("pointerup", (evento) => {
    const delta = evento.clientX - (carrusel.x || evento.clientX);
    if (Math.abs(delta) > 40) ir(indice + (delta < 0 ? 1 : -1));
    toque = false;
    programar();
  });
  raiz.addEventListener("pointercancel", () => { toque = false; programar(); });
  document.addEventListener("visibilitychange", programar);
  carrusel = { x: 0 };
  ir(0);
  programar();
}

function iniciarAccesos() {
  const fila = document.querySelector("[data-access]");
  if (!fila) return;
  document.querySelector("[data-access-prev]")?.addEventListener("click", () => {
    fila.scrollBy({ left: -fila.clientWidth * 0.75, behavior: reducido() ? "auto" : "smooth" });
  });
  document.querySelector("[data-access-next]")?.addEventListener("click", () => {
    fila.scrollBy({ left: fila.clientWidth * 0.75, behavior: reducido() ? "auto" : "smooth" });
  });
  const accesos = [...fila.querySelectorAll(".access")];
  if (reducido()) return;
  if (!("IntersectionObserver" in window)) {
    accesos.forEach((acceso) => acceso.classList.add("is-live"));
    return;
  }
  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => entrada.target.classList.toggle("is-live", entrada.isIntersecting));
  }, { rootMargin: "0px", threshold: 0.4 });
  accesos.forEach((acceso, indice) => {
    acceso.style.setProperty("--i", String(indice));
    observador.observe(acceso);
  });
  const whatsapp = fila.querySelector("[data-whatsapp]");
  whatsapp?.addEventListener("click", (evento) => {
    if (whatsapp.getAttribute("href") === "#") {
      evento.preventDefault();
      avisar("El WhatsApp está por confirmar.");
    }
  });
}

function prepararInicio() {
  if (inicioListo) return;
  inicioListo = true;
  iniciarCarrusel();
  iniciarAccesos();
  alVer(document.getElementById("ofertas"), cargarFlash);
  alVer(document.getElementById("nuevos"), cargarNuevos);
  alVer(document.getElementById("populares"), cargarPopulares);
  alVer(document.getElementById("bloques"), cargarBloques);
}

export function iniciarTienda() {
  if (!document.querySelector("[data-grid]")) return;
  activarTarjetas();
  leerUrl();
  const orden = document.querySelector("[data-sort]");
  orden?.addEventListener("change", () => {
    estado.orden = ORDENES.has(orden.value) ? orden.value : "nombre.asc";
    estado.pagina = 1;
    if (!modoCatalogo()) estado.vista = "catalogo";
    aplicarModo();
  });
  document.querySelector("[data-pager]")?.addEventListener("click", (evento) => {
    const boton = evento.target.closest("button");
    if (!boton || boton.disabled) return;
    if (boton.hasAttribute("data-prev")) estado.pagina -= 1;
    if (boton.hasAttribute("data-next")) estado.pagina += 1;
    cargarCatalogo();
    document.getElementById("catalogo")?.scrollIntoView({ block: "start", behavior: "auto" });
    escribirUrl();
  });
  document.addEventListener("click", (evento) => {
    if (document.body.dataset.page !== "inicio") return;
    const vista = evento.target.closest("[data-vista]");
    const ir = evento.target.closest("[data-go]");
    const link = evento.target.closest("[data-cat-link]");
    if (!vista && !ir && !link) return;
    evento.preventDefault();
    estado.q = "";
    estado.pagina = 1;
    document.querySelectorAll("[data-search-input]").forEach((input) => { input.value = ""; });
    if (vista) {
      estado.vista = vista.dataset.vista === "nuevos" ? "nuevos" : "ofertas";
      estado.categoria = "";
    } else if (link) {
      estado.categoria = link.dataset.cat || "";
      if (!categorias.some((item) => item.id === estado.categoria)) estado.categoria = "";
      estado.vista = estado.categoria ? "" : "catalogo";
    } else {
      estado.categoria = "";
      estado.vista = "";
    }
    document.querySelectorAll("[data-search-cat]").forEach((select) => { select.value = estado.categoria; });
    aplicarModo();
    if (ir) document.getElementById(ir.dataset.go)?.scrollIntoView({ block: "start", behavior: "auto" });
  });
  document.addEventListener("reina:buscar", (evento) => {
    const detalle = evento.detail || {};
    estado.q = typeof detalle === "string" ? detalle : String(detalle.q || "");
    estado.categoria = typeof detalle === "object" && detalle.categoria != null ? detalle.categoria : estado.categoria;
    if (!categorias.some((item) => item.id === estado.categoria)) estado.categoria = "";
    estado.pagina = 1;
    estado.vista = "";
    aplicarModo();
  });
  document.querySelectorAll("[data-rail]").forEach((boton) => {
    boton.addEventListener("click", () => riel(boton.dataset.rail, boton.dataset.dir === "prev" ? -1 : 1));
  });
  if (location.hash === "#buscar") document.getElementById("buscar")?.focus();
  const producto = new URLSearchParams(location.search).get("producto");
  if (producto) abrirPorId(producto);
  aplicarModo();
}
