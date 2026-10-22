import { supabase } from "./supabase.js";
import { categorias } from "./config.js";
import { el } from "./dom.js";
import { icono } from "./icons.js";
import { descuento, dinero, esFormula, marcaVisible, sanearBusqueda } from "./format.js";
import { enlaceWhatsapp } from "./pago.js";
import { agregarProducto, sincronizarCarrito } from "./cart.js";
import { avisar, cerrarCarrito, volarAlCarrito } from "./layout.js";

const POR_PAGINA = 24;
const COLUMNAS = "id,nombre,marca,presentacion,categoria,precio,precio_anterior,stock,requiere_formula,activo,imagen";
const ORDENES = new Set(["nombre.asc", "nombre.desc", "precio.asc", "precio.desc"]);

const estado = {
  categoria: "",
  orden: "nombre.asc",
  q: "",
  pagina: 1,
  total: 0
};

const ILUSTRACIONES = {
  Medicamentos: "assets/productos/medicamentos.svg",
  "Cuidado personal": "assets/productos/cuidado.svg",
  "Bebé": "assets/productos/bebe.svg",
  "Belleza y dermocosmética": "assets/productos/belleza.svg",
  "Vitaminas y suplementos": "assets/productos/vitaminas.svg",
  "Botiquín": "assets/productos/botiquin.svg",
  "Adulto mayor": "assets/productos/adulto.svg",
  "Hogar y aseo": "assets/productos/hogar.svg"
};

let secuencia = 0;
let fichaAbierta = null;
let soltarFicha = null;
let observadorArte = null;

function ilustracionDe(categoria) {
  return ILUSTRACIONES[categoria] || ILUSTRACIONES.Medicamentos;
}

function desfase(id) {
  const texto = String(id ?? "");
  let n = 0;
  for (let i = 0; i < texto.length; i += 1) n = (n + texto.charCodeAt(i) * (i + 1)) % 8;
  return n;
}

function vigilarArte() {
  const tarjetas = document.querySelectorAll(".product");
  const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducido) {
    tarjetas.forEach((tarjeta) => tarjeta.classList.remove("is-live"));
    if (observadorArte) observadorArte.disconnect();
    return;
  }
  if (!("IntersectionObserver" in window)) {
    tarjetas.forEach((tarjeta) => tarjeta.classList.add("is-live"));
    return;
  }
  if (!observadorArte) {
    observadorArte = new IntersectionObserver((entradas) => {
      entradas.forEach((entrada) => {
        entrada.target.classList.toggle("is-live", entrada.isIntersecting);
      });
    }, { rootMargin: "48px 0px", threshold: 0.15 });
  }
  observadorArte.disconnect();
  tarjetas.forEach((tarjeta) => observadorArte.observe(tarjeta));
}

function leerUrl() {
  const params = new URLSearchParams(location.search);
  const categoria = params.get("categoria") || "";
  estado.categoria = categorias.some((item) => item.id === categoria) ? categoria : "";
  const orden = params.get("orden") || "nombre.asc";
  estado.orden = ORDENES.has(orden) ? orden : "nombre.asc";
  estado.q = params.get("q") || "";
  const pagina = Number(params.get("pagina"));
  estado.pagina = Number.isInteger(pagina) && pagina > 0 ? pagina : 1;
  const ordenSelect = document.querySelector("[data-sort]");
  if (ordenSelect) ordenSelect.value = estado.orden;
  document.querySelectorAll("[data-search-input]").forEach((input) => {
    input.value = estado.q;
  });
}

function escribirUrl() {
  const url = new URL(location.href);
  if (estado.q) url.searchParams.set("q", estado.q);
  else url.searchParams.delete("q");
  if (estado.categoria) url.searchParams.set("categoria", estado.categoria);
  else url.searchParams.delete("categoria");
  if (estado.orden !== "nombre.asc") url.searchParams.set("orden", estado.orden);
  else url.searchParams.delete("orden");
  if (estado.pagina > 1) url.searchParams.set("pagina", String(estado.pagina));
  else url.searchParams.delete("pagina");
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash === "#carrito" ? "" : url.hash}`);
}

function marcarCategorias() {
  document.querySelectorAll("[data-categoria]").forEach((chip) => {
    const activa = chip.dataset.categoria === estado.categoria;
    chip.classList.toggle("is-on", activa);
    if (activa) chip.setAttribute("aria-current", "true");
    else chip.removeAttribute("aria-current");
  });
}

function pintarCategorias() {
  const lista = document.querySelector("[data-categorias]");
  if (!lista) return;
  const todas = el("a", {
    class: "chip",
    href: "index.html#catalogo",
    "data-categoria": ""
  }, el("span", { class: "chip-icon" }, icono("grid")), el("span", {}, "Todas"));
  const chips = categorias.map((categoria) => el("a", {
    class: "chip",
    href: `index.html?categoria=${encodeURIComponent(categoria.id)}#catalogo`,
    "data-categoria": categoria.id
  }, el("span", { class: "chip-icon" }, icono(categoria.icono)), el("span", {}, categoria.nombre)));
  lista.replaceChildren(todas, ...chips);
  lista.addEventListener("click", (evento) => {
    const chip = evento.target.closest("[data-categoria]");
    if (!chip) return;
    evento.preventDefault();
    estado.categoria = chip.dataset.categoria || "";
    estado.pagina = 1;
    marcarCategorias();
    escribirUrl();
    cargarCatalogo();
    document.getElementById("catalogo")?.scrollIntoView({ block: "start", behavior: "auto" });
  });
  marcarCategorias();
}

