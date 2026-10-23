import { supabase } from "./admin-cliente.js";
import { cerrarSesionLocal, codigoAcceso, destinoAcceso, estadoAcceso, ir } from "./acceso.js";
import { categorias, negocio } from "./config.js";
import { el } from "./dom.js";
import { icono } from "./icons.js";
import { dinero, esFormula, fechaHora, marcaVisible, mensajeError, parseNumero, soloDigitos } from "./format.js";
import { etiquetaEstado, interpretarPedido, prioridadEstado } from "./pedidos.js";
import { enlaceAvisarCliente, enlaceWhatsapp, separarPago } from "./pago.js";
import { graficoDia, graficoDona, graficoHorizonte, graficoHoras } from "./admin-graficos.js";
import {
  MOTIVOS_FORMULA,
  MOTIVOS_PEDIDO,
  REVISION,
  dentroDe,
  diaBogota,
  esActivo,
  etiquetaForma,
  fechaLarga,
  filaAuditable,
  formaClave,
  leerClientes,
  leerResumen,
  minutosDesde,
  nivelEspera,
  porDespachar,
  rangos,
  saludo,
  textoEspera,
  textoResumen,
  variacion,
  venceRevision
} from "./admin-datos.js";

const NS = "http://www.w3.org/2000/svg";
const POR_PAGINA = 30;
const INACTIVIDAD = 15 * 60 * 1000;
const SECCIONES = [
  ["inicio", "Inicio", "home"],
  ["pedidos", "Pedidos", "bag"],
  ["formulas", "Fórmulas", "pill"],
  ["productos", "Productos", "box"],
  ["ajustes", "Ajustes", "kit"],
  ["auditoria", "Auditoría", "shield"]
];
const EXTRA = {
  phone: ["M7 4h3.1l1 2.5-1.8 1a12 12 0 0 0 5.2 5.2l1-1.8L18 12v3.1a1.6 1.6 0 0 1-1.8 1.6A13.2 13.2 0 0 1 5.3 5.8 1.6 1.6 0 0 1 7 4z"],
  copy: ["M9 9h10v11H9z", "M5 15V4h10v3"],
  printer: ["M7 8V4h10v4", "M6 16H4V10h16v6h-2", "M7 14h10v6H7z"],
  moon: ["M16 3.5A8 8 0 1 0 20.5 14 6.2 6.2 0 0 1 16 3.5z"],
  sun: ["M12 16.2A4.2 4.2 0 1 0 7.8 12 4.2 4.2 0 0 0 12 16.2z", "M12 3v2", "M12 19v2", "M4.8 4.8l1.4 1.4", "M17.8 17.8l1.4 1.4", "M3 12h2", "M19 12h2", "M4.8 19.2l1.4-1.4", "M17.8 6.2l1.4-1.4"],
  bell: ["M6.2 16.5h11.6l-1.2-2V10a4.6 4.6 0 0 0-9.2 0v4.5z", "M10 16.5a2 2 0 0 0 4 0"],
  up: ["M12 19V6", "M6.5 11 12 5.5 17.5 11"],
  down: ["M12 5v13", "M6.5 13 12 18.5 17.5 13"],
  alert: ["M12 4.2 21 19.5H3z", "M12 10v4", "M12 16.8h.01"],
  speaker: ["M4 10h3l4-3v10l-4-3H4z", "M16 9.2a4.2 4.2 0 0 1 0 5.6"],
  sliders: ["M4 8h16", "M4 16h16", "M8 8a1.6 1.6 0 1 0 1.6-1.6A1.6 1.6 0 0 0 8 8z", "M14 16a1.6 1.6 0 1 0 1.6-1.6A1.6 1.6 0 0 0 14 16z"],
  eye: ["M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z", "M12 14.5a2.5 2.5 0 1 0-2.5-2.5 2.5 2.5 0 0 0 2.5 2.5z"],
  rotate: ["M20 12a8 8 0 1 1-2.3-5.6", "M20 4.5V9h-4.5"],
  zoom: ["M11 18a7 7 0 1 0-7-7 7 7 0 0 0 7 7z", "M20 20l-3.5-3.5", "M11 8.5v5", "M8.5 11h5"]
};
const ILUSTRACIONES = [
  "assets/productos/caja-tabletas-verde.svg", "assets/productos/caja-tabletas-azul.svg", "assets/productos/caja-tabletas-turquesa.svg",
  "assets/productos/frasco-jarabe-verde.svg", "assets/productos/frasco-jarabe-azul.svg", "assets/productos/frasco-jarabe-turquesa.svg",
  "assets/productos/frasco-pastillas-verde.svg", "assets/productos/frasco-pastillas-azul.svg", "assets/productos/frasco-pastillas-turquesa.svg",
  "assets/productos/gotero-verde.svg", "assets/productos/gotero-azul.svg", "assets/productos/gotero-turquesa.svg",
  "assets/productos/sobre-suero-verde.svg", "assets/productos/sobre-suero-azul.svg", "assets/productos/sobre-suero-turquesa.svg",
  "assets/productos/tubo-crema-verde.svg", "assets/productos/tubo-crema-azul.svg", "assets/productos/tubo-crema-turquesa.svg",
  "assets/productos/botella-locion-verde.svg", "assets/productos/botella-locion-azul.svg", "assets/productos/botella-locion-turquesa.svg",
  "assets/productos/botiquin-verde.svg", "assets/productos/botiquin-azul.svg", "assets/productos/botiquin-turquesa.svg",
  "assets/productos/curas-verde.svg", "assets/productos/curas-azul.svg", "assets/productos/curas-turquesa.svg",
  "assets/productos/dispensador-verde.svg", "assets/productos/dispensador-azul.svg", "assets/productos/dispensador-turquesa.svg",
  "assets/productos/panales-verde.svg", "assets/productos/panales-azul.svg", "assets/productos/panales-turquesa.svg",
  "assets/productos/tensiometro-verde.svg", "assets/productos/tensiometro-azul.svg", "assets/productos/tensiometro-turquesa.svg",
  "assets/productos/termometro-verde.svg", "assets/productos/termometro-azul.svg", "assets/productos/termometro-turquesa.svg",
  "assets/productos/medicamentos.svg", "assets/productos/cuidado.svg", "assets/productos/bebe.svg", "assets/productos/belleza.svg",
  "assets/productos/vitaminas.svg", "assets/productos/botiquin.svg", "assets/productos/adulto.svg", "assets/productos/hogar.svg"
];
const AUD = {
  created_at: "Fecha", fecha: "Fecha", accion: "Acción", action: "Acción", evento: "Evento",
  tabla: "Tabla", entidad: "Elemento", estado: "Estado", resultado: "Resultado", modulo: "Módulo"
};

function pref(clave, defecto) {
  try {
    const valor = localStorage.getItem(`reina_admin_${clave}`);
    return valor == null ? defecto : valor;
  } catch {
    return defecto;
  }
}
function guardarPref(clave, valor) {
  try { localStorage.setItem(`reina_admin_${clave}`, valor); } catch { return; }
}

document.documentElement.dataset.tema = pref("tema", "claro") === "oscuro" ? "oscuro" : "claro";
document.documentElement.dataset.densidad = pref("densidad", "comoda") === "compacta" ? "compacta" : "comoda";
document.documentElement.dataset.papel = pref("papel", "80") === "58" ? "58" : "80";

let usuario = null;
let seccion = "inicio";
let pedidos = [];
let vistos = null;
let pagadosVistos = null;
let sinVer = 0;
let frescos = new Map();
let timerFresco = 0;
let domiciliarios = [];
let stockBajo = [];
let configFila = null;
let resumenActual = null;
let resumenPrevio = null;
let clientesTotal = null;
let periodo = "hoy";
let textoPedido = "";
let filtroFecha = "todos";
let filtroPago = "todos";
let filtroBarrio = "todos";
let conFormula = false;
let columna = "revision";
let verCerrados = false;
let pedidoAbierto = null;
let formulaId = null;
let marcas = {};
let notaFormula = "";
let zoom = 1;
let giro = 0;
let timerUrl = 0;
let productos = [];
let textoProducto = "";
let paginaProducto = 1;
let totalProductos = 0;
let editando = null;
const timerCampo = new Map();
let poll = 0;
let inactividad = 0;
let cursorNuevo = 0;
let acorde = "";
let timerAcorde = 0;
let armado = false;

function ico(nombre) {
  if (!EXTRA[nombre]) return icono(nombre);
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  EXTRA[nombre].forEach((d) => {
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  });
  return svg;
}

function reducido() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function avisar(texto) {
  const pila = document.querySelector("[data-toasts]");
  if (!pila) return;
  const toast = el("div", { class: "toast", role: "status" }, texto);
  pila.append(toast);
  requestAnimationFrame(() => toast.classList.add("is-on"));
  setTimeout(() => {
    toast.classList.remove("is-on");
    setTimeout(() => toast.remove(), reducido() ? 0 : 220);
  }, 2800);
}

function btn(texto, clase, nombre, props = {}) {
  return el("button", { type: "button", class: `btn ${clase}`, ...props }, nombre ? ico(nombre) : null, el("span", {}, texto));
}

function ocupado(boton, activo) {
  if (!boton) return;
  boton.classList.toggle("is-busy", !!activo);
  if (activo) boton.setAttribute("aria-busy", "true");
  else boton.removeAttribute("aria-busy");
}

function vacio(titulo, texto) {
  return el("div", { class: "vacio" }, ico("box"), el("h3", {}, titulo), texto ? el("p", { class: "muted" }, texto) : null);
}

function esqueleto(tipo = "") {
  return el("div", { class: tipo ? `esqueleto ${tipo}` : "esqueleto", "aria-hidden": "true" });
}

function conIcono(boton, nombre) {
  if (!boton) return;
  boton.querySelector(":scope > svg")?.remove();
  const iconoNodo = ico(nombre);
  const texto = boton.querySelector(":scope > .util-texto");
  if (texto) boton.insertBefore(iconoNodo, texto);
  else boton.prepend(iconoNodo);
}

function hojaDe(id, ancha = false) {
  let hoja = document.getElementById(id);
  if (hoja) return hoja;
  const velo = el("div", { class: "velo", hidden: true });
  hoja = el("section", {
    class: ancha ? "hoja hoja-ancha" : "hoja",
    id,
    role: "dialog",
    "aria-modal": "true",
    hidden: true,
    tabindex: "-1"
  });
  velo.addEventListener("click", () => cerrarHoja(hoja));
  document.body.append(velo, hoja);
  return hoja;
}

function abrirHoja(hoja) {
  const velo = hoja.previousElementSibling;
  if (velo?.classList.contains("velo")) {
    velo.hidden = false;
    requestAnimationFrame(() => velo.classList.add("is-on"));
  }
  hoja.hidden = false;
  requestAnimationFrame(() => hoja.classList.add("is-on"));
  (hoja.querySelector("[data-foco], button, input, select, textarea"))?.focus();
}

function cerrarHoja(hoja) {
  if (!hoja) return;
  hoja.classList.remove("is-on");
  const velo = hoja.previousElementSibling;
  if (velo?.classList.contains("velo")) velo.classList.remove("is-on");
  setTimeout(() => {
    hoja.hidden = true;
    if (velo?.classList.contains("velo")) velo.hidden = true;
  }, reducido() ? 0 : 240);
}

function pedirMotivo(titulo, motivos, onOk) {
  const hoja = hojaDe("hoja-motivo");
  hoja.setAttribute("aria-labelledby", "motivo-titulo");
  const area = el("textarea", { rows: "3", maxlength: "240", "aria-label": "Motivo" });
  const aceptar = btn("Confirmar", "btn-peligro btn-lg", "check", { disabled: true });
  const chips = el("div", { class: "chips", role: "group", "aria-label": "Motivos rápidos" });
  let clave = "";
  motivos.forEach(([valor, etiqueta]) => {
    const chip = el("button", {
      type: "button",
      "aria-pressed": "false",
      onclick: () => {
        clave = valor;
        chips.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", item === chip ? "true" : "false"));
        area.value = valor === "otro" ? "" : valor;
        aceptar.disabled = area.value.trim().length < 3;
        area.focus();
      }
    }, etiqueta);
    chips.append(chip);
  });
  area.addEventListener("input", () => {
    const texto = area.value.trim();
    aceptar.disabled = clave === "otro" ? texto.length < 3 : texto.length < 3;
  });
  aceptar.addEventListener("click", async () => {
    const texto = area.value.trim();
    if (texto.length < 3) return;
    ocupado(aceptar, true);
    try {
      await onOk(clave === "otro" ? texto : clave);
      cerrarHoja(hoja);
    } catch (error) {
      avisar(mensajeError(error));
      ocupado(aceptar, false);
    }
  });
  hoja.replaceChildren(
    el("div", { class: "asa", "aria-hidden": "true" }),
    el("div", { class: "hoja-cabeza" }, el("h2", { id: "motivo-titulo" }, titulo), btn("", "btn-neutro", "close", { "aria-label": "Cerrar", onclick: () => cerrarHoja(hoja) })),
    el("div", { class: "hoja-cuerpo" }, el("p", {}, "Elige un motivo para continuar."), chips, el("label", { class: "campo" }, "Motivo", area)),
    el("div", { class: "pie-accion" }, btn("Volver", "btn-neutro btn-lg", "close", { onclick: () => cerrarHoja(hoja) }), aceptar)
  );
  abrirHoja(hoja);
}

