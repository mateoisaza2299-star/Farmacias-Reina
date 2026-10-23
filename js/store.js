import { supabase } from "./supabase.js";
import { categorias } from "./config.js";
import { el } from "./dom.js";
import { icono } from "./icons.js";
import { descuento, dinero, patronIlike, sanearBusqueda } from "./format.js";
import { enlaceWhatsapp } from "./pago.js";
import { sincronizarCarrito } from "./cart.js";
import { avisar } from "./layout.js";
import { atenuar, cruzar, desdeEsqueleto, entrar, estadoFallo, flip, marcarEsqueleto, ocupar, soltarLento, tarjetaEsqueleto, transicionTexto, vigilarLento } from "./motion.js";
import { COLUMNAS, estadoVacio, tarjeta } from "./ui-producto.js";

const POR_PAGINA = 24;
const ORDENES = new Set(["nombre.asc", "nombre.desc", "precio.asc", "precio.desc"]);

const estado = {
  categoria: "",
  orden: "nombre.asc",
  q: "",
  pagina: 1,
  total: 0,
  min: null,
  max: null,
  ofertas: false,
  disponibles: false,
  sinformula: false,
  piso: 0,
  techo: 0
};

let secuencia = 0;
let silencio = false;

function paginaCategoria() {
  return document.body.dataset.page === "categoria";
}

function leerUrl() {
  const params = new URLSearchParams(location.search);
  const cruda = paginaCategoria() ? params.get("c") || "" : params.get("categoria") || "";
  estado.categoria = categorias.some((item) => item.id === cruda) ? cruda : "";
  const orden = params.get("orden") || "nombre.asc";
  estado.orden = ORDENES.has(orden) ? orden : "nombre.asc";
  estado.q = params.get("q") || "";
  const pagina = Number(params.get("pagina"));
  estado.pagina = Number.isInteger(pagina) && pagina > 0 ? pagina : 1;
  estado.ofertas = params.get("ofertas") === "1";
  estado.disponibles = params.get("disponibles") === "1";
  estado.sinformula = params.get("sinformula") === "1";
  estado.min = params.has("min") && Number.isFinite(Number(params.get("min"))) ? Number(params.get("min")) : null;
  estado.max = params.has("max") && Number.isFinite(Number(params.get("max"))) ? Number(params.get("max")) : null;
  const ordenSelect = document.querySelector("[data-sort]");
  if (ordenSelect) ordenSelect.value = estado.orden;
  document.querySelectorAll("[data-search-input]").forEach((input) => {
    input.value = estado.q;
  });
}

function escribirUrl(modo = "replace") {
  if (silencio) return;
  const url = new URL(location.href);
  ["q", "categoria", "c", "orden", "pagina", "ofertas", "disponibles", "sinformula", "min", "max"].forEach((clave) => {
    url.searchParams.delete(clave);
  });
  if (estado.q) url.searchParams.set("q", estado.q);
  if (estado.categoria) url.searchParams.set(paginaCategoria() ? "c" : "categoria", estado.categoria);
  if (estado.orden !== "nombre.asc") url.searchParams.set("orden", estado.orden);
  if (estado.pagina > 1) url.searchParams.set("pagina", String(estado.pagina));
  if (estado.ofertas) url.searchParams.set("ofertas", "1");
  if (estado.disponibles) url.searchParams.set("disponibles", "1");
  if (estado.sinformula) url.searchParams.set("sinformula", "1");
  if (estado.min != null) url.searchParams.set("min", String(estado.min));
  if (estado.max != null) url.searchParams.set("max", String(estado.max));
  const destino = `${url.pathname}${url.search}`;
  const actual = `${location.pathname}${location.search}`;
  if (destino === actual) return;
  if (modo === "push") history.pushState({ reina: 1 }, "", destino);
  else history.replaceState({ reina: 1 }, "", destino);
}

function marcarCategorias() {
  document.querySelectorAll("[data-categoria]").forEach((chip) => {
    const activa = chip.dataset.categoria === estado.categoria;
    chip.classList.toggle("is-on", activa);
    if (activa) chip.setAttribute("aria-current", "true");
    else chip.removeAttribute("aria-current");
  });
}