function etiquetas(producto) {
  const formula = esFormula(producto.requiere_formula);
  const oferta = !formula && descuento(producto.precio, producto.precio_anterior) > 0;
  const agotado = Number(producto.stock) <= 0;
  return [
    oferta ? el("span", { class: "tag tag-offer" }, "Oferta") : null,
    agotado ? el("span", { class: "tag tag-out" }, "Agotado") : null,
    formula ? el("span", { class: "tag tag-rx" }, "Requiere fórmula médica") : null
  ].filter(Boolean);
}

function foto(producto) {
  const caja = el("div", { class: "product-media" });
  const arte = el("div", { class: "product-art" });
  const reserva = ilustracionDe(producto.categoria);
  const propia = String(producto.imagen || "").trim();
  const img = el("img", {
    src: propia || reserva,
    alt: [producto.nombre, marcaVisible(producto.marca), producto.presentacion].filter(Boolean).join(", "),
    loading: "lazy",
    decoding: "async"
  });
  img.addEventListener("error", () => {
    if (!img.dataset.reserva && img.getAttribute("src") !== reserva) {
      img.dataset.reserva = "1";
      img.setAttribute("src", reserva);
      return;
    }
    arte.remove();
    if (!caja.querySelector(".chip-icon")) {
      const item = categorias.find((cat) => cat.id === producto.categoria);
      caja.append(el("span", { class: "chip-icon" }, icono(item ? item.icono : "pill")));
      caja.classList.add("is-icon");
    }
  });
  arte.append(img, el("span", { class: "product-glint", "aria-hidden": "true" }));
  caja.append(arte);
  etiquetas(producto).forEach((tag) => caja.append(tag));
  return caja;
}

function precios(producto) {
  const formula = esFormula(producto.requiere_formula);
  const off = formula ? 0 : descuento(producto.precio, producto.precio_anterior);
  if (!off) return el("p", { class: "product-price" }, el("strong", {}, dinero(producto.precio)));
  return el("p", { class: "product-price" },
    el("s", {}, dinero(producto.precio_anterior)),
    el("strong", {}, dinero(producto.precio)),
    el("span", { class: "off" }, `-${off}%`)
  );
}

function agregar(producto, origen) {
  const resultado = agregarProducto(producto);
  if (!resultado.ok) {
    avisar(resultado.mensaje || "No pudimos agregar el producto.");
    return;
  }
  volarAlCarrito(origen);
  avisar(`Agregaste ${producto.nombre}`);
}

function accionProducto(producto, imagen) {
  const formula = esFormula(producto.requiere_formula);
  const agotado = Number(producto.stock) <= 0;
  if (formula) {
    const presentacion = producto.presentacion ? ` (${producto.presentacion})` : "";
    const texto = `Hola, quiero consultar por ${producto.nombre}${presentacion}. Tengo la fórmula médica.`;
    const boton = el("button", {
      type: "button",
      class: "btn btn-consult",
      "aria-label": `Consultar ${producto.nombre}`
    }, "Consultar");
    boton.addEventListener("click", () => {
      const url = enlaceWhatsapp(texto);
      if (url) window.open(url, "_blank", "noopener");
    });
    return boton;
  }
  return el("button", {
    type: "button",
    class: "btn btn-add",
    disabled: agotado,
    onclick: () => agregar(producto, imagen)
  }, agotado ? "Agotado" : "Agregar");
}