function pedirConfirmacion(titulo, texto, onOk) {
  const hoja = hojaDe("hoja-confirma");
  hoja.setAttribute("aria-labelledby", "confirma-titulo");
  const aceptar = btn("Confirmar", "btn-peligro btn-lg", "trash", {
    "data-foco": "true",
    onclick: async (evento) => {
      ocupado(evento.currentTarget, true);
      try {
        await onOk();
        cerrarHoja(hoja);
      } catch (error) {
        avisar(mensajeError(error));
        ocupado(evento.currentTarget, false);
      }
    }
  });
  hoja.replaceChildren(
    el("div", { class: "asa", "aria-hidden": "true" }),
    el("div", { class: "hoja-cabeza" }, el("h2", { id: "confirma-titulo" }, titulo)),
    el("div", { class: "hoja-cuerpo" }, el("p", {}, texto)),
    el("div", { class: "pie-accion" }, btn("Volver", "btn-neutro btn-lg", "close", { onclick: () => cerrarHoja(hoja) }), aceptar)
  );
  abrirHoja(hoja);
}

function sincronizarTitulo() {
  document.title = sinVer > 0 ? `(${sinVer}) Panel | Droguerías Reina` : "Panel | Droguerías Reina";
}

function tono() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gan = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gan.gain.value = 0.04;
    osc.connect(gan);
    gan.connect(ctx.destination);
    const empezar = () => {
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
      osc.onended = () => ctx.close();
    };
    if (ctx.state === "suspended") ctx.resume().then(empezar).catch(() => ctx.close());
    else empezar();
  } catch {
    return;
  }
}

function programarFresco() {
  clearTimeout(timerFresco);
  const restos = [...frescos.values()].map((hasta) => hasta - Date.now()).filter((resta) => resta > 0);
  if (!restos.length) return;
  timerFresco = setTimeout(() => {
    if (seccion === "pedidos") pintarPedidos();
    programarFresco();
  }, Math.min(...restos) + 40);
}

function pedidoDe(row) {
  const base = interpretarPedido(row);
  if (!base) return null;
  const pago = separarPago(base.indicaciones);
  const crudos = Array.isArray(row.pedido_items) ? row.pedido_items : (Array.isArray(row.items) ? row.items : []);
  base.items = base.items.map((item, indice) => {
    const crudo = crudos[indice] || {};
    return {
      ...item,
      requiere_formula: esFormula(crudo.requiere_formula),
      imagen: typeof crudo.imagen === "string" ? crudo.imagen : ""
    };
  });
  base.forma_pago = String(row.forma_pago || pago.forma || "");
  base.notas = pago.notas;
  base.cobrado = row.cobrado === true;
  base.cobrado_en = row.cobrado_en || null;
  base.nota_interna = row.nota_interna || "";
  base.motivo = row.motivo || "";
  base.domiciliario = row.domiciliario || "";
  base.aprobado_en = row.aprobado_en || null;
  base.despachado_en = row.despachado_en || null;
  base.entregado_en = row.entregado_en || null;
  return base;
}

async function leerPedidos() {
  let respuesta = await supabase.from("pedidos").select("*, pedido_items(*)").order("created_at", { ascending: false }).limit(200);
  if (respuesta.error) respuesta = await supabase.from("pedidos").select("*").order("created_at", { ascending: false }).limit(200);
  if (respuesta.error) respuesta = await supabase.from("pedidos").select("*").limit(200);
  if (respuesta.error) throw respuesta.error;
  const filas = respuesta.data || [];
  let lista = filas.map(pedidoDe).filter(Boolean);
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
      const porId = new Map(filas.map((fila) => [String(fila.id), fila]));
      lista = lista.map((pedido) => {
        const grupo = grupos.get(String(pedido.id));
        if (!grupo || pedido.items.length) return pedido;
        return pedidoDe({ ...(porId.get(String(pedido.id)) || pedido), pedido_items: grupo }) || pedido;
      });
    }
  }
  lista.sort((a, b) => {
    if (negocio.pagoEnLinea) {
      const pesoPago = (a.estado === "pagado" ? 0 : 1) - (b.estado === "pagado" ? 0 : 1);
      if (pesoPago) return pesoPago;
    }
    const peso = prioridadEstado(a.estado) - prioridadEstado(b.estado);
    if (peso) return peso;
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });
  return lista;
}

function anunciar(lista) {
  const ids = new Set(lista.map((pedido) => pedido.id).filter(Boolean));
  if (vistos) {
    const nuevos = lista.filter((pedido) => pedido.id && !vistos.has(pedido.id));
    if (nuevos.length) {
      nuevos.forEach((pedido) => frescos.set(pedido.id, Date.now() + 5000));
      programarFresco();
      sinVer += nuevos.length;
      sincronizarTitulo();
      avisar(nuevos.length > 1 ? `Llegaron ${nuevos.length} pedidos nuevos.` : "Llegó un pedido nuevo.");
      if (pref("sonido", "1") === "1") {
        tono();
        if (navigator.vibrate) navigator.vibrate([180, 80, 180]);
      }
      if (typeof Notification === "function" && Notification.permission === "granted") {
        try {
          new Notification("Pedido nuevo", { body: "Hay un pedido nuevo en el panel.", tag: "reina-pedido" });
        } catch {
          sinVer += 0;
        }
      }
    }
  }
  vistos = ids;
  if (negocio.pagoEnLinea) {
    const pagados = new Set(lista.filter((pedido) => pedido.estado === "pagado" && pedido.id).map((pedido) => pedido.id));
    if (pagadosVistos && [...pagados].some((id) => !pagadosVistos.has(id)) && pref("sonido", "1") === "1") {
      tono();
      if (navigator.vibrate) navigator.vibrate(120);
    }
    pagadosVistos = pagados;
  }
}

function busqueda(pedido, q) {
  if (!q) return true;
  const bolsa = `${pedido.numero || ""} ${pedido.nombre || ""} ${pedido.telefono || ""}`.toLowerCase();
  if (bolsa.includes(q)) return true;
  const digitos = q.replace(/\D/g, "");
  return digitos.length >= 3 && String(pedido.telefono || "").replace(/\D/g, "").includes(digitos);
}

function filtrados() {
  const q = textoPedido.trim().toLowerCase();
  const ahora = Date.now();
  return pedidos.filter((pedido) => {
    if (verCerrados && pedido.estado !== "rechazado" && pedido.estado !== "cancelado") return false;
    if (!verCerrados && (pedido.estado === "rechazado" || pedido.estado === "cancelado")) return false;
    if (filtroPago !== "todos" && formaClave(pedido.forma_pago) !== filtroPago) return false;
    if (filtroBarrio !== "todos" && (pedido.barrio || "") !== filtroBarrio) return false;
    if (conFormula && !pedido.formula_path && !pedido.items.some((item) => item.requiere_formula)) return false;
    if (filtroFecha === "hoy" && diaBogota(pedido.created_at) !== diaBogota(ahora)) return false;
    if (filtroFecha === "7" && !dentroDe(pedido.created_at, ahora - 7 * 86400000, ahora)) return false;
    if (filtroFecha === "30" && !dentroDe(pedido.created_at, ahora - 30 * 86400000, ahora)) return false;
    return busqueda(pedido, q);
  });
}

function partir(lista) {
  return {
    revision: lista.filter((pedido) => pedido.estado === "revision"),
    despacho: lista.filter((pedido) => porDespachar(pedido.estado, negocio.pagoEnLinea) || (negocio.pagoEnLinea && pedido.estado === "pendiente_pago")),
    camino: lista.filter((pedido) => pedido.estado === "despachado"),
    entregado: lista.filter((pedido) => pedido.estado === "entregado")
  };
}

function ordenarColumna(lista, reciente) {
  return [...lista].sort((a, b) => {
    const delta = new Date(a.created_at || 0) - new Date(b.created_at || 0);
    return reciente ? -delta : delta;
  });
}

async function guardarPedido(id, patch) {
  const { error } = await supabase.from("pedidos").update(patch).eq("id", id);
  if (error) throw error;
}

async function completarItems(pedido) {
  const ids = [...new Set(pedido.items.map((item) => item.id).filter(Boolean))];
  if (!ids.length) return;
  const { data, error } = await supabase.from("productos").select("id,imagen,requiere_formula").in("id", ids);
  if (error || !data) return;
  const mapa = new Map(data.map((item) => [String(item.id), item]));
  pedido.items.forEach((item) => {
    const producto = mapa.get(String(item.id));
    if (!producto) return;
    if (!item.imagen && producto.imagen) item.imagen = producto.imagen;
    if (esFormula(producto.requiere_formula)) item.requiere_formula = true;
  });
}

function insigniaEstado(estado) {
  return el("span", { class: "insignia", "data-estado": estado || "otro" }, etiquetaEstado(estado));
}

function insigniaPago(pedido) {
  const clave = formaClave(pedido.forma_pago);
  if (!clave) return null;
  const texto = clave === "otra" ? pedido.forma_pago : etiquetaForma(clave);
  return el("span", { class: "insignia", "data-forma": clave }, texto);
}

function resumenProductos(pedido) {
  if (!pedido.items.length) return "Sin detalle de productos";
  return pedido.items.map((item) => `${item.nombre} × ${item.cantidad || 0}`).join(", ");
}

function accionPrincipal(pedido) {
  if (pedido.estado === "revision") return btn("Revisar fórmula", "btn-principal btn-lg btn-bloque", "pill", { onclick: () => irFormula(pedido.id) });
  if (porDespachar(pedido.estado, negocio.pagoEnLinea)) return btn("Despachar", "btn-exito btn-lg btn-bloque", "truck", { onclick: () => alDespachar(pedido) });
  if (pedido.estado === "despachado") return btn("Marcar entregado", "btn-exito btn-lg btn-bloque", "check", { onclick: () => alEntregar(pedido) });
  if (pedido.estado === "entregado" && !pedido.cobrado && ["efectivo", "transferencia"].includes(formaClave(pedido.forma_pago))) {
    return btn("Marcar cobrado", "btn-principal btn-lg btn-bloque", "check", { onclick: () => alCobrar(pedido) });
  }
  return null;
}

function tarjetaPedido(pedido) {
  const minutos = minutosDesde(pedido.created_at);
  const espera = esActivo(pedido.estado) ? el("span", { class: `espera espera-${nivelEspera(minutos)}` }, textoEspera(minutos)) : null;
  const principal = accionPrincipal(pedido);
  const clase = frescos.get(pedido.id) > Date.now() ? "pedido is-nuevo" : "pedido";
  return el("article", { class: clase, "data-id": pedido.id },
    el("button", { type: "button", class: "fila-link", onclick: () => abrirPedido(pedido.id) },
      el("strong", {}, pedido.numero ? `N.º ${pedido.numero}` : "Pedido"),
      espera,
      insigniaEstado(pedido.estado)
    ),
    el("p", {}, pedido.nombre || "Cliente sin nombre"),
    el("p", { class: "muted" }, [pedido.barrio, pedido.total == null ? "Total por confirmar" : dinero(pedido.total)].filter(Boolean).join(" · ")),
    el("div", { class: "linea" }, insigniaPago(pedido), pedido.avisado ? el("span", { class: "muted" }, "Avisado") : el("span", { class: "muted" }, "Falta avisar")),
    el("p", { class: "resumen-prod" }, resumenProductos(pedido)),
    principal,
    el("div", { class: "acciones-inline" },
      btn("Avisar por WhatsApp", "btn-neutro", "chat", { onclick: () => avisarCliente(pedido) }),
      pedido.estado === "revision" ? btn("Rechazar", "btn-peligro", "close", { onclick: () => rechazarPedido(pedido) }) : null,
      !["entregado", "cancelado", "rechazado"].includes(pedido.estado) ? btn("Cancelar", "btn-peligro", "close", { onclick: () => cancelarPedido(pedido) }) : null
    )
  );
}