async function pintarCategorias() {
  const lista = document.querySelector("[data-categorias]");
  if (!lista) return;
  if (!lista.dataset.sk) marcarEsqueleto(lista);
  vigilarLento(lista, () => pintarCategorias());
  await desdeEsqueleto(lista);
  const todas = el("a", {
    class: "chip",
    href: "index.html#catalogo",
    "data-categoria": ""
  }, el("span", { class: "chip-icon" }, icono("grid")), el("span", {}, "Todas"));
  const chips = categorias.map((categoria) => el("a", {
    class: "chip",
    href: `categoria.html?c=${encodeURIComponent(categoria.id)}`,
    "data-categoria": categoria.id
  }, el("span", { class: "chip-icon" }, icono(categoria.icono)), el("span", {}, categoria.nombre)));
  lista.replaceChildren(todas, ...chips);
  lista.setAttribute("aria-busy", "false");
  soltarLento(lista);
  entrar(lista.querySelectorAll(".chip"), 8);
  marcarCategorias();
  document.dispatchEvent(new CustomEvent("reina:chips"));
}

function esqueleto(cantidad = 8) {
  const grid = document.querySelector("[data-grid]");
  if (!grid) return;
  grid.setAttribute("aria-busy", "true");
  const actuales = grid.querySelectorAll(":scope > .skeleton-card");
  const intacto = actuales.length === cantidad && grid.children.length === actuales.length;
  if (!intacto) {
    grid.replaceChildren();
    for (let i = 0; i < cantidad; i += 1) grid.append(tarjetaEsqueleto());
  }
  if (!grid.dataset.sk) marcarEsqueleto(grid);
  vigilarLento(grid, () => cargarCatalogo());
  const estadoTexto = document.querySelector("[data-catalogo-estado]");
  if (estadoTexto && estadoTexto.textContent !== "Cargando productos") estadoTexto.textContent = "Cargando productos";
}

function anunciar(texto) {
  const nodo = document.querySelector("[data-catalogo-estado]");
  if (nodo) nodo.textContent = texto;
}

function limpiarTodo() {
  estado.q = "";
  estado.ofertas = false;
  estado.disponibles = false;
  estado.sinformula = false;
  estado.min = null;
  estado.max = null;
  estado.pagina = 1;
  if (!paginaCategoria()) estado.categoria = "";
  document.querySelectorAll("[data-search-input]").forEach((input) => {
    input.value = "";
  });
  marcarCategorias();
  reflejarFiltros();
  escribirUrl("push");
  cargarCatalogo({ modo: "filtro" });
}

function quitarFiltro(clave) {
  if (clave === "q") {
    estado.q = "";
    document.querySelectorAll("[data-search-input]").forEach((input) => {
      input.value = "";
    });
  }
  if (clave === "categoria") estado.categoria = "";
  if (clave === "ofertas") estado.ofertas = false;
  if (clave === "disponibles") estado.disponibles = false;
  if (clave === "sinformula") estado.sinformula = false;
  if (clave === "precio") {
    estado.min = null;
    estado.max = null;
  }
  estado.pagina = 1;
  marcarCategorias();
  reflejarFiltros();
  escribirUrl("push");
  cargarCatalogo({ modo: "filtro" });
}

function filtrosActivos() {
  const lista = [];
  if (estado.q) lista.push(["q", estado.q]);
  if (estado.categoria && !paginaCategoria()) lista.push(["categoria", estado.categoria]);
  if (estado.ofertas) lista.push(["ofertas", "Solo ofertas"]);
  if (estado.disponibles) lista.push(["disponibles", "Solo disponibles"]);
  if (estado.sinformula) lista.push(["sinformula", "Sin fórmula"]);
  if (estado.min != null || estado.max != null) {
    const desde = dinero(estado.min != null ? estado.min : estado.piso);
    const hasta = dinero(estado.max != null ? estado.max : estado.techo);
    lista.push(["precio", `${desde} – ${hasta}`]);
  }
  return lista;
}

