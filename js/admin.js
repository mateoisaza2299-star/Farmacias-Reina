import { supabase } from "./supabase.js";
import { categorias } from "./config.js";
import { sesionAdmin } from "./acceso.js";
import { el } from "./dom.js";
import { icono, marcaLogo } from "./icons.js";
import { dinero, esFormula, fechaHora, marcaVisible, mensajeError, parseNumero, soloDigitos } from "./format.js";
import { etiquetaEstado, interpretarPedido, prioridadEstado } from "./pedidos.js";
import { enlaceAvisarCliente } from "./pago.js";
import { avisar } from "./layout.js";

const POR_PAGINA = 30;
let usuario = null;
let pedidos = [];
let vistos = null;
let filtroPedido = "activos";
let textoPedido = "";
let productos = [];
let textoProducto = "";
let paginaProducto = 1;
let totalProductos = 0;
let editando = null;
let imagenNueva = null;
let timerCampo = new Map();
let poll = 0;

const ESTADOS_FILTRO = [
  ["activos", "En curso"],
  ["revision", "En revisión"],
  ["pendiente_pago", "Pendiente de pago"],
  ["pagado", "Pagado"],
  ["despachado", "Despachado"],
  ["entregado", "Entregado"],
  ["rechazado", "Rechazado"],
  ["cancelado", "Cancelado"],
  ["todos", "Todos"]
];

function normalizarCategoria(valor) {
  const limpio = String(valor || "").trim();
  const clave = limpio.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const alias = {
    medicamentos: "Medicamentos",
    "cuidado personal": "Cuidado personal",
    bebe: "Bebé",
    belleza: "Belleza y dermocosmética",
    "belleza y dermocosmetica": "Belleza y dermocosmética",
    vitaminas: "Vitaminas y suplementos",
    "vitaminas y suplementos": "Vitaminas y suplementos",
    botiquin: "Botiquín",
    "adulto mayor": "Adulto mayor",
    hogar: "Hogar y aseo",
    "hogar y aseo": "Hogar y aseo"
  };
  if (alias[clave]) return alias[clave];
  const exacta = categorias.find((item) => item.nombre.toLowerCase() === limpio.toLowerCase());
  return exacta ? exacta.id : limpio;
}

function esSi(valor) {
  return ["si", "sí", "true", "1", "x", "yes", "verdadero"].includes(String(valor || "").trim().toLowerCase());
}

function parseCSV(texto) {
  const filas = [];
  let fila = [];
  let celda = "";
  let comillas = false;
  const fuente = String(texto || "").replace(/^\uFEFF/, "");
  const primera = fuente.split(/\r?\n/, 1)[0] || "";
  const separador = (primera.match(/;/g) || []).length > (primera.match(/,/g) || []).length ? ";" : ",";
  for (let i = 0; i < fuente.length; i += 1) {
    const char = fuente[i];
    if (comillas) {
      if (char === '"') {
        if (fuente[i + 1] === '"') {
          celda += '"';
          i += 1;
        } else comillas = false;
      } else celda += char;
    } else if (char === '"') comillas = true;
    else if (char === separador) {
      fila.push(celda.trim());
      celda = "";
    } else if (char === "\n") {
      fila.push(celda.trim());
      filas.push(fila);
      fila = [];
      celda = "";
    } else if (char !== "\r") celda += char;
  }
  if (celda.length || fila.length) {
    fila.push(celda.trim());
    filas.push(fila);
  }
  if (!filas.length) return [];
  const encabezados = filas.shift().map((item) => item.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, "_"));
  return filas.filter((row) => row.some(Boolean)).map((row, indice) => {
    const objeto = { _linea: indice + 2 };
    encabezados.forEach((clave, i) => {
      objeto[clave] = row[i] || "";
    });
    return objeto;
  });
}

function prepararFila(row) {
  const nombre = (row.nombre || "").trim();
  const marca = (row.marca || "").trim();
  const presentacion = (row.presentacion || "").trim();
  const categoria = normalizarCategoria(row.categoria || "");
  const precio = parseNumero(row.precio);
  const stock = parseNumero(row.stock);
  const requiere = esSi(row.requiere_formula);
  const errores = [];
  if (!nombre) errores.push("falta el nombre");
  if (!presentacion) errores.push("falta la presentación");
  if (!categoria) errores.push("falta la categoría");
  if (!Number.isFinite(precio) || precio < 0) errores.push("precio inválido");
  if (!Number.isInteger(stock) || stock < 0) errores.push("stock inválido");
  return {
    linea: row._linea,
    nombre,
    marca,
    presentacion,
    categoria,
    precio,
    stock,
    requiere_formula: requiere,
    errores
  };
}

function mostrarTab(nombre) {
  document.querySelectorAll("[data-tab]").forEach((tab) => {
    const activa = tab.dataset.tab === nombre;
    tab.setAttribute("aria-selected", activa ? "true" : "false");
    tab.tabIndex = activa ? 0 : -1;
  });
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== nombre;
  });
  history.replaceState(null, "", `#${nombre}`);
  if (nombre === "pedidos") cargarPedidos(true);
  if (nombre === "productos") cargarProductos();
  if (nombre === "ajustes") cargarAjustes();
}