function pintarBarrios() {
  const select = document.querySelector("[data-filtro-barrio]");
  if (!select) return;
  const barrios = [...new Set(pedidos.map((pedido) => pedido.barrio).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  select.replaceChildren(el("option", { value: "todos" }, "Todos los barrios"), ...barrios.map((barrio) => el("option", { value: barrio }, barrio)));
  if (filtroBarrio !== "todos" && !barrios.includes(filtroBarrio)) filtroBarrio = "todos";
  select.value = filtroBarrio;
}

function pintarPedidos() {
  const tablero = document.querySelector("[data-tablero]");
  const cerrados = document.querySelector("[data-cerrados]");
  if (!tablero || !cerrados) return;
  const lista = filtrados();
  tablero.hidden = verCerrados;
  cerrados.hidden = !verCerrados;
  const chips = document.querySelector(".seg-movil");
  if (chips) chips.hidden = verCerrados;
  tablero.dataset.col = columna;
  if (verCerrados) {
    cerrados.replaceChildren(...(lista.length ? ordenarColumna(lista, true).map(tarjetaPedido) : [vacio("Sin rechazados ni cancelados", "Prueba otro filtro.")]));
    return;
  }
  const grupos = partir(lista);
  const columnas = [
    ["revision", "En revisión", grupos.revision, false],
    ["despacho", "Por despachar", grupos.despacho, false],
    ["camino", "En camino", grupos.camino, false],
    ["entregado", "Entregados", grupos.entregado, true]
  ];
  tablero.replaceChildren(...columnas.map(([clave, titulo, items, reciente]) => el("section", { class: "columna", "data-columna": clave },
    el("h2", {}, titulo, el("span", { class: "contador" }, String(items.length))),
    ...(items.length ? ordenarColumna(items, reciente).map(tarjetaPedido) : [el("p", { class: "muted" }, "Sin pedidos")])
  )));
  document.querySelectorAll("[data-chip]").forEach((chip) => {
    const n = grupos[chip.dataset.chip]?.length || 0;
    const base = chip.dataset.etiqueta;
    chip.textContent = n ? `${base} ${n}` : base;
  });
}

function armarPedidos() {
  const panel = document.querySelector("[data-panel='pedidos']");
  const fecha = el("div", { class: "seg", role: "group", "aria-label": "Filtrar por fecha" });
  [["todos", "Todas"], ["hoy", "Hoy"], ["7", "7 días"], ["30", "30 días"]].forEach(([valor, etiqueta]) => {
    fecha.append(el("button", {
      type: "button",
      "aria-pressed": valor === filtroFecha ? "true" : "false",
      onclick: () => {
        filtroFecha = valor;
        fecha.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", item.dataset.valor === valor ? "true" : "false"));
        pintarPedidos();
      }
    }, etiqueta));
    fecha.lastElementChild.dataset.valor = valor;
  });
  const pago = el("div", { class: "seg", role: "group", "aria-label": "Forma de pago" });
  [["todos", "Pago"], ["efectivo", "Efectivo"], ["datafono", "Datáfono"], ["transferencia", "Transferencia"]].forEach(([valor, etiqueta]) => {
    pago.append(el("button", {
      type: "button",
      "aria-pressed": valor === filtroPago ? "true" : "false",
      onclick: () => {
        filtroPago = valor;
        pago.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", item.dataset.valor === valor ? "true" : "false"));
        pintarPedidos();
      }
    }, etiqueta));
    pago.lastElementChild.dataset.valor = valor;
  });
  const barrio = el("select", {
    "data-filtro-barrio": "true",
    "aria-label": "Filtrar por barrio",
    onchange: (evento) => {
      filtroBarrio = evento.target.value;
      pintarPedidos();
    }
  });
  const formula = el("button", {
    type: "button",
    class: "btn btn-neutro",
    "aria-pressed": "false",
    onclick: (evento) => {
      conFormula = !conFormula;
      evento.currentTarget.setAttribute("aria-pressed", conFormula ? "true" : "false");
      pintarPedidos();
    }
  }, "Con fórmula");
  const curso = el("div", { class: "seg", role: "group", "aria-label": "Pedidos cerrados" });
  [["curso", "En curso"], ["cerrados", "Rechazados o cancelados"]].forEach(([valor, etiqueta]) => {
    curso.append(el("button", {
      type: "button",
      "aria-pressed": valor === "curso" ? "true" : "false",
      onclick: () => {
        verCerrados = valor === "cerrados";
        curso.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", item.dataset.valor === valor ? "true" : "false"));
        pintarPedidos();
      }
    }, etiqueta));
    curso.lastElementChild.dataset.valor = valor;
  });
  const chips = el("div", { class: "seg seg-movil", role: "group", "aria-label": "Estado" });
  [["revision", "En revisión"], ["despacho", "Por despachar"], ["camino", "En camino"], ["entregado", "Entregados"]].forEach(([valor, etiqueta]) => {
    const chip = el("button", {
      type: "button",
      "data-chip": valor,
      "data-etiqueta": etiqueta,
      "aria-pressed": valor === columna ? "true" : "false",
      onclick: () => {
        columna = valor;
        chips.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", item.dataset.chip === valor ? "true" : "false"));
        const tablero = document.querySelector("[data-tablero]");
        if (tablero) tablero.dataset.col = valor;
      }
    }, etiqueta);
    chips.append(chip);
  });
  panel.append(
    el("div", { class: "panel-head" },
      el("div", {}, el("h1", { id: "titulo-pedidos" }, "Pedidos"), el("p", { class: "muted" }, "Se actualiza solo cada 30 segundos.")),
      btn("Actualizar", "btn-neutro", "rotate", { onclick: () => refrescar(pedidoAbierto) })
    ),
    el("div", { class: "bloque" }, curso, fecha, pago, el("div", { class: "fechas" }, barrio, formula), chips),
    el("div", { class: "tablero", "data-tablero": "true", "data-col": columna }),
    el("div", { class: "lista-simple", "data-cerrados": "true", hidden: true })
  );
}

async function cargarPedidos(silencioso = false) {
  const tablero = document.querySelector("[data-tablero]");
  if (!silencioso && tablero && !pedidos.length) {
    tablero.replaceChildren(esqueleto("esqueleto-tarjeta"), esqueleto("esqueleto-tarjeta"), esqueleto("esqueleto-tarjeta"));
    tablero.setAttribute("aria-busy", "true");
  }
  try {
    const lista = await leerPedidos();
    anunciar(lista);
    pedidos = lista;
    pintarBarrios();
    pintarContadores();
    if (seccion === "pedidos") pintarPedidos();
    if (seccion === "inicio") pintarInicioVivo();
    if (seccion === "formulas" && !editandoFormula()) pintarFormulas();
    if (tablero) tablero.removeAttribute("aria-busy");
  } catch (error) {
    if (tablero) {
      tablero.removeAttribute("aria-busy");
      if (!pedidos.length) tablero.replaceChildren(vacio("No pudimos cargar los pedidos", mensajeError(error)));
    }
    avisar(mensajeError(error));
  }
}

function editandoDetalle() {
  const activo = document.activeElement;
  return !!(activo && activo.closest("[data-detalle]") && activo.matches("input, textarea, select"));
}

function editandoFormula() {
  const activo = document.activeElement;
  return !!(activo && activo.closest("[data-panel='formulas']") && activo.matches("input, textarea"));
}

function encontrar(id) {
  return pedidos.find((pedido) => String(pedido.id) === String(id)) || null;
}

async function refrescar(id) {
  await cargarPedidos(true);
  if (id && !editandoDetalle()) pintarDetalle(id);
}

const pedidosEnCurso = new Set();

async function alDespachar(pedido) {
  if (pedidosEnCurso.has(pedido.id)) return;
  pedidosEnCurso.add(pedido.id);
  const nombre = domiciliarioActual(pedido);
  if (!nombre && domiciliarios.length) {
    pedidosEnCurso.delete(pedido.id);
    abrirPedido(pedido.id);
    avisar("Elige el domiciliario antes de despachar.");
    return;
  }
  try {
    const { error } = await supabase.rpc("descontar_stock", { p_pedido: pedido.id });
    if (error) throw error;
    await guardarPedido(pedido.id, {
      estado: "despachado",
      avisado: false,
      despachado_en: new Date().toISOString(),
      domiciliario: nombre || null
    });
    avisar("Pedido despachado.");
    await refrescar(pedido.id);
  } catch (error) {
    avisar(mensajeError(error));
  } finally {
    pedidosEnCurso.delete(pedido.id);
  }
}

async function alEntregar(pedido) {
  try {
    await guardarPedido(pedido.id, { estado: "entregado", avisado: false, entregado_en: new Date().toISOString() });
    avisar("Pedido marcado como entregado.");
    await refrescar(pedido.id);
  } catch (error) {
    avisar(mensajeError(error));
  }
}

async function alCobrar(pedido) {
  try {
    await guardarPedido(pedido.id, { cobrado: true, cobrado_en: new Date().toISOString() });
    avisar("Pedido marcado como cobrado.");
    await refrescar(pedido.id);
  } catch (error) {
    avisar(mensajeError(error));
  }
}

function rechazarPedido(pedido) {
  pedirMotivo("Rechazar pedido", MOTIVOS_PEDIDO, async (motivo) => {
    await guardarPedido(pedido.id, { estado: "rechazado", avisado: false, motivo });
    avisar("Pedido rechazado.");
    await refrescar(pedido.id);
  });
}

function cancelarPedido(pedido) {
  pedirMotivo("Cancelar pedido", MOTIVOS_PEDIDO, async (motivo) => {
    await guardarPedido(pedido.id, { estado: "cancelado", avisado: false, motivo });
    avisar("Pedido cancelado.");
    await refrescar(pedido.id);
  });
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
  pedido.avisado = true;
  await refrescar(pedido.id);
}

function abrirChat(pedido) {
  let url = "";
  if (negocio.modoPrueba) url = enlaceWhatsapp(`Hola, te escribimos de ${negocio.nombre}.`);
  else {
    let destino = soloDigitos(pedido.telefono);
    if (destino.length === 10) destino = `57${destino}`;
    if (destino) url = `https://wa.me/${destino}?text=${encodeURIComponent(`Hola, te escribimos de ${negocio.nombre}.`)}`;
  }
  if (!url) {
    avisar("Este pedido no tiene un celular para WhatsApp.");
    return;
  }
  window.open(url, "_blank", "noopener");
}

function enlaceLlamar(pedido) {
  let digitos = soloDigitos(negocio.modoPrueba ? negocio.whatsappPrueba : pedido.telefono);
  if (digitos.length === 10) digitos = `57${digitos}`;
  return digitos ? `tel:+${digitos}` : "";
}

function enlaceMaps(pedido) {
  const consulta = [pedido.direccion, pedido.barrio, "Cundinamarca"].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;
}

function domiciliarioActual(pedido) {
  const select = document.querySelector("[data-detalle] [name='domiciliario']");
  if (select && String(pedidoAbierto) === String(pedido.id)) return select.value;
  const guardado = domiciliarios.find((item) => item.nombre === pedido.domiciliario || String(item.id) === String(pedido.domiciliario));
  return guardado?.nombre || pedido.domiciliario || "";
}

async function copiar(texto, ok) {
  try {
    await navigator.clipboard.writeText(texto);
    avisar(ok);
  } catch {
    avisar("No pudimos copiar el texto.");
  }
}

function ticketDe(pedido) {
  const items = pedido.items.length ? pedido.items : [];
  return el("article", { class: "ticket" },
    el("img", { src: "assets/logo/logo-192.png", alt: "", width: "48", height: "48" }),
    el("h1", {}, negocio.nombre),
    el("p", {}, pedido.numero ? `Pedido N.º ${pedido.numero}` : "Pedido"),
    el("p", {}, fechaHora(pedido.created_at) || ""),
    el("p", {}, pedido.nombre || ""),
    el("p", {}, pedido.telefono || ""),
    el("p", {}, [pedido.direccion, pedido.barrio].filter(Boolean).join(", ")),
    el("ul", {}, ...items.map((item) => el("li", {}, `${item.nombre}${item.presentacion ? ` (${item.presentacion})` : ""} x ${item.cantidad || 0} ${item.precio == null ? "" : dinero(Number(item.precio) * (Number(item.cantidad) || 0))}`))),
    pedido.subtotal != null ? el("p", { class: "num" }, `Subtotal: ${dinero(pedido.subtotal)}`) : null,
    pedido.domicilio != null ? el("p", { class: "num" }, `Domicilio: ${dinero(pedido.domicilio)}`) : null,
    el("p", { class: "num" }, `Total: ${pedido.total == null ? "por confirmar" : dinero(pedido.total)}`),
    pedido.forma_pago ? el("p", {}, `Forma de pago: ${pedido.forma_pago}`) : null,
    pedido.notas ? el("p", {}, `Indicaciones: ${pedido.notas}`) : null
  );
}

function imprimir(pedido) {
  document.querySelector("[data-impresion]").replaceChildren(ticketDe(pedido));
  window.print();
}

function fotoItem(item) {
  if (!item.imagen) return el("span", { class: "mini-foto", "aria-hidden": "true" }, ico("pill"));
  const img = el("img", { src: item.imagen, alt: "", width: "56", height: "56" });
  img.addEventListener("error", () => img.replaceWith(el("span", { class: "mini-foto" }, ico("pill"))));
  return img;
}

function abrirPedido(id) {
  pedidoAbierto = id;
  pintarDetalle(id);
}

function cerrarDetalle() {
  const detalle = document.querySelector("[data-detalle]");
  const velo = document.querySelector("[data-velo-detalle]");
  detalle?.classList.remove("is-on");
  velo?.classList.remove("is-on");
  document.body.classList.remove("con-detalle");
  setTimeout(() => {
    if (detalle && !detalle.classList.contains("is-on")) detalle.hidden = true;
    if (velo && !velo.classList.contains("is-on")) velo.hidden = true;
  }, reducido() ? 0 : 240);
  pedidoAbierto = null;
}

async function pintarDetalle(id) {
  const pedido = encontrar(id);
  const detalle = document.querySelector("[data-detalle]");
  if (!pedido || !detalle) return;
  pedidoAbierto = id;
  await completarItems(pedido);
  const principal = accionPrincipal(pedido);
  const tel = enlaceLlamar(pedido);
  const opciones = [el("option", { value: "" }, "Sin asignar")];
  domiciliarios.forEach((item) => opciones.push(el("option", { value: item.nombre }, item.nombre)));
  const actual = domiciliarioActual(pedido);
  if (actual && !domiciliarios.some((item) => item.nombre === actual)) opciones.push(el("option", { value: actual }, actual));
  const select = el("select", { name: "domiciliario", "aria-label": "Domiciliario" }, ...opciones);
  select.value = actual;
  select.addEventListener("change", async () => {
    try {
      await guardarPedido(pedido.id, { domiciliario: select.value || null });
      pedido.domiciliario = select.value;
      avisar("Domiciliario guardado.");
    } catch (error) {
      avisar(mensajeError(error));
    }
  });
  const nota = el("textarea", { name: "nota", rows: "3", maxlength: "800" }, );
  nota.value = pedido.nota_interna || "";
  const papel = el("div", { class: "seg", role: "group", "aria-label": "Ancho del ticket" });
  ["80", "58"].forEach((mm) => {
    papel.append(el("button", {
      type: "button",
      "aria-pressed": document.documentElement.dataset.papel === mm ? "true" : "false",
      onclick: () => {
        document.documentElement.dataset.papel = mm;
        guardarPref("papel", mm);
        papel.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", item.dataset.mm === mm ? "true" : "false"));
      }
    }, `${mm} mm`));
    papel.lastElementChild.dataset.mm = mm;
  });
  detalle.replaceChildren(
    el("div", { class: "asa", "aria-hidden": "true" }),
    el("div", { class: "detalle-cabeza" },
      el("h2", { id: "detalle-titulo" }, pedido.numero ? `Pedido N.º ${pedido.numero}` : "Pedido"),
      btn("", "btn-neutro", "close", { "aria-label": "Cerrar detalle", onclick: cerrarDetalle })
    ),
    el("div", { class: "detalle-cuerpo" },
      el("div", { class: "linea" }, insigniaEstado(pedido.estado), insigniaPago(pedido)),
      pedido.motivo ? el("p", {}, `Motivo: ${pedido.motivo}`) : null,
      el("h3", {}, "Seguimiento"),
      el("div", { class: "tiempo" }, ...[
        ["Recibido", pedido.created_at],
        ["Aprobado", pedido.aprobado_en],
        ["Despachado", pedido.despachado_en],
        ["Entregado", pedido.entregado_en],
        ["Cobrado", pedido.cobrado ? pedido.cobrado_en : ""]
      ].map(([nombre, hora]) => el("div", { class: hora ? "paso hecho" : "paso" }, el("i"), el("div", {}, el("strong", {}, nombre), el("p", { class: "muted" }, hora ? (fechaHora(hora) || "Listo") : "Pendiente"))))),
      el("h3", {}, "Productos"),
      ...pedido.items.map((item) => el("div", { class: "mini" },
        fotoItem(item),
        el("div", {},
          el("strong", {}, item.nombre || "Producto"),
          el("p", { class: "muted" }, `${item.presentacion || ""} × ${item.cantidad || 0}`.trim()),
          el("p", { class: "num" }, item.precio == null ? "" : dinero(Number(item.precio) * (Number(item.cantidad) || 0)))
        )
      )),
      el("p", { class: "num" }, `Total ${pedido.total == null ? "por confirmar" : dinero(pedido.total)}`),
      el("h3", {}, "Cliente"),
      el("p", {}, pedido.nombre || "Sin nombre"),
      el("p", {}, pedido.telefono || "Sin celular"),
      el("div", { class: "acciones-inline" },
        btn("WhatsApp", "btn-neutro", "chat", { onclick: () => abrirChat(pedido) }),
        tel ? el("a", { class: "btn btn-neutro", href: tel }, ico("phone"), el("span", {}, "Llamar")) : null
      ),
      el("h3", {}, "Dirección"),
      el("p", {}, [pedido.direccion, pedido.barrio].filter(Boolean).join(", ") || "Sin dirección"),
      el("div", { class: "acciones-inline" },
        btn("Copiar", "btn-neutro", "copy", { onclick: () => copiar([pedido.direccion, pedido.barrio].filter(Boolean).join(", "), "Dirección copiada.") }),
        el("a", { class: "btn btn-neutro", href: enlaceMaps(pedido), target: "_blank", rel: "noopener noreferrer" }, ico("pin"), el("span", {}, "Abrir en Maps"))
      ),
      pedido.notas ? el("p", {}, `Indicaciones: ${pedido.notas}`) : el("p", { class: "muted" }, "Sin indicaciones"),
      el("h3", {}, "Autorización"),
      el("p", {}, `Versión de la política: ${String(pedido.politica_version || "").trim() || "Sin registro"}`),
      el("p", {}, `Autorización de datos: ${fechaHora(pedido.autorizo_datos_en) || "Sin registro"}`),
      String(pedido.formula_path || "").trim() || pedido.autorizo_formula_en ? el("p", {}, `Autorización de la fórmula: ${fechaHora(pedido.autorizo_formula_en) || "Sin registro"}`) : null,
      el("label", { class: "campo" }, "Domiciliario", select),
      el("label", { class: "campo" }, "Nota interna", nota),
      btn("Guardar nota", "btn-neutro", "check", {
        onclick: async (evento) => {
          ocupado(evento.currentTarget, true);
          try {
            await guardarPedido(pedido.id, { nota_interna: nota.value.trim() });
            pedido.nota_interna = nota.value.trim();
            avisar("Nota guardada.");
          } catch (error) {
            avisar(mensajeError(error));
          }
          ocupado(evento.currentTarget, false);
        }
      }),
      el("h3", {}, "Ticket"),
      papel,
      el("div", { class: "acciones-inline" },
        btn("Imprimir", "btn-neutro", "printer", { onclick: () => imprimir(pedido) }),
        btn("Copiar resumen", "btn-neutro", "copy", { onclick: () => copiar(textoResumen(pedido, negocio.nombre), "Resumen copiado.") })
      ),
      btn("Avisar por WhatsApp", "btn-principal", "chat", { onclick: () => avisarCliente(pedido) }),
      pedido.estado === "revision" ? btn("Rechazar", "btn-peligro", "close", { onclick: () => rechazarPedido(pedido) }) : null,
      !["entregado", "cancelado", "rechazado"].includes(pedido.estado) ? btn("Cancelar", "btn-peligro", "close", { onclick: () => cancelarPedido(pedido) }) : null
    ),
    principal ? el("div", { class: "pie-accion" }, principal) : el("div", { class: "pie-accion" }, btn("Cerrar", "btn-neutro btn-lg", "close", { onclick: cerrarDetalle }))
  );
  const movil = window.matchMedia("(max-width: 899px)").matches;
  const velo = document.querySelector("[data-velo-detalle]");
  if (movil && velo) {
    velo.hidden = false;
    requestAnimationFrame(() => velo.classList.add("is-on"));
  }
  detalle.hidden = false;
  document.body.classList.add("con-detalle");
  requestAnimationFrame(() => detalle.classList.add("is-on"));
}

function rutaFormula(pedido) {
  return String(pedido.formula_path || "").replace(/^\/+/, "").replace(/^formulas\//, "");
}

async function urlFormula(pedido) {
  const ruta = rutaFormula(pedido);
  if (!ruta) return "";
  const { data, error } = await supabase.storage.from("formulas").createSignedUrl(ruta, 60);
  if (error || !data?.signedUrl) return "";
  return data.signedUrl;
}

function irFormula(id) {
  formulaId = id;
  marcas = {};
  mostrarSeccion("formulas");
  pintarFormulas();
}

function checksListos() {
  return REVISION.every(([clave]) => marcas[clave]);
}

async function aprobarFormula(pedido, observacion) {
  const patch = {
    estado: "pendiente_pago",
    avisado: false,
    aprobado_en: new Date().toISOString()
  };
  if (observacion) {
    const previa = pedido.nota_interna ? `${pedido.nota_interna}\n` : "";
    patch.nota_interna = `${previa}Observación: ${observacion}`.slice(0, 1000);
  }
  await guardarPedido(pedido.id, patch);
  avisar(observacion ? "Fórmula aprobada con observación." : "Fórmula aprobada.");
  formulaId = null;
  marcas = {};
  notaFormula = "";
  await refrescar(null);
  pintarFormulas();
}

async function borrarFormula(pedido) {
  const ruta = rutaFormula(pedido);
  if (ruta) {
    const quitado = await supabase.storage.from("formulas").remove([ruta]);
    if (quitado.error) throw quitado.error;
  }
  let respuesta = await supabase.from("pedidos").update({ formula_path: null }).eq("id", pedido.id);
  if (respuesta.error) respuesta = await supabase.from("pedidos").update({ formula_path: "" }).eq("id", pedido.id);
  if (respuesta.error) throw respuesta.error;
  pedido.formula_path = "";
  avisar("Fórmula eliminada.");
  await refrescar(null);
  pintarFormulas();
}

async function pintarFormulas() {
  const panel = document.querySelector("[data-panel='formulas']");
  const listaNodo = panel.querySelector("[data-cola]");
  const visor = panel.querySelector("[data-visor]");
  if (!listaNodo || !visor) return;
  const cola = pedidos.filter((pedido) => pedido.estado === "revision").sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  const cerrados = pedidos.filter((pedido) => ["entregado", "cancelado", "rechazado"].includes(pedido.estado) && pedido.formula_path).slice(0, 20);
  if (!formulaId && cola[0]) formulaId = cola[0].id;
  if (formulaId && !encontrar(formulaId)) formulaId = cola[0]?.id || null;
  listaNodo.replaceChildren(
    ...(cola.length ? cola.map((pedido) => {
      const minutos = minutosDesde(pedido.created_at);
      return el("button", {
        type: "button",
        class: "fila-link",
        "aria-pressed": String(pedido.id) === String(formulaId) ? "true" : "false",
        onclick: () => {
          if (String(formulaId) !== String(pedido.id)) {
            marcas = {};
            notaFormula = "";
            zoom = 1;
            giro = 0;
          }
          formulaId = pedido.id;
          pintarFormulas();
        }
      }, el("span", {}, pedido.numero ? `N.º ${pedido.numero}` : "Pedido"), el("span", { class: `espera espera-${nivelEspera(minutos)}` }, textoEspera(minutos)));
    }) : [vacio("No hay fórmulas en revisión", "Cuando llegue un pedido con fórmula, aparece aquí.")]),
    cerrados.length ? el("h2", {}, "Pedidos cerrados") : null,
    ...cerrados.map((pedido) => el("div", { class: "linea" },
      el("span", {}, pedido.numero ? `N.º ${pedido.numero}` : "Pedido cerrado"),
      btn("Eliminar fórmula", "btn-peligro", "trash", {
        onclick: () => pedirConfirmacion("Eliminar fórmula", "Se quita el archivo del pedido cerrado.", () => borrarFormula(pedido))
      })
    ))
  );
  const pedido = encontrar(formulaId);
  if (!pedido || pedido.estado !== "revision") {
    visor.replaceChildren(vacio("Elige una fórmula", "La cola está ordenada de la más antigua a la más nueva."));
    return;
  }
  await completarItems(pedido);
  const url = await urlFormula(pedido);
  clearTimeout(timerUrl);
  const marco = el("div", { class: "visor" });
  const pdf = /\.pdf$/i.test(rutaFormula(pedido));
  if (!url) marco.append(el("p", { class: "muted" }, "No pudimos abrir la fórmula."));
  else if (pdf) {
    marco.append(el("a", { class: "btn btn-principal", href: url, target: "_blank", rel: "noopener noreferrer" }, "Abrir PDF"));
  } else {
    const img = el("img", { src: url, alt: "Fórmula médica del pedido", "data-zoom": String(zoom), "data-giro": String(giro) });
    marco.append(img);
    timerUrl = setTimeout(() => {
      if (img.isConnected) img.removeAttribute("src");
    }, 60000);
  }
  const productosFormula = pedido.items.filter((item) => item.requiere_formula);
  const mostrados = productosFormula.length ? productosFormula : pedido.items;
  const nota = el("textarea", { rows: "3", maxlength: "400", "aria-label": "Observación" });
  nota.value = notaFormula;
  const aprobar = btn("Aprobar", "btn-exito btn-lg", "check", { disabled: true });
  const observar = btn("Aprobar con observación", "btn-principal btn-lg", "check", { disabled: true });
  const sync = () => {
    const listo = checksListos();
    aprobar.disabled = !listo;
    observar.disabled = !(listo && nota.value.trim().length > 1);
  };
  aprobar.addEventListener("click", () => aprobarFormula(pedido, ""));
  observar.addEventListener("click", () => aprobarFormula(pedido, nota.value.trim()));
  nota.addEventListener("input", () => {
    notaFormula = nota.value;
    sync();
  });
  const herramientas = el("div", { class: "acciones-inline" },
    btn("Acercar", "btn-neutro", "zoom", { onclick: () => { zoom = Math.min(4, zoom + 1); pintarFormulas(); } }),
    btn("Alejar", "btn-neutro", "zoom", { onclick: () => { zoom = Math.max(1, zoom - 1); pintarFormulas(); } }),
    btn("Girar", "btn-neutro", "rotate", { onclick: () => { giro = (giro + 1) % 4; pintarFormulas(); } }),
    btn("Ajustar", "btn-neutro", "eye", { onclick: () => { zoom = 1; giro = 0; pintarFormulas(); } })
  );
  visor.replaceChildren(
    venceRevision(pedido.created_at) ? el("p", { class: "aviso-vencida" }, "Esta fórmula lleva más de 30 días en revisión.") : null,
    el("div", { class: "linea" }, el("h2", {}, pedido.numero ? `N.º ${pedido.numero}` : "Fórmula"), el("span", { class: "muted" }, textoEspera(minutosDesde(pedido.created_at)))) ,
    url && !pdf ? herramientas : null,
    marco,
    el("h3", {}, "Medicamentos del pedido"),
    !productosFormula.length ? el("p", { class: "muted" }, "Revisa todos los productos: ninguno vino marcado como fórmula.") : null,
    ...mostrados.map((item) => el("p", {}, `${item.nombre}${item.presentacion ? ` · ${item.presentacion}` : ""} × ${item.cantidad || 0}`)),
    el("div", { class: "lista-check" }, ...REVISION.map(([clave, etiqueta]) => {
      const caja = el("input", { type: "checkbox", checked: !!marcas[clave] });
      caja.addEventListener("change", () => {
        marcas[clave] = caja.checked;
        sync();
      });
      return el("label", {}, caja, el("span", {}, etiqueta));
    })),
    el("label", { class: "campo" }, "Observación", nota),
    el("div", { class: "acciones-inline" }, aprobar, observar, btn("Rechazar", "btn-peligro", "close", {
      onclick: () => pedirMotivo("Rechazar fórmula", MOTIVOS_FORMULA, async (motivo) => {
        await guardarPedido(pedido.id, { estado: "rechazado", avisado: false, motivo });
        avisar("Fórmula rechazada.");
        formulaId = null;
        marcas = {};
        notaFormula = "";
        await refrescar(null);
        pintarFormulas();
      })
    }))
  );
  sync();
}

function armarFormulas() {
  document.querySelector("[data-panel='formulas']").append(
    el("div", {}, el("h1", { id: "titulo-formulas" }, "Fórmulas"), el("p", { class: "muted" }, "Cola del regente, de la más antigua a la más nueva.")),
    el("div", { class: "formula-caja" },
      el("div", { class: "lista-simple", "data-cola": "true" }),
      el("div", { class: "bloque", "data-visor": "true" })
    )
  );
}

function etiquetaDia(valor) {
  const match = String(valor || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(valor || "");
  const fecha = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 17, 0, 0));
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short" }).format(fecha);
}

function deltaNodo(actual, anterior, invertida) {
  if (anterior == null || actual == null) return null;
  const delta = variacion(actual, anterior);
  if (delta == null) return el("span", { class: "delta var-sube" }, "Nuevo");
  if (delta === 0) return el("span", { class: "delta" }, "0%");
  const sube = delta > 0;
  const buena = invertida ? !sube : sube;
  return el("span", { class: buena ? "delta var-sube" : "delta var-baja" }, ico(sube ? "up" : "down"), `${sube ? "+" : ""}${delta}%`);
}

function metrica(titulo, valor, extra) {
  return el("article", { class: "tarjeta metrica" }, el("span", {}, titulo), el("strong", { class: "num" }, valor), extra || null);
}

function atencionItems() {
  const ahora = Date.now();
  const items = [];
  pedidos.forEach((pedido) => {
    if (pedido.estado === "revision" || porDespachar(pedido.estado, negocio.pagoEnLinea)) {
      const minutos = minutosDesde(pedido.created_at, ahora);
      if (minutos > 20) {
        items.push({
          nivel: minutos > 40 ? "rojo" : "ambar",
          texto: `${pedido.numero ? `Pedido ${pedido.numero}` : "Un pedido"} lleva ${textoEspera(minutos)}`,
          orden: minutos,
          ir: () => {
            mostrarSeccion("pedidos");
            abrirPedido(pedido.id);
          }
        });
      }
    }
    if (pedido.estado === "entregado" && !pedido.cobrado && ["efectivo", "transferencia"].includes(formaClave(pedido.forma_pago))) {
      items.push({
        nivel: "ambar",
        texto: `${pedido.numero ? `Pedido ${pedido.numero}` : "Un pedido"} entregado sin marcar cobrado`,
        orden: 10,
        ir: () => { mostrarSeccion("pedidos"); abrirPedido(pedido.id); }
      });
    }
  });
  const formulas = pedidos.filter((pedido) => pedido.estado === "revision");
  if (formulas.length) {
    const peor = Math.max(...formulas.map((pedido) => minutosDesde(pedido.created_at, ahora)));
    items.push({
      nivel: peor > 40 ? "rojo" : "ambar",
      texto: formulas.length === 1 ? "1 fórmula sin revisar" : `${formulas.length} fórmulas sin revisar`,
      orden: peor,
      ir: () => mostrarSeccion("formulas")
    });
  }
  const agotados = new Set(stockBajo.filter((item) => Number(item.stock) <= 0).flatMap((item) => [String(item.id), String(item.nombre || "").toLowerCase()]));
  pedidos.filter((pedido) => esActivo(pedido.estado)).forEach((pedido) => {
    const golpe = pedido.items.some((item) => agotados.has(String(item.id || "")) || agotados.has(String(item.nombre || "").toLowerCase()));
    if (golpe) {
      items.push({
        nivel: "rojo",
        texto: `${pedido.numero ? `Pedido ${pedido.numero}` : "Un pedido"} incluye un producto agotado`,
        orden: 50,
        ir: () => { mostrarSeccion("pedidos"); abrirPedido(pedido.id); }
      });
    }
  });
  items.sort((a, b) => (a.nivel === b.nivel ? b.orden - a.orden : (a.nivel === "rojo" ? -1 : 1)));
  return items.slice(0, 8);
}

function pintarInicioVivo() {
  const caja = document.querySelector("[data-atencion]");
  const ultimos = document.querySelector("[data-ultimos]");
  const vivos = document.querySelector("[data-vivos]");
  if (caja) {
    const items = atencionItems();
    caja.replaceChildren(
      el("h2", {}, "Requiere tu atención"),
      ...(items.length ? items.map((item) => el("button", { type: "button", class: "atencion", "data-nivel": item.nivel, onclick: item.ir }, ico("alert"), el("span", {}, item.texto), el("small", {}, "Abrir"))) : [el("p", { class: "muted" }, "Nada urgente por ahora.")])
    );
  }
  if (ultimos) {
    const lista = [...pedidos].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 8);
    ultimos.replaceChildren(...(lista.length ? lista.map((pedido) => el("button", {
      type: "button",
      class: "fila-link",
      onclick: () => { mostrarSeccion("pedidos"); abrirPedido(pedido.id); }
    }, el("span", {}, pedido.numero ? `N.º ${pedido.numero}` : "Pedido"), insigniaEstado(pedido.estado), el("span", { class: "num" }, pedido.total == null ? "" : dinero(pedido.total)))) : [el("p", { class: "muted" }, "Todavía no hay pedidos.")]));
  }
  if (vivos && resumenActual) pintarMetricas();
}

function pintarMetricas() {
  const caja = document.querySelector("[data-vivos]");
  if (!caja || !resumenActual) return;
  const prev = resumenPrevio || {};
  const act = resumenActual;
  const minutos = (valor) => (valor == null ? "—" : `${Math.round(valor)} min`);
  const tarjetas = [
    metrica("Pedidos", String(act.pedidos), deltaNodo(act.pedidos, prev.pedidos, false)),
    metrica("Ventas entregadas", dinero(act.ventas), deltaNodo(act.ventas, prev.ventas, false)),
    metrica("Ticket promedio", dinero(act.ticket), deltaNodo(act.ticket, prev.ticket, false)),
    metrica("Por cobrar", dinero(act.porCobrar), deltaNodo(act.porCobrar, prev.porCobrar, true)),
    metrica("Fórmulas por revisar", String(pedidos.filter((pedido) => pedido.estado === "revision").length), el("button", { type: "button", class: "btn btn-neutro", onclick: () => mostrarSeccion("formulas") }, "Abrir cola")),
    metrica("Stock bajo o agotado", String(stockBajo.length), el("button", { type: "button", class: "btn btn-neutro", onclick: () => mostrarSeccion("productos") }, "Ver productos")),
    metrica("Entrega promedio", minutos(act.minutosEntrega), deltaNodo(act.minutosEntrega, prev.minutosEntrega, true)),
    metrica("Aprobación de fórmulas", minutos(act.minutosAprobacion), deltaNodo(act.minutosAprobacion, prev.minutosAprobacion, true))
  ];
  if (act.margen != null) tarjetas.push(metrica("Margen estimado", dinero(act.margen), deltaNodo(act.margen, prev.margen, false)));
  if (clientesTotal != null) tarjetas.push(metrica("Clientes", String(clientesTotal)));
  caja.replaceChildren(...tarjetas);
}

function pintarGraficos() {
  const caja = document.querySelector("[data-graficos]");
  if (!caja || !resumenActual) return;
  const act = resumenActual;
  const dias = act.porDia.map((dia) => ({ ...dia, etiqueta: etiquetaDia(dia.dia) }));
  const bloques = [
    ["Ventas y pedidos por día", graficoDia(dias)],
    ["Pedidos por hora", graficoHoras(act.horas)],
    ["Pedidos por estado", graficoDona(act.porEstado.map((item) => ({ nombre: etiquetaEstado(item.nombre), valor: item.valor })))],
    ["Formas de pago", graficoHorizonte(act.formasPago.map((item) => ({ nombre: formaClave(item.nombre) === "otra" ? item.nombre : etiquetaForma(formaClave(item.nombre)), valor: item.valor })), "Formas de pago")],
    ["Productos más vendidos", graficoHorizonte(act.top, "Productos más vendidos")],
    ["Barrios", graficoHorizonte(act.barrios, "Barrios")]
  ];
  caja.replaceChildren(...bloques.map(([titulo, grafico]) => el("article", { class: "tarjeta bloque" }, el("h2", {}, titulo), grafico || el("p", { class: "muted" }, "Sin datos en este periodo."))));
}

async function cargarResumen() {
  const caja = document.querySelector("[data-vivos]");
  const rango = rangos(periodo, new Date(), document.querySelector("[data-desde]")?.value, document.querySelector("[data-hasta]")?.value);
  if (!rango) {
    avisar("Revisa las fechas del periodo.");
    return;
  }
  if (caja) caja.setAttribute("aria-busy", "true");
  const [actual, previo, clientes] = await Promise.all([
    supabase.rpc("panel_resumen", { p_desde: rango.desde.toISOString(), p_hasta: rango.hasta.toISOString() }),
    supabase.rpc("panel_resumen", { p_desde: rango.prevDesde.toISOString(), p_hasta: rango.prevHasta.toISOString() }),
    supabase.rpc("clientes_resumen")
  ]);
  if (actual.error) {
    if (caja) caja.removeAttribute("aria-busy");
    avisar(mensajeError(actual.error));
    return;
  }
  resumenActual = leerResumen(actual.data);
  resumenPrevio = previo.error ? null : leerResumen(previo.data);
  clientesTotal = clientes.error ? null : leerClientes(clientes.data);
  if (caja) caja.removeAttribute("aria-busy");
  pintarMetricas();
  pintarGraficos();
  pintarInicioVivo();
}

function armarInicio() {
  const panel = document.querySelector("[data-panel='inicio']");
  const titulo = el("h1", { id: "titulo-inicio" }, saludo());
  const fecha = el("p", { class: "muted" }, fechaLarga());
  const periodos = el("div", { class: "seg", role: "group", "aria-label": "Periodo" });
  const fechas = el("div", { class: "fechas", hidden: true });
  const desde = el("input", { type: "date", "data-desde": "true", "aria-label": "Desde" });
  const hasta = el("input", { type: "date", "data-hasta": "true", "aria-label": "Hasta" });
  fechas.append(desde, hasta, btn("Ver periodo", "btn-principal", "check", { onclick: () => cargarResumen() }));
  [["hoy", "Hoy"], ["7", "7 días"], ["30", "30 días"], ["personalizado", "Personalizado"]].forEach(([valor, etiqueta]) => {
    periodos.append(el("button", {
      type: "button",
      "aria-pressed": valor === "hoy" ? "true" : "false",
      onclick: () => {
        periodo = valor;
        periodos.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", item.dataset.valor === valor ? "true" : "false"));
        fechas.hidden = valor !== "personalizado";
        if (valor !== "personalizado") cargarResumen();
      }
    }, etiqueta));
    periodos.lastElementChild.dataset.valor = valor;
  });
  panel.append(
    el("div", { class: "encabezado" }, el("div", {}, titulo, fecha), el("div", { class: "bloque" }, periodos, fechas)),
    el("section", { class: "bloque", "data-atencion": "true", "aria-label": "Requiere tu atención" }),
    el("div", { class: "metricas", "data-vivos": "true" }, esqueleto("esqueleto-tarjeta"), esqueleto("esqueleto-tarjeta"), esqueleto("esqueleto-tarjeta"), esqueleto("esqueleto-tarjeta")),
    el("div", { class: "graficos", "data-graficos": "true" }, esqueleto("esqueleto-bloque"), esqueleto("esqueleto-bloque")),
    el("section", { class: "tarjeta bloque" }, el("h2", {}, "Últimos pedidos"), el("div", { class: "lista-simple", "data-ultimos": "true" }))
  );
}

async function cargarStock() {
  const { data, error } = await supabase.from("productos").select("id,nombre,stock,stock_minimo").limit(2000);
  if (error) {
    stockBajo = [];
    return;
  }
  stockBajo = (data || []).filter((item) => {
    const stock = Number(item.stock) || 0;
    const minimo = item.stock_minimo == null || item.stock_minimo === "" ? null : Number(item.stock_minimo);
    if (stock <= 0) return true;
    return minimo != null && Number.isFinite(minimo) && stock <= minimo;
  });
}

async function cargarDomiciliarios() {
  const { data, error } = await supabase.from("domiciliarios").select("id,nombre,activo").eq("activo", true).order("nombre");
  domiciliarios = error ? [] : (data || []);
}

async function leerConfigFila() {
  let respuesta = await supabase.from("config").select("id,domicilio,pedido_minimo,abierto,aviso,tiempo_entrega,politica_version").limit(1).maybeSingle();
  if (respuesta.error) respuesta = await supabase.from("config").select("id,domicilio,pedido_minimo,abierto,aviso,tiempo_entrega").limit(1).maybeSingle();
  if (respuesta.error) respuesta = await supabase.from("config").select("id,domicilio,pedido_minimo,abierto").limit(1).maybeSingle();
  if (respuesta.error || !respuesta.data) throw respuesta.error || new Error("No encontramos la configuración.");
  configFila = respuesta.data;
  pintarTienda();
  return respuesta.data;
}

function pintarTienda() {
  const boton = document.querySelector("[data-tienda]");
  if (!boton || !configFila) return;
  const abierta = configFila.abierto !== false;
  boton.setAttribute("aria-pressed", abierta ? "true" : "false");
  boton.textContent = abierta ? "Tienda abierta" : "Tienda cerrada";
  const form = document.querySelector("#ajustes-form");
  if (form?.abierto) form.abierto.checked = abierta;
}

async function cambiarTienda() {
  if (!configFila) return;
  const boton = document.querySelector("[data-tienda]");
  const siguiente = configFila.abierto === false;
  boton.disabled = true;
  const { error } = await supabase.from("config").update({ abierto: siguiente }).eq("id", configFila.id);
  boton.disabled = false;
  if (error) {
    avisar(mensajeError(error));
    return;
  }
  configFila.abierto = siguiente;
  pintarTienda();
  avisar(siguiente ? "La tienda está abierta." : "La tienda quedó cerrada.");
}

function pintarContadores() {
  const activos = pedidos.filter((pedido) => esActivo(pedido.estado)).length;
  const formulas = pedidos.filter((pedido) => pedido.estado === "revision").length;
  document.querySelectorAll("[data-cuenta]").forEach((nodo) => {
    const n = nodo.dataset.cuenta === "pedidos" ? activos : formulas;
    nodo.hidden = n <= 0;
    nodo.textContent = String(n);
  });
}

function mostrarSeccion(nombre) {
  if (!SECCIONES.some((item) => item[0] === nombre)) nombre = "inicio";
  seccion = nombre;
  if (nombre !== "pedidos") cerrarDetalle();
  if (nombre === "pedidos" && document.visibilityState === "visible") {
    sinVer = 0;
    sincronizarTitulo();
  }
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== nombre;
  });
  document.querySelectorAll("[data-ir]").forEach((boton) => {
    const activo = boton.dataset.ir === nombre;
    if (activo) boton.setAttribute("aria-current", "page");
    else boton.removeAttribute("aria-current");
  });
  history.replaceState(null, "", `#${nombre}`);
  if (nombre === "inicio") {
    pintarInicioVivo();
    if (!resumenActual) cargarResumen();
  }
  if (nombre === "pedidos") pintarPedidos();
  if (nombre === "formulas") pintarFormulas();
  if (nombre === "productos") cargarProductos();
  if (nombre === "ajustes") cargarAjustes();
  if (nombre === "auditoria") cargarAuditoria();
}