function pintarChips() {
  const caja = document.querySelector("[data-chips]");
  if (!caja) return;
  const activos = filtrosActivos();
  const contador = el("span", { class: "resultado-cuenta" }, estado.total === 1 ? "1 resultado" : `${estado.total} resultados`);
  const chips = activos.map(([clave, texto]) => {
    const chip = el("button", {
      type: "button",
      class: "filtro-chip",
      "aria-label": `Quitar filtro ${texto}`,
      onclick: () => quitarFiltro(clave)
    }, el("span", {}, texto), el("span", { "aria-hidden": "true" }, "×"));
    return chip;
  });
  const nodos = [contador, ...chips];
  if (activos.length) nodos.push(el("button", { type: "button", class: "text-btn", onclick: limpiarTodo }, "Limpiar todo"));
  caja.replaceChildren(...nodos);
  document.dispatchEvent(new CustomEvent("reina:chips"));
  const abrir = document.querySelector("[data-abrir-filtros]");
  if (abrir) {
    const etiqueta = abrir.querySelector(".btn-label") || abrir;
    etiqueta.textContent = activos.length ? `Filtros (${activos.length})` : "Filtros";
  }
}

function pintarVacio() {
  const grid = document.querySelector("[data-grid]");
  if (!grid) return;
  grid.setAttribute("aria-busy", "false");
  transicionTexto(document.querySelector("[data-count]"), "0 productos");
  pintarChips();
  const pager = document.querySelector("[data-pager]");
  if (pager) pager.hidden = true;
  if (sanearBusqueda(estado.q)) {
    const texto = `Hola, busqué “${estado.q.trim()}” y no lo encontré. ¿Lo tienen disponible?`;
    const url = enlaceWhatsapp(texto);
    const sugeridas = categorias.slice(0, 6).map((categoria) => el("a", {
      class: "filtro-chip",
      href: `categoria.html?c=${encodeURIComponent(categoria.id)}`
    }, categoria.nombre));
    grid.replaceChildren(estadoVacio(
      "search",
      "No encontramos ese producto",
      "Prueba con otra palabra o mira estas categorías.",
      el("div", { class: "vacio-acciones" },
        el("div", { class: "filtro-activos" }, ...sugeridas),
        url ? el("a", { class: "btn btn-whatsapp", href: url, target: "_blank", rel: "noopener noreferrer" }, "Pedir este producto por WhatsApp") : null,
        el("button", { type: "button", class: "btn btn-ghost", onclick: limpiarTodo }, "Limpiar todo")
      )
    ));
    anunciar("No encontramos ese producto");
    return;
  }
  grid.replaceChildren(estadoVacio(
    "search",
    "No encontramos productos",
    "Prueba con otro nombre, otra marca o quita los filtros.",
    el("button", { type: "button", class: "btn btn-ghost", onclick: limpiarTodo }, "Limpiar todo")
  ));
  anunciar("No hay productos con esos filtros");
}

function pintarError() {
  const grid = document.querySelector("[data-grid]");
  if (!grid) return;
  grid.setAttribute("aria-busy", "false");
  transicionTexto(document.querySelector("[data-count]"), "No pudimos cargar el catálogo. Inténtalo de nuevo.");
  const pager = document.querySelector("[data-pager]");
  if (pager) pager.hidden = true;
  grid.replaceChildren(estadoFallo("No pudimos cargar el catálogo. Inténtalo de nuevo.", () => cargarCatalogo()));
  anunciar("No pudimos cargar el catálogo. Inténtalo de nuevo.");
}