function armarTabs() {
  document.querySelectorAll("[data-tab]").forEach((tab) => {
    tab.addEventListener("click", () => mostrarTab(tab.dataset.tab));
  });
  const inicial = location.hash.replace("#", "");
  const nombres = ["pedidos", "productos", "ajustes"];
  mostrarTab(nombres.includes(inicial) ? inicial : "pedidos");
}

async function leerPedidos() {
  let respuesta = await supabase.from("pedidos").select("*, pedido_items(*)").order("created_at", { ascending: false }).limit(200);
  if (respuesta.error) respuesta = await supabase.from("pedidos").select("*").order("created_at", { ascending: false }).limit(200);
  if (respuesta.error) respuesta = await supabase.from("pedidos").select("*").limit(200);
  if (respuesta.error) throw respuesta.error;
  let lista = (respuesta.data || []).map((row) => interpretarPedido(row)).filter(Boolean);
  if (lista.some((pedido) => pedido.id && !pedido.items.length)) {
    const items = await supabase.from("pedido_items").select("*").limit(2000);
    if (!items.error && items.data?.length) {
      const grupos = new Map();
      items.data.forEach((item) => {
        const clave = String(item.pedido_id || item.id_pedido || item.pedido || "");
        if (!clave) return;
        const grupo = grupos.get(clave) || [];
        grupo.push(item);
        grupos.set(clave, grupo);
      });
      lista = lista.map((pedido) => {
        if (pedido.items.length || !grupos.has(String(pedido.id))) return pedido;
        return interpretarPedido({ ...pedido, items: grupos.get(String(pedido.id)) });
      });
    }
  }
  lista.sort((a, b) => {
    const peso = prioridadEstado(a.estado) - prioridadEstado(b.estado);
    if (peso) return peso;
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });
  return lista;
}

function anunciarNuevos(lista) {
  const ids = new Set(lista.map((pedido) => pedido.id).filter(Boolean));
  if (vistos) {
    const nuevos = lista.filter((pedido) => pedido.id && !vistos.has(pedido.id));
    const banner = document.querySelector("[data-nuevo]");
    const texto = banner?.querySelector("[data-nuevo-texto]");
    if (nuevos.length && banner && texto) {
      banner.hidden = false;
      texto.textContent = nuevos.length > 1 ? `Llegaron ${nuevos.length} pedidos nuevos.` : "Llegó un pedido nuevo.";
      if (navigator.vibrate) navigator.vibrate([180, 80, 180]);
    }
  }
  vistos = ids;
}

function pedidosVisibles() {
  const q = textoPedido.trim().toLowerCase();
  return pedidos.filter((pedido) => {
    if (filtroPedido === "activos" && !["revision", "pendiente_pago"].includes(pedido.estado)) return false;
    if (filtroPedido !== "activos" && filtroPedido !== "todos" && pedido.estado !== filtroPedido) return false;
    if (!q) return true;
    return `${pedido.numero || ""} ${pedido.nombre} ${pedido.telefono}`.toLowerCase().includes(q);
  });
}

async function cambiarEstado(pedido, estado) {
  if (estado === "despachado") {
    const { error } = await supabase.rpc("descontar_stock", { p_pedido: pedido.id });
    if (error) throw error;
  }
  const { error } = await supabase.from("pedidos").update({ estado, avisado: false }).eq("id", pedido.id);
  if (error) throw error;
}

function botonEstado(pedido, etiqueta, estado, peligro) {
  return el("button", {
    type: "button",
    class: peligro ? "btn btn-danger" : "btn btn-ghost",
    onclick: async (evento) => {
      const boton = evento.currentTarget;
      if (peligro && boton.dataset.confirmar !== "1") {
        boton.dataset.confirmar = "1";
        boton.textContent = `Confirmar ${etiqueta.toLowerCase()}`;
        setTimeout(() => {
          if (!boton.isConnected) return;
          boton.dataset.confirmar = "";
          boton.textContent = etiqueta;
        }, 3500);
        return;
      }
      boton.disabled = true;
      try {
        await cambiarEstado(pedido, estado);
        await cargarPedidos(true);
      } catch (error) {
        avisar(mensajeError(error));
        boton.disabled = false;
        boton.textContent = etiqueta;
      }
    }
  }, etiqueta);
}