function armarNav() {
  const lado = document.querySelector("[data-nav]");
  const dock = document.querySelector("[data-dock]");
  SECCIONES.forEach(([id, etiqueta, iconoNombre]) => {
    const cuenta = id === "pedidos" || id === "formulas" ? el("span", { class: "contador", "data-cuenta": id, hidden: true }, "0") : null;
    const item = el("button", { type: "button", class: "nav-item", "data-ir": id, onclick: () => mostrarSeccion(id) }, ico(iconoNombre), el("span", {}, etiqueta), cuenta);
    lado.append(item);
    const movil = el("button", { type: "button", "data-ir": id, onclick: () => mostrarSeccion(id) }, ico(iconoNombre), el("span", {}, etiqueta === "Auditoría" ? "Auditar" : etiqueta));
    if (cuenta) movil.append(el("span", { class: "contador", "data-cuenta": id, hidden: true }, "0"));
    dock.append(movil);
  });
}

function pintarPreferencias() {
  const tema = document.documentElement.dataset.tema === "oscuro";
  const compacta = document.documentElement.dataset.densidad === "compacta";
  const sonido = pref("sonido", "1") === "1";
  const botonTema = document.querySelector("button[data-tema]");
  const botonDensidad = document.querySelector("button[data-densidad]");
  const botonSonido = document.querySelector("[data-sonido]");
  botonTema.querySelector(".util-texto").textContent = tema ? "Oscuro" : "Claro";
  botonTema.setAttribute("aria-label", tema ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
  conIcono(botonTema, tema ? "moon" : "sun");
  botonDensidad.querySelector(".util-texto").textContent = compacta ? "Compacta" : "Cómoda";
  botonDensidad.setAttribute("aria-pressed", compacta ? "true" : "false");
  botonDensidad.setAttribute("aria-label", compacta ? "Usar densidad cómoda" : "Usar densidad compacta");
  conIcono(botonDensidad, "sliders");
  botonSonido.querySelector(".util-texto").textContent = "Sonido";
  botonSonido.setAttribute("aria-pressed", sonido ? "true" : "false");
  conIcono(botonSonido, sonido ? "speaker" : "bell");
  conIcono(document.querySelector("[data-usuario]"), "user");
  const busca = document.querySelector(".busca");
  if (busca && !busca.querySelector("svg")) busca.prepend(ico("search"));
  const meta = document.querySelector("meta[name='theme-color']");
  if (meta) meta.content = tema ? "#071422" : "#0077D5";
  const avisos = document.querySelector("[data-avisos]");
  if (avisos) {
    const permiso = typeof Notification === "function" ? Notification.permission : "denied";
    avisos.textContent = permiso === "granted" ? "Notificaciones activas" : (permiso === "denied" ? "Notificaciones bloqueadas" : "Activar notificaciones");
    avisos.disabled = permiso !== "default";
  }
}

function coincidencias(q) {
  const texto = q.trim().toLowerCase();
  if (!texto) return [];
  return pedidos.filter((pedido) => busqueda(pedido, texto)).slice(0, 8);
}

function pintarBusqueda() {
  const lista = document.querySelector("[data-busca-lista]");
  const entrada = document.querySelector("#buscar");
  const items = coincidencias(entrada.value);
  lista.hidden = !items.length;
  lista.replaceChildren(...items.map((pedido) => el("button", {
    type: "button",
    onclick: () => {
      textoPedido = entrada.value;
      lista.hidden = true;
      mostrarSeccion("pedidos");
      abrirPedido(pedido.id);
    }
  }, el("strong", {}, pedido.numero ? `N.º ${pedido.numero}` : "Pedido"), el("span", {}, `${pedido.nombre || "Sin nombre"} · ${pedido.barrio || "Sin barrio"}`))));
}

function ayuda() {
  const hoja = hojaDe("hoja-ayuda");
  hoja.setAttribute("aria-labelledby", "ayuda-titulo");
  const filas = [
    ["/", "Buscar un pedido"],
    ["g, luego i", "Ir a inicio"],
    ["g, luego p", "Ir a pedidos"],
    ["n", "Siguiente pedido en revisión"],
    ["?", "Ver estos atajos"]
  ];
  hoja.replaceChildren(
    el("div", { class: "hoja-cabeza" }, el("h2", { id: "ayuda-titulo" }, "Atajos"), btn("", "btn-neutro", "close", { "aria-label": "Cerrar", onclick: () => cerrarHoja(hoja) })),
    el("div", { class: "hoja-cuerpo" }, el("p", {}, "Funcionan en escritorio, fuera de un campo de texto."), ...filas.map(([tecla, texto]) => el("p", {}, el("strong", {}, tecla), ` ${texto}`)))
  );
  abrirHoja(hoja);
}

function teclado(evento) {
  if (window.matchMedia("(max-width: 899px)").matches) return;
  const destino = evento.target;
  if (destino && destino.closest("input, textarea, select, [contenteditable='true']")) return;
  if (evento.metaKey || evento.ctrlKey || evento.altKey) return;
  if (document.querySelector(".hoja.is-on")) return;
  if (evento.key === "?") {
    evento.preventDefault();
    ayuda();
    return;
  }
  if (evento.key === "/") {
    evento.preventDefault();
    document.querySelector("#buscar")?.focus();
    return;
  }
  if (evento.key === "n") {
    const cola = pedidos.filter((pedido) => pedido.estado === "revision").sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    const fuente = cola.length ? cola : pedidos.filter((pedido) => esActivo(pedido.estado));
    if (!fuente.length) return;
    const pedido = fuente[cursorNuevo % fuente.length];
    cursorNuevo += 1;
    mostrarSeccion("pedidos");
    abrirPedido(pedido.id);
    return;
  }
  if (evento.key === "g") {
    acorde = "g";
    clearTimeout(timerAcorde);
    timerAcorde = setTimeout(() => { acorde = ""; }, 1200);
    return;
  }
  if (acorde === "g" && (evento.key === "p" || evento.key === "i")) {
    mostrarSeccion(evento.key === "p" ? "pedidos" : "inicio");
    acorde = "";
  }
}

function tocarActividad() {
  clearTimeout(inactividad);
  inactividad = setTimeout(async () => {
    await supabase.auth.signOut();
    location.href = "admin-login.html?aviso=inactividad";
  }, INACTIVIDAD);
}

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

function valorFormula(valor) {
  const clave = String(valor ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (["si", "sí", "true", "1"].includes(clave)) return true;
  if (["no", "false", "0", ""].includes(clave)) return false;
  return null;
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
        if (fuente[i + 1] === '"') { celda += '"'; i += 1; }
        else comillas = false;
      } else celda += char;
    } else if (char === '"') comillas = true;
    else if (char === separador) { fila.push(celda.trim()); celda = ""; }
    else if (char === "\n") { fila.push(celda.trim()); filas.push(fila); fila = []; celda = ""; }
    else if (char !== "\r") celda += char;
  }
  if (celda.length || fila.length) { fila.push(celda.trim()); filas.push(fila); }
  if (!filas.length) return [];
  const encabezados = filas.shift().map((item) => item.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, "_"));
  return filas.filter((row) => row.some(Boolean)).map((row, indice) => {
    const objeto = { _linea: indice + 2 };
    encabezados.forEach((clave, i) => { objeto[clave] = row[i] || ""; });
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
  const requiere = valorFormula(row.requiere_formula);
  const errores = [];
  if (!nombre) errores.push("falta el nombre");
  if (!presentacion) errores.push("falta la presentación");
  if (!categoria) errores.push("falta la categoría");
  if (!Number.isFinite(precio) || precio < 0) errores.push("precio inválido");
  if (!Number.isInteger(stock) || stock < 0) errores.push("stock inválido");
  if (requiere == null) errores.push("requiere_formula inválido");
  const minimo = row.stock_minimo === undefined || row.stock_minimo === "" ? null : parseNumero(row.stock_minimo);
  if (minimo != null && (!Number.isFinite(minimo) || minimo < 0)) errores.push("stock mínimo inválido");
  return {
    linea: row._linea,
    nombre,
    marca,
    presentacion,
    categoria,
    precio,
    stock,
    requiere_formula: requiere === true,
    codigo: (row.codigo || "").trim(),
    stock_minimo: minimo == null ? null : Math.trunc(minimo),
    errores
  };
}

function imagenGuardada(valor) {
  const texto = String(valor || "").trim();
  if (!texto || texto.startsWith("data:")) return "";
  if (/^https?:\/\//i.test(texto)) return texto;
  if (/^assets\/productos\/[a-z0-9-]+\.svg$/.test(texto)) return texto;
  return "";
}

function etiquetaIlustracion(ruta) {
  const base = ruta.split("/").pop().replace(/\.svg$/i, "").replaceAll("-", " ");
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function ilustracionSegura(valor) {
  return ILUSTRACIONES.includes(valor) ? valor : "";
}

function mostrarPrevia() {
  const img = document.querySelector("[data-imagen-previa]");
  const form = document.querySelector("#producto-form");
  if (!img || !form) return;
  const archivo = form.imagen?.files?.[0];
  if (archivo) {
    const url = URL.createObjectURL(archivo);
    img.src = url;
    img.hidden = false;
    img.onload = () => URL.revokeObjectURL(url);
    return;
  }
  const src = ilustracionSegura(document.querySelector("#imagen-ilustracion")?.value || "") || imagenGuardada(editando?.imagen);
  img.hidden = !src;
  if (src) img.src = src;
}

async function prepararBlob(archivo) {
  const tipos = ["image/jpeg", "image/png", "image/webp"];
  if (!tipos.includes(archivo.type)) throw new Error("La imagen debe ser JPG, PNG o WEBP.");
  if (archivo.size <= 1024 * 1024) return { blob: archivo, tipo: archivo.type };
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * escala));
  canvas.height = Math.max(1, Math.round(bitmap.height * escala));
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  let calidad = 0.86;
  let blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", calidad));
  while (blob && blob.size > 1024 * 1024 && calidad > 0.45) {
    calidad -= 0.08;
    blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", calidad));
  }
  if (!blob || blob.size > 1024 * 1024) throw new Error("La imagen supera 1 MB. Elige una más liviana.");
  return { blob, tipo: "image/jpeg" };
}

async function subirImagenProducto(archivo) {
  const { blob, tipo } = await prepararBlob(archivo);
  const ext = tipo === "image/png" ? "png" : tipo === "image/webp" ? "webp" : "jpg";
  const ruta = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("productos").upload(ruta, blob, { contentType: tipo, upsert: false, cacheControl: "31536000" });
  if (error) throw error;
  const { data } = supabase.storage.from("productos").getPublicUrl(ruta);
  if (!data?.publicUrl) throw new Error("No pudimos publicar la imagen.");
  return data.publicUrl;
}

function programarCampo(id, patch, nodo) {
  const clave = `${id}:${Object.keys(patch)[0]}`;
  clearTimeout(timerCampo.get(clave));
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
    type: "number", min: "0", step: "1", value: String(Number(producto.precio) || 0),
    "aria-label": `Precio de ${producto.nombre}`,
    oninput: (evento) => programarCampo(producto.id, { precio: Number(evento.target.value) || 0 }, evento.target)
  });
  const stock = el("input", {
    type: "number", min: "0", step: "1", value: String(Number(producto.stock) || 0),
    "aria-label": `Stock de ${producto.nombre}`,
    oninput: (evento) => programarCampo(producto.id, { stock: Math.max(0, Math.trunc(Number(evento.target.value) || 0)) }, evento.target)
  });
  const minimo = el("input", {
    type: "number", min: "0", step: "1", value: String(Number(producto.stock_minimo) || 0),
    "aria-label": `Stock mínimo de ${producto.nombre}`,
    oninput: (evento) => programarCampo(producto.id, { stock_minimo: Math.max(0, Math.trunc(Number(evento.target.value) || 0)) }, evento.target)
  });
  const rx = el("input", { type: "checkbox", checked: formula, "aria-label": `Requiere fórmula: ${producto.nombre}` });
  rx.addEventListener("change", async () => {
    const patch = { requiere_formula: rx.checked };
    if (rx.checked) patch.precio_anterior = null;
    const { error } = await supabase.from("productos").update(patch).eq("id", producto.id);
    if (error) avisar(mensajeError(error));
    else cargarProductos();
  });
  const media = el("div", { class: "admin-photo" });
  if (producto.imagen) {
    const img = el("img", { src: producto.imagen, alt: "", width: "72", height: "72" });
    img.addEventListener("error", () => img.remove());
    media.append(img);
  }
  const bajo = (Number(producto.stock) || 0) <= 0 || (producto.stock_minimo != null && Number(producto.stock) <= Number(producto.stock_minimo));
  return el("article", { class: "tarjeta producto" },
    media,
    el("div", {},
      el("h3", {}, producto.nombre),
      el("p", { class: "muted" }, [producto.codigo, marcaVisible(producto.marca), producto.presentacion, producto.categoria].filter(Boolean).join(" · ")),
      bajo ? el("span", { class: "insignia", "data-estado": "revision" }, (Number(producto.stock) || 0) <= 0 ? "Agotado" : "Stock bajo") : null
    ),
    el("label", { class: "campo" }, "Precio", precio),
    el("label", { class: "campo" }, "Stock", stock),
    el("label", { class: "campo" }, "Mínimo", minimo),
    el("label", { class: "check" }, rx, el("span", {}, "Fórmula")),
    btn(producto.activo ? "Activo" : "Inactivo", producto.activo ? "btn-neutro" : "btn-peligro", "check", {
      onclick: async () => {
        const { error } = await supabase.from("productos").update({ activo: !producto.activo }).eq("id", producto.id);
        if (error) avisar(mensajeError(error));
        else cargarProductos();
      }
    }),
    btn("Editar", "btn-neutro", "eye", { onclick: () => abrirProducto(producto) })
  );
}