async function pintarProductos(lista, opciones = {}) {
  const grid = document.querySelector("[data-grid]");
  if (!grid) return;
  grid.setAttribute("aria-busy", "false");
  if (!lista.length) {
    await cruzar(grid, []);
    pintarVacio();
    return;
  }
  const tarjetas = lista.map(tarjeta);
  const movido = opciones.modo === "filtro" && opciones.foto ? flip(grid, tarjetas, opciones.foto) : false;
  if (!movido) await cruzar(grid, tarjetas);
  const inicio = (estado.pagina - 1) * POR_PAGINA + 1;
  const fin = inicio + lista.length - 1;
  transicionTexto(document.querySelector("[data-count]"), estado.total ? `Mostrando ${inicio}–${fin} de ${estado.total}` : `${lista.length} productos`);
  pintarChips();
  const paginas = Math.max(1, Math.ceil(estado.total / POR_PAGINA));
  const pager = document.querySelector("[data-pager]");
  if (pager) {
    pager.hidden = paginas < 2;
    const label = pager.querySelector("[data-page-label]");
    if (label) label.textContent = `Página ${estado.pagina} de ${paginas}`;
    const prev = pager.querySelector("[data-prev]");
    const next = pager.querySelector("[data-next]");
    if (prev) prev.disabled = estado.pagina <= 1;
    if (next) next.disabled = estado.pagina >= paginas;
  }
  anunciar(`${lista.length} productos en el catálogo`);
}

function aplicarConsulta(consulta) {
  if (estado.categoria) consulta = consulta.eq("categoria", estado.categoria);
  const q = patronIlike(estado.q);
  if (q) consulta = consulta.or(`nombre.ilike.%${q}%,marca.ilike.%${q}%`);
  if (estado.disponibles) consulta = consulta.gt("stock", 0);
  if (estado.sinformula || estado.ofertas) consulta = consulta.eq("requiere_formula", false);
  if (estado.ofertas) consulta = consulta.not("precio_anterior", "is", null);
  if (estado.min != null) consulta = consulta.gte("precio", estado.min);
  if (estado.max != null) consulta = consulta.lte("precio", estado.max);
  return consulta;
}

async function cargarCatalogo(opciones = {}) {
  const id = ++secuencia;
  const grid = document.querySelector("[data-grid]");
  if (!grid) return;
  const boton = opciones.boton;
  if (boton) ocupar(boton, true);
  const filtrar = opciones.modo === "filtro" && grid.querySelector("[data-id]");
  const foto = filtrar ? new Map([...grid.querySelectorAll("[data-id]")].map((nodo) => [nodo.dataset.id, nodo.getBoundingClientRect()])) : null;
  if (opciones.modo === "filtro" || opciones.modo === "pagina") await atenuar(grid);
  if (id !== secuencia) {
    if (boton) ocupar(boton, false);
    return;
  }
  let esperaEsqueleto = 0;
  if (filtrar) esperaEsqueleto = setTimeout(() => { if (id === secuencia) esqueleto(); }, 280);
  else esqueleto();
  const desde = (estado.pagina - 1) * POR_PAGINA;
  const hasta = desde + POR_PAGINA - 1;
  let consulta = supabase.from("productos").select(COLUMNAS, { count: "exact" }).eq("activo", true);
  consulta = aplicarConsulta(consulta);
  const [campo, direccion] = estado.orden.split(".");
  consulta = consulta.order(campo, { ascending: direccion !== "desc" }).range(desde, hasta);
  const { data, error, count } = await consulta;
  clearTimeout(esperaEsqueleto);
  if (id !== secuencia) {
    if (boton) ocupar(boton, false);
    return;
  }
  if (boton) ocupar(boton, false);
  if (error) {
    console.error(error);
    pintarError();
    return;
  }
  estado.total = count || 0;
  const paginas = Math.max(1, Math.ceil(estado.total / POR_PAGINA));
  if (estado.pagina > paginas) {
    estado.pagina = paginas;
    escribirUrl("replace");
    cargarCatalogo();
    return;
  }
  const usoFoto = filtrar && !grid.querySelector(".skeleton") ? foto : null;
  await pintarProductos(data || [], { modo: opciones.modo, foto: usoFoto });
  const aviso = sincronizarCarrito(data || []);
  if (aviso) avisar(aviso);
}