async function verFormula(pedido) {
  const ruta = String(pedido.formula_path || "").replace(/^\/+/, "").replace(/^formulas\//, "");
  const { data, error } = await supabase.storage.from("formulas").createSignedUrl(ruta, 90);
  if (error || !data?.signedUrl) {
    avisar("No pudimos abrir la fórmula. Intenta de nuevo.");
    return;
  }
  let capa = document.getElementById("visor");
  if (!capa) {
    capa = el("div", { class: "overlay", id: "visor", hidden: true });
    const hoja = el("section", { class: "sheet sheet-formula", role: "dialog", "aria-modal": "true", "aria-labelledby": "visor-titulo", tabindex: "-1" });
    hoja.append(
      el("div", { class: "sheet-head" },
        el("h2", { id: "visor-titulo" }, "Fórmula médica"),
        el("button", { type: "button", class: "icon-btn", "aria-label": "Cerrar fórmula", onclick: cerrarVisor }, icono("close"))
      ),
      el("div", { class: "sheet-body", "data-visor": "true" })
    );
    capa.addEventListener("click", (evento) => {
      if (evento.target === capa) cerrarVisor();
    });
    document.body.append(capa, hoja);
    document.addEventListener("keydown", (evento) => {
      if (evento.key === "Escape") cerrarVisor();
    });
  }
  const hoja = document.querySelector(".sheet-formula");
  const marco = hoja.querySelector("[data-visor]");
  const pdf = /\.pdf$/i.test(ruta);
  marco.replaceChildren();
  if (pdf) marco.append(el("iframe", { src: data.signedUrl, title: "Fórmula médica" }));
  else {
    const img = el("img", { src: data.signedUrl, alt: "Fórmula médica del pedido" });
    img.addEventListener("error", () => marco.prepend(el("iframe", { src: data.signedUrl, title: "Fórmula médica" })));
    marco.append(img);
  }
  marco.append(el("a", { class: "btn btn-ghost", href: data.signedUrl, target: "_blank", rel: "noopener noreferrer" }, "Abrir en una pestaña"));
  capa.hidden = false;
  hoja.hidden = false;
  requestAnimationFrame(() => {
    capa.classList.add("is-open");
    hoja.classList.add("is-open");
  });
  hoja.focus();
}

function cerrarVisor() {
  const capa = document.getElementById("visor");
  const hoja = document.querySelector(".sheet-formula");
  if (!capa || !hoja || !hoja.classList.contains("is-open")) return;
  capa.classList.remove("is-open");
  hoja.classList.remove("is-open");
  capa.hidden = true;
  hoja.hidden = true;
}

async function avisarCliente(pedido) {
  const url = enlaceAvisarCliente(pedido);
  if (!url) {
    avisar("Este pedido no tiene un celular para WhatsApp.");
    return;
  }
  window.open(url, "_blank", "noopener");
  const { error } = await supabase.from("pedidos").update({ avisado: true }).eq("id", pedido.id);
  if (error) {
    avisar(mensajeError(error));
    return;
  }
  await cargarPedidos(true);
}

function tarjetaPedido(pedido) {
  const telefono = soloDigitos(pedido.telefono);
  const whats = telefono.length === 10 ? `https://wa.me/57${telefono}` : telefono ? `https://wa.me/${telefono}` : "";
  const terminal = ["entregado", "cancelado", "rechazado"].includes(pedido.estado);
  const acciones = [];
  if (pedido.formula_path) acciones.push(el("button", { type: "button", class: "btn btn-ghost", onclick: () => verFormula(pedido) }, "Ver fórmula"));
  if (pedido.estado === "revision") {
    acciones.push(botonEstado(pedido, "Aprobar", "pendiente_pago", false));
    acciones.push(botonEstado(pedido, "Rechazar", "rechazado", true));
  }
  if (!terminal && pedido.estado !== "revision" && pedido.estado !== "despachado") acciones.push(botonEstado(pedido, "Despachado", "despachado", false));
  if (!terminal && pedido.estado !== "revision" && pedido.estado !== "entregado") acciones.push(botonEstado(pedido, "Entregado", "entregado", false));
  if (!terminal) acciones.push(botonEstado(pedido, "Cancelar", "cancelado", true));
  acciones.push(el("button", { type: "button", class: "btn btn-whatsapp", onclick: () => avisarCliente(pedido) }, "Avisar por WhatsApp"));
  return el("article", { class: "order-card" },
    el("div", { class: "order-top" },
      el("h3", {}, pedido.numero ? `N.º ${pedido.numero}` : "Pedido"),
      el("time", {}, fechaHora(pedido.created_at) || "Hora por confirmar"),
      el("span", { class: `status status-${pedido.estado || "otro"}` }, etiquetaEstado(pedido.estado))
    ),
    el("p", {}, el("strong", {}, pedido.nombre || "Cliente sin nombre")),
    whats ? el("a", { href: whats, target: "_blank", rel: "noopener noreferrer" }, pedido.telefono) : el("p", {}, pedido.telefono || "Sin celular"),
    el("p", {}, [pedido.direccion, pedido.barrio].filter(Boolean).join(" · ") || "Sin dirección"),
    pedido.indicaciones ? el("p", { class: "hint" }, `Indicaciones: ${pedido.indicaciones}`) : null,
    el("ul", { class: "order-items" }, ...(pedido.items.length ? pedido.items : [{ nombre: "Sin detalle de productos", cantidad: "" }]).map((item) => el("li", {}, `${item.nombre}${item.presentacion ? ` · ${item.presentacion}` : ""}${item.cantidad ? ` × ${item.cantidad}` : ""}`))),
    el("p", { class: "order-total" }, `Total ${pedido.total == null ? "por confirmar" : dinero(pedido.total)}`),
    el("p", { class: pedido.avisado ? "avisado is-ok" : "avisado" }, pedido.avisado ? "Cliente avisado ✓" : "Falta avisar"),
    el("div", { class: "order-actions" }, ...acciones)
  );
}

function pintarPedidos() {
  const lista = document.querySelector("[data-pedidos]");
  if (!lista) return;
  const visibles = pedidosVisibles();
  if (!visibles.length) {
    lista.replaceChildren(el("p", { class: "empty-state" }, "No hay pedidos con ese filtro."));
    return;
  }
  lista.replaceChildren(...visibles.map(tarjetaPedido));
}

async function cargarPedidos(silencioso = false) {
  const lista = document.querySelector("[data-pedidos]");
  if (!silencioso && lista && !pedidos.length) lista.replaceChildren(el("p", { class: "hint" }, "Cargando pedidos…"));
  try {
    const listaNueva = await leerPedidos();
    anunciarNuevos(listaNueva);
    pedidos = listaNueva;
    pintarPedidos();
  } catch (error) {
    if (lista) lista.replaceChildren(el("p", { class: "form-error", role: "alert" }, mensajeError(error)));
  }
}

function armarPedidos() {
  const panel = document.querySelector("[data-panel='pedidos']");
  const banner = el("div", { class: "new-banner", "data-nuevo": "true", hidden: true });
  const textoNuevo = el("span", { "data-nuevo-texto": "true" });
  const cerrar = el("button", { type: "button", class: "text-btn", onclick: () => { banner.hidden = true; } }, "Ocultar");
  banner.append(textoNuevo, cerrar);
  const buscador = el("input", {
    type: "search",
    placeholder: "Busca por número, nombre o celular",
    "aria-label": "Buscar pedidos",
    oninput: (evento) => {
      textoPedido = evento.target.value;
      pintarPedidos();
    }
  });
  const filtros = el("div", { class: "filter-row", role: "group", "aria-label": "Filtrar por estado" });
  ESTADOS_FILTRO.forEach(([valor, etiqueta]) => {
    const boton = el("button", {
      type: "button",
      class: valor === filtroPedido ? "chip is-on" : "chip",
      onclick: () => {
        filtroPedido = valor;
        filtros.querySelectorAll(".chip").forEach((chip) => chip.classList.toggle("is-on", chip.dataset.filtro === valor));
        pintarPedidos();
      }
    }, etiqueta);
    boton.dataset.filtro = valor;
    filtros.append(boton);
  });
  panel.append(
    el("div", { class: "panel-head" }, el("h2", {}, "Pedidos"), el("button", { type: "button", class: "btn btn-ghost", onclick: () => cargarPedidos(true) }, "Actualizar")),
    banner,
    el("div", { class: "toolbar" }, buscador),
    filtros,
    el("div", { class: "order-list", "data-pedidos": "true" })
  );
}

function urlSegura(valor) {
  try {
    const url = new URL(valor);
    if (url.protocol === "https:" || url.protocol === "http:") return url.href;
  } catch {
    return "";
  }
  return "";
}

async function comprimirImagen(archivo) {
  if (!archivo.type.startsWith("image/")) throw new Error("La imagen debe ser JPG, PNG o WEBP.");
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, 960 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * escala));
  canvas.height = Math.max(1, Math.round(bitmap.height * escala));
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  let calidad = 0.76;
  let blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", calidad));
  while (blob && blob.size > 320000 && calidad > 0.42) {
    calidad -= 0.08;
    blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", calidad));
  }
  if (!blob || blob.size > 450000) throw new Error("La imagen sigue siendo muy pesada. Prueba con otra más pequeña.");
  return await new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result));
    lector.onerror = () => reject(new Error("No pudimos leer la imagen."));
    lector.readAsDataURL(blob);
  });
}