async function cargarProductos() {
  const lista = document.querySelector("[data-productos]");
  if (!lista) return;
  lista.replaceChildren(esqueleto("esqueleto-tarjeta"), esqueleto("esqueleto-tarjeta"));
  lista.setAttribute("aria-busy", "true");
  const desde = (paginaProducto - 1) * POR_PAGINA;
  let consulta = supabase.from("productos").select("*", { count: "exact" });
  const q = textoProducto.trim().replace(/[%_,()]/g, " ").slice(0, 60);
  if (q) consulta = consulta.or(`nombre.ilike.%${q}%,marca.ilike.%${q}%,presentacion.ilike.%${q}%,codigo.ilike.%${q}%`);
  let respuesta = await consulta.order("nombre", { ascending: true }).range(desde, desde + POR_PAGINA - 1);
  if (respuesta.error && q) {
    consulta = supabase.from("productos").select("*", { count: "exact" }).or(`nombre.ilike.%${q}%,marca.ilike.%${q}%,presentacion.ilike.%${q}%`);
    respuesta = await consulta.order("nombre", { ascending: true }).range(desde, desde + POR_PAGINA - 1);
  }
  lista.removeAttribute("aria-busy");
  if (respuesta.error) {
    lista.replaceChildren(vacio("No pudimos cargar los productos", mensajeError(respuesta.error)));
    return;
  }
  productos = respuesta.data || [];
  totalProductos = respuesta.count || 0;
  const paginas = Math.max(1, Math.ceil(totalProductos / POR_PAGINA));
  if (paginaProducto > paginas) {
    paginaProducto = paginas;
    cargarProductos();
    return;
  }
  lista.replaceChildren(...(productos.length ? productos.map(filaProducto) : [vacio("Sin productos", "Prueba otra búsqueda o crea uno nuevo.")]));
  const label = document.querySelector("[data-prod-page]");
  if (label) label.textContent = `Página ${paginaProducto} de ${paginas}`;
  const prev = document.querySelector("[data-prod-prev]");
  const next = document.querySelector("[data-prod-next]");
  if (prev) prev.disabled = paginaProducto <= 1;
  if (next) next.disabled = paginaProducto >= paginas;
}