async function cargarOfertas() {
  const contenedor = document.querySelector("[data-ofertas]");
  if (!contenedor) return;
  if (!contenedor.querySelector(".skeleton")) {
    contenedor.replaceChildren(tarjetaEsqueleto(), tarjetaEsqueleto(), tarjetaEsqueleto(), tarjetaEsqueleto());
  }
  if (!contenedor.dataset.sk) marcarEsqueleto(contenedor);
  contenedor.setAttribute("aria-busy", "true");
  vigilarLento(contenedor, () => cargarOfertas());
  const { data, error } = await supabase
    .from("productos")
    .select(COLUMNAS)
    .eq("activo", true)
    .eq("requiere_formula", false)
    .not("precio_anterior", "is", null)
    .order("nombre", { ascending: true })
    .limit(12);
  if (error) {
    console.error(error);
    await cruzar(contenedor, [estadoFallo("No pudimos cargar las ofertas.", () => cargarOfertas())]);
    contenedor.setAttribute("aria-busy", "false");
    return;
  }
  const ofertas = (data || []).filter((producto) => descuento(producto.precio, producto.precio_anterior) > 0);
  if (!ofertas.length) {
    await cruzar(contenedor, [el("p", { class: "hint" }, "Pronto verás ofertas en productos que no requieren fórmula.")]);
    contenedor.setAttribute("aria-busy", "false");
    return;
  }
  await cruzar(contenedor, ofertas.map(tarjeta));
  contenedor.setAttribute("aria-busy", "false");
}

function pasoPrecio() {
  const rango = Math.max(0, estado.techo - estado.piso);
  if (rango > 50000) return 1000;
  if (rango > 10000) return 500;
  return 100;
}

function reflejarRango() {
  const minInput = document.querySelector("[data-precio-min]");
  const maxInput = document.querySelector("[data-precio-max]");
  const pista = document.querySelector("[data-rango]");
  const leyenda = document.querySelector("[data-precio-leyenda]");
  if (!minInput || !maxInput || !pista) return;
  const activo = estado.techo > estado.piso;
  pista.hidden = !activo;
  if (!activo) return;
  const paso = pasoPrecio();
  minInput.min = String(estado.piso);
  maxInput.min = String(estado.piso);
  minInput.max = String(estado.techo);
  maxInput.max = String(estado.techo);
  minInput.step = String(paso);
  maxInput.step = String(paso);
  const desde = estado.min != null ? estado.min : estado.piso;
  const hasta = estado.max != null ? estado.max : estado.techo;
  if (document.activeElement !== minInput) minInput.value = String(desde);
  if (document.activeElement !== maxInput) maxInput.value = String(hasta);
  const a = Number(minInput.value);
  const b = Number(maxInput.value);
  const ancho = Math.max(1, estado.techo - estado.piso);
  pista.style.setProperty("--p1", String(Math.round(((a - estado.piso) / ancho) * 100)));
  pista.style.setProperty("--p2", String(Math.round(((b - estado.piso) / ancho) * 100)));
  if (leyenda) leyenda.textContent = `${dinero(a)} – ${dinero(b)}`;
}

function reflejarFiltros() {
  const select = document.querySelector("[data-filtro-cat]");
  if (select) select.value = estado.categoria;
  const ofertas = document.querySelector("[data-filtro-ofertas]");
  const disponibles = document.querySelector("[data-filtro-disponibles]");
  const sinformula = document.querySelector("[data-filtro-sinformula]");
  if (ofertas) ofertas.checked = estado.ofertas;
  if (disponibles) disponibles.checked = estado.disponibles;
  if (sinformula) sinformula.checked = estado.sinformula;
  reflejarRango();
  pintarChips();
}

function aplicarCheck(clave, marcado) {
  estado[clave] = marcado;
  estado.pagina = 1;
  reflejarFiltros();
  escribirUrl("push");
  cargarCatalogo({ modo: "filtro" });
}