function programarCampo(id, patch, nodo) {
  clearTimeout(timerCampo.get(id + Object.keys(patch)[0]));
  const clave = `${id}:${Object.keys(patch)[0]}`;
  timerCampo.set(clave, setTimeout(async () => {
    const { error } = await supabase.from("productos").update(patch).eq("id", id);
    if (error) avisar(mensajeError(error));
    else if (nodo) {
      nodo.classList.add("is-saved");
      setTimeout(() => nodo.classList.remove("is-saved"), 1200);
    }
  }, 450));
}

function filaProducto(producto) {
  const formula = esFormula(producto.requiere_formula);
  const precio = el("input", {
    type: "number",
    min: "0",
    step: "1",
    value: String(Number(producto.precio) || 0),
    "aria-label": `Precio de ${producto.nombre}`,
    oninput: (evento) => programarCampo(producto.id, { precio: Number(evento.target.value) || 0 }, evento.target)
  });
  const stock = el("input", {
    type: "number",
    min: "0",
    step: "1",
    value: String(Number(producto.stock) || 0),
    "aria-label": `Stock de ${producto.nombre}`,
    oninput: (evento) => programarCampo(producto.id, { stock: Math.max(0, Math.trunc(Number(evento.target.value) || 0)) }, evento.target)
  });
  const rx = el("input", { type: "checkbox", checked: formula, "aria-label": `Requiere fórmula: ${producto.nombre}` });
  rx.addEventListener("change", async () => {
    const patch = { requiere_formula: rx.checked };
    if (rx.checked) patch.precio_anterior = null;
    const { error } = await supabase.from("productos").update(patch).eq("id", producto.id);
    if (error) avisar(mensajeError(error));
    else cargarProductos();
  });
  const activo = el("button", {
    type: "button",
    class: producto.activo ? "btn btn-ghost" : "btn btn-danger",
    onclick: async () => {
      const { error } = await supabase.from("productos").update({ activo: !producto.activo }).eq("id", producto.id);
      if (error) avisar(mensajeError(error));
      else cargarProductos();
    }
  }, producto.activo ? "Activo" : "Inactivo");
  const media = el("div", { class: "admin-photo" });
  if (producto.imagen) {
    const img = el("img", { src: producto.imagen, alt: "" });
    img.addEventListener("error", () => img.remove());
    media.append(img);
  }
  return el("article", { class: "admin-product" },
    media,
    el("div", {},
      el("h3", {}, producto.nombre),
      el("p", { class: "hint" }, [marcaVisible(producto.marca), producto.presentacion, producto.categoria].filter(Boolean).join(" · "))
    ),
    el("label", {}, "Precio", precio),
    el("label", {}, "Stock", stock),
    el("label", { class: "check" }, rx, el("span", {}, "Requiere fórmula")),
    activo,
    el("button", { type: "button", class: "btn btn-ghost", onclick: () => abrirProducto(producto) }, "Editar")
  );
}