function campo(etiqueta, control) {
  return el("label", { class: "campo" }, etiqueta, control);
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
    stock_minimo: Math.max(0, Math.trunc(Number(form.stock_minimo.value) || 0)),
    codigo: form.codigo.value.trim(),
    requiere_formula: formula,
    activo: form.activo.checked
  };
}

function validarProducto(datos, costo) {
  if (datos.nombre.length < 2) return "Escribe el nombre del producto.";
  if (!datos.presentacion) return "Escribe la presentación.";
  if (!datos.categoria) return "Elige una categoría.";
  if (!Number.isFinite(datos.precio) || datos.precio < 0) return "El precio no es válido.";
  if (datos.precio_anterior != null && (!Number.isFinite(datos.precio_anterior) || datos.precio_anterior < 0)) return "El precio anterior no es válido.";
  if (datos.codigo.length > 40) return "El código es demasiado largo.";
  if (costo !== "" && (!Number.isFinite(Number(costo)) || Number(costo) < 0)) return "El costo no es válido.";
  return "";
}

async function guardarCosto(id, texto) {
  if (!id) return;
  if (texto === "") {
    await supabase.from("productos_costos").delete().eq("producto_id", id);
    return;
  }
  const costo = Number(texto);
  let respuesta = await supabase.from("productos_costos").upsert({ producto_id: id, costo }, { onConflict: "producto_id" });
  if (!respuesta.error) return;
  const actual = await supabase.from("productos_costos").update({ costo }).eq("producto_id", id).select("producto_id");
  if (actual.error) throw actual.error;
  if (!actual.data?.length) {
    const creado = await supabase.from("productos_costos").insert({ producto_id: id, costo });
    if (creado.error) throw creado.error;
  }
}