function cambiarCategoria(valor) {
  const id = categorias.some((item) => item.id === valor) ? valor : "";
  if (paginaCategoria()) {
    if (!id) {
      location.href = "index.html#catalogo";
      return;
    }
    const url = new URL("categoria.html", location.href);
    if (id) url.searchParams.set("c", id);
    if (estado.q) url.searchParams.set("q", estado.q);
    if (estado.orden !== "nombre.asc") url.searchParams.set("orden", estado.orden);
    if (estado.ofertas) url.searchParams.set("ofertas", "1");
    if (estado.disponibles) url.searchParams.set("disponibles", "1");
    if (estado.sinformula) url.searchParams.set("sinformula", "1");
    if (estado.min != null) url.searchParams.set("min", String(estado.min));
    if (estado.max != null) url.searchParams.set("max", String(estado.max));
    location.href = `${url.pathname}${url.search}`;
    return;
  }
  estado.categoria = id;
  estado.pagina = 1;
  marcarCategorias();
  reflejarFiltros();
  escribirUrl("push");
  cargarCatalogo({ modo: "filtro" });
}

function moverRango(origen) {
  const minInput = document.querySelector("[data-precio-min]");
  const maxInput = document.querySelector("[data-precio-max]");
  if (!minInput || !maxInput) return;
  let a = Number(minInput.value);
  let b = Number(maxInput.value);
  if (a > b) {
    if (origen === "min") maxInput.value = String(a);
    else minInput.value = String(b);
  }
  const previoMin = estado.min;
  const previoMax = estado.max;
  estado.min = Number(minInput.value);
  estado.max = Number(maxInput.value);
  reflejarRango();
  estado.min = previoMin;
  estado.max = previoMax;
}

function soltarRango() {
  const minInput = document.querySelector("[data-precio-min]");
  const maxInput = document.querySelector("[data-precio-max]");
  if (!minInput || !maxInput) return;
  const a = Number(minInput.value);
  const b = Number(maxInput.value);
  estado.min = a <= estado.piso ? null : a;
  estado.max = b >= estado.techo ? null : b;
  estado.pagina = 1;
  reflejarFiltros();
  escribirUrl("push");
  cargarCatalogo({ modo: "filtro" });
}

function esDesktop() {
  return window.matchMedia("(min-width: 900px)").matches;
}

function anclarFiltros(alCuerpo) {
  const slot = document.querySelector("[data-filtros]");
  const hogar = document.querySelector(".catalogo-lay");
  if (!slot) return;
  if (alCuerpo) {
    if (slot.parentElement !== document.body) document.body.append(slot);
    return;
  }
  if (hogar && slot.parentElement !== hogar) hogar.prepend(slot);
}

function cerrarFiltros() {
  const slot = document.querySelector("[data-filtros]");
  const overlay = document.querySelector("[data-filtros-overlay]");
  if (!slot) return;
  slot.classList.remove("is-open");
  overlay?.classList.remove("is-open");
  const carrito = document.getElementById("carrito");
  if (!carrito?.classList.contains("is-open")) document.documentElement.classList.remove("scroll-lock");
  const ocultar = () => {
    if (esDesktop() || slot.classList.contains("is-open")) return;
    slot.hidden = true;
    if (overlay) overlay.hidden = true;
    anclarFiltros(false);
  };
  if (esDesktop() || window.matchMedia("(prefers-reduced-motion: reduce)").matches) ocultar();
  else slot.addEventListener("transitionend", ocultar, { once: true });
}

function abrirFiltros() {
  if (esDesktop()) return;
  const slot = document.querySelector("[data-filtros]");
  const overlay = document.querySelector("[data-filtros-overlay]");
  if (!slot) return;
  anclarFiltros(true);
  slot.hidden = false;
  if (overlay) overlay.hidden = false;
  document.documentElement.classList.add("scroll-lock");
  requestAnimationFrame(() => {
    slot.classList.add("is-open");
    overlay?.classList.add("is-open");
  });
  slot.querySelector("select, input, button")?.focus();
}

function sincronizarPanel() {
  const slot = document.querySelector("[data-filtros]");
  const overlay = document.querySelector("[data-filtros-overlay]");
  if (!slot) return;
  if (esDesktop()) {
    anclarFiltros(false);
    slot.hidden = false;
    slot.classList.remove("is-open");
    if (overlay) {
      overlay.hidden = true;
      overlay.classList.remove("is-open");
    }
    const carrito = document.getElementById("carrito");
    if (!carrito?.classList.contains("is-open")) document.documentElement.classList.remove("scroll-lock");
    return;
  }
  if (!slot.classList.contains("is-open")) {
    slot.hidden = true;
    anclarFiltros(false);
  }
}