async function cargarProductos() {
  const lista = document.querySelector("[data-productos]");
  if (!lista) return;
  const desde = (paginaProducto - 1) * POR_PAGINA;
  let consulta = supabase.from("productos").select("*", { count: "exact" });
  const q = textoProducto.trim().replace(/[%_,()]/g, " ").slice(0, 60);
  if (q) consulta = consulta.or(`nombre.ilike.%${q}%,marca.ilike.%${q}%,presentacion.ilike.%${q}%`);
  const { data, error, count } = await consulta.order("nombre", { ascending: true }).range(desde, desde + POR_PAGINA - 1);
  if (error) {
    lista.replaceChildren(el("p", { class: "form-error", role: "alert" }, mensajeError(error)));
    return;
  }
  productos = data || [];
  totalProductos = count || 0;
  const paginas = Math.max(1, Math.ceil(totalProductos / POR_PAGINA));
  if (paginaProducto > paginas) {
    paginaProducto = paginas;
    cargarProductos();
    return;
  }
  lista.replaceChildren(...(productos.length ? productos.map(filaProducto) : [el("p", { class: "empty-state" }, "No hay productos con esa búsqueda.")]));
  const label = document.querySelector("[data-prod-page]");
  if (label) label.textContent = `Página ${paginaProducto} de ${paginas}`;
  document.querySelector("[data-prod-prev]").disabled = paginaProducto <= 1;
  document.querySelector("[data-prod-next]").disabled = paginaProducto >= paginas;
}

function leerFormulario() {
  const form = document.querySelector("#producto-form");
  const formula = form.requiere_formula.checked;
  const anterior = form.precio_anterior.value.trim();
  return {
    nombre: form.nombre.value.trim(),
    marca: form.marca.value.trim(),
    presentacion: form.presentacion.value.trim(),
    categoria: form.categoria.value,
    descripcion: form.descripcion.value.trim(),
    precio: Number(form.precio.value),
    precio_anterior: formula || anterior === "" ? null : Number(anterior),
    stock: Math.max(0, Math.trunc(Number(form.stock.value) || 0)),
    requiere_formula: formula,
    activo: form.activo.checked
  };
}

function validarProducto(datos) {
  if (datos.nombre.length < 2) return "Escribe el nombre del producto.";
  if (!datos.presentacion) return "Escribe la presentación.";
  if (!datos.categoria) return "Elige una categoría.";
  if (!Number.isFinite(datos.precio) || datos.precio < 0) return "El precio no es válido.";
  if (datos.precio_anterior != null && (!Number.isFinite(datos.precio_anterior) || datos.precio_anterior < 0)) return "El precio anterior no es válido.";
  return "";
}

async function guardarProducto(evento) {
  evento.preventDefault();
  const aviso = document.querySelector("[data-prod-error]");
  const datos = leerFormulario();
  const errorTexto = validarProducto(datos);
  aviso.hidden = !errorTexto;
  aviso.textContent = errorTexto;
  if (errorTexto) return;
  const archivo = document.querySelector("#producto-form").imagen.files[0];
  let imagen = editando?.imagen || null;
  const url = urlSegura(document.querySelector("#imagen-url").value.trim());
  try {
    if (archivo) imagen = await comprimirImagen(archivo);
    else if (document.querySelector("#imagen-url").value.trim()) {
      if (!url) {
        aviso.hidden = false;
        aviso.textContent = "La imagen debe ser una dirección http o https.";
        return;
      }
      imagen = url;
    } else if (imagenNueva === "") imagen = null;
    const payload = { ...datos, imagen };
    let respuesta;
    if (editando?.id) respuesta = await supabase.from("productos").update(payload).eq("id", editando.id).select("id").maybeSingle();
    else respuesta = await supabase.from("productos").insert(payload).select("id").maybeSingle();
    if (respuesta.error && payload.imagen == null) {
      payload.imagen = "";
      respuesta = editando?.id
        ? await supabase.from("productos").update(payload).eq("id", editando.id).select("id").maybeSingle()
        : await supabase.from("productos").insert(payload).select("id").maybeSingle();
    }
    if (respuesta.error) throw respuesta.error;
    cerrarProducto();
    avisar(editando?.id ? "Producto actualizado." : "Producto creado.");
    editando = null;
    await cargarProductos();
  } catch (error) {
    aviso.hidden = false;
    aviso.textContent = mensajeError(error);
  }
}