async function guardarProducto(evento) {
  evento.preventDefault();
  const aviso = document.querySelector("[data-prod-error]");
  const form = document.querySelector("#producto-form");
  const datos = leerFormulario();
  const errorTexto = validarProducto(datos, form.costo.value.trim());
  aviso.hidden = !errorTexto;
  aviso.textContent = errorTexto;
  if (errorTexto) return;
  const archivo = form.imagen.files[0];
  const ilustracion = ilustracionSegura(document.querySelector("#imagen-ilustracion").value);
  let imagen = imagenGuardada(editando?.imagen);
  try {
    if (archivo) imagen = await subirImagenProducto(archivo);
    else if (ilustracion) imagen = ilustracion;
    const payload = { ...datos, imagen: imagen || "" };
    let respuesta = editando?.id
      ? await supabase.from("productos").update(payload).eq("id", editando.id).select("id").maybeSingle()
      : await supabase.from("productos").insert(payload).select("id").maybeSingle();
    if (respuesta.error) throw respuesta.error;
    const id = respuesta.data?.id || editando?.id;
    await guardarCosto(id, form.costo.value.trim());
    cerrarProducto();
    avisar(editando?.id ? "Producto actualizado." : "Producto creado.");
    editando = null;
    await cargarProductos();
    await cargarStock();
    if (seccion === "inicio") pintarMetricas();
  } catch (error) {
    aviso.hidden = false;
    aviso.textContent = mensajeError(error);
  }
}

function sincronizarOferta() {
  const form = document.querySelector("#producto-form");
  const bloque = document.querySelector("[data-anterior]");
  const activo = !form.requiere_formula.checked;
  bloque.hidden = !activo;
  if (!activo) form.precio_anterior.value = "";
}

async function abrirProducto(producto) {
  editando = producto || null;
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
    form.stock_minimo.value = Number(producto.stock_minimo) || 0;
    form.codigo.value = producto.codigo || "";
    form.requiere_formula.checked = esFormula(producto.requiere_formula);
    form.activo.checked = producto.activo !== false;
  } else {
    form.categoria.value = categorias[0].id;
    form.activo.checked = true;
    form.stock.value = 0;
    form.stock_minimo.value = 0;
    form.precio.value = 0;
  }
  document.querySelector("#imagen-ilustracion").value = ilustracionSegura(producto?.imagen || "");
  form.imagen.value = "";
  form.costo.value = "";
  const idCosto = producto?.id || null;
  if (idCosto) {
    const costo = await supabase.from("productos_costos").select("costo").eq("producto_id", idCosto).maybeSingle();
    if (!costo.error && costo.data && editando?.id === idCosto && form.costo) form.costo.value = costo.data.costo ?? "";
  }
  mostrarPrevia();
  sincronizarOferta();
  document.querySelector("[data-prod-error]").hidden = true;
  abrirHoja(document.getElementById("editor-producto"));
  form.nombre.focus();
}

function cerrarProducto() {
  cerrarHoja(document.getElementById("editor-producto"));
}

function armarProductos() {
  const panel = document.querySelector("[data-panel='productos']");
  const buscador = el("input", {
    type: "search",
    placeholder: "Nombre, marca, presentación o código",
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
    abrirCsv(parseCSV(await file.text()).map(prepararFila));
  });
  panel.append(
    el("div", { class: "panel-head" },
      el("h1", { id: "titulo-productos" }, "Productos"),
      el("div", { class: "acciones-inline" },
        btn("Importar CSV", "btn-neutro", "box", { onclick: () => archivo.click() }),
        btn("Plantilla", "btn-neutro", "copy", { onclick: descargarPlantilla }),
        btn("Crear producto", "btn-principal", "plus", { onclick: () => abrirProducto(null) })
      )
    ),
    buscador,
    archivo,
    el("div", { class: "productos", "data-productos": "true" }),
    el("div", { class: "pager" },
      btn("Anterior", "btn-neutro", "up", { "data-prod-prev": "true", onclick: () => { paginaProducto -= 1; cargarProductos(); } }),
      el("span", { "data-prod-page": "true" }, "Página 1"),
      btn("Siguiente", "btn-neutro", "down", { "data-prod-next": "true", onclick: () => { paginaProducto += 1; cargarProductos(); } })
    )
  );
  const form = el("form", { id: "producto-form", class: "formulario", novalidate: true, onsubmit: guardarProducto });
  form.append(
    campo("Nombre", el("input", { name: "nombre", required: true, maxlength: "140" })),
    campo("Marca", el("input", { name: "marca", maxlength: "80" })),
    campo("Código", el("input", { name: "codigo", maxlength: "40" })),
    campo("Presentación", el("input", { name: "presentacion", required: true, maxlength: "120" })),
    campo("Categoría", el("select", { name: "categoria" }, ...categorias.map((item) => el("option", { value: item.id }, item.nombre)))),
    campo("Descripción", el("textarea", { name: "descripcion", rows: "4" })),
    campo("Precio", el("input", { name: "precio", type: "number", min: "0", step: "1", required: true })),
    el("div", { "data-anterior": "true" }, campo("Precio anterior", el("input", { name: "precio_anterior", type: "number", min: "0", step: "1" }))),
    campo("Costo", el("input", { name: "costo", type: "number", min: "0", step: "1" })),
    campo("Stock", el("input", { name: "stock", type: "number", min: "0", step: "1", required: true })),
    campo("Stock mínimo", el("input", { name: "stock_minimo", type: "number", min: "0", step: "1" })),
    el("label", { class: "check" }, el("input", { type: "checkbox", name: "requiere_formula", onchange: sincronizarOferta }), el("span", {}, "Requiere fórmula médica")),
    el("label", { class: "check" }, el("input", { type: "checkbox", name: "activo" }), el("span", {}, "Activo en la tienda")),
    campo("Ilustración", el("select", { id: "imagen-ilustracion", onchange: mostrarPrevia }, el("option", { value: "" }, "Conservar la imagen actual"), ...ILUSTRACIONES.map((ruta) => el("option", { value: ruta }, etiquetaIlustracion(ruta))))),
    el("img", { class: "admin-preview", "data-imagen-previa": "true", alt: "Vista previa de la imagen", hidden: true }),
    campo("O sube una imagen (máximo 1 MB)", el("input", { name: "imagen", type: "file", accept: "image/jpeg,image/png,image/webp", onchange: mostrarPrevia }))
  );
  const hoja = hojaDe("editor-producto", true);
  hoja.setAttribute("aria-labelledby", "producto-titulo");
  hoja.append(
    el("div", { class: "hoja-cabeza" }, el("h2", { id: "producto-titulo" }, "Nuevo producto"), btn("", "btn-neutro", "close", { "aria-label": "Cerrar", onclick: cerrarProducto })),
    el("div", { class: "hoja-cuerpo" }, el("p", { class: "form-error", "data-prod-error": "true", role: "alert", hidden: true }), form, btn("Guardar producto", "btn-principal btn-lg", "check", { onclick: () => form.requestSubmit() }))
  );
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
  const hoja = hojaDe("csv-hoja", true);
  hoja.setAttribute("aria-labelledby", "csv-titulo");
  const validas = filas.filter((fila) => !fila.errores.length);
  hoja.replaceChildren(
    el("div", { class: "hoja-cabeza" }, el("h2", { id: "csv-titulo" }, "Importar CSV"), btn("", "btn-neutro", "close", { "aria-label": "Cerrar", onclick: () => cerrarHoja(hoja) })),
    el("div", { class: "hoja-cuerpo" },
      el("p", {}, `${filas.length} filas. ${validas.length} listas para importar.`),
      el("div", { class: "tabla-scroll" }, el("table", {},
        el("thead", {}, el("tr", {}, ...["Línea", "Nombre", "Presentación", "Precio", "Stock", "Estado"].map((titulo) => el("th", {}, titulo)))),
        el("tbody", {}, ...filas.map((fila) => el("tr", { class: fila.errores.length ? "is-bad" : "" },
          el("td", {}, String(fila.linea)),
          el("td", {}, fila.nombre || "—"),
          el("td", {}, fila.presentacion || "—"),
          el("td", {}, Number.isFinite(fila.precio) ? dinero(fila.precio) : "—"),
          el("td", {}, Number.isFinite(fila.stock) ? String(fila.stock) : "—"),
          el("td", {}, fila.errores.length ? fila.errores.join(", ") : (fila.requiere_formula ? "Con fórmula" : "Listo"))
        )))
      ))
    ),
    el("div", { class: "pie-accion" }, btn(`Importar ${validas.length} productos`, "btn-principal btn-lg", "check", {
      disabled: !validas.length,
      onclick: () => importarFilas(validas)
    }))
  );
  abrirHoja(hoja);
}