function montarFiltros() {
  const slot = document.querySelector("[data-filtros]");
  if (!slot || slot.dataset.listo === "1") return;
  slot.dataset.listo = "1";
  const select = el("select", { "data-filtro-cat": "true", "aria-label": "Categoría" },
    el("option", { value: "" }, "Todas"),
    ...categorias.map((categoria) => el("option", { value: categoria.id }, categoria.nombre))
  );
  select.addEventListener("change", () => cambiarCategoria(select.value));
  const minInput = el("input", { type: "range", "data-precio-min": "true", "aria-label": "Precio mínimo" });
  const maxInput = el("input", { type: "range", "data-precio-max": "true", "aria-label": "Precio máximo" });
  minInput.addEventListener("input", () => moverRango("min"));
  maxInput.addEventListener("input", () => moverRango("max"));
  minInput.addEventListener("change", soltarRango);
  maxInput.addEventListener("change", soltarRango);
  const ofertas = el("input", { type: "checkbox", "data-filtro-ofertas": "true" });
  const disponibles = el("input", { type: "checkbox", "data-filtro-disponibles": "true" });
  const sinformula = el("input", { type: "checkbox", "data-filtro-sinformula": "true" });
  ofertas.addEventListener("change", () => aplicarCheck("ofertas", ofertas.checked));
  disponibles.addEventListener("change", () => aplicarCheck("disponibles", disponibles.checked));
  sinformula.addEventListener("change", () => aplicarCheck("sinformula", sinformula.checked));
  slot.replaceChildren(
    el("div", { class: "filtros-head" },
      el("h2", {}, "Filtros"),
      el("button", { type: "button", class: "icon-btn filtros-cerrar", "aria-label": "Cerrar filtros", onclick: cerrarFiltros }, icono("close"))
    ),
    el("label", { class: "filtro-campo" }, "Categoría", select),
    el("div", { class: "filtro-campo", "data-rango": "true" },
      el("span", {}, "Precio"),
      el("span", { class: "hint", "data-precio-leyenda": "true" }, ""),
      el("div", { class: "rango" },
        el("span", { class: "rango-pista", "aria-hidden": "true" }),
        el("span", { class: "rango-lleno", "aria-hidden": "true" }),
        minInput,
        maxInput
      )
    ),
    el("label", { class: "check" }, ofertas, el("span", {}, "Solo ofertas")),
    el("label", { class: "check" }, disponibles, el("span", {}, "Solo disponibles")),
    el("label", { class: "check" }, sinformula, el("span", {}, "Sin fórmula"))
  );
  if (!document.querySelector("[data-filtros-overlay]")) {
    const overlay = el("div", { class: "filtros-overlay", "data-filtros-overlay": "true", hidden: true });
    overlay.addEventListener("click", cerrarFiltros);
    document.body.append(overlay);
  }
  document.querySelector("[data-abrir-filtros]")?.addEventListener("click", abrirFiltros);
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") cerrarFiltros();
  });
  window.addEventListener("resize", sincronizarPanel);
  sincronizarPanel();
}

function pintarEncabezadoCategoria() {
  if (!paginaCategoria()) return;
  const nombre = estado.categoria || "Categoría";
  const titulo = document.querySelector("[data-cat-titulo]");
  if (titulo) titulo.textContent = nombre;
  const copia = document.querySelector("[data-cat-copy]");
  if (copia) copia.textContent = estado.categoria
    ? `Productos de ${nombre} en Droguerías Reina. Domicilios a Funza y Mosquera.`
    : "No encontramos esa categoría.";
  const migas = document.querySelector("[data-migas]");
  if (migas) {
    migas.replaceChildren(
      el("a", { href: "index.html" }, "Inicio"),
      el("span", { "aria-hidden": "true" }, "/"),
      el("span", { "aria-current": "page" }, nombre)
    );
  }
  document.title = `${nombre} | Droguerías Reina`;
  const descripcion = estado.categoria
    ? `Compra ${nombre} en Droguerías Reina. Domicilios a Funza y Mosquera.`
    : "Categoría de Droguerías Reina.";
  const meta = document.querySelector("meta[name='description']");
  if (meta) meta.content = descripcion;
}