function abrirProducto(producto) {
  editando = producto || null;
  imagenNueva = null;
  const form = document.querySelector("#producto-form");
  form.reset();
  document.querySelector("#producto-titulo").textContent = producto ? "Editar producto" : "Nuevo producto";
  if (producto) {
    if (producto.categoria && ![...form.categoria.options].some((opcion) => opcion.value === producto.categoria)) {
      form.categoria.append(el("option", { value: producto.categoria }, producto.categoria));
    }
    form.nombre.value = producto.nombre || "";
    form.marca.value = producto.marca || "";
    form.presentacion.value = producto.presentacion || "";
    form.categoria.value = producto.categoria || categorias[0].id;
    form.descripcion.value = producto.descripcion || "";
    form.precio.value = Number(producto.precio) || 0;
    form.precio_anterior.value = producto.precio_anterior ?? "";
    form.stock.value = Number(producto.stock) || 0;
    form.requiere_formula.checked = esFormula(producto.requiere_formula);
    form.activo.checked = producto.activo !== false;
    if (producto.imagen && String(producto.imagen).startsWith("http")) document.querySelector("#imagen-url").value = producto.imagen;
  } else {
    form.categoria.value = categorias[0].id;
    form.activo.checked = true;
    form.stock.value = 0;
    form.precio.value = 0;
  }
  sincronizarOferta();
  document.querySelector("[data-prod-error]").hidden = true;
  const capa = document.querySelector("[data-overlay='producto']");
  const hoja = document.getElementById("editor-producto");
  capa.hidden = false;
  hoja.hidden = false;
  requestAnimationFrame(() => {
    capa.classList.add("is-open");
    hoja.classList.add("is-open");
  });
  form.nombre.focus();
}

function cerrarProducto() {
  const capa = document.querySelector("[data-overlay='producto']");
  const hoja = document.getElementById("editor-producto");
  capa.classList.remove("is-open");
  hoja.classList.remove("is-open");
  capa.hidden = true;
  hoja.hidden = true;
}

function sincronizarOferta() {
  const form = document.querySelector("#producto-form");
  const bloque = document.querySelector("[data-anterior]");
  const activo = !form.requiere_formula.checked;
  bloque.hidden = !activo;
  if (!activo) form.precio_anterior.value = "";
}

function armarProductos() {
  const panel = document.querySelector("[data-panel='productos']");
  const buscador = el("input", {
    type: "search",
    placeholder: "Busca por nombre, marca o presentación",
    "aria-label": "Buscar productos",
    oninput: (evento) => {
      textoProducto = evento.target.value;
      paginaProducto = 1;
      clearTimeout(armarProductos.timer);
      armarProductos.timer = setTimeout(cargarProductos, 280);
    }
  });
  const archivo = el("input", { type: "file", accept: ".csv,text/csv", hidden: true });
  archivo.addEventListener("change", async () => {
    const file = archivo.files[0];
    archivo.value = "";
    if (!file) return;
    const texto = await file.text();
    abrirCsv(parseCSV(texto).map(prepararFila));
  });
  panel.append(
    el("div", { class: "panel-head" },
      el("h2", {}, "Productos"),
      el("div", { class: "panel-actions" },
        el("button", { type: "button", class: "btn btn-ghost", onclick: () => archivo.click() }, "Importar CSV"),
        el("button", { type: "button", class: "btn btn-ghost", onclick: descargarPlantilla }, "Plantilla"),
        el("button", { type: "button", class: "btn btn-primary", onclick: () => abrirProducto(null) }, "Crear producto")
      )
    ),
    el("div", { class: "toolbar" }, buscador),
    archivo,
    el("div", { class: "product-admin", "data-productos": "true" }),
    el("div", { class: "pager" },
      el("button", { type: "button", class: "btn btn-ghost", "data-prod-prev": "true", onclick: () => { paginaProducto -= 1; cargarProductos(); } }, "Anterior"),
      el("span", { "data-prod-page": "true" }, "Página 1"),
      el("button", { type: "button", class: "btn btn-ghost", "data-prod-next": "true", onclick: () => { paginaProducto += 1; cargarProductos(); } }, "Siguiente")
    )
  );
  const categoriasOpciones = categorias.map((item) => el("option", { value: item.id }, item.nombre));
  const form = el("form", { id: "producto-form", novalidate: true, onsubmit: guardarProducto });
  form.append(
    el("div", { class: "sheet-head" },
      el("h2", { id: "producto-titulo" }, "Nuevo producto"),
      el("button", { type: "button", class: "icon-btn", "aria-label": "Cerrar", onclick: cerrarProducto }, icono("close"))
    ),
    el("div", { class: "sheet-body form-grid" },
      el("p", { class: "form-error", "data-prod-error": "true", role: "alert", hidden: true }),
      campo("Nombre", el("input", { name: "nombre", required: true, maxlength: "140" })),
      campo("Marca", el("input", { name: "marca", maxlength: "80" })),
      campo("Presentación", el("input", { name: "presentacion", required: true, maxlength: "120" })),
      campo("Categoría", el("select", { name: "categoria" }, ...categoriasOpciones)),
      campo("Descripción", el("textarea", { name: "descripcion", rows: "4" })),
      campo("Precio", el("input", { name: "precio", type: "number", min: "0", step: "1", required: true })),
      el("div", { "data-anterior": "true" }, campo("Precio anterior", el("input", { name: "precio_anterior", type: "number", min: "0", step: "1" }))),
      campo("Stock", el("input", { name: "stock", type: "number", min: "0", step: "1", required: true })),
      el("label", { class: "check" }, el("input", { type: "checkbox", name: "requiere_formula", onchange: sincronizarOferta }), el("span", {}, "Requiere fórmula médica")),
      el("p", { class: "hint" }, "Los productos con fórmula no se muestran como oferta."),
      el("label", { class: "check" }, el("input", { type: "checkbox", name: "activo" }), el("span", {}, "Activo en la tienda")),
      campo("Imagen desde un enlace", el("input", { id: "imagen-url", type: "url", placeholder: "https://" })),
      campo("O sube una imagen", el("input", { name: "imagen", type: "file", accept: "image/jpeg,image/png,image/webp" })),
      el("button", { type: "submit", class: "btn btn-primary" }, "Guardar producto")
    )
  );
  const capa = el("div", { class: "overlay", "data-overlay": "producto", hidden: true });
  const hoja = el("section", { class: "sheet", id: "editor-producto", role: "dialog", "aria-modal": "true", "aria-labelledby": "producto-titulo", hidden: true, tabindex: "-1" });
  hoja.append(form);
  capa.addEventListener("click", cerrarProducto);
  document.body.append(capa, hoja);
}