function tarjeta(producto) {
  const media = foto(producto);
  const marca = marcaVisible(producto.marca);
  const abrir = el("button", {
    type: "button",
    class: "product-open",
    "aria-label": `Ver ${producto.nombre}`,
    onclick: () => abrirFicha(producto)
  },
    media,
    marca ? el("span", { class: "product-brand" }, marca) : null,
    el("span", { class: "product-name" }, producto.nombre),
    producto.presentacion ? el("span", { class: "product-pres" }, producto.presentacion) : null
  );
  const boton = accionProducto(producto, media.querySelector("img"));
  const nodo = el("article", { class: "product" }, abrir, el("div", { class: "product-buy" }, precios(producto), boton));
  nodo.style.setProperty("--float-i", String(desfase(producto.id)));
  return nodo;
}

function esqueleto(cantidad = 8) {
  const grid = document.querySelector("[data-grid]");
  if (!grid) return;
  grid.setAttribute("aria-busy", "true");
  grid.replaceChildren();
  for (let i = 0; i < cantidad; i += 1) {
    grid.append(el("div", { class: "skeleton-card", "aria-hidden": "true" },
      el("div", { class: "skeleton sk-media" }),
      el("div", { class: "skeleton sk-line" }),
      el("div", { class: "skeleton sk-line short" })
    ));
  }
  const estadoTexto = document.querySelector("[data-catalogo-estado]");
  if (estadoTexto) estadoTexto.textContent = "Cargando productos";
  vigilarArte();
}

function anunciar(texto) {
  const nodo = document.querySelector("[data-catalogo-estado]");
  if (nodo) nodo.textContent = texto;
}

function pintarVacio() {
  const grid = document.querySelector("[data-grid]");
  grid.setAttribute("aria-busy", "false");
  const cuentaVacia = document.querySelector("[data-count]");
  if (cuentaVacia) cuentaVacia.textContent = "0 productos";
  grid.replaceChildren(el("div", { class: "empty-state" },
    icono("search"),
    el("h3", {}, "No encontramos productos"),
    el("p", {}, "Prueba con otro nombre, otra marca o quita los filtros."),
    el("button", {
      type: "button",
      class: "btn btn-ghost",
      onclick: () => {
        estado.q = "";
        estado.categoria = "";
        estado.pagina = 1;
        document.querySelectorAll("[data-search-input]").forEach((input) => {
          input.value = "";
        });
        marcarCategorias();
        escribirUrl();
        cargarCatalogo();
      }
    }, "Limpiar filtros")
  ));
  document.querySelector("[data-pager]").hidden = true;
  anunciar("No hay productos con esos filtros");
  vigilarArte();
}

function pintarError() {
  const grid = document.querySelector("[data-grid]");
  grid.setAttribute("aria-busy", "false");
  const cuenta = document.querySelector("[data-count]");
  if (cuenta) cuenta.textContent = "No pudimos cargar el catálogo. Inténtalo de nuevo.";
  const pager = document.querySelector("[data-pager]");
  if (pager) pager.hidden = true;
  grid.replaceChildren(el("div", { class: "empty-state" },
    el("h3", {}, "No pudimos cargar el catálogo. Inténtalo de nuevo."),
    el("button", { type: "button", class: "btn btn-primary", onclick: () => cargarCatalogo() }, "Reintentar")
  ));
  anunciar("No pudimos cargar el catálogo. Inténtalo de nuevo.");
  vigilarArte();
}

function pintarProductos(lista) {
  const grid = document.querySelector("[data-grid]");
  grid.setAttribute("aria-busy", "false");
  if (!lista.length) {
    pintarVacio();
    return;
  }
  grid.replaceChildren(...lista.map(tarjeta));
  const inicio = (estado.pagina - 1) * POR_PAGINA + 1;
  const fin = inicio + lista.length - 1;
  const cuenta = document.querySelector("[data-count]");
  if (cuenta) cuenta.textContent = estado.total ? `Mostrando ${inicio}–${fin} de ${estado.total}` : `${lista.length} productos`;
  const paginas = Math.max(1, Math.ceil(estado.total / POR_PAGINA));
  const pager = document.querySelector("[data-pager]");
  pager.hidden = paginas < 2;
  const label = pager.querySelector("[data-page-label]");
  if (label) label.textContent = `Página ${estado.pagina} de ${paginas}`;
  pager.querySelector("[data-prev]").disabled = estado.pagina <= 1;
  pager.querySelector("[data-next]").disabled = estado.pagina >= paginas;
  anunciar(`${lista.length} productos en el catálogo`);
  vigilarArte();
}