async function importarFilas(filas) {
  const boton = document.querySelector("#csv-hoja .btn-principal");
  ocupado(boton, true);
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
      if (fila.codigo) payload.codigo = fila.codigo;
      if (fila.stock_minimo != null) payload.stock_minimo = fila.stock_minimo;
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
    cerrarHoja(document.getElementById("csv-hoja"));
    avisar("Importación lista.");
    paginaProducto = 1;
    await cargarProductos();
    await cargarStock();
  } catch (error) {
    avisar(mensajeError(error));
    ocupado(boton, false);
  }
}

async function cargarAjustes() {
  const form = document.querySelector("#ajustes-form");
  const aviso = document.querySelector("[data-ajuste-error]");
  try {
    const data = await leerConfigFila();
    form.dataset.id = data.id;
    form.domicilio.value = Number(data.domicilio) || 0;
    form.pedido_minimo.value = Number(data.pedido_minimo) || 0;
    form.abierto.checked = data.abierto !== false;
    form.aviso.value = data.aviso || "";
    form.tiempo_entrega.value = data.tiempo_entrega ?? "";
    form.politica_version.value = data.politica_version ?? "";
    aviso.hidden = true;
  } catch (error) {
    aviso.hidden = false;
    aviso.textContent = mensajeError(error);
  }
}

function armarAjustes() {
  const panel = document.querySelector("[data-panel='ajustes']");
  const form = el("form", { id: "ajustes-form", class: "tarjeta formulario", novalidate: true });
  form.append(
    el("h1", { id: "titulo-ajustes" }, "Ajustes"),
    el("p", { class: "form-error", "data-ajuste-error": "true", role: "alert", hidden: true }),
    campo("Costo de domicilio", el("input", { name: "domicilio", type: "number", min: "0", step: "100", required: true })),
    campo("Pedido mínimo", el("input", { name: "pedido_minimo", type: "number", min: "0", step: "100", required: true })),
    campo("Aviso de la tienda", el("textarea", { name: "aviso", rows: "3", maxlength: "280" })),
    campo("Tiempo de entrega", el("input", { name: "tiempo_entrega", maxlength: "80" })),
    campo("Versión de la política", el("input", { name: "politica_version", maxlength: "40", autocomplete: "off" })),
    el("label", { class: "switch" }, el("input", { type: "checkbox", name: "abierto" }), el("span", { class: "switch-ui", "aria-hidden": "true" }), el("span", {}, "Recibiendo pedidos")),
    btn("Guardar ajustes", "btn-principal btn-lg", "check", { type: "submit" })
  );
  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const aviso = document.querySelector("[data-ajuste-error]");
    const domicilio = Number(form.domicilio.value);
    const minimo = Number(form.pedido_minimo.value);
    if (!Number.isFinite(domicilio) || domicilio < 0 || !Number.isFinite(minimo) || minimo < 0) {
      aviso.hidden = false;
      aviso.textContent = "Revisa el domicilio y el pedido mínimo.";
      return;
    }
    const base = {
      domicilio,
      pedido_minimo: minimo,
      abierto: form.abierto.checked
    };
    const extra = {
      aviso: form.aviso.value.trim(),
      tiempo_entrega: form.tiempo_entrega.value.trim(),
      politica_version: form.politica_version.value.trim()
    };
    const patch = { ...base, ...extra };
    let respuesta = await supabase.from("config").update(patch).eq("id", form.dataset.id || configFila?.id || 1);
    if (respuesta.error) {
      respuesta = await supabase.from("config").update({ ...base, aviso: extra.aviso, tiempo_entrega: extra.tiempo_entrega }).eq("id", form.dataset.id || configFila?.id || 1);
    }
    if (respuesta.error) {
      respuesta = await supabase.from("config").update(base).eq("id", form.dataset.id || configFila?.id || 1);
    }
    if (respuesta.error) {
      aviso.hidden = false;
      aviso.textContent = mensajeError(respuesta.error);
      return;
    }
    aviso.hidden = true;
    if (configFila) Object.assign(configFila, patch);
    else configFila = { id: form.dataset.id || 1, ...patch };
    pintarTienda();
    avisar("Ajustes guardados.");
  });
  panel.append(form);
}

async function cargarAuditoria() {
  const lista = document.querySelector("[data-auditoria]");
  if (!lista) return;
  lista.replaceChildren(esqueleto("esqueleto-tarjeta"));
  const { data, error } = await supabase.from("auditoria").select("created_at,fecha,accion,action,evento,tabla,entidad,estado,resultado,modulo").order("created_at", { ascending: false }).limit(40);
  if (error || !data?.length) {
    lista.replaceChildren(vacio("Sin registros de auditoría", "Cuando el sistema deje actividad, se muestra aquí."));
    return;
  }
  const filas = data.map(filaAuditable).filter((fila) => fila.length);
  if (!filas.length) {
    lista.replaceChildren(vacio("Sin registros de auditoría", "No hay actividad para mostrar."));
    return;
  }
  lista.replaceChildren(...filas.map((fila) => el("article", { class: "tarjeta" }, ...fila.map(([clave, valor]) => el("p", {}, el("strong", {}, AUD[clave] || clave), " ", clave === "created_at" || clave === "fecha" ? (fechaHora(valor) || valor) : valor)))));
}

function armarAuditoria() {
  document.querySelector("[data-panel='auditoria']").append(
    el("h1", { id: "titulo-auditoria" }, "Auditoría"),
    el("div", { class: "lista-simple", "data-auditoria": "true" })
  );
}

function programar() {
  clearInterval(poll);
  poll = setInterval(() => {
    if (document.visibilityState !== "visible") return;
    cargarPedidos(true);
    if (seccion === "inicio") cargarStock().then(() => pintarInicioVivo());
  }, 30000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") cargarPedidos(true);
  });
}

async function activarAvisos() {
  if (typeof Notification !== "function") {
    avisar("Este navegador no muestra avisos.");
    return;
  }
  const permiso = await Notification.requestPermission();
  pintarPreferencias();
  avisar(permiso === "granted" ? "Avisos del navegador activados." : "No quedaron activados los avisos.");
}

async function salir() {
  await supabase.auth.signOut();
  location.href = "admin-login.html";
}

function armar() {
  if (armado) return;
  armado = true;
  if (negocio.modoPrueba) document.querySelector("[data-prueba]").hidden = false;
  armarNav();
  armarInicio();
  armarPedidos();
  armarFormulas();
  armarProductos();
  armarAjustes();
  armarAuditoria();
  pintarPreferencias();
  document.querySelector("[data-admin-email]").textContent = usuario?.email || "";
  document.querySelector("[data-salir]").addEventListener("click", salir);
  document.querySelector("[data-tienda]").addEventListener("click", cambiarTienda);
  document.querySelector("[data-sonido]").addEventListener("click", () => {
    guardarPref("sonido", pref("sonido", "1") === "1" ? "0" : "1");
    pintarPreferencias();
  });
  document.querySelector("button[data-tema]").addEventListener("click", () => {
    const siguiente = document.documentElement.dataset.tema === "oscuro" ? "claro" : "oscuro";
    document.documentElement.dataset.tema = siguiente;
    guardarPref("tema", siguiente);
    pintarPreferencias();
  });
  document.querySelector("button[data-densidad]").addEventListener("click", () => {
    const siguiente = document.documentElement.dataset.densidad === "compacta" ? "comoda" : "compacta";
    document.documentElement.dataset.densidad = siguiente;
    guardarPref("densidad", siguiente);
    pintarPreferencias();
  });
  const menu = document.getElementById("menu-usuario");
  document.querySelector("[data-usuario]").addEventListener("click", () => {
    menu.hidden = !menu.hidden;
    document.querySelector("[data-usuario]").setAttribute("aria-expanded", menu.hidden ? "false" : "true");
  });
  document.querySelector("[data-avisos]").addEventListener("click", activarAvisos);
  document.addEventListener("click", (evento) => {
    if (menu.hidden) return;
    if (evento.target.closest("#menu-usuario, [data-usuario]")) return;
    menu.hidden = true;
    document.querySelector("[data-usuario]").setAttribute("aria-expanded", "false");
  });
  const buscar = document.querySelector("#buscar");
  buscar.addEventListener("input", () => {
    textoPedido = buscar.value;
    pintarBusqueda();
    if (seccion === "pedidos") pintarPedidos();
  });
  buscar.addEventListener("keydown", (evento) => {
    if (evento.key !== "Enter") return;
    evento.preventDefault();
    const primero = coincidencias(buscar.value)[0];
    if (!primero) return;
    document.querySelector("[data-busca-lista]").hidden = true;
    mostrarSeccion("pedidos");
    abrirPedido(primero.id);
  });
  document.querySelector("[data-velo-detalle]").addEventListener("click", cerrarDetalle);
  document.addEventListener("keydown", (evento) => {
    if (evento.key !== "Escape") return;
    const hoja = [...document.querySelectorAll(".hoja.is-on")].pop();
    if (hoja) {
      cerrarHoja(hoja);
      return;
    }
    if (document.querySelector("[data-detalle].is-on")) cerrarDetalle();
  });
  document.addEventListener("keydown", teclado);
  ["pointerdown", "keydown", "scroll"].forEach((nombre) => document.addEventListener(nombre, tocarActividad, { passive: true }));
  tocarActividad();
  const inicial = location.hash.replace("#", "");
  mostrarSeccion(SECCIONES.some((item) => item[0] === inicial) ? inicial : "inicio");
  programar();
}

function mostrarFalloPanel(codigo) {
  const corto = String(codigo || "error").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "error";
  console.error(corto);
  const espera = document.querySelector("[data-wait]");
  const app = document.querySelector("[data-app]");
  if (app) app.hidden = true;
  if (espera) {
    espera.hidden = false;
    espera.textContent = "No pudimos abrir el panel";
  }
  let caja = document.querySelector("[data-fallo-panel]");
  if (!caja) {
    caja = document.createElement("div");
    caja.className = "espera";
    caja.dataset.falloPanel = "true";
    const detalle = document.createElement("p");
    detalle.dataset.falloCodigo = "true";
    const acciones = document.createElement("div");
    acciones.className = "acciones-inline";
    const reintentar = document.createElement("button");
    reintentar.type = "button";
    reintentar.className = "btn btn-principal";
    reintentar.textContent = "Reintentar";
    reintentar.addEventListener("click", () => location.reload());
    const salirFallo = document.createElement("button");
    salirFallo.type = "button";
    salirFallo.className = "btn btn-peligro";
    salirFallo.textContent = "Cerrar sesión";
    salirFallo.addEventListener("click", async () => {
      await cerrarSesionLocal();
      location.href = "admin-login.html";
    });
    acciones.append(reintentar, salirFallo);
    caja.append(detalle, acciones);
    (espera || document.body).after(caja);
  }
  const detalle = caja.querySelector("[data-fallo-codigo]");
  if (detalle) detalle.textContent = corto;
  caja.hidden = false;
}

async function iniciar() {
  let resultado;
  try {
    resultado = await estadoAcceso();
  } catch (error) {
    mostrarFalloPanel(codigoAcceso(error));
    return;
  }
  const ruta = destinoAcceso(resultado.estado);
  if (ruta.destino === "login") {
    const aviso = ruta.aviso ? `?aviso=${ruta.aviso}` : "";
    await ir(`admin-login.html${aviso}`, resultado.estado);
    return;
  }
  if (ruta.destino !== "panel") {
    mostrarFalloPanel(resultado.detalle || "error");
    return;
  }
  try {
    usuario = resultado.usuario;
    document.querySelector("[data-wait]").hidden = true;
    document.querySelector("[data-app]").hidden = false;
    armar();
    await Promise.all([cargarPedidos(false), cargarStock(), cargarDomiciliarios(), leerConfigFila().catch((error) => avisar(mensajeError(error)))]);
    if (seccion === "inicio") await cargarResumen();
    pintarInicioVivo();
    pintarContadores();
  } catch (error) {
    mostrarFalloPanel(codigoAcceso(error));
  }
}

iniciar();