function campo(etiqueta, control) {
  return el("label", {}, etiqueta, control);
}

function descargarPlantilla() {
  const blob = new Blob(["nombre,marca,presentacion,categoria,precio,stock,requiere_formula\n"], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const enlace = el("a", { href: url, download: "productos-reina.csv" });
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

function abrirCsv(filas) {
  let capa = document.getElementById("csv-capa");
  if (!capa) {
    capa = el("div", { class: "overlay", id: "csv-capa" });
    const hoja = el("section", { class: "sheet", id: "csv-hoja", role: "dialog", "aria-modal": "true", "aria-labelledby": "csv-titulo", tabindex: "-1" });
    hoja.append(
      el("div", { class: "sheet-head" },
        el("h2", { id: "csv-titulo" }, "Importar CSV"),
        el("button", { type: "button", class: "icon-btn", "aria-label": "Cerrar", onclick: cerrarCsv }, icono("close"))
      ),
      el("div", { class: "sheet-body", "data-csv": "true" })
    );
    capa.addEventListener("click", (evento) => {
      if (evento.target === capa) cerrarCsv();
    });
    document.body.append(capa, hoja);
  }
  const cuerpo = document.querySelector("[data-csv]");
  const validas = filas.filter((fila) => !fila.errores.length);
  cuerpo.replaceChildren(
    el("p", {}, `${filas.length} filas. ${validas.length} listas para importar. Se crea o actualiza por nombre y presentación.`),
    el("div", { class: "csv-table" },
      el("table", {},
        el("thead", {}, el("tr", {}, ...["Línea", "Nombre", "Presentación", "Precio", "Stock", "Estado"].map((titulo) => el("th", {}, titulo)))),
        el("tbody", {}, ...filas.map((fila) => el("tr", { class: fila.errores.length ? "is-bad" : "" },
          el("td", {}, String(fila.linea)),
          el("td", {}, fila.nombre || "—"),
          el("td", {}, fila.presentacion || "—"),
          el("td", {}, Number.isFinite(fila.precio) ? dinero(fila.precio) : "—"),
          el("td", {}, Number.isFinite(fila.stock) ? String(fila.stock) : "—"),
          el("td", {}, fila.errores.length ? fila.errores.join(", ") : fila.requiere_formula ? "Con fórmula" : "Listo")
        )))
      )
    ),
    el("button", {
      type: "button",
      class: "btn btn-primary",
      disabled: !validas.length,
      onclick: () => importarFilas(validas)
    }, `Importar ${validas.length} productos`)
  );
  capa.hidden = false;
  const hoja = document.getElementById("csv-hoja");
  hoja.hidden = false;
  requestAnimationFrame(() => {
    capa.classList.add("is-open");
    hoja.classList.add("is-open");
  });
}

function cerrarCsv() {
  const capa = document.getElementById("csv-capa");
  const hoja = document.getElementById("csv-hoja");
  if (!capa || !hoja) return;
  capa.classList.remove("is-open");
  hoja.classList.remove("is-open");
  capa.hidden = true;
  hoja.hidden = true;
}

async function importarFilas(filas) {
  const boton = document.querySelector("#csv-hoja .btn-primary");
  boton.disabled = true;
  boton.textContent = "Importando…";
  try {
    const existentes = [];
    let desde = 0;
    while (true) {
      const { data, error } = await supabase.from("productos").select("id,nombre,presentacion").range(desde, desde + 499);
      if (error) throw error;
      existentes.push(...(data || []));
      if (!data || data.length < 500) break;
      desde += 500;
    }
    const indice = new Map(existentes.map((item) => [`${item.nombre}`.trim().toLowerCase() + "||" + `${item.presentacion}`.trim().toLowerCase(), item.id]));
    for (const fila of filas) {
      const clave = `${fila.nombre}`.trim().toLowerCase() + "||" + `${fila.presentacion}`.trim().toLowerCase();
      const payload = {
        nombre: fila.nombre,
        marca: fila.marca,
        presentacion: fila.presentacion,
        categoria: fila.categoria,
        precio: fila.precio,
        stock: fila.stock,
        requiere_formula: fila.requiere_formula
      };
      if (fila.requiere_formula) payload.precio_anterior = null;
      if (indice.has(clave)) {
        const { error } = await supabase.from("productos").update(payload).eq("id", indice.get(clave));
        if (error) throw error;
      } else {
        payload.activo = true;
        payload.descripcion = "";
        const { data, error } = await supabase.from("productos").insert(payload).select("id").maybeSingle();
        if (error) throw error;
        if (data?.id) indice.set(clave, data.id);
      }
    }
    cerrarCsv();
    avisar("Importación lista.");
    paginaProducto = 1;
    await cargarProductos();
  } catch (error) {
    avisar(mensajeError(error));
    boton.disabled = false;
    boton.textContent = "Reintentar importación";
  }
}

async function cargarAjustes() {
  const form = document.querySelector("#ajustes-form");
  const { data, error } = await supabase.from("config").select("id,domicilio,pedido_minimo,abierto").limit(1).maybeSingle();
  const aviso = document.querySelector("[data-ajuste-error]");
  if (error || !data) {
    aviso.hidden = false;
    aviso.textContent = error ? mensajeError(error) : "No encontramos la configuración.";
    return;
  }
  form.dataset.id = data.id;
  form.domicilio.value = Number(data.domicilio) || 0;
  form.pedido_minimo.value = Number(data.pedido_minimo) || 0;
  form.abierto.checked = data.abierto !== false;
  aviso.hidden = true;
}

function armarAjustes() {
  const panel = document.querySelector("[data-panel='ajustes']");
  const form = el("form", { id: "ajustes-form", class: "settings", novalidate: true });
  form.append(
    el("h2", {}, "Ajustes de la tienda"),
    el("p", { class: "form-error", "data-ajuste-error": "true", role: "alert", hidden: true }),
    el("p", { class: "hint", "data-ajuste-ok": "true", hidden: true }, "Ajustes guardados."),
    campo("Costo de domicilio", el("input", { name: "domicilio", type: "number", min: "0", step: "100", required: true })),
    campo("Pedido mínimo", el("input", { name: "pedido_minimo", type: "number", min: "0", step: "100", required: true })),
    el("label", { class: "switch" }, el("input", { type: "checkbox", name: "abierto" }), el("span", {}, "Recibiendo pedidos")),
    el("p", { class: "hint" }, "Si lo apagas, la tienda muestra el aviso y no deja confirmar pedidos."),
    el("button", { type: "submit", class: "btn btn-primary" }, "Guardar ajustes")
  );
  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const aviso = document.querySelector("[data-ajuste-error]");
    const ok = document.querySelector("[data-ajuste-ok]");
    ok.hidden = true;
    const domicilio = Number(form.domicilio.value);
    const minimo = Number(form.pedido_minimo.value);
    if (!Number.isFinite(domicilio) || domicilio < 0 || !Number.isFinite(minimo) || minimo < 0) {
      aviso.hidden = false;
      aviso.textContent = "Revisa el domicilio y el pedido mínimo.";
      return;
    }
    const { error } = await supabase.from("config").update({
      domicilio,
      pedido_minimo: minimo,
      abierto: form.abierto.checked
    }).eq("id", form.dataset.id || 1);
    if (error) {
      aviso.hidden = false;
      aviso.textContent = mensajeError(error);
      return;
    }
    aviso.hidden = true;
    ok.hidden = false;
  });
  panel.append(form);
}

function programar() {
  clearInterval(poll);
  poll = setInterval(() => {
    if (document.visibilityState !== "visible") return;
    if (!document.querySelector("[data-panel='pedidos']")?.hidden) cargarPedidos(true);
  }, 30000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !document.querySelector("[data-panel='pedidos']")?.hidden) cargarPedidos(true);
  });
}

async function iniciar() {
  const sesion = await sesionAdmin();
  const espera = document.querySelector("[data-wait]");
  if (!sesion.ok) {
    location.href = "admin-login.html";
    return;
  }
  usuario = sesion.user;
  espera.hidden = true;
  document.querySelector("[data-app]").hidden = false;
  const marca = document.querySelector("[data-logo]");
  if (marca && !marca.querySelector(".logo-mark")) marca.prepend(marcaLogo());
  document.querySelector("[data-admin-email]").textContent = usuario.email || "";
  document.querySelector("[data-salir]").addEventListener("click", async () => {
    await supabase.auth.signOut();
    location.href = "admin-login.html";
  });
  armarPedidos();
  armarProductos();
  armarAjustes();
  armarTabs();
  programar();
}

iniciar();