async function limitesPrecio() {
  const base = () => supabase.from("productos").select("precio").eq("activo", true);
  const [bajo, alto] = await Promise.all([
    base().order("precio", { ascending: true }).limit(1),
    base().order("precio", { ascending: false }).limit(1)
  ]);
  const min = Number(bajo.data?.[0]?.precio);
  const max = Number(alto.data?.[0]?.precio);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return;
  const paso = max - min > 50000 ? 1000 : max - min > 10000 ? 500 : 100;
  estado.piso = Math.floor(min / paso) * paso;
  estado.techo = Math.max(estado.piso, Math.ceil(max / paso) * paso);
  reflejarRango();
}

export function iniciarTienda() {
  leerUrl();
  if (paginaCategoria() && !estado.categoria) {
    pintarEncabezadoCategoria();
    const grid = document.querySelector("[data-grid]");
    if (grid) {
      grid.setAttribute("aria-busy", "false");
      grid.replaceChildren(estadoVacio("search", "No encontramos esa categoría", "Vuelve al catálogo y elige otra.", el("a", { class: "btn btn-primary", href: "index.html#catalogo" }, "Ver catálogo")));
    }
    return;
  }
  montarFiltros();
  reflejarFiltros();
  pintarEncabezadoCategoria();
  pintarCategorias();
  limitesPrecio();
  const orden = document.querySelector("[data-sort]");
  orden?.addEventListener("change", () => {
    estado.orden = ORDENES.has(orden.value) ? orden.value : "nombre.asc";
    estado.pagina = 1;
    escribirUrl("push");
    cargarCatalogo({ modo: "filtro" });
  });
  const pager = document.querySelector("[data-pager]");
  pager?.addEventListener("click", (evento) => {
    const boton = evento.target.closest("button");
    if (!boton || boton.disabled) return;
    const y = window.scrollY;
    if (boton.hasAttribute("data-prev")) estado.pagina -= 1;
    if (boton.hasAttribute("data-next")) estado.pagina += 1;
    escribirUrl("push");
    cargarCatalogo({ modo: "pagina", boton }).finally(() => {
      const catalogo = document.getElementById("catalogo") || document.getElementById("contenido");
      if (!catalogo) return;
      const arriba = catalogo.getBoundingClientRect().top;
      if (arriba < 0 || arriba > window.innerHeight * 0.4) catalogo.scrollIntoView({ block: "start", behavior: "auto" });
      else window.scrollTo(0, y);
    });
  });
  let timer = 0;
  const aplicar = (valor, desplazar, modo) => {
    const q = String(valor || "");
    if (q === estado.q && !desplazar) return;
    estado.q = q;
    estado.pagina = 1;
    escribirUrl(modo);
    reflejarFiltros();
    cargarCatalogo({ modo: "filtro" });
    if (desplazar) document.getElementById("catalogo")?.scrollIntoView({ block: "start", behavior: "auto" });
  };
  document.addEventListener("reina:escribir", (evento) => {
    clearTimeout(timer);
    timer = setTimeout(() => aplicar(evento.detail, false, "push"), 280);
  });
  document.addEventListener("reina:buscar", (evento) => {
    clearTimeout(timer);
    aplicar(evento.detail, true, "push");
  });
  window.addEventListener("popstate", () => {
    silencio = true;
    leerUrl();
    reflejarFiltros();
    marcarCategorias();
    pintarEncabezadoCategoria();
    silencio = false;
    cargarCatalogo({ modo: "filtro" });
  });
  if (location.hash === "#buscar") document.getElementById("buscar")?.focus();
  cargarOfertas();
  cargarCatalogo();
}