async function cargarCatalogo() {
  const id = ++secuencia;
  esqueleto();
  const desde = (estado.pagina - 1) * POR_PAGINA;
  const hasta = desde + POR_PAGINA - 1;
  let consulta = supabase.from("productos").select(COLUMNAS, { count: "exact" }).eq("activo", true);
  if (estado.categoria) consulta = consulta.eq("categoria", estado.categoria);
  const q = sanearBusqueda(estado.q);
  if (q) consulta = consulta.or(`nombre.ilike.%${q}%,marca.ilike.%${q}%`);
  const [campo, direccion] = estado.orden.split(".");
  consulta = consulta.order(campo, { ascending: direccion !== "desc" }).range(desde, hasta);
  const { data, error, count } = await consulta;
  if (id !== secuencia) return;
  if (error) {
    console.error(error);
    pintarError();
    return;
  }
  estado.total = count || 0;
  const paginas = Math.max(1, Math.ceil(estado.total / POR_PAGINA));
  if (estado.pagina > paginas) {
    estado.pagina = paginas;
    escribirUrl();
    cargarCatalogo();
    return;
  }
  pintarProductos(data || []);
  const aviso = sincronizarCarrito(data || []);
  if (aviso) avisar(aviso);
}

async function cargarOfertas() {
  const contenedor = document.querySelector("[data-ofertas]");
  if (!contenedor) return;
  contenedor.replaceChildren(el("div", { class: "skeleton-card", "aria-hidden": "true" }, el("div", { class: "skeleton sk-media" }), el("div", { class: "skeleton sk-line" })));
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
    contenedor.replaceChildren(el("p", { class: "hint" }, "No pudimos cargar las ofertas."));
    vigilarArte();
    return;
  }
  const ofertas = (data || []).filter((producto) => descuento(producto.precio, producto.precio_anterior) > 0);
  if (!ofertas.length) {
    contenedor.replaceChildren(el("p", { class: "hint" }, "Pronto verás ofertas en productos que no requieren fórmula."));
    vigilarArte();
    return;
  }
  contenedor.replaceChildren(...ofertas.map(tarjeta));
  vigilarArte();
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
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) ocultar();
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
  cerrarCarrito();
  const { overlay, ficha } = asegurarFicha();
  fichaAbierta = document.activeElement;
  const titulo = ficha.querySelector("#ficha-titulo");
  titulo.textContent = producto.nombre;
  const cuerpo = ficha.querySelector("[data-ficha-body]");
  const formula = esFormula(producto.requiere_formula);
  const agotado = Number(producto.stock) <= 0;
  const media = foto(producto);
  const marca = marcaVisible(producto.marca);
  const descripcion = el("p", { class: "sheet-copy", "data-desc": "true" }, "Cargando la descripción…");
  cuerpo.replaceChildren(
    media,
    marca ? el("p", { class: "product-brand" }, marca) : null,
    producto.presentacion ? el("p", { class: "product-pres" }, producto.presentacion) : null,
    precios(producto),
    el("p", { class: agotado ? "stock-note" : "stock-note is-ok" }, agotado ? "Agotado" : `Disponibles: ${Number(producto.stock)}`),
    formula ? el("p", { class: "tag tag-rx" }, "Requiere fórmula médica") : null,
    descripcion,
    accionProducto(producto, media.querySelector("img"))
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

export function iniciarTienda() {
  leerUrl();
  pintarCategorias();
  const orden = document.querySelector("[data-sort]");
  orden?.addEventListener("change", () => {
    estado.orden = ORDENES.has(orden.value) ? orden.value : "nombre.asc";
    estado.pagina = 1;
    escribirUrl();
    cargarCatalogo();
  });
  const pager = document.querySelector("[data-pager]");
  pager?.addEventListener("click", (evento) => {
    const boton = evento.target.closest("button");
    if (!boton || boton.disabled) return;
    if (boton.hasAttribute("data-prev")) estado.pagina -= 1;
    if (boton.hasAttribute("data-next")) estado.pagina += 1;
    escribirUrl();
    cargarCatalogo();
    document.getElementById("catalogo")?.scrollIntoView({ block: "start", behavior: "auto" });
  });
  let timer = 0;
  const aplicar = (valor, desplazar) => {
    const q = String(valor || "");
    if (q === estado.q && !desplazar) return;
    estado.q = q;
    estado.pagina = 1;
    escribirUrl();
    cargarCatalogo();
    if (desplazar) document.getElementById("catalogo")?.scrollIntoView({ block: "start", behavior: "auto" });
  };
  document.addEventListener("reina:escribir", (evento) => {
    clearTimeout(timer);
    timer = setTimeout(() => aplicar(evento.detail, false), 280);
  });
  document.addEventListener("reina:buscar", (evento) => {
    clearTimeout(timer);
    aplicar(evento.detail, true);
  });
  if (location.hash === "#buscar") {
    document.getElementById("buscar")?.focus();
  }
  cargarOfertas();
  cargarCatalogo();
}
